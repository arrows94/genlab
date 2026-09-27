/**
 * Deterministic, seedable RNG (mulberry32). The whole generator state is a
 * single uint32 kept inside the game state, so it survives save/load and
 * makes simulations fully reproducible.
 */
export interface RngState {
  s: number;
}

export class Rng {
  constructor(private readonly state: RngState) {}

  static fromSeed(seed: number | string): Rng {
    return new Rng({ s: hashSeed(seed) });
  }

  get seedState(): RngState {
    return this.state;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state.s = (this.state.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Picks a key proportionally to its (non-negative) weight. */
  weighted<K extends string>(weights: Readonly<Record<K, number>>): K {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted: total weight must be > 0');
    let roll = this.next() * total;
    for (const [key, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return key;
    }
    return entries[entries.length - 1]![0];
  }
}

/** Turns any seed (e.g. a date string for weekly mutations) into a uint32. */
export function hashSeed(seed: number | string): number {
  const str = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
