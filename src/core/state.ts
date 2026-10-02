import { D, type Decimal } from './num';
import type { RngState } from './rng';
import type { ModifierDef } from './modifiers';
import type { RpgRoomKind, StatusId } from './content/types';

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
  kind: 'building' | 'nest' | 'mission' | 'lab' | 'tower' | 'rpg';
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
    fighters?: FightFighterSnapshot[];
    /** Totals of the fight (missing in older saves). */
    stats?: FightStats;
    events?: {
      at?: number; a: number; t: number; dmg: number; hp: number; m: number;
      kind?: 'miss' | 'heal' | 'shift' | 'tech' | 'status' | 'dot' | 'reflect' | 'phase' | 'sweep' | 'enrage'; trait?: string;
      element?: string; tech?: string; status?: 'burn' | 'poison' | 'stun' | 'slow' | 'shield' | 'evade' | 'regen' | 'armor' | 'reflect'; until?: number; crit?: boolean; absorbed?: number;
    }[];
    /** Time of the fight (lastTickAt), so the UI replays each fight once. */
    at?: number;
  } | null;
  /** Kampferfahrung from won floors – belongs to the player, survives every reset. */
  xp: number;
  /** When the record last rose (lastTickAt; 0 = not yet known) and the Entschlossenheit bonus built up since. */
  recordAt: number;
  resolve: number;
  /**
   * Checkpoints the auto-restart steps back: a run that loses its very first floor lets the next
   * auto-restart begin one checkpoint lower (after a reset the stable is weaker than at the record);
   * clearing a checkpoint floor climbs back up, a run started by hand tries the real checkpoint.
   */
  retreat: number;
  /** The fight that ended the latest lost run – for the defeat analysis (kept while later runs climb towards it). */
  lastDefeat: { floor: number; at: number; fighters: FightFighterSnapshot[]; stats: FightStats } | null;
}

/** A fighter of a tower fight as the arena and the defeat analysis see it. */
export interface FightFighterSnapshot {
  name: string;
  speciesId: string;
  element: string;
  maxHp: number;
  team: boolean;
  interval?: number;
  row?: 'front' | 'back';
  boss?: boolean;
}

/**
 * Totals of one tower fight. Arrays are per fighter, in the order of the
 * fight's fighters (team first, then the foes).
 */
