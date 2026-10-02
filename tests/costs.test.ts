import { describe, expect, it } from 'vitest';
import { bulkCost, costAtLevel, maxAffordable, upgradeCost } from '@core/costs';
import { ModifierSet } from '@core/modifiers';
import { D } from '@core/num';
import { content } from './helpers';

describe('cost calculation', () => {
  it('grows exponentially', () => {
    expect(costAtLevel(10, 2, 0).toNumber()).toBe(10);
    expect(costAtLevel(10, 2, 3).toNumber()).toBe(80);
  });

  it('bulk cost equals the sum of single levels', () => {
    let sum = 0;
    for (let l = 4; l < 9; l++) sum += costAtLevel(15, 1.7, l).toNumber();
    expect(bulkCost(15, 1.7, 4, 5).toNumber()).toBeCloseTo(sum, 6);
    expect(bulkCost(15, 1, 4, 5).toNumber()).toBe(75);
    expect(bulkCost(15, 1.7, 4, 0).toNumber()).toBe(0);
  });

  it('finds the max affordable amount', () => {
    const budget = bulkCost(10, 1.5, 2, 7);
    expect(maxAffordable(10, 1.5, 2, budget)).toBe(7);
    expect(maxAffordable(10, 1.5, 2, budget.sub(0.01))).toBe(6);
    expect(maxAffordable(10, 1.5, 2, D(1))).toBe(0);
  });

  it('handles huge numbers', () => {
    expect(costAtLevel(1, 10, 500).log10()).toBeCloseTo(500);
  });

  it('applies cost modifiers and rounds up', () => {
    const def = content.upgrades.get('autoGatherer');
    const mods = new ModifierSet();
    expect(upgradeCost(def, 0, mods).food!.toNumber()).toBe(40);
    mods.addAll('test', [{ target: 'cost.upgrade', op: 'pct', value: -0.25 }]);
    expect(upgradeCost(def, 1, mods).food!.toNumber()).toBe(Math.ceil(40 * 1.6 * 0.75));
  });
});

describe('spend: names what is missing', () => {
  it('pays when affordable, otherwise says which resource is short and by how much', async () => {
    const { spend } = await import('@core/resources');
    const { D } = await import('@core/num');
    const { makeGame } = await import('./helpers');
    const g = makeGame();
    g.state.resources.essence = D(100);
    g.state.resources.gold = D(0);
    expect(spend(g, { essence: D(40) })).toEqual({ ok: true });
    expect(g.state.resources.essence!.toNumber()).toBe(60);
    expect(spend(g, { essence: D(100) })).toEqual({ ok: false, reason: 'Nicht genug Essenz – es fehlen 40.' });
    expect(spend(g, { essence: D(100), gold: D(5), catalyst: D(1) })).toEqual({ ok: false, reason: 'Nicht genug Essenz, Gold und Evolutionskristalle.' });
    expect(g.state.resources.essence!.toNumber()).toBe(60);
  });
});
