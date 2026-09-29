import type { NameListDef } from '@core/content/types';

/**
 * Names of bred creatures: a Rufname and the family of the stronger parent,
 * e.g. „Wuselbert Funkenstein“. Fresh Rufnamen come from `givenStart` +
 * `givenEnd` („Wusel“ + „bert“) or the classic `given` list; later
 * generations mostly blend their parents' Rufnamen. A new family is founded
 * from the element's `familyPrefixes` (content/elements.ts) and a
 * `familySuffix`. Epic and better (or shiny) creatures get a Beiname from
 * `epithet.<stat>` / `epithet.shiny`.
 */
export const nameLists: NameListDef[] = [
  {
    id: 'given',
    words: [
      'Aki', 'Alba', 'Arlo', 'Bela', 'Bibo', 'Bolt', 'Brix', 'Cleo', 'Dori', 'Dusty', 'Elio', 'Emil', 'Enno', 'Fina', 'Fips', 'Flo',
      'Frida', 'Gigi', 'Greta', 'Hugo', 'Ida', 'Ivo', 'Jola', 'Juno', 'Kalle', 'Keks', 'Kiko', 'Kira', 'Lasse', 'Lia', 'Lotte', 'Lumi',
      'Luna', 'Mats', 'Milo', 'Mira', 'Momo', 'Nala', 'Nele', 'Nika', 'Nox', 'Ole', 'Otto', 'Paco', 'Pip', 'Pino', 'Quin', 'Rika',
      'Rio', 'Rolf', 'Rudi', 'Sami', 'Sina', 'Suki', 'Taro', 'Tessa', 'Tilo', 'Toni', 'Tuck', 'Uma', 'Ulla', 'Vito', 'Wanda', 'Wim',
      'Yara', 'Yuki', 'Zara', 'Zeno', 'Zippo', 'Zottel',
    ],
  },
  {
    id: 'givenStart',
    words: [
      'Wusel', 'Flausch', 'Brummel', 'Zappel', 'Knuddel', 'Schnuffel', 'Pieps', 'Hüpf', 'Kugel', 'Tapsel', 'Mampf', 'Kicher', 'Schnurr',
      'Plüsch', 'Kuschel', 'Zwirbel', 'Wirbel', 'Krümel', 'Fussel', 'Sausel', 'Murmel', 'Bommel', 'Quiek', 'Glibber', 'Kitzel', 'Flitz',
      'Trödel', 'Zottel', 'Wackel', 'Rappel', 'Gluck', 'Knister', 'Schmatz', 'Brösel', 'Tüddel', 'Kribbel', 'Funkel', 'Schnipp', 'Mops', 'Puschel',
    ],
  },
  { id: 'givenEnd', words: ['bert', 'ine', 'chen', 'li', 'o', 'i', 'a', 'ix', 'us', 'rich', 'ella', 'ke', 'ette', 'mo', 'bold', 'lotte', 'wick'] },
  { id: 'familySuffix', words: ['stein', 'feld', 'hain', 'bach', 'horn', 'au', 'berg', 'tal', 'wald', 'see', 'moor', 'grund', 'hof', 'brunn', 'heim'] },
  // Beinamen (epic and better, or shiny): by the stat the creature is best at compared to its species.
  { id: 'epithet.hp', words: ['Dickfell', 'Eichenherz', 'Bärenherz', 'Kraftpaket', 'Wonneproppen', 'Zähpelz'] },
  { id: 'epithet.atk', words: ['Reißzahn', 'Donnerpranke', 'Krallenschlag', 'Sturmfaust', 'Feuerbiss', 'Raufbold'] },
  { id: 'epithet.def', words: ['Panzerhaut', 'Felsenfell', 'Schuppenschild', 'Eisenhaut', 'Bollwerk', 'Dornenkleid'] },
  { id: 'epithet.spd', words: ['Blitzpfote', 'Windfuß', 'Wirbelwind', 'Flinkfuß', 'Sausewind', 'Hüpfhase'] },
  { id: 'epithet.shiny', words: ['Glitzerfell', 'Regenbogen', 'Funkelstern', 'Perlmutt', 'Schimmerschweif', 'Sternenstaub'] },
];
