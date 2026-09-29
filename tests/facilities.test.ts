import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { assignJob } from '@core/actions';
import { createCreature, effectiveStats } from '@core/creatures';
import type { Creature } from '@core/state';
import { affinityFactor, assignGain, hasAffinity, workerBase, workerRate } from '@core/systems/production';
import { unlockFeature } from '@core/systems/unlocks';
import { autoAssign } from '@core/features/automation';
import { makeGame } from './helpers';

function farmGame() {
  const g = makeGame(3);
  for (const f of ['farm', 'mine']) unlockFeature(g, f);
  g.state.upgrades.farmExpansion = 2;
  g.invalidate();
  const [a, b, c] = ['emberpup', 'sproutle', 'pebblit'].map((s) => createCreature(g, { speciesId: s, source: 'other' }));
  return { g, a: a!, b: b!, c: c! };
}

/** Makes `to` a copy of `from` in everything that shapes its stats. */
function twin(from: Creature, to: Creature) {
  Object.assign(to, { stats: { ...from.stats }, rarity: from.rarity, genome: structuredClone(from.genome), abilities: [...from.abilities], latent: from.latent, boosts: { ...from.boosts } });
}

describe('facility helpers', () => {
  it('splits a building’s output between its workers', () => {
    const { g, a, b } = farmGame();
    expect(workerRate(g, a).toNumber()).toBe(0);
    assignJob(g, a.id, 'farm');
    assignJob(g, b.id, 'farm');
    const total = g.productionRates().food!;
    expect(workerRate(g, a).add(workerRate(g, b)).toNumber()).toBeCloseTo(total.toNumber());
    expect(workerRate(g, a).gt(0)).toBe(true);
  });

  it('predicts the extra output of an assignment', () => {
    const { g, a, b, c } = farmGame();
    assignJob(g, a.id, 'farm');
    const before = g.productionRates().food!;
    const gain = assignGain(g, 'farm', b);
    assignJob(g, b.id, 'farm');
    expect(g.productionRates().food!.sub(before).toNumber()).toBeCloseTo(gain.toNumber());
    // A creature already in the building adds nothing; moving from the mine counts fully for food.
    expect(assignGain(g, 'farm', b).toNumber()).toBeCloseTo(0);
    assignJob(g, c.id, 'mine');
    expect(assignGain(g, 'farm', c).gt(D(0))).toBe(true);
  });

  it('gives creatures of the building’s elements a type advantage', () => {
    const { g, a, b } = farmGame();
    const farm = g.content.buildings.get('farm');
    // Sprössling (Natur) fits the farm, Glutwelpe (Feuer) does not.
    expect(hasAffinity(g, farm, b)).toBe(true);
    expect(hasAffinity(g, farm, a)).toBe(false);
    expect(affinityFactor(g, farm, b)).toBeCloseTo(1 + g.balance.production.affinityBonus);
    // Same stats: the advantage alone decides.
    twin(a, b);
    g.invalidate();
    expect(effectiveStats(g, b).hp).toBeCloseTo(effectiveStats(g, a).hp!);
    expect(workerBase(g, farm, b) / workerBase(g, farm, a)).toBeCloseTo(1 + g.balance.production.affinityBonus);
  });

  it('lets the work planner weigh the type advantage, not only the stat', () => {
    const { g, a, b } = farmGame();
    g.state.creatures = [a, b];
    unlockFeature(g, 'autoAssign');
    g.state.upgrades.farmExpansion = 0;
    g.state.upgrades.mineExpansion = 0;
    g.invalidate();
    // The fire creature has slightly more KP, the nature creature the type advantage.
    twin(a, b);
    a.stats = { ...a.stats, hp: a.stats.hp! + 1 };
    g.invalidate();
    expect(autoAssign(g).ok).toBe(true);
    expect(b.job).toEqual({ kind: 'building', target: 'farm' });
    expect(a.job?.target).not.toBe('farm');
  });
});
