import type { AnomalyDef, BossTraitDef, CellarEnvironmentDef, CellarMilestoneDef, CourseDef, RelicDef, ResonanceDef, TalentDef, TowerOfferDef, WeeklyMutationDef } from '@core/content/types';

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
  { id: 'iceAge', name: 'Eiszeit', description: 'Eis-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.ice.production', op: 'pct', value: 0.5 }],
    cellar: { match: [{ kind: 'element', elements: ['ice'] }], effect: { stats: { atk: 0.2 } }, text: 'Eis: +20 % Angriff' } },
  { id: 'emberWeek', name: 'Glutwoche', description: 'Feuer-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.fire.production', op: 'pct', value: 0.5 }],
    cellar: { match: [{ kind: 'element', elements: ['fire'] }], effect: { stats: { atk: 0.2 } }, text: 'Feuer: +20 % Angriff' } },
  { id: 'stormWeek', name: 'Sturmwoche', description: 'Elektro- und Luft-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.electric.production', op: 'pct', value: 0.5 }, { target: 'element.air.production', op: 'pct', value: 0.5 }],
    cellar: { match: [{ kind: 'element', elements: ['electric', 'air'] }], effect: { stats: { atk: 0.2 } }, text: 'Elektro und Luft: +20 % Angriff' } },
  { id: 'bloom', name: 'Blütezeit', description: 'Natur- und Erd-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.nature.production', op: 'pct', value: 0.5 }, { target: 'element.earth.production', op: 'pct', value: 0.5 }],
    cellar: { match: [{ kind: 'element', elements: ['nature', 'earth'] }], effect: { stats: { atk: 0.2 } }, text: 'Natur und Erde: +20 % Angriff' } },
  { id: 'shadowTime', name: 'Schattenzeit', description: 'Schatten- und Gift-Kreaturen +50 % Ertrag.', modifiers: [{ target: 'element.shadow.production', op: 'pct', value: 0.5 }, { target: 'element.poison.production', op: 'pct', value: 0.5 }],
    cellar: { match: [{ kind: 'element', elements: ['shadow', 'poison'] }], effect: { stats: { atk: 0.2 } }, text: 'Schatten und Gift: +20 % Angriff' } },
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
  // Below the tower live the „verworfenen Linien“: failed experiments from the lab's early days.
  {
    id: 'cellar', name: 'Genom-Keller', icon: '🕳️', direction: 'down', unit: 'Ebene', dice: 'cellar',
    foePrefixes: ['Wechselbalg', 'Fehlzucht', 'Zerrbild', 'Ausschuss', 'Abart', 'Kümmerling'], foeTint: '#7fae6e',
  },
];

/**
 * Surroundings of the Genom-Keller, one per section of levels: each asks for a team bred to fit – an
 * allele, an Erbanlage, an element, a row or a colourful team – instead of raw strength.
 */
