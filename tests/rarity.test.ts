import { describe, expect, it } from 'vitest';
import { rarityChances, rarityWeights, rollRarity } from '@core/rarity';
import { ModifierSet } from '@core/modifiers';
import { Rng } from '@core/rng';
import { balance, content } from './helpers';

describe('rarity rolls', () => {
  const weights = rarityWeights(content, balance, new ModifierSet());

  it('chances sum to 1 and follow the balance weights', () => {
    const chances = rarityChances(weights);
    expect(Object.values(chances).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(chances.common).toBeCloseTo(600 / 1000);
    expect(chances.mythic).toBeCloseTo(2 / 1000);
  });

  it('matches the expected distribution with a seeded rng', () => {
    const rng = Rng.fromSeed(7);
    const counts: Record<string, number> = {};
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const r = rollRarity(rng, weights);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    const chances = rarityChances(weights);
    for (const [id, p] of Object.entries(chances)) {
      expect((counts[id] ?? 0) / n, id).toBeCloseTo(p, 2);
    }
  });

  it('is reproducible', () => {
    const a = Rng.fromSeed(99);
    const b = Rng.fromSeed(99);
    const rollsA = Array.from({ length: 50 }, () => rollRarity(a, weights));
    const rollsB = Array.from({ length: 50 }, () => rollRarity(b, weights));
    expect(rollsA).toEqual(rollsB);
  });

  it('rarity weight modifiers shift the odds', () => {
    const mods = new ModifierSet();
    mods.addAll('ancestorLab', [{ target: 'rarity.weight.mythic', op: 'mult', value: 5 }]);
    const boosted = rarityChances(rarityWeights(content, balance, mods));
    expect(boosted.mythic).toBeCloseTo(10 / 1008);
  });
});
