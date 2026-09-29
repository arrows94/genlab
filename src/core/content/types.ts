import type { ModifierDef } from '../modifiers';

/**
 * Content interfaces. All game content lives as data in `src/content/` and
 * is validated at startup (see `validate.ts`). Core logic only ever reads
 * content through the `ContentDB` built from these definitions.
 */

/** Resource id → amount. Used for costs, rewards, sell values ... */
export type ResourceAmounts = Record<string, number>;

/** Data-driven conditions for unlocks, achievements, recipes, evolutions. */
export type Condition =
  | { type: 'always' }
  | { type: 'resourceEarned'; resource: string; amount: number }
  | { type: 'resourceOwned'; resource: string; amount: number }
  | { type: 'upgradeLevel'; upgrade: string; level: number }
  | { type: 'feature'; feature: string }
  | { type: 'creatureCount'; count: number }
  | { type: 'statistic'; statistic: string; amount: number }
  | { type: 'dex'; species?: string; rarity?: string; count?: number }
  | { type: 'prestigeCount'; layer: string; count: number }
  | { type: 'geneLibrary'; count: number }
  | { type: 'talent'; talent: string }
  | { type: 'towerFloor'; floor: number }
  | { type: 'anomaly'; anomaly: string }
  /** A Großprojekt has finished at least `stage` construction stages. */
  | { type: 'megaProject'; project: string; stage: number }
  | { type: 'all'; of: Condition[] }
  | { type: 'any'; of: Condition[] };

export interface ResourceDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** Hidden until the given feature is unlocked. */
  feature?: string;
  description?: string;
}

export interface StatDef {
  id: string;
  name: string;
  short: string;
}

export interface ElementDef {
  id: string;
  name: string;
  color: string;
  /** Elements this one deals bonus damage against (tower). */
  strongAgainst: string[];
  /** First halves of family names founded by a creature of this element. */
  familyPrefixes: string[];
}

/** Word list for creature names (`given`: Rufnamen, `familySuffix`: endings of family names). */
export interface NameListDef {
  id: string;
  words: string[];
}

export interface RarityDef {
  id: string;
  name: string;
  /** Sort order, 0 = most common. */
  order: number;
  color: string;
  /** Glow animation on cards (mythic). */
  glow?: boolean;
}

export type SpeciesTier = 'base' | 'hybrid' | 'rareHybrid' | 'mythic';

export interface SpeciesDef {
  id: string;
  name: string;
  element: string;
  tier: SpeciesTier;
  description: string;
  /** Base stats keyed by stat id. */
  baseStats: Record<string, number>;
  /** Base hue (0–360) for the procedural SVG; offspring vary around it. */
  hue: number;
  /** Body silhouette key used by the SVG renderer. */
  shape: string;
  /** Can this species appear as a wild creature on expeditions? */
  wild: boolean;
}

export interface AlleleDef {
  id: string;
  name: string;
  /** Short symbol shown in the DNA view, e.g. "K" / "k". */
  symbol: string;
  /** Higher dominance wins; equal dominance = codominant (both expressed at 50 %). */
  dominance: number;
  /** Relative weight when rolling a wild genome. */
  weight: number;
  /** Modifiers applied to the creature when this allele is expressed. */
  modifiers: ModifierDef[];
  color: string;
  /** Visual effect when expressed (phenotype is always visible, genotype only after sequencing). */
  visual?: AlleleVisual;
  /** Target allele for the "perfect genome" (Perfektions-Jagd). */
  top?: boolean;
}

export interface AlleleVisual {
  hueShift?: number;
  /** Saturation / lightness overrides in percent (e.g. albino). */
  saturation?: number;
  lightness?: number;
  pattern?: string;
  horn?: string;
}

export interface GeneLocusDef {
  id: string;
  name: string;
  description: string;
  category: 'stat' | 'trait' | 'visual';
  alleles: AlleleDef[];
  /** Locus only exists while this holds (e.g. an Äon talent). */
  requires?: Condition;
}

