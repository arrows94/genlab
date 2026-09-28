import { describe, expect, it } from 'vitest';
import { assignJob } from '@core/actions';
import { claimDaily, dailyAvailable, dailyReward, dailySteps, nextDailyAt } from '@core/features/daily';
import { contractDay } from '@core/features/contracts';
import { missingAlleles } from '@core/genetics';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const DAY = 86_400_000;

function dailyGame() {
  const g = makeGame();
  unlockFeature(g, 'farm');
  unlockFeature(g, 'daily');
  expect(assignJob(g, g.state.creatures[0]!.id, 'farm').ok).toBe(true);
  return g;
}

describe('Tagesbelohnung', () => {
  it('unlocks with the breeding station', () => {
    expect(content.features.get('daily').condition).toEqual({ type: 'feature', feature: 'breeding' });
    const g = makeGame();
    expect(dailyAvailable(g)).toBe(false);
    expect(claimDaily(g).ok).toBe(false);
  });

  it('can be claimed once per day', () => {
    const g = dailyGame();
    const food = g.state.resources.food?.toNumber() ?? 0;
    expect(dailyAvailable(g, NOW)).toBe(true);
    expect(claimDaily(g, NOW).ok).toBe(true);
    expect(g.state.resources.food!.toNumber()).toBeGreaterThan(food);
    expect(g.state.daily).toEqual({ day: contractDay(g, NOW), step: 1, claimed: 1 });
    expect(claimDaily(g, NOW + 60_000).ok).toBe(false);
    expect(nextDailyAt(g, NOW)).toBeGreaterThan(NOW);
    expect(claimDaily(g, nextDailyAt(g, NOW)).ok).toBe(true);
  });

  it('a break costs nothing: the calendar waits', () => {
    const g = dailyGame();
    expect(claimDaily(g, NOW).ok).toBe(true);
    expect(claimDaily(g, NOW + DAY).ok).toBe(true);
    // Five days away – the next claim continues with step 3.
    expect(claimDaily(g, NOW + 7 * DAY).ok).toBe(true);
    expect(g.state.daily.step).toBe(3);
  });

  it('grows with production and ends the week with a gene sample', () => {
    const g = dailyGame();
    const small = dailyReward(g, 0).amounts.food!.toNumber();
    g.state.upgrades.fertileSoil = 5;
    g.invalidate();
    expect(dailyReward(g, 0).amounts.food!.toNumber()).toBeGreaterThan(small);

    const missing = missingAlleles(g).length;
    for (let d = 0; d < dailySteps(g); d++) expect(claimDaily(g, NOW + d * DAY).ok).toBe(true);
    expect(missingAlleles(g).length).toBe(missing - 1);
    expect(g.state.daily.step).toBe(0);
    expect(g.state.daily.claimed).toBe(dailySteps(g));
  });

  it('only uses known resources and loads old saves', () => {
    for (const r of balance.daily.rewards) for (const res of Object.keys(r.resources ?? {})) expect(content.resources.has(res), res).toBe(true);
    const json = JSON.parse(serialize(makeGame().state, NOW));
    delete json.state.daily;
    expect(deserialize(JSON.stringify(json)).state.daily).toEqual({ day: -1, step: 0, claimed: 0 });
  });
});
