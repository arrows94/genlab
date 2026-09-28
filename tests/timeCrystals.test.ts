import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { claimDaily } from '@core/features/daily';
import { usePotion } from '@core/features/market';
import { crystalSkipMs, isLongProject, timeCrystals, useTimeCrystal } from '@core/features/timeCrystals';
import { fightNextFloor } from '@core/features/tower';
import { registerProcessHandler, startProcess } from '@core/systems/processes';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const H = 3_600_000;
registerProcessHandler('test-long', { complete: () => {} });
registerProcessHandler('test-short', { complete: () => {} });

function crystalGame() {
  const g = makeGame();
  unlockFeature(g, 'contracts');
  g.state.resources.timeCrystals = D(3);
  return g;
}

describe('Zeitkristalle', () => {
  it('take hours off a long project, one crystal each', () => {
    const g = crystalGame();
    const p = startProcess(g, 'test-long', 24 * H);
    expect(isLongProject(g, p)).toBe(true);
    expect(useTimeCrystal(g, p.id).ok).toBe(true);
    expect(p.elapsedMs).toBe(crystalSkipMs(g));
    expect(crystalSkipMs(g)).toBe(balance.timeCrystals.skipHours * H);
    expect(timeCrystals(g)).toBe(2);
  });

  it('do not work on short processes or without crystals', () => {
    const g = crystalGame();
    const short = startProcess(g, 'test-short', 10 * 60_000);
    expect(useTimeCrystal(g, short.id).ok).toBe(false);
    g.state.resources.timeCrystals = D(0);
    const long = startProcess(g, 'test-long', 8 * H);
    expect(useTimeCrystal(g, long.id).ok).toBe(false);
    expect(long.elapsedMs).toBe(0);
  });

  it('finish a project that is almost done', () => {
    const g = crystalGame();
    const p = startProcess(g, 'test-long', 8 * H);
    p.elapsedMs = 7 * H;
    expect(useTimeCrystal(g, p.id).ok).toBe(true);
    g.advance(200);
    expect(g.state.processes).toHaveLength(0);
  });

  it('the market potion only speeds up short processes now', () => {
    const g = crystalGame();
    unlockFeature(g, 'market');
    g.state.resources.essence = D(1000);
    const long = startProcess(g, 'test-long', 24 * H);
    expect(usePotion(g, 'timeCrystal', null).ok).toBe(false);
    const short = startProcess(g, 'test-short', 50 * 60_000);
    expect(usePotion(g, 'timeCrystal', null).ok).toBe(true);
    expect(short.elapsedMs).toBe(15 * 60_000);
    expect(long.elapsedMs).toBe(0);
    expect(content.potions.get('timeCrystal').name).toBe('Zeittrank');
  });

  it('are earned from contracts, the daily gift and tower milestones', () => {
    const levels = content.contracts.list.filter((t) => (t.reward.resources?.timeCrystals ?? 0) > 0).map((t) => t.level);
    expect(Math.min(...levels)).toBe(3);
    expect(balance.daily.rewards.at(-1)!.resources?.timeCrystals).toBeGreaterThan(0);

    const g = crystalGame();
    unlockFeature(g, 'daily');
    g.state.daily.step = balance.daily.rewards.length - 1;
    expect(claimDaily(g, NOW).ok).toBe(true);
    expect(timeCrystals(g)).toBe(3 + balance.daily.rewards.at(-1)!.resources!.timeCrystals!);

    // Tower: a new record on a milestone floor pays one crystal, repeating it does not.
    const t = makeGame();
    const gained: number[] = [];
    t.bus.on('towerFloor', (e) => e.win && gained.push(e.rewards.timeCrystals?.toNumber() ?? 0));
    const every = balance.timeCrystals.towerEvery;
    t.state.tower.run = { floor: every - 1, team: [t.state.creatures[0]!.id], elapsedMs: 0, startFloor: every - 1 };
    t.state.tower.best = every - 1;
    t.state.creatures[0]!.stats = { hp: 1e9, atk: 1e9, def: 1e9, spd: 1e9 };
    t.invalidate();
    fightNextFloor(t);
    expect(gained).toEqual([1]);
    t.state.tower.run = { floor: every - 1, team: [t.state.creatures[0]!.id], elapsedMs: 0, startFloor: every - 1 };
    fightNextFloor(t);
    expect(gained).toEqual([1, 0]);
  });
});
