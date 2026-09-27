import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { performPrestige, prestigeGain } from '@core/prestige';
import { unlockFeature } from '@core/systems/unlocks';
import { createCreature } from '@core/creatures';
import { startProcess } from '@core/systems/processes';
import { balance, makeGame } from './helpers';

function richGame() {
  const g = makeGame();
  unlockFeature(g, 'research');
  unlockFeature(g, 'inheritance');
  g.state.earned.food = D(3e5);
  g.state.earned.gold = D(6e5);
  g.state.resources.food = D(1234);
  g.state.resources.gold = D(5678);
  g.state.resources.essence = D(42);
  g.state.upgrades.autoGatherer = 3;
  createCreature(g, { speciesId: 'bubbloon', rarity: 'epic' });
  startProcess(g, 'test-noop', 60_000);
  g.invalidate();
  return g;
}

describe('prestige (Vererbung)', () => {
  it('computes gain from earned food + gold', () => {
    const g = richGame();
    const t = balance.prestige.inheritance!;
    expect(prestigeGain(g, 'inheritance').toNumber()).toBe(Math.floor(((3e5 + 6e5) / t.divisor) ** t.exponent));
  });

  it('refuses without gain or without the feature', () => {
    const g = makeGame();
    expect(performPrestige(g, 'inheritance').ok).toBe(false);
    unlockFeature(g, 'inheritance');
    expect(performPrestige(g, 'inheritance')).toEqual({ ok: false, reason: 'Noch kein Gewinn möglich.' });
  });

  it('resets creatures/resources/processes and keeps research, dex and essence', () => {
    const g = richGame();
    const dexBefore = { ...g.state.dex };
    const gain = prestigeGain(g, 'inheritance');
    expect(performPrestige(g, 'inheritance').ok).toBe(true);

    expect(g.state.resources.food!.toNumber()).toBe(0);
    expect(g.state.resources.gold!.toNumber()).toBe(0);
    expect(g.state.resources.essence!.toNumber()).toBe(42);
    expect(g.state.resources.heritage!.eq(gain)).toBe(true);
    expect(g.state.earned.food).toBeUndefined();
    expect(g.state.processes).toHaveLength(0);
    expect(g.state.upgrades.autoGatherer).toBe(3);
    expect(g.state.dex).toEqual(dexBefore);
    expect(g.state.features.research).toBe(true);
    // Fresh start creature
    expect(g.state.creatures).toHaveLength(1);
    expect(g.state.creatures[0]!.speciesId).toBe(balance.start.species);
    expect(g.state.prestige.inheritance?.count).toBe(1);
    expect(g.state.achievements.firstHeir).toBe(true);
  });

  it('heritage points boost production via modifiers', () => {
    const g = richGame();
    const pctBefore = g.mods().totals('production.food').pct;
    performPrestige(g, 'inheritance');
    const points = g.state.resources.heritage!.toNumber();
    expect(points).toBeGreaterThan(0);
    expect(g.mods().totals('production.food').pct).toBeCloseTo(pctBefore + 0.02 * points, 8);
  });
});