export const cellarEnvironments: CellarEnvironmentDef[] = [
  {
    id: 'darkness', name: 'Finsternis', icon: '🌑', description: 'Stockdunkle Gewölbe. Wer nicht im Dunkeln sieht, schlägt ins Leere.',
    rules: [{ except: [{ kind: 'nightSight' }], effect: { miss: 0.25 }, text: 'Ohne Nachtsicht (Farbe Dunkel oder Albino): 25 % der Angriffe gehen daneben' }],
  },
  {
    id: 'flooded', name: 'Überflutet', icon: '🌊', description: 'Schwarzes Wasser steht kniehoch in den Gängen.',
    rules: [
      { match: [{ kind: 'element', elements: ['water', 'ice'] }], effect: { stats: { atk: 0.25, spd: 0.15 } }, text: 'Wasser und Eis: +25 % Angriff, +15 % Tempo' },
      { match: [{ kind: 'element', elements: ['fire'] }], effect: { stats: { atk: -0.25 } }, text: 'Feuer: −25 % Angriff' },
    ],
  },
  {
    id: 'spores', name: 'Sporennebel', icon: '🍄', description: 'Fahlgrüne Sporen hängen in der Luft und kriechen in jede Lunge.',
    rules: [{
      except: [{ kind: 'allele', locus: 'stamina', allele: 'Ae', homozygous: true }, { kind: 'element', elements: ['poison'] }],
      effect: { hazard: 0.08 }, text: 'Vor jeder Ebene −8 % KP – außer reinerbig Unermüdlich (AᵉAᵉ) und Gift',
    }],
  },
  {
    id: 'shadowAura', name: 'Schatten-Aura', icon: '🕯️', description: 'Etwas in der Dunkelheit trinkt jede Wärme.',
    rules: [{ except: [{ kind: 'element', elements: ['shadow'] }], effect: { heal: 0.5 }, text: 'Heilung halbiert – außer bei Schatten' }],
  },
  {
    id: 'collapse', name: 'Einsturz', icon: '🪨', description: 'Die Decke bröckelt. Wer hinten steht, bekommt die Brocken ab.',
    rules: [{
      match: [{ kind: 'row', row: 'back' }], except: [{ kind: 'allele', locus: 'armor', allele: 'Pd' }],
      effect: { hazard: 0.12 }, text: 'Hintere Reihe: vor jeder Ebene −12 % KP durch Steinschlag – außer Diamanthaut (Pᵈ)',
    }],
  },
  {
    id: 'roots', name: 'Wurzelgewirr', icon: '🌿', description: 'Alte Wurzeln greifen nach allem, was sich bewegt.',
    rules: [{
      except: [{ kind: 'element', elements: ['nature'] }, { kind: 'latent', trait: 'titanBlood' }, { kind: 'latent', trait: 'thornSkin' }],
      effect: { stats: { spd: -0.3 } }, text: '−30 % Tempo – außer Natur, Titanenblut und Dornenhaut',
    }],
  },
  {
    id: 'diversity', name: 'Vielfalts-Siegel', icon: '🔯', description: 'Ein uraltes Siegel duldet keine Wiederholung.',
    rules: [{ match: [{ kind: 'duplicate' }], effect: { stats: { atk: -0.4, def: -0.4 } }, text: 'Jede Art nach der ersten im Team: −40 % Angriff und Verteidigung' }],
  },
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
  // Dark tricks: only the bosses of the Genom-Keller have them (besides the four above).
  { id: 'lifeDrain', name: 'Lebensraub', icon: '🩸', kind: 'drain', value: 0.3, courses: ['cellar'],
    description: 'Heilt sich um 30 % des Schadens, den er austeilt. Schnell und hart zuschlagen, bevor er sich satt trinkt.' },
  { id: 'terror', name: 'Schrecken', icon: '😱', kind: 'terror', value: 0.15, courses: ['cellar'],
    description: 'Solange er steht, gehen 15 % mehr Angriffe deines Teams daneben – auch Nachtsicht hilft nicht.' },
  { id: 'lightEater', name: 'Lichtfresser', icon: '🌘', kind: 'darken', value: 0, courses: ['cellar'],
    description: 'Verschluckt das Fackellicht: Im Kampf ist es stockdunkel – nur wer im Dunkeln sieht, trifft sicher.' },
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

/**
 * Quartiermeister: Turm-Marken for what is scarce elsewhere (Evolutionskristalle, Fragmente, Zeitkristalle, Keimöl).
 * Prices in small floors' worth of Turm-Marken at the record (one floor ≈ 1/12.000 of a day's tower income late in
 * the game). A full week of every offer costs about 2½ days of that income; the weekly limit keeps the scarce
 * resources scarce.
 */
export const towerOffers: TowerOfferDef[] = [
  { id: 'catalyst', resource: 'catalyst', amount: 1, floors: 300, priceGrowth: 1.12, weeklyLimit: 20 },
  { id: 'fragments', resource: 'fragments', amount: 20, floors: 150, priceGrowth: 1.12, weeklyLimit: 10 },
  { id: 'timeCrystal', resource: 'timeCrystals', amount: 1, floors: 1500, priceGrowth: 1.5, weeklyLimit: 2 },
  { id: 'germOil', resource: 'germOil', amount: 1, floors: 1500, priceGrowth: 1.5, weeklyLimit: 2 },
];

/**
 * Dunkle Relikte from the Genom-Keller: a strong bonus with a price. Each team place has a dark place next to its
 * relic – in the tower and in the cellar, so they also help where the tower stalls.
 */
export const darkRelics: RelicDef[] = [
  { id: 'bloodFang', name: 'Blutzahn', icon: '🦷', cost: 40, costGrowth: 2.2, maxLevel: 10, currency: 'shadowMarks',
    description: 'Je Stufe +15 % Angriff, aber −5 % KP.', bonus: { atk: 0.15, hp: -0.05 } },
  { id: 'hollowHeart', name: 'Hohles Herz', icon: '🖤', cost: 40, costGrowth: 2.2, maxLevel: 10, currency: 'shadowMarks',
    description: 'Je Stufe +20 % KP, aber −6 % Tempo.', bonus: { hp: 0.2, spd: -0.06 } },
  { id: 'boneArmor', name: 'Knochenpanzer', icon: '🦴', cost: 40, costGrowth: 2.2, maxLevel: 10, currency: 'shadowMarks',
    description: 'Je Stufe +20 % Verteidigung, aber −5 % Angriff.', bonus: { def: 0.2, atk: -0.05 } },
  { id: 'wraithVeil', name: 'Geisterschleier', icon: '👻', cost: 60, costGrowth: 2.3, maxLevel: 10, currency: 'shadowMarks',
    description: 'Je Stufe +15 % Tempo, aber −6 % Verteidigung.', bonus: { spd: 0.15, def: -0.06 } },
];

/**
 * Tiefen-Meilensteine: a bonus for every depth reached first. They are the source of values nothing else raises –
 * the allele transfer of the Infusion, rare rituals and the price of capsules and research.
 */
export const cellarMilestones: CellarMilestoneDef[] = [
  { id: 'depth10', level: 10, name: 'Unter dem Turm', description: 'Gen-Kapseln 10 % billiger.', modifiers: [{ target: 'cost.capsule', op: 'pct', value: -0.1 }] },
  { id: 'depth20', level: 20, name: 'Tropfsteine', description: '+3 % Allel-Übertragung bei der Infusion.', modifiers: [{ target: 'infusion.transferChance', op: 'add', value: 0.03 }] },
  { id: 'depth30', level: 30, name: 'Der erste Schatten', description: 'Brutrituale: Selten und besser 25 % wahrscheinlicher.', modifiers: [{ target: 'breeding.ritualRarity', op: 'add', value: 0.25 }] },
  { id: 'depth40', level: 40, name: 'Vergessene Labore', description: 'Forschung 5 % billiger.', modifiers: [{ target: 'cost.upgrade', op: 'pct', value: -0.05 }] },
  { id: 'depth50', level: 50, name: 'Zerbrochene Tanks', description: 'Gen-Kapseln 10 % billiger.', modifiers: [{ target: 'cost.capsule', op: 'pct', value: -0.1 }] },
  { id: 'depth60', level: 60, name: 'Schwarzes Wasser', description: '+3 % Allel-Übertragung bei der Infusion.', modifiers: [{ target: 'infusion.transferChance', op: 'add', value: 0.03 }] },
  { id: 'depth75', level: 75, name: 'Die Wiege', description: 'Brutrituale: Selten und besser 25 % wahrscheinlicher.', modifiers: [{ target: 'breeding.ritualRarity', op: 'add', value: 0.25 }] },
  { id: 'depth90', level: 90, name: 'Archiv der Fehlzuchten', description: 'Forschung 5 % billiger.', modifiers: [{ target: 'cost.upgrade', op: 'pct', value: -0.05 }] },
  { id: 'depth120', level: 120, name: 'Wurzel des Genoms', description: '+4 % Allel-Übertragung bei der Infusion, Brutrituale: Selten und besser 50 % wahrscheinlicher.',
    modifiers: [{ target: 'infusion.transferChance', op: 'add', value: 0.04 }, { target: 'breeding.ritualRarity', op: 'add', value: 0.5 }] },
  { id: 'depth150', level: 150, name: 'Grund des Kellers?', description: 'Gen-Kapseln 10 % und Forschung 5 % billiger.',
    modifiers: [{ target: 'cost.capsule', op: 'pct', value: -0.1 }, { target: 'cost.upgrade', op: 'pct', value: -0.05 }] },
];
