import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { noteActive } from '@core/activity';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, makeGame } from './helpers';

const T0 = 1_800_000_000_000;
const SEC = 1000;

describe('active play time', () => {
  it('adds up active time and counts sessions separated by long pauses', () => {
    const g = makeGame();
    noteActive(g, SEC, T0);
    noteActive(g, SEC, T0 + SEC);
    expect(g.state.statistics['activeMs']).toBe(2 * SEC);
    expect(g.state.statistics['sessions']).toBe(1);
    // A short pause continues the session …
    noteActive(g, SEC, T0 + 60 * SEC);
    expect(g.state.statistics['sessions']).toBe(1);
    expect(g.state.statistics['record.session']).toBe(3 * SEC);
    // … a long one starts a new session.
    noteActive(g, SEC, T0 + 60 * SEC + (balance.activity.sessionGapSec + 1) * SEC);
    expect(g.state.statistics['sessions']).toBe(2);
    expect(g.state.statistics['record.session']).toBe(3 * SEC);
    expect(g.state.statistics['activeMs']).toBe(4 * SEC);
  });

  it('never counts a huge step at once (sleeping device)', () => {
    const g = makeGame();
    noteActive(g, 3_600_000, T0);
    expect(g.state.statistics['activeMs']).toBe(balance.activity.maxTickSec * SEC);
  });

  it('offline progress does not count as active play', () => {
    const g = makeGame();
    g.update(g.state.lastTickAt + 3_600_000);
    expect(g.state.statistics['activeMs'] ?? 0).toBe(0);
  });
});

describe('milestones', () => {
  it('stamp the active time the first time a feature, an achievement or a tower floor is reached', () => {
    const g = makeGame();
    noteActive(g, 5 * SEC, T0);
    unlockFeature(g, 'breeding');
    expect(g.state.milestones['feature:breeding']).toEqual({ activeMs: 5 * SEC, simMs: g.state.simTimeMs });
    noteActive(g, 5 * SEC, T0 + 5 * SEC);
    // Unlocked again after a reset: the first time stays.
    delete g.state.features['breeding'];
    unlockFeature(g, 'breeding');
    expect(g.state.milestones['feature:breeding']!.activeMs).toBe(5 * SEC);

    g.state.earned.food = D(1e6);
    g.step(100);
    expect(g.state.achievements['pantry']).toBe(true);
    expect(g.state.milestones['achievement:pantry']!.activeMs).toBe(10 * SEC);

    const floor = balance.activity.towerMilestones[0]!;
    g.bus.emit('towerFloor', { floor, win: true, rewards: {}, allele: null });
    g.bus.emit('towerFloor', { floor: floor + 1, win: true, rewards: {}, allele: null });
    expect(g.state.milestones[`tower:${floor}`]).toBeDefined();
    expect(g.state.milestones[`tower:${floor + 1}`]).toBeUndefined();
  });

  it('are kept in the save; older saves start empty', () => {
    const g = makeGame();
    noteActive(g, 3 * SEC, T0);
    unlockFeature(g, 'breeding');
    const { state } = deserialize(serialize(g.state));
    expect(state.statistics['activeMs']).toBe(3 * SEC);
    expect(state.milestones['feature:breeding']!.activeMs).toBe(3 * SEC);
    const raw = JSON.parse(serialize(g.state));
    delete raw.state.activity;
    delete raw.state.milestones;
    const old = deserialize(JSON.stringify(raw)).state;
    expect(old.milestones).toEqual({});
    expect(old.activity).toEqual({ lastActiveAt: 0, sessionMs: 0 });
  });
});
