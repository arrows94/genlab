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
  appearance: {
    patterns: string[];
    eyes: string[];
    horns: string[];
  };
  prestige: Record<string, { divisor: number; exponent: number; minGain: number }>;
}
