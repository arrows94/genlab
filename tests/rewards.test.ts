import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { assignJob, collectAmounts } from '@core/actions';
import { usePotion } from '@core/features/market';
import { rewardAmounts } from '@core/rewards';
import { baseProductionRates, productionRates } from '@core/systems/production';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

/** A farm worker, the market open and enough resources for potions. */
function farmGame() {
  const g = makeGame();
  for (const f of ['farm', 'mine', 'market', 'breeding']) unlockFeature(g, f);
  for (const r of ['food', 'gold', 'essence']) g.state.resources[r] = D(1e9);
  const c = g.state.creatures[0]!;
  expect(assignJob(g, c.id, 'farm').ok).toBe(true);
  return { g, c };
}

describe('production without potion buffs', () => {
  it('ignores Festmahl and Turbo-Trank, while the live rate keeps them', () => {
    const { g, c } = farmGame();
    const base = productionRates(g).food!.toNumber();
    expect(usePotion(g, 'feast').ok).toBe(true);
    expect(usePotion(g, 'turbo', c.id).ok).toBe(true);
    expect(productionRates(g).food!.toNumber()).toBeGreaterThan(base * 2.2); // ×2 Turbo, +50 % Festmahl
    expect(baseProductionRates(g).food!.toNumber()).toBeCloseTo(base);
  });

  it('rewards in minutes of production are not inflated by a potion drunk just before', () => {
    const { g, c } = farmGame();
    const before = rewardAmounts(g, { minutes: 10 }).food!.toNumber();
    usePotion(g, 'feast');
    usePotion(g, 'turbo', c.id);
    expect(rewardAmounts(g, { minutes: 10 }).food!.toNumber()).toBe(before);
  });

  it('collecting is not inflated either', () => {
    const { g, c } = farmGame();
    const before = collectAmounts(g).food!.toNumber();
    usePotion(g, 'feast');
    usePotion(g, 'turbo', c.id);
    expect(collectAmounts(g).food!.toNumber()).toBeCloseTo(before);
  });
});
