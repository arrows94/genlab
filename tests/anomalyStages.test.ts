import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import {
  abandonAnomaly, anomalyGoal, anomalyGoalText, anomalyProgress, anomalyScale, maxStartLevel, ruleActive, startAnomalies, startAnomaly,
} from '@core/features/anomalies';
import { formatNumber } from '@core/format';
import { deserialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, content, makeGame } from './helpers';

function anomalyGame() {
  const g = makeGame(30);
  for (const f of ['farm', 'breeding', 'mine', 'market', 'inheritance', 'anomalies']) unlockFeature(g, f);
  for (const r of ['food', 'gold', 'essence']) g.state.resources[r] = D(1e12);
  return g;
}

const famineGoal = (content.anomalies.get('famine').goal as { amount: number }).amount;

describe('anomaly stages', () => {
  it('open one stage after the other, up to V', () => {
    const g = anomalyGame();
    expect(maxStartLevel(g, 'famine')).toBe(1);
    expect(startAnomaly(g, 'famine', 2).ok).toBe(false);
    g.state.anomalyBest.famine = 1;
    expect(maxStartLevel(g, 'famine')).toBe(2);
    g.state.anomalyBest.famine = balance.anomalies.maxLevel;
    expect(maxStartLevel(g, 'famine')).toBe(balance.anomalies.maxLevel);
  });

  it('make rules harsher and goals bigger per stage', () => {
    const g = anomalyGame();
    g.state.anomalyBest.famine = 2;
    const food = g.mods().factor('production.food');
    expect(startAnomaly(g, 'famine', 3).ok).toBe(true);
    // Stage III: base ×0.5 and twice ×0.8 per extra stage.
    expect(g.mods().factor('production.food') / food).toBeCloseTo(0.5 * 0.8 * 0.8);
    const goal = anomalyGoal(g, 'famine', 3) as { amount: number };
    const expected = famineGoal * balance.anomalies.goalGrowth ** 2 * anomalyScale(g, 'famine');
    expect(goal.amount).toBeGreaterThanOrEqual(expected);
    expect(goal.amount).toBeLessThan(expected * 1.1);
    expect(anomalyGoalText(g, 'famine', 3)).toContain('Nahrung in diesem Lauf verdienen');
  });

  it('goals grow with the production bonus and stay fixed while the run goes', () => {
    const g = anomalyGame();
    g.state.resources.heritage = D(20); // +200 % production
    g.invalidate();
    const scale = g.mods().factor('production.food');
    expect(scale).toBeGreaterThan(2);
    expect(anomalyScale(g, 'famine')).toBeCloseTo(scale);
    const preview = (anomalyGoal(g, 'famine', 1) as { amount: number }).amount;
    expect(preview).toBeGreaterThanOrEqual(famineGoal * scale);
    expect(preview).toBeLessThan(famineGoal * scale * 1.1); // rounded to two digits
    expect(startAnomaly(g, 'famine').ok).toBe(true);
    expect(g.state.anomaly?.scales?.famine).toBeCloseTo(scale);
    // More bonuses during the run (and the anomaly's own halving) do not move the goal.
    g.state.resources.heritage = D(500);
    g.invalidate();
    expect((anomalyGoal(g, 'famine', 1) as { amount: number }).amount).toBe(preview);
    expect(anomalyGoalText(g, 'famine', 1)).toContain(formatNumber(preview));
  });

  it('run several at once – won when all goals are met, with rules of both', () => {
    const g = anomalyGame();
    g.state.anomalyBest.famine = 1;
    expect(startAnomalies(g, { ascetic: 1, famine: 2 }).ok).toBe(true);
    expect(ruleActive(g, 'noPotions')).toBe(true);
    const amount = (id: string, level: number) => (anomalyGoal(g, id, level) as { amount: number }).amount;
    g.state.earned.gold = D(amount('ascetic', 1));
    g.step(100);
    expect(g.state.anomaly).not.toBeNull(); // famine goal still open
    expect(anomalyProgress(g)).toBeLessThan(1);
    g.state.earned.food = D(amount('famine', 2));
    g.step(100);
    expect(g.state.anomaly).toBeNull();
    expect(g.state.anomalyBest).toMatchObject({ ascetic: 1, famine: 2 });
    expect(g.state.anomaliesCompleted.ascetic).toBe(true);
  });

  it('a record in total difficulty pays shards once and a permanent bonus', () => {
    const g = anomalyGame();
    g.state.anomalyBest = { famine: 1 };
    const inheritance = g.mods().totals('prestige.inheritance.gain').pct;
    startAnomalies(g, { famine: 2, cramped: 1 });
    g.state.earned.food = D(1e15);
    g.state.earned.essence = D(1e15);
    g.step(100);
    expect(g.state.anomalyRecord).toBe(3);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(3 * balance.anomalies.shardsPerRecordPoint);
    expect(g.mods().totals('prestige.inheritance.gain').pct).toBeCloseTo(inheritance + 0.015 * 3);
    // Rewards grow with the best stage mastered: famine II = twice +20 % food.
    expect(g.mods().list('production.food').find((m) => m.source === 'anomalyReward:famine')!.value).toBeCloseTo(0.4);
    // An easier run later: no new shards.
    startAnomaly(g, 'ascetic');
    g.state.earned.gold = D(1e15);
    g.step(100);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(3);
    abandonAnomaly(g);
  });

  it('old saves: a running anomaly becomes stage I, mastered ones count as stage I', () => {
    const g = anomalyGame();
    const old = JSON.parse(JSON.stringify({ saveVersion: 6, savedAt: 0, state: { ...g.state, resources: {}, earned: {}, earnedTotal: {} } }));
    old.state.anomaly = { id: 'famine' };
    old.state.anomaliesCompleted = { ascetic: true };
    delete old.state.anomalyBest;
    delete old.state.anomalyRecord;
    const { state } = deserialize(JSON.stringify(old));
    expect(state.anomaly).toEqual({ levels: { famine: 1 } });
    expect(state.anomalyBest).toEqual({ ascetic: 1 });
    expect(state.anomalyRecord).toBe(1);
  });
});
