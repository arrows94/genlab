import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { effectiveStats } from '@core/creatures';
import { potionCost, usePotion } from '@core/features/market';
import { startProcess } from '@core/systems/processes';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

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

  it('Zeitkristall shortens running processes', () => {
    const g = marketGame();
    expect(usePotion(g, 'timeCrystal').ok).toBe(false);
    const p = startProcess(g, 'test-crystal', 1_000_000);
    expect(usePotion(g, 'timeCrystal').ok).toBe(true);
    expect(p.elapsedMs).toBe(900_000);
  });
});
