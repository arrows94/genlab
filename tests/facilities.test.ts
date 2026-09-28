import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { assignJob } from '@core/actions';
import { createCreature } from '@core/creatures';
import { assignGain, workerRate } from '@core/systems/production';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

function farmGame() {
  const g = makeGame(3);
  for (const f of ['farm', 'mine']) unlockFeature(g, f);
  g.state.upgrades.farmExpansion = 2;
  g.invalidate();
  const [a, b, c] = ['emberpup', 'sproutle', 'pebblit'].map((s) => createCreature(g, { speciesId: s, source: 'other' }));
  return { g, a: a!, b: b!, c: c! };
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
});
