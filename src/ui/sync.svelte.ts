import type { GameState } from '@core/state';
import { createStorage, deviceLabel } from './platform/storage';
import { SYNC_URL, SyncClient, SyncError, newSyncCode, newWriterId, normalizeSyncCode, syncAvailable, type PutMeta, type PutResult, type RemoteMeta } from './platform/sync';

/**
 * Device sync: keeps the save of all linked devices in step through the sync
 * server. Only one device is meant to be played at a time:
 * - uploads while playing (every few minutes) and when the app goes to the background,
 * - downloads at start and when the app comes back.
 * A device that has not been played since its last upload silently takes a
 * newer cloud save. If both sides were played, the player picks one
 * (`sync.conflict`) – two saves cannot be merged.
 */

/**
 * Upload interval while the game is in the foreground and has unsynced progress. Leaving the app
 * uploads at once, so this only bounds the loss after a crash; longer = fewer server writes.
 */
const PUSH_EVERY_MS = 5 * 60_000;
/** How long the start waits for the cloud save before playing the local one. */
const START_TIMEOUT_MS = 4000;

export interface SyncLink {
  code: string;
  /** Cloud revision the local save is based on. */
  rev: number;
  /** Wall clock of the last successful exchange with the server. */
  syncedAt: number;
  /** Played on this device since the last upload. */
  dirty: boolean;
  /** This device's id in uploads (`RemoteMeta.writer`). */
  writer: string;
  /**
   * Revision of an upload sent while the page was closing, whose answer may never have arrived.
   * If the cloud history shows it landed, the local save counts as uploaded (up to the last
   * autosave before closing – the rest is idle production that the offline catch-up restores).
   */
  sentBlind?: number | null;
}

export interface SyncConflict {
  /** 'connect': entering a code on a device with its own save; 'diverged': both devices were played. */
  kind: 'connect' | 'diverged';
  code: string;
  remote: RemoteMeta & { state: GameState };
}

/** What the sync needs from the game (implemented by the store; avoids an import cycle). */
export interface SyncHost {
  exportText(): Promise<string>;
  read(text: string): Promise<{ state: GameState }>;
  /** Replaces the running game with a downloaded state and saves it. */
  adopt(state: GameState): void;
  notify(text: string, kind?: 'info' | 'error'): void;
}

class SyncView {
  link = $state<SyncLink | null>(null);
  busy = $state(false);
  /** Last error ('' = fine), shown in the options. */
  error = $state('');
  /**
   * Raw, not deep state: the conflict carries a whole save, and a deeply
   * reactive copy would turn the adopted game state into Svelte proxies
   * (slow, and `structuredClone` fails on them – e.g. the Keimprobe of a ritual).
   */
  conflict = $state.raw<SyncConflict | null>(null);
}

export const sync = new SyncView();

const linkStore = createStorage('genlab.sync.v1');
let host: SyncHost | null = null;
let cached: { code: string; client: Promise<SyncClient> } | null = null;
/** > 0 while the sync itself changes the state (download), so those saves are not counted as play. */
let quiet = 0;
/** Counts saves with player progress; an upload only clears `dirty` if none came in meanwhile. */
let edits = 0;
/** Upload encrypted ahead of time, so hiding the page can send it without waiting. */
let prepared: { body: string; edits: number; baseRev: number } | null = null;
let prepareTimer: ReturnType<typeof setTimeout> | null = null;
/** Refresh the prepared upload at most once a second (player actions can come quickly). */
const PREPARE_DELAY_MS = 1000;
/** "Später" in a conflict: no automatic exchange until the app comes back to the foreground. */
let snoozed = false;
/** Upload for this trip to the background already started (pagehide, visibilitychange and native pause all report it). */
let hideHandled = false;
let queue: Promise<unknown> = Promise.resolve();

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

function clientFor(code: string): Promise<SyncClient> {
  if (cached?.code !== code) cached = { code, client: SyncClient.connect(SYNC_URL, code) };
  return cached.client;
}

/** Runs sync operations one after another. */
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => undefined);
  return run;
}

/** Runs an operation with busy flag and error reporting; true on success. */
async function attempt(fn: () => Promise<void>, report: boolean): Promise<boolean> {
  sync.busy = true;
  try {
    await fn();
    sync.error = '';
    return true;
  } catch (err) {
    const message = err instanceof SyncError ? err.message : `Abgleich fehlgeschlagen: ${(err as Error).message}`;
    sync.error = message;
    if (report) host?.notify(message, 'error');
    return false;
  } finally {
    sync.busy = false;
  }
}

