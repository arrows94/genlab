import { describe, expect, it } from 'vitest';
import { attackWeeklyBoss, bossDefeated, bossFighter, lowerRecordAndBoss, refreshWeeklyBoss, unusedAttacksText } from '@core/features/weeklyBoss';
import { voyageDestination } from '@core/features/voyage';
import { checkpoint, enemyFor, fightNextFloor, setTeam, towerMilestones } from '@core/features/tower';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const DAY = 86_400_000;

/** KP of a floor's normal enemy (without boss or Wächter multipliers) – what the titan is built from. */
function normalHp(g: ReturnType<typeof makeGame>, floor: number): number {
  return enemyFor(g, floor, { plain: true }).maxHp;
}

function bossGame() {
  const g = makeGame();
  unlockFeature(g, 'tower');
  g.state.tower.best = 60;
  unlockFeature(g, 'weeklyBoss');
  expect(setTeam(g, [g.state.creatures[0]!.id]).ok).toBe(true);
  refreshWeeklyBoss(g, NOW);
  return g;
}

describe('Wochen-Boss', () => {
  it('appears at its minimum tower floor', () => {
    expect(content.features.get('weeklyBoss').condition).toEqual({ type: 'towerFloor', floor: balance.weeklyBoss.minFloor });
    const g = makeGame();
    expect(attackWeeklyBoss(g).ok).toBe(false);
  });

  it('shares the week element with the voyage and follows the tower record', () => {
    const g = bossGame();
    const b = g.state.weeklyBoss;
    expect(b.element).toBe(voyageDestination(g, NOW).element);
    expect(content.species.get(b.species).element).toBe(b.element);
    expect(b.floor).toBe(60);
    expect(b.maxHp).toBe(Math.round(normalHp(g, 60) * balance.weeklyBoss.hpMult));
    expect(b.attempts).toBe(balance.weeklyBoss.attemptsPerDay);
  });

  it('grows smoothly with the record (no jump on boss floors) and uses no technique', () => {
    const g = bossGame();
    const hpAt = (best: number) => {
      g.state.tower.best = best;
      g.state.weeklyBoss.week = -1;
      refreshWeeklyBoss(g, NOW);
      return g.state.weeklyBoss.maxHp;
    };
    const [a, b, c] = [hpAt(119), hpAt(120), hpAt(121)];
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(b / a).toBeCloseTo(balance.tower.enemyGrowth, 1);
    g.state.tower.best = 120;
    g.state.weeklyBoss.week = -1;
    refreshWeeklyBoss(g, NOW);
    const titan = bossFighter(g);
    expect(titan.technique).toBeUndefined();
    expect(titan.atk).toBe(Math.round(enemyFor(g, 120, { plain: true }).atk * balance.weeklyBoss.atkMult));
    // A Wächter record does not make it jump either.
    expect(hpAt(balance.tower.guardEvery * 4) / hpAt(balance.tower.guardEvery * 4 - 1)).toBeCloseTo(balance.tower.enemyGrowth, 1);
  });

  it('reminds of unused attacks before a reset', () => {
    const g = bossGame();
    expect(unusedAttacksText(g)).toContain(`${balance.weeklyBoss.attemptsPerDay} Angriffe`);
    g.state.weeklyBoss.attempts = 1;
    expect(unusedAttacksText(g)).toContain('einen Angriff');
    g.state.weeklyBoss.attempts = 0;
    expect(unusedAttacksText(g)).toBe('');
    g.state.weeklyBoss.attempts = 2;
    g.state.tower.team = [];
    expect(unusedAttacksText(g)).toBe('');
  });

  it('adds up damage over attempts and pays tiers once', () => {
    const g = bossGame();
    const b = g.state.weeklyBoss;
    g.state.creatures[0]!.stats = { hp: 1e6, atk: 5, def: 1e3, spd: 50 };
    g.invalidate();
    expect(attackWeeklyBoss(g).ok).toBe(true);
    const first = b.damage;
    expect(first).toBeGreaterThan(0);
    expect(b.last?.damage).toBe(first);
    expect(attackWeeklyBoss(g).ok).toBe(true);
    expect(b.damage).toBeGreaterThan(first);
    expect(b.attempts).toBe(balance.weeklyBoss.attemptsPerDay - 2);
    expect(bossDefeated(g)).toBe(false);

    // A huge hit finishes the boss: every tier pays once, no further attempts.
    g.state.creatures[0]!.stats = { hp: 1e9, atk: 1e12, def: 1e9, spd: 50 };
    g.invalidate();
    const tokens = g.state.resources.towerTokens?.toNumber() ?? 0;
    expect(attackWeeklyBoss(g).ok).toBe(true);
    expect(bossDefeated(g)).toBe(true);
    expect(b.damage).toBe(b.maxHp);
    expect(b.tiers).toBe(balance.weeklyBoss.tiers.length);
    const total = balance.weeklyBoss.tiers.reduce((n, t) => n + (t.rewards.towerTokens ?? 0), 0);
    expect(g.state.resources.towerTokens!.toNumber() - tokens).toBe(total);
    expect(attackWeeklyBoss(g).ok).toBe(false);
  });

  it('refills attempts daily up to a cap; a new week brings a new boss', () => {
    const g = bossGame();
    const b = g.state.weeklyBoss;
    b.attempts = 0;
    refreshWeeklyBoss(g, NOW + DAY);
    expect(b.attempts).toBe(balance.weeklyBoss.attemptsPerDay);
    refreshWeeklyBoss(g, NOW + 2 * DAY);
    refreshWeeklyBoss(g, NOW + 3 * DAY);
    expect(b.attempts).toBe(balance.weeklyBoss.maxAttempts);
    b.damage = 123;
    const week = b.week;
    refreshWeeklyBoss(g, NOW + 8 * DAY);
    expect(b.week).toBeGreaterThan(week);
    expect(b.damage).toBe(0);
  });

  it('counts every missed day, up to the cap', () => {
    const g = bossGame();
    const b = g.state.weeklyBoss;
    b.attempts = 0;
    refreshWeeklyBoss(g, NOW + 2 * DAY);
    expect(b.attempts).toBe(Math.min(balance.weeklyBoss.maxAttempts, 2 * balance.weeklyBoss.attemptsPerDay));
  });

  it('needs a tower team and survives a save', () => {
    const g = bossGame();
    g.state.tower.team = [];
    expect(attackWeeklyBoss(g).ok).toBe(false);
    const json = JSON.parse(serialize(makeGame().state, NOW));
    delete json.state.weeklyBoss;
    expect(deserialize(JSON.stringify(json)).state.weeklyBoss.week).toBe(-1);
  });
});

