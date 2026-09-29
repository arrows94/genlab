import type { NameListDef } from '@core/content/types';

/**
 * Names of bred creatures: a Rufname and the family of the stronger parent,
 * e.g. „Kiko Funkenstein“. A new family is founded from the element's
 * `familyPrefixes` (content/elements.ts) and one of the `familySuffix` words.
 * Keep Rufname + space + family within `balance.creature.maxNameLength`.
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
  { id: 'familySuffix', words: ['stein', 'feld', 'hain', 'bach', 'horn', 'au', 'berg', 'tal', 'wald', 'see', 'moor', 'grund', 'hof', 'brunn', 'heim'] },
];