export type AbilityScope = 'self' | 'job' | 'global';

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  /** Ability tier (uses rarity ids common → legendary). */
  tier: string;
  /**
   * self   – modifies only the owning creature (e.g. stat.atk)
   * job    – applies while the creature works in a building
   * global – applies to the whole game while the creature is owned
   */
  scope: AbilityScope;
  modifiers: ModifierDef[];
}

export interface HybridRecipeDef {
  id: string;
  parents: [string, string];
  result: string;
  /** Chance that breeding the parents yields the hybrid. */
  chance: number;
  /** Extra requirements checked against both parents / the game state. */
  requires?: {
    minGeneration?: number;
    minRarity?: string;
    allele?: { locus: string; allele: string };
    condition?: Condition;
  };
  /** Shown as "???" in the dex until discovered; the hint is revealed via research or expeditions. */
  hint: string;
}

export interface EvolutionDef {
  id: string;
  from: string;
  to: string;
  description?: string;
  requires: {
    minGeneration?: number;
    minRarity?: string;
    allele?: { locus: string; allele: string };
    cost?: ResourceAmounts;
  };
}

export interface BuildingDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Resource produced by each assigned creature. */
  produces: string;
  /** Base production per creature per second. */
  baseRate: number;
  /** Stat that scales output (see balance.production.statScaling). */
  workStat: string;
  baseSlots: number;
  feature: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  category: 'research' | 'infinite' | 'aeon' | 'achievement';
  cost: ResourceAmounts;
  /** Cost multiplier per level already bought. */
  costGrowth: number;
  /** null = infinite research. */
  maxLevel: number | null;
  /** Modifiers granted per level (add/pct scale linearly, mult compounds). */
  modifiers: ModifierDef[];
  /** Features unlocked when level ≥ 1. */
  unlocksFeatures?: string[];
  /** Hybrid recipe hints revealed per level bought. */
  grantsHints?: number;
  /** Diminishing returns for infinite research: modifiers scale with level^power (default 1). */
  levelPower?: number;
  requires?: Condition;
  /** Branch of the research tree (`researchThemes` id). */
  theme?: string;
}

/** A branch of the research tree (Sammeln, Farm, Mine …). */
export interface ResearchThemeDef {
  id: string;
  name: string;
  icon: string;
}

export type PotionKind = 'permanentStat' | 'creatureBuff' | 'globalBuff' | 'timeSkip';

export interface PotionDef {
  id: string;
  name: string;
  description: string;
  kind: PotionKind;
  /** Liquid colour of the bottle on the market shelf. */
  color?: string;
  cost: ResourceAmounts;
  /** permanentStat: cost growth per use on the same creature. */
  costGrowth?: number;
  durationSec?: number;
  /** permanentStat: bonus per use on the chosen stat (0.05 = +5 %). */
  statBonus?: number;
  /** timeSkip: seconds removed from running processes. */
  skipSec?: number;
  modifiers?: ModifierDef[];
  feature: string;
}

export interface MissionDef {
  id: string;
  name: string;
  description: string;
  /** Mission is only offered once this holds (e.g. new regions via research). */
  requires?: Condition;
  /** Wild species found here; omitted = every species with `wild: true`. */
  species?: string[];
  durationSec: number;
  cost: ResourceAmounts;
  /** resource → [min, max] */
  rewards: Record<string, [number, number]>;
  wildChance: number;
  /**
   * Guaranteed find (long journeys): the wild creature has at least this
   * rarity and always finds a place, even in a full stable.
   */
  wildMinRarity?: string;
  /** Teams allowed on this mission at the same time (journeys: 1). */
  maxConcurrent?: number;
}

export interface DexRewardDef {
  id: string;
  /** Rarity tier the reward is granted for (first discovery of any species at that rarity counts). */
  rarity: string;
  /** Modifiers granted per discovered species at this rarity. */
  modifiersPerEntry: ModifierDef[];
  /** Features unlocked once `count` entries of this rarity exist. */
  unlocksFeatures?: { count: number; features: string[] }[];
}

