import { describe, expect, it } from 'vitest';
import { HISTORY_SIZE, MAX_CLOCK_SKEW_MS, MAX_DATA_CHARS, MemorySaveStore, RETENTION_MS, handle, type RateLimiter } from '../sync-server/src/handler';
import { SyncClient, SyncError, newSyncCode, newWriterId, normalizeSyncCode, type PutMeta } from '@ui/platform/sync';
import { exportSave, importSave } from '@core/save';
import { NOW, makeGame } from './helpers';

const BASE = 'https://sync.test';

/** A client talking to the handler in-process, like the deployed worker. */
function setup() {
  const store = new MemorySaveStore();
  let now = NOW;
  const fetchFn = async (input: string, init?: RequestInit) => handle(new Request(input, init), store, now);
  const connect = (code: string) => SyncClient.connect(BASE, code, fetchFn);
  return { store, connect, fetchFn, tick: (ms: number) => (now += ms) };
}

const meta = (baseRev: number, writer = 'deviceaaa'): PutMeta => ({ savedAt: NOW, device: 'Browser', writer, baseRev });

describe('sync codes', () => {
  it('creates readable codes and forgives typing mistakes', () => {
    const code = newSyncCode();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){4}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normalizeSyncCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code);
    expect(normalizeSyncCode('abcd efgh oooo iiii llll')).toBe('ABCD-EFGH-0000-1111-1111');
    expect(normalizeSyncCode('ABCD-EFGH')).toBeNull();
    expect(normalizeSyncCode('ABCD-EFGH-JKMN-PQRS-TVWU')).toBeNull(); // U is not in the alphabet
    expect(newSyncCode()).not.toBe(code);
    expect(newWriterId()).toMatch(/^[0-9a-z]{8}$/);
  });
});

