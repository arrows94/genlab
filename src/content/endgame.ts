import type { AnomalyDef, BossTraitDef, CourseDef, RelicDef, ResonanceDef, TalentDef, WeeklyMutationDef } from '@core/content/types';

/** Talent tiers 4 and 5 and the resonance open with the stages of the Äon-Observatorium (Großprojekt). */
const dome = { type: 'megaProject', project: 'observatory', stage: 2 } as const;
const lenses = { type: 'megaProject', project: 'observatory', stage: 3 } as const;
const starMap = { type: 'megaProject', project: 'observatory', stage: 4 } as const;

/** Äon talent tree – mechanics, not just percentages. */
export const talents: TalentDef[] = [
  // Tier 1
  { id: 'aeonHarvest', name: 'Zeitlose Ernte', tier: 1, cost: 1, requires: [], description: '+50 % Nahrungs- und Goldproduktion.',
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.5 }, { target: 'production.gold', op: 'pct', value: 0.5 }] },
  { id: 'aeonMemory', name: 'Erinnerung', tier: 1, cost: 1, requires: [], description: 'Jeder Neustart beginnt mit 1.000 Nahrung und 500 Gold.',
    modifiers: [], onReset: { food: 1000, gold: 500 } },
  { id: 'aeonAutomation', name: 'Ewige Automatik', tier: 1, cost: 2, requires: [], description: 'Arbeitsplaner, Zuchtautomat, Sequenzier-Roboter und Recycling-Automat bleiben dauerhaft freigeschaltet.',
    modifiers: [], unlocksFeatures: ['autoAssign', 'autoBreed', 'autoSequence', 'autoRecycle'] },
  // Tier 2
  { id: 'twinBirth', name: 'Zwillingsgeburten', tier: 2, cost: 3, requires: ['aeonHarvest'], description: '15 % Chance, dass ein Ei Zwillinge hervorbringt.',
    modifiers: [{ target: 'breeding.twinChance', op: 'add', value: 0.15 }] },
  { id: 'dynasty', name: 'Stammbaum-Dynastien', tier: 2, cost: 3, requires: ['aeonHarvest'],
    description: 'Reine Linien zählen: Jede Generation derselben Art in Folge stärkt das Kind, und der Rekord jeder Art bringt dauerhafte Boni (Brutstation).',
    modifiers: [], unlocksFeatures: ['dynasties'] },
  { id: 'ancientGenes', name: 'Urgene', tier: 2, cost: 3, requires: ['aeonMemory'], description: 'Ein zusätzlicher Gen-Locus „Urgen“ erwacht in allen Kreaturen.',
    modifiers: [] },
  { id: 'aeonTeam', name: 'Vierter Kämpfer', tier: 2, cost: 2, requires: ['aeonAutomation'], description: '+1 Platz im Turm-Team.',
    modifiers: [{ target: 'slots.tower', op: 'add', value: 1 }] },
  // Tier 3
  { id: 'shinyAura', name: 'Schillernde Aura', tier: 3, cost: 4, requires: ['twinBirth'], description: 'Schillernde Kreaturen ×3 wahrscheinlicher.',
    modifiers: [{ target: 'creature.shinyChance', op: 'mult', value: 3 }] },
  { id: 'deepTime', name: 'Tiefe Zeit', tier: 3, cost: 4, requires: ['ancientGenes'], description: '+12 h maximaler Offline-Fortschritt.',
    modifiers: [{ target: 'offline.capHours', op: 'add', value: 12 }] },
  { id: 'aeonTeam2', name: 'Fünfter Kämpfer', tier: 3, cost: 5, requires: ['aeonTeam'], description: '+1 Platz im Turm-Team (5 insgesamt).',
    modifiers: [{ target: 'slots.tower', op: 'add', value: 1 }] },
  // Tier 4 (Observatorium: Kuppel)
  { id: 'bloodline', name: 'Starke Blutlinie', tier: 4, cost: 6, requires: ['shinyAura'], unlock: dome,
    description: 'Nachkommen erben jede Fähigkeit ihrer Eltern sicher (sonst 35 % je Fähigkeit, 85 %, wenn beide Eltern sie haben).',
    modifiers: [{ target: 'breeding.abilityInherit', op: 'add', value: 1 }] },
  { id: 'wildHybrids', name: 'Wilde Kreuzungen', tier: 4, cost: 6, requires: ['deepTime'], unlock: dome,
    description: '30 % der wilden Funde auf Erkundungen sind Hybride – entdeckte Hybride, deren Rezept eine Art der Region enthält.',
    modifiers: [{ target: 'mission.hybridChance', op: 'add', value: 0.3 }] },
  { id: 'towerRush', name: 'Sturmlauf', tier: 4, cost: 6, requires: ['aeonTeam2'], unlock: dome,
    description: 'Kämpfe im Genom-Turm dauern nur halb so lang – auch offline.',
    modifiers: [{ target: 'tower.interval', op: 'mult', value: 0.5 }] },
  // Tier 5 (Observatorium: Sternkarte)
  { id: 'risingBrood', name: 'Aufstrebende Brut', tier: 5, cost: 9, requires: ['bloodline'], unlock: starMap,
    description: '15 % Chance, dass ein Ei eine Seltenheitsstufe höher schlüpft.',
    modifiers: [{ target: 'breeding.rarityUp', op: 'add', value: 0.15 }] },
  { id: 'scholarCircle', name: 'Gelehrtenkreis', tier: 5, cost: 9, requires: ['wildHybrids'], unlock: starMap,
    description: '+1 Platz für die Großforschung: zwei Projekte laufen gleichzeitig.',
    modifiers: [{ target: 'slots.grandResearch', op: 'add', value: 1 }] },
  { id: 'titanHunter', name: 'Titanenjäger', tier: 5, cost: 9, requires: ['towerRush'], unlock: starMap,
    description: '+1 Angriff pro Tag auf den Wochen-Boss (Vorrat bis 8).',
    modifiers: [{ target: 'tower.bossAttempts', op: 'add', value: 1 }] },
];

