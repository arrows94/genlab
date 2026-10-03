import { D, type Decimal } from '../num';
import type { ActionResult } from '../actions';
import type { TowerOfferDef } from '../content/types';
import type { GameContext } from '../context';
import { grant } from '../resources';
import { floorTokens, towerBestEver } from './tower';
import { weekIndex } from './weekly';

/**
 * Quartiermeister: trades Turm-Marken for scarce resources a few times per calendar week. Prices follow the tower
 * record (`floors` small floors' worth of Turm-Marken there), so the offers keep taking Marken however high the
 * tower is, and grow with every purchase in the week.
 */
const TOKENS = 'towerTokens';

/** This week's purchases (a new week starts from 0). */
function bought(ctx: GameContext): Record<string, number> {
  const q = ctx.state.quartermaster;
  const week = weekIndex(ctx.balance.weekly.epoch, ctx.state.lastTickAt);
  if (q.week !== week) {
    q.week = week;
    q.bought = {};
  }
  return q.bought;
}

/** Offers the player can see: their resource belongs to an unlocked feature. */
export function towerOffers(ctx: GameContext): TowerOfferDef[] {
  return ctx.content.towerOffers.list.filter((o) => {
    const feature = ctx.content.resources.get(o.resource).feature;
    return !feature || !!ctx.state.features[feature];
  });
}

/** Purchases of this offer left this week. */
export function offerLeft(ctx: GameContext, id: string): number {
  const def = ctx.content.towerOffers.get(id);
  return Math.max(0, def.weeklyLimit - (bought(ctx)[id] ?? 0));
}

/** Turm-Marken per small floor at the record: the yardstick of the prices. */
export function offerUnit(ctx: GameContext): Decimal {
  return D(1).max(floorTokens(ctx, Math.max(1, towerBestEver(ctx))));
}

/** Price of the next purchase in Turm-Marken. */
export function offerPrice(ctx: GameContext, id: string): Decimal {
  const def = ctx.content.towerOffers.get(id);
  return offerUnit(ctx).mul(def.floors).mul(D(def.priceGrowth).pow(bought(ctx)[id] ?? 0)).ceil();
}

export function buyOffer(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['quartermaster']) return { ok: false, reason: 'Der Quartiermeister ist noch nicht da.' };
  if (!ctx.content.towerOffers.has(id)) return { ok: false, reason: 'Dieses Angebot gibt es nicht.' };
  const def = ctx.content.towerOffers.get(id);
  if (!towerOffers(ctx).includes(def)) return { ok: false, reason: 'Dieses Angebot gibt es noch nicht.' };
  if (offerLeft(ctx, id) <= 0) return { ok: false, reason: 'Diese Woche ist das Angebot ausverkauft.' };
  const price = offerPrice(ctx, id);
  const owned = ctx.state.resources[TOKENS] ?? D(0);
  if (owned.lt(price)) return { ok: false, reason: 'Nicht genug Turm-Marken.' };
  ctx.state.resources[TOKENS] = owned.sub(price);
  const b = bought(ctx);
  b[id] = (b[id] ?? 0) + 1;
  grant(ctx, def.resource, def.amount, `quartermaster:${id}`);
  return { ok: true };
}
