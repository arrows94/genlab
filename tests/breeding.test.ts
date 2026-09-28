import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, effectiveStats, findCreature } from '@core/creatures';
import { breedingCost, breedingTimeMs, nestSlots, startBreeding, inheritStats } from '@core/features/breeding';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

function breedingGame(seed = 42) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding'); // grants a second creature
  g.state.resources.food = D(1e6);
  g.state.resources.gold = D(1e6);
  return g;
}

describe('breeding', () => {
  it('unlocking the breeding station grants a second creature', () => {
    const g = breedingGame();
    expect(g.state.creatures).toHaveLength(2);
    expect(g.state.creatures[1]!.speciesId).toBe('sproutle');
  });

  it('lays an egg, blocks the parents and hatches a child after the breeding time', () => {
    const g = breedingGame();
    const [a, b] = g.state.creatures;
    const foodBefore = g.state.resources.food!;
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    expect(g.state.resources.food!.lt(foodBefore)).toBe(true);
    expect(a!.job?.kind).toBe('nest');
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(false);

    const hatched: number[] = [];
    g.bus.on('eggHatched', (e) => hatched.push(e.creatureId));
    g.advance(breedingTimeMs(g, 2) + 100);

    expect(hatched).toHaveLength(1);
    const child = findCreature(g, hatched[0]!)!;
    expect(child.generation).toBe(2);
    expect(child.parents).toEqual([a!.id, b!.id]);
    expect([a!.speciesId, b!.speciesId]).toContain(child.speciesId);
    expect(a!.job).toBeNull();
    expect(b!.job).toBeNull();
    expect(g.state.statistics.hatched).toBe(1);
  });

  it('refuses when nests are full and nest upgrades add slots', () => {
    const g = breedingGame();
    createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    createCreature(g, { speciesId: 'zephyrix', rarity: 'common' });
    const [a, b, c, d] = g.state.creatures;
    expect(nestSlots(g)).toBe(1);
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    expect(startBreeding(g, c!.id, d!.id)).toEqual({ ok: false, reason: 'Alle Nester sind belegt.' });
    g.state.upgrades.nestExpansion = 1;
    g.invalidate();
    expect(startBreeding(g, c!.id, d!.id).ok).toBe(true);
  });

  it('inherits averaged stats; mutation raises them', () => {
    const g = breedingGame();
    const a = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    const b = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats: { hp: 50, atk: 50, def: 50, spd: 50 }, exactStats: true });
    const plain = inheritStats(g, a, b, 0);
    for (const v of Object.values(plain)) {
      expect(v).toBeGreaterThanOrEqual(Math.floor(75 * 0.9));
      expect(v).toBeLessThanOrEqual(Math.ceil(75 * 1.1));
    }
    const mutated = inheritStats(g, a, b, 1);
    for (const v of Object.values(mutated)) expect(v).toBeGreaterThanOrEqual(Math.floor(75 * 0.9 * 1.05));
  });

  it('heritage bonus boosts bred offspring without compounding into base stats', () => {
    const g = breedingGame();
    const stats = { hp: 100, atk: 100, def: 100, spd: 100 };
    const a = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats, exactStats: true });
    const b = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats, exactStats: true });
    const child = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats, exactStats: true, parents: [a.id, b.id] });
    const childBefore = effectiveStats(g, child).hp!;
    const parentBefore = effectiveStats(g, a).hp!;
    g.state.upgrades.legendaryHeritage = 10;
    g.invalidate();
    for (const v of Object.values(inheritStats(g, a, b, 0))) expect(v).toBeLessThanOrEqual(110);
    expect(effectiveStats(g, child).hp).toBeGreaterThan(childBefore);
    expect(effectiveStats(g, a).hp).toBe(parentBefore);
  });

  it('cost rises with generation (gold from gen 3) and mildly with creatures owned', () => {
    const g = breedingGame();
    const gen2 = breedingCost(g, 2);
    expect(gen2.gold).toBeUndefined();
    const gen4 = breedingCost(g, 4);
    expect(gen4.food!.toNumber()).toBe(Math.ceil(30 * 1.5 ** 2 * 1.04));
    expect(gen4.gold!.gt(0)).toBe(true);
    for (let i = 0; i < 4; i++) createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    expect(breedingCost(g, 2).food!.gt(gen2.food!)).toBe(true);
  });

  it('breeding time shrinks with the incubator', () => {
    const g = breedingGame();
    const before = breedingTimeMs(g, 2);
    g.state.upgrades.incubator = 2;
    g.invalidate();
    expect(breedingTimeMs(g, 2)).toBeCloseTo(before * 0.81);
  });

  it('is deterministic for the same seed', () => {
    const run = () => {
      const g = breedingGame(7);
      const [a, b] = g.state.creatures;
      startBreeding(g, a!.id, b!.id);
      g.advance(60_000);
      return g.state.creatures.at(-1);
    };
    expect(run()).toEqual(run());
  });
});

describe('breeding with working creatures', () => {
  it('pulls parents from their building', () => {
    const g = breedingGame();
    unlockFeature(g, 'farm');
    const [a, b] = g.state.creatures;
    a!.job = { kind: 'building', target: 'farm' };
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    expect(a!.job?.kind).toBe('nest');
  });
});