/**
 * Äon-Resonanz: endless nodes after the Observatorium's lenses. Each level
 * costs more (`cost × costGrowth^level`) and adds less (`level^levelPower`).
 */
export const resonances: ResonanceDef[] = [
  { id: 'harvestResonance', name: 'Ernte-Resonanz', icon: '🌾', cost: 3, costGrowth: 1.35, levelPower: 0.7, requires: lenses,
    description: '+25 % Nahrung, Gold und Essenz (abnehmend).',
    modifiers: [
      { target: 'production.food', op: 'pct', value: 0.25 },
      { target: 'production.gold', op: 'pct', value: 0.25 },
      { target: 'production.essence', op: 'pct', value: 0.25 },
    ] },
  { id: 'heritageResonance', name: 'Erb-Resonanz', icon: '🧬', cost: 4, costGrowth: 1.4, levelPower: 0.7, requires: lenses,
    description: '+15 % Erbgut aus jeder Vererbung (abnehmend).',
    modifiers: [{ target: 'prestige.inheritance.gain', op: 'pct', value: 0.15 }] },
  { id: 'geneResonance', name: 'Gen-Resonanz', icon: '🧪', cost: 4, costGrowth: 1.4, levelPower: 0.7, requires: lenses,
    description: '+1 % Mutationschance und +10 % Hybrid-Chance (abnehmend).',
    modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }, { target: 'breeding.hybridChance', op: 'pct', value: 0.1 }] },
  { id: 'battleResonance', name: 'Kampf-Resonanz', icon: '⚔️', cost: 3, costGrowth: 1.35, levelPower: 0.7, requires: lenses,
    description: '+20 % Schaden im Genom-Turm (abnehmend).',
    modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.2 }] },
];

