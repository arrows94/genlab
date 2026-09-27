import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { campSlots, missionDurationMs, startMission } from '@core/features/expedition';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

function expeditionGame(seed = 1) {
  const g = makeGame(seed);
  unlockFeature(g, 'expedition');
  g.state.resources.food = D(1e5);
  return g;
}

describe('expeditions', () => {
  it('costs food, occupies the creature and returns rewards', () => {
    const g = expeditionGame();
    const c = g.state.creatures[0]!;
    expect(startMission(g, c.id, 'short').ok).toBe(true);
    expect(g.state.resources.food!.toNumber()).toBe(1e5 - 25);
    expect(c.job?.kind).toBe('mission');
    expect(startMission(g, c.id, 'short').ok).toBe(false);

    const results: unknown[] = [];
    g.bus.on('missionCompleted', (e) => results.push(e));
    g.advance(missionDurationMs(g, 'short') + 100);
    expect(results).toHaveLength(1);
    expect(c.job).toBeNull();
    expect(g.state.resources.gold!.gt(0)).toBe(true);
  });

  it('respects camp slots', () => {
    const g = expeditionGame();
    unlockFeature(g, 'breeding');
    const [a, b] = g.state.creatures;
    expect(campSlots(g)).toBe(1);
    expect(startMission(g, a!.id, 'short').ok).toBe(true);
    expect(startMission(g, b!.id, 'short')).toEqual({ ok: false, reason: 'Alle Camps sind belegt.' });
  });

  it('finds wild creatures at the mission wild chance', () => {
    const g = expeditionGame(3);
    g.state.resources.food = D(1e9);
    const c = g.state.creatures[0]!;
    let found = 0;
    const runs = 400;
    g.bus.on('missionCompleted', (e) => e.wildCreatureId !== null && found++);
    for (let i = 0; i < runs; i++) {
      startMission(g, c.id, 'long');
      g.step(missionDurationMs(g, 'long'));
    }
    expect(found / runs).toBeGreaterThan(0.5);
    expect(found / runs).toBeLessThan(0.7);
    expect(g.state.statistics.wildFound).toBe(found);
  });

  it('cartographer shortens missions', () => {
    const g = expeditionGame();
    g.state.upgrades.cartographer = 1;
    g.invalidate();
    expect(missionDurationMs(g, 'medium')).toBe(540_000);
  });
});
