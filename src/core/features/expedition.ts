import { D, type Decimal } from '../num';
import { createCreature, creatureModifiers, effectiveStats, findCreature, isOccupied } from '../creatures';
import { grant, spend } from '../resources';
import { toCost } from '../costs';
import { checkCondition } from '../conditions';
import { rarityWeights, rollRarity } from '../rarity';
import { revealHint } from './hybrids';
import { stableFree } from './stable';
import { registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';

export const MISSION = 'mission';

export interface MissionData extends Record<string, unknown> {
  missionId: string;
  creatureId: number;
}

/** Missions of at least `balance.missions.journeyHours` are Tagesreisen: they survive an inheritance. */
export function isJourney(ctx: GameContext, missionId: string): boolean {
  return ctx.content.missions.has(missionId) && ctx.content.missions.get(missionId).durationSec >= ctx.balance.missions.journeyHours * 3600;
}

registerResetSurvivor((ctx, p) => p.kind === MISSION && isJourney(ctx, (p.data as MissionData).missionId));

export function campSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.camp', ctx.balance.missions.baseCamps));
}

export function runningMissions(ctx: GameContext) {
  return ctx.state.processes.filter((p) => p.kind === MISSION);
}

/** Process kinds that occupy a camp (missions; the voyage registers itself). */
const campKinds = new Set<string>([MISSION]);
export function registerCampProcess(kind: string): void {
  campKinds.add(kind);
}

export function campsUsed(ctx: GameContext): number {
  return ctx.state.processes.filter((p) => campKinds.has(p.kind)).length;
}

export function missionDurationMs(ctx: GameContext, missionId: string): number {
  const def = ctx.content.missions.get(missionId);
  return Math.max(1000, ctx.mods().apply('mission.time', def.durationSec) * 1000);
}

export function wildChance(ctx: GameContext, missionId: string): number {
  return Math.min(1, ctx.mods().apply('mission.wildChance', ctx.content.missions.get(missionId).wildChance));
}

export function missionAvailable(ctx: GameContext, missionId: string): boolean {
  const def = ctx.content.missions.get(missionId);
  return !def.requires || checkCondition(ctx.state, def.requires);
}

/** Species that can be found on this mission. */
export function missionSpecies(ctx: GameContext, missionId: string): string[] {
  const def = ctx.content.missions.get(missionId);
  return def.species ?? ctx.content.species.list.filter((s) => s.wild).map((s) => s.id);
}

/** Discovered hybrids with a parent living in this region (Äon talent „Wilde Kreuzungen“). */
export function wildHybridSpecies(ctx: GameContext, missionId: string): string[] {
  const pool = new Set(missionSpecies(ctx, missionId));
  const discovered = new Set(Object.keys(ctx.state.dex).map((key) => key.split(':')[0]));
  const found = ctx.content.recipes.list.filter((r) => discovered.has(r.result) && r.parents.some((p) => pool.has(p)));
  return [...new Set(found.map((r) => r.result))];
}

/** Species of a wild find: usually one living there, with the talent sometimes a hybrid. */
function wildSpecies(ctx: GameContext, missionId: string, pool: string[]): string {
  const chance = Math.min(1, ctx.mods().apply('mission.hybridChance', 0));
  if (chance > 0) {
    const hybrids = wildHybridSpecies(ctx, missionId);
    if (hybrids.length > 0 && ctx.rng.chance(chance)) return ctx.rng.pick(hybrids);
  }
  return ctx.rng.pick(pool);
}

/** Chance to find a recipe hint: longer expeditions are more likely to find one. */
export function hintChance(ctx: GameContext, missionId: string): number {
  const hours = ctx.content.missions.get(missionId).durationSec / 3600;
  return Math.min(1, hours * ctx.balance.hybrids.hintChancePerHour);
}

/** Loot multiplier for a creature: global bonuses × its speed. */
export function missionRewardFactor(ctx: GameContext, creature: Creature | undefined): number {
  const speed = creature ? (effectiveStats(ctx, creature).spd ?? 0) : 0;
  // The traveller's own loot bonus (Erbanlage „Fernweh“) counts for its own journeys only.
  const own = creature ? creatureModifiers(ctx, creature).factor('mission.reward') : 1;
  return ctx.mods().apply('mission.reward', 1) * own * (1 + speed * ctx.balance.missions.statScaling);
}

