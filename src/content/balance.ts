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
  rewards: {
    // Bonuses such as `contracts.reward` never multiply these (rare currencies stay fixed).
    unscaled: ['aeonShards', 'timeCrystals', 'catalyst', 'germOil'],
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
    // Brought home on top of the destination's loot (resources of locked features stay out).
    bonus: { timeCrystals: 2, torches: 3 },
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
    minFloor: 30,
    hpMult: 15,
    // Weak enough that a team near the record lasts most of the fight: the damage then follows the
    // team's strength smoothly instead of dropping off a cliff when the titan knocks it out in seconds.
    atkMult: 0.5,
    // Seconds of fight time per attack (same fight as in the tower).
    fightSec: 30,
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
  rpg: {
    // Fackeln: one per run; they come back by the real clock, a small stock saves up for a day off.
    torchHours: 6,
    maxTorches: 3,
    // Every Tagesbelohnung brings Fackeln too (the last, big day of the calendar more); may go beyond the stock.
    dailyTorches: 1,
    dailyTorchesLast: 2,
    // Every fulfilled Gen-Auftrag brings a Fackel too.
    contractTorches: 1,
    // A defeat keeps this share of the carried loot (secured loot is always safe).
    // Share of the carried loot a defeat keeps – the rest stays as a Blutfleck in the dungeon.
    defeatKeep: 0,
    // Element techniques in the dungeon: tower seconds become rounds (2 s = 1 round), then a cooldown.
    secondsPerRound: 2,
    techniqueCooldown: 3,
    // Foes: base stats of their species, grown by their level like the hero, × these (a duel of one hero).
    enemyMult: { hp: 0.75, atk: 0.6, def: 0.9, spd: 1 },
    // Foe moves: heavy blow after charging, shield against this round's hits, healing.
    heavyMult: 2.2,
    guardShare: 0.3,
    healShare: 0.2,
    // Special attack: charged by rounds, own hits and hits taken (1 = ready).
    chargePerRound: 0.1,
    chargePerHit: 0.1,
    chargeWhenHit: 0.15,
    logSize: 8,
    // Wut like in the tower: from round enrageAfter on the foe hits enrageGrowth harder every round (no endless fights).
    enrageAfter: 15,
    enrageGrowth: 0.2,
    // Dungeon: after each room 2–3 ways, drawn by these weights. Treasure and camps are rare: recovery is earned
    // at the Leuchtfeuer behind the guardian.
    choices: [2, 3],
    roomWeights: { fight: 56, elite: 16, treasure: 4, rest: 3, event: 12 },
    // Isekai: in the other world every monster starts at level 1 with its species' base stats – breeding does not
    // count there. The level stays with the monster: XP per won fight, level n → n+1 needs xpBase × xpGrowth^(n − 1);
    // each level adds statsPerLevel of the base stats and heals a little. Every level-up (and every won elite fight)
    // offers upgradeChoices upgrades that only last for the run.
    xp: { fight: 10, elite: 25, boss: 40 },
    // XP of a foe grows with its level (× xpFoeGrowth per level), so deeper dungeons keep the levels coming.
    xpFoeGrowth: 1.17,
    xpBase: 20,
    xpGrowth: 1.25,
    maxLevel: 60,
    statsPerLevel: 0.12,
    // The species shapes a monster there (quick, tough …) on a common yardstick; hybrids and mythic forms are stronger.
    tierMult: { base: 1, hybrid: 1.15, rareHybrid: 1.3, mythic: 1.5 },
    levelHeal: 0.15,
    upgradeChoices: 3,
    eliteUpgrade: true,
    // Halfway through every dungeon a guardian blocks the way: a fixed elite fight.
    guardianAt: 0.5,
    // A camp (rare room) heals this share of max HP and secures the carried loot.
    restHeal: 0.4,
    // The Leuchtfeuer right after the guardian heals this share, secures the loot and refills the Heiltränke.
    bonfireHeal: 1,
    // Dark Souls: every move costs stamina, regen comes back each round (Verschnaufen: + breathe on top).
    stamina: { max: 100, regen: 20, breathe: 40, cost: { basic: 25, technique: 40, third: 35, special: 45, defense: 20, item: 0 } },
    // Ausweichen: a damaging foe move misses with this chance. Parieren: a normal attack is caught with parryChance –
    // the foe staggers (skips its next move) and the hero counters with riposteMult; against a heavy blow, a technique
    // or a failed parry the hit lands × parryFailMult.
    dodgeChance: 0.9,
    parryChance: 0.75,
    parryFailMult: 1.5,
    riposteMult: 2.5,
    // Heiltränke per run (like Estus): drinking costs the turn, the Leuchtfeuer refills them.
    flasks: 3,
    // Bosses change into their second phase below this share of their HP.
    bossPhaseAt: 0.5,
    // Gleichgewicht: every hit fills the target's poise by perHit × its strength (a heavy blow 2.2×, the special 3×).
    // Full = staggered: it skips its next move and the next hit against it is critical. A round without a hit
    // takes regen off. Your monster can be staggered too.
    poise: { perHit: 20, hero: 70, normal: 50, elite: 90, boss: 150, regen: 20 },
    // Loot per room: fixed amounts × the dungeon's loot factor, plus chances (× loot factor, at most 1) for one piece.
    // `alleleSamples` is no resource: each one catalogues an allele missing in the gene library.
    loot: {
      fight: { fixed: { towerTokens: 3 }, chance: { catalyst: 0.08, alleleSamples: 0.05, runes: 0.2 } },
      elite: { fixed: { towerTokens: 8, runes: 2 }, chance: { catalyst: 0.35, alleleSamples: 0.25, timeCrystals: 0.1 } },
      treasure: { fixed: { towerTokens: 6, runes: 1 }, chance: { catalyst: 0.25, alleleSamples: 0.3, timeCrystals: 0.08 } },
      boss: { fixed: { towerTokens: 25, catalyst: 1, runes: 8 }, chance: { timeCrystals: 0.5, alleleSamples: 0.5, aeonShards: 0.04 } },
    },
    // Equipment: chance per room kind (× loot factor, at most 1), rarity by weights – deeper dungeons shift them
    // up (weight × (1 + (loot − 1) × gearRarityShift × rarity order)); rarer pieces multiply their values.
    gearChance: { fight: 0.04, elite: 0.3, treasure: 0.15, boss: 1 },
    gearRarityWeights: { common: 60, uncommon: 26, rare: 10, epic: 3.5, legendary: 0.5, mythic: 0 },
    gearRarityShift: 0.35,
    gearRarityMult: { common: 1, uncommon: 1.35, rare: 1.8, epic: 2.4, legendary: 3.2, mythic: 4.2 },
    maxItems: 40,
    // Taking equipment apart gives Runen by rarity (also for pieces found while the collection is full).
    salvage: { common: 2, uncommon: 4, rare: 8, epic: 16, legendary: 32, mythic: 64 },
    // The most valuable loot has a weekly limit, so the idle game never depends on the dungeon.
    weeklyCap: { timeCrystals: 6, aeonShards: 2 },
  },
  timeCrystals: {
    skipHours: 4,
    longProjectHours: 1,
    towerEvery: 75,
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
    // Clicking at the refill rate adds about +25 % food production for an active player.
    productionSeconds: 0.1,
    stamina: { max: 50, perSec: 2.5 },
    finds: { chance: 0.01, cooldownSec: 180, clicks: 10, productionSeconds: 30 },
  },
  production: {
    statScaling: 0.02,
    /** Type advantage: creatures of a building's elements produce this much more (0.3 = +30 %). */
    affinityBonus: 0.3,
  },
  rarity: {
    weights: { common: 600, uncommon: 250, rare: 100, epic: 38, legendary: 10, mythic: 2 },
    statMultiplier: { common: 1, uncommon: 1.15, rare: 1.35, epic: 1.6, legendary: 2, mythic: 2.75 },
  },
  creature: {
    statVariance: 0.1,
    hueVariance: 18,
    maxNameLength: 25,
    classicName: { minLength: 4, maxLength: 12, attempts: 12 },
    maxGivenLength: 11,
    freshNameChance: 0.25,
    epithetFromRarity: 'epic',
  },
  abilities: {
    slotChances: [0.35, 0.15, 0.05],
    tierWeights: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 },
    max: 3,
    // Fähigkeits-Elixier: level II ×1,5, level III ×2 (Brutpfleger −10 / −15 / −20 %).
    levelMults: [1, 1.5, 2],
    // Pure lines carry ability levels: kept from the 1st dynasty tier (depth 5), raised from the 2nd (depth 10).
    lineageKeepDepth: 5,
    lineageRaiseDepth: 10,
  },
  breeding: {
    baseTimeSec: 60,
    timePerGeneration: 0.15,
    // Bonuses stack (every Brutpfleger in the stable counts) – an egg never takes less than this share of its base time.
    minTimeShare: 0.25,
    costs: [
      { resource: 'food', base: 30, generationGrowth: 1.5, creatureGrowth: 1.04, fromGeneration: 2 },
      { resource: 'gold', base: 20, generationGrowth: 1.5, creatureGrowth: 1.04, fromGeneration: 3 },
    ],
    mutationChance: 0.08,
    mutationStatRange: [1.05, 1.25],
    // An ability one parent has passes on now and then; one both parents share almost always.
    abilityInheritChance: 0.35,
    abilityInheritBoth: 0.85,
    nestKeepers: 1,
    ritualGermOilChance: 0.3,
    baseNests: 1,
    ritualNests: 1,
    autoNests: 1,
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
      // Research and achievements lower the risk, but never below this.
      minInstability: 0.05,
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
    manualSec: 15,
    autoMinSec: 1,
  },
  activity: {
    idleSec: 120,
    sessionGapSec: 300,
    maxTickSec: 5,
    towerMilestones: [30, 75, 150, 225, 300, 450, 600],
  },
  automation: {
    intervalSec: 5,
    // The Zuchtautomat breeds in its own nest, but slowly – the normal nests stay free for breeding by hand.
    autoBreedTimeMult: 3,
  },
  tower: {
    // Three small floors per former floor: 4 s each (in former floors 1.5× as long as the old 8 s; see TODO.md).
    fightIntervalSec: 4,
    baseTeamSize: 3,
    // Aktionsleiste: a fighter acts every (average speed / own speed)^speedExponent seconds of fight time.
    speedExponent: 0.8,
    // No time limit in the tower – only who falls first. This is the emergency brake against endless
    // fights (e.g. a healer the team cannot outdamage): after it the fight is a stalemate and lost.
    maxFightSec: 300,
    // Wut instead of a time limit: from 30 s on the enemies deal 10 % more damage with every second,
    // so healing alone cannot hold out forever and damage keeps mattering.
    enrageAfterSec: 30,
    enrageGrowth: 0.1,
    // Dodge chance per 100 % speed lead over the attacker, capped.
    evadePerSpeedLead: 0.15,
    maxEvade: 0.25,
    // Defence: after the percentage reduction VER blocks up to defRatio more, by VER / (VER + attacker's ANG).
    defRatio: 0.4,
    // Enemies hit the front row with this chance (as long as someone stands there and someone behind).
    frontShare: 0.75,
    // Element-Techniken: every n-th action of a team member; enemies and companions (not bosses) every enemyTechniqueEvery-th.
    techniqueEvery: 5,
    enemyTechniqueEvery: 7,
    // Enemy groups: from groupFromFloor on up to three foes share the floor's strength (hp/atk × groupHp/groupAtk[n − 1]).
    groupFromFloor: 36,
    groupHp: [1, 1.1, 1.2],
    groupAtk: [1, 1, 1.05],
    // Boss floors from companionsFromFloor on bring two companions (share of a normal enemy of the floor), standing in front.
    companionsFromFloor: 60,
    companionHp: 0.2,
    companionAtk: 0.2,
    // From phaseFromFloor on bosses gain a second trait below phaseAt of their HP.
    phaseFromFloor: 90,
    phaseAt: 0.5,
    // Flächenangriff: every n-th action of such a boss.
    sweepEvery: 3,
    // Critical hits (tower.crit chance) deal this multiple.
    critMult: 1.5,
    // Synergies: two or more of one element +ANG; three different elements +damage against the Wandler.
    pairBonus: 0.08,
    diversityBonus: 0.25,
    enemyBase: { hp: 60, atk: 9, def: 5, spd: 6 },
    // ×1.11 per former floor, spread over three small ones.
    enemyGrowth: Math.cbrt(1.11),
    subFloors: 3,
    bossEvery: 30,
    // Measured with tests/towerCurve.ts: a boss costs about 3–4 former floors (GENLAB_CURVE=1 for the report).
    bossHpMult: 1.3,
    bossAtkMult: 1.05,
    // All foes of the floor about one former floor stronger (×1.23 KP × ANG); the first one is the Wächter.
    guardEvery: 10,
    guardHpMult: 1.12,
    guardAtkMult: 1.1,
    strongMult: 1.5,
    weakMult: 0.7,
    // Defence counts relative to the attacker's ANG: a hit is divided by 1 + defWeight × VER / ANG.
    defWeight: 0.5,
    // Half of a former floor per small floor: with 4 s instead of 8 s the same Turm-Marken per hour.
    tokensPerFloor: 1,
    tokenGrowthPerFloor: 0.1 / 3,
    catalystEvery: 30,
    alleleEvery: 75,
    leaderboardSize: 3,
    historySize: 10,
    checkpointEvery: 30,
    bossTraitFromFloor: 60,
    milestoneEvery: 150,
    milestoneShards: 3,
    // Kampferfahrung: a moderate lasting bonus that keeps growing (tuned with the Äon-Bot, see TODO.md).
    xpPerFloor: 1 / 30,
    xpBossMult: 10,
    xpRankBase: 100,
    xpRankStep: 9,
    xpRankBonus: 0.02,
    // Entschlossenheit against long stalls: +15 % per day without a new record, at most +60 %.
    resolvePerDay: 0.15,
    resolveCap: 0.6,
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
    // At most this many Äon-Splitter from dynasties in total (5 per species would add up to ~165).
    maxShards: 25,
    modifiersPerTier: [
      { target: 'production.food', op: 'pct', value: 0.01 },
      { target: 'production.gold', op: 'pct', value: 0.01 },
      { target: 'production.essence', op: 'pct', value: 0.01 },
    ],
  },
  missions: {
    baseCamps: 1,
    statScaling: 0.02,
    // Missions at least this long are Tagesreisen: they survive an inheritance.
    journeyHours: 12,
  },
  market: {
    maxBoostsPerStat: 10,
    // Zeittrank: its price (minutes of production, `costMinutes` on the potion) doubles for
    // every further one within the window.
    timeSkipGrowth: 2,
    timeSkipWindowHours: 1,
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
