import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { fightNextFloor, setTeam, startRun } from '@core/features/tower';
import { advanceReplay, fightSeconds, finalState, gauge, intervalsOf, replayStart, timedEvents, upcomingActions } from '@core/features/towerReplay';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';

function lastFight(power: number) {
  const g = makeGame(5);
  for (const f of ['farm', 'breeding', 'tower']) unlockFeature(g, f);
  g.state.resources.towerTokens = D(1e6);
  const c = createCreature(g, { speciesId: 'emberpup', rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
  expect(setTeam(g, [c.id]).ok).toBe(true);
  expect(startRun(g, false).ok).toBe(true);
  fightNextFloor(g);
  return { g, lr: g.state.tower.lastResult! };
}

describe('tower fight replay (pure, used by the arena)', () => {
  it('playing every event ends in the final state of a won fight', () => {
    const { g, lr } = lastFight(80);
    expect(lr.win).toBe(true);
    const events = timedEvents(lr);
    expect(events.length).toBeGreaterThan(0);
    expect(fightSeconds(g, lr, events)).toBeGreaterThan(0);
    const { state, fired } = advanceReplay(replayStart(lr), events, Infinity);
    expect(fired).toHaveLength(events.length);
    expect(state.idx).toBe(events.length);
    expect(state.hp).toEqual(finalState(lr).hp);
    // Enemies are down after a win.
    lr.fighters!.forEach((f, i) => !f.team && expect(finalState(lr).hp[i]).toBe(0));
  });

  it('advances step by step without touching the input', () => {
    const { lr } = lastFight(80);
    const events = timedEvents(lr);
    const start = replayStart(lr);
    const half = advanceReplay(start, events, events[0]!.at);
    expect(start.idx).toBe(0);
    expect(half.state.idx).toBeGreaterThanOrEqual(1);
    const rest = advanceReplay(half.state, events, Infinity);
    expect(half.fired.length + rest.fired.length).toBe(events.length);
  });

  it('gauges and the turn order follow the action intervals', () => {
    const { lr } = lastFight(80);
    const intervals = intervalsOf(lr);
    expect(gauge(1.5, 1)).toBeCloseTo(0.5);
    expect(gauge(3, 0)).toBe(0);
    const next = upcomingActions(intervals, intervals.map(() => true), 0, 4);
    expect(next.length).toBeGreaterThan(0);
    for (let i = 1; i < next.length; i++) expect(next[i]!.at).toBeGreaterThanOrEqual(next[i - 1]!.at);
    expect(upcomingActions(intervals, intervals.map(() => false), 0, 4)).toEqual([]);
  });
});