describe('Turm-Rekord senken (Hilfe für festgefahrene Spielstände)', () => {
  it('lowers the record and adapts this week’s boss, keeping the damage share', () => {
    const g = bossGame();
    g.state.tower.best = 120;
    g.state.weeklyBoss.week = -1;
    refreshWeeklyBoss(g, NOW);
    const b = g.state.weeklyBoss;
    b.damage = Math.round(b.maxHp * 0.3);
    b.tiers = 1;
    const oldMax = b.maxHp;
    expect(lowerRecordAndBoss(g, 30).ok).toBe(true);
    expect(g.state.tower.best).toBe(30);
    expect(g.state.tower.bestEver).toBe(120);
    expect(b.floor).toBe(Math.max(balance.weeklyBoss.minFloor, 30));
    expect(b.maxHp).toBeLessThan(oldMax);
    expect(b.maxHp).toBe(Math.round(normalHp(g, b.floor) * balance.weeklyBoss.hpMult));
    expect(b.damage / b.maxHp).toBeCloseTo(0.3, 2);
    expect(b.tiers).toBe(1);
    // Milestones and floor conditions follow the highest record ever.
    expect(towerMilestones(g)).toBe(Math.floor(120 / balance.tower.milestoneEvery));
    expect(checkpoint(g)).toBe(30);
  });

  it('does not shrink the titan below what the team reached in recent runs', () => {
    const g = bossGame();
    g.state.tower.best = 120;
    g.state.tower.history = [{ floor: 118, startFloor: 90, team: [], at: NOW }];
    g.state.weeklyBoss.week = -1;
    refreshWeeklyBoss(g, NOW);
    const b = g.state.weeklyBoss;
    expect(lowerRecordAndBoss(g, 30).ok).toBe(true);
    expect(g.state.tower.best).toBe(30);
    expect(b.floor).toBe(118);
    expect(b.maxHp).toBe(Math.round(normalHp(g, 118) * balance.weeklyBoss.hpMult));
    // A new week builds the titan from the recent runs too.
    refreshWeeklyBoss(g, NOW + 8 * DAY);
    expect(b.floor).toBe(118);
  });

  it('only lowers, never during a run, and pays first-time rewards only once', () => {
    const g = bossGame();
    const m = balance.tower.milestoneEvery;
    g.state.tower.best = m + 10;
    expect(lowerRecordAndBoss(g, m + 10).ok).toBe(false);
    expect(lowerRecordAndBoss(g, -1).ok).toBe(false);
    expect(lowerRecordAndBoss(g, m - 1).ok).toBe(true);
    // Clearing the milestone floor again is no new record: no second milestone shards.
    g.state.tower.run = { floor: m - 1, team: g.state.tower.team, elapsedMs: 0, startFloor: m };
    expect(lowerRecordAndBoss(g, 10).ok).toBe(false);
    const c = g.state.creatures[0]!;
    c.stats = { hp: 1e9, atk: 1e9, def: 1e9, spd: 1e9 };
    g.invalidate();
    const shards = g.state.resources.aeonShards?.toNumber() ?? 0;
    fightNextFloor(g);
    expect(g.state.tower.best).toBe(m);
    expect(g.state.resources.aeonShards?.toNumber() ?? 0).toBe(shards);
  });

  it('keeps the highest record across save and load', () => {
    const g = bossGame();
    g.state.tower.best = 80;
    lowerRecordAndBoss(g, 20);
    const { state } = deserialize(serialize(g.state));
    expect(state.tower.best).toBe(20);
    expect(state.tower.bestEver).toBe(80);
  });
});
