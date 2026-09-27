import type { EvolutionDef, HybridRecipeDef } from '@core/content/types';

export const recipes: HybridRecipeDef[] = [
  { id: 'steam', parents: ['emberpup', 'bubbloon'], result: 'steamling', chance: 0.15, hint: 'Wo Feuer auf Wasser trifft …' },
];

/** Evolutions are added in phase 4. */
export const evolutions: EvolutionDef[] = [];
