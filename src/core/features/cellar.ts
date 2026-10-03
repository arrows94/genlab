import { grant } from '../resources';
import { findCreature, isOccupied } from '../creatures';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';
import { contractDay } from './contracts';
import { cellarCourse, courseCheckpoint, courseEnemies, courseFloorTokens, floorLabel } from './floors';
import { fighterFor, simulateFight, teamSize, type Fighter, type Row } from './tower';

/**
 * Genom-Keller: the counterpart of the tower, below it. A descent is one of a
 * few attempts per day: the team fights level after level (same fight engine
 * as the tower, `cellarCourse` for the foes) until it falls. Unlike the tower
 * the team does not heal between levels – the HP it keeps carries on
 * (Erschöpfung), only a rest vault every `restEvery` levels heals it. Each
 * descent starts at the last checkpoint below the record.
 */

const NOT_YET = 'Der Genom-Keller ist noch nicht freigeschaltet.';

/** Last checkpoint at or below the record – where the next descent starts. */
export function cellarCheckpoint(ctx: GameContext): number {
  return courseCheckpoint(cellarCourse(ctx), ctx.state.cellar.best);
}

/** „Ebene −12“. */
export function cellarLevelLabel(ctx: GameContext, level: number): string {
  return floorLabel(cellarCourse(ctx), level);
}

/** Wall-clock time per level in ms. */
export function cellarIntervalMs(ctx: GameContext): number {
  return Math.max(1000, ctx.balance.cellar.fightIntervalSec * 1000);
}

/** New contract day → more attempts; every day that passed counts, up to the stock limit (also offline). */
export function refreshCellarAttempts(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['cellar']) return;
  const ce = ctx.state.cellar;
  const day = contractDay(ctx, nowMs);
  if (ce.day === day) return;
  const cfg = ctx.balance.cellar;
  const days = ce.day < 0 ? 1 : Math.max(1, day - ce.day);
  ce.attempts = Math.min(cfg.maxAttempts, ce.attempts + cfg.attemptsPerDay * days);
  ce.day = day;
}

export function cellarRowOf(ctx: GameContext, creatureId: number): Row {
  return ctx.state.cellar.back.includes(creatureId) ? 'back' : 'front';
}

export function setCellarRow(ctx: GameContext, creatureId: number, row: Row): ActionResult {
  const ce = ctx.state.cellar;
  if (ce.run) return { ok: false, reason: 'Während eines Abstiegs nicht änderbar.' };
  if (!ce.team.includes(creatureId)) return { ok: false, reason: 'Die Kreatur ist nicht im Keller-Team.' };
  ce.back = ce.back.filter((id) => id !== creatureId);
  if (row === 'back') ce.back.push(creatureId);
  return { ok: true };
}

/** Same team size as the tower; a creature of the tower team cannot join (and the other way round). */
export function setCellarTeam(ctx: GameContext, ids: number[]): ActionResult {
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  const ce = ctx.state.cellar;
  if (ce.run) return { ok: false, reason: 'Während eines Abstiegs nicht änderbar.' };
  const unique = [...new Set(ids)].filter((id) => findCreature(ctx, id));
  if (unique.length > teamSize(ctx)) return { ok: false, reason: `Höchstens ${teamSize(ctx)} Kreaturen.` };
  const inTower = unique.map((id) => findCreature(ctx, id)!).find((c) => ctx.state.tower.team.includes(c.id));
  if (inTower) return { ok: false, reason: `${inTower.name} steht schon im Turm-Team.` };
  ce.team = unique;
  ce.back = ce.back.filter((id) => unique.includes(id));
  return { ok: true };
}

/** A team member as a cellar fighter: its tower values, its cellar row, and the HP share it still has. */
export function cellarFighter(ctx: GameContext, c: Creature, hpShare = 1): Fighter {
  const f = fighterFor(ctx, c);
  const hp = Math.max(1, Math.round(f.maxHp * Math.min(1, hpShare)));
  return { ...f, hp, row: cellarRowOf(ctx, c.id) };
}

/** Starts a descent from the checkpoint; costs one attempt. */
export function startCellarRun(ctx: GameContext): ActionResult {
  const ce = ctx.state.cellar;
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  if (ce.run) return { ok: false, reason: 'Es läuft bereits ein Abstieg.' };
  refreshCellarAttempts(ctx);
  if (ce.attempts < 1) return { ok: false, reason: 'Keine Abstiege mehr übrig – morgen gibt es neue.' };
  const team = ce.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return { ok: false, reason: 'Stelle zuerst ein Keller-Team zusammen.' };
  const busy = team.find(isOccupied);
  if (busy) return { ok: false, reason: `${busy.name} ist beschäftigt.` };
  for (const c of team) c.job = { kind: 'cellar', target: 'team' };
  ce.attempts -= 1;
  const start = cellarCheckpoint(ctx);
  ce.run = { level: start, team: team.map((c) => c.id), hp: team.map(() => 1), elapsedMs: 0, startLevel: start + 1 };
  ctx.invalidate();
  return { ok: true };
}

