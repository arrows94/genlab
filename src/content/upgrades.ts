import type { ResearchThemeDef, UpgradeDef } from '@core/content/types';

/** Branches of the research tree, in display order. */
export const researchThemes: ResearchThemeDef[] = [
  { id: 'gather', name: 'Sammeln', icon: '🖐️' },
  { id: 'farm', name: 'Farm', icon: '🌾' },
  { id: 'mine', name: 'Mine', icon: '⛏️' },
  { id: 'biolab', name: 'Bio-Labor', icon: '🧫' },
  { id: 'breeding', name: 'Brut', icon: '🥚' },
  { id: 'expedition', name: 'Erkundung', icon: '🧭' },
  { id: 'genetics', name: 'Genetik', icon: '🧬' },
  { id: 'management', name: 'Verwaltung', icon: '🗂️' },
  { id: 'automation', name: 'Automatik', icon: '🤖' },
  { id: 'tower', name: 'Turm', icon: '🗼' },
];

const research = { type: 'feature', feature: 'research' } as const;
const breeding = { type: 'feature', feature: 'breeding' } as const;
const mine = { type: 'feature', feature: 'mine' } as const;
const expedition = { type: 'feature', feature: 'expedition' } as const;
const biolab = { type: 'feature', feature: 'biolab' } as const;

