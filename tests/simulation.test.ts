import { describe, expect, it } from 'vitest';
import { assignJob, buyUpgrade, collect } from '@core/actions';
import { D } from '@core/num';
import { registerProcessHandler, startProcess } from '@core/systems/processes';
import { addBuff } from '@core/systems/buffs';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, makeGame } from './helpers';

function farmingGame() {
  const g = makeGame();
  unlockFeature(g, 'farm');
  expect(assignJob(g, g.state.creatures[0]!.id, 'farm').ok).toBe(true);
  return g;
}

describe('tick simulation', () => {
  it('starts with one creature and manual collecting', () => {
    const g = makeGame();
    expect(g.state.creatures).toHaveLength(1);
    expect(g.state.features.collect).toBe(true);
    expect(g.state.features.farm).toBeUndefined();
    collect(g);
    expect(g.state.resources.food!.toNumber()).toBe(1);
  });

  it('uses fixed steps: chunked and single advance give the same result', () => {
    const a = farmingGame();
    const b = farmingGame();
    a.advance(10_000);
    for (let i = 0; i < 100; i++) b.advance(100);
    expect(a.state.resources.food!.toNumber()).toBeCloseTo(b.state.resources.food!.toNumber(), 8);
    expect(a.state.simTimeMs).toBe(10_000);
  });

  it('carries sub-step remainders over', () => {
    const g = farmingGame();
    g.advance(150);
    expect(g.state.simTimeMs).toBe(100);
    g.advance(50);
    expect(g.state.simTimeMs).toBe(200);
  });

  it('production follows the modifier system', () => {
    const g = farmingGame();
    const base = g.productionRates().food!.toNumber();
    g.state.resources.food = D(1000);
    unlockFeature(g, 'research');
    expect(buyUpgrade(g, 'fertileSoil').ok).toBe(true);
    expect(g.productionRates().food!.toNumber()).toBeCloseTo(base * 1.25);
  });
});

describe('offline progress', () => {
  it('matches live simulation for the same duration', () => {
    const live = farmingGame();
    const offline = farmingGame();
    live.advance(3_600_000);
    const report = offline.simulateOffline(3_600_000);
    expect(report.simulatedMs).toBe(3_600_000);
    // Coarser steps may cross unlock thresholds (achievements) slightly later: allow 0.01 %.
    const liveFood = live.state.resources.food!.toNumber();
    expect(Math.abs(offline.state.resources.food!.toNumber() - liveFood) / liveFood).toBeLessThan(1e-4);
    expect(offline.state.achievements).toEqual(live.state.achievements);
  });

  it('is capped (12 h by default) and the cap is extendable by modifiers', () => {
    const g = farmingGame();
    const report = g.simulateOffline(48 * 3_600_000);
    expect(report.capMs).toBe(12 * 3_600_000);
    expect(report.simulatedMs).toBe(12 * 3_600_000);

    const h = farmingGame();
    h.state.upgrades.timeVault = 2;
    h.invalidate();
    expect(h.simulateOffline(48 * 3_600_000).simulatedMs).toBe(16 * 3_600_000);
  });

  it('update() turns long gaps into offline progress', () => {
    const g = farmingGame();
    expect(g.update(NOW + 1000)).toBeNull();
    const report = g.update(NOW + 1000 + 2 * 3_600_000);
    expect(report?.simulatedMs).toBe(2 * 3_600_000);
    expect(report?.gained.food).toBeDefined();
  });

  it('completes processes and expires buffs while offline', () => {
    const g = makeGame();
    const done: number[] = [];
    registerProcessHandler('test-egg', { complete: (_ctx, p) => done.push(p.id) });
    const p = startProcess(g, 'test-egg', 30 * 60_000);
    addBuff(g, 'feast', [{ target: 'production.food', op: 'pct', value: 1 }], 60_000);
    g.simulateOffline(3_600_000);
    expect(done).toEqual([p.id]);
    expect(g.state.processes).toHaveLength(0);
    expect(g.state.buffs).toHaveLength(0);
    expect(g.state.statistics['completed.test-egg']).toBe(1);
  });

  it('respects process speed modifiers', () => {
    const g = makeGame();
    registerProcessHandler('test-fast', { complete: () => {} });
    startProcess(g, 'test-fast', 10_000);
    addBuff(g, 'haste', [{ target: 'process.test-fast.speed', op: 'mult', value: 2 }], 60_000);
    g.advance(5_000);
    expect(g.state.processes).toHaveLength(0);
  });
});
