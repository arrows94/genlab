import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import {
  availableRituals,
  breedingCost,
  breedingTimeMs,
  eggRarityWeights,
  eggs,
  mutationChance,
  startBreeding,
} from '@core/features/breeding';
import { breedingPreview } from '@core/features/planner';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

const H = 3_600_000;
const order = (id: string) => content.rarities.get(id).order;

function ritualGame(prestige = 2, seed = 5) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding');
  unlockFeature(g, 'hybrids');
  g.state.prestige.inheritance = { count: prestige };
  unlockFeature(g, 'specialBreeding');
  for (const res of ['food', 'gold', 'essence', 'catalyst']) g.state.resources[res] = D(1e9);
  return g;
}

/** Lays an egg with the ritual and hatches it right away; returns the child. */
function hatch(g: ReturnType<typeof makeGame>, a: number, b: number, ritual?: string) {
  expect(startBreeding(g, a, b, ritual).ok).toBe(true);
  const egg = eggs(g)[0]!;
  egg.elapsedMs = egg.durationMs - 50;
  const before = new Set(g.state.creatures.map((c) => c.id));
  g.advance(200);
  return g.state.creatures.filter((c) => !before.has(c.id));
}

describe('Besondere Brut', () => {
  it('opens with the inheritances; the start of the game keeps only the quick egg', () => {
    const early = makeGame();
    unlockFeature(early, 'breeding');
    expect(availableRituals(early)).toEqual([]);
    const [a, b] = early.state.creatures;
    expect(startBreeding(early, a!.id, b!.id, 'noble').ok).toBe(false);

    expect(availableRituals(ritualGame(1)).map((r) => r.id)).toEqual(['crossing', 'noble']);
    expect(availableRituals(ritualGame(2)).map((r) => r.id)).toEqual(['crossing', 'noble', 'master']);
  });

  it('takes hours, costs extra and occupies nest and parents', () => {
    const g = ritualGame();
    const [a, b] = g.state.creatures;
    const essence = g.state.resources.essence!.toNumber();
    expect(startBreeding(g, a!.id, b!.id, 'noble').ok).toBe(true);
    const egg = eggs(g)[0]!;
    expect(egg.durationMs).toBe(8 * H);
    expect(egg.data.ritual).toBe('noble');
    expect(g.state.resources.essence!.toNumber()).toBeCloseTo(essence - 300, 3);
    expect(a!.job?.kind).toBe('nest');
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(false);
  });

  it('leaves the normal egg untouched', () => {
    const g = ritualGame();
    const [a, b] = g.state.creatures;
    const cost = breedingCost(g, 2);
    const food = g.state.resources.food!;
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    expect(eggs(g)[0]!.durationMs).toBe(breedingTimeMs(g, 2, [a, b]));
    expect(eggs(g)[0]!.data.ritual).toBeUndefined();
    expect(g.state.resources.food!.toNumber()).toBeCloseTo(food.sub(cost.food!).toNumber(), 3);
  });

  it('shifts the rarity odds', () => {
    const g = ritualGame();
    const base = eggRarityWeights(g);
    const noble = eggRarityWeights(g, content.breedingRituals.get('noble'));
    expect(noble.common).toBeUndefined();
    expect(noble.uncommon).toBe(base.uncommon);
    expect(noble.rare).toBeCloseTo(base.rare! * 3);
    const master = eggRarityWeights(g, content.breedingRituals.get('master'));
    expect(Object.keys(master).every((id) => order(id) >= order('rare'))).toBe(true);
  });

  it('hatches at least rare offspring with the master ritual', () => {
    const g = ritualGame();
    for (let i = 0; i < 25; i++) {
      const [a, b] = g.state.creatures.filter((c) => c.job === null).slice(0, 2);
      const children = hatch(g, a!.id, b!.id, 'master');
      expect(children.length).toBeGreaterThan(0);
      for (const child of children) expect(order(child.rarity)).toBeGreaterThanOrEqual(order('rare'));
      // Keep the stable from filling up.
      g.state.creatures = g.state.creatures.slice(0, 4);
    }
  });

  it('raises hybrid and mutation chances in the planner', () => {
    const g = ritualGame();
    const a = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    const b = createCreature(g, { speciesId: 'bubbloon', source: 'other' });
    const hybridP = (ritual?: string) => breedingPreview(g, a, b, ritual ? content.breedingRituals.get(ritual) : undefined).species[0]!.p;
    expect(hybridP('crossing')).toBeCloseTo(hybridP() * 3);
    expect(hybridP('master')).toBeCloseTo(hybridP() * 2);
    expect(mutationChance(g, content.breedingRituals.get('master'))).toBeCloseTo(mutationChance(g) + 0.15);
  });
});
