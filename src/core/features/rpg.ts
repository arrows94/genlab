import { D } from '../num';
import { effectiveStats, findCreature } from '../creatures';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature, RpgRun } from '../state';
import type { System } from '../systems/types';
import { isBeingSequenced } from './sequencing';

/**
 * GenLab RPG: a single monster goes into a dungeon alone. Unlike the rest of
 * the game it is played actively and turn by turn. Runs cost a Fackel; the
 * Fackeln come back by the real clock up to a small stock, so the dungeon
 * cannot be spammed and a day off costs nothing.
 */

const HOUR = 3_600_000;

export function torches(ctx: GameContext): number {
  return Math.floor((ctx.state.resources['torches'] ?? D(0)).toNumber());
}

/** Wall clock of the next Fackel (null while the stock is full or the RPG is locked). */
export function nextTorchAt(ctx: GameContext): number | null {
  const at = ctx.state.rpg.torchAt;
  if (!ctx.state.features['rpg'] || at <= 0) return null;
  return at + ctx.balance.rpg.torchHours * HOUR;
}

/**
 * Refills Fackeln by the real clock: one every `torchHours` below the stock
 * limit. The first call after the unlock fills the stock once.
 */
export function refreshTorches(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['rpg']) return;
  const r = ctx.state.rpg;
  const cfg = ctx.balance.rpg;
  const have = torches(ctx);
  if (r.torchAt < 0) {
    grant(ctx, 'torches', Math.max(0, cfg.maxTorches - have), 'rpg:torch');
    r.torchAt = 0;
    return;
  }
  if (have >= cfg.maxTorches) {
    r.torchAt = 0;
    return;
  }
  if (r.torchAt === 0) {
    r.torchAt = nowMs;
    return;
  }
  const interval = cfg.torchHours * HOUR;
  const ready = Math.floor((nowMs - r.torchAt) / interval);
  if (ready <= 0) return;
  const add = Math.min(ready, cfg.maxTorches - have);
  grant(ctx, 'torches', add, 'rpg:torch');
  r.torchAt = have + add >= cfg.maxTorches ? 0 : r.torchAt + ready * interval;
}

export const rpgSystem: System = {
  id: 'rpg',
  update(ctx) {
    refreshTorches(ctx);
  },
};

// ---- Lauf ---------------------------------------------------------------------

export function rpgRun(ctx: GameContext): RpgRun | null {
  return ctx.state.rpg.run;
}

/** The monster of the running run. */
export function rpgHero(ctx: GameContext): Creature | null {
  const run = ctx.state.rpg.run;
  return run ? findCreature(ctx, run.creatureId) ?? null : null;
}

/** Max HP of a monster in the dungeon (from its bred stats). */
export function rpgMaxHp(ctx: GameContext, c: Creature): number {
  return Math.max(1, effectiveStats(ctx, c)['hp'] ?? 1);
}

/** Why a monster cannot enter the dungeon (null = it can). */
export function rpgStartBlocker(ctx: GameContext, c: Creature): string | null {
  if (c.job && c.job.kind !== 'building') return `${c.name} ist beschäftigt.`;
  if (isBeingSequenced(ctx, c.id)) return `${c.name} wird gerade sequenziert.`;
  return null;
}

/** Starts a run with one monster for one Fackel. A monster at work leaves its building. */
export function startRpgRun(ctx: GameContext, creatureId: number): ActionResult {
  if (!ctx.state.features['rpg']) return { ok: false, reason: 'Das GenLab RPG ist noch nicht freigeschaltet.' };
  const r = ctx.state.rpg;
  if (r.run) return { ok: false, reason: 'Es läuft bereits ein Lauf.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const blocker = rpgStartBlocker(ctx, c);
  if (blocker) return { ok: false, reason: blocker };
  if (torches(ctx) < 1) return { ok: false, reason: 'Keine Fackel mehr – die nächste kommt bald.' };
  ctx.state.resources['torches'] = (ctx.state.resources['torches'] ?? D(0)).sub(1);
  if (r.torchAt === 0) r.torchAt = ctx.state.lastTickAt;
  c.job = { kind: 'rpg', target: 'run' };
  ctx.invalidate();
  r.run = { creatureId: c.id, hp: rpgMaxHp(ctx, c), level: 1, xp: 0, depth: 0, loot: {}, secured: {}, startedAt: ctx.state.lastTickAt };
  r.runs++;
  return { ok: true };
}

function addLoot(into: Record<string, number>, from: Record<string, number>, share = 1): void {
  for (const [res, amount] of Object.entries(from)) {
    const v = Math.floor(amount * share);
    if (v > 0) into[res] = (into[res] ?? 0) + v;
  }
}

function payOut(ctx: GameContext, loot: Record<string, number>): void {
  for (const [res, amount] of Object.entries(loot)) grant(ctx, res, amount, 'rpg');
}

/** Makes the carried loot safe (rest points): it is paid out at once. */
export function secureLoot(ctx: GameContext): void {
  const run = ctx.state.rpg.run;
  if (!run) return;
  payOut(ctx, run.loot);
  addLoot(run.secured, run.loot);
  run.loot = {};
}

/**
 * Ends the run. Leaving (win) brings all carried loot home, a defeat keeps
 * `defeatKeep` of it. Secured loot was paid out already.
 */
export function finishRpgRun(ctx: GameContext, win: boolean): void {
  const r = ctx.state.rpg;
  const run = r.run;
  if (!run) return;
  const kept: Record<string, number> = {};
  addLoot(kept, run.loot, win ? 1 : ctx.balance.rpg.defeatKeep);
  payOut(ctx, kept);
  const total: Record<string, number> = { ...run.secured };
  addLoot(total, kept);
  const c = findCreature(ctx, run.creatureId);
  if (c?.job?.kind === 'rpg') c.job = null;
  r.lastResult = { win, depth: run.depth, level: run.level, loot: total, at: ctx.state.lastTickAt };
  r.run = null;
  ctx.invalidate();
}

/** The player leaves the dungeon with everything carried. */
export function leaveRpgRun(ctx: GameContext): ActionResult {
  if (!ctx.state.rpg.run) return { ok: false, reason: 'Es läuft kein Lauf.' };
  finishRpgRun(ctx, true);
  return { ok: true };
}
