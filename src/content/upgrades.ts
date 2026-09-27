import type { UpgradeDef } from '@core/content/types';

const research = { type: 'feature', feature: 'research' } as const;
const breeding = { type: 'feature', feature: 'breeding' } as const;
const mine = { type: 'feature', feature: 'mine' } as const;
const expedition = { type: 'feature', feature: 'expedition' } as const;
const biolab = { type: 'feature', feature: 'biolab' } as const;

export const upgrades: UpgradeDef[] = [
  {
    id: 'strongHands', name: 'Kräftige Hände', category: 'research', requires: research,
    description: '+50 % Nahrung pro Klick.',
    cost: { food: 25 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'collect.food', op: 'pct', value: 0.5 }],
  },
  {
    id: 'autoGatherer', name: 'Auto-Sammler', category: 'research', requires: research,
    description: 'Sammelt automatisch 0,2 Nahrung/s.',
    cost: { food: 40 }, costGrowth: 1.6, maxLevel: 25,
    modifiers: [{ target: 'production.food', op: 'add', value: 0.2 }],
  },
  {
    id: 'farmExpansion', name: 'Farm-Ausbau', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: '+1 Platz auf der Farm.',
    cost: { food: 75 }, costGrowth: 3, maxLevel: 4,
    modifiers: [{ target: 'slots.farm', op: 'add', value: 1 }],
  },
  {
    id: 'fertileSoil', name: 'Fruchtbarer Boden', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: '+25 % Nahrungsproduktion.',
    cost: { food: 120 }, costGrowth: 1.9, maxLevel: 20,
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.25 }],
  },
  {
    id: 'minePermit', name: 'Grabungslizenz', category: 'research', requires: breeding,
    description: 'Schaltet die Mine frei.',
    cost: { food: 250 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['mine'],
  },
  {
    id: 'mineExpansion', name: 'Minen-Ausbau', category: 'research', requires: mine,
    description: '+1 Platz in der Mine.',
    cost: { gold: 60 }, costGrowth: 3, maxLevel: 4,
    modifiers: [{ target: 'slots.mine', op: 'add', value: 1 }],
  },
  {
    id: 'timeVault', name: 'Zeitgewölbe', category: 'research', requires: mine,
    description: '+2 h maximaler Offline-Fortschritt.',
    cost: { gold: 500 }, costGrowth: 2.5, maxLevel: 6,
    modifiers: [{ target: 'offline.capHours', op: 'add', value: 2 }],
  },
  // --- Brutstation ---
  {
    id: 'incubator', name: 'Inkubator', category: 'research', requires: breeding,
    description: '−10 % Brutzeit.',
    cost: { food: 150 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.9 }],
  },
  {
    id: 'nestExpansion', name: 'Nest-Ausbau', category: 'research', requires: breeding,
    description: '+1 Nest in der Brutstation.',
    cost: { food: 400, gold: 50 }, costGrowth: 4, maxLevel: 3,
    modifiers: [{ target: 'slots.nest', op: 'add', value: 1 }],
  },
  {
    id: 'geneLab', name: 'Genlabor', category: 'research', requires: mine,
    description: '+2 % Mutationschance beim Brüten.',
    cost: { gold: 200 }, costGrowth: 2.2, maxLevel: 10,
    modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.02 }],
  },
  // --- Erkundung ---
  {
    id: 'campExpansion', name: 'Camp-Ausbau', category: 'research', requires: expedition,
    description: '+1 Erkundungs-Camp.',
    cost: { gold: 250 }, costGrowth: 3.5, maxLevel: 3,
    modifiers: [{ target: 'slots.camp', op: 'add', value: 1 }],
  },
  {
    id: 'cartographer', name: 'Kartograf', category: 'research', requires: expedition,
    description: '−10 % Erkundungsdauer, +10 % Beute.',
    cost: { gold: 150 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'mission.time', op: 'mult', value: 0.9 }, { target: 'mission.reward', op: 'pct', value: 0.1 }],
  },
  // --- Bio-Labor ---
  {
    id: 'biolabPermit', name: 'Bio-Labor', category: 'research', requires: expedition,
    description: 'Schaltet das Bio-Labor frei (Essenz).',
    cost: { gold: 200 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['biolab'],
  },
  {
    id: 'biolabExpansion', name: 'Labor-Ausbau', category: 'research', requires: biolab,
    description: '+1 Platz im Bio-Labor.',
    cost: { essence: 15 }, costGrowth: 3, maxLevel: 4,
    modifiers: [{ target: 'slots.biolab', op: 'add', value: 1 }],
  },
  {
    id: 'ancestorLab', name: 'Ahnenlabor', category: 'research', requires: biolab,
    description: '+15 % Chance auf seltene und bessere Kreaturen.',
    cost: { essence: 25 }, costGrowth: 2.2, maxLevel: 10,
    modifiers: [
      { target: 'rarity.weight.rare', op: 'pct', value: 0.15 },
      { target: 'rarity.weight.epic', op: 'pct', value: 0.15 },
      { target: 'rarity.weight.legendary', op: 'pct', value: 0.15 },
      { target: 'rarity.weight.mythic', op: 'pct', value: 0.15 },
    ],
  },
  // --- Genetik ---
  {
    id: 'fastSequencer', name: 'Schnellsequenzierer', category: 'research', requires: { type: 'feature', feature: 'sequencing' },
    description: '−15 % Sequenzierdauer.',
    cost: { essence: 20 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'sequencing.time', op: 'mult', value: 0.85 }],
  },
  {
    id: 'sequencerExpansion', name: 'Zweiter Sequenzierer', category: 'research', requires: { type: 'feature', feature: 'sequencing' },
    description: '+1 Platz im Sequenzierlabor.',
    cost: { essence: 40, gold: 500 }, costGrowth: 3, maxLevel: 3,
    modifiers: [{ target: 'slots.sequencer', op: 'add', value: 1 }],
  },
  {
    id: 'splicingLab', name: 'Splicing-Labor', category: 'research',
    requires: { type: 'all', of: [{ type: 'feature', feature: 'sequencing' }, { type: 'geneLibrary', count: 12 }] },
    description: 'Schaltet Gen-Splicing frei.',
    cost: { essence: 150, gold: 3000 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['splicing'],
  },
  {
    id: 'stabilizer', name: 'Gen-Stabilisator', category: 'research', requires: { type: 'feature', feature: 'splicing' },
    description: '−4 % Instabilität beim Splicing.',
    cost: { essence: 100 }, costGrowth: 2.5, maxLevel: 5,
    modifiers: [{ target: 'splicing.instability', op: 'add', value: -0.04 }],
  },
  {
    id: 'spliceCapacity', name: 'Erweiterte Toleranz', category: 'research', requires: { type: 'feature', feature: 'splicing' },
    description: '+1 Splicing-Versuch pro Kreatur.',
    cost: { essence: 300, gold: 10000 }, costGrowth: 4, maxLevel: 2,
    modifiers: [{ target: 'splicing.max', op: 'add', value: 1 }],
  },
  // --- über den Dex freigeschaltet ---
  {
    id: 'legendaryHeritage', name: 'Legendäres Erbgut', category: 'research', requires: { type: 'feature', feature: 'legendaryHeritage' },
    description: 'Nachwuchs erhält +5 % auf alle Grundwerte.',
    cost: { essence: 100 }, costGrowth: 2.5, maxLevel: 10,
    modifiers: [{ target: 'breeding.statBonus', op: 'pct', value: 0.05 }],
  },
  {
    id: 'primordialChamber', name: 'Ur-Gen-Kammer', category: 'research', requires: { type: 'feature', feature: 'primordialChamber' },
    description: 'Mythische Kreaturen ×1,5 wahrscheinlicher, +2 % Mutationschance.',
    cost: { essence: 250 }, costGrowth: 3, maxLevel: 5,
    modifiers: [{ target: 'rarity.weight.mythic', op: 'mult', value: 1.5 }, { target: 'breeding.mutation', op: 'add', value: 0.02 }],
  },
];
