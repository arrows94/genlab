import type { GameContext } from './context';

/** Rolls a random ability not in `exclude` (tier by balance weights). */
export function rollAbility(ctx: GameContext, exclude: readonly string[] = []): string | null {
  const { content, balance, rng } = ctx;
  const weights: Record<string, number> = {};
  for (const [tier, w] of Object.entries(balance.abilities.tierWeights)) {
    if (content.abilities.list.some((a) => a.tier === tier && !exclude.includes(a.id))) weights[tier] = w;
  }
  if (Object.keys(weights).length === 0) return null;
  const tier = rng.weighted(weights);
  const pool = content.abilities.list.filter((a) => a.tier === tier && !exclude.includes(a.id));
  return rng.pick(pool).id;
}

/** Abilities for a creature without parents (start, wild, capsule). */
export function rollStartingAbilities(ctx: GameContext): string[] {
  const out: string[] = [];
  for (const chance of ctx.balance.abilities.slotChances.slice(0, ctx.balance.abilities.max)) {
    if (!ctx.rng.chance(chance)) break;
    const id = rollAbility(ctx, out);
    if (id) out.push(id);
  }
  return out;
}

/** Chance that an ability passes on: higher when both parents have it. */
export function abilityInheritChance(ctx: GameContext, both: boolean): number {
  const b = ctx.balance.breeding;
  // Äon talent „Starke Blutlinie“ raises the chance up to a sure inheritance.
  return Math.min(1, ctx.mods().apply('breeding.abilityInherit', both ? b.abilityInheritBoth : b.abilityInheritChance));
}

/** Offspring abilities: each parent ability may pass on (shared ones likely), plus a mutation chance for a new one. */
export function inheritAbilities(ctx: GameContext, a: readonly string[], b: readonly string[], mutationChance: number): string[] {
  const { balance, rng } = ctx;
  // Shared abilities first: they are the likely ones and should not lose their place to the slot limit.
  const pool = [...new Set([...a, ...b])].sort((x, y) => Number(b.includes(y) && a.includes(y)) - Number(b.includes(x) && a.includes(x)));
  const out: string[] = [];
  for (const id of pool) {
    if (out.length >= balance.abilities.max) break;
    if (ctx.content.abilities.has(id) && rng.chance(abilityInheritChance(ctx, a.includes(id) && b.includes(id)))) out.push(id);
  }
  if (out.length < balance.abilities.max && rng.chance(mutationChance)) {
    const id = rollAbility(ctx, out);
    if (id) out.push(id);
  }
  return out;
}
