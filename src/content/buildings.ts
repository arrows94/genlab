import type { BuildingDef } from '@core/content/types';

export const buildings: BuildingDef[] = [
  { id: 'farm', name: 'Farm', icon: '🌾', description: 'Kreaturen bauen Nahrung an. KP erhöhen den Ertrag, Natur-, Wasser-, Licht- und Luft-Kreaturen arbeiten hier besonders gut.', produces: 'food', baseRate: 0.5, workStat: 'hp', elements: ['nature', 'water', 'light', 'air'], baseSlots: 1, feature: 'farm' },
  { id: 'mine', name: 'Mine', icon: '⛏️', description: 'Kreaturen schürfen Gold. Angriff erhöht den Ertrag, Erd-, Metall-, Feuer- und Kristall-Kreaturen arbeiten hier besonders gut.', produces: 'gold', baseRate: 0.8, workStat: 'atk', elements: ['earth', 'metal', 'fire', 'crystal'], baseSlots: 1, feature: 'mine' },
  { id: 'biolab', name: 'Bio-Labor', icon: '🧫', description: 'Kreaturen gewinnen Essenz. Tempo erhöht den Ertrag, Elektro-, Gift-, Schatten- und Eis-Kreaturen arbeiten hier besonders gut.', produces: 'essence', baseRate: 0.1, workStat: 'spd', elements: ['electric', 'poison', 'shadow', 'ice'], baseSlots: 1, feature: 'biolab' },
];
