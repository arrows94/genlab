import type { BuildingDef } from '@core/content/types';

export const buildings: BuildingDef[] = [
  { id: 'farm', name: 'Farm', icon: '🌾', description: 'Kreaturen bauen Nahrung an. KP erhöhen den Ertrag.', produces: 'food', baseRate: 0.5, workStat: 'hp', baseSlots: 1, feature: 'farm' },
  { id: 'mine', name: 'Mine', icon: '⛏️', description: 'Kreaturen schürfen Gold. Angriff erhöht den Ertrag.', produces: 'gold', baseRate: 0.3, workStat: 'atk', baseSlots: 1, feature: 'mine' },
  { id: 'biolab', name: 'Bio-Labor', icon: '🧫', description: 'Kreaturen gewinnen Essenz. Tempo erhöht den Ertrag.', produces: 'essence', baseRate: 0.05, workStat: 'spd', baseSlots: 1, feature: 'biolab' },
];
