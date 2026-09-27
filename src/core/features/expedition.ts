import { D, type Decimal } from '../num';
import { createCreature, effectiveStats, findCreature } from '../creatures';
import { grant, trySpend } from '../resources';
import { toCost } from '../costs';
import { registerProcessHandler, startProcess } from '../systems/processes';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';

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

export function startMission(ctx: GameContext, creatureId: number, missionId: string): ActionResult {
  if (!ctx.state.features['expedition']) return { ok: false, reason: 'Erkundung ist noch nicht freigeschaltet.' };
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

    const speed = c ? (effectiveStats(ctx, c).spd ?? 0) : 0;
    const factor = ctx.mods().apply('mission.reward', 1) * (1 + speed * ctx.balance.missions.statScaling);
    const rewards: Record<string, Decimal> = {};
    for (const [res, [min, max]] of Object.entries(def.rewards)) {
      const amount = D(ctx.rng.range(min, max) * factor).floor();
      if (amount.gt(0)) {
        rewards[res] = amount;
        grant(ctx, res, amount, `mission:${missionId}`);
      }
    }

    let wildCreatureId: number | null = null;
    if (ctx.rng.chance(wildChance(ctx, missionId))) {
      const pool = ctx.content.species.list.filter((s) => s.wild);
      if (pool.length > 0) wildCreatureId = createCreature(ctx, { speciesId: ctx.rng.pick(pool).id, source: 'wild' }).id;
    }
    ctx.bus.emit('missionCompleted', { missionId, creatureId, rewards, wildCreatureId });
  },
});
