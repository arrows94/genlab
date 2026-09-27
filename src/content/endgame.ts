import type { AnomalyDef, TalentDef, WeeklyMutationDef } from '@core/content/types';

/** Äon talent tree – mechanics, not just percentages. */
export const talents: TalentDef[] = [
  // Tier 1
  { id: 'aeonHarvest', name: 'Zeitlose Ernte', tier: 1, cost: 1, requires: [], description: '+50 % Nahrungs- und Goldproduktion.',
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.5 }, { target: 'production.gold', op: 'pct', value: 0.5 }] },
  { id: 'aeonMemory', name: 'Erinnerung', tier: 1, cost: 1, requires: [], description: 'Jeder Neustart beginnt mit 1.000 Nahrung und 500 Gold.',
    modifiers: [], onReset: { food: 1000, gold: 500 } },
  { id: 'aeonAutomation', name: 'Ewige Automatik', tier: 1, cost: 2, requires: [], description: 'Arbeitsplaner und Zuchtautomat bleiben dauerhaft freigeschaltet.',
    modifiers: [], unlocksFeatures: ['autoAssign', 'autoBreed'] },
  // Tier 2
  { id: 'twinBirth', name: 'Zwillingsgeburten', tier: 2, cost: 3, requires: ['aeonHarvest'], description: '15 % Chance, dass ein Ei Zwillinge hervorbringt.',
    modifiers: [{ target: 'breeding.twinChance', op: 'add', value: 0.15 }] },
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
];

/** Anomaly challenges: changed rules, a goal, and a permanent reward. */
export const anomalies: AnomalyDef[] = [
  {
    id: 'broodFever', name: 'Brutfieber', description: 'Halbe Brutzeit, aber doppelte Brutkosten.',
    modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.5 }, { target: 'cost.breeding', op: 'mult', value: 2 }],
    goal: { type: 'resourceEarned', resource: 'gold', amount: 20000 }, goalText: '20.000 Gold in diesem Lauf verdienen',
    reward: [{ target: 'breeding.time', op: 'mult', value: 0.9 }], rewardText: 'Dauerhaft −10 % Brutzeit',
  },
  {
    id: 'ascetic', name: 'Askese', description: 'Keine Tränke erlaubt.', rules: { noPotions: true },
    modifiers: [],
    goal: { type: 'resourceEarned', resource: 'gold', amount: 30000 }, goalText: '30.000 Gold in diesem Lauf verdienen',
    reward: [{ target: 'production.gold', op: 'pct', value: 0.15 }], rewardText: 'Dauerhaft +15 % Goldproduktion',
  },
  {
    id: 'famine', name: 'Hungersnot', description: 'Halbe Nahrungsproduktion.',
    modifiers: [{ target: 'production.food', op: 'mult', value: 0.5 }],
    goal: { type: 'resourceEarned', resource: 'food', amount: 150000 }, goalText: '150.000 Nahrung in diesem Lauf verdienen',
    reward: [{ target: 'production.food', op: 'pct', value: 0.2 }], rewardText: 'Dauerhaft +20 % Nahrungsproduktion',
  },
  {
    id: 'cramped', name: 'Enge', description: 'Der Stall fasst nur 40 % seiner Plätze.',
    modifiers: [{ target: 'slots.stable', op: 'mult', value: 0.4 }],
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
