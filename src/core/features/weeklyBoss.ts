import { grant } from '../resources';
import { rewardAmounts } from '../rewards';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';
import { findCreature } from '../creatures';
import { contractDay } from './contracts';
import { damage, enemyFor, fighterFor, type Fighter } from './tower';
import { voyageDestination } from './voyage';
import { weekIndex } from './weekly';

/**
 * Wochen-Boss: one huge enemy per week in the Genom-Turm. Its element is
 * the week's element (same as the Wochenexpedition and the weekly mutation),
 * its strength follows the tower record. Each attempt is a long fight with
 * the tower team; the damage adds up over the week and pays out in tiers.
 * Attempts refill daily and can be saved up, so a day off costs nothing.
 */
const TIER_ORDER: Record<string, number> = { base: 0, hybrid: 1, rareHybrid: 2, mythic: 3 };

/** The strongest species of an element (a mythic form if there is one). */
function bossSpecies(ctx: GameContext, element: string): string {
  const list = ctx.content.species.list.filter((s) => s.element === element);
  const pool = list.length > 0 ? list : ctx.content.species.list;
  return [...pool].sort((a, b) => (TIER_ORDER[b.tier] ?? 0) - (TIER_ORDER[a.tier] ?? 0))[0]!.id;
}

/** Boss fighter for the current week (fresh HP for every attempt – only damage counts). */
export function bossFighter(ctx: GameContext): Fighter {
  const b = ctx.state.weeklyBoss;
  const base = enemyFor(ctx, b.floor);
  const cfg = ctx.balance.weeklyBoss;
  return {
    ...base,
    name: `Wochen-Titan: ${ctx.content.species.get(b.species).name}`,
    speciesId: b.species,
    element: b.element,
    hp: Infinity,
    maxHp: b.maxHp,
    atk: Math.round(base.atk * cfg.atkMult),
  };
}

/** New week → new boss; new day → more attempts. Runs every tick (cheap). */
export function refreshWeeklyBoss(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['weeklyBoss']) return;
  const b = ctx.state.weeklyBoss;
  const cfg = ctx.balance.weeklyBoss;
  const week = weekIndex(ctx.balance.weekly.epoch, nowMs);
  if (b.week !== week) {
    const element = voyageDestination(ctx, nowMs).element;
    const floor = Math.max(cfg.minFloor, ctx.state.tower.best);
    Object.assign(b, {
      week,
      element,
      species: bossSpecies(ctx, element),
      floor,
      maxHp: Math.round(enemyFor(ctx, floor).maxHp * cfg.hpMult),
      damage: 0,
      tiers: 0,
      last: null,
    });
  }
  const day = contractDay(ctx, nowMs);
  if (b.day !== day) {
    b.attempts = Math.min(cfg.maxAttempts, b.attempts + cfg.attemptsPerDay);
    b.day = day;
  }
}

export const weeklyBossSystem: System = {
  id: 'weeklyBoss',
  update(ctx) {
    refreshWeeklyBoss(ctx);
  },
};

function team(ctx: GameContext): Creature[] {
  return ctx.state.tower.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
}

export function bossDefeated(ctx: GameContext): boolean {
  const b = ctx.state.weeklyBoss;
  return b.maxHp > 0 && b.damage >= b.maxHp;
}

/** One attempt: the tower team fights for `rounds` rounds; all damage counts. */
export function attackWeeklyBoss(ctx: GameContext): ActionResult {
  if (!ctx.state.features['weeklyBoss']) return { ok: false, reason: 'Der Wochen-Boss ist noch nicht erschienen.' };
  refreshWeeklyBoss(ctx);
  const b = ctx.state.weeklyBoss;
  if (bossDefeated(ctx)) return { ok: false, reason: 'Der Wochen-Boss ist schon besiegt – nächste Woche kommt ein neuer.' };
  if (b.attempts < 1) return { ok: false, reason: 'Keine Angriffe mehr – morgen gibt es neue.' };
  const members = team(ctx);
  if (members.length === 0) return { ok: false, reason: 'Stelle zuerst ein Turm-Team zusammen.' };

  const fighters = members.map((c) => fighterFor(ctx, c));
  const boss = bossFighter(ctx);
  const order = [...fighters, boss].sort((x, y) => y.spd - x.spd);
  let dealt = 0;
  let rounds = 0;
  for (let round = 1; round <= ctx.balance.weeklyBoss.rounds && fighters.some((f) => f.hp > 0); round++) {
    rounds = round;
    for (const f of order) {
      if (f.hp <= 0) continue;
      if (f.team) dealt += damage(ctx, f, boss, ctx.rng);
      else {
        const alive = fighters.filter((x) => x.hp > 0);
        if (alive.length === 0) break;
        const target = ctx.rng.pick(alive);
        target.hp -= damage(ctx, f, target, ctx.rng);
      }
    }
  }
  const counted = Math.min(dealt, b.maxHp - b.damage);
  b.damage += counted;
  b.attempts--;
  b.last = { damage: counted, rounds };

  // Pay every tier the total damage has reached.
  const tiers = ctx.balance.weeklyBoss.tiers;
  while (b.tiers < tiers.length && b.damage >= tiers[b.tiers]!.at * b.maxHp) {
    for (const [res, amount] of Object.entries(rewardAmounts(ctx, { resources: tiers[b.tiers]!.rewards }))) grant(ctx, res, amount, 'weeklyBoss');
    b.tiers++;
  }
  ctx.bus.emit('weeklyBossHit', { damage: counted, total: b.damage, defeated: bossDefeated(ctx) });
  return { ok: true };
}
