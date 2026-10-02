import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { effectiveStats } from '@core/creatures';
import { potionCost, usePotion } from '@core/features/market';
import { startProcess } from '@core/systems/processes';
import { productionRates } from '@core/systems/production';
import { addBuff } from '@core/systems/buffs';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, makeGame } from './helpers';

function marketGame() {
  const g = makeGame();
  unlockFeature(g, 'market');
  unlockFeature(g, 'farm');
  unlockFeature(g, 'breeding'); // avoid mid-test unlocks (new dex entry) changing production
  for (const r of ['food', 'gold', 'essence']) g.state.resources[r] = D(1e7);
  return g;
}

describe('market potions', () => {
  it('Kraftfutter raises one stat permanently and gets pricier per creature', () => {
    const g = marketGame();
    const c = g.state.creatures[0]!;
    c.abilities = [];
    c.genome = {}; // isolate the potion effect from gene bonuses
    const atk = effectiveStats(g, c).atk!;
    const cost1 = potionCost(g, 'powerFeed', c.id).gold!;
    expect(usePotion(g, 'powerFeed', c.id, 'atk').ok).toBe(true);
    expect(effectiveStats(g, c).atk).toBe(Math.round(c.stats.atk! * 1.05));
    expect(effectiveStats(g, c).atk).toBeGreaterThanOrEqual(atk);
    expect(potionCost(g, 'powerFeed', c.id).gold!.toNumber()).toBe(Math.ceil(cost1.toNumber() * 1.6));
    expect(usePotion(g, 'powerFeed', c.id, null).ok).toBe(false);
  });

  it('caps boosts per stat', () => {
    const g = marketGame();
    const c = g.state.creatures[0]!;
    for (let i = 0; i < 10; i++) expect(usePotion(g, 'powerFeed', c.id, 'hp').ok).toBe(true);
    expect(usePotion(g, 'powerFeed', c.id, 'hp').ok).toBe(false);
  });

  it('Turbo-Trank doubles one creature\'s output temporarily', () => {
    const g = marketGame();
    const c = g.state.creatures[0]!;
    c.job = { kind: 'building', target: 'farm' };
    const before = g.productionRates().food!.toNumber();
    usePotion(g, 'turbo', c.id);
    expect(g.productionRates().food!.toNumber()).toBeCloseTo(before * 2);
    g.advance(301_000);
    expect(g.productionRates().food!.toNumber()).toBeCloseTo(before);
  });

  it('Festmahl is a global buff', () => {
    const g = marketGame();
    usePotion(g, 'feast');
    expect(g.mods().apply('production.gold', 1)).toBeCloseTo(1.5);
  });

  it('Zeittrank shortens running short processes', () => {
    const g = marketGame();
    expect(usePotion(g, 'timeCrystal').ok).toBe(false);
    const p = startProcess(g, 'test-crystal', 1_000_000);
    expect(usePotion(g, 'timeCrystal').ok).toBe(true);
    expect(p.elapsedMs).toBe(900_000);
  });

  it('Zeittrank costs minutes of essence production and doubles when drunk again within the hour', () => {
    const g = marketGame();
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBeGreaterThanOrEqual(10); // base price early on
    addBuff(g, 'test', [{ target: 'production.essence', op: 'add', value: 50 }], 1e9);
    const rate = productionRates(g).essence!.toNumber();
    expect(rate).toBeGreaterThan(0);
    const first = potionCost(g, 'timeCrystal').essence!.toNumber();
    expect(first).toBe(Math.ceil(Math.max(10, rate * 60 * balance.market.timeSkipMinutes)));
    startProcess(g, 'test-crystal', 3_000_000);
    expect(usePotion(g, 'timeCrystal').ok).toBe(true);
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBe(Math.ceil(first * balance.market.timeSkipGrowth));
    // After the window the price is back to normal.
    g.state.lastTickAt += balance.market.timeSkipWindowHours * 3_600_000 + 1;
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBe(first);
  });
});
