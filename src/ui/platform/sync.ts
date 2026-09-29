/**
 * Client for the Genlab sync server (sync-server/). A random sync code links
 * devices; the server id and the AES key are both derived from it, so the
 * server only ever stores ciphertext and never learns the code.
 */

/** Base URL of the sync server, set at build time (`VITE_SYNC_URL`). Empty = sync not offered. */
export const SYNC_URL: string = (import.meta.env.VITE_SYNC_URL ?? '').trim().replace(/\/+$/, '');

export function syncAvailable(): boolean {
  return SYNC_URL !== '';
}

export class SyncError extends Error {
  override name = 'SyncError';
}

// Crockford base32: no I, L, O, U – nothing to mix up when typing a code from another screen.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 20; // 100 bit

/** New random code, shown as `XXXX-XXXX-XXXX-XXXX-XXXX`. */
export function newSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_CHARS));
  return group(Array.from(bytes, (b) => ALPHABET[b & 31]).join(''));
}

/** Canonical form of a typed code (case, dashes, spaces, O/0 and I/L/1 mix-ups forgiven); null if it cannot be one. */
export function normalizeSyncCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (raw.length !== CODE_CHARS || [...raw].some((ch) => !ALPHABET.includes(ch))) return null;
  return group(raw);
}

const group = (raw: string) => raw.match(/.{4}/g)!.join('-');

async function sha256(text: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

interface SyncKeys {
  id: string;
  key: CryptoKey;
}

async function deriveKeys(code: string): Promise<SyncKeys> {
  const raw = code.replace(/-/g, '');
  const id = Array.from(await sha256(`genlab-sync/id/${raw}`), (b) => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', await sha256(`genlab-sync/key/${raw}`), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id, key };
}

async function seal(keys: SyncKeys, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.key, new TextEncoder().encode(text)));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv);
  out.set(cipher, iv.length);
  return toBase64(out);
}

async function unseal(keys: SyncKeys, data: string): Promise<string> {
  try {
    const bytes = Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, keys.key, bytes.slice(12));
    return new TextDecoder().decode(plain);
  } catch {
    throw new SyncError('Der Cloud-Stand ließ sich nicht entschlüsseln.');
  }
}

/** Server-side facts about the stored save. */
export interface RemoteMeta {
  rev: number;
  /** When the uploading device saved it (epoch ms). */
  savedAt: number;
  /** Label of the uploading device ("Android", "Browser" …). */
  device: string;
  /** Random id of the uploading device (see `newWriterId`). */
  writer: string;
}

/** Per-device id sent with every upload, so a device recognises its own writes. */
export function newWriterId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');
}

export interface PutMeta {
  savedAt: number;
  device: string;
  writer: string;
  /** Revision the upload is based on; 0 = create. */
  baseRev: number;
}

export interface RemoteSave extends RemoteMeta {
  /** The export text (`GENLAB2:…`), decrypted. */
  text: string;
  /** Writers of the last revisions, oldest first. */
  recent: { rev: number; writer: string }[];
}

/** `conflict: null` = the cloud save no longer exists (deleted on another device). */
export type PutResult = { ok: true; rev: number } | { ok: false; conflict: RemoteMeta | null };

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class SyncClient {
  private constructor(
    private url: string,
    private keys: SyncKeys,
    private fetchFn: Fetch,
  ) {}

  static async connect(base: string, code: string, fetchFn: Fetch = (i, o) => fetch(i, o)): Promise<SyncClient> {
    const keys = await deriveKeys(code);
    return new SyncClient(`${base}/v1/saves/${keys.id}`, keys, fetchFn);
  }

  private async request(init: RequestInit, timeoutMs = 10_000): Promise<Response> {
    try {
      return await this.fetchFn(this.url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    } catch {
      throw new SyncError('Keine Verbindung zum Sync-Server.');
    }
  }

  private static fail(res: Response): never {
    throw new SyncError(`Der Sync-Server meldet einen Fehler (${res.status}).`);
  }

  async get(timeoutMs?: number): Promise<RemoteSave | null> {
    const res = await this.request({ method: 'GET' }, timeoutMs);
    if (res.status === 404) return null;
    if (!res.ok) SyncClient.fail(res);
    const body = (await res.json()) as Omit<RemoteSave, 'text'> & { data: string };
    const text = await unseal(this.keys, body.data);
    return { rev: body.rev, savedAt: body.savedAt, device: body.device, writer: body.writer, recent: body.recent ?? [], text };
  }

  /** Encrypts an upload; `send` can then transmit it without any further async work (see page hide). */
  async prepare(text: string, meta: PutMeta): Promise<string> {
    return JSON.stringify({ ...meta, data: await seal(this.keys, text) });
  }

  /** `keepalive` lets the request finish while the page closes. */
  async send(body: string, keepalive = false): Promise<PutResult> {
    // Browsers cap keepalive bodies at 64 KB.
    const res = await this.request({ method: 'PUT', body, headers: { 'Content-Type': 'application/json' }, keepalive: keepalive && body.length < 60_000 });
    if (res.status === 404) return { ok: false, conflict: null };
    if (res.status === 409) return { ok: false, conflict: (await res.json()) as RemoteMeta };
    if (!res.ok) SyncClient.fail(res);
    return { ok: true, rev: ((await res.json()) as { rev: number }).rev };
  }

  async put(text: string, meta: PutMeta): Promise<PutResult> {
    return this.send(await this.prepare(text, meta));
  }

  async remove(): Promise<void> {
    const res = await this.request({ method: 'DELETE' });
    if (!res.ok) SyncClient.fail(res);
  }
}
