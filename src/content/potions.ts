import type { PotionDef } from '@core/content/types';

export const potions: PotionDef[] = [
  { id: 'powerFeed', color: '#f2a93b', name: 'Kraftfutter', kind: 'permanentStat', feature: 'market', description: 'Dauerhaft +5 % auf einen Wert einer Kreatur. Wird pro Kreatur teurer.', cost: { gold: 150 }, costGrowth: 1.6, statBonus: 0.05 },
  { id: 'turbo', color: '#4aa3ff', name: 'Turbo-Trank', kind: 'creatureBuff', feature: 'market', description: 'Eine Kreatur arbeitet 5 min doppelt so schnell.', cost: { gold: 300 }, durationSec: 300, modifiers: [{ target: 'production.food', op: 'mult', value: 2 }, { target: 'production.gold', op: 'mult', value: 2 }, { target: 'production.essence', op: 'mult', value: 2 }] },
  { id: 'feast', color: '#ff6b6b', name: 'Festmahl', kind: 'globalBuff', feature: 'market', description: '+50 % Nahrungs- und Goldproduktion für 10 min.', cost: { food: 1500 }, durationSec: 600, modifiers: [{ target: 'production.food', op: 'pct', value: 0.5 }, { target: 'production.gold', op: 'pct', value: 0.5 }] },
  { id: 'timeCrystal', color: '#8ecbff', name: 'Zeittrank', kind: 'timeSkip', feature: 'market', description: 'Kurze Vorgänge (unter 1 h) 15 min schneller. Lange Projekte brauchen Zeitkristalle.', cost: { essence: 10 }, skipSec: 900 },
];