export interface FeatureDef {
  id: string;
  name: string;
  /** Short hint text shown as toast when unlocked (no long tutorial). */
  hint: string;
  /** Auto-unlock condition; omit for features unlocked only by upgrades/dex. */
  condition?: Condition;
  /** UI tab shown once unlocked. */
  tab?: string;
  /** Creature granted once when the feature unlocks (e.g. a second creature for breeding). */
  grantsCreature?: { species: string; rarity: string };
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  condition: Condition;
  modifiers: ModifierDef[];
}

export interface PrestigeLayerDef {
  id: string;
  name: string;
  description: string;
  /** Resource awarded by the reset. */
  currency: string;
  feature: string;
  /** Resources feeding the gain formula. */
  gainFrom: string[];
  /** 'earned' = earned this run (default), 'owned' = currently owned (e.g. heritage points for Äon). */
  gainSource?: 'earned' | 'owned';
  /** Modifiers granted per currency point owned. */
  modifiersPerPoint: ModifierDef[];
  resets: {
    /** Resource ids set back to their starting amount. */
    resources: string[];
    creatures: boolean;
    processes: boolean;
    buffs: boolean;
    /** Upgrade categories reset to level 0. */
    upgradeCategories: UpgradeDef['category'][];
    dex: boolean;
    features: boolean;
  };
}

export interface TalentDef {
  id: string;
  name: string;
  description: string;
  /** Row in the talent tree (1 = root). */
  tier: number;
  /** Cost in the Äon currency. */
  cost: number;
  /** All listed talents must be owned first. */
  requires: string[];
  /** Extra condition before the talent can be learned (e.g. a Großprojekt stage). */
  unlock?: Condition;
  modifiers: ModifierDef[];
  /** Features that stay unlocked across every reset. */
  unlocksFeatures?: string[];
  /** Resources granted after each reset. */
  onReset?: ResourceAmounts;
}

export interface AnomalyDef {
  id: string;
  name: string;
  description: string;
  /** Rule changes while the anomaly runs. */
  modifiers: ModifierDef[];
  /** Extra rule changes per difficulty stage above I (scaled by stage − 1). */
  perLevel?: ModifierDef[];
  /** What `perLevel` adds per further stage, for the player („−20 % Nahrung“). */
  levelText?: string;
  rules?: { noPotions?: boolean };
  /** Completion goal at stage I (checked on the anomaly run); higher stages scale countable goals. */
  goal: Condition;
  goalText: string;
  /** Permanent bonus after completion, times the best stage mastered. */
  reward: ModifierDef[];
  rewardText: string;
  requires?: Condition;
}

export interface WeeklyMutationDef {
  id: string;
  name: string;
  description: string;
  modifiers: ModifierDef[];
}

export interface CapsuleDef {
  id: string;
  name: string;
  description: string;
  cost: ResourceAmounts;
  feature: string;
  /** Rarity weights (shown openly as percentages). Rarity modifiers do not apply. */
  rarityWeights: Record<string, number>;
  /** Species tier weights; a tier without eligible species is skipped. */
  tierWeights: Partial<Record<SpeciesTier, number>>;
  /** Player picks an element; only species of that element can drop. */
  elementChoice?: boolean;
  /** After `threshold − 1` capsules without ≥ `minRarity`, the next one is guaranteed. */
  pity: { threshold: number; minRarity: string };
}

/**
 * Gen-Auftrag requirement as written in the content. Parameters left out are
 * rolled when a contract is offered (from the player's gene library and dex),
 * so a few templates give many different contracts.
 */
