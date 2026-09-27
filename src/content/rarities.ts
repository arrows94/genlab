import type { RarityDef } from '@core/content/types';

/** Drop weights and stat multipliers live in balance.ts. */
export const rarities: RarityDef[] = [
  { id: 'common', name: 'Gewöhnlich', order: 0, color: '#9aa7ad' },
  { id: 'uncommon', name: 'Ungewöhnlich', order: 1, color: '#5fd38d' },
  { id: 'rare', name: 'Selten', order: 2, color: '#4aa3ff' },
  { id: 'epic', name: 'Episch', order: 3, color: '#b36bff' },
  { id: 'legendary', name: 'Legendär', order: 4, color: '#f2c14e' },
  { id: 'mythic', name: 'Mythisch', order: 5, color: '#ff5fa2', glow: true },
];
