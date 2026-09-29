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
  contracts: {
    offersPerDay: 3,
    rerollsPerDay: 1,
    levelThresholds: [0, 4, 12, 30, 60],
    dayStartHourUtc: 4,
  },
  voyage: {
    days: 7,
    maxTeam: 3,
    events: 6,
    cost: { food: 20000, gold: 5000 },
  },
  deepSequencing: {
    hours: 8,
    cost: { essence: 250 },
    latentChance: 0.35,
    latentInherit: 0.5,
    latentMutation: 0.1,
    primalAwaken: 0.25,
  },
  grandResearch: {
    baseSlots: 1,
  },
  weeklyBoss: {
    minFloor: 10,
    hpMult: 25,
    atkMult: 1.5,
    rounds: 30,
    attemptsPerDay: 3,
    maxAttempts: 6,
    tiers: [
      { at: 0.1, rewards: { towerTokens: 30 } },
      { at: 0.25, rewards: { towerTokens: 60, catalyst: 2 } },
      { at: 0.5, rewards: { towerTokens: 120, timeCrystals: 1 } },
      { at: 0.75, rewards: { towerTokens: 200, catalyst: 5 } },
      { at: 1, rewards: { towerTokens: 400, timeCrystals: 2, aeonShards: 1 } },
    ],
  },
  timeCrystals: {
    skipHours: 4,
    longProjectHours: 1,
    towerEvery: 25,
  },
  daily: {
    rewards: [
      { minutes: 10, resources: { essence: 20 } },
      { minutes: 15, resources: { essence: 30 } },
      { minutes: 20, resources: { fragments: 15 } },
      { minutes: 25, resources: { essence: 50 } },
      { minutes: 30, resources: { catalyst: 1 } },
      { minutes: 40, resources: { essence: 80, fragments: 25 } },
      { minutes: 60, resources: { essence: 150, catalyst: 3, timeCrystals: 2 }, alleleSamples: 1 },
    ],
  },
  notifications: {
    minDurationSec: 120,
    groupSec: 300,
  },
  start: {
    resources: { food: 0, gold: 0, essence: 0, catalyst: 0, fragments: 0, heritage: 0, towerTokens: 0, aeonShards: 0 },
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
      { resource: 'food', base: 30, generationGrowth: 1.5, creatureGrowth: 1.04, fromGeneration: 2 },
      { resource: 'gold', base: 20, generationGrowth: 1.5, creatureGrowth: 1.04, fromGeneration: 3 },
    ],
    mutationChance: 0.08,
    mutationStatRange: [1.05, 1.25],
    abilityInheritChance: 0.5,
    baseNests: 1,
    ritualNests: 1,
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
    autoSec: 180,
    autoMinSec: 1,
  },
  automation: {
    intervalSec: 5,
  },
  tower: {
    fightIntervalSec: 8,
    baseTeamSize: 3,
    maxRounds: 40,
    enemyBase: { hp: 60, atk: 9, def: 5, spd: 6 },
    enemyGrowth: 1.11,
    bossEvery: 10,
    bossHpMult: 2.2,
    bossAtkMult: 1.3,
    strongMult: 1.5,
    weakMult: 0.7,
    defScale: 50,
    tokensPerFloor: 2,
    tokenGrowthPerFloor: 0.1,
    catalystEvery: 10,
    alleleEvery: 25,
    leaderboardSize: 3,
    historySize: 10,
    checkpointEvery: 10,
    bossTraitFromFloor: 20,
    milestoneEvery: 50,
    milestoneShards: 3,
    milestoneModifiers: [
      { target: 'tower.damage', op: 'pct', value: 0.15 },
      { target: 'production.food', op: 'pct', value: 0.1 },
      { target: 'production.gold', op: 'pct', value: 0.1 },
      { target: 'production.essence', op: 'pct', value: 0.1 },
    ],
  },
  anomalies: {
    maxLevel: 5,
    goalGrowth: 4,
    progressExponent: 1,
    shardsPerRecordPoint: 1,
    recordModifiers: [
      { target: 'production.food', op: 'pct', value: 0.025 },
      { target: 'production.gold', op: 'pct', value: 0.025 },
      { target: 'production.essence', op: 'pct', value: 0.025 },
      { target: 'prestige.inheritance.gain', op: 'pct', value: 0.015 },
    ],
  },
  perfection: {
    shinyChance: 0.0005,
  },
  dynasty: {
    statPerDepth: 0.01,
    maxDepthBonus: 0.5,
    tiers: [5, 10, 20, 35, 50],
    statPerTier: 0.05,
    shardsPerTier: [0, 0, 0, 2, 3],
    modifiersPerTier: [
      { target: 'production.food', op: 'pct', value: 0.01 },
      { target: 'production.gold', op: 'pct', value: 0.01 },
      { target: 'production.essence', op: 'pct', value: 0.01 },
    ],
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
    aeon: { divisor: 25, exponent: 0.5, minGain: 1 },
  },
  weekly: { epoch: '2024-01-01' },
};
