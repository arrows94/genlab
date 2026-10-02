import type { GameContext } from './context';
import type { AbilityDef } from './content/types';
import type { ModifierDef } from './modifiers';
import type { Creature } from './state';

/** Level of an ability on a creature (1 … `abilities.levelMults.length`). */
export function abilityLevel(c: Creature, abilityId: string): number {
  return c.abilityLevels?.[abilityId] ?? 1;
}

/** „Brutpfleger II“: the name with its level from level II on. */
export function abilityName(c: Creature, def: AbilityDef): string {
  const level = abilityLevel(c, def.id);
  return level > 1 ? `${def.name} ${['I', 'II', 'III', 'IV', 'V'][level - 1] ?? level}` : def.name;
}

/** Highest level an ability can reach with the Fähigkeits-Elixier. */
export function maxAbilityLevel(ctx: GameContext): number {
  return ctx.balance.abilities.levelMults.length;
}

/** The ability's modifiers at the creature's level: add/pct scale, mult moves away from 1. */
export function abilityModifiers(ctx: GameContext, def: AbilityDef, c: Creature): ModifierDef[] {
  const mults = ctx.balance.abilities.levelMults;
  const k = mults[Math.min(mults.length, abilityLevel(c, def.id)) - 1] ?? 1;
  if (k === 1) return def.modifiers;
  return def.modifiers.map((m) => ({ ...m, value: m.op === 'mult' ? 1 + (m.value - 1) * k : m.value * k }));
}

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
