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
  nestEggs,
  ritualEggs,
  startBreeding,
} from '@core/features/breeding';
import { sell } from '@core/features/stable';
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

  it('runs for hours in its own Ritualnest; the parents stay free', () => {
    const g = ritualGame();
    const [a, b] = g.state.creatures;
    const essence = g.state.resources.essence!.toNumber();
    expect(startBreeding(g, a!.id, b!.id, 'noble').ok).toBe(true);
    const egg = ritualEggs(g)[0]!;
    expect(egg.durationMs).toBe(3 * H);
    expect(egg.data.ritual).toBe('noble');
    expect(g.state.resources.essence!.toNumber()).toBeCloseTo(essence - 300, 3);
    expect(a!.job).toBeNull();
    expect(b!.job).toBeNull();
    // The normal nest is still free – even for the same parents.
    expect(nestEggs(g)).toHaveLength(0);
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    // One ritual at a time.
    const c = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    const d = createCreature(g, { speciesId: 'bubbloon', source: 'other' });
    expect(startBreeding(g, c!.id, d!.id, 'crossing')).toEqual({ ok: false, reason: 'Das Ritualnest ist belegt.' });
  });

  it('hatches from its Keimprobe even if the parents are gone', () => {
    const g = ritualGame();
    const a = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    const b = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    const children = (() => {
      expect(startBreeding(g, a.id, b.id, 'noble').ok).toBe(true);
      expect(sell(g, [a.id, b.id]).ok).toBe(true);
      const egg = ritualEggs(g)[0]!;
      egg.elapsedMs = egg.durationMs - 50;
      const before = new Set(g.state.creatures.map((c) => c.id));
      g.advance(200);
      return g.state.creatures.filter((c) => !before.has(c.id));
    })();
    expect(children).toHaveLength(1);
    expect(children[0]!.speciesId).toBe('emberpup');
    expect(children[0]!.parents).toEqual([a.id, b.id]);
  });

  it('the Kreuzungsritual always brings the hybrid of a matching pair', () => {
    const g = ritualGame();
    for (let i = 0; i < 8; i++) {
      g.state.creatures = g.state.creatures.slice(0, 2);
      const a = createCreature(g, { speciesId: 'emberpup', source: 'other' });
      const b = createCreature(g, { speciesId: 'bubbloon', source: 'other' });
      const children = hatch(g, a.id, b.id, 'crossing');
      expect(children.map((c) => c.speciesId)).toContain('steamling');
    }
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
    expect(noble.uncommon).toBeUndefined();
    expect(noble.rare).toBe(base.rare);
    const master = eggRarityWeights(g, content.breedingRituals.get('master'));
    expect(Object.keys(master).every((id) => order(id) >= order('epic'))).toBe(true);
  });

  it('hatches at least epic offspring with the master ritual', () => {
    const g = ritualGame();
    for (let i = 0; i < 25; i++) {
      const [a, b] = g.state.creatures.filter((c) => c.job === null).slice(0, 2);
      const children = hatch(g, a!.id, b!.id, 'master');
      expect(children.length).toBeGreaterThan(0);
      for (const child of children) expect(order(child.rarity)).toBeGreaterThanOrEqual(order('epic'));
      // Keep the stable from filling up.
      g.state.creatures = g.state.creatures.slice(0, 4);
    }
  });

  it('raises hybrid and mutation chances in the planner', () => {
    const g = ritualGame();
    const a = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    const b = createCreature(g, { speciesId: 'bubbloon', source: 'other' });
    const hybridP = (ritual?: string) => breedingPreview(g, a, b, ritual ? content.breedingRituals.get(ritual) : undefined).species[0]!.p;
    expect(hybridP('crossing')).toBe(1);
    expect(hybridP('master')).toBeCloseTo(hybridP() * 2);
    expect(mutationChance(g, content.breedingRituals.get('master'))).toBeCloseTo(mutationChance(g) + 0.15);
  });
});
