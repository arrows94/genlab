import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, effectiveStats, findCreature } from '@core/creatures';
import { breedingCost, breedingTimeMs, mutationChance, nestKeepers, nestSlots, setNestKeeper, startBreeding, inheritStats } from '@core/features/breeding';
import { abilityInheritChance, inheritAbilities, inheritAbilityLevels } from '@core/abilities';
import { addBuff } from '@core/systems/buffs';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, content, makeGame } from './helpers';

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

  it('Brutpfleger and Mutagen only help with their own eggs, not from the stable (tester saw 1-second eggs)', () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    const plain = [0, 1].map(() => createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: [] }));
    const before = { time: breedingTimeMs(g, 2, plain), mutation: mutationChance(g, undefined, plain) };
    // Twenty idle specialists in the stable used to add up to −200 % breeding time.
    for (let i = 0; i < 20; i++) createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer', 'mutagenic'] });
    g.invalidate();
    expect(breedingTimeMs(g, 2, plain)).toBe(before.time);
    expect(mutationChance(g, undefined, plain)).toBe(before.mutation);
    // As a parent each one counts for that egg.
    const helper = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer', 'mutagenic'] });
    expect(breedingTimeMs(g, 2, [plain[0], helper])).toBeCloseTo(before.time * 0.9);
    expect(mutationChance(g, undefined, [plain[0], helper])).toBeCloseTo(before.mutation + 0.02);
  });

  it('stacked bonuses never push an egg below its minimum time', () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    addBuff(g, 'test', [{ target: 'breeding.time', op: 'mult', value: 0.01 }], 1e9);
    const base = balance.breeding.baseTimeSec * (1 + balance.breeding.timePerGeneration);
    expect(breedingTimeMs(g, 2)).toBe(base * balance.breeding.minTimeShare * 1000);
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

describe('Nestwärter', () => {
  const keeperGame = () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    const parents = [0, 1].map(() => createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: [] }));
    return { g, parents };
  };

  it('opens with a research after twenty eggs', () => {
    const def = content.upgrades.get('nestKeeper');
    expect(def.requires).toEqual({ type: 'statistic', statistic: 'hatched', amount: 20 });
    expect(def.unlocksFeatures).toEqual(['nestKeeper']);
    const { g, parents } = keeperGame();
    expect(setNestKeeper(g, parents[0]!.id).ok).toBe(false);
  });

  it('gives its own breeding bonuses to every egg, one keeper at a time', () => {
    const { g, parents } = keeperGame();
    unlockFeature(g, 'nestKeeper');
    const time = breedingTimeMs(g, 2, parents);
    const mutation = mutationChance(g, undefined, parents);
    const nurse = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer', 'mutagenic'] });
    const other = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer'] });
    expect(setNestKeeper(g, nurse.id).ok).toBe(true);
    expect(nurse.job).toEqual({ kind: 'keeper', target: 'nest' });
    expect(breedingTimeMs(g, 2, parents)).toBeCloseTo(time * 0.9);
    expect(mutationChance(g, undefined, parents)).toBeCloseTo(mutation + 0.02);
    // The keeper does not breed or work meanwhile.
    expect(startBreeding(g, nurse.id, parents[0]!.id).ok).toBe(false);
    // A full place is handed over, never stacked.
    expect(setNestKeeper(g, other.id).ok).toBe(true);
    expect(nestKeepers(g)).toEqual([other]);
    expect(nurse.job).toBeNull();
    expect(mutationChance(g, undefined, parents)).toBeCloseTo(mutation);
    expect(setNestKeeper(g, null).ok).toBe(true);
    expect(nestKeepers(g)).toEqual([]);
    expect(breedingTimeMs(g, 2, parents)).toBe(time);
  });
});

describe('ability inheritance', () => {
  it('an ability both parents share passes on far more often than one of a single parent', () => {
    const g = makeGame();
    expect(abilityInheritChance(g, false)).toBe(balance.breeding.abilityInheritChance);
    expect(abilityInheritChance(g, true)).toBe(balance.breeding.abilityInheritBoth);
    let shared = 0;
    let single = 0;
    for (let i = 0; i < 2000; i++) {
      const kids = inheritAbilities(g, ['nurturer', 'tough'], ['nurturer'], 0);
      if (kids.includes('nurturer')) shared++;
      if (kids.includes('tough')) single++;
    }
    expect(shared / 2000).toBeCloseTo(balance.breeding.abilityInheritBoth, 1);
    expect(single / 2000).toBeCloseTo(balance.breeding.abilityInheritChance, 1);
  });
});

describe('ability levels in pure lines', () => {
  const pair = (levelA: number, levelB: number | null) => {
    const g = makeGame();
    const a = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer'] });
    const b = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: levelB === null ? [] : ['nurturer'] });
    a.abilityLevels = { nurturer: levelA };
    if (levelB !== null) b.abilityLevels = { nurturer: levelB };
    return { g, a, b };
  };
  const { lineageKeepDepth: keep, lineageRaiseDepth: raise } = balance.abilities;

  it('an ordinary child inherits one level less, at least level I', () => {
    const { g, a, b } = pair(3, 1);
    expect(inheritAbilityLevels(g, ['nurturer'], a, b, 0)).toEqual({ nurturer: 2 });
    const low = pair(2, null);
    expect(inheritAbilityLevels(low.g, ['nurturer'], low.a, low.b, 0)).toBeUndefined();
  });

  it('a pure line keeps the level from the first dynasty tier on', () => {
    const { g, a, b } = pair(2, null);
    expect(inheritAbilityLevels(g, ['nurturer'], a, b, keep - 1)).toBeUndefined();
    expect(inheritAbilityLevels(g, ['nurturer'], a, b, keep)).toEqual({ nurturer: 2 });
  });

  it('a deep pure line raises an ability both parents have, up to the highest level', () => {
    const both = pair(1, 1);
    expect(inheritAbilityLevels(both.g, ['nurturer'], both.a, both.b, raise)).toEqual({ nurturer: 2 });
    const one = pair(2, null);
    expect(inheritAbilityLevels(one.g, ['nurturer'], one.a, one.b, raise)).toEqual({ nurturer: 2 });
    const top = pair(3, 3);
    expect(inheritAbilityLevels(top.g, ['nurturer'], top.a, top.b, raise)).toEqual({ nurturer: 3 });
  });
});

