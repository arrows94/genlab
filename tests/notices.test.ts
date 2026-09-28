import { describe, expect, it } from 'vitest';
import { assignJob } from '@core/actions';
import { EGG } from '@core/features/breeding';
import { MISSION } from '@core/features/expedition';
import { plannedNotices } from '@core/notices';
import { registerProcessHandler, startProcess } from '@core/systems/processes';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, content, makeGame } from './helpers';

const MIN = 60_000;
const mission = content.missions.list[0]!;

function missionIn(g: ReturnType<typeof makeGame>, ms: number) {
  return startProcess(g, MISSION, ms, { missionId: mission.id, creatureId: g.state.creatures[0]!.id });
}

describe('planned notices', () => {
  it('announces when an expedition returns, with creature and region', () => {
    const g = makeGame();
    missionIn(g, 30 * MIN);
    const [n, ...rest] = plannedNotices(g, NOW);
    expect(rest).toHaveLength(0);
    expect(n!.kind).toBe(MISSION);
    expect(n!.at).toBe(NOW + 30 * MIN);
    expect(n!.body).toContain(g.state.creatures[0]!.name);
    expect(n!.body).toContain(mission.name);
  });

  it('uses the remaining time of a running process', () => {
    const g = makeGame();
    missionIn(g, 30 * MIN).elapsedMs = 20 * MIN;
    expect(plannedNotices(g, NOW)[0]!.at).toBe(NOW + 10 * MIN);
  });

  it('skips short processes and unknown kinds', () => {
    const g = makeGame();
    const id = g.state.creatures[0]!.id;
    startProcess(g, EGG, 20_000, { parents: [id, id], generation: 1 });
    registerProcessHandler('test-silent', { complete: () => {} });
    startProcess(g, 'test-silent', 60 * MIN);
    expect(plannedNotices(g, NOW)).toEqual([]);
  });

  it('merges completions of one kind close together', () => {
    const g = makeGame();
    missionIn(g, 30 * MIN);
    missionIn(g, 31 * MIN);
    missionIn(g, 60 * MIN);
    const notices = plannedNotices(g, NOW);
    expect(notices.map((n) => n.at)).toEqual([NOW + 31 * MIN, NOW + 60 * MIN]);
    expect(notices[0]!.body).toBe('2 Expeditionen sind zurückgekehrt.');
    expect(notices[1]!.body).toContain(mission.name);
  });

  it('reminds when offline production reaches its cap', () => {
    const g = makeGame();
    expect(plannedNotices(g, NOW)).toEqual([]);
    unlockFeature(g, 'farm');
    expect(assignJob(g, g.state.creatures[0]!.id, 'farm').ok).toBe(true);
    const [n] = plannedNotices(g, NOW);
    expect(n!.kind).toBe('offlineCap');
    expect(n!.at).toBe(NOW + 12 * 3_600_000);
  });
});