export function endCellarRun(ctx: GameContext): void {
  const ce = ctx.state.cellar;
  const run = ce.run;
  if (!run) return;
  for (const id of run.team) {
    const c = findCreature(ctx, id);
    if (c?.job?.kind === 'cellar') c.job = null;
  }
  const team = run.team.map((id) => findCreature(ctx, id)?.speciesId ?? '?');
  ce.history = [{ level: run.level, startLevel: run.startLevel, team, at: ctx.state.lastTickAt }, ...ce.history].slice(0, ctx.balance.cellar.historySize);
  ce.run = null;
  ctx.invalidate();
  ctx.bus.emit('cellarRunEnded', { level: run.level, startLevel: run.startLevel });
}

/** Gives up the running descent (the attempt stays used). */
export function stopCellarRun(ctx: GameContext): ActionResult {
  if (!ctx.state.cellar.run) return { ok: false, reason: 'Kein Abstieg aktiv.' };
  endCellarRun(ctx);
  return { ok: true };
}

/** Starts the next descent on its own while attempts are left. */
export function setCellarAuto(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  ctx.state.cellar.auto = enabled;
  return { ok: true };
}

/** Fights the next level of the running descent (`replay`: keep the events for the arena). */
export function fightNextCellarLevel(ctx: GameContext, replay = true): void {
  const ce = ctx.state.cellar;
  const run = ce.run;
  if (!run) return;
  // Fallen team members (HP share 0) and creatures that are gone sit the rest of the descent out.
  const standing = run.team
    .map((id, i) => ({ c: findCreature(ctx, id), i }))
    .filter((m): m is { c: Creature; i: number } => !!m.c && (run.hp[m.i] ?? 0) > 0);
  if (standing.length === 0) return endCellarRun(ctx);
  const level = run.level + 1;
  const fighters = standing.map((m) => cellarFighter(ctx, m.c, run.hp[m.i]));
  const result = simulateFight(ctx, fighters, courseEnemies(ctx, cellarCourse(ctx), level), ctx.rng, { replay });
  ce.lastResult = { floor: level, win: result.win, log: result.log, fighters: result.fighters, events: result.events, stats: result.stats, at: ctx.state.lastTickAt };
  if (!result.win) {
    ctx.bus.emit('cellarLevel', { level, win: false, rewards: {}, rest: false });
    endCellarRun(ctx);
    return;
  }
  // Erschöpfung: what is left of each fighter's HP carries into the next level.
  standing.forEach((m, k) => {
    run.hp[m.i] = Math.max(0, result.stats.hpLeft[k] ?? 0) / Math.max(1, fighters[k]!.maxHp);
  });
  run.level = level;
  ce.best = Math.max(ce.best, level);
  const cfg = ctx.balance.cellar;
  const rest = cfg.restEvery > 0 && level % cfg.restEvery === 0;
  // A rest vault: everyone heals, the fallen get up again.
  if (rest) run.hp = run.hp.map((share) => Math.min(1, share + cfg.restHeal));
  const rewards = { towerTokens: courseFloorTokens(cellarCourse(ctx), level) };
  for (const [res, v] of Object.entries(rewards)) grant(ctx, res, v, 'cellar');
  ctx.bus.emit('cellarLevel', { level, win: true, rewards, rest });
}

export const cellarSystem: System = {
  id: 'cellar',
  update(ctx, dtMs) {
    if (!ctx.state.features['cellar']) return;
    refreshCellarAttempts(ctx);
    const ce = ctx.state.cellar;
    if (!ce.run) {
      if (ce.auto && ce.attempts >= 1 && ce.team.length > 0) startCellarRun(ctx);
      if (!ce.run) return;
    }
    const interval = cellarIntervalMs(ctx);
    ce.run.elapsedMs += dtMs;
    while (ce.run && ce.run.elapsedMs >= interval) {
      ce.run.elapsedMs -= interval;
      // A long step (offline) fights many levels at once: only the last one is replayed in the arena.
      fightNextCellarLevel(ctx, ce.run.elapsedMs < interval);
    }
  },
};
