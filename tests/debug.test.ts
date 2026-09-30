import { describe, expect, it } from 'vitest';
import { DEBUG_RESETS, debugReset } from '@core/debug';
import { claimDaily, dailyAvailable } from '@core/features/daily';
import { refreshContracts } from '@core/features/contracts';
import { refreshTorches, startRpgRun, torches } from '@core/features/rpg';
import { rpgLevel, xpForLevel } from '@core/features/rpgCombat';
import { startMission } from '@core/features/expedition';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, makeGame } from './helpers';
import { D } from '@core/num';

describe('Debug-Werkzeuge', () => {
  it('every reset has a name and runs on a fresh game without throwing', () => {
    for (const r of DEBUG_RESETS) {
      expect(r.name.length).toBeGreaterThan(0);
      const g = makeGame();
      expect(() => debugReset(g, r.id)).not.toThrow();
    }
  });

  it('opens the daily gift and the contract board again', () => {
    const g = makeGame();
    unlockFeature(g, 'daily');
    unlockFeature(g, 'contracts');
    refreshContracts(g);
    expect(claimDaily(g, NOW).ok).toBe(true);
    expect(dailyAvailable(g, NOW)).toBe(false);
    debugReset(g, 'daily');
    expect(dailyAvailable(g, NOW)).toBe(true);
    g.state.contracts.offers[0]!.done = true;
    g.state.contracts.rerolls = 1;
    debugReset(g, 'contracts');
    expect(g.state.contracts.offers.every((o) => !o.done)).toBe(true);
    expect(g.state.contracts.rerolls).toBe(0);
  });

  it('finishes running processes on the next step', () => {
    const g = makeGame();
    unlockFeature(g, 'expedition');
    const c = g.state.creatures[0]!;
    const mission = g.content.missions.list[0]!;
    for (const res of ['food', 'gold', 'essence']) g.state.resources[res] = D(1e9);
    expect(startMission(g, c.id, mission.id).ok).toBe(true);
    expect(g.state.processes).toHaveLength(1);
    debugReset(g, 'processes');
    g.step(100);
    expect(g.state.processes).toHaveLength(0);
  });

  it('resets the GenLab RPG piece by piece, some not during a run', () => {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    const c = g.state.creatures[0]!;
    g.state.rpg.ranks[String(c.id)] = xpForLevel(g, 10);
    debugReset(g, 'rpgOpenDungeons');
    expect(Object.keys(g.state.rpg.cleared)).toHaveLength(g.content.rpgDungeons.list.length);
    const before = torches(g);
    debugReset(g, 'rpgTorches');
    expect(torches(g)).toBe(before + 10);
    startRpgRun(g, c.id, 'rootMaze');
    expect(debugReset(g, 'rpgLevels').ok).toBe(false);
    expect(debugReset(g, 'rpgRun').ok).toBe(true);
    expect(g.state.rpg.run).toBeNull();
    expect(debugReset(g, 'rpgLevels').ok).toBe(true);
    expect(rpgLevel(g, c.id).level).toBe(1);
    debugReset(g, 'rpgDungeons');
    expect(g.state.rpg.cleared).toEqual({});
    expect(g.state.rpg.lastResult).toBeNull();
  });
});
