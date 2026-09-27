import type { PotionDef } from '@core/content/types';

/** Market items; the market UI arrives in phase 2. */
export const potions: PotionDef[] = [
  { id: 'powerFeed', name: 'Kraftfutter', kind: 'permanentStat', feature: 'market', description: 'Dauerhaft +5 % auf einen Stat einer Kreatur.', cost: { gold: 100 }, costGrowth: 1.5, modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.05 }] },
  { id: 'turbo', name: 'Turbo-Trank', kind: 'creatureBuff', feature: 'market', description: 'Eine Kreatur arbeitet 5 min doppelt so schnell.', cost: { gold: 250 }, durationSec: 300, modifiers: [{ target: 'production.food', op: 'mult', value: 2 }, { target: 'production.gold', op: 'mult', value: 2 }, { target: 'production.essence', op: 'mult', value: 2 }] },
  { id: 'feast', name: 'Festmahl', kind: 'globalBuff', feature: 'market', description: '+50 % Produktion für 10 min.', cost: { food: 2000 }, durationSec: 600, modifiers: [{ target: 'production.food', op: 'pct', value: 0.5 }, { target: 'production.gold', op: 'pct', value: 0.5 }] },
  { id: 'timeCrystal', name: 'Zeitkristall', kind: 'timeSkip', feature: 'market', description: 'Laufende Vorgänge 15 min schneller.', cost: { essence: 50 }, skipSec: 900 },
];
