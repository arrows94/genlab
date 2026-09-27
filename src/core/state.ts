import { D, type Decimal } from './num';
import type { RngState } from './rng';
import type { ModifierDef } from './modifiers';

export type StatBlock = Record<string, number>;

/** Locus id → allele pair. */
export type Genome = Record<string, [string, string]>;

export interface Appearance {
  hue: number;
  pattern: string;
  eyes: string;
  horn: string;
}

export interface CreatureJob {
  kind: 'building' | 'nest' | 'mission' | 'lab';
  target: string;
}

/** Snapshot of an ancestor (kept even after the ancestor is sold). */
export interface AncestorInfo {
  name: string;
  speciesId: string;
  rarity: string;
  generation: number;
  parents: AncestorInfo[] | null;
}

export interface Creature {
  id: number;
  speciesId: string;
  name: string;
  rarity: string;
  generation: number;
  /** Rolled base stats (before rarity multiplier and modifiers). */
  stats: StatBlock;
  appearance: Appearance;
  abilities: string[];
  /** Two allele ids per locus. Hidden in the UI until `sequenced`. */
  genome: Genome;
  /** Permanent potion boosts: stat id → total bonus (0.1 = +10 %). */
  boosts: Record<string, number>;
  /** Number of permanent boosts used on this creature (drives their cost). */
  boostUses: number;
  sequenced: boolean;
  /** Gene splices already applied (limited per creature). */
  splices: number;
  parents: [number, number] | null;
  /** Parents and grandparents as snapshots for the pedigree view. */
  ancestry: AncestorInfo[] | null;
  /** Infusion level (+1 … +10) and collected EP towards the next level. */
  infusion: { level: number; ep: number };
  job: CreatureJob | null;
  locked: boolean;
  bornAt: number;
}

/**
 * A generic timed process (egg, mission, sequencing ...). Handlers are
 * registered per `kind`, so new timed systems need no changes to the tick.
 */
export interface Process {
  id: number;
  kind: string;
  durationMs: number;
  elapsedMs: number;
  data: Record<string, unknown>;
}

export interface Buff {
  id: number;
  source: string;
  remainingMs: number;
  modifiers: ModifierDef[];
  /** Creature-bound buff; `null` = global. */
  creatureId: number | null;
}

export interface AutomationState {
  autoAssign: boolean;
  autoBreed: { enabled: boolean; rule: string; species: string | null };
  /** Sim time of the last automation run. */
  lastRunMs: number;
}

export interface GameState {
  rng: RngState;
  /** Total simulated time in ms (including offline). */
  simTimeMs: number;
  /** Wall clock (epoch ms) of the last simulation step. */
  lastTickAt: number;
  createdAt: number;
  resources: Record<string, Decimal>;
  /** Earned this prestige run (drives unlocks and prestige gain). */
  earned: Record<string, Decimal>;
  earnedTotal: Record<string, Decimal>;
  upgrades: Record<string, number>;
  features: Record<string, boolean>;
  /** Hints already shown, so they are not repeated after a reset. */
  seenHints: Record<string, boolean>;
  creatures: Creature[];
  processes: Process[];
  buffs: Buff[];
  nextId: number;
  /** Hybrid recipes whose hint has been revealed. */
  recipeHints: Record<string, boolean>;
  /** Catalogued alleles, key `${locus}:${allele}` (Genbibliothek). */
  geneLibrary: Record<string, boolean>;
  /** Discovered dex entries, key `${species}:${rarity}`. */
  dex: Record<string, boolean>;
  achievements: Record<string, boolean>;
  /** Free-form counters (hatched, collected, missions ...). */
  statistics: Record<string, number>;
  prestige: Record<string, { count: number }>;
  automation: AutomationState;
  /** Capsules opened since the last pity-qualifying result, per capsule. */
  capsulePity: Record<string, number>;
}

export function createEmptyState(now: number, seed: number): GameState {
  return {
    rng: { s: seed >>> 0 },
    simTimeMs: 0,
    lastTickAt: now,
    createdAt: now,
    resources: {},
    earned: {},
    earnedTotal: {},
    upgrades: {},
    features: {},
    seenHints: {},
    creatures: [],
    processes: [],
    buffs: [],
    nextId: 1,
    dex: {},
    geneLibrary: {},
    recipeHints: {},
    achievements: {},
    statistics: {},
    prestige: {},
    automation: { autoAssign: false, autoBreed: { enabled: false, rule: 'power', species: null }, lastRunMs: 0 },
    capsulePity: {},
  };
}

export function dexKey(species: string, rarity: string): string {
  return `${species}:${rarity}`;
}

export function resource(state: GameState, id: string): Decimal {
  return state.resources[id] ?? D(0);
}
