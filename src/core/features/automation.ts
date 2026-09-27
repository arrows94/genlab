import { assignJob } from '../actions';
import { effectiveStats, creaturePower } from '../creatures';
import { canAfford } from '../costs';
import { jobCount, jobSlots } from '../systems/production';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';
import { breedingCost, eggs, nestSlots, offspringGeneration, startBreeding } from './breeding';
import { stableFree } from './stable';

/**
 * Automation (unlockable): auto-assign jobs by best fit and auto-breeding
 * by a rule. Runs as a system every `automation.intervalSec`, so it also
 * works during offline progress.
 */

/** Rule ids for auto-breeding: "power" (sum of stats) or a stat id. */
export function breedRuleScore(ctx: GameContext, c: Creature, rule: string): number {
  return rule === 'power' ? creaturePower(ctx, c) : (effectiveStats(ctx, c)[rule] ?? 0);
}

/**
 * Fills every unlocked building with the best available creatures for its
 * work stat. Only idle or already working creatures are moved.
 */
export function autoAssign(ctx: GameContext): ActionResult {
  if (!ctx.state.features['autoAssign']) return { ok: false, reason: 'Der Arbeitsplaner ist noch nicht freigeschaltet.' };
  const pool = ctx.state.creatures.filter((c) => c.job === null || c.job.kind === 'building');
  for (const c of pool) c.job = null;
  ctx.invalidate();
  const buildings = ctx.content.buildings.list.filter((b) => ctx.state.features[b.feature]);
  const stats = new Map(pool.map((c) => [c.id, effectiveStats(ctx, c)]));
  // Buildings with fewer slots first, so scarce places get the specialists.
  for (const b of [...buildings].sort((x, y) => jobSlots(ctx, x.id) - jobSlots(ctx, y.id))) {
    const free = pool.filter((c) => c.job === null).sort((x, y) => (stats.get(y.id)![b.workStat] ?? 0) - (stats.get(x.id)![b.workStat] ?? 0));
    for (const c of free) {
      if (jobCount(ctx, b.id) >= jobSlots(ctx, b.id)) break;
      assignJob(ctx, c.id, b.id);
    }
  }
  return { ok: true };
}

/** Picks the two best available creatures for the rule and breeds them if possible. */
export function autoBreedOnce(ctx: GameContext): boolean {
  const cfg = ctx.state.automation.autoBreed;
  if (eggs(ctx).length >= nestSlots(ctx) || stableFree(ctx) <= 0) return false;
  const pool = ctx.state.creatures
    .filter((c) => (c.job === null || c.job.kind === 'building') && (!cfg.species || c.speciesId === cfg.species))
    .sort((a, b) => breedRuleScore(ctx, b, cfg.rule) - breedRuleScore(ctx, a, cfg.rule));
  const [a, b] = pool;
  if (!a || !b || !canAfford(ctx.state, breedingCost(ctx, offspringGeneration(a, b)))) return false;
  return startBreeding(ctx, a.id, b.id).ok;
}

export function setAutoAssign(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['autoAssign']) return { ok: false, reason: 'Der Arbeitsplaner ist noch nicht freigeschaltet.' };
  ctx.state.automation.autoAssign = enabled;
  return { ok: true };
}

export function setAutoBreed(ctx: GameContext, enabled: boolean, rule = 'power', species: string | null = null): ActionResult {
  if (!ctx.state.features['autoBreed']) return { ok: false, reason: 'Der Zuchtautomat ist noch nicht freigeschaltet.' };
  if (rule !== 'power' && !ctx.content.stats.has(rule)) return { ok: false, reason: 'Unbekannte Regel.' };
  if (species && !ctx.content.species.has(species)) return { ok: false, reason: 'Unbekannte Art.' };
  ctx.state.automation.autoBreed = { enabled, rule, species };
  return { ok: true };
}

export const automationSystem: System = {
  id: 'automation',
  update(ctx) {
    const a = ctx.state.automation;
    if (ctx.state.simTimeMs - a.lastRunMs < ctx.balance.automation.intervalSec * 1000) return;
    a.lastRunMs = ctx.state.simTimeMs;
    if (a.autoBreed.enabled && ctx.state.features['autoBreed']) autoBreedOnce(ctx);
    if (a.autoAssign && ctx.state.features['autoAssign']) autoAssign(ctx);
  },
};
