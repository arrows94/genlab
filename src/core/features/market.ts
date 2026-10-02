import { D } from '../num';
import { findCreature } from '../creatures';
import { spend } from '../resources';
import { scaleCost, type Cost } from '../costs';
import { addBuff } from '../systems/buffs';
import { skipProcessTime } from '../systems/processes';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import { ruleActive } from './anomalies';
import { productionRates } from '../systems/production';

/** Highest permanent boost per stat (Kraftfutter cap); other sources (voyage) respect it too. */
export function maxStatBoost(ctx: GameContext): number {
  const feed = ctx.content.potions.list.find((p) => p.kind === 'permanentStat');
  return ctx.balance.market.maxBoostsPerStat * (feed?.statBonus ?? 0);
}

/** Zeittränke drunk within the price window (older ones no longer count). */
export function recentTimeSkips(ctx: GameContext): number {
  const since = ctx.state.lastTickAt - ctx.balance.market.timeSkipWindowHours * 3_600_000;
  return ctx.state.timeSkips.filter((t) => t > since).length;
}

export function potionCost(ctx: GameContext, potionId: string, creatureId: number | null = null): Cost {
  const def = ctx.content.potions.get(potionId);
  const discount = ctx.mods().factor('cost.potion');
  let growth = D(1);
  if (def.kind === 'permanentStat' && creatureId !== null) {
    const c = findCreature(ctx, creatureId);
    growth = D(def.costGrowth ?? 1).pow(c?.boostUses ?? 0);
  }
  // Zeittrank: every further one within the window costs more.
  if (def.kind === 'timeSkip') growth = D(ctx.balance.market.timeSkipGrowth).pow(recentTimeSkips(ctx));
  if (def.costMinutes) {
    // Follows production, so the potion stays a real choice late in the game.
    const cost: Cost = {};
    for (const [res, base] of Object.entries(def.cost)) {
      const perMinutes = (productionRates(ctx)[res] ?? D(0)).mul(60 * def.costMinutes);
      cost[res] = D(base).max(perMinutes).mul(growth).mul(discount).ceil();
    }
    return cost;
  }
  const cost = scaleCost(def.cost, growth, discount);
  for (const k of Object.keys(cost)) cost[k] = cost[k]!.ceil();
  return cost;
}

export function potionNeedsCreature(ctx: GameContext, potionId: string): boolean {
  const kind = ctx.content.potions.get(potionId).kind;
  return kind === 'permanentStat' || kind === 'creatureBuff';
}

/**
 * Uses a potion. `creatureId` is required for creature potions, `stat` for
 * permanent stat potions (Kraftfutter).
 */
export function usePotion(ctx: GameContext, potionId: string, creatureId: number | null = null, stat: string | null = null): ActionResult {
  const def = ctx.content.potions.get(potionId);
  if (!ctx.state.features[def.feature]) return { ok: false, reason: 'Der Markt ist noch nicht freigeschaltet.' };
  if (ruleActive(ctx, 'noPotions')) return { ok: false, reason: 'In dieser Anomalie sind Tränke verboten.' };
  const c = creatureId !== null ? findCreature(ctx, creatureId) : undefined;
  if (potionNeedsCreature(ctx, potionId) && !c) return { ok: false, reason: 'Wähle eine Kreatur.' };

  if (def.kind === 'permanentStat') {
    if (!stat || !ctx.content.stats.has(stat)) return { ok: false, reason: 'Wähle einen Wert.' };
    const bonus = def.statBonus ?? 0;
    if ((c!.boosts[stat] ?? 0) + bonus > maxStatBoost(ctx) + 1e-9) return { ok: false, reason: 'Dieser Wert ist bereits voll gestärkt.' };
  }
  const shortMs = ctx.balance.timeCrystals.longProjectHours * 3_600_000;
  if (def.kind === 'timeSkip' && !ctx.state.processes.some((p) => p.durationMs < shortMs)) return { ok: false, reason: 'Es laufen keine kurzen Vorgänge – lange Projekte brauchen Zeitkristalle.' };
  const paid = spend(ctx, potionCost(ctx, potionId, creatureId));
  if (!paid.ok) return paid;

  switch (def.kind) {
    case 'permanentStat':
      c!.boosts[stat!] = (c!.boosts[stat!] ?? 0) + (def.statBonus ?? 0);
      c!.boostUses = (c!.boostUses ?? 0) + 1;
      ctx.invalidate();
      break;
    case 'creatureBuff':
      addBuff(ctx, def.id, def.modifiers ?? [], (def.durationSec ?? 0) * 1000, c!.id);
      break;
    case 'globalBuff':
      addBuff(ctx, def.id, def.modifiers ?? [], (def.durationSec ?? 0) * 1000);
      break;
    case 'timeSkip': {
      skipProcessTime(ctx, (def.skipSec ?? 0) * 1000, shortMs);
      const since = ctx.state.lastTickAt - ctx.balance.market.timeSkipWindowHours * 3_600_000;
      ctx.state.timeSkips = [...ctx.state.timeSkips.filter((t) => t > since), ctx.state.lastTickAt];
      break;
    }
  }
  ctx.bus.emit('potionUsed', { potion: def.id, creatureId: c?.id ?? null });
  return { ok: true };
}