describe('sync server + client', () => {
  it('round-trips an encrypted save; the server never sees the code or the save', async () => {
    const { store, connect } = setup();
    const g = makeGame();
    const code = newSyncCode();
    const text = await exportSave(g.state, NOW);
    const a = await connect(code);
    expect(await a.get()).toBeNull();
    expect(await a.put(text, meta(0))).toEqual({ ok: true, rev: 1 });

    const [row] = [...store.rows.values()];
    expect(row!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.id).not.toContain(code.replace(/-/g, '').toLowerCase());
    expect(row!.data).not.toContain('GENLAB');

    const remote = await (await connect(code)).get();
    expect(remote).toMatchObject({ rev: 1, savedAt: NOW, device: 'Browser', writer: 'deviceaaa', recent: [{ rev: 1, writer: 'deviceaaa' }], text });
    expect((await importSave(remote!.text)).state.creatures).toEqual(g.state.creatures);
    // Another code finds nothing.
    expect(await (await connect(newSyncCode())).get()).toBeNull();
  });

  it('rejects an upload based on an outdated revision', async () => {
    const { connect } = setup();
    const code = newSyncCode();
    const a = await connect(code);
    const b = await connect(code);
    await a.put('GENLAB2:one', meta(0, 'devicea'));
    // Both devices start from rev 1; A uploads first.
    expect(await a.put('GENLAB2:two', meta(1, 'devicea'))).toEqual({ ok: true, rev: 2 });
    expect(await b.put('GENLAB2:three', meta(1, 'deviceb'))).toEqual({ ok: false, conflict: { rev: 2, savedAt: NOW, device: 'Browser', writer: 'devicea' } });
    // Creating an existing save is a conflict too.
    expect(await b.put('GENLAB2:four', meta(0, 'deviceb'))).toMatchObject({ ok: false, conflict: { rev: 2 } });
    expect((await b.get())!.text).toBe('GENLAB2:two');
    expect(await b.put('GENLAB2:five', meta(2, 'deviceb'))).toEqual({ ok: true, rev: 3 });
  });

  it('remembers who wrote the last revisions (a device finds its upload after a lost answer)', async () => {
    const { connect } = setup();
    const a = await connect(newSyncCode());
    await a.put('GENLAB2:x', meta(0, 'devicea'));
    for (let rev = 1; rev < 25; rev++) await a.put('GENLAB2:x', meta(rev, rev % 2 ? 'deviceb' : 'devicea'));
    const { recent } = (await a.get())!;
    expect(recent).toHaveLength(HISTORY_SIZE);
    expect(recent.at(-1)).toEqual({ rev: 25, writer: 'devicea' });
    expect(recent.at(-2)).toEqual({ rev: 24, writer: 'deviceb' });
    expect(recent[0]!.rev).toBe(25 - HISTORY_SIZE + 1);
  });

  it('deletes the cloud save; later uploads report it as gone', async () => {
    const { connect } = setup();
    const a = await connect(newSyncCode());
    await a.put('GENLAB2:x', meta(0));
    await a.remove();
    expect(await a.get()).toBeNull();
    expect(await a.put('GENLAB2:y', meta(1))).toEqual({ ok: false, conflict: null });
  });

  it('refuses tampered data and bad requests', async () => {
    const { store, connect, fetchFn } = setup();
    const a = await connect(newSyncCode());
    await a.put('GENLAB2:x', meta(0));
    const row = [...store.rows.values()][0]!;
    row.data = row.data.slice(0, -8) + 'AAAAAAA=';
    await expect(a.get()).rejects.toThrow(SyncError);

    const url = `${BASE}/v1/saves/${row.id}`;
    const put = (body: unknown) => fetchFn(url, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    const good = { baseRev: 1, savedAt: NOW, device: 'Browser', writer: 'devicea', data: 'QUJD' };
    expect((await put({ ...good, baseRev: -1 })).status).toBe(400);
    expect((await put({ ...good, writer: 'X!' })).status).toBe(400);
    expect((await put({ ...good, data: 'not base64!' })).status).toBe(400);
    expect((await put({ ...good, device: 'x'.repeat(41) })).status).toBe(400);
    expect((await put({ ...good, data: 'A'.repeat(MAX_DATA_CHARS + 4) })).status).toBe(413);
    expect((await fetchFn(`${BASE}/v1/saves/abc`)).status).toBe(400);
    expect((await fetchFn(`${BASE}/other`)).status).toBe(404);
    expect((await fetchFn(url, { method: 'POST' })).status).toBe(405);
    const pre = await fetchFn(url, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('PUT');
    expect((await put(good)).headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('stops reading an oversized body even without Content-Length, and checks device and clock', async () => {
    const store = new MemorySaveStore();
    const id = 'a'.repeat(64);
    const url = `${BASE}/v1/saves/${id}`;
    const good = { baseRev: 0, savedAt: NOW, device: 'Browser', writer: 'devicea', data: 'QUJD' };
    // A streamed body has no Content-Length: the server must still stop at the limit.
    const huge = new TextEncoder().encode(JSON.stringify({ ...good, data: 'A'.repeat(MAX_DATA_CHARS * 2) }));
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < huge.length; i += 65_536) c.enqueue(huge.slice(i, i + 65_536));
        c.close();
      },
    });
    const req = new Request(url, { method: 'PUT', body: stream, duplex: 'half' } as RequestInit);
    expect(req.headers.get('Content-Length')).toBeNull();
    expect((await handle(req, store, NOW)).status).toBe(413);
    expect(store.rows.size).toBe(0);

    const put = (body: unknown) => handle(new Request(url, { method: 'PUT', body: JSON.stringify(body) }), store, NOW);
    expect((await put({ ...good, device: 'Brow\u0000ser' })).status).toBe(400);
    expect((await put({ ...good, savedAt: NOW + 1e12 })).status).toBe(200);
    expect(store.rows.get(id)!.savedAt).toBe(NOW + MAX_CLOCK_SKEW_MS);
  });

  it('answers 429 when a rate limit is exhausted; new saves have their own limit', async () => {
    const store = new MemorySaveStore();
    const allowing = (n: number): RateLimiter & { calls: string[] } => {
      const calls: string[] = [];
      return { calls, limit: async ({ key }) => (calls.push(key), { success: calls.length <= n }) };
    };
    const limiter = allowing(2);
    const createLimiter = allowing(1);
    const put = (id: string) =>
      handle(
        new Request(`${BASE}/v1/saves/${id}`, { method: 'PUT', headers: { 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify({ baseRev: 0, savedAt: NOW, device: 'Browser', writer: 'devicea', data: 'QUJD' }) }),
        store, NOW, { limiter, createLimiter },
      );
    expect((await put('a'.repeat(64))).status).toBe(200);
    expect((await put('b'.repeat(64))).status).toBe(429); // create limit
    expect((await put('c'.repeat(64))).status).toBe(429); // overall limit
    expect(store.rows.size).toBe(1);
    expect(limiter.calls).toEqual(['203.0.113.7', '203.0.113.7', '203.0.113.7']);
  });

  it('can restrict browser origins', async () => {
    const store = new MemorySaveStore();
    const opts = { allowedOrigins: ['https://arrows94.github.io', 'capacitor://localhost'] };
    const pre = (origin: string) => handle(new Request(`${BASE}/v1/saves/${'a'.repeat(64)}`, { method: 'OPTIONS', headers: { Origin: origin } }), store, NOW, opts);
    expect((await pre('capacitor://localhost')).headers.get('Access-Control-Allow-Origin')).toBe('capacitor://localhost');
    expect((await pre('https://evil.example')).headers.get('Access-Control-Allow-Origin')).toBe('https://arrows94.github.io');
  });

  it('reports an unreachable server as a readable error', async () => {
    const client = await SyncClient.connect(BASE, newSyncCode(), async () => {
      throw new TypeError('fetch failed');
    });
    await expect(client.get()).rejects.toThrow('Keine Verbindung zum Sync-Server.');
  });

  it('purges saves nobody synced for the retention period', async () => {
    const { store, connect, tick } = setup();
    await (await connect(newSyncCode())).put('GENLAB2:old', meta(0));
    tick(RETENTION_MS);
    await (await connect(newSyncCode())).put('GENLAB2:new', meta(0));
    expect(await store.purge(NOW + RETENTION_MS - 1)).toBe(1);
    expect(store.rows.size).toBe(1);
  });
});
