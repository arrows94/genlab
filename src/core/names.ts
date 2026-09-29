import type { GameContext } from './context';

/**
 * Names of bred creatures: a Rufname plus the family of the stronger parent,
 * e.g. „Kiko Funkenstein“ (word lists in content/names.ts and the element's
 * `familyPrefixes`). Wild and start creatures keep their species name and
 * have no family until they found one.
 */

/** Rufname from the list, preferring one no living member of the family carries yet. */
export function givenName(ctx: GameContext, family: string | null): string {
  const words = ctx.content.nameLists.get('given').words;
  const taken = new Set(ctx.state.creatures.filter((c) => family && c.family === family).map((c) => c.name.split(' ')[0]));
  const free = words.filter((w) => !taken.has(w));
  return ctx.rng.pick(free.length > 0 ? free : words);
}

/** A new family name from the element's prefixes and an ending („Funken“ + „stein“), unused if possible. */
export function foundFamily(ctx: GameContext, element: string): string {
  const prefixes = ctx.content.elements.get(element).familyPrefixes;
  const suffixes = ctx.content.nameLists.get('familySuffix').words;
  const taken = new Set(ctx.state.creatures.map((c) => c.family));
  // Room for the longest Rufname and a space.
  const longestGiven = Math.max(...ctx.content.nameLists.get('given').words.map((w) => w.length));
  const max = ctx.balance.creature.maxNameLength - longestGiven - 1;
  let name = '';
  for (let i = 0; i < 24; i++) {
    const next = ctx.rng.pick(prefixes) + ctx.rng.pick(suffixes);
    if (next.length > max) continue;
    name = next;
    if (!taken.has(next)) break;
  }
  return name || ctx.rng.pick(prefixes);
}
