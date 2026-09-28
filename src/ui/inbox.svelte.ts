/**
 * Notification center: keeps the toasts after they fade, so nothing is missed
 * when several arrive at once or the game catches up after a break.
 * Per-device like the prefs, stored separately in localStorage.
 */
export type NoticeKind = 'info' | 'unlock' | 'rare' | 'error';

export interface InboxEntry {
  id: number;
  text: string;
  kind: NoticeKind;
  /** Wall clock of the (latest) occurrence. */
  at: number;
  /** Identical messages in a row are merged and counted. */
  count: number;
}

const KEY = 'genlab.inbox';
const MAX = 100;
/** Repeats of the same message within this window are merged into one entry. */
const MERGE_MS = 60_000;

export const inbox = $state({
  /** Newest first. */
  entries: [] as InboxEntry[],
  unread: 0,
  open: false,
});

let nextId = 0;
let dirty = false;

export function record(text: string, kind: NoticeKind, at = Date.now()): void {
  const last = inbox.entries[0];
  if (last && last.text === text && last.kind === kind && at - last.at < MERGE_MS) {
    inbox.entries = [{ ...last, at, count: last.count + 1 }, ...inbox.entries.slice(1)];
  } else {
    inbox.entries = [{ id: ++nextId, text, kind, at, count: 1 }, ...inbox.entries].slice(0, MAX);
  }
  if (!inbox.open) inbox.unread = Math.min(inbox.unread + 1, MAX);
  dirty = true;
}

export function openInbox(open = !inbox.open): void {
  inbox.open = open;
  if (open && inbox.unread) {
    inbox.unread = 0;
    dirty = true;
  }
}

export function clearInbox(): void {
  inbox.entries = [];
  inbox.unread = 0;
  dirty = true;
  saveInbox();
}

export function loadInbox(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { entries?: InboxEntry[]; unread?: number };
    if (Array.isArray(data.entries)) inbox.entries = data.entries.slice(0, MAX);
    inbox.unread = Math.min(Number(data.unread) || 0, inbox.entries.length);
    nextId = inbox.entries.reduce((m, e) => Math.max(m, e.id), 0);
  } catch {
    /* start empty */
  }
}

/** Writes the log if it changed; called with the autosave. */
export function saveInbox(): void {
  if (!dirty) return;
  dirty = false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ entries: inbox.entries, unread: inbox.unread }));
  } catch {
    /* ignore */
  }
}
