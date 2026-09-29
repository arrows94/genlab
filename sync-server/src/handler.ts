/**
 * Genlab sync server: stores one encrypted save per sync code.
 *
 * The client derives the id (SHA-256, 64 hex chars) and the AES key from the
 * sync code, so this server never sees the code or a readable save. Writes
 * use optimistic concurrency: a PUT names the revision it is based on and is
 * rejected with 409 when another device wrote in between.
 *
 *   GET    /v1/saves/:id  → 200 { rev, savedAt, device, writer, recent, data } | 404
 *   PUT    /v1/saves/:id  { baseRev, savedAt, device, writer, data } → 200 { rev } | 409 { rev, savedAt, device, writer } | 404
 *   DELETE /v1/saves/:id  → 204
 */

export interface SaveRow {
  id: string;
  rev: number;
  savedAt: number;
  device: string;
  /** Random id of the uploading device, so it recognises its own write after a lost response. */
  writer: string;
  /** Who wrote the last revisions (oldest first, at most `HISTORY_SIZE`). */
  history: HistoryEntry[];
  /** base64(iv ‖ AES-GCM ciphertext), opaque to the server. */
  data: string;
  updatedAt: number;
}

export interface HistoryEntry {
  rev: number;
  writer: string;
}

export interface SaveStore {
  get(id: string): Promise<SaveRow | null>;
  /** Creates the save with rev 1; false if the id already exists. */
  insert(row: SaveRow): Promise<boolean>;
  /** Writes rev `baseRev + 1` only if the stored rev is still `baseRev`. */
  update(row: SaveRow, baseRev: number): Promise<boolean>;
  delete(id: string): Promise<void>;
  /** Removes saves not written since `before` (epoch ms); returns how many. */
  purge(before: number): Promise<number>;
}

/** Largest accepted `data` string (a late-game save is ~15 KB). */
export const MAX_DATA_CHARS = 512 * 1024;
/** Revisions kept in `SaveRow.history`. */
export const HISTORY_SIZE = 20;
/** Saves untouched this long are deleted by the daily cleanup. */
export const RETENTION_MS = 365 * 24 * 3600 * 1000;

const ID = /^[0-9a-f]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const WRITER = /^[0-9a-z]{4,16}$/;

const CORS = {
  // No cookies or other credentials: the secret id in the path is the only key.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

const error = (status: number, message: string) => json({ error: message }, status);

interface PutBody {
  baseRev: number;
  savedAt: number;
  device: string;
  writer: string;
  data: string;
}

function parsePut(body: unknown): PutBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!Number.isSafeInteger(b.baseRev) || (b.baseRev as number) < 0) return null;
  if (!Number.isSafeInteger(b.savedAt) || (b.savedAt as number) < 0) return null;
  if (typeof b.device !== 'string' || b.device.length > 40) return null;
  if (typeof b.writer !== 'string' || !WRITER.test(b.writer)) return null;
  if (typeof b.data !== 'string' || b.data.length === 0 || !BASE64.test(b.data)) return null;
  return { baseRev: b.baseRev as number, savedAt: b.savedAt as number, device: b.device, writer: b.writer, data: b.data };
}

export async function handle(request: Request, store: SaveStore, now = Date.now()): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  const match = /^\/v1\/saves\/([^/]+)$/.exec(url.pathname);
  if (!match) return error(404, 'not found');
  const id = match[1]!;
  if (!ID.test(id)) return error(400, 'bad id');

  if (request.method === 'GET') {
    const row = await store.get(id);
    if (!row) return error(404, 'no save');
    return json({ rev: row.rev, savedAt: row.savedAt, device: row.device, writer: row.writer, recent: row.history, data: row.data });
  }

  if (request.method === 'DELETE') {
    await store.delete(id);
    return new Response(null, { status: 204, headers: CORS });
  }

  if (request.method === 'PUT') {
    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > MAX_DATA_CHARS + 1024) return error(413, 'too large');
    const text = await request.text();
    if (text.length > MAX_DATA_CHARS + 1024) return error(413, 'too large');
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return error(400, 'bad json');
    }
    const body = parsePut(parsed);
    if (!body) return error(400, 'bad body');
    if (body.data.length > MAX_DATA_CHARS) return error(413, 'too large');
    const conflict = (row: SaveRow) => json({ rev: row.rev, savedAt: row.savedAt, device: row.device, writer: row.writer }, 409);
    const rev = body.baseRev + 1;
    const fields = { id, rev, savedAt: body.savedAt, device: body.device, writer: body.writer, data: body.data, updatedAt: now };
    if (body.baseRev === 0) {
      if (await store.insert({ ...fields, history: [{ rev, writer: body.writer }] })) return json({ rev });
    } else {
      const current = await store.get(id);
      if (!current) return error(404, 'no save');
      if (current.rev !== body.baseRev) return conflict(current);
      const history = [...current.history, { rev, writer: body.writer }].slice(-HISTORY_SIZE);
      if (await store.update({ ...fields, history }, body.baseRev)) return json({ rev });
    }
    // Lost a race against another device.
    const current = await store.get(id);
    return current ? conflict(current) : error(404, 'no save');
  }

  return error(405, 'method not allowed');
}

/** In-memory store for tests and local experiments. */
export class MemorySaveStore implements SaveStore {
  readonly rows = new Map<string, SaveRow>();
  async get(id: string) {
    const row = this.rows.get(id);
    return row ? { ...row, history: [...row.history] } : null;
  }
  async insert(row: SaveRow) {
    if (this.rows.has(row.id)) return false;
    this.rows.set(row.id, { ...row });
    return true;
  }
  async update(row: SaveRow, baseRev: number) {
    if (this.rows.get(row.id)?.rev !== baseRev) return false;
    this.rows.set(row.id, { ...row });
    return true;
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async purge(before: number) {
    let n = 0;
    for (const [id, row] of this.rows) if (row.updatedAt < before && this.rows.delete(id)) n++;
    return n;
  }
}
