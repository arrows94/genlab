import type { PotionDef } from '@core/content/types';

export const potions: PotionDef[] = [
  { id: 'powerFeed', color: '#f2a93b', name: 'Kraftfutter', kind: 'permanentStat', feature: 'market', description: 'Dauerhaft +5 % auf einen Wert einer Kreatur. Wird pro Kreatur teurer.', cost: { gold: 150 }, costGrowth: 1.6, statBonus: 0.05 },
  { id: 'turbo', color: '#4aa3ff', name: 'Turbo-Trank', kind: 'creatureBuff', feature: 'market', description: 'Eine Kreatur arbeitet 5 min doppelt so schnell. Kostet 3 min Gold-Produktion.', cost: { gold: 300 }, costMinutes: 3, durationSec: 300, modifiers: [{ target: 'production.food', op: 'mult', value: 2 }, { target: 'production.gold', op: 'mult', value: 2 }, { target: 'production.essence', op: 'mult', value: 2 }] },
  { id: 'feast', color: '#ff6b6b', name: 'Festmahl', kind: 'globalBuff', feature: 'market', description: '+50 % Nahrungs- und Goldproduktion für 10 min. Kostet 6 min Nahrungs-Produktion.', cost: { food: 1500 }, costMinutes: 6, durationSec: 600, modifiers: [{ target: 'production.food', op: 'pct', value: 0.5 }, { target: 'production.gold', op: 'pct', value: 0.5 }] },
  { id: 'abilityElixir', color: '#c6ff6b', name: 'Fähigkeits-Elixier', kind: 'abilityLevel', feature: 'abilityElixir', description: 'Stärkt eine Fähigkeit einer Kreatur um eine Stufe (bis Stufe III: ×1,5, dann ×2). Braucht seltenes Keimöl.', cost: { gold: 20000, germOil: 2 }, costGrowth: 3 },
  { id: 'timeCrystal', color: '#8ecbff', name: 'Zeittrank', kind: 'timeSkip', feature: 'market', description: 'Kurze Vorgänge (unter 1 h) 15 min schneller. Kostet 20 min Essenz-Produktion, jeder weitere Trank innerhalb einer Stunde das Doppelte. Lange Projekte brauchen Zeitkristalle.', cost: { essence: 10 }, costMinutes: 20, skipSec: 900 },
];