/** Rarity with the usual (modified) weights, but at least `min`. */
export function rollMinRarity(ctx: GameContext, min: string): string {
  const floor = ctx.content.rarities.get(min).order;
  const weights: Record<string, number> = {};
  for (const [id, w] of Object.entries(rarityWeights(ctx.content, ctx.balance, ctx.mods()))) {
    if (ctx.content.rarities.get(id).order >= floor && w > 0) weights[id] = w;
  }
  return Object.keys(weights).length > 0 ? rollRarity(ctx.rng, weights) : min;
}

export function startMission(ctx: GameContext, creatureId: number, missionId: string): ActionResult {
  if (!ctx.state.features['expedition']) return { ok: false, reason: 'Erkundung ist noch nicht freigeschaltet.' };
  if (!missionAvailable(ctx, missionId)) return { ok: false, reason: 'Dieses Gebiet ist noch nicht erschlossen.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (isOccupied(c)) return { ok: false, reason: 'Die Kreatur ist beschäftigt.' };
  if (campsUsed(ctx) >= campSlots(ctx)) return { ok: false, reason: 'Alle Camps sind belegt.' };
  const def = ctx.content.missions.get(missionId);
  if (def.maxConcurrent !== undefined && runningMissions(ctx).filter((p) => (p.data as MissionData).missionId === missionId).length >= def.maxConcurrent) {
    return { ok: false, reason: 'Dorthin ist bereits ein Team unterwegs.' };
  }
  const paid = spend(ctx, toCost(def.cost));
  if (!paid.ok) return paid;
  const data: MissionData = { missionId, creatureId };
  const proc = startProcess(ctx, MISSION, missionDurationMs(ctx, missionId), data);
  c.job = { kind: 'mission', target: String(proc.id) };
  ctx.invalidate();
  return { ok: true };
}

registerProcessHandler(MISSION, {
  complete(ctx, proc) {
    const { missionId, creatureId } = proc.data as MissionData;
    const def = ctx.content.missions.get(missionId);
    const c = findCreature(ctx, creatureId);
    if (c?.job?.kind === 'mission') c.job = null;

    const factor = missionRewardFactor(ctx, c);
    const rewards: Record<string, Decimal> = {};
    for (const [res, [min, max]] of Object.entries(def.rewards)) {
      // Stochastic rounding keeps the expected value for small integer rewards (0–1 crystals).
      const amount = D(Math.floor(ctx.rng.range(min, max) * factor + ctx.rng.next()));
      if (amount.gt(0)) {
        rewards[res] = amount;
        grant(ctx, res, amount, `mission:${missionId}`);
      }
    }

    let wildCreatureId: number | null = null;
    if (ctx.rng.chance(wildChance(ctx, missionId))) {
      const pool = missionSpecies(ctx, missionId);
      // A guaranteed find (journeys) always joins, even above the stable capacity.
      const guaranteed = def.wildMinRarity !== undefined;
      if (pool.length > 0 && (guaranteed || stableFree(ctx) > 0)) {
        const rarity = def.wildMinRarity ? rollMinRarity(ctx, def.wildMinRarity) : undefined;
        wildCreatureId = createCreature(ctx, { speciesId: wildSpecies(ctx, missionId, pool), rarity, source: 'wild' }).id;
      }
      else if (pool.length > 0) {
        // Stable full: the wild creature is released; the player gets its sell value in gold.
        const value = ctx.balance.sell.valueByRarity['common'] ?? {};
        const out: Record<string, Decimal> = {};
        for (const [res, v] of Object.entries(value)) {
          out[res] = D(v);
          grant(ctx, res, v, 'stableFull');
        }
        ctx.bus.emit('stableFull', { lost: 1, value: out });
      }
    }
    if (ctx.state.features['hybrids'] && ctx.rng.chance(hintChance(ctx, missionId))) revealHint(ctx);
    ctx.bus.emit('missionCompleted', { missionId, creatureId, rewards, wildCreatureId });
  },
});
