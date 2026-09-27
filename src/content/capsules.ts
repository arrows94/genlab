import type { CapsuleDef } from '@core/content/types';

/**
 * Gene capsules (only in-game currency, no real money). Odds are shown
 * exactly in the UI. Rarity modifiers (Ahnenlabor …) do NOT apply here, so
 * targeted breeding stays the better way to mythic creatures.
 */
export const capsules: CapsuleDef[] = [
  {
    id: 'standard', name: 'Standard-Kapsel', feature: 'recycler',
    description: 'Eine zufällige Kreatur – meist Basisarten, manchmal Hybride.',
    cost: { fragments: 15 },
    rarityWeights: { common: 620, uncommon: 270, rare: 85, epic: 22, legendary: 2.7, mythic: 0.3 },
    tierWeights: { base: 80, hybrid: 18, rareHybrid: 2 },
    pity: { threshold: 30, minRarity: 'epic' },
  },
  {
    id: 'element', name: 'Element-Kapsel', feature: 'recycler', elementChoice: true,
    description: 'Nur Arten des gewählten Elements, bessere Chancen.',
    cost: { fragments: 40 },
    rarityWeights: { common: 500, uncommon: 320, rare: 130, epic: 42, legendary: 7.5, mythic: 0.5 },
    tierWeights: { base: 75, hybrid: 22, rareHybrid: 3 },
    pity: { threshold: 25, minRarity: 'epic' },
  },
  {
    id: 'premium', name: 'Premium-Kapsel', feature: 'recycler',
    description: 'Mindestens Ungewöhnlich, viele Hybride.',
    cost: { fragments: 120, essence: 40 },
    rarityWeights: { uncommon: 450, rare: 380, epic: 140, legendary: 29, mythic: 1 },
    tierWeights: { base: 50, hybrid: 38, rareHybrid: 12 },
    pity: { threshold: 10, minRarity: 'epic' },
  },
];
