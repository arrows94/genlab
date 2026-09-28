import { D, type Decimal } from '../num';
import { createCreature, removeCreature } from '../creatures';
import { grant, trySpend } from '../resources';
import { scaleCost, type Cost } from '../costs';
import { checkUnlocks } from '../systems/unlocks';
import type { CapsuleDef, SpeciesTier } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import { stableFree, takeConsumable } from './stable';

/** Gen-Recycler: creatures → gene fragments. Capsules: fragments → random creature. */

export function fragmentValue(ctx: GameContext, c: Creature): Decimal {
  const r = ctx.balance.recycler;
  const base = (r.fragmentsByRarity[c.rarity] ?? 0) * (1 + r.perGeneration * (c.generation - 1));
  return D(ctx.mods().apply('capsule.fragmentYield', base)).floor();
}

export function recycle(ctx: GameContext, ids: number[], auto = false): ActionResult {
  if (!ctx.state.features['recycler']) return { ok: false, reason: 'Der Gen-Recycler ist noch nicht freigeschaltet.' };
  const taken = takeConsumable(ctx, ids);
  if (typeof taken === 'string') return { ok: false, reason: taken };
  let total = D(0);
  for (const c of taken) {
    total = total.add(fragmentValue(ctx, c));
    removeCreature(ctx, c.id, 'recycled');
  }
  grant(ctx, 'fragments', total, 'recycler');
  ctx.bus.emit('recycled', { count: taken.length, fragments: total, auto });
  return { ok: true };
}

export function capsuleCost(ctx: GameContext, capsuleId: string, count = 1): Cost {
  const def = ctx.content.capsules.get(capsuleId);
  const cost = scaleCost(def.cost, ctx.mods().factor('cost.capsule'), count);
  for (const k of Object.keys(cost)) cost[k] = cost[k]!.ceil();
  return cost;
}

/** Exact rarity odds (shown openly in the UI). */
export function capsuleOdds(ctx: GameContext, capsuleId: string): Record<string, number> {
  const def = ctx.content.capsules.get(capsuleId);
  const total = Object.values(def.rarityWeights).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const r of ctx.content.rarities.list) out[r.id] = (def.rarityWeights[r.id] ?? 0) / total;
  return out;
}

export function pityCounter(ctx: GameContext, capsuleId: string): number {
  return ctx.state.capsulePity[capsuleId] ?? 0;
}

/** Species that can drop (optionally limited to one element), grouped by tier. */
export function capsuleSpecies(ctx: GameContext, def: CapsuleDef, element: string | null): Partial<Record<SpeciesTier, string[]>> {
  const out: Partial<Record<SpeciesTier, string[]>> = {};
  for (const s of ctx.content.species.list) {
    if ((def.tierWeights[s.tier] ?? 0) <= 0) continue;
    if (def.elementChoice && element && s.element !== element) continue;
    (out[s.tier] ??= []).push(s.id);
  }
  return out;
}

function rollRarity(ctx: GameContext, def: CapsuleDef, forcePity: boolean): string {
  const minOrder = ctx.content.rarities.get(def.pity.minRarity).order;
  const weights: Record<string, number> = {};
  for (const [r, w] of Object.entries(def.rarityWeights)) {
    if (w <= 0) continue;
    if (forcePity && ctx.content.rarities.get(r).order < minOrder) continue;
    weights[r] = w;
  }
  return ctx.rng.weighted(weights);
}

function rollSpecies(ctx: GameContext, def: CapsuleDef, element: string | null): string {
  const pools = capsuleSpecies(ctx, def, element);
  const weights: Record<string, number> = {};
  for (const [tier, list] of Object.entries(pools)) if (list && list.length > 0) weights[tier] = def.tierWeights[tier as SpeciesTier] ?? 0;
  const tier = ctx.rng.weighted(weights) as SpeciesTier;
  return ctx.rng.pick(pools[tier]!);
}

export interface CapsuleResult {
  creatureId: number;
  speciesId: string;
  rarity: string;
  pity: boolean;
  newDex: boolean;
}

export function openCapsules(ctx: GameContext, capsuleId: string, count: number, element: string | null = null): { ok: true; results: CapsuleResult[] } | { ok: false; reason: string } {
  const def = ctx.content.capsules.get(capsuleId);
  if (!ctx.state.features[def.feature]) return { ok: false, reason: 'Kapseln sind noch nicht freigeschaltet.' };
  if (count < 1) return { ok: false, reason: 'Ungültige Anzahl.' };
  if (def.elementChoice) {
    if (!element || !ctx.content.elements.has(element)) return { ok: false, reason: 'Wähle ein Element.' };
    if (Object.keys(capsuleSpecies(ctx, def, element)).length === 0) return { ok: false, reason: 'Keine Art dieses Elements verfügbar.' };
  }
  if (stableFree(ctx) < count) return { ok: false, reason: 'Nicht genug Platz im Stall.' };
  if (!trySpend(ctx, capsuleCost(ctx, capsuleId, count))) return { ok: false, reason: 'Nicht genug Gen-Fragmente.' };

  const minOrder = ctx.content.rarities.get(def.pity.minRarity).order;
  const results: CapsuleResult[] = [];
  for (let i = 0; i < count; i++) {
    const counter = pityCounter(ctx, capsuleId);
    const pity = counter >= def.pity.threshold - 1;
    const rarity = rollRarity(ctx, def, pity);
    const speciesId = rollSpecies(ctx, def, def.elementChoice ? element : null);
    const dexBefore = ctx.state.dex[`${speciesId}:${rarity}`] === true;
    const c = createCreature(ctx, { speciesId, rarity, source: 'capsule' });
    ctx.state.capsulePity[capsuleId] = ctx.content.rarities.get(rarity).order >= minOrder ? 0 : counter + 1;
    results.push({ creatureId: c.id, speciesId, rarity, pity, newDex: !dexBefore });
    ctx.bus.emit('capsuleOpened', { capsule: capsuleId, creatureId: c.id, rarity, pity });
  }
  checkUnlocks(ctx);
  return { ok: true, results };
}


export function batchFragments(ctx: GameContext, creatures: Creature[]): Decimal {
  return creatures.reduce((sum, c) => sum.add(fragmentValue(ctx, c)), D(0));
}
