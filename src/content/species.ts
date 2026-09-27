import type { SpeciesDef } from '@core/content/types';

/** Phase 1 ships the six core base species plus one example hybrid; the pool grows in phase 4. */
export const species: SpeciesDef[] = [
  {
    id: 'emberpup', name: 'Glutwelpe', element: 'fire', tier: 'base', shape: 'blob', hue: 14, wild: true,
    description: 'Ein warmer kleiner Racker, der gern an Kohlen knabbert.',
    baseStats: { hp: 20, atk: 7, def: 4, spd: 5 },
  },
  {
    id: 'bubbloon', name: 'Blubbling', element: 'water', tier: 'base', shape: 'drop', hue: 205, wild: true,
    description: 'Schwebt in seiner eigenen Wasserblase.',
    baseStats: { hp: 24, atk: 5, def: 6, spd: 4 },
  },
  {
    id: 'pebblit', name: 'Kieselkauz', element: 'earth', tier: 'base', shape: 'round', hue: 30, wild: true,
    description: 'Hart wie Stein, sanft wie Moos.',
    baseStats: { hp: 28, atk: 5, def: 8, spd: 2 },
  },
  {
    id: 'zephyrix', name: 'Zephyrix', element: 'air', tier: 'base', shape: 'wing', hue: 190, wild: true,
    description: 'Flink, luftig und immer in Bewegung.',
    baseStats: { hp: 16, atk: 6, def: 3, spd: 9 },
  },
  {
    id: 'voltmouse', name: 'Voltmaus', element: 'electric', tier: 'base', shape: 'blob', hue: 52, wild: true,
    description: 'Lädt sich beim Rennen im Laufrad auf.',
    baseStats: { hp: 17, atk: 8, def: 3, spd: 8 },
  },
  {
    id: 'sproutle', name: 'Sprössling', element: 'nature', tier: 'base', shape: 'round', hue: 110, wild: true,
    description: 'Wächst, wenn man ihm Geschichten erzählt.',
    baseStats: { hp: 22, atk: 4, def: 6, spd: 4 },
  },

  // --- Hybrids (only via recipes / capsules) ---
  {
    id: 'steamling', name: 'Dampfling', element: 'water', tier: 'hybrid', shape: 'drop', hue: 350, wild: false,
    description: 'Zischt vergnügt, wenn man ihn streichelt.',
    baseStats: { hp: 26, atk: 8, def: 6, spd: 6 },
  },
];
