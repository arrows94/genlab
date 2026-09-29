import type { ResourceAmounts } from './types';
import type { ModifierDef } from '../modifiers';

/**
 * Shape of the central balancing file (`src/content/balance.ts`). Core logic
 * never contains tuning numbers; everything comes from here.
 */
export interface Balance {
  sim: {
    /** Fixed simulation step while the game is open. */
    tickMs: number;
    /** Step size used when catching up offline time (same logic, coarser steps). */
    offlineStepMs: number;
    /** Gaps longer than this (e.g. background tab) are handled as offline progress. */
    catchUpThresholdMs: number;
    autosaveSec: number;
  };
  offline: {
    /** Base cap for offline progress; extended by `offline.capHours` modifiers. */
    capHours: number;
    /** Offline summaries are only shown for absences longer than this. */
    summaryMinSec: number;
  };
  contracts: {
    /** Offers on the board per (UTC) day. */
    offersPerDay: number;
    /** Free exchanges of an open offer per day. */
    rerollsPerDay: number;
    /** Completed contracts needed for level 1, 2, 3 … */
    levelThresholds: number[];
    /** A new board appears at this hour (UTC) – 4 = early morning in Europe. */
    dayStartHourUtc: number;
  };
  voyage: {
    days: number;
    maxTeam: number;
    /** Events on the way (one per day, spread over the voyage). */
    events: number;
    cost: ResourceAmounts;
  };
  deepSequencing: {
    hours: number;
    cost: ResourceAmounts;
    /** Share of new (wild, start, capsule) creatures that carry an Erbanlage. */
    latentChance: number;
    /** Chance per parent to pass its Erbanlage on (hidden or not). */
    latentInherit: number;
    /** Chance for a new Erbanlage when none was inherited. */
    latentMutation: number;
    /** With the Urgen talent: chance to awaken an Urgen allele. */
    primalAwaken: number;
  };
  weeklyBoss: {
    /** The boss is built like the enemy of this floor (at least `minFloor`) from the tower record. */
    minFloor: number;
    /** Boss HP = enemy HP × this. Calibrated with a team that just holds its record: ~2.5–3.5 % per attempt, so a week (21 attempts) reaches 50–75 % and a growing team 100 %. */
    hpMult: number;
    atkMult: number;
    /** Rounds per attempt (the boss never dies inside one attempt). */
    rounds: number;
    attemptsPerDay: number;
    maxAttempts: number;
    /** Rewards when the total damage reaches `at` × boss HP (in order). */
    tiers: { at: number; rewards: ResourceAmounts }[];
  };
  grandResearch: {
    /** Parallel Großforschung projects (extendable via `slots.grandResearch`). */
    baseSlots: number;
  };
  timeCrystals: {
    /** Hours one crystal takes off a long project. */
    skipHours: number;
    /** Projects at least this long are "long": only crystals shorten them, potions don't. */
    longProjectHours: number;
    /** A crystal for every new tower record at a multiple of this floor. */
    towerEvery: number;
  };
  daily: {
    /**
     * Treue-Kalender: one step per claim (not per calendar day, so a break
     * costs nothing); after the last step it starts over.
     */
    rewards: { minutes?: number; resources?: ResourceAmounts; alleleSamples?: number }[];
  };
  notifications: {
    /** Only processes at least this long announce their end (no pings for 20 s eggs). */
    minDurationSec: number;
    /** Same-kind completions within this window share one notification. */
    groupSec: number;
  };
  start: {
    resources: ResourceAmounts;
    species: string;
    rarity: string;
  };
  collect: {
    /** Base amounts per manual click (modified by `collect.<resource>`). */
    amounts: ResourceAmounts;
  };
  production: {
    /** Each point of the building's work stat adds this fraction of output. */
    statScaling: number;
    /** Type advantage: extra output (0.3 = +30 %) for creatures of one of the building's `elements`. */
    affinityBonus: number;
  };
  rarity: {
    /** Base drop weights (modified by `rarity.weight.<id>`, pct/mult). */
    weights: Record<string, number>;
    statMultiplier: Record<string, number>;
  };
  creature: {
    /** ± random variance applied to base stats of newly created creatures. */
    statVariance: number;
    hueVariance: number;
    maxNameLength: number;
    /** Classic naming (option): blend of the parents' names within these lengths. */
    classicName: { minLength: number; maxLength: number; attempts: number };
    /** Longest Rufname (the family name gets the rest of maxNameLength). */
    maxGivenLength: number;
    /** Chance that a child gets a fresh Rufname instead of a blend of its parents'. */
    freshNameChance: number;
    /** Creatures of this rarity and better (and shiny ones) get a Beiname. */
    epithetFromRarity: string;
    /** Offspring names are blended from the parents' names within these limits. */
  };
  abilities: {
    /** Chance for the 1st, 2nd, 3rd … ability when a creature is created without parents. */
    slotChances: number[];
    /** Tier (rarity id) weights when rolling a new ability. */
    tierWeights: Record<string, number>;
    max: number;
  };
  breeding: {
    baseTimeSec: number;
    /** Each generation of the offspring adds this fraction of base time. */
    timePerGeneration: number;
    /**
     * Cost components: base × generationGrowth^(offspring generation − 2)
     * × creatureGrowth^(creatures owned − 1); only from `fromGeneration` on.
     */
    costs: { resource: string; base: number; generationGrowth: number; creatureGrowth: number; fromGeneration: number }[];
    /** Base mutation chance (modified by `breeding.mutation` add). */
    mutationChance: number;
    /** Stat mutation: multiplier range applied to a mutated stat. */
    mutationStatRange: [number, number];
    /** Chance each parent ability is passed on. */
    abilityInheritChance: number;
    /** Base nest slots (modified by `slots.nest`). */
    baseNests: number;
    /** Ritualnest places for the Besondere Brut (next to the normal nests, `slots.ritualNest`). */
    ritualNests: number;
  };
  genetics: {
    /** Allele mutation chance = breeding mutation chance × this factor (per inherited allele). */
    alleleMutationFactor: number;
    sequencing: {
      baseTimeSec: number;
      cost: Record<string, number>;
      /** Extra cost fraction per generation of the creature. */
      costPerGeneration: number;
      baseSlots: number;
    };
    splicing: {
      cost: Record<string, number>;
      /** Cost multiplier per splice already applied to the creature. */
      costGrowth: number;
      maxPerCreature: number;
      /** Base chance a splice fails and scrambles another locus (modified by `splicing.instability`). */
      instability: number;
    };
  };
  hybrids: {
    /** Recipe hint chance per hour of expedition (scaled by mission length, capped at 1). */
    hintChancePerHour: number;
  };
  stable: {
    /** Base creature capacity (modified by `slots.stable`). */
    baseCapacity: number;
  };
  sell: {
    /** Resources per sold creature by rarity. */
    valueByRarity: Record<string, Record<string, number>>;
    /** +x per generation above 1. */
    perGeneration: number;
  };
  infusion: {
    epByRarity: Record<string, number>;
    epPerGeneration: number;
    maxLevel: number;
    /** EP needed for level L: base × growth^(L−1). */
    levelEpBase: number;
    levelEpGrowth: number;
    /** Stat bonus per infusion level (all stats, pct). */
    statPerLevel: number;
    /** Chance per sequenced victim to pass on a better allele. */
    alleleTransferChance: number;
    /** Breakthrough cost by the creature's current rarity. */
    breakthroughCost: Record<string, Record<string, number>>;
    /** Highest rarity reachable by breakthrough. */
    maxBreakthroughRarity: string;
  };
  recycler: {
    fragmentsByRarity: Record<string, number>;
    perGeneration: number;
    /** Seconds the Recycling-Automat needs per creature (× `recycler.time` modifiers). */
    autoSec: number;
    /** Seconds per creature the player sent (lab, detail view) – also × `recycler.time`. */
    manualSec: number;
    /** Lower bound for both times. */
    autoMinSec: number;
  };
  activity: {
    /** Without input for this long, time no longer counts as active. */
    idleSec: number;
    /** A pause longer than this starts a new session. */
    sessionGapSec: number;
    /** Largest step counted at once (a sleeping device must not add hours). */
    maxTickSec: number;
    /** Tower records that stamp a milestone. */
    towerMilestones: number[];
  };
  automation: {
    intervalSec: number;
  };
  tower: {
    fightIntervalSec: number;
    baseTeamSize: number;
    /**
     * Aktionsleiste: each fighter acts every (mean speed of the fight / own
     * speed)^speedExponent seconds of fight time – relative, so it works on every floor.
     */
    speedExponent: number;
    /** Fight time limit in seconds (a draw counts as a defeat). */
    maxFightSec: number;
    /** Dodge chance per 100 % speed lead of the defender over the attacker … */
    evadePerSpeedLead: number;
    /** … capped at this. */
    maxEvade: number;
    /** Extra share blocked after the percentage: defRatio × VER / (VER + attacker's ANG). */
    defRatio: number;
    /** Chance that an enemy attack goes to the front row (when both rows are occupied). */
    frontShare: number;
    enemyBase: Record<string, number>;
    /** Enemy stats × growth^(floor − 1). */
    enemyGrowth: number;
    bossEvery: number;
    bossHpMult: number;
    bossAtkMult: number;
    strongMult: number;
    weakMult: number;
    /** Damage = atk × mult × defScale / (defScale + def). */
    defScale: number;
    tokensPerFloor: number;
    tokenGrowthPerFloor: number;
    catalystEvery: number;
    alleleEvery: number;
    leaderboardSize: number;
    /** Number of recent runs kept in the tower history. */
    historySize: number;
    checkpointEvery: number;
    /** Bosses from this floor on have a trait (`bossTraits`). */
    bossTraitFromFloor: number;
    /** A new record on every multiple of this floor is a milestone. */
    milestoneEvery: number;
    /** Äon-Splitter for reaching a milestone the first time. */
    milestoneShards: number;
    /** Permanent bonus per milestone reached (stacks). */
    milestoneModifiers: ModifierDef[];
  };
  anomalies: {
    /** Highest difficulty stage (I–V). */
    maxLevel: number;
    /** Countable goals × goalGrowth^(stage − 1). */
    goalGrowth: number;
    /**
     * Earned-resource goals also grow with the player's progress: × (production
     * multiplier of that resource when the run starts)^progressExponent.
     */
    progressExponent: number;
    /** Äon-Splitter per point of a new record in total difficulty (sum of the stages of one run). */
    shardsPerRecordPoint: number;
    /** Permanent bonus per point of the record in total difficulty. */
    recordModifiers: ModifierDef[];
  };
  dynasty: {
    /** Stat bonus per generation of a creature's own pure line. */
    statPerDepth: number;
    /** Cap of that bonus. */
    maxDepthBonus: number;
    /** Line depths of the dynasty tiers (record per species). */
    tiers: number[];
    /** Stat bonus per tier for every creature of that species. */
    statPerTier: number;
    /** Äon-Splitter for reaching each tier (same order as `tiers`). */
    shardsPerTier: number[];
    /** Permanent bonus per tier, summed over all species. */
    modifiersPerTier: ModifierDef[];
  };
  perfection: {
    /** Base chance for the "Schillernd" colour mutation (modified by `creature.shinyChance`). */
    shinyChance: number;
  };
  missions: {
    baseCamps: number;
    /** Each point of speed adds this fraction to rewards. */
    statScaling: number;
  };
  market: {
    /** Per-creature cost growth for permanent stat potions is on the potion; this caps uses. */
    maxBoostsPerStat: number;
  };
  appearance: {
    patterns: string[];
    eyes: string[];
    horns: string[];
    /** Chance a visual trait mutates instead of being inherited. */
    mutationChance: number;
  };
  prestige: Record<string, { divisor: number; exponent: number; minGain: number }>;
  /** Weekly mutation: weeks since this epoch day decide the active rule. */
  weekly: { epoch: string };
}
