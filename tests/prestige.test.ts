import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { currentRunStart, nextPrestigePoint, performPrestige, prestigeBonusPreview, prestigeGain, prestigeTimeline, resetOverview } from '@core/prestige';
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
    expect(g.mods().totals('production.food').pct).toBeCloseTo(pctBefore + 0.1 * points, 8);
  });
});

describe('Vererbung overview', () => {
  it('lists what is lost and what stays', () => {
    const g = richGame();
    const { lost, kept } = resetOverview(g, 'inheritance');
    expect(lost.map((x) => x.label)).toEqual(expect.arrayContaining(['Nahrung', 'Gold', 'Kreaturen', 'Laufende Vorgänge']));
    expect(kept.map((x) => x.label)).toEqual(expect.arrayContaining(['Essenz', 'Forschung']));
    expect(lost.map((x) => x.label)).not.toContain('Forschung');
  });

  it('previews the production bonus before and after', () => {
    const g = richGame();
    g.state.resources.heritage = D(4);
    const gain = prestigeGain(g, 'inheritance').toNumber();
    const food = prestigeBonusPreview(g, 'inheritance').find((b) => b.target === 'production.food')!;
    expect(food.before).toBeCloseTo(0.4);
    expect(food.after).toBeCloseTo(0.1 * (4 + gain));
  });

  it('knows how much more is needed for the next point', () => {
    const g = richGame();
    g.state.earned.food = D(4.5e5); // between two points
    const { needed, progress } = nextPrestigePoint(g, 'inheritance');
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
    const now = prestigeGain(g, 'inheritance').toNumber();
    g.state.earned.food = needed.sub(g.state.earned.gold!).add(1);
    expect(prestigeGain(g, 'inheritance').toNumber()).toBe(now + 1);
  });

  it('records each run for the timeline', () => {
    const g = richGame();
    g.state.lastTickAt = g.state.createdAt + 3_600_000;
    const gain = prestigeGain(g, 'inheritance').toNumber();
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(g.state.prestigeLog).toEqual([{ layer: 'inheritance', at: g.state.createdAt + 3_600_000, gain, runMs: 3_600_000 }]);
    g.state.earned.food = D(1e6);
    g.state.lastTickAt += 600_000;
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(g.state.prestigeLog[1]!.runMs).toBe(600_000);
  });
});

describe('prestige timeline (Vererbung and Äon views)', () => {
  const H = 3_600_000;
  function logged() {
    const g = makeGame();
    const t0 = g.state.createdAt;
    g.state.prestige = { inheritance: { count: 4 }, aeon: { count: 1 } };
    g.state.prestigeLog = [
      { layer: 'inheritance', at: t0 + 2 * H, gain: 3, runMs: 2 * H },
      { layer: 'inheritance', at: t0 + 5 * H, gain: 6, runMs: 3 * H },
      { layer: 'aeon', at: t0 + 6 * H, gain: 4, runMs: H },
      { layer: 'inheritance', at: t0 + 10 * H, gain: 2, runMs: 4 * H },
    ];
    g.state.lastTickAt = t0 + 12 * H;
    return { g, t0 };
  }

  it('shows own runs as bars and higher layers as markers', () => {
    const { g } = logged();
    const t = prestigeTimeline(g, 'inheritance');
    expect(t.items.map((x) => x.kind)).toEqual(['run', 'run', 'marker', 'run']);
    expect(t.items.map((x) => (x.kind === 'run' ? x.runMs : 0))).toEqual([2 * H, 3 * H, 0, 4 * H]);
    expect(t.best).toBe(6);
    expect(t.unrecorded).toBe(1);
  });

  it('measures Äons from Äon to Äon and counts the inheritances inside', () => {
    const { g, t0 } = logged();
    const t = prestigeTimeline(g, 'aeon');
    expect(t.items).toEqual([{ kind: 'run', at: t0 + 6 * H, gain: 4, runMs: 6 * H, inner: 2 }]);
    expect(currentRunStart(g, 'aeon')).toBe(t0 + 6 * H);
    expect(currentRunStart(g, 'inheritance')).toBe(t0 + 10 * H);
  });
});
