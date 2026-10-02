import { D, type Decimal } from '../num';
import { grant } from '../resources';
import { productionRates } from '../systems/production';
import { checkUnlocks } from '../systems/unlocks';
import type { ActionResult } from '../actions';
import type { GameContext } from '../context';
import type { System } from '../systems/types';

/**
 * Manual collecting. Every click spends one point of Ausdauer, which refills
 * over game time. An exhausted click spends what has refilled so far and
 * brings that share of the yield, so clicking is worth at most the refill
 * rate per second: an auto-clicker gains nothing over an attentive player.
 * A click also brings a few seconds of the current production (stays useful
 * later) and, while rested, may turn up a Fundstück.
 */

export interface CollectFind {
  resource: string;
  amount: Decimal;
}

export function staminaMax(ctx: GameContext): number {
  return ctx.mods().apply('collect.stamina', ctx.balance.collect.stamina.max);
}

/** Ausdauer left right now (may be fractional while it refills). */
export function stamina(ctx: GameContext): number {
  return Math.max(0, staminaMax(ctx) - ctx.state.collect.spent);
}

/** True when the next click gets the full yield. */
export function rested(ctx: GameContext): boolean {
  return stamina(ctx) >= 1;
}

/** Yield of a click with full Ausdauer: base amount plus seconds of the current production. */
function fullAmounts(ctx: GameContext): Record<string, Decimal> {
  const mods = ctx.mods();
  const rates = productionRates(ctx);
  const seconds = mods.apply('collect.production', ctx.balance.collect.productionSeconds);
  const out: Record<string, Decimal> = {};
  for (const r of ctx.content.resources.list) {
    const flat = mods.apply(`collect.${r.id}`, ctx.balance.collect.amounts[r.id] ?? 0);
    if (flat > 0) out[r.id] = D(flat).add((rates[r.id] ?? D(0)).mul(seconds));
  }
  return out;
}

/** What the next click brings (only the refilled share while exhausted). */
export function collectAmounts(ctx: GameContext): Record<string, Decimal> {
  const amounts = fullAmounts(ctx);
  const share = Math.min(1, stamina(ctx));
  if (share >= 1) return amounts;
  return Object.fromEntries(Object.entries(amounts).map(([res, amount]) => [res, amount.mul(share)]));
}

/** Rolls a Fundstück: a resource the player collects or produces, worth a chunk of clicks and production. */
function rollFind(ctx: GameContext): CollectFind | null {
  const cfg = ctx.balance.collect.finds;
  const s = ctx.state;
  // None in the very first minutes either: the start is paced without them.
  if (s.simTimeMs < Math.max(s.collect.nextFindAt, cfg.cooldownSec * 1000)) return null;
  if (!ctx.rng.chance(ctx.mods().apply('collect.findChance', cfg.chance))) return null;
  const clicks = fullAmounts(ctx);
  const rates = productionRates(ctx);
  const candidates = ctx.content.resources.list.map((r) => r.id).filter((id) => clicks[id] || rates[id]);
  if (!candidates.length) return null;
  const resource = candidates[ctx.rng.int(0, candidates.length - 1)]!;
  const amount = (clicks[resource] ?? D(0)).mul(cfg.clicks).add((rates[resource] ?? D(0)).mul(cfg.productionSeconds));
  s.collect.nextFindAt = s.simTimeMs + cfg.cooldownSec * 1000;
  return { resource, amount };
}

export function collect(ctx: GameContext): ActionResult {
  if (!ctx.state.features['collect']) return { ok: false, reason: 'Sammeln ist noch nicht verfügbar.' };
  const full = rested(ctx);
  const amounts = collectAmounts(ctx);
  ctx.state.collect.spent += Math.min(1, stamina(ctx));
  for (const [res, amount] of Object.entries(amounts)) grant(ctx, res, amount, 'collect');
  const find = full ? rollFind(ctx) : null;
  if (find) grant(ctx, find.resource, find.amount, 'collectFind');
  ctx.bus.emit('collected', { amounts, find });
  checkUnlocks(ctx);
  return { ok: true };
}

/** Refills Ausdauer with game time (also offline, up to the maximum). */
export const collectSystem: System = {
  id: 'collect',
  update(ctx, dtMs) {
    const c = ctx.state.collect;
    if (c.spent <= 0) return;
    const regen = ctx.mods().apply('collect.staminaRegen', ctx.balance.collect.stamina.perSec);
    c.spent = Math.max(0, c.spent - (regen * dtMs) / 1000);
  },
};
