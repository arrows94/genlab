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
  rewards: {
    /** Resources a reward bonus (`contracts.reward`, `daily.reward` …) does not multiply. */
    unscaled: string[];
  };
  contracts: {
    /** Least offers on the board per day (the board grows with the Ruf, see `boardLevels`). */
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
    /** Fixed loot on top of the destination's (resources of locked features are left out). */
    bonus: ResourceAmounts;
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
    /** Seconds of fight time per attack (the boss never dies inside one attack). */
    fightSec: number;
    attemptsPerDay: number;
    maxAttempts: number;
    /** Rewards when the total damage reaches `at` × boss HP (in order). */
    tiers: { at: number; rewards: ResourceAmounts }[];
  };
  rpg: {
    /** Hours until the next Fackel while below the stock limit (real clock, also offline). */
    torchHours: number;
    /** Fackeln stored at most by refilling (rewards may go beyond). */
    maxTorches: number;
    /** Fackeln with every Tagesbelohnung once the RPG is unlocked, and on the calendar's last day. */
    dailyTorches: number;
    dailyTorchesLast: number;
    /** Fackeln per fulfilled Gen-Auftrag once the RPG is unlocked. */
    contractTorches: number;
    /** Share of the carried (not yet secured) loot kept after a defeat. */
    defeatKeep: number;
    /** Tower status durations (seconds) per dungeon round; burn, poison and regen values scale with it. */
    secondsPerRound: number;
    /** Rounds before the element technique can be used again. */
    techniqueCooldown: number;
    /** Foe stats = its species' base stats × level growth × these (a duel of one hero, not a team). */
    enemyMult: { hp: number; atk: number; def: number; spd: number };
    /** Damage of a charged heavy blow as a multiple of a normal hit. */
    heavyMult: number;
    /** A guarding foe absorbs this share of its max HP during the round. */
    guardShare: number;
    /** A healing foe heals this share of its max HP. */
    healShare: number;
    /** Special attack charge per round, per own hit that lands and per hit taken (1 = ready). */
    chargePerRound: number;
    chargePerHit: number;
    chargeWhenHit: number;
    /** Lines kept in the fight log. */
    logSize: number;
    /** From this round on the foe's damage grows by `enrageGrowth` per round (Wut). */
    enrageAfter: number;
    enrageGrowth: number;
    /** How many ways are offered after a room: [min, max]. */
    choices: [number, number];
    /** Weights of the room kinds offered (the boss comes on its own at the end). */
    roomWeights: Record<'fight' | 'elite' | 'treasure' | 'rest' | 'event', number>;
    /** XP per won fight; it stays with the monster (its level in the other world). */
    xp: { fight: number; elite: number; boss: number };
    /** A foe's XP × this per level above 1. */
    xpFoeGrowth: number;
    /** XP from level n to n+1: xpBase × xpGrowth^(n − 1). */
    xpBase: number;
    xpGrowth: number;
    maxLevel: number;
    /** Each level above 1 adds this share of the species' base stats. */
    statsPerLevel: number;
    /** Strength of a species tier in the other world (base stats are scaled to a common yardstick first). */
    tierMult: Record<string, number>;
    /** Share of max HP healed on a level-up. */
    levelHeal: number;
    /** Upgrades offered per level-up (they only last for the run). */
    upgradeChoices: number;
    /** A won elite fight offers upgrades too. */
    eliteUpgrade: boolean;
    /** A guardian (elite fight, no other way) waits after this share of the rooms; 0 = none. */
    guardianAt: number;
    /** Share of max HP a rest heals. */
    restHeal: number;
    /**
     * Loot per room kind: `fixed` × the dungeon's `loot`; each `chance` entry gives one piece with that
     * probability × the dungeon's `loot` (at most 1). Key `alleleSamples` catalogues missing alleles.
     */
    loot: Partial<Record<'fight' | 'elite' | 'treasure' | 'boss', { fixed: ResourceAmounts; chance?: Record<string, number> }>>;
    /** Chance of a piece of equipment per room kind (× the dungeon's loot, at most 1). */
    gearChance: Partial<Record<'fight' | 'elite' | 'treasure' | 'boss', number>>;
    /** Rarity weights of found equipment; deeper dungeons raise rarer ones by `gearRarityShift` × order × (loot − 1). */
    gearRarityWeights: Record<string, number>;
    gearRarityShift: number;
    /** Value multiplier of equipment per rarity. */
    gearRarityMult: Record<string, number>;
    /** Pieces the player can own; more found ones are taken apart. */
    maxItems: number;
    /** Runen for taking a piece apart, per rarity. */
    salvage: Record<string, number>;
    /** Most of these per week (paid out) from the dungeon. */
    weeklyCap: ResourceAmounts;
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
    /** A click also brings this many seconds of the current production of those resources (`collect.production`). */
    productionSeconds: number;
    /**
     * Ausdauer: one point per click, refilled over time (`collect.stamina`,
     * `collect.staminaRegen`). An exhausted click brings only the refilled share,
     * so `perSec` is the most full clicks per second, however fast one clicks.
     */
    stamina: { max: number; perSec: number };
    /**
     * Fundstücke: chance per rested click (`collect.findChance`), at most one per
     * cooldown; worth `clicks` full clicks plus `productionSeconds` of production
     * of a random resource the player collects or produces.
     */
    finds: { chance: number; cooldownSec: number; clicks: number; productionSeconds: number };
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
    /** Strength of an ability per level (index 0 = level 1); the length is the highest level. */
    levelMults: number[];
    /** From this pure-line depth a child keeps the parents' ability level (else it drops one level). */
    lineageKeepDepth: number;
    /** From this depth an ability both parents have rises one level in the child. */
    lineageRaiseDepth: number;
  };
  breeding: {
    baseTimeSec: number;
    /** Shortest egg time as a share of the base time of its generation (bonuses cannot go below). */
    minTimeShare: number;
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
    /** Chance for an ability both parents have (`breeding.abilityInherit` raises both). */
    abilityInheritBoth: number;
    /** Places for a Nestwärter (`slots.nestKeeper`): its breeding bonuses count for every egg. */
    nestKeepers: number;
    /** Chance that a finished Brutritual leaves one Keimöl (once the Fähigkeits-Elixier is known). */
    ritualGermOilChance: number;
    /** Base nest slots (modified by `slots.nest`). */
    baseNests: number;
    /** Ritualnest places for the Besondere Brut (next to the normal nests, `slots.ritualNest`). */
    ritualNests: number;
    /** Places in the Automatennest: the Zuchtautomat only breeds there (`slots.autoNest`). */
    autoNests: number;
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
      /** Floor for the reduced chance (if the base itself is lower, the base is the floor). */
      minInstability: number;
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
    /** Eggs of the Zuchtautomat take this many times as long as a hand-bred egg. */
    autoBreedTimeMult: number;
  };
  tower: {
    fightIntervalSec: number;
    baseTeamSize: number;
    /**
     * Aktionsleiste: each fighter acts every (mean speed of the fight / own
     * speed)^speedExponent seconds of fight time – relative, so it works on every floor.
     */
    speedExponent: number;
    /** Emergency brake in seconds of fight time: a fight that lasts this long is a stalemate and counts as lost. */
    maxFightSec: number;
    /** Wut: from this second of fight time on the enemies hit harder … */
    enrageAfterSec: number;
    /** … by this share more per further second (additive: 0.1 → ×2 after ten seconds of Wut). */
    enrageGrowth: number;
    /** Dodge chance per 100 % speed lead of the defender over the attacker … */
    evadePerSpeedLead: number;
    /** … capped at this. */
    maxEvade: number;
    /** Extra share blocked after the percentage: defRatio × VER / (VER + attacker's ANG). */
    defRatio: number;
    /** Chance that an enemy attack goes to the front row (when both rows are occupied). */
    frontShare: number;
    /** Every n-th action of a fighter is its Element-Technik. */
    techniqueEvery: number;
    /** Tower enemies use their technique every n-th action (0 = never). */
    enemyTechniqueEvery: number;
    /** Normal floors from here on can bring 2–3 foes. */
    groupFromFloor: number;
    /** HP / ANG of the whole group (× the single enemy), index = group size − 1; split among its members. */
    groupHp: number[];
    groupAtk: number[];
    /** Boss floors from here on bring two companions. */
    companionsFromFloor: number;
    /** Companion HP / ANG as a share of a normal enemy of that floor. */
    companionHp: number;
    companionAtk: number;
    /** Bosses from here on wake a second trait below `phaseAt` of their HP. */
    phaseFromFloor: number;
    phaseAt: number;
    /** Flächenangriff: every n-th action of the boss. */
    sweepEvery: number;
    /** Damage multiple of a critical hit. */
    critMult: number;
    /** Two or more team members of one element: +share ANG for them. */
    pairBonus: number;
    /** Three or more different elements: +share damage against the Wandler. */
    diversityBonus: number;
    enemyBase: Record<string, number>;
    /** Enemy stats × growth^(floor − subFloors). */
    enemyGrowth: number;
    /**
     * Small floors per former floor (3): enemy stats × growth^(floor − subFloors), and floor 3n rolls the same
     * enemy, element and boss trait as the former floor n.
     */
    subFloors: number;
    bossEvery: number;
    bossHpMult: number;
    bossAtkMult: number;
    /** Wächter: every n-th floor (not a boss floor) the foes are stronger – no checkpoint, no trait. */
    guardEvery: number;
    guardHpMult: number;
    guardAtkMult: number;
    strongMult: number;
    weakMult: number;
    /** Damage = atk × mult / (1 + defWeight × def / atk) (scale-free: fights last as long on every floor). */
    defWeight: number;
    /** Turm-Marken of floor f: tokensPerFloor × (1 + tokenGrowthPerFloor × (f − 1)), paid as whole numbers (running sum). */
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
    /** Kampferfahrung per won floor: xpPerFloor × floor (higher floors teach more), a boss × xpBossMult. Survives every reset. */
    xpPerFloor: number;
    xpBossMult: number;
    /** Rank n → n + 1 costs xpRankBase × (1 + xpRankStep × n) – linear, so ranks keep coming late. */
    xpRankBase: number;
    xpRankStep: number;
    /** Per rank: this share more KP and damage in the tower (and against the weekly boss). */
    xpRankBonus: number;
    /** Entschlossenheit: while the record does not rise, +resolvePerDay KP and damage per day (hourly steps), at most resolveCap; a new record resets it. */
    resolvePerDay: number;
    resolveCap: number;
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
    /** Total Äon-Splitter dynasties can pay over all species. */
    maxShards: number;
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
    /** Missions at least this long are Tagesreisen (survive an inheritance). */
    journeyHours: number;
  };
  market: {
    /** Per-creature cost growth for permanent stat potions is on the potion; this caps uses. */
    maxBoostsPerStat: number;
    /** Price factor per Zeittrank already drunk within `timeSkipWindowHours`. */
    timeSkipGrowth: number;
    timeSkipWindowHours: number;
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
