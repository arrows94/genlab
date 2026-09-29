import type { BreedingRitualDef } from '@core/content/types';

/**
 * Besondere Brut: rituals that take hours instead of minutes – in exchange for
 * guaranteed results. They run in their own Ritualnest next to the normal
 * nests and only take a Keimprobe of the parents, so both stay free. Unlocked
 * after the first inheritance, so the start of the game stays fast.
 */
export const breedingRituals: BreedingRitualDef[] = [
  {
    id: 'crossing', name: 'Kreuzungsritual', icon: '🔀', hours: 1,
    description: 'Passen die Eltern zu einem Hybrid-Rezept, wird es sicher ein Hybrid.',
    cost: { essence: 150 },
    requires: { type: 'all', of: [{ type: 'feature', feature: 'hybrids' }, { type: 'prestigeCount', layer: 'inheritance', count: 1 }] },
    guaranteedHybrid: true,
  },
  {
    id: 'noble', name: 'Edelbrut', icon: '💠', hours: 3,
    description: 'Mindestens Selten.',
    cost: { essence: 300 },
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
    minRarity: 'rare',
  },
  {
    id: 'master', name: 'Meisterbrut', icon: '👑', hours: 8,
    description: 'Mindestens Episch, doppelte Hybrid-Chance und +15 % Mutation.',
    cost: { essence: 800, catalyst: 2 },
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 2 },
    minRarity: 'epic', hybridMult: 2, mutationAdd: 0.15,
  },
];