export interface FightStats {
  /** Damage done to the other side (hits, techniques, burn/poison, thorns). */
  dealt: number[];
  /** Damage taken (after shields). */
  taken: number[];
  /** HP healed on this fighter (techniques, regeneration). */
  healed: number[];
  /** Hits that landed, and those with element advantage (strong) or disadvantage (weak). */
  hits: number[];
  strong: number[];
  weak: number[];
  /** Own attacks the target dodged, and attacks this fighter dodged. */
  missed: number[];
  dodged: number[];
  /** HP at the end (0 = down) and the fight time it fell (-1 = still standing). */
  hpLeft: number[];
  downAt: number[];
  /** Damage of team hits an Element-Schild swallowed. */
  shielded: number;
  /** The time limit ended the fight. */
  timeout: boolean;
  /** Fight time in seconds when it ended. */
  seconds: number;
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

/** A status in the dungeon, counted in rounds. burn/poison/regen: HP per round, shield: HP left to absorb, else a share. */
export interface RpgStatus {
  id: StatusId;
  rounds: number;
  value: number;
}

/** One side of a dungeon fight. */
export interface RpgCombatant {
  name: string;
  speciesId: string;
  element: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  statuses: RpgStatus[];
}

export interface RpgFoe extends RpgCombatant {
  /** `rpgEnemies` id. */
  enemy: string;
  kind: 'normal' | 'elite' | 'boss';
  /** Position in the move pattern: the shown next move. */
  step: number;
  /** Level in the other world (missing in fights started before it existed). */
  level?: number;
}

/** What happened in the latest round (for sounds and hit animations). */
export interface RpgEvent {
  by: 'hero' | 'foe';
  kind: 'hit' | 'miss' | 'heal' | 'skill';
  /** Damage of a hit and its element factor (> 1 strong, < 1 weak). */
  dmg?: number;
  m?: number;
  crit?: boolean;
  /** An element technique, third skill or special (not the basic attack). */
  special?: boolean;
}

/** A running fight: the hero chooses a skill, then both act in speed order. */
export interface RpgBattle {
  hero: RpgCombatant;
  foe: RpgFoe;
  round: number;
  /** Rounds until a skill is ready again (skill id → rounds, missing = ready). */
  cooldowns: Record<string, number>;
  /** Special attack charge, 0 … 1. */
  charge: number;
  /** Latest lines of the fight, newest last. */
  log: string[];
  /** Events of the latest round (missing in fights started before they existed). */
  last?: RpgEvent[];
}

/** How a fight ended, shown until the player moves on: the last round, what it brought and what it cost. */
export interface RpgAftermath {
  win: boolean;
  /** The fight as it stood after the last round. */
  battle: RpgBattle;
  /** XP gained and the monster's level before and after (a defeat gives none). */
  xp: number;
  levelFrom: number;
  levelTo: number;
  /** Loot and equipment this fight dropped. */
  loot: Record<string, number>;
  gear: RpgItem[];
}

/** A run of the GenLab RPG: one monster, levels only count inside the run (roguelite). */
export interface RpgRun {
  creatureId: number;
  /** `rpgDungeons` id. */
  dungeon: string;
  /** Rooms offered next (pick one); empty while inside a room. */
  choices: RpgRoomKind[];
  /** The room the hero is in (a fight not yet won, an event not yet decided), null between rooms. */
  room: RpgRoomKind | null;
  /** Event waiting for the player's choice (`rpgEvents` id). */
  event: string | null;
  /** Result text of the last event choice (until the next room). */
  eventResult: string | null;
  /** Current HP (they carry over from room to room). */
  hp: number;
  /** The monster's level when the run began (its level itself lives in `RpgState.ranks`). */
  startLevel: number;
  /** Upgrades chosen this run (ids, may repeat) – they only last for the run. */
  upgrades: string[];
  /** Upgrades offered and not chosen yet (empty = none waiting). */
  offer: string[];
  /** Further offers waiting after the current one. */
  pendingLevels: number;
  /** Rooms cleared so far. */
  depth: number;
  /** The rooms entered, in order (missing in runs started before it existed). */
  path?: RpgRoomKind[];
  /** Loot carried but not yet safe: lost in part on a defeat. */
  loot: Record<string, number>;
  /** Loot already made safe this run (paid out at the moment it was secured). */
  secured: Record<string, number>;
  /** Equipment found and still carried (lost on a defeat), and equipment already made safe this run. */
  gear: RpgItem[];
  securedGear: RpgItem[];
  /** Wall clock of the start. */
  startedAt: number;
  battle: RpgBattle | null;
  /** The fight just won, until the player goes on (missing = nothing to show). */
  aftermath?: RpgAftermath | null;
}

/** A piece of equipment the player owns. */
export interface RpgItem {
  id: number;
  /** `rpgGear` id. */
  gear: string;
  rarity: string;
}

/** How the last run ended, for the summary. */
export interface RpgResult {
  win: boolean;
  /** The monster of the run (missing in older results). */
  creatureId?: number;
  dungeon: string;
  /** The boss fell. */
  cleared: boolean;
  depth: number;
  /** The monster's level at the start (missing in older results) and at the end. */
  startLevel?: number;
  level: number;
  /** Everything the run paid out (secured, kept after a defeat or brought home). */
  loot: Record<string, number>;
  /** Equipment the run brought home. */
  gear: RpgItem[];
  /** What a defeat cost: carried loot left behind and carried equipment lost. */
  lost?: Record<string, number>;
  lostGear?: RpgItem[];
  /** The fight that ended the run (boss won or fight lost). */
  fight?: RpgAftermath;
  at: number;
}

/** GenLab RPG: a single monster in an active, turn-based dungeon (see `features/rpg.ts`). */
export interface RpgState {
  /** Wall clock the refill of the next Fackel started (0 = stock full, -1 = never unlocked: fill up once). */
  torchAt: number;
  run: RpgRun | null;
  lastResult: RpgResult | null;
  /** Runs started ever. */
  runs: number;
  /** Boss victories per dungeon (a clear opens the next dungeon). */
  cleared: Record<string, number>;
  /** Deepest room reached per dungeon. */
  best: Record<string, number>;
  /** XP in the other world per creature id (their level there, see `rpgLevel`) – it goes with the creature. */
  ranks: Record<string, number>;
  /** Capped loot paid out this week (`balance.rpg.weeklyCap`). */
  weekly: { week: number; got: Record<string, number> };
  /** Equipment owned (survives every reset) and what is worn – by whichever monster goes in. */
  items: RpgItem[];
  equipped: Record<'weapon' | 'armor' | 'charm', number | null>;
  nextItemId: number;
  /** Lasting progress bought with Runen (`rpgMeta` id → level). */
  meta: Record<string, number>;
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
  /** Wall-clock times of recent Zeittränke (their price grows with each one in the window). */
  timeSkips: number[];
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
  /** The last pair bred by hand (Zuchtbuch: „↻ Letztes Paar“). */
  lastPair: { a: number; b: number; ritual: string | null } | null;
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
  rpg: RpgState;
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
    timeSkips: [],
    nextId: 1,
    dex: {},
    geneLibrary: {},
    recipeHints: {},
    achievements: {},
    statistics: {},
    activity: { lastActiveAt: 0, sessionMs: 0 },
    milestones: {},
    prestige: {},
    lastPair: null,
    automation: { autoAssign: false, autoBreed: { enabled: false, rule: 'power', species: null, allele: null, budget: 1 },
      autoRecycle: { enabled: false, maxRarity: 'common', keepPerSpecies: 2, keepSequenced: true, when: 'always' }, recycling: null, recycleQueue: [], autoSequence: false, lastRunMs: 0 },
    capsulePity: {},
    tower: { team: [], back: [], run: null, best: 0, bestEver: 0, autoRestart: false, restartFromCheckpoint: true, relicSlots: [], leaderboard: [], history: [], lastResult: null, lastDefeat: null, xp: 0, recordAt: 0, resolve: 0, retreat: 0 },
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
    rpg: { torchAt: -1, run: null, lastResult: null, runs: 0, cleared: {}, best: {}, ranks: {}, weekly: { week: -1, got: {} }, items: [], equipped: { weapon: null, armor: null, charm: null }, nextItemId: 1, meta: {} },
  };
}

export function dexKey(species: string, rarity: string): string {
  return `${species}:${rarity}`;
}

export function resource(state: GameState, id: string): Decimal {
  return state.resources[id] ?? D(0);
}

/** Drops references to creatures that no longer exist (tower rows, the RPG hero). */
export function pruneCreatureRefs(state: GameState, exists: (id: number) => boolean): void {
  state.tower.team = state.tower.team.filter(exists);
  state.tower.back = state.tower.back.filter(exists);
  if (state.rpg.run && !exists(state.rpg.run.creatureId)) state.rpg.run = null;
}
