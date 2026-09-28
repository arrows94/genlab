import { CHANGELOG, CURRENT_RELEASE, visibleNews, type VisibleEntry } from './changelog';

/**
 * "Was ist neu?" after an update: shown once per device for every release
 * the player has not seen yet. Fresh players skip it – everything is new to
 * them anyway. Stored outside the save game, like the preferences.
 */
const KEY = 'genlab.news';

export const news = $state({ open: false, entries: [] as VisibleEntry[], latest: CURRENT_RELEASE });

function readSeen(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? null : Number(raw) || 0;
  } catch {
    return null;
  }
}

function writeSeen(id: number): void {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    /* private mode: shown again next time */
  }
}

/** `hadSave`: a save existed before this start (players from before the changelog see its first entry). */
export function initNews(hadSave: boolean, unlocked: (feature: string) => boolean): void {
  const seen = readSeen() ?? (hadSave ? 0 : CURRENT_RELEASE);
  if (seen >= CURRENT_RELEASE) {
    writeSeen(CURRENT_RELEASE);
    return;
  }
  const entries = visibleNews(CHANGELOG, seen, unlocked);
  if (entries.length === 0) {
    writeSeen(CURRENT_RELEASE);
    return;
  }
  news.entries = entries;
  news.open = true;
}

/** Re-read the notes from the options (everything, still without spoilers). */
export function openAllNews(unlocked: (feature: string) => boolean): void {
  news.entries = visibleNews(CHANGELOG, 0, unlocked);
  news.open = true;
}

export function closeNews(): void {
  news.open = false;
  writeSeen(CURRENT_RELEASE);
}
