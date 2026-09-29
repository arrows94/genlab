import type { GameContext } from './context';
import type { Rng } from './rng';
import type { Creature } from './state';

/**
 * Names of bred creatures: a Rufname plus the family of the stronger parent,
 * e.g. „Wuselbert Funkenstein“ (word lists in content/names.ts and the
 * element's `familyPrefixes`). Wild and start creatures keep their species
 * name and have no family until they found one.
 *
 *  - Fresh Rufnamen: building blocks („Wusel“ + „bert“) or the classic list.
 *  - Children mostly blend their parents' Rufnamen („Kiko“ × „Mira“ → „Kira“),
 *    with rules against stuttering; a share gets a fresh one, so the names of
 *    a line never run dry over many generations.
 *  - Epic and better (or shiny) creatures get a Beiname („Blitzpfote“).
 *
 * The option „Klassisch“ (`state.nameStyle`) brings back the original names:
 * a blend of both parents' full names („Glutwelpe“ × „Sprössling“ → „Glussling“).
 */

const VOWEL = 'aeiouäöüyAEIOUÄÖÜY';
const SYLLABLE = new RegExp(`[^${VOWEL}]*[${VOWEL}]+(?:[^${VOWEL}]+$)?`, 'g');

/** Splits a name into rough syllables („Sprössling“ → [„Sprö“, „ssling“]). */
export function syllables(name: string): string[] {
  const letters = name.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  const parts = letters.match(SYLLABLE);
  return parts && parts.length > 0 ? parts : letters ? [letters] : [];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** The Rufname part of a creature's name (the first word; wild ones: the species name). */
export function rufname(c: Creature): string {
  return c.name.split(' ')[0] ?? c.name;
}

/** Rufnamen already carried by living members of the family (siblings should differ). */
function takenIn(ctx: GameContext, family: string | null): Set<string> {
  return new Set(ctx.state.creatures.filter((c) => family && c.family === family).map((c) => rufname(c).toLowerCase()));
}

/** Fresh Rufname: building blocks („Wusel“ + „bert“) or the classic list, unused in the family if possible. */
export function givenName(ctx: GameContext, family: string | null): string {
  const lists = ctx.content.nameLists;
  const taken = takenIn(ctx, family);
  const max = ctx.balance.creature.maxGivenLength;
  let name = '';
  for (let i = 0; i < 24; i++) {
    const next = ctx.rng.chance(0.7) ? ctx.rng.pick(lists.get('givenStart').words) + ctx.rng.pick(lists.get('givenEnd').words) : ctx.rng.pick(lists.get('given').words);
    if (next.length > max) continue;
    name = next;
    if (!taken.has(next.toLowerCase())) break;
  }
  return name || ctx.rng.pick(lists.get('given').words);
}

/** Start of one name + end of the other, on syllable borders. */
function blend(rng: Rng, x: string[], y: string[]): string {
  const head = x.slice(0, rng.int(1, Math.max(1, x.length - 1)));
  const tail = y.slice(y.length - rng.int(1, Math.max(1, Math.min(2, y.length - 1))));
  return capitalize([...head, ...tail].join(''));
}

/** A blend worth keeping: short, pronounceable, no stuttering, not a parent's name. */
function goodBlend(name: string, parents: string[], max: number): boolean {
  if (name.length < 3 || name.length > max) return false;
  if (parents.some((p) => p.toLowerCase() === name.toLowerCase())) return false;
  const parts = syllables(name).map((p) => p.toLowerCase());
  if (parts.length > 3 || new Set(parts).size < parts.length) return false;
  if (/(.)\1\1/i.test(name)) return false;
  return /^[^aeiouäöüy]{0,3}[aeiouäöüy]/i.test(name);
}

/**
 * Rufname of a child: usually a blend of the parents' Rufnamen, sometimes
 * (`freshNameChance`, or when no good blend exists) a fresh one.
 */
export function childGivenName(ctx: GameContext, a: Creature, b: Creature, family: string | null): string {
  const cfg = ctx.balance.creature;
  if (!ctx.rng.chance(cfg.freshNameChance)) {
    const names = [rufname(a), rufname(b)];
    const taken = takenIn(ctx, family);
    const [sa, sb] = names.map(syllables) as [string[], string[]];
    if (sa.length > 0 && sb.length > 0) {
      for (let i = 0; i < 12; i++) {
        const name = ctx.rng.chance(0.5) ? blend(ctx.rng, sa, sb) : blend(ctx.rng, sb, sa);
        if (goodBlend(name, names, cfg.maxGivenLength) && !taken.has(name.toLowerCase())) return name;
      }
    }
  }
  return givenName(ctx, family);
}

/** A new family name from the element's prefixes and an ending („Funken“ + „stein“), unused if possible. */
export function foundFamily(ctx: GameContext, element: string): string {
  const prefixes = ctx.content.elements.get(element).familyPrefixes;
  const suffixes = ctx.content.nameLists.get('familySuffix').words;
  const taken = new Set(ctx.state.creatures.map((c) => c.family));
  // Room for the longest Rufname and a space.
  const max = ctx.balance.creature.maxNameLength - ctx.balance.creature.maxGivenLength - 1;
  let name = '';
  for (let i = 0; i < 24; i++) {
    const next = ctx.rng.pick(prefixes) + ctx.rng.pick(suffixes);
    // No doubled sounds at the seam („Tau“ + „au“).
    if (next.length > max || /(..)\1/i.test(next)) continue;
    name = next;
    if (!taken.has(next)) break;
  }
  return name || ctx.rng.pick(prefixes);
}

/**
 * Beiname for epic and better (or shiny) creatures: from the stat the
 * creature is best at compared to its species („Blitzpfote“ for Tempo).
 */
export function epithetFor(ctx: GameContext, c: Pick<Creature, 'speciesId' | 'rarity' | 'shiny' | 'stats'>): string | null {
  const from = ctx.content.rarities.get(ctx.balance.creature.epithetFromRarity).order;
  if (!c.shiny && ctx.content.rarities.get(c.rarity).order < from) return null;
  if (c.shiny) return ctx.rng.pick(ctx.content.nameLists.get('epithet.shiny').words);
  const base = ctx.content.species.get(c.speciesId).baseStats;
  let best = ctx.content.stats.list[0]!.id;
  let bestRatio = -Infinity;
  for (const s of ctx.content.stats.list) {
    const ratio = (c.stats[s.id] ?? 0) / Math.max(1, base[s.id] ?? 1);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = s.id;
    }
  }
  return ctx.rng.pick(ctx.content.nameLists.get(`epithet.${best}`).words);
}

