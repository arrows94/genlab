import type { ResourceAmounts } from './types';

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
  };
  automation: {
    intervalSec: number;
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
}
