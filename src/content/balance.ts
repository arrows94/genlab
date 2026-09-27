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
    resources: { food: 0, gold: 0, essence: 0, catalyst: 0, fragments: 0, heritage: 0 },
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
  abilities: {
    slotChances: [0.35, 0.15, 0.05],
    tierWeights: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 },
    max: 3,
  },
  breeding: {
    baseTimeSec: 20,
    timePerGeneration: 0.15,
    costs: [
      { resource: 'food', base: 30, generationGrowth: 1.6, creatureGrowth: 1.1, fromGeneration: 2 },
      { resource: 'gold', base: 20, generationGrowth: 1.6, creatureGrowth: 1.1, fromGeneration: 3 },
    ],
    mutationChance: 0.08,
    mutationStatRange: [1.05, 1.25],
    abilityInheritChance: 0.5,
    baseNests: 1,
  },
  genetics: {
    alleleMutationFactor: 0.5,
    sequencing: {
      baseTimeSec: 60,
      cost: { essence: 5 },
      costPerGeneration: 0.2,
      baseSlots: 1,
    },
    splicing: {
      cost: { essence: 80, gold: 2000 },
      costGrowth: 2.5,
      maxPerCreature: 3,
      instability: 0.25,
    },
  },
  hybrids: {
    hintChancePerHour: 0.4,
  },
  stable: {
    baseCapacity: 20,
  },
  sell: {
    valueByRarity: {
      common: { gold: 10 },
      uncommon: { gold: 30 },
      rare: { gold: 90, essence: 1 },
      epic: { gold: 300, essence: 5 },
      legendary: { gold: 1000, essence: 20 },
      mythic: { gold: 5000, essence: 100 },
    },
    perGeneration: 0.1,
  },
  infusion: {
    epByRarity: { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 400, mythic: 1000 },
    epPerGeneration: 0.1,
    maxLevel: 10,
    levelEpBase: 20,
    levelEpGrowth: 1.7,
    statPerLevel: 0.05,
    alleleTransferChance: 0.05,
    breakthroughCost: {
      common: { catalyst: 1, essence: 50 },
      uncommon: { catalyst: 2, essence: 150 },
      rare: { catalyst: 4, essence: 400 },
      epic: { catalyst: 8, essence: 1200 },
    },
    maxBreakthroughRarity: 'legendary',
  },
  recycler: {
    fragmentsByRarity: { common: 1, uncommon: 3, rare: 8, epic: 25, legendary: 80, mythic: 250 },
    perGeneration: 0.05,
  },
  automation: {
    intervalSec: 5,
  },
  missions: {
    baseCamps: 1,
    statScaling: 0.02,
  },
  market: {
    maxBoostsPerStat: 10,
  },
  appearance: {
    patterns: ['none', 'spots', 'stripes', 'rings'],
    eyes: ['round', 'sleepy', 'sharp', 'wide'],
    horns: ['none', 'nub', 'curved', 'antenna'],
    mutationChance: 0.1,
  },
  prestige: {
    inheritance: { divisor: 1e5, exponent: 0.5, minGain: 1 },
  },
};
