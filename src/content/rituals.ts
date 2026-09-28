import type { BreedingRitualDef } from '@core/content/types';

/**
 * Besondere Brut: rituals that take hours instead of seconds and occupy the
 * nest and both parents that long – in exchange for better odds. Unlocked
 * after the first inheritance, so the start of the game stays fast.
 */
export const breedingRituals: BreedingRitualDef[] = [
  {
    id: 'crossing', name: 'Kreuzungsritual', icon: '🔀', hours: 4,
    description: 'Dreifache Chance auf Hybride.',
    cost: { essence: 150 },
    requires: { type: 'all', of: [{ type: 'feature', feature: 'hybrids' }, { type: 'prestigeCount', layer: 'inheritance', count: 1 }] },
    hybridMult: 3,
  },
  {
    id: 'noble', name: 'Edelbrut', icon: '💠', hours: 8,
    description: 'Mindestens Ungewöhnlich; Selten und höher dreimal so häufig.',
    cost: { essence: 300 },
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
    minRarity: 'uncommon', rarityBoost: 2,
  },
  {
    id: 'master', name: 'Meisterbrut', icon: '👑', hours: 24,
    description: 'Mindestens Selten, doppelte Hybrid-Chance und +15 % Mutation.',
    cost: { essence: 800, catalyst: 2 },
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 2 },
    minRarity: 'rare', hybridMult: 2, mutationAdd: 0.15,
  },
];
