import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, creatureModifiers, effectiveStats } from '@core/creatures';
import { abilityLevel } from '@core/abilities';
import { contractReward } from '@core/features/contracts';
import { potionCost, usePotion } from '@core/features/market';
import { startProcess } from '@core/systems/processes';
import { productionRates } from '@core/systems/production';
import { unlockFeature } from '@core/systems/unlocks';
import { Game } from '@core/game';
import { DEFAULT_PROVIDERS } from '@core/providers';
import type { ModifierDef } from '@core/modifiers';
import { NOW, balance, content } from './helpers';

/** Extra production that is not a potion buff (potion costs ignore buffs). */
const extra: ModifierDef[] = [];
function boost(g: Game, mods: ModifierDef[]) {
  extra.push(...mods);
  g.invalidate();
}

function marketGame() {
  extra.length = 0;
  const g = new Game({ content, balance, now: NOW, seed: 42, providers: [...DEFAULT_PROVIDERS, (_ctx, into) => into.addAll('test', extra)] });
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

  it('Festmahl and Turbo cost minutes of production (never less than their base price)', () => {
    const g = marketGame();
    const feast = content.potions.get('feast');
    const turbo = content.potions.get('turbo');
    expect(potionCost(g, 'feast').food!.toNumber()).toBe(Math.ceil(Math.max(feast.cost.food!, (productionRates(g).food?.toNumber() ?? 0) * 60 * feast.costMinutes!)));
    boost(g, [{ target: 'production.food', op: 'add', value: 1e4 }, { target: 'production.gold', op: 'add', value: 1e4 }]);
    const food = productionRates(g).food!.toNumber();
    const gold = productionRates(g).gold!.toNumber();
    expect(potionCost(g, 'feast').food!.toNumber()).toBe(Math.ceil(food * 60 * feast.costMinutes!));
    expect(potionCost(g, 'turbo').gold!.toNumber()).toBe(Math.ceil(gold * 60 * turbo.costMinutes!));
    // A Festmahl or Turbo-Trank does not make the next potion dearer.
    usePotion(g, 'feast');
    usePotion(g, 'turbo', g.state.creatures[0]!.id);
    expect(productionRates(g).food!.toNumber()).toBeGreaterThan(food);
    expect(potionCost(g, 'feast').food!.toNumber()).toBe(Math.ceil(food * 60 * feast.costMinutes!));
  });

  it('Zeittrank costs minutes of essence production and doubles when drunk again within the hour', () => {
    const g = marketGame();
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBeGreaterThanOrEqual(10); // base price early on
    boost(g, [{ target: 'production.essence', op: 'add', value: 50 }]);
    const rate = productionRates(g).essence!.toNumber();
    expect(rate).toBeGreaterThan(0);
    const first = potionCost(g, 'timeCrystal').essence!.toNumber();
    expect(first).toBe(Math.ceil(Math.max(10, rate * 60 * content.potions.get('timeCrystal').costMinutes!)));
    startProcess(g, 'test-crystal', 3_000_000);
    expect(usePotion(g, 'timeCrystal').ok).toBe(true);
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBe(Math.ceil(first * balance.market.timeSkipGrowth));
    // After the window the price is back to normal.
    g.state.lastTickAt += balance.market.timeSkipWindowHours * 3_600_000 + 1;
    expect(potionCost(g, 'timeCrystal').essence!.toNumber()).toBe(first);
  });
});

describe('Fähigkeits-Elixier and Keimöl', () => {
  const elixirGame = () => {
    const g = marketGame();
    unlockFeature(g, 'abilityElixir');
    g.state.resources['germOil'] = D(100);
    const c = createCreature(g, { speciesId: 'emberpup', source: 'other', abilities: ['nurturer', 'tough'] });
    return { g, c };
  };

  it('raises one ability of one creature a level: ×1,5, then ×2, never further', () => {
    const { g, c } = elixirGame();
    const factor = () => creatureModifiers(g, c).factor('breeding.time');
    expect(factor()).toBeCloseTo(0.9);
    const first = potionCost(g, 'abilityElixir', c.id, 'nurturer');
    expect(usePotion(g, 'abilityElixir', c.id, 'nurturer').ok).toBe(true);
    expect(abilityLevel(c, 'nurturer')).toBe(2);
    expect(factor()).toBeCloseTo(0.85);
    // The next level costs `costGrowth` times as much – Keimöl included.
    const second = potionCost(g, 'abilityElixir', c.id, 'nurturer');
    expect(second['germOil']!.toNumber()).toBe(first['germOil']!.toNumber() * content.potions.get('abilityElixir').costGrowth!);
    expect(usePotion(g, 'abilityElixir', c.id, 'nurturer').ok).toBe(true);
    expect(factor()).toBeCloseTo(0.8);
    expect(usePotion(g, 'abilityElixir', c.id, 'nurturer')).toEqual({ ok: false, reason: 'Diese Fähigkeit ist bereits auf der höchsten Stufe.' });
    expect(usePotion(g, 'abilityElixir', c.id, 'mutagenic')).toEqual({ ok: false, reason: 'Wähle eine Fähigkeit der Kreatur.' });
    expect(abilityLevel(c, 'tough')).toBe(1);
  });

  it('needs Keimöl, which only arrives once the elixir is known', () => {
    const g = marketGame();
    expect(usePotion(g, 'abilityElixir', g.state.creatures[0]!.id, 'nurturer').ok).toBe(false);
    // 4★ contracts pay Keimöl only after the unlock.
    const offer = { template: 'eliteLine', requirements: [], done: false };
    unlockFeature(g, 'contracts');
    expect(contractReward(g, offer)['germOil']).toBeUndefined();
    unlockFeature(g, 'abilityElixir');
    expect(contractReward(g, offer)['germOil']!.toNumber()).toBe(1);
  });
});
