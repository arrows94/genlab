import { checkCondition } from '../conditions';
import type { HybridRecipeDef } from '../content/types';
import type { GameContext } from '../context';
import type { Creature, StatBlock } from '../state';

/**
 * Hybrid species come from data-driven recipes: species A × species B,
 * optionally with requirements. Recipes stay "???" until the result is in
 * the dex; hints are revealed by research or expeditions.
 */

export function rarityAtLeast(ctx: GameContext, rarity: string, min: string): boolean {
  return ctx.content.rarities.get(rarity).order >= ctx.content.rarities.get(min).order;
}

export function carriesAllele(c: Creature, locus: string, allele: string): boolean {
  return c.genome[locus]?.includes(allele) ?? false;
}

/** Parents match the recipe's species and fulfil every requirement. */
export function recipeMatches(ctx: GameContext, r: HybridRecipeDef, a: Creature, b: Creature): boolean {
  const [p1, p2] = r.parents;
  if (!((a.speciesId === p1 && b.speciesId === p2) || (a.speciesId === p2 && b.speciesId === p1))) return false;
  const req = r.requires;
  if (!req) return true;
  if (req.minGeneration && Math.min(a.generation, b.generation) < req.minGeneration) return false;
  if (req.minRarity && !(rarityAtLeast(ctx, a.rarity, req.minRarity) && rarityAtLeast(ctx, b.rarity, req.minRarity))) return false;
  if (req.allele && !(carriesAllele(a, req.allele.locus, req.allele.allele) || carriesAllele(b, req.allele.locus, req.allele.allele))) return false;
  if (req.condition && !checkCondition(ctx.state, req.condition)) return false;
  return true;
}

export function hybridChance(ctx: GameContext, r: HybridRecipeDef): number {
  return Math.min(1, Math.max(0, ctx.mods().apply('breeding.hybridChance', r.chance)));
}

export function isSpeciesDiscovered(ctx: GameContext, species: string): boolean {
  return ctx.content.rarities.list.some((r) => ctx.state.dex[`${species}:${r.id}`]);
}

export function isRecipeDiscovered(ctx: GameContext, r: HybridRecipeDef): boolean {
  return isSpeciesDiscovered(ctx, r.result);
}

/** Reveals the hint of a random recipe that is neither hinted nor discovered. */
export function revealHint(ctx: GameContext): string | null {
  const open = ctx.content.recipes.list.filter((r) => !ctx.state.recipeHints[r.id] && !isRecipeDiscovered(ctx, r));
  if (open.length === 0) return null;
  const r = ctx.rng.pick(open);
  ctx.state.recipeHints[r.id] = true;
  ctx.bus.emit('recipeHinted', { recipe: r.id });
  return r.id;
}

/**
 * Offspring species: every matching recipe gets a roll (in content order);
 * otherwise one of the parent species. `mult` scales the recipe chances
 * (breeding rituals); `guaranteed` makes a matching recipe always succeed.
 * Urzeitwesen pass on their species only to a pair of Urzeitwesen: with any
 * other partner the child is of the partner's species (it still inherits genes).
 */
export function rollOffspringSpecies(ctx: GameContext, a: Creature, b: Creature, mult = 1, guaranteed = false): string {
  const primalA = ctx.content.species.get(a.speciesId).tier === 'primal';
  const primalB = ctx.content.species.get(b.speciesId).tier === 'primal';
  if (primalA !== primalB) return primalA ? b.speciesId : a.speciesId;
  if (ctx.state.features['hybrids']) {
    if (guaranteed) {
      const matching = ctx.content.recipes.list.filter((r) => recipeMatches(ctx, r, a, b));
      if (matching.length > 0) return ctx.rng.pick(matching).result;
    }
    for (const r of ctx.content.recipes.list) {
      if (recipeMatches(ctx, r, a, b) && ctx.rng.chance(Math.min(1, hybridChance(ctx, r) * mult))) return r.result;
    }
  }
  return ctx.rng.chance(0.5) ? a.speciesId : b.speciesId;
}

/**
 * Stats move towards a new species' profile: each stat is scaled by
 * (target species base / source base). Used for hybrids and evolution.
 */
export function reprofileStats(ctx: GameContext, stats: StatBlock, fromBase: StatBlock, toSpecies: string): StatBlock {
  const target = ctx.content.species.get(toSpecies).baseStats;
  const out: StatBlock = {};
  for (const s of ctx.content.stats.list) {
    const from = fromBase[s.id] || 1;
    out[s.id] = Math.max(1, Math.round((stats[s.id] ?? 0) * ((target[s.id] ?? from) / from)));
  }
  return out;
}

/** Average base stats of two species (reference profile of a pair). */
export function averageBase(ctx: GameContext, a: string, b: string): StatBlock {
  const sa = ctx.content.species.get(a).baseStats;
  const sb = ctx.content.species.get(b).baseStats;
  const out: StatBlock = {};
  for (const s of ctx.content.stats.list) out[s.id] = ((sa[s.id] ?? 0) + (sb[s.id] ?? 0)) / 2;
  return out;
}
