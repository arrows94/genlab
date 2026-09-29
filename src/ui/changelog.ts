/**
 * Player-facing release notes ("Was ist neu?"). Newest entry first; `id`
 * counts up by one per release. Write for players, not developers: what can
 * I do now that I couldn't before?
 *
 * No spoilers: an item with `feature` is only shown once the player has
 * unlocked that feature (ids from content/progression.ts). Hidden items are
 * only counted ("… und 2 Verbesserungen für Bereiche, die du noch entdeckst").
 *
 * The build also publishes this list as `changelog.json`, so an older
 * version can preview the notes in its update banner.
 */
export interface ChangelogItem {
  text: string;
  feature?: string;
}

export interface ChangelogEntry {
  id: number;
  /** ISO date, shown as "28. September 2026". */
  date: string;
  title: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 1,
    date: '2026-09-28',
    title: 'Mehr Übersicht',
    items: [
      { text: 'Die Tagesbelohnung im Labor ist jetzt eine schmale Leiste mit Abholen-Knopf – den Kalender kannst du aufklappen.', feature: 'daily' },
      { text: 'Kreaturen, die gerade auf Erkundung sind, kannst du in der Kreaturenliste ausblenden.', feature: 'expedition' },
      { text: 'Alle Anlagen zeigen gleich viele Arbeitsplätze – Plätze, die du noch ausbauen kannst, sind mit 🔒 markiert.', feature: 'farm' },
      { text: 'Die Großforschung lässt sich einklappen; die laufenden Projekte bleiben sichtbar.', feature: 'grandResearch' },
      { text: 'Brutstation: Die Kandidaten lassen sich nach Stärke, Seltenheit, Generation, Art, Name oder einzelnen Werten sortieren und nach Seltenheit filtern.', feature: 'breeding' },
      { text: 'Beim Losschicken auf Erkundung kannst du arbeitende Kreaturen und Favoriten ausblenden – markiere eine Kreatur mit ★, damit sie zu Hause bleibt.', feature: 'expedition' },
      { text: 'Die Wochenexpedition lässt sich einklappen und steht jetzt unter der Kreaturenauswahl.', feature: 'voyage' },
      { text: 'Infusion: Die Seltenheit ist frei wählbar, dazu gibt es die Schnellauswahl „bis zur nächsten Stufe“, „bis zur Höchststufe“ und „nur Allel-Spender“.', feature: 'infusion' },
    ],
  },
];

/** Release the running build belongs to. */
export const CURRENT_RELEASE = CHANGELOG[0]?.id ?? 0;

export interface VisibleEntry {
  id: number;
  date: string;
  title: string;
  items: string[];
  /** Items about features the player has not discovered yet. */
  hidden: number;
}

/** Entries newer than `sinceId`, with not yet unlocked features left out. */
export function visibleNews(entries: readonly ChangelogEntry[], sinceId: number, unlocked: (feature: string) => boolean): VisibleEntry[] {
  return entries
    .filter((e) => e.id > sinceId)
    .map((e) => {
      const shown = e.items.filter((i) => !i.feature || unlocked(i.feature));
      return { id: e.id, date: e.date, title: e.title, items: shown.map((i) => i.text), hidden: e.items.length - shown.length };
    })
    .filter((e) => e.items.length > 0 || e.hidden > 0);
}

export function formatReleaseDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** "2 Verbesserungen für Bereiche, die du noch entdeckst." */
export function hiddenText(n: number): string {
  return n === 1 ? 'Eine Verbesserung für einen Bereich, den du noch entdeckst.' : `${n} Verbesserungen für Bereiche, die du noch entdeckst.`;
}

/** Loose check for the downloaded changelog.json of a newer version. */
export function parseChangelog(data: unknown): ChangelogEntry[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (e): e is ChangelogEntry =>
      !!e && typeof e.id === 'number' && typeof e.date === 'string' && typeof e.title === 'string' && Array.isArray(e.items) &&
      e.items.every((i: unknown) => !!i && typeof (i as ChangelogItem).text === 'string'),
  );
}
