import type { Decimal } from './num';
import type { RpgEvent } from './state';

/** All game events. Add new events here; listeners are fully typed. */
export interface GameEvents {
  resourceGained: { resource: string; amount: Decimal; source: string };
  /** `find`: a Fundstück turned up with this click (already granted). */
  collected: { amounts: Record<string, Decimal>; find: { resource: string; amount: Decimal } | null };
  featureUnlocked: { feature: string; silent: boolean };
  upgradeBought: { upgrade: string; level: number };
  creatureAdded: { creatureId: number; source: 'start' | 'hatch' | 'wild' | 'capsule' | 'other' };
  creatureRemoved: { creatureId: number; reason: string };
  dexDiscovered: { species: string; rarity: string };
  processStarted: { processId: number; kind: string };
  processCompleted: { processId: number; kind: string };
  /** `creatureId` is null for equipment deliveries. */
  contractCompleted: { template: string; creatureId: number | null; level: number };
  deepSequenced: { creatureId: number; latent: string | null; awakened: boolean };
  dailyClaimed: { step: number };
  weeklyBossHit: { damage: number; total: number; defeated: boolean };
  grandResearchDone: { project: string; level: number };
  megaProjectStage: { project: string; stage: number };
  resonanceBought: { resonance: string; level: number };
  timeCrystalUsed: { processId: number; kind: string };
  voyageReturned: { destination: string };
  voyageResolved: { destination: string; decision: string; option: number; creatureId: number | null };
  buffExpired: { buffId: number; source: string };
  achievementUnlocked: { achievement: string };
  prestige: { layer: string; gain: Decimal };
  offlineProgress: { requestedMs: number; simulatedMs: number };
  /** `ritual`: the Brutritual the egg came from (missing for normal eggs). */
  eggHatched: { creatureId: number; parents: [number, number]; ritual?: string };
  missionCompleted: { missionId: string; creatureId: number; rewards: Record<string, Decimal>; wildCreatureId: number | null };
  potionUsed: { potion: string; creatureId: number | null };
  sequenced: { creatureId: number };
  recipeHinted: { recipe: string };
  towerFloor: { floor: number; win: boolean; rewards: Record<string, Decimal>; allele: { locus: string; allele: string } | null };
  towerRunEnded: { floor: number };
  /** A Genom-Keller level fought (`rest`: the team rested in a vault after it). */
  cellarLevel: { level: number; win: boolean; rewards: Record<string, Decimal>; rest: boolean };
  cellarRunEnded: { level: number; startLevel: number };
  /** New descents into the Genom-Keller (a new day). */
  cellarAttempts: { attempts: number; gained: number };
  /** A Tiefen-Meilenstein reached for the first time. */
  cellarMilestone: { milestone: string };
  /** One round in the GenLab RPG dungeon; `outcome` once the fight is decided. */
  rpgRound: { events: RpgEvent[]; outcome: 'win' | 'lose' | null; boss: boolean };
  /** A GenLab RPG run ended (`cleared`: the boss fell). */
  rpgRunEnded: { win: boolean; cleared: boolean };
  rpgLevelUp: { level: number };
  /** A new rank of Kampferfahrung. */
  towerRank: { rank: number };
  talentBought: { talent: string };
  anomalyStarted: { anomaly: string };
  anomalyCompleted: { anomaly: string; level: number };
  anomalyRecord: { total: number; shards: number };
  /** A species reached a new Stammbaum-Dynastie tier. */
  dynastyTier: { species: string; tier: number; depth: number; shards: number };
  perfectGenome: { creatureId: number; species: string };
  shiny: { creatureId: number; species: string };
  /** `auto`: done by an automation (no toast per run). */
  sold: { count: number; value: Record<string, Decimal>; auto?: boolean };
  recycled: { count: number; fragments: Decimal; auto?: boolean };
  /** A creature the player sent could not be recycled after all (e.g. it is the last one); it stays. */
  recycleFailed: { creatureId: number; reason: string };
  infused: { targetId: number; victims: number; ep: number; levelsGained: number; transferred: { locus: string; allele: string }[] };
  breakthrough: { creatureId: number; rarity: string };
  capsuleOpened: { capsule: string; creatureId: number; rarity: string; pity: boolean };
  stableFull: { lost: number; value: Record<string, Decimal> };
  evolved: { creatureId: number; from: string; to: string };
  alleleCatalogued: { locus: string; allele: string };
  spliced: { creatureId: number; locus: string; success: boolean; scrambledLocus: string | null };
}
