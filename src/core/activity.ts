import type { GameContext } from './context';

/**
 * Active play time: real time the player spends with the game in front of
 * them (tab visible, input within `balance.activity.idleSec`). The UI decides
 * what counts as active and reports it here; offline catch-up never counts.
 * Kept in the save (statistics `activeMs`, `sessions`, `record.session`), so
 * it follows the player across devices.
 */

/** Milestone ids that stamp the active time when first reached. */
export type MilestoneKey = `feature:${string}` | `achievement:${string}` | `tower:${number}`;

/** Adds `dtMs` of active play at wall clock `now`; a long pause starts a new session. */
export function noteActive(ctx: GameContext, dtMs: number, now: number): void {
  if (dtMs <= 0) return;
  const s = ctx.state.statistics;
  const a = ctx.state.activity;
  const ms = Math.min(dtMs, ctx.balance.activity.maxTickSec * 1000);
  if (a.lastActiveAt === 0 || now - a.lastActiveAt > ctx.balance.activity.sessionGapSec * 1000) {
    s['sessions'] = (s['sessions'] ?? 0) + 1;
    a.sessionMs = 0;
  }
  a.lastActiveAt = now;
  a.sessionMs += ms;
  s['activeMs'] = (s['activeMs'] ?? 0) + ms;
  if (a.sessionMs > (s['record.session'] ?? 0)) s['record.session'] = a.sessionMs;
}

/** Stamps a milestone the first time it is reached (active and total play time). */
export function stampMilestone(ctx: GameContext, key: MilestoneKey): void {
  const m = ctx.state.milestones;
  if (m[key]) return;
  m[key] = { activeMs: ctx.state.statistics['activeMs'] ?? 0, simMs: ctx.state.simTimeMs };
}
