import { D } from '../num';
import { createCreature } from '../creatures';
import { grant, spend } from '../resources';
import { completeProcesses, isWaiting, registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import { isSpeciesDiscovered } from './hybrids';
import { rollMinRarity } from './expedition';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { SpeciesDef } from '../content/types';
import type { Creature } from '../state';

/**
 * Urzeit-Eier: a rare resource (`primalEgg`) that hatches in the Brutkammer into an Urzeitwesen (species tier
 * `primal`). Which one sleeps inside is rolled when the egg is opened. Where eggs come from is data: RPG loot
 * (`rpg.loot.<room>.chance.primalEgg`) and Gen-Aufträge (`primalEggs.contractChance`, `findPrimalEgg`).
 * Eggs in stock and in the Brutkammer outlast every prestige; the hatched creatures live like any other.
 */
export const PRIMAL_EGG = 'primalEgg';
export const PRIMAL_EGG_RESOURCE = 'primalEgg';

registerResetSurvivor((_ctx, p) => p.kind === PRIMAL_EGG);

/** Every Urzeitwesen. */
export function primalSpecies(ctx: GameContext): SpeciesDef[] {
  return ctx.content.species.list.filter((s) => s.tier === 'primal');
}

export function isPrimal(ctx: GameContext, speciesId: string): boolean {
  return ctx.content.species.get(speciesId).tier === 'primal';
}

/** Places in the Brutkammer. */
export function primalNestSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.primalNest', ctx.balance.primalEggs.nests));
}

/** Eggs in the Brutkammer (running or waiting to be opened). */
export function primalNestEggs(ctx: GameContext) {
  return ctx.state.processes.filter((p) => p.kind === PRIMAL_EGG);
}

export function primalEggsOwned(ctx: GameContext): number {
  return Math.floor((ctx.state.resources[PRIMAL_EGG_RESOURCE] ?? D(0)).toNumber());
}

/** Shown in the Brutstation: the feature is open, or an egg still lies in the Brutkammer (e.g. after an Äon). */
export function primalNestVisible(ctx: GameContext): boolean {
  return !!ctx.state.features['primalEggs'] || primalNestEggs(ctx).length > 0;
}

/** Hatch weights: species missing from the dex weigh more, so a new one comes sooner. */
export function primalWeights(ctx: GameContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of primalSpecies(ctx)) {
    const w = s.eggWeight ?? 0;
    if (w > 0) out[s.id] = isSpeciesDiscovered(ctx, s.id) ? w : w * ctx.balance.primalEggs.undiscoveredWeight;
  }
  return out;
}

/** Chance per Urzeitwesen for the next egg (UI; unknown species stay nameless there). */
export function primalChances(ctx: GameContext): { species: SpeciesDef; chance: number; discovered: boolean }[] {
  const weights = primalWeights(ctx);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return primalSpecies(ctx).map((s) => ({ species: s, chance: total > 0 ? (weights[s.id] ?? 0) / total : 0, discovered: isSpeciesDiscovered(ctx, s.id) }));
}

/** An Urzeit-Ei turns up (`source` like `contract:<id>` for the resource event). */
export function findPrimalEgg(ctx: GameContext, source: string, amount = 1): void {
  grant(ctx, PRIMAL_EGG_RESOURCE, amount, source);
}

/** Rolls `chance` for an Urzeit-Ei; true if one was found. */
export function rollPrimalEgg(ctx: GameContext, chance: number, source: string): boolean {
  if (chance <= 0 || !ctx.rng.chance(Math.min(1, chance))) return false;
  findPrimalEgg(ctx, source);
  return true;
}

export function primalEggTimeMs(ctx: GameContext): number {
  return ctx.balance.primalEggs.hours * 3_600_000;
}

/** Lays an Urzeit-Ei from the stock into a free place of the Brutkammer. */
export function incubatePrimalEgg(ctx: GameContext): ActionResult {
  if (!ctx.state.features['primalEggs']) return { ok: false, reason: 'Du hast noch kein Urzeit-Ei gefunden.' };
  if (primalEggsOwned(ctx) < 1) return { ok: false, reason: 'Du hast kein Urzeit-Ei.' };
  if (primalNestEggs(ctx).length >= primalNestSlots(ctx)) return { ok: false, reason: 'Die Brutkammer ist belegt.' };
  const paid = spend(ctx, { [PRIMAL_EGG_RESOURCE]: D(1) });
  if (!paid.ok) return paid;
  startProcess(ctx, PRIMAL_EGG, primalEggTimeMs(ctx));
  ctx.invalidate();
  return { ok: true };
}

/**
 * Opens a finished Urzeit-Ei. The hatchling always finds room, even in a full stable – it waited long enough.
 * Returns the new creature.
 */
export function openPrimalEgg(ctx: GameContext, processId: number): ActionResult & { hatched?: Creature } {
  const egg = primalNestEggs(ctx).find((p) => p.id === processId);
  if (!egg) return { ok: false, reason: 'Dieses Urzeit-Ei gibt es nicht mehr.' };
  if (!isWaiting(ctx, egg)) return { ok: false, reason: 'Das Urzeit-Ei ist noch nicht so weit.' };
  const before = ctx.state.nextId;
  completeProcesses(ctx, [egg]);
  const hatched = ctx.state.creatures.find((c) => c.id >= before && isPrimal(ctx, c.speciesId));
  return { ok: true, hatched };
}

registerProcessHandler(PRIMAL_EGG, {
  // Like ritual eggs: the player opens it and sees what was inside.
  waitsForPlayer: () => true,
  complete(ctx) {
    const weights = primalWeights(ctx);
    if (Object.keys(weights).length === 0) return;
    const speciesId = ctx.rng.weighted(weights);
    createCreature(ctx, { speciesId, rarity: rollMinRarity(ctx, ctx.balance.primalEggs.minRarity), source: 'primal' });
  },
});