// ---- Klassisch: the original names, blended from both parents' full names ----

export interface NameRules {
  minLength: number;
  maxLength: number;
  attempts: number;
}

/** Up to `len − 1` syllables (all of them for one-syllable names). */
function partLength(rng: Rng, len: number): number {
  return rng.int(1, Math.max(1, len - 1));
}

/** One random blend of two syllable lists (always starts with `x`'s first syllable). */
function blendOnce(rng: Rng, x: string[], y: string[]): string {
  const roll = rng.next();
  // Sandwich: first + an inner syllable of the other parent + last („Fu·blu·nke“).
  // Final syllables carry consonant clusters („…lter“), so they never go in the middle.
  if (roll < 0.25 && x.length >= 2 && y.length >= 2) return x[0] + rng.pick(y.slice(0, -1)) + x[x.length - 1];
  const head = x.slice(0, partLength(rng, x.length));
  // Mostly the other parent's ending, sometimes any block of its syllables.
  const n = partLength(rng, y.length);
  const start = roll < 0.4 ? rng.int(0, y.length - n) : y.length - n;
  return head.join('') + y.slice(start, start + n).join('');
}

/**
 * Classic name: random blend of the parents' names (start of one, syllables of
 * the other). Avoids copying a parent's name exactly; falls back to `fallback`.
 */
export function blendNames(rng: Rng, a: string, b: string, rules: NameRules, fallback: string): string {
  const parents = [a, b].map((n) => n.toLowerCase());
  const sa = syllables(a);
  const sb = syllables(b);
  if (sa.length === 0 || sb.length === 0) return fallback;
  for (let i = 0; i < rules.attempts; i++) {
    const name = capitalize(rng.chance(0.5) ? blendOnce(rng, sa, sb) : blendOnce(rng, sb, sa));
    if (name.length < rules.minLength || name.length > rules.maxLength) continue;
    if (parents.includes(name.toLowerCase())) continue;
    return name;
  }
  return fallback;
}

/** Name of a newborn in the chosen style. The family is passed on either way (for switching back). */
export function offspringName(ctx: GameContext, a: Creature, b: Creature, family: string, speciesName: string): string {
  if (ctx.state.nameStyle === 'classic') return blendNames(ctx.rng, a.name, b.name, ctx.balance.creature.classicName, speciesName);
  const given = childGivenName(ctx, a, b, family);
  // A long surname from the player leaves less room: then a short Rufname that fits.
  const room = ctx.balance.creature.maxNameLength - family.length - 1;
  if (given.length <= room) return `${given} ${family}`;
  const short = ctx.content.nameLists.get('given').words.filter((w) => w.length <= room);
  return short.length > 0 ? `${ctx.rng.pick(short)} ${family}` : family.slice(0, ctx.balance.creature.maxNameLength);
}
