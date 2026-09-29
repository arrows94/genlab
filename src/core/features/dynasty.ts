import { D } from '../num';
import { grant } from '../resources';
import type { SourcedModifier } from '../modifiers';
import type { ModifierProvider } from '../providers';
import type { GameContext } from '../context';
import type { Creature } from '../state';

/**
 * Stammbaum-Dynastien: a pure line is bred when both parents and the child
 * are the same species. Its depth counts the generations in a row
 * (min of the parents + 1), so a deeper line needs two deep parents.
 *
 *  - Per creature: +`statPerDepth` on every stat per depth (up to `maxDepthBonus`).
 *    Lives with the creature, so it starts over after every reset.
 *  - Per species: the deepest line ever bred is a permanent record. Each
 *    threshold reached is a dynasty tier: more stats for the species, more
 *    production for everything, Äon-Splitter for the high tiers.
 *
 * Unlocked by the Äon talent „Stammbaum-Dynastien“. Nothing counts before:
 * lines start at the first pure egg after the unlock, and only then are
 * records kept.
 */

export const DYNASTY_FEATURE = 'dynasties';

/** Line depth of a child with these parents (0 = not a pure line, or not unlocked yet). */
export function lineageDepth(ctx: GameContext, speciesId: string, a: Creature, b: Creature): number {
  if (!ctx.state.features[DYNASTY_FEATURE] || a.speciesId !== speciesId || b.speciesId !== speciesId) return 0;
  return Math.min(a.lineage ?? 0, b.lineage ?? 0) + 1;
}

export function dynastyRecord(ctx: GameContext, speciesId: string): number {
  return ctx.state.dynasties[speciesId] ?? 0;
}

/** Tier (0 … number of thresholds) reached with this depth. */
export function dynastyTier(ctx: GameContext, depth: number): number {
  return ctx.balance.dynasty.tiers.filter((t) => depth >= t).length;
}

/** Depth needed for the next tier (null at the highest tier). */
export function nextTierDepth(ctx: GameContext, depth: number): number | null {
  return ctx.balance.dynasty.tiers.find((t) => depth < t) ?? null;
}

/** Sum of all tiers over all species (drives the production bonus). */
export function totalDynastyTiers(ctx: GameContext): number {
  return Object.values(ctx.state.dynasties).reduce((n, d) => n + dynastyTier(ctx, d), 0);
}

/** Stat bonus of the creature's own line (fraction, 0.12 = +12 %). */
export function lineageBonus(ctx: GameContext, c: Creature): number {
  const b = ctx.balance.dynasty;
  return Math.min(b.maxDepthBonus, (c.lineage ?? 0) * b.statPerDepth);
}

/** Own line + the species' dynasty tier as stat modifiers. */
export function dynastyModifiers(ctx: GameContext, c: Creature): SourcedModifier[] {
  if (!ctx.state.features[DYNASTY_FEATURE]) return [];
  const out: SourcedModifier[] = [];
  const own = lineageBonus(ctx, c);
  const tier = dynastyTier(ctx, dynastyRecord(ctx, c.speciesId));
  for (const s of ctx.content.stats.list) {
    if (own > 0) out.push({ target: `stat.${s.id}`, op: 'pct', value: own, source: 'lineage' });
    if (tier > 0) out.push({ target: `stat.${s.id}`, op: 'pct', value: tier * ctx.balance.dynasty.statPerTier, source: `dynasty:${c.speciesId}` });
  }
  return out;
}

/**
 * Records a creature's line as its species' dynasty record. New tiers pay
 * their Äon-Splitter once (the record never drops).
 */
export function recordLineage(ctx: GameContext, c: Creature): void {
  const depth = c.lineage ?? 0;
  if (!ctx.state.features[DYNASTY_FEATURE] || depth <= dynastyRecord(ctx, c.speciesId)) return;
  const before = dynastyTier(ctx, dynastyRecord(ctx, c.speciesId));
  ctx.state.dynasties[c.speciesId] = depth;
  const tier = dynastyTier(ctx, depth);
  if (tier > before) {
    const shards = ctx.balance.dynasty.shardsPerTier.slice(before, tier).reduce((n, s) => n + s, 0);
    if (shards > 0) grant(ctx, 'aeonShards', D(shards), 'dynasty');
    ctx.bus.emit('dynastyTier', { species: c.speciesId, tier, depth, shards });
  }
  ctx.invalidate();
}

export const dynastyProvider: ModifierProvider = (ctx, into) => {
  if (!ctx.state.features[DYNASTY_FEATURE]) return;
  const tiers = totalDynastyTiers(ctx);
  if (tiers > 0) into.addAll('dynasty', ctx.balance.dynasty.modifiersPerTier, tiers);
};
