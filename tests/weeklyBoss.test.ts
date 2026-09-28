import { describe, expect, it } from 'vitest';
import { attackWeeklyBoss, bossDefeated, refreshWeeklyBoss } from '@core/features/weeklyBoss';
import { voyageDestination } from '@core/features/voyage';
import { enemyFor, setTeam } from '@core/features/tower';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const DAY = 86_400_000;

function bossGame() {
  const g = makeGame();
  unlockFeature(g, 'tower');
  g.state.tower.best = 20;
  unlockFeature(g, 'weeklyBoss');
  expect(setTeam(g, [g.state.creatures[0]!.id]).ok).toBe(true);
  refreshWeeklyBoss(g, NOW);
  return g;
}

describe('Wochen-Boss', () => {
  it('appears at tower floor 10', () => {
    expect(content.features.get('weeklyBoss').condition).toEqual({ type: 'towerFloor', floor: 10 });
    const g = makeGame();
    expect(attackWeeklyBoss(g).ok).toBe(false);
  });

  it('shares the week element with the voyage and follows the tower record', () => {
    const g = bossGame();
    const b = g.state.weeklyBoss;
    expect(b.element).toBe(voyageDestination(g, NOW).element);
    expect(content.species.get(b.species).element).toBe(b.element);
    expect(b.floor).toBe(20);
    expect(b.maxHp).toBe(Math.round(enemyFor(g, 20).maxHp * balance.weeklyBoss.hpMult));
    expect(b.attempts).toBe(balance.weeklyBoss.attemptsPerDay);
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

  it('needs a tower team and survives a save', () => {
    const g = bossGame();
    g.state.tower.team = [];
    expect(attackWeeklyBoss(g).ok).toBe(false);
    const json = JSON.parse(serialize(makeGame().state, NOW));
    delete json.state.weeklyBoss;
    expect(deserialize(JSON.stringify(json)).state.weeklyBoss.week).toBe(-1);
  });
});
