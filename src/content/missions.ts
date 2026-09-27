import type { MissionDef } from '@core/content/types';

/** Expeditions; the expedition system arrives in phase 2. */
export const missions: MissionDef[] = [
  { id: 'short', name: 'Kurze Erkundung', description: 'Ein Spaziergang am Waldrand.', durationSec: 60, cost: { food: 20 }, rewards: { food: [10, 40], gold: [5, 20] }, wildChance: 0.1 },
  { id: 'medium', name: 'Expedition', description: 'Tief in die Hügel.', durationSec: 600, cost: { food: 150 }, rewards: { food: [80, 250], gold: [50, 180] }, wildChance: 0.3 },
  { id: 'long', name: 'Große Reise', description: 'Über die Berge hinaus.', durationSec: 3600, cost: { food: 800 }, rewards: { gold: [400, 1200], essence: [5, 20] }, wildChance: 0.6 },
];
