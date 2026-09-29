import { D, type Decimal } from '../num';
import { creatureModifiers, effectiveStats } from '../creatures';
import { produce } from '../resources';
import type { GameContext } from '../context';
import type { System } from './types';
import type { BuildingDef } from '../content/types';
import type { Creature } from '../state';

/**
 * Rates only change when something calls `ctx.invalidate()` (new modifier
 * set), so they are cached per modifier set – offline catch-up stays cheap.
 */
const rateCache = new WeakMap<object, Record<string, Decimal>>();

/** Production per second for every resource (buildings + flat `production.*` bonuses). */
export function productionRates(ctx: GameContext): Record<string, Decimal> {
  const mods = ctx.mods();
  const cached = rateCache.get(mods);
  if (cached) return cached;
  const rates = computeRates(ctx);
  rateCache.set(mods, rates);
  return rates;
}

/** True when the creature's element has a type advantage in this building. */
export function hasAffinity(ctx: GameContext, b: BuildingDef, c: Creature): boolean {
  return b.elements.includes(ctx.content.species.get(c.speciesId).element);
}

/** Output factor from the type advantage (1 without). */
export function affinityFactor(ctx: GameContext, b: BuildingDef, c: Creature): number {
  return hasAffinity(ctx, b, c) ? 1 + ctx.balance.production.affinityBonus : 1;
}

/**
 * What one creature adds to a building's resource before global `production.*`
 * modifiers: work stat, type advantage and element bonuses.
 */
export function workerBase(ctx: GameContext, b: BuildingDef, c: Creature): number {
  const stat = effectiveStats(ctx, c)[b.workStat] ?? 0;
  const element = ctx.content.species.get(c.speciesId).element;
  const perCreature = b.baseRate * (1 + stat * ctx.balance.production.statScaling) * affinityFactor(ctx, b, c) * ctx.mods().factor(`element.${element}.production`);
  // Job-scoped abilities / creature buffs targeting this resource.
  const own = creatureModifiers(ctx, c).apply(`production.${b.produces}`, perCreature) - perCreature;
  return perCreature + own;
}

/** Base (before global modifiers) of everything producing `resource`, optionally without one creature. */
function resourceBase(ctx: GameContext, resource: string, without?: number): number {
  let total = 0;
  for (const b of ctx.content.buildings.list) {
    if (b.produces !== resource || !ctx.state.features[b.feature]) continue;
    for (const c of ctx.state.creatures) {
      if (c.id !== without && c.job?.kind === 'building' && c.job.target === b.id) total += workerBase(ctx, b, c);
    }
  }
  return total;
}

/** A worker's share of its building's output per second (0 when not working in a building). */
export function workerRate(ctx: GameContext, c: Creature): Decimal {
  if (c.job?.kind !== 'building' || !ctx.content.buildings.has(c.job.target)) return D(0);
  const b = ctx.content.buildings.get(c.job.target);
  const total = resourceBase(ctx, b.produces);
  const rate = productionRates(ctx)[b.produces] ?? D(0);
  return total > 0 ? rate.mul(workerBase(ctx, b, c) / total) : D(0);
}

/**
 * How much more of the building's resource per second this creature would
 * bring if it worked there (moving it from another building of the same
 * resource counts only the difference).
 */
export function assignGain(ctx: GameContext, buildingId: string, c: Creature): Decimal {
  const b = ctx.content.buildings.get(buildingId);
  const mods = ctx.mods();
  const now = resourceBase(ctx, b.produces);
  const after = resourceBase(ctx, b.produces, c.id) + workerBase(ctx, b, c);
  return mods.applyD(`production.${b.produces}`, after).sub(mods.applyD(`production.${b.produces}`, now)).max(0);
}

function computeRates(ctx: GameContext): Record<string, Decimal> {
  const { content, state } = ctx;
  const mods = ctx.mods();
  const base: Record<string, number> = {};

  for (const b of content.buildings.list) {
    if (!state.features[b.feature]) continue;
    for (const c of state.creatures) {
      if (c.job?.kind !== 'building' || c.job.target !== b.id) continue;
      base[b.produces] = (base[b.produces] ?? 0) + workerBase(ctx, b, c);
    }
  }

  const rates: Record<string, Decimal> = {};
  for (const r of content.resources.list) {
    const rate = mods.applyD(`production.${r.id}`, base[r.id] ?? 0);
    if (rate.gt(0)) rates[r.id] = rate;
  }
  return rates;
}

export const productionSystem: System = {
  id: 'production',
  update(ctx, dtMs) {
    const seconds = dtMs / 1000;
    for (const [res, rate] of Object.entries(productionRates(ctx))) produce(ctx, res, rate.mul(seconds));
  },
};

export function jobSlots(ctx: GameContext, buildingId: string): number {
  const b = ctx.content.buildings.get(buildingId);
  return Math.floor(ctx.mods().apply(`slots.${b.id}`, b.baseSlots));
}

export function jobCount(ctx: GameContext, buildingId: string): number {
  return ctx.state.creatures.filter((c) => c.job?.kind === 'building' && c.job.target === buildingId).length;
}

