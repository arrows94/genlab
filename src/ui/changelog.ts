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
    id: 8,
    date: '2026-09-29',
    title: 'Alles zum Recycler und Töne einstellbar',
    items: [
      { text: 'Recyceln im Labor und in der Detailansicht schickt Kreaturen jetzt in die Zerlege-Kammer des Gen-Recyclers. Dort werden sie nacheinander zerlegt – vor allem, was der Recycling-Automat auswählt. Bis zuletzt kannst du sie mit „↩ Zurückholen“ wieder herausnehmen.', feature: 'recycler' },
      { text: 'Die Forschung „Schnellzerlegung“ gibt es jetzt schon mit dem Gen-Recycler, nicht erst mit dem Recycling-Automaten.', feature: 'recycler' },
      { text: 'Unter Optionen gibt es einen Lautstärke-Regler mit Probeton. Beim Nachholen der Offline-Zeit und in einem Hintergrund-Tab bleibt das Spiel still.' },
    ],
  },
  {
    id: 7,
    date: '2026-09-29',
    title: 'Zuchtautomat und Recycling-Automat arbeiten zusammen',
    items: [
      { text: 'Der Zuchtautomat räumt den Stall nicht mehr selbst auf. Ist der Stall voll, wartet er – Platz schafft der Recycling-Automat mit seiner Zerlege-Kammer. So nehmen sich die beiden nicht mehr gegenseitig die Kreaturen weg.', feature: 'autoBreed' },
      { text: 'Die Zerlege-Kammer wird nicht mehr unterbrochen: Eine Kreatur, die drin ist, wird fertig recycelt – außer du rettest sie als Favorit ★.', feature: 'autoRecycle' },
    ],
  },
  {
    id: 6,
    date: '2026-09-29',
    title: 'Stammbaum-Dynastien, Familiennamen und neue Brutrituale',
    items: [
      { text: 'Große Momente werden gefeiert: Das erste perfekte Genom einer Art erscheint bildschirmfüllend als „OPTIMALE DNS“, die erste schillernde Kreatur einer Art als „SCHILLERND!“ – jeweils mit Fanfare. Die Töne lassen sich unter Optionen ausschalten.' },
      { text: 'Neue Namen: Frisch geschlüpfte Kreaturen bekommen einen Rufnamen und den Familiennamen des stärkeren Elternteils, zum Beispiel „Kiko Funkenstein“. Hat noch keiner eine Familie, gründet der stärkere eine – passend zu seinem Element. Keine seltsamen Silbensalate mehr nach vielen Generationen.', feature: 'breeding' },
      { text: 'Besondere Brut überarbeitet: Rituale laufen im eigenen Ritualnest neben den normalen Nestern und brauchen nur eine Keimprobe – die Eltern bleiben frei.', feature: 'specialBreeding' },
      { text: 'Kürzer und sicherer: Kreuzungsritual 1 Stunde (passt ein Rezept, wird es sicher ein Hybrid), Edelbrut 3 Stunden (mindestens Selten), Meisterbrut 8 Stunden (mindestens Episch).', feature: 'specialBreeding' },
      { text: 'Der Recycling-Automat arbeitet jetzt sichtbar: Er nimmt eine Kreatur nach der anderen in seine Zerlege-Kammer, statt alle auf einmal zu recyceln. Du siehst, wer gerade dran ist, wie lange es noch dauert und wer als Nächstes kommt – und kannst sie mit „★ Retten“ noch behalten.', feature: 'autoRecycle' },
      { text: 'Anfangs braucht die Kammer 3 Minuten je Kreatur. Die neue Forschung „Schnellzerlegung“ (10 Stufen) bringt das auf wenige Sekunden.', feature: 'autoRecycle' },
      { text: 'Neues Äon-Talent „Stammbaum-Dynastien“ (Stufe 2): Es öffnet reine Linien in der Brutstation.', feature: 'aeon' },
      { text: 'Neu: Stammbaum-Dynastien. Paare Kreaturen derselben Art – jede Generation in Folge vertieft die reine Linie und macht das Kind stärker (+1 % Werte je Generation).', feature: 'dynasties' },
      { text: 'Der Rekord jeder Art bleibt für immer. Ab Linien-Tiefe 5, 10, 20, 35 und 50 steigt die Dynastie eine Stufe: mehr Werte für die ganze Art und mehr Produktion. Die Stufen 4 und 5 bringen Äon-Splitter.', feature: 'dynasties' },
      { text: 'Die Brutstation zeigt die Linie des nächsten Kindes und eine Übersicht aller Dynastien. Kandidaten und Kreaturenliste lassen sich nach „Reine Linie“ sortieren, und der Zuchtautomat kann reine Linien gezielt vertiefen.', feature: 'dynasties' },
      { text: 'Genom-Turm: Bosse mit Regeneration heilen jetzt 40 % des Schadens, den sie in der Runde genommen haben – statt 8 % ihrer KP. Sie sind dadurch keine unüberwindbare Wand mehr.', feature: 'tower' },
      { text: 'Die Brutstation am Handy: Die Sortierung der Kandidaten hat eine eigene Zeile und ist wieder lesbar.', feature: 'breeding' },
    ],
  },
  {
    id: 5,
    date: '2026-09-29',
    title: 'Turm-Verlauf und umkehrbare Sortierung',
    items: [
      { text: 'Genom-Turm: Die Bestenliste zeigt nur noch die drei besten Läufe. Darunter siehst du deine letzten zehn Läufe – mit Etage, Startetage, Team und Uhrzeit.', feature: 'tower' },
      { text: 'Neben der Sortierung im Labor sitzt jetzt ein ⇅-Knopf, der die Reihenfolge umdreht: schwächste zuerst, häufigste Seltenheit zuerst, Name von Z bis A …' },
      { text: 'Auch die Kandidaten der Brutstation lassen sich mit ⇅ umgekehrt sortieren.', feature: 'breeding' },
      { text: 'Genom-Turm: Die Kandidaten lassen sich mit ⇅ umgekehrt sortieren.', feature: 'tower' },
    ],
  },
  {
    id: 4,
    date: '2026-09-29',
    title: 'Anomalien mit Stufen',
    items: [
      { text: 'Jede Anomalie hat jetzt die Stufen I–V. Die nächste Stufe öffnet sich, wenn du die vorige meisterst – mit härteren Regeln und größerem Ziel.', feature: 'anomalies' },
      { text: 'Die Ziele der Anomalien wachsen mit deinem Produktionsbonus. So bleiben sie auch nach vielen Neustarts eine Herausforderung. Das Ziel wird beim Start des Laufs festgelegt.', feature: 'anomalies' },
      { text: 'Anomalien lassen sich kombinieren: Wähle für mehrere eine Stufe und starte sie zusammen. Geschafft ist der Lauf, wenn alle Ziele erreicht sind.', feature: 'anomalies' },
      { text: 'Die Belohnung einer Anomalie zählt je gemeisterter Stufe. Ein neuer Rekord in der Gesamtschwierigkeit (Summe der Stufen) bringt dauerhaft mehr Produktion und Erbgut.', feature: 'anomalies' },
      { text: 'Jeder neue Anomalie-Rekord bringt außerdem einen Äon-Splitter je Punkt Gesamtschwierigkeit.', feature: 'aeon' },
      { text: 'Die Äon-Resonanz öffnet sich schon mit den Linsen, der dritten Bauphase des Äon-Observatoriums – nicht erst mit der Sternkarte.', feature: 'megaProjects' },
      { text: 'Genom-Turm: Relikte werden mit jeder Stufe deutlich teurer. Bereits gekaufte Stufen bleiben erhalten.', feature: 'tower' },
      { text: 'Der Gen-Recycler ist neu gestaltet: Jede Kapsel hat ein eigenes Aussehen, die Chancen stehen als Farbbalken daneben, und du siehst, in wie vielen Kapseln die Garantie greift.', feature: 'recycler' },
      { text: 'Kapseln öffnen sich jetzt mit Animation: Die Kapsel rüttelt und leuchtet schon in der Farbe des besten Fundes, platzt auf, und die Kreaturen drehen sich eine nach der anderen um. Ab „Episch“ gibt es ein Banner. Tippen überspringt die Animation.', feature: 'recycler' },
      { text: 'Die Gen-Helix neben dem Sammeln-Knopf springt beim Klicken nicht mehr zurück, sondern dreht sich schneller – je schneller du sammelst, desto mehr leuchtet sie.' },
      { text: 'Das Wochen-Banner verrät jetzt auch die Mutation der nächsten Woche und wann sie beginnt – so kannst du deine Zucht schon darauf ausrichten.', feature: 'weekly' },
      { text: 'Genom-Turm: Der Auto-Neustart beginnt dort, wo du deinen letzten Lauf gestartet hast. Startest du „Ab Etage 1“, geht es nach einer Niederlage auch wieder bei Etage 1 los – praktisch nach einer Vererbung, wenn das Team noch schwach ist.', feature: 'towerAuto' },
    ],
  },
  {
    id: 3,
    date: '2026-09-29',
    title: 'Sicherer Stall',
    items: [
      { text: 'Der Zuchtautomat räumt bei vollem Stall nicht mehr die letzten Kreaturen einer Art weg: Die stärksten jeder Art bleiben stehen – so viele, wie beim Recycling-Automaten unter „Je Art behalten“ eingestellt ist (Standard: 2).', feature: 'autoBreed' },
      { text: 'Der Zuchtautomat zeigt, welche Kreatur beim nächsten vollen Stall als Nächstes gehen würde. Favoriten ★ sind wie immer geschützt.', feature: 'autoBreed' },
      { text: 'Ein Äon bringt mehr Splitter: √(Erbgut / 25) statt √(Erbgut / 50) – etwa 40 % mehr für dasselbe Erbgut.', feature: 'aeon' },
      { text: 'Die Talente der Stufen 4 und 5 im Äon-Talentbaum sind günstiger (6 und 9 statt 8 und 12 Splitter).', feature: 'megaProjects' },
      { text: 'Genom-Turm: Ab Etage 20 haben Bosse eine Eigenheit – Element-Schild, Wandler oder Regeneration. Sie steht vor dem Kampf beim Gegner.', feature: 'tower' },
      { text: 'Genom-Turm: Relikte für Turm-Marken. Du steckst sie in die Plätze deines Turm-Teams, und sie bleiben über jeden Neustart.', feature: 'tower' },
      { text: 'Genom-Turm: Alle 50 Etagen ein Meilenstein – dauerhaft mehr Turm-Schaden und Produktion, beim ersten Mal dazu Äon-Splitter.', feature: 'tower' },
      { text: 'Der Äon-Tab zeigt jetzt dieselbe Übersicht wie die Vererbung: Splitter-Gewinn, was verloren geht und was bleibt, und eine Zeitleiste deiner Äonen samt der Vererbungen dazwischen.', feature: 'aeon' },
    ],
  },
  {
    id: 2,
    date: '2026-09-29',
    title: 'Feinschliff',
    items: [
      { text: 'Jeder Tab hat jetzt oben eine einheitliche Kopfzeile mit den wichtigsten Kennzahlen auf einen Blick.' },
      { text: 'Seltene Kreaturen fallen stärker auf: Ab Episch läuft ein Schimmer über den Kartenrahmen, ab Legendär leuchtet die Karte.' },
      { text: 'Der Labor-Tab heißt jetzt auch oben „Labor“ – so ist er nicht mehr mit dem Genlabor zu verwechseln.', feature: 'sequencing' },
      { text: 'Eine laufende Anomalie zeigt einen Fortschrittsbalken bis zu ihrem Ziel.', feature: 'anomalies' },
    ],
  },
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