/** Anomaly challenges: changed rules, a goal, and a permanent reward. */
export const anomalies: AnomalyDef[] = [
  {
    id: 'broodFever', name: 'Brutfieber', description: 'Halbe Brutzeit, aber doppelte Brutkosten.',
    modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.5 }, { target: 'cost.breeding', op: 'mult', value: 2 }],
    perLevel: [{ target: 'cost.breeding', op: 'mult', value: 1.5 }],
    levelText: 'Brutkosten ×1,5',
    goal: { type: 'resourceEarned', resource: 'gold', amount: 20000 }, goalText: '20.000 Gold in diesem Lauf verdienen',
    reward: [{ target: 'breeding.time', op: 'mult', value: 0.9 }], rewardText: 'Dauerhaft −10 % Brutzeit',
  },
  {
    id: 'ascetic', name: 'Askese', description: 'Keine Tränke erlaubt.', rules: { noPotions: true },
    modifiers: [],
    perLevel: [{ target: 'production.gold', op: 'mult', value: 0.85 }],
    levelText: '−15 % Gold',
    goal: { type: 'resourceEarned', resource: 'gold', amount: 30000 }, goalText: '30.000 Gold in diesem Lauf verdienen',
    reward: [{ target: 'production.gold', op: 'pct', value: 0.15 }], rewardText: 'Dauerhaft +15 % Goldproduktion',
  },
  {
    id: 'famine', name: 'Hungersnot', description: 'Halbe Nahrungsproduktion.',
    modifiers: [{ target: 'production.food', op: 'mult', value: 0.5 }],
    perLevel: [{ target: 'production.food', op: 'mult', value: 0.8 }],
    levelText: '−20 % Nahrung',
    goal: { type: 'resourceEarned', resource: 'food', amount: 150000 }, goalText: '150.000 Nahrung in diesem Lauf verdienen',
    reward: [{ target: 'production.food', op: 'pct', value: 0.2 }], rewardText: 'Dauerhaft +20 % Nahrungsproduktion',
  },
  {
    id: 'cramped', name: 'Enge', description: 'Der Stall fasst nur 40 % seiner Plätze.',
    modifiers: [{ target: 'slots.stable', op: 'mult', value: 0.4 }],
    perLevel: [{ target: 'slots.stable', op: 'mult', value: 0.85 }],
    levelText: '−15 % Stallplätze',
    goal: { type: 'resourceEarned', resource: 'essence', amount: 150 }, goalText: '150 Essenz in diesem Lauf verdienen',
    reward: [{ target: 'slots.stable', op: 'add', value: 10 }], rewardText: 'Dauerhaft +10 Stallplätze',
  },
];

/** Weekly mutations – one is active per calendar week (date-based seed). */
export const weeklyMutations: WeeklyMutationDef[] = [
  { id: 'iceAge', name: 'Eiszeit', description: 'Eis-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.ice.production', op: 'pct', value: 0.5 }] },
  { id: 'emberWeek', name: 'Glutwoche', description: 'Feuer-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.fire.production', op: 'pct', value: 0.5 }] },
  { id: 'stormWeek', name: 'Sturmwoche', description: 'Elektro- und Luft-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.electric.production', op: 'pct', value: 0.5 }, { target: 'element.air.production', op: 'pct', value: 0.5 }] },
  { id: 'bloom', name: 'Blütezeit', description: 'Natur- und Erd-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.nature.production', op: 'pct', value: 0.5 }, { target: 'element.earth.production', op: 'pct', value: 0.5 }] },
  { id: 'shadowTime', name: 'Schattenzeit', description: 'Schatten- und Gift-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.shadow.production', op: 'pct', value: 0.5 }, { target: 'element.poison.production', op: 'pct', value: 0.5 }] },
  { id: 'fertile', name: 'Fruchtbare Woche', description: '−25 % Brutzeit.', modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.75 }] },
  { id: 'goldRush', name: 'Goldrausch', description: '+30 % Goldproduktion.', modifiers: [{ target: 'production.gold', op: 'pct', value: 0.3 }] },
  { id: 'mutationWave', name: 'Mutationswelle', description: '+5 % Mutationschance.', modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.05 }] },
  { id: 'wanderlust', name: 'Wanderlust', description: '+10 % wilde Kreaturen, −15 % Erkundungsdauer.', modifiers: [{ target: 'mission.wildChance', op: 'add', value: 0.1 }, { target: 'mission.time', op: 'mult', value: 0.85 }] },
  { id: 'crystalShine', name: 'Kristallglanz', description: '+50 % Gen-Fragmente.', modifiers: [{ target: 'capsule.fragmentYield', op: 'pct', value: 0.5 }] },
  { id: 'towerFever', name: 'Turmfieber', description: '+25 % Schaden im Genom-Turm.', modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.25 }] },
  { id: 'luckyWeek', name: 'Glückswoche', description: 'Seltenere Kreaturen häufiger, doppelte Chance auf Schillernd.', modifiers: [
    { target: 'rarity.weight.rare', op: 'pct', value: 0.3 }, { target: 'rarity.weight.epic', op: 'pct', value: 0.3 },
    { target: 'rarity.weight.legendary', op: 'pct', value: 0.3 }, { target: 'creature.shinyChance', op: 'mult', value: 2 },
  ] },
];

