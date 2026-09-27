import type { GeneLocusDef } from '@core/content/types';

/** Example loci; the full genome arrives in phase 3 (genetics). */
export const genes: GeneLocusDef[] = [
  {
    id: 'strength', name: 'Kraft', category: 'stat',
    alleles: [
      { id: 'K', name: 'Kraftvoll', symbol: 'K', dominance: 2, weight: 30, color: '#ff7043', modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.2 }] },
      { id: 'k', name: 'Normal', symbol: 'k', dominance: 1, weight: 70, color: '#795548', modifiers: [] },
    ],
  },
  {
    id: 'yield', name: 'Ertrag', category: 'trait',
    alleles: [
      { id: 'E', name: 'Ergiebig', symbol: 'E', dominance: 1, weight: 25, color: '#8fd16a', modifiers: [{ target: 'production.food', op: 'pct', value: 0.2 }] },
      { id: 'e', name: 'Normal', symbol: 'e', dominance: 1, weight: 75, color: '#607d8b', modifiers: [] },
    ],
  },
];
