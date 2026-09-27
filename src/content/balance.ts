import type { Balance } from '@core/content/balance';

/**
 * Central balancing. Tune the game here without touching any logic.
 * Times in ms/sec as named, probabilities as weights or 0–1.
 */
export const balance: Balance = {
  sim: {
    tickMs: 100,
    offlineStepMs: 1000,
    catchUpThresholdMs: 5_000,
    autosaveSec: 15,
  },
  offline: {
    capHours: 12,
    summaryMinSec: 60,
  },
  start: {
    resources: { food: 0, gold: 0, essence: 0, heritage: 0 },
    species: 'emberpup',
    rarity: 'common',
  },
  collect: {
    amounts: { food: 1 },
  },
  production: {
    statScaling: 0.02,
  },
  rarity: {
    weights: { common: 600, uncommon: 250, rare: 100, epic: 38, legendary: 10, mythic: 2 },
    statMultiplier: { common: 1, uncommon: 1.15, rare: 1.35, epic: 1.6, legendary: 2, mythic: 2.75 },
  },
  creature: {
    statVariance: 0.1,
    hueVariance: 18,
    maxNameLength: 20,
  },
  appearance: {
    patterns: ['none', 'spots', 'stripes', 'rings'],
    eyes: ['round', 'sleepy', 'sharp', 'wide'],
    horns: ['none', 'nub', 'curved', 'antenna'],
  },
  prestige: {
    inheritance: { divisor: 1e5, exponent: 0.5, minGain: 1 },
  },
};