function persist(): void {
  const link = sync.link;
  void (link ? linkStore.save(JSON.stringify(link)) : linkStore.clear()).catch(() => undefined);
}

function isLink(v: unknown): v is SyncLink {
  const l = v as SyncLink | null;
  return !!l && typeof l.code === 'string' && normalizeSyncCode(l.code) === l.code && Number.isSafeInteger(l.rev) && typeof l.writer === 'string';
}

function meta(link: SyncLink): PutMeta {
  return { savedAt: Date.now(), device: deviceLabel(), writer: link.writer, baseRev: link.rev };
}

function unlink(): void {
  sync.link = null;
  sync.conflict = null;
  prepared = null;
  persist();
}

function remoteGone(): void {
  unlink();
  host?.notify('Der Cloud-Spielstand wurde gelöscht – Geräte-Sync auf diesem Gerät beendet.', 'error');
}

function adopt(link: SyncLink, state: GameState, remote: RemoteMeta): void {
  quiet++;
  try {
    host!.adopt(state);
  } finally {
    quiet--;
  }
  link.rev = remote.rev;
  link.dirty = false;
  link.sentBlind = null;
  link.syncedAt = Date.now();
  prepared = null;
  persist();
}

async function doPull(timeoutMs?: number): Promise<void> {
  const link = sync.link;
  if (!link || sync.conflict || snoozed) return;
  quiet++;
  try {
    const remote = await (await clientFor(link.code)).get(timeoutMs);
    if (sync.link !== link) return;
    if (!remote) return remoteGone();
    link.syncedAt = Date.now();
    if (remote.rev === link.rev || remote.writer === link.writer) {
      // Up to date – or the newest cloud save is our own upload whose answer got lost (page closed):
      // the local save is at least as far, keep it and upload again later.
      if (remote.rev !== link.rev) link.dirty = true;
      link.rev = remote.rev;
      link.sentBlind = null;
      return persist();
    }
    if (remote.rev < link.rev) {
      // The server lost revisions: restore it from here.
      link.rev = remote.rev;
      link.dirty = true;
      return persist();
    }
    const { state } = await host!.read(remote.text);
    // Our upload from closing the page arrived and another device continued from it.
    const landed = link.sentBlind != null && remote.recent.some((e) => e.rev === link.sentBlind && e.writer === link.writer);
    if (!link.dirty || landed) {
      adopt(link, state, remote);
      host!.notify(`☁️ Spielstand von „${remote.device}“ übernommen.`);
    } else {
      sync.conflict = { kind: 'diverged', code: link.code, remote: { ...remote, state } };
    }
  } finally {
    quiet--;
  }
}

async function finishPush(link: SyncLink, result: PutResult, editsAtStart: number): Promise<void> {
  if (sync.link !== link) return;
  if (result.ok) {
    link.rev = result.rev;
    link.sentBlind = null;
    link.syncedAt = Date.now();
    if (edits === editsAtStart) link.dirty = false;
    return persist();
  }
  if (!result.conflict) return remoteGone();
  // Someone else uploaded in between: download (adopts it or asks the player).
  await doPull();
}

async function doPush(force: boolean): Promise<void> {
  const link = sync.link;
  if (!link || sync.conflict || snoozed || (!link.dirty && !force)) return;
  const at = edits;
  const client = await clientFor(link.code);
  await finishPush(link, await client.put(await host!.exportText(), meta(link)), at);
}

/** Encrypts the current save in the background for a fast upload when the page is hidden. */
async function prepare(): Promise<void> {
  prepareTimer = null;
  const link = sync.link;
  if (!link) return;
  try {
    const at = edits;
    const baseRev = link.rev;
    const body = await (await clientFor(link.code)).prepare(await host!.exportText(), meta(link));
    prepared = { body, edits: at, baseRev };
  } catch {
    prepared = null;
  }
}

// --- Called by the store ---

/** Loads the link and fetches the cloud save (waits briefly, so the game starts on the newest save). */
export async function initSync(h: SyncHost): Promise<void> {
  host = h;
  if (!syncAvailable()) return;
  try {
    const raw = await linkStore.load();
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    sync.link = isLink(parsed) ? parsed : null;
  } catch {
    sync.link = null;
  }
  if (sync.link) await serial(() => attempt(() => doPull(START_TIMEOUT_MS), false));
  setInterval(() => {
    if (visible()) void serial(() => attempt(() => doPush(false), false));
  }, PUSH_EVERY_MS);
}

