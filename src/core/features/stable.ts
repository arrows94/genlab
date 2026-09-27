import { D, type Decimal } from '../num';
import { findCreature, removeCreature } from '../creatures';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import { EGG } from './breeding';
import { SEQUENCE, type SequenceData } from './sequencing';

/** Stable (Stall): limited creature capacity, upgradable. */
export function stableCapacity(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.stable', ctx.balance.stable.baseCapacity));
}

/** Free places, counting eggs as future creatures. */
export function stableFree(ctx: GameContext): number {
  const eggs = ctx.state.processes.filter((p) => p.kind === EGG).length;
  return stableCapacity(ctx) - ctx.state.creatures.length - eggs;
}

/**
 * Creatures that may be consumed (sold, infused, recycled): never locked
 * favourites and never creatures that work, breed, explore or are being
 * sequenced.
 */
export function canConsume(ctx: GameContext, c: Creature): boolean {
  if (c.locked || c.job !== null) return false;
  return !ctx.state.processes.some((p) => p.kind === SEQUENCE && (p.data as SequenceData).creatureId === c.id);
}

export function consumeBlocker(ctx: GameContext, c: Creature): string | null {
  if (c.locked) return 'Favoriten sind geschützt.';
  if (c.job) return 'Kreatur ist beschäftigt.';
  if (!canConsume(ctx, c)) return 'Kreatur wird gerade sequenziert.';
  return null;
}

export function sellValue(ctx: GameContext, c: Creature): Record<string, Decimal> {
  const base = ctx.balance.sell.valueByRarity[c.rarity] ?? {};
  const factor = (1 + ctx.balance.sell.perGeneration * (c.generation - 1)) * ctx.mods().factor('creature.sellValue');
  const out: Record<string, Decimal> = {};
  for (const [res, amount] of Object.entries(base)) out[res] = D(amount).mul(factor).floor();
  return out;
}

/** Validates a batch of creatures to consume; returns them or a reason. */
export function takeConsumable(ctx: GameContext, ids: number[]): Creature[] | string {
  if (ids.length === 0) return 'Keine Kreatur ausgewählt.';
  const out: Creature[] = [];
  for (const id of new Set(ids)) {
    const c = findCreature(ctx, id);
    if (!c) return 'Kreatur nicht gefunden.';
    const blocker = consumeBlocker(ctx, c);
    if (blocker) return `${c.name}: ${blocker}`;
    out.push(c);
  }
  if (out.length >= ctx.state.creatures.length) return 'Mindestens eine Kreatur muss bleiben.';
  return out;
}

export function sell(ctx: GameContext, ids: number[]): ActionResult {
  const taken = takeConsumable(ctx, ids);
  if (typeof taken === 'string') return { ok: false, reason: taken };
  const total: Record<string, Decimal> = {};
  for (const c of taken) {
    for (const [res, v] of Object.entries(sellValue(ctx, c))) total[res] = (total[res] ?? D(0)).add(v);
    removeCreature(ctx, c.id, 'sold');
  }
  for (const [res, v] of Object.entries(total)) grant(ctx, res, v, 'sell');
  ctx.bus.emit('sold', { count: taken.length, value: total });
  return { ok: true };
}

/** Total sell value of a batch (preview for the UI). */
export function batchSellValue(ctx: GameContext, creatures: Creature[]): Record<string, Decimal> {
  const total: Record<string, Decimal> = {};
  for (const c of creatures) for (const [res, v] of Object.entries(sellValue(ctx, c))) total[res] = (total[res] ?? D(0)).add(v);
  return total;
}
