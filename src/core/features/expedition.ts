import { D, type Decimal } from '../num';
import { createCreature, effectiveStats, findCreature } from '../creatures';
import { grant, trySpend } from '../resources';
import { toCost } from '../costs';
import { checkCondition } from '../conditions';
import { revealHint } from './hybrids';
import { stableFree } from './stable';
import { registerProcessHandler, startProcess } from '../systems/processes';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';

export const MISSION = 'mission';

export interface MissionData extends Record<string, unknown> {
  missionId: string;
  creatureId: number;
}

export function campSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.camp', ctx.balance.missions.baseCamps));
}

export function runningMissions(ctx: GameContext) {
  return ctx.state.processes.filter((p) => p.kind === MISSION);
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

/** Chance to find a recipe hint: longer expeditions are more likely to find one. */
export function hintChance(ctx: GameContext, missionId: string): number {
  const hours = ctx.content.missions.get(missionId).durationSec / 3600;
  return Math.min(1, hours * ctx.balance.hybrids.hintChancePerHour);
}

/** Loot multiplier for a creature: global bonuses × its speed. */
export function missionRewardFactor(ctx: GameContext, creature: Creature | undefined): number {
  const speed = creature ? (effectiveStats(ctx, creature).spd ?? 0) : 0;
  return ctx.mods().apply('mission.reward', 1) * (1 + speed * ctx.balance.missions.statScaling);
}

export function startMission(ctx: GameContext, creatureId: number, missionId: string): ActionResult {
  if (!ctx.state.features['expedition']) return { ok: false, reason: 'Erkundung ist noch nicht freigeschaltet.' };
  if (!missionAvailable(ctx, missionId)) return { ok: false, reason: 'Dieses Gebiet ist noch nicht erschlossen.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (c.job && c.job.kind !== 'building') return { ok: false, reason: 'Die Kreatur ist beschäftigt.' };
  if (runningMissions(ctx).length >= campSlots(ctx)) return { ok: false, reason: 'Alle Camps sind belegt.' };
  const def = ctx.content.missions.get(missionId);
  if (!trySpend(ctx, toCost(def.cost))) return { ok: false, reason: 'Nicht genug Nahrung.' };
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
      if (pool.length > 0 && stableFree(ctx) > 0) wildCreatureId = createCreature(ctx, { speciesId: ctx.rng.pick(pool), source: 'wild' }).id;
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
