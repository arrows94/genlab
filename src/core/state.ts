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
  kind: 'building' | 'nest' | 'mission' | 'lab' | 'tower';
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
  /** Erbanlage (latent trait id) – hidden until `deepSequenced`; null = none. */
  latent: string | null;
  /** Deep sequencing done: the Erbanlage is known and active. */
  deepSequenced: boolean;
  /** Gene splices already applied (limited per creature). */
  splices: number;
  /** Rare colour mutation "Schillernd". */
  shiny: boolean;
  /** Stammbaum-Dynastie: generations in a row of a pure line (same species as both parents); 0 = none. */
  lineage: number;
  /** Family name, passed on to offspring (the stronger parent's); null = none yet (wild, start, capsule). */
  family: string | null;
  /** Beiname („Blitzpfote“) for epic and better or shiny creatures; null = none. */
  epithet: string | null;
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

/** Zuchtautomat settings. */
export interface AutoBreedConfig {
  enabled: boolean;
  /** Goal: "power", a stat id, "hybrid", "dex", "allele", "abilities" or "cheap". */
  rule: string;
  species: string | null;
  /** Target allele for the "allele" goal as "locus:allele". */
  allele: string | null;
  /** Max share of each owned resource a single egg may cost (1 = everything). */
  budget: number;
}

/** Recycling-Automat settings. */
export interface AutoRecycleConfig {
  enabled: boolean;
  /** Highest rarity that may be recycled. */
  maxRarity: string;
  /** The strongest N of every species are always kept. */
  keepPerSpecies: number;
  /** Sequenced creatures (known genome, often breeding stock) are kept. */
  keepSequenced: boolean;
  /** "always": everything that matches; "full": one creature whenever the stable is full. */
  when: 'always' | 'full';
}

export interface AutomationState {
  autoAssign: boolean;
  autoBreed: AutoBreedConfig;
  autoRecycle: AutoRecycleConfig;
  /** Zerlege-Kammer of the Recycling-Automat: the creature inside and how long it has been there. */
  recycling: { creatureId: number; elapsedMs: number; manual?: boolean } | null;
  /** Creatures the player sent to the Zerlege-Kammer, waiting in order (before the automat's picks). */
  recycleQueue: number[];
  /** Sequenzier-Roboter: sequence the strongest unknown genomes into free slots. */
  autoSequence: boolean;
  /** Sim time of the last automation run. */
  lastRunMs: number;
}

export interface TowerRun {
  floor: number;
  team: number[];
  elapsedMs: number;
  startFloor: number;
}

export interface TowerState {
  /** Selected team (creature ids). */
  team: number[];
  run: TowerRun | null;
  /** Record: highest floor cleared (sets the checkpoint and the weekly boss; can be lowered in the options). */
  best: number;
  /** Highest record ever, also after lowering it: milestone bonuses, first-time rewards and conditions follow this. */
  bestEver: number;
  autoRestart: boolean;
  /** Where the auto-restart begins: like the last run started by hand (checkpoint or floor 1). */
  restartFromCheckpoint: boolean;
  /** Team members in the back row (creature ids); everyone else stands in front. */
  back: number[];
  /** Relikt per team place (relic id or null), same order as `team`. */
  relicSlots: (string | null)[];
  /** Personal leaderboard: best runs. */
  leaderboard: { floor: number; team: string[]; at: number }[];
  /** The most recent runs, newest first (missing startFloor in older saves). */
  history: { floor: number; startFloor: number; team: string[]; at: number }[];
  lastResult: {
    floor: number;
    win: boolean;
    log: string[];
    /** Replay data for the arena (missing in older saves). */
    /** `interval` (seconds between actions) and the event times `at` are missing in saves before the Aktionsleiste. */
    fighters?: { name: string; speciesId: string; element: string; maxHp: number; team: boolean; interval?: number; row?: 'front' | 'back' }[];
    events?: {
      at?: number; a: number; t: number; dmg: number; hp: number; m: number;
      kind?: 'miss' | 'heal' | 'shift' | 'tech' | 'status' | 'dot' | 'reflect';
      element?: string; tech?: string; status?: 'burn' | 'poison' | 'stun' | 'slow' | 'shield' | 'evade' | 'regen' | 'armor' | 'reflect'; until?: number; crit?: boolean; absorbed?: number;
    }[];
    /** Time of the fight (lastTickAt), so the UI replays each fight once. */
    at?: number;
  } | null;
}

/** A concrete requirement of an offered Gen-Auftrag (parameters rolled). */
export type ContractRequirement =
  | { kind: 'expresses'; locus: string; allele: string }
  | { kind: 'genotype'; locus: string; allele: string }
  | { kind: 'element'; element: string }
  | { kind: 'minTier'; tier: string }
  | { kind: 'topLoci'; count: number; homozygous: boolean }
  | { kind: 'minRarity'; rarity: string }
  | { kind: 'minGeneration'; generation: number };

export interface ContractOffer {
  template: string;
  requirements: ContractRequirement[];
  done: boolean;
}

export interface ContractsState {
  /** UTC day index of the current board (-1 = none yet). */
  day: number;
  offers: ContractOffer[];
  /** Exchanges used today. */
  rerolls: number;
  /** Completed contracts ever (drives the contract level; survives every reset). */
  completed: number;
}

/** A voyage that came back and waits for the player's decision. */
export interface VoyageReturn {
  destination: string;
  team: number[];
  events: string[];
  loot: Record<string, Decimal>;
  alleleSamples: number;
  decision: string;
}

