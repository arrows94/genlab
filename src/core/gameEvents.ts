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
  buffExpired: { buffId: number; source: string };
  achievementUnlocked: { achievement: string };
  prestige: { layer: string; gain: Decimal };
  offlineProgress: { requestedMs: number; simulatedMs: number };
  eggHatched: { creatureId: number; parents: [number, number] };
  missionCompleted: { missionId: string; creatureId: number; rewards: Record<string, Decimal>; wildCreatureId: number | null };
  potionUsed: { potion: string; creatureId: number | null };
}
