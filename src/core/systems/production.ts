import { type Decimal } from '../num';
import { creatureModifiers, effectiveStats } from '../creatures';
import { produce } from '../resources';
import type { GameContext } from '../context';
import type { System } from './types';

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

function computeRates(ctx: GameContext): Record<string, Decimal> {
  const { content, state, balance } = ctx;
  const mods = ctx.mods();
  const base: Record<string, number> = {};

  for (const b of content.buildings.list) {
    if (!state.features[b.feature]) continue;
    for (const c of state.creatures) {
      if (c.job?.kind !== 'building' || c.job.target !== b.id) continue;
      const stat = effectiveStats(ctx, c)[b.workStat] ?? 0;
      const perCreature = b.baseRate * (1 + stat * balance.production.statScaling);
      // Job-scoped abilities / creature buffs targeting this resource.
      const own = creatureModifiers(ctx, c).apply(`production.${b.produces}`, perCreature) - perCreature;
      base[b.produces] = (base[b.produces] ?? 0) + perCreature + own;
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

