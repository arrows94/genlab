import type { MissionDef } from '@core/content/types';

export const missions: MissionDef[] = [
  { id: 'short', name: 'Kurze Erkundung', description: 'Ein Spaziergang am Waldrand.', durationSec: 60, cost: { food: 25 }, rewards: { food: [10, 40], gold: [8, 25] }, wildChance: 0.15 },
  { id: 'medium', name: 'Expedition', description: 'Tief in die Hügel.', durationSec: 600, cost: { food: 200 }, rewards: { food: [80, 250], gold: [50, 180] }, wildChance: 0.3 },
  { id: 'long', name: 'Große Reise', description: 'Über die Berge hinaus.', durationSec: 3600, cost: { food: 1000 }, rewards: { gold: [400, 1200], essence: [5, 20], catalyst: [0, 2] }, wildChance: 0.6 },
  // Regions – opened by the cartographer, home of the other elements.
  {
    id: 'frostpeak', name: 'Frostgipfel', description: 'Eisige Höhen voller Metalladern.', durationSec: 900, cost: { food: 400 },
    requires: { type: 'upgradeLevel', upgrade: 'cartographer', level: 2 },
    rewards: { gold: [150, 400], catalyst: [0, 1] }, wildChance: 0.45, species: ['frostling', 'ferrox'],
  },
  {
    id: 'shadowwood', name: 'Schattenwald', description: 'Wo das Licht nicht hinkommt – fast.', durationSec: 1200, cost: { food: 700 },
    requires: { type: 'upgradeLevel', upgrade: 'cartographer', level: 4 },
    rewards: { essence: [5, 15], catalyst: [0, 1] }, wildChance: 0.45, species: ['umbrat', 'toxling', 'lumifly'],
  },
  {
    id: 'crystalcaves', name: 'Kristallhöhlen', description: 'Funkelnde Gänge tief im Berg.', durationSec: 1800, cost: { food: 1200 },
    requires: { type: 'upgradeLevel', upgrade: 'cartographer', level: 6 },
    rewards: { gold: [500, 1500], catalyst: [1, 3] }, wildChance: 0.5, species: ['prismin', 'lumifly', 'ferrox'],
  },
];
