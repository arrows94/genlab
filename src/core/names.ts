import type { Rng } from './rng';

/**
 * Offspring names: blends the parents' names by syllables, e.g.
 * "Glutwelpe" × "Sprössling" → "Glussling", "Sprölpe", "Glutwessling".
 */
const VOWEL = 'aeiouäöüyAEIOUÄÖÜY';
const SYLLABLE = new RegExp(`[^${VOWEL}]*[${VOWEL}]+(?:[^${VOWEL}]+$)?`, 'g');

/** Splits a name into rough syllables ("Sprössling" → ["Sprö", "ssling"]). */
export function syllables(name: string): string[] {
  const letters = name.replace(/[^A-Za-zÄÖÜäöüß]/g, '');
  const parts = letters.match(SYLLABLE);
  return parts && parts.length > 0 ? parts : letters ? [letters] : [];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

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
  // Sandwich: first + an inner syllable of the other parent + last ("Fu·blu·nke").
  // Final syllables carry consonant clusters ("…lter"), so they never go in the middle.
  if (roll < 0.25 && x.length >= 2 && y.length >= 2) return x[0] + rng.pick(y.slice(0, -1)) + x[x.length - 1];
  const head = x.slice(0, partLength(rng, x.length));
  // Mostly the other parent's ending, sometimes any block of its syllables.
  const n = partLength(rng, y.length);
  const start = roll < 0.4 ? rng.int(0, y.length - n) : y.length - n;
  return head.join('') + y.slice(start, start + n).join('');
}

/**
 * Random blend of the parents' names (start of one, syllables of the other).
 * Avoids copying a parent's name exactly; falls back to `fallback`.
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