export const upgrades: UpgradeDef[] = [
  {
    id: 'strongHands', theme: 'gather', name: 'Kräftige Hände', category: 'research', requires: research,
    description: '+50 % Nahrung pro Klick.',
    cost: { food: 25 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'collect.food', op: 'pct', value: 0.5 }],
  },
  {
    id: 'autoGatherer', theme: 'gather', name: 'Auto-Sammler', category: 'research', requires: research,
    description: 'Sammelt automatisch 0,2 Nahrung/s.',
    cost: { food: 40 }, costGrowth: 1.6, maxLevel: 25,
    modifiers: [{ target: 'production.food', op: 'add', value: 0.2 }],
  },
  {
    id: 'farmExpansion', theme: 'farm', name: 'Farm-Ausbau', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: '+1 Platz auf der Farm.',
    cost: { food: 75 }, costGrowth: 2.6, maxLevel: 9,
    modifiers: [{ target: 'slots.farm', op: 'add', value: 1 }],
  },
  {
    id: 'fertileSoil', theme: 'farm', name: 'Fruchtbarer Boden', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: 'Nahrungsproduktion ×1,2 (multipliziert sich).',
    cost: { food: 120 }, costGrowth: 1.75, maxLevel: 30,
    modifiers: [{ target: 'production.food', op: 'mult', value: 1.2 }],
  },
  {
    id: 'minePermit', theme: 'mine', name: 'Grabungslizenz', category: 'research', requires: breeding,
    description: 'Schaltet die Mine frei.',
    cost: { food: 250 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['mine'],
  },
  {
    id: 'mineExpansion', theme: 'mine', name: 'Minen-Ausbau', category: 'research', requires: mine,
    description: '+1 Platz in der Mine.',
    cost: { gold: 60 }, costGrowth: 2.6, maxLevel: 9,
    modifiers: [{ target: 'slots.mine', op: 'add', value: 1 }],
  },
  {
    id: 'richVeins', theme: 'mine', name: 'Reiche Adern', category: 'research', requires: mine,
    description: 'Goldproduktion ×1,2 (multipliziert sich).',
    cost: { gold: 100 }, costGrowth: 1.8, maxLevel: 30,
    modifiers: [{ target: 'production.gold', op: 'mult', value: 1.2 }],
  },
  {
    id: 'timeVault', theme: 'management', name: 'Zeitgewölbe', category: 'research', requires: mine,
    description: '+2 h maximaler Offline-Fortschritt.',
    cost: { gold: 500 }, costGrowth: 2.5, maxLevel: 6,
    modifiers: [{ target: 'offline.capHours', op: 'add', value: 2 }],
  },
  // --- Brutstation ---
  {
    id: 'incubator', theme: 'breeding', name: 'Inkubator', category: 'research', requires: breeding,
    description: '−10 % Brutzeit.',
    cost: { food: 150 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.9 }],
  },
  {
    id: 'nestExpansion', theme: 'breeding', name: 'Nest-Ausbau', category: 'research', requires: breeding,
    description: '+1 Nest in der Brutstation.',
    cost: { food: 400, gold: 50 }, costGrowth: 4, maxLevel: 3,
    modifiers: [{ target: 'slots.nest', op: 'add', value: 1 }],
  },
  {
    id: 'geneLab', theme: 'breeding', name: 'Genlabor', category: 'research', requires: mine,
    description: '+2 % Mutationschance beim Brüten.',
    cost: { gold: 200 }, costGrowth: 2.2, maxLevel: 10,
    modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.02 }],
  },
  // --- Erkundung ---
  {
    id: 'campExpansion', theme: 'expedition', name: 'Camp-Ausbau', category: 'research', requires: expedition,
    description: '+1 Erkundungs-Camp.',
    cost: { gold: 250 }, costGrowth: 3.5, maxLevel: 3,
    modifiers: [{ target: 'slots.camp', op: 'add', value: 1 }],
  },
  {
    id: 'cartographer', theme: 'expedition', name: 'Kartograf', category: 'research', requires: expedition,
    description: '−10 % Erkundungsdauer, +10 % Beute. Stufe 2/4/6 erschließen neue Regionen.',
    cost: { gold: 150 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'mission.time', op: 'mult', value: 0.9 }, { target: 'mission.reward', op: 'pct', value: 0.1 }],
  },
  // --- Bio-Labor ---
  {
    id: 'biolabPermit', theme: 'biolab', name: 'Bio-Labor', category: 'research', requires: expedition,
    description: 'Schaltet das Bio-Labor frei (Essenz).',
    cost: { gold: 200 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['biolab'],
  },
  {
    id: 'biolabExpansion', theme: 'biolab', name: 'Labor-Ausbau', category: 'research', requires: biolab,
    description: '+1 Platz im Bio-Labor.',
    cost: { essence: 15 }, costGrowth: 2.6, maxLevel: 9,
    modifiers: [{ target: 'slots.biolab', op: 'add', value: 1 }],
  },
  {
    id: 'enzymes', theme: 'biolab', name: 'Enzymkultur', category: 'research', requires: biolab,
    description: 'Essenzproduktion ×1,2 (multipliziert sich).',
    cost: { essence: 10, gold: 300 }, costGrowth: 1.9, maxLevel: 25,
    modifiers: [{ target: 'production.essence', op: 'mult', value: 1.2 }],
  },
  {
    id: 'ancestorLab', theme: 'breeding', name: 'Ahnenlabor', category: 'research', requires: biolab,
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
    id: 'fastSequencer', theme: 'genetics', name: 'Schnellsequenzierer', category: 'research', requires: { type: 'feature', feature: 'sequencing' },
    description: '−15 % Sequenzierdauer.',
    cost: { essence: 20 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'sequencing.time', op: 'mult', value: 0.85 }],
  },
  {
    id: 'sequencerExpansion', theme: 'genetics', name: 'Zweiter Sequenzierer', category: 'research', requires: { type: 'feature', feature: 'sequencing' },
    description: '+1 Platz im Sequenzierlabor.',
    cost: { essence: 40, gold: 500 }, costGrowth: 3, maxLevel: 3,
    modifiers: [{ target: 'slots.sequencer', op: 'add', value: 1 }],
  },
  {
    id: 'splicingLab', theme: 'genetics', name: 'Splicing-Labor', category: 'research',
    requires: { type: 'all', of: [{ type: 'feature', feature: 'sequencing' }, { type: 'geneLibrary', count: 12 }] },
    description: 'Schaltet Gen-Splicing frei.',
    cost: { essence: 150, gold: 3000 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['splicing'],
  },
  {
    id: 'stabilizer', theme: 'genetics', name: 'Gen-Stabilisator', category: 'research', requires: { type: 'feature', feature: 'splicing' },
    description: '−4 % Instabilität beim Splicing.',
    cost: { essence: 100 }, costGrowth: 2.5, maxLevel: 5,
    modifiers: [{ target: 'splicing.instability', op: 'add', value: -0.04 }],
  },
  {
    id: 'spliceCapacity', theme: 'genetics', name: 'Erweiterte Toleranz', category: 'research', requires: { type: 'feature', feature: 'splicing' },
    description: '+1 Splicing-Versuch pro Kreatur.',
    cost: { essence: 300, gold: 10000 }, costGrowth: 4, maxLevel: 2,
    modifiers: [{ target: 'splicing.max', op: 'add', value: 1 }],
  },
  // --- Hybride ---
  {
    id: 'hybridTheory', theme: 'breeding', name: 'Kreuzungstheorie', category: 'research', requires: { type: 'feature', feature: 'hybrids' },
    description: 'Enthüllt einen Hinweis auf ein Hybrid-Rezept, +5 % Hybrid-Chance.',
    cost: { essence: 30, gold: 800 }, costGrowth: 1.8, maxLevel: 8,
    modifiers: [{ target: 'breeding.hybridChance', op: 'pct', value: 0.05 }], grantsHints: 1,
  },
  // --- Management & Verwertung ---
  {
    id: 'stableExpansion', theme: 'management', name: 'Stall-Ausbau', category: 'research', requires: breeding,
    description: '+10 Plätze im Stall.',
    cost: { food: 300, gold: 100 }, costGrowth: 2.2, maxLevel: 15,
    modifiers: [{ target: 'slots.stable', op: 'add', value: 10 }],
  },
  {
    id: 'appraiser', theme: 'management', name: 'Gutachter', category: 'research', requires: breeding,
    description: '+20 % Verkaufserlös.',
    cost: { gold: 400 }, costGrowth: 2.5, maxLevel: 5,
    modifiers: [{ target: 'creature.sellValue', op: 'pct', value: 0.2 }],
  },
  {
    id: 'workPlanner', theme: 'automation', name: 'Arbeitsplaner', category: 'research', requires: mine,
    description: 'Verteilt Kreaturen automatisch nach bester Eignung auf die Anlagen.',
    cost: { gold: 800 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['autoAssign'],
  },
  {
    id: 'breedingAutomaton', theme: 'automation', name: 'Zuchtautomat', category: 'research',
    requires: { type: 'all', of: [{ type: 'feature', feature: 'sequencing' }, { type: 'statistic', statistic: 'hatched', amount: 40 }] },
    description: 'Brütet automatisch nach einer Regel (z. B. immer die zwei stärksten).',
    cost: { essence: 150, gold: 4000 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['autoBreed'],
  },
  {
    id: 'autoSequencer', theme: 'automation', name: 'Sequenzier-Roboter', category: 'research',
    requires: { type: 'all', of: [{ type: 'feature', feature: 'sequencing' }, { type: 'statistic', statistic: 'sequenced', amount: 5 }] },
    description: 'Sequenziert automatisch die stärksten unbekannten Genome, sobald ein Sequenzierer frei ist (Schalter im Genlabor).',
    cost: { essence: 120, gold: 3000 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['autoSequence'],
  },
  {
    id: 'recyclerAutomaton', theme: 'automation', name: 'Recycling-Automat', category: 'research',
    requires: { type: 'all', of: [{ type: 'feature', feature: 'recycler' }, { type: 'statistic', statistic: 'recycled', amount: 25 }] },
    description: 'Recycelt überzählige Kreaturen automatisch nach deinen Regeln.',
    cost: { fragments: 60, essence: 150 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['autoRecycle'],
  },
  {
    id: 'recyclerSpeed', theme: 'automation', name: 'Schnellzerlegung', category: 'research', requires: { type: 'feature', feature: 'recycler' },
    description: 'Die Zerlege-Kammer des Gen-Recyclers arbeitet 30 % schneller (je Stufe).',
    cost: { fragments: 40, essence: 200 }, costGrowth: 1.9, maxLevel: 10,
    modifiers: [{ target: 'recycler.time', op: 'mult', value: 0.7 }],
  },
  {
    id: 'infusionBooster', theme: 'management', name: 'Infusionsbeschleuniger', category: 'research', requires: { type: 'feature', feature: 'infusion' },
    description: '+10 % Infusions-EP.',
    cost: { essence: 40 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'infusion.ep', op: 'pct', value: 0.1 }],
  },
  {
    id: 'recyclerEfficiency', theme: 'management', name: 'Effizienter Recycler', category: 'research', requires: { type: 'feature', feature: 'recycler' },
    description: '+15 % Gen-Fragmente.',
    cost: { essence: 30 }, costGrowth: 2, maxLevel: 10,
    modifiers: [{ target: 'capsule.fragmentYield', op: 'pct', value: 0.15 }],
  },
  // --- Genom-Turm (Turm-Marken) ---
  {
    id: 'battleDrill', theme: 'tower', name: 'Kampfdrill', category: 'research', requires: { type: 'feature', feature: 'tower' },
    description: '+10 % Schaden im Genom-Turm.',
    cost: { towerTokens: 20 }, costGrowth: 1.5, maxLevel: 10,
    modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.1 }],
  },
  {
    id: 'towerRoutine', theme: 'tower', name: 'Turm-Routine', category: 'research', requires: { type: 'feature', feature: 'tower' },
    description: 'Nach einer Niederlage startet das Team automatisch ab dem letzten Kontrollpunkt neu.',
    cost: { towerTokens: 150 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['towerAuto'],
  },
  // --- Unendliche Forschung (ohne Maximalstufe, abnehmender Ertrag) ---
  {
    id: 'geneticMastery', name: 'Genetische Meisterschaft', category: 'infinite', requires: { type: 'feature', feature: 'infiniteResearch' },
    description: '+5 % auf alle Werte (abnehmend: Stufe^0,7).',
    cost: { essence: 500 }, costGrowth: 1.25, maxLevel: null, levelPower: 0.7,
    modifiers: [
      { target: 'stat.hp', op: 'pct', value: 0.05 }, { target: 'stat.atk', op: 'pct', value: 0.05 },
      { target: 'stat.def', op: 'pct', value: 0.05 }, { target: 'stat.spd', op: 'pct', value: 0.05 },
    ],
  },
  {
    id: 'bountifulHarvest', name: 'Überfluss', category: 'infinite', requires: { type: 'feature', feature: 'infiniteResearch' },
    description: '+10 % Nahrung und Gold (abnehmend: Stufe^0,7).',
    cost: { gold: 20000 }, costGrowth: 1.3, maxLevel: null, levelPower: 0.7,
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.1 }, { target: 'production.gold', op: 'pct', value: 0.1 }],
  },
  {
    id: 'towerTraining', name: 'Turmtraining', category: 'infinite', requires: { type: 'feature', feature: 'tower' },
    description: '+5 % Turm-Schaden (abnehmend: Stufe^0,8).',
    cost: { towerTokens: 40 }, costGrowth: 1.2, maxLevel: null, levelPower: 0.8,
    modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.05 }],
  },
  // --- über den Dex freigeschaltet ---
  {
    id: 'legendaryHeritage', theme: 'breeding', name: 'Legendäres Erbgut', category: 'research', requires: { type: 'feature', feature: 'legendaryHeritage' },
    description: 'Gezüchteter Nachwuchs erhält +5 % auf alle Werte (wird nicht weitervererbt).',
    cost: { essence: 100 }, costGrowth: 2.5, maxLevel: 10,
    modifiers: [{ target: 'breeding.statBonus', op: 'pct', value: 0.05 }],
  },
  {
    id: 'primordialChamber', theme: 'breeding', name: 'Ur-Gen-Kammer', category: 'research', requires: { type: 'feature', feature: 'primordialChamber' },
    description: 'Mythische Kreaturen ×1,5 wahrscheinlicher, +2 % Mutationschance.',
    cost: { essence: 250 }, costGrowth: 3, maxLevel: 5,
    modifiers: [{ target: 'rarity.weight.mythic', op: 'mult', value: 1.5 }, { target: 'breeding.mutation', op: 'add', value: 0.02 }],
  },
];
