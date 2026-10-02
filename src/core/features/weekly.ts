import { hashSeed } from '../rng';
import type { WeeklyMutationDef } from '../content/types';
import type { GameContext } from '../context';
import type { ModifierProvider } from '../providers';
import type { System } from '../systems/types';

/**
 * Weekly mutation: a date-based seed picks one rule change per week. No
 * server needed – the week is derived from the wall clock (Monday start, UTC).
 */
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function weekIndex(epochIso: string, nowMs: number): number {
  const epoch = Date.parse(`${epochIso}T00:00:00Z`);
  return Math.floor((nowMs - epoch) / WEEK_MS);
}

export function mutationForWeek(list: readonly WeeklyMutationDef[], week: number): WeeklyMutationDef | null {
  if (list.length === 0) return null;
  return list[hashSeed(`genlab-week-${week}`) % list.length] ?? null;
}

export function activeMutation(ctx: GameContext, nowMs = ctx.state.lastTickAt): WeeklyMutationDef | null {
  if (!ctx.state.features['weekly']) return null;
  return mutationForWeek(ctx.content.weeklyMutations.list, weekIndex(ctx.balance.weekly.epoch, nowMs));
}

/** Next week's mutation – shown in advance so players can plan for it. */
export function upcomingMutation(ctx: GameContext, nowMs = ctx.state.lastTickAt): WeeklyMutationDef | null {
  if (!ctx.state.features['weekly']) return null;
  return mutationForWeek(ctx.content.weeklyMutations.list, weekIndex(ctx.balance.weekly.epoch, nowMs) + 1);
}

/** Start of the next week (for the countdown in the UI). */
export function nextWeekStart(ctx: GameContext, nowMs: number): number {
  const epoch = Date.parse(`${ctx.balance.weekly.epoch}T00:00:00Z`);
  return epoch + (weekIndex(ctx.balance.weekly.epoch, nowMs) + 1) * WEEK_MS;
}

export const weeklyProvider: ModifierProvider = (ctx, into) => {
  const m = activeMutation(ctx);
  if (m) into.addAll(`weekly:${m.id}`, m.modifiers);
};

/** Week each game last saw; the cached modifiers must follow the mutation when the week turns. */
const seenWeek = new WeakMap<GameContext, number>();

export const weeklySystem: System = {
  id: 'weekly',
  update(ctx) {
    if (!ctx.state.features['weekly']) return;
    const week = weekIndex(ctx.balance.weekly.epoch, ctx.state.lastTickAt);
    const seen = seenWeek.get(ctx);
    if (seen !== undefined && seen !== week) ctx.invalidate();
    seenWeek.set(ctx, week);
  },
};