export type ContractRequirementSpec =
  /** The phenotype shows this allele (a rare, non-default one if rolled). */
  | { kind: 'expresses'; category?: GeneLocusDef['category']; locus?: string; allele?: string }
  /** Homozygous for this allele; `recessive` rolls a recessive allele (hidden in carriers). */
  | { kind: 'genotype'; recessive?: boolean; locus?: string; allele?: string }
  | { kind: 'element'; element?: string }
  | { kind: 'minTier'; tier: SpeciesTier }
  /** At least `count` loci with their top allele (expressed or homozygous). */
  | { kind: 'topLoci'; count: number; homozygous: boolean }
  | { kind: 'minRarity'; rarity: string }
  | { kind: 'minGeneration'; generation: number };

export interface ContractTemplateDef {
  id: string;
  name: string;
  /** Who asks – flavour text on the card. */
  client: string;
  /** Contract level (1 …); higher levels unlock with completed contracts. */
  level: number;
  /** Relative frequency among the templates of the pool. */
  weight: number;
  /** Extra gate besides the level (e.g. hybrids unlocked). */
  requires?: Condition;
  requirements: ContractRequirementSpec[];
  reward: {
    /** Minutes of the current production of every produced resource. */
    minutes?: number;
    /** Fixed amounts; only granted once the resource's feature is unlocked. */
    resources?: ResourceAmounts;
    /** Missing alleles (rarest first) added to the gene library. */
    alleleSamples?: number;
  };
}

/**
 * Erbanlage: a hidden, strong trait some creatures carry. It is inherited
 * even while hidden and only takes effect once a deep sequencing reveals it.
 */
export interface LatentTraitDef {
  id: string;
  name: string;
  description: string;
  /** Relative frequency among creatures that carry a trait. */
  weight: number;
  /** Like abilities: self, job (while working) or global. */
  scope: 'self' | 'job' | 'global';
  modifiers: ModifierDef[];
}

/**
 * Großforschung: slow projects (hours to days) on their own research slot
 * with large, permanent bonuses. Levels survive every reset.
 */
export interface GrandResearchDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Duration of level 1 in hours; each further level takes `hoursGrowth` times longer. */
  hours: number;
  hoursGrowth: number;
  maxLevel: number;
  cost: ResourceAmounts;
  costGrowth: number;
  requires?: Condition;
  /** Applied once per completed level. */
  modifiers: ModifierDef[];
}

/**
 * Resonanz: an endless Äon node. Every level costs more shards
 * (`cost × costGrowth^level`) and adds less (`level^levelPower`), so shards
 * always stay worth something once the talent tree is complete.
 */
export interface ResonanceDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  costGrowth: number;
  /** Effect scale for level n is n^levelPower (< 1 = diminishing returns). */
  levelPower: number;
  requires?: Condition;
  modifiers: ModifierDef[];
}

/** A special trick of a tower boss (from `balance.tower.bossTraitFromFloor`). */
export interface BossTraitDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /**
   * shield: damage without element advantage × value; shift: changes element
   * every round (value unused); regen: heals value × the damage
   * it took in that round, after every round.
   */
  kind: 'shield' | 'shift' | 'regen';
  value: number;
}

/**
 * Relikt: bought and levelled with Turm-Marken, owned by the player (never
 * reset) and put into a place of the tower team. It boosts whoever stands
 * there – in the tower and against the weekly boss.
 */
export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Turm-Marken for level 1; each level costs `costGrowth` times more. */
  cost: number;
  costGrowth: number;
  maxLevel: number;
  /** Bonus per level (0.1 = +10 %) on fight stats; `element` raises the element advantage. */
  bonus: Partial<Record<'hp' | 'atk' | 'def' | 'spd' | 'element', number>>;
}

/** One construction stage of a Großprojekt: pay in over time, then build. */
export interface MegaProjectStageDef {
  name: string;
  description: string;
  /** Total to pay in (in any number of deposits). */
  cost: ResourceAmounts;
  /** Construction time after the last deposit. */
  hours: number;
}

/**
 * Großprojekt: a building that takes days. Resources are paid in over
 * several visits, each stage then builds by the real clock. Progress is
 * never reset; finished stages unlock new systems via `megaProject` conditions.
 */
