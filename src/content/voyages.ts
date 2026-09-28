import type { VoyageDecisionDef, VoyageDestinationDef, VoyageEventDef } from '@core/content/types';

/**
 * Wochenexpedition: a 7-day voyage with a team of up to three creatures.
 * The destination changes every week and follows the element of the weekly
 * mutation when it has one (Eiszeit → an ice destination). Events on the way
 * change the loot; at the return the player makes one decision.
 */
export const voyageDestinations: VoyageDestinationDef[] = [
  {
    id: 'glacierSea', name: 'Gletschermeer', icon: '🧊', element: 'ice',
    description: 'Treibende Eisberge und Höhlen voller blauem Licht.',
    species: ['frostling', 'bubbloon', 'glacierfin', 'aurorafin'],
    rewards: { essence: [300, 700], catalyst: [4, 8], fragments: [60, 150] },
  },
  {
    id: 'emberWastes', name: 'Glutödnis', icon: '🌋', element: 'fire',
    description: 'Glühende Ebenen, in denen die Erde atmet.',
    species: ['emberpup', 'magmole', 'pebblit', 'volcanodrake'],
    rewards: { gold: [6000, 15000], catalyst: [5, 10], essence: [200, 500] },
  },
  {
    id: 'skyArchipelago', name: 'Himmelsinseln', icon: '🏝️', element: 'air',
    description: 'Schwebende Inseln, verbunden durch Blitze und Wind.',
    species: ['zephyrix', 'voltmouse', 'stormhawk', 'tempestlord'],
    rewards: { gold: [5000, 12000], essence: [250, 600], fragments: [40, 100] },
  },
  {
    id: 'verdantDeep', name: 'Tiefes Grün', icon: '🌿', element: 'nature',
    description: 'Ein Urwald, so alt wie die ersten Gene.',
    species: ['sproutle', 'pebblit', 'mossgolem', 'ancientgrove'],
    rewards: { essence: [350, 800], fragments: [60, 140], catalyst: [3, 6] },
  },
  {
    id: 'twilightMarsh', name: 'Dämmersumpf', icon: '🌒', element: 'shadow',
    description: 'Nebel, Gift und Schatten – und seltene Gene.',
    species: ['umbrat', 'toxling', 'duskmoth', 'venomvine', 'eclipsewing'],
    rewards: { essence: [300, 700], catalyst: [4, 9], fragments: [50, 120] },
  },
  {
    id: 'prismSpire', name: 'Prismenturm', icon: '🔮', element: 'crystal',
    description: 'Eine Spitze aus reinem Kristall, die Licht in Gene bricht.',
    species: ['prismin', 'lumifly', 'geodite', 'prismgolem'],
    rewards: { catalyst: [6, 12], fragments: [80, 180], gold: [4000, 10000] },
  },
];

export const voyageEvents: VoyageEventDef[] = [
  { id: 'storm', text: 'Ein Unwetter zwingt das Team, einen Tag in einer Höhle auszuharren.', weight: 3, effect: { lootPct: -0.1 } },
  { id: 'cache', text: 'Ein vergessenes Vorratslager! Das Team packt ein, was es tragen kann.', weight: 3, effect: { lootPct: 0.2 } },
  { id: 'shortcut', text: 'Ein Wildwechsel führt als Abkürzung durch unberührtes Land.', weight: 3, effect: { lootPct: 0.1 } },
  { id: 'predator', text: 'Ein Raubtier verfolgt das Team – ein Teil der Beute bleibt zurück.', weight: 2, effect: { lootPct: -0.15 } },
  { id: 'crystalVein', text: 'An einer Felswand glitzert eine Kristallader.', weight: 2, effect: { resources: { catalyst: 2 } } },
  { id: 'ruins', text: 'Alte Ruinen mit Zeichnungen seltsamer Kreuzungen.', weight: 2, effect: { hint: true } },
  { id: 'geneSpring', text: 'Eine Quelle, deren Wasser nach Genen schmeckt. Das Team nimmt Proben.', weight: 2, effect: { alleleSamples: 1 } },
  { id: 'nomads', text: 'Wandernde Züchter tauschen Essenz gegen Geschichten.', weight: 2, effect: { resources: { essence: 150 } } },
  { id: 'lost', text: 'Das Team verläuft sich im Nebel und findet erst spät den Weg zurück.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'feast', text: 'Eine reiche Ernte am Wegesrand – alle sind satt und guter Dinge.', weight: 2, effect: { lootPct: 0.05, resources: { food: 5000 } } },
];

export const voyageDecisions: VoyageDecisionDef[] = [
  {
    id: 'injuredBeast', weight: 3,
    text: 'Ein verletztes Wildtier ist dem Team gefolgt. Seine Pflege würde einen Teil der Beute kosten.',
    options: [
      { label: 'Mitnehmen', description: 'Eine Kreatur des Ziels (mindestens Episch) schließt sich an, dafür bleibt ein Drittel der Beute zurück.', lootFactor: 0.65, creature: { minRarity: 'epic' } },
      { label: 'Beute behalten', description: 'Die ganze Beute kommt mit.', lootFactor: 1 },
    ],
  },
  {
    id: 'strangeEgg', weight: 2,
    text: 'Im Gepäck liegt ein fremdes, schimmerndes Ei. Ein Händler bietet viel Essenz dafür.',
    options: [
      { label: 'Ausbrüten', description: 'Eine seltene Kreatur (mindestens Selten) des Ziels schlüpft.', lootFactor: 1, creature: { minRarity: 'rare' } },
      { label: 'Verkaufen', description: '+600 Essenz zusätzlich zur Beute.', lootFactor: 1, resources: { essence: 600 } },
    ],
  },
  {
    id: 'oldMap', weight: 2,
    text: 'Das Team hat eine alte Karte gefunden. Ein Sammler würde sie sofort kaufen.',
    options: [
      { label: 'Karte behalten', description: 'Die nächste Wochenexpedition bringt +50 % Beute.', lootFactor: 1, nextBonus: 0.5 },
      { label: 'Verkaufen', description: '+4 Evolutionskristalle sofort.', lootFactor: 1, resources: { catalyst: 4 } },
    ],
  },
  {
    id: 'mentor', weight: 2,
    text: 'Eine alte Kräuterkundige bietet dem Team eine Woche Unterricht an – gegen einen Teil der Beute.',
    options: [
      { label: 'Unterricht nehmen', description: 'Jedes Teammitglied bekommt dauerhaft +5 % auf alle Werte, dafür bleibt ein Viertel der Beute zurück.', lootFactor: 0.75, teamBoost: 0.05 },
      { label: 'Ablehnen', description: 'Die ganze Beute kommt mit.', lootFactor: 1 },
    ],
  },
];
