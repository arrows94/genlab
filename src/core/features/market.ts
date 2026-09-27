import { D } from '../num';
import { findCreature } from '../creatures';
import { trySpend } from '../resources';
import { scaleCost, type Cost } from '../costs';
import { addBuff } from '../systems/buffs';
import { skipProcessTime } from '../systems/processes';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import { ruleActive } from './anomalies';

export function potionCost(ctx: GameContext, potionId: string, creatureId: number | null = null): Cost {
  const def = ctx.content.potions.get(potionId);
  const discount = ctx.mods().factor('cost.potion');
  let growth = D(1);
  if (def.kind === 'permanentStat' && creatureId !== null) {
    const c = findCreature(ctx, creatureId);
    growth = D(def.costGrowth ?? 1).pow(c?.boostUses ?? 0);
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
    if ((c!.boosts[stat] ?? 0) + bonus > ctx.balance.market.maxBoostsPerStat * bonus + 1e-9) return { ok: false, reason: 'Dieser Wert ist bereits voll gestärkt.' };
  }
  if (def.kind === 'timeSkip' && ctx.state.processes.length === 0) return { ok: false, reason: 'Es laufen keine Vorgänge.' };
  if (!trySpend(ctx, potionCost(ctx, potionId, creatureId))) return { ok: false, reason: 'Nicht genug Ressourcen.' };

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
    case 'timeSkip':
      skipProcessTime(ctx, (def.skipSec ?? 0) * 1000);
      break;
  }
  ctx.bus.emit('potionUsed', { potion: def.id, creatureId: c?.id ?? null });
  return { ok: true };
}