export interface MegaProjectDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  requires?: Condition;
  stages: MegaProjectStageDef[];
}

/** Besondere Brut: a slow breeding ritual with better odds (the normal egg stays quick). */
export interface BreedingRitualDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** Fixed breeding time in hours (replaces the normal time). */
  hours: number;
  /** Extra cost on top of the normal breeding cost. */
  cost: ResourceAmounts;
  requires?: Condition;
  /** Multiplies every hybrid recipe chance. */
  hybridMult?: number;
  /** A matching hybrid recipe always succeeds (one of them at random if several match). */
  guaranteedHybrid?: boolean;
  /** The offspring has at least this rarity. */
  minRarity?: string;
  /** Extra weight for rare and better (0.5 = +50 %). */
  rarityBoost?: number;
  /** Added to the mutation chance. */
  mutationAdd?: number;
}

/** Wochenexpedition: destination of a week (picked by the week, themed by the weekly mutation). */
export interface VoyageDestinationDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  element: string;
  /** Species that can join the team at the return. */
  species: string[];
  /** resource → [min, max] before team and event factors */
  rewards: Record<string, [number, number]>;
}

/** Something that happens on one day of the voyage; applied at the return. */
export interface VoyageEventDef {
  id: string;
  text: string;
  weight: number;
  effect: {
    /** Loot change, e.g. -0.1 = −10 %. */
    lootPct?: number;
    resources?: ResourceAmounts;
    alleleSamples?: number;
    /** Reveals a hybrid recipe hint (once hybrids are unlocked). */
    hint?: boolean;
  };
}

export interface VoyageOptionDef {
  label: string;
  description: string;
  /** Share of the loot the player keeps (1 = all). */
  lootFactor: number;
  /** A creature of the destination joins (ignores the stable capacity). */
  creature?: { minRarity: string };
  resources?: ResourceAmounts;
  /** Loot bonus for the next voyage, e.g. 0.5 = +50 %. */
  nextBonus?: number;
  /** Permanent boost to every stat of each team member, e.g. 0.05 = +5 %. */
  teamBoost?: number;
}

/** The choice waiting at the return of a voyage. */
export interface VoyageDecisionDef {
  id: string;
  text: string;
  weight: number;
  options: [VoyageOptionDef, VoyageOptionDef];
}

export interface ContentData {
  resources: ResourceDef[];
  stats: StatDef[];
  elements: ElementDef[];
  rarities: RarityDef[];
  species: SpeciesDef[];
  genes: GeneLocusDef[];
  abilities: AbilityDef[];
  recipes: HybridRecipeDef[];
  evolutions: EvolutionDef[];
  buildings: BuildingDef[];
  upgrades: UpgradeDef[];
  potions: PotionDef[];
  missions: MissionDef[];
  dexRewards: DexRewardDef[];
  features: FeatureDef[];
  achievements: AchievementDef[];
  prestigeLayers: PrestigeLayerDef[];
  capsules: CapsuleDef[];
  talents: TalentDef[];
  anomalies: AnomalyDef[];
  weeklyMutations: WeeklyMutationDef[];
  contracts: ContractTemplateDef[];
  voyageDestinations: VoyageDestinationDef[];
  voyageEvents: VoyageEventDef[];
  voyageDecisions: VoyageDecisionDef[];
  breedingRituals: BreedingRitualDef[];
  latentTraits: LatentTraitDef[];
  grandResearch: GrandResearchDef[];
  resonances: ResonanceDef[];
  megaProjects: MegaProjectDef[];
  researchThemes: ResearchThemeDef[];
  bossTraits: BossTraitDef[];
  relics: RelicDef[];
  nameLists: NameListDef[];
}

export interface Registry<T extends { id: string }> {
  readonly list: readonly T[];
  get(id: string): T;
  has(id: string): boolean;
}

export type ContentDB = { readonly [K in keyof ContentData]: Registry<ContentData[K][number]> };
