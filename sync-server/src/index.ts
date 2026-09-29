import { RETENTION_MS, handle, type HistoryEntry, type SaveRow, type SaveStore } from './handler';

/** The parts of Cloudflare's D1 binding used here (avoids a dependency on @cloudflare/workers-types). */
interface D1Result {
  meta: { changes: number };
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
}

interface DbRow {
  id: string;
  rev: number;
  saved_at: number;
  device: string;
  writer: string;
  history: string;
  data: string;
  updated_at: number;
}

/** D1 (SQLite) store, schema in schema.sql. Conditional writes keep concurrent devices from overwriting each other. */
class D1SaveStore implements SaveStore {
  constructor(private db: D1Database) {}

  async get(id: string): Promise<SaveRow | null> {
    const r = await this.db.prepare('SELECT * FROM saves WHERE id = ?').bind(id).first<DbRow>();
    return r && { id: r.id, rev: r.rev, savedAt: r.saved_at, device: r.device, writer: r.writer, history: JSON.parse(r.history) as HistoryEntry[], data: r.data, updatedAt: r.updated_at };
  }

  async insert(row: SaveRow): Promise<boolean> {
    const res = await this.db
      .prepare('INSERT INTO saves (id, rev, saved_at, device, writer, history, data, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
      .bind(row.id, row.rev, row.savedAt, row.device, row.writer, JSON.stringify(row.history), row.data, row.updatedAt)
      .run();
    return res.meta.changes > 0;
  }

  async update(row: SaveRow, baseRev: number): Promise<boolean> {
    const res = await this.db
      .prepare('UPDATE saves SET rev = ?, saved_at = ?, device = ?, writer = ?, history = ?, data = ?, updated_at = ? WHERE id = ? AND rev = ?')
      .bind(row.rev, row.savedAt, row.device, row.writer, JSON.stringify(row.history), row.data, row.updatedAt, row.id, baseRev)
      .run();
    return res.meta.changes > 0;
  }

  async delete(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM saves WHERE id = ?').bind(id).run();
  }

  /** Full table scan (no index on updated_at, see schema.sql) – once a day that only costs rows read. */
  async purge(before: number): Promise<number> {
    const res = await this.db.prepare('DELETE FROM saves WHERE updated_at < ?').bind(before).run();
    return res.meta.changes;
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, new D1SaveStore(env.DB));
  },
  /** Daily cron (wrangler.toml): drop saves nobody has synced for a year. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    await new D1SaveStore(env.DB).purge(Date.now() - RETENTION_MS);
  },
};
