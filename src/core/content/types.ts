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
}

export type PotionKind = 'permanentStat' | 'creatureBuff' | 'globalBuff' | 'timeSkip';

export interface PotionDef {
  id: string;
  name: string;
  description: string;
  kind: PotionKind;
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
  rules?: { noPotions?: boolean };
  /** Completion goal (checked on the anomaly run). */
  goal: Condition;
  goalText: string;
  /** Permanent bonus after completion. */
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
}

export interface Registry<T extends { id: string }> {
  readonly list: readonly T[];
  get(id: string): T;
  has(id: string): boolean;
}

export type ContentDB = { readonly [K in keyof ContentData]: Registry<ContentData[K][number]> };