/** Endless courses: the tower climbs, the cellar below it descends. */
export const courses: CourseDef[] = [
  { id: 'tower', name: 'Genom-Turm', icon: '🗼', direction: 'up', unit: 'Etage', dice: 'tower' },
  { id: 'cellar', name: 'Genom-Keller', icon: '🕳️', direction: 'down', unit: 'Ebene', dice: 'cellar' },
];

/** Tricks of tower bosses from `balance.tower.bossTraitFromFloor` on (one per boss, fixed per floor). */
export const bossTraits: BossTraitDef[] = [
  { id: 'elementShield', name: 'Element-Schild', icon: '🛡️', kind: 'shield', value: 0.25,
    description: 'Nimmt nur ein Viertel des Schadens (auch von Brand und Gift) – außer von Angriffen mit Element-Vorteil.' },
  { id: 'shifter', name: 'Wandler', icon: '🔄', kind: 'shift', value: 0, targeting: 'weakest',
    description: 'Wechselt jede Sekunde Kampfzeit sein Element und jagt das Teammitglied mit den wenigsten KP. Ein bunt gemischtes Team hilft.' },
  { id: 'sweeper', name: 'Flächenangriff', icon: '🌊', kind: 'sweep', value: 0.4,
    description: 'Jede dritte Aktion trifft die ganze hintere Reihe mit 40 % Schaden – steht niemand hinten, alle.' },
  { id: 'regenerator', name: 'Regeneration', icon: '💚', kind: 'regen', value: 0.25, targeting: 'back',
    description: 'Heilt jede Sekunde Kampfzeit 25 % des Schadens, den er in dieser Sekunde genommen hat, und greift bevorzugt die hintere Reihe an. Je schneller er fällt, desto weniger kann er heilen.' },
];

/** Relikte for the places of the tower team (bought with Turm-Marken, never reset). */
export const relics: RelicDef[] = [
  { id: 'towerBlade', name: 'Turmklinge', icon: '⚔️', cost: 60, costGrowth: 2.2, maxLevel: 10,
    description: '+10 % Angriff je Stufe für die Kreatur auf diesem Platz.', bonus: { atk: 0.1 } },
  { id: 'scaleArmor', name: 'Schuppenpanzer', icon: '🛡️', cost: 60, costGrowth: 2.2, maxLevel: 10,
    description: '+12 % Verteidigung und +6 % KP je Stufe.', bonus: { def: 0.12, hp: 0.06 } },
  { id: 'lifeAmulet', name: 'Lebensamulett', icon: '❤️', cost: 60, costGrowth: 2.2, maxLevel: 10,
    description: '+15 % KP je Stufe.', bonus: { hp: 0.15 } },
  { id: 'stormFeather', name: 'Sturmfeder', icon: '🪶', cost: 80, costGrowth: 2.2, maxLevel: 10,
    description: '+10 % Tempo je Stufe – wer zuerst zuschlägt, gewinnt öfter.', bonus: { spd: 0.1 } },
  { id: 'elementPrism', name: 'Elementprisma', icon: '🔷', cost: 100, costGrowth: 2.3, maxLevel: 10,
    description: '+12 % Schaden bei Element-Vorteil je Stufe.', bonus: { element: 0.12 } },
];