export interface VoyageState {
  pending: VoyageReturn | null;
  /** Loot bonus carried to the next voyage (from a decision). */
  nextBonus: number;
}

export interface DailyState {
  /** Contract day of the last claim (-1 = never). */
  day: number;
  /** Next step of the Treue-Kalender (0 …). */
  step: number;
  claimed: number;
}

export interface WeeklyBossState {
  /** Week index of the current boss (-1 = none yet). */
  week: number;
  /** Contract day of the last attempt refill. */
  day: number;
  species: string;
  element: string;
  /** Floor the boss is built from (tower record at the start of the week). */
  floor: number;
  maxHp: number;
  damage: number;
  /** Reward tiers already paid out this week. */
  tiers: number;
  attempts: number;
  /** Last attack: damage and its length (`rounds` = seconds of fight time since the Aktionsleiste). */
  last: { damage: number; rounds: number } | null;
}

/** One finished prestige run (Vererbung, Äon) for the timeline. */
export interface PrestigeLogEntry {
  layer: string;
  /** Wall clock of the reset. */
  at: number;
  /** Currency gained. */
  gain: number;
  /** Wall-clock length of the run that ended (since the previous reset or the start). */
  runMs: number;
}

export interface MegaProjectState {
  /** Finished construction stages. */
  stage: number;
  /** Paid into the current stage so far. */
  paid: Record<string, Decimal>;
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
  /** Active play (see core/activity.ts): wall clock of the last active moment and the current session's length. */
  activity: { lastActiveAt: number; sessionMs: number };
  /** Active and total play time when a milestone was first reached (feature:…, achievement:…, tower:…). */
  milestones: Record<string, { activeMs: number; simMs: number }>;
  prestige: Record<string, { count: number }>;
  automation: AutomationState;
  /** Capsules opened since the last pity-qualifying result, per capsule. */
  capsulePity: Record<string, number>;
  tower: TowerState;
  talents: Record<string, boolean>;
  /**
   * Running anomaly challenge: difficulty stage per active anomaly (several at
   * once) and each goal's progress scale, frozen at the start (missing = 1).
   */
  anomaly: { levels: Record<string, number>; scales?: Record<string, number> } | null;
  anomaliesCompleted: Record<string, boolean>;
  /** Best stage mastered per anomaly (drives the reward). */
  anomalyBest: Record<string, number>;
  /** Highest total difficulty (sum of stages) of a completed anomaly run. */
  anomalyRecord: number;
  /** Stammbaum-Dynastien: deepest pure line ever bred per species (never reset). */
  dynasties: Record<string, number>;
  /** How bred creatures are named: Rufname + family, or the classic blend of the parents' names. */
  nameStyle: 'family' | 'classic';
  /** Family names the player gave (by renaming, „Kiko Sonnenschein“); they win over automatic ones. */
  playerFamilies: Record<string, boolean>;
  /** Perfection hunt per species: perfect genome / shiny found. */
  perfection: { perfect: Record<string, boolean>; shiny: Record<string, boolean> };
  contracts: ContractsState;
  voyage: VoyageState;
  daily: DailyState;
  /** Großforschung: completed levels per project (never reset). */
  grandResearch: Record<string, number>;
  /** Großprojekte: finished stages and what is paid into the current one (never reset). */
  megaProjects: Record<string, MegaProjectState>;
  /** Äon-Resonanz levels (never reset). */
  resonance: Record<string, number>;
  /** Relikt levels (never reset). */
  relics: Record<string, number>;
  /** Recent prestige runs, oldest first (capped by `balance.prestigeLogSize`). */
  prestigeLog: PrestigeLogEntry[];
  weeklyBoss: WeeklyBossState;
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
    activity: { lastActiveAt: 0, sessionMs: 0 },
    milestones: {},
    prestige: {},
    automation: { autoAssign: false, autoBreed: { enabled: false, rule: 'power', species: null, allele: null, budget: 1 },
      autoRecycle: { enabled: false, maxRarity: 'common', keepPerSpecies: 2, keepSequenced: true, when: 'always' }, recycling: null, recycleQueue: [], autoSequence: false, lastRunMs: 0 },
    capsulePity: {},
    tower: { team: [], back: [], run: null, best: 0, bestEver: 0, autoRestart: false, restartFromCheckpoint: true, relicSlots: [], leaderboard: [], history: [], lastResult: null },
    talents: {},
    anomaly: null,
    anomaliesCompleted: {},
    anomalyBest: {},
    anomalyRecord: 0,
    dynasties: {},
    nameStyle: 'family',
    playerFamilies: {},
    perfection: { perfect: {}, shiny: {} },
    contracts: { day: -1, offers: [], rerolls: 0, completed: 0 },
    voyage: { pending: null, nextBonus: 0 },
    daily: { day: -1, step: 0, claimed: 0 },
    grandResearch: {},
    megaProjects: {},
    resonance: {},
    relics: {},
    prestigeLog: [],
    weeklyBoss: { week: -1, day: -1, species: '', element: '', floor: 0, maxHp: 0, damage: 0, tiers: 0, attempts: 0, last: null },
  };
}

export function dexKey(species: string, rarity: string): string {
  return `${species}:${rarity}`;
}

export function resource(state: GameState, id: string): Decimal {
  return state.resources[id] ?? D(0);
}
