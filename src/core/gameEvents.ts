import type { Decimal } from './num';

/** All game events. Add new events here; listeners are fully typed. */
export interface GameEvents {
  resourceGained: { resource: string; amount: Decimal; source: string };
  collected: { amounts: Record<string, Decimal> };
  featureUnlocked: { feature: string; silent: boolean };
  upgradeBought: { upgrade: string; level: number };
  creatureAdded: { creatureId: number; source: 'start' | 'hatch' | 'wild' | 'capsule' | 'other' };
  creatureRemoved: { creatureId: number; reason: string };
  dexDiscovered: { species: string; rarity: string };
  processStarted: { processId: number; kind: string };
  processCompleted: { processId: number; kind: string };
  contractCompleted: { template: string; creatureId: number; level: number };
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
  eggHatched: { creatureId: number; parents: [number, number] };
  missionCompleted: { missionId: string; creatureId: number; rewards: Record<string, Decimal>; wildCreatureId: number | null };
  potionUsed: { potion: string; creatureId: number | null };
  sequenced: { creatureId: number };
  recipeHinted: { recipe: string };
  towerFloor: { floor: number; win: boolean; rewards: Record<string, Decimal>; allele: { locus: string; allele: string } | null };
  towerRunEnded: { floor: number };
  talentBought: { talent: string };
  anomalyStarted: { anomaly: string };
  anomalyCompleted: { anomaly: string };
  perfectGenome: { creatureId: number; species: string };
  shiny: { creatureId: number; species: string };
  /** `auto`: done by an automation (no toast per run). */
  sold: { count: number; value: Record<string, Decimal>; auto?: boolean };
  recycled: { count: number; fragments: Decimal; auto?: boolean };
  infused: { targetId: number; victims: number; ep: number; levelsGained: number; transferred: { locus: string; allele: string }[] };
  breakthrough: { creatureId: number; rarity: string };
  capsuleOpened: { capsule: string; creatureId: number; rarity: string; pity: boolean };
  stableFull: { lost: number; value: Record<string, Decimal> };
  evolved: { creatureId: number; from: string; to: string };
  alleleCatalogued: { locus: string; allele: string };
  spliced: { creatureId: number; locus: string; success: boolean; scrambledLocus: string | null };
}