/** Every local save and player action: counts as play if the game is in the foreground. */
export function notePlay(): void {
  const link = sync.link;
  if (!link || quiet > 0 || sync.conflict || !visible()) return;
  edits++;
  hideHandled = false;
  if (!link.dirty || link.sentBlind != null) {
    link.dirty = true;
    link.sentBlind = null;
    persist();
  }
  prepareTimer ??= setTimeout(() => void prepare(), PREPARE_DELAY_MS);
}

/** The app goes to the background: upload now. */
export function syncOnHide(): void {
  const link = sync.link;
  if (!link || sync.conflict || snoozed || hideHandled) return;
  hideHandled = true;
  // The app was in the foreground until now, so it may have been played even without an autosave in between.
  edits++;
  if (!link.dirty) {
    link.dirty = true;
    persist();
  }
  const p = prepared;
  void serial(async () => {
    // Send the prepared upload first: it needs no async work before the request, so it
    // leaves even if the page is closing. The fresh one follows if there is time.
    if (p && p.baseRev === link.rev && sync.link === link) {
      link.sentBlind = p.baseRev + 1;
      persist();
      await attempt(async () => finishPush(link, await (await clientFor(link.code)).send(p.body, true), p.edits), false);
    }
    await attempt(() => doPush(false), false);
  });
}

let lastShow = 0;
/** The app is back: fetch what other devices did meanwhile. */
export function syncOnShow(): void {
  snoozed = false;
  hideHandled = false;
  // Native apps report both `resume` and `visibilitychange`.
  if (!sync.link || Date.now() - lastShow < 2000) return;
  lastShow = Date.now();
  void serial(() => attempt(() => doPull(), false));
}

/** Forget the link without asking the server (e.g. before a hard reset). */
export function unlinkLocal(): void {
  if (sync.link) unlink();
}

// --- Player actions (options / conflict dialog) ---

/** Links this device with a new code and uploads the current save. */
export function createSync(): Promise<boolean> {
  return serial(() =>
    attempt(async () => {
      const link: SyncLink = { code: newSyncCode(), rev: 0, syncedAt: 0, dirty: true, writer: newWriterId() };
      const result = await (await clientFor(link.code)).put(await host!.exportText(), meta(link));
      if (!result.ok) throw new SyncError('Dieser Code ist schon vergeben – bitte noch einmal versuchen.');
      sync.link = { ...link, rev: result.rev, syncedAt: Date.now(), dirty: false };
      persist();
    }, true),
  );
}

/** Looks up a code from another device; the player then picks a save (`sync.conflict` kind 'connect'). */
export function joinSync(input: string): Promise<boolean> {
  const code = normalizeSyncCode(input);
  if (!code) {
    host?.notify('Das ist kein gültiger Sync-Code (20 Zeichen, z. B. ABCD-EFGH-…).', 'error');
    return Promise.resolve(false);
  }
  return serial(() =>
    attempt(async () => {
      const remote = await (await clientFor(code)).get();
      if (!remote) throw new SyncError('Zu diesem Code gibt es keinen Cloud-Spielstand.');
      const { state } = await host!.read(remote.text);
      sync.conflict = { kind: 'connect', code, remote: { ...remote, state } };
    }, true),
  );
}

/** Answer to the conflict dialog: keep this device's save, load the cloud save, or decide later. */
export function resolveConflict(choice: 'local' | 'remote' | 'later'): void {
  const c = sync.conflict;
  if (!c) return;
  sync.conflict = null;
  if (choice === 'later') {
    if (c.kind === 'diverged') snoozed = true;
    return;
  }
  if (c.kind === 'connect') {
    sync.link = { code: c.code, rev: c.remote.rev, syncedAt: Date.now(), dirty: false, writer: newWriterId() };
  }
  const link = sync.link;
  if (!link) return;
  if (choice === 'remote') {
    adopt(link, c.remote.state, c.remote);
    host?.notify('☁️ Cloud-Spielstand geladen.');
    return;
  }
  // Keep this save: upload it as the successor of the cloud save.
  link.rev = c.remote.rev;
  link.dirty = true;
  edits++;
  persist();
  void serial(() => attempt(() => doPush(true), true));
}

/** Manual "Jetzt abgleichen": download, then upload local progress. */
export function syncNow(): Promise<boolean> {
  snoozed = false;
  return serial(() =>
    attempt(async () => {
      await doPull();
      await doPush(false);
    }, true),
  );
}

/** Stops syncing on this device; `deleteRemote` also removes the cloud save (other devices then stop too). */
export function leaveSync(deleteRemote: boolean): Promise<boolean> {
  return serial(() =>
    attempt(async () => {
      const link = sync.link;
      if (!link) return;
      if (deleteRemote) await (await clientFor(link.code)).remove();
      unlink();
    }, true),
  );
}
