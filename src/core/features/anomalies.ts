import { D } from '../num';
import { checkCondition, conditionProgress, scaleCondition } from '../conditions';
import { formatNumber } from '../format';
import { grant } from '../resources';
import type { Condition } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { ModifierProvider } from '../providers';
import { resetLayer } from '../prestige';
import { checkUnlocks } from '../systems/unlocks';

/**
 * Anomaly challenges: a run with changed rules. Starting one performs an
 * inheritance-style reset (without currency); reaching the goal completes
 * it and grants a permanent reward.
 *
 * Every anomaly has difficulty stages I–V (harder rules and a bigger goal
 * per stage; the next stage opens once the previous one is mastered), and
 * several can run at once – the run is won when all goals are met. The
 * reward grows with the best stage mastered, and a new record in total
 * difficulty (sum of the stages of one run) pays Äon-Splitter and a
 * permanent bonus.
 */
export const ANOMALY_RESET_LAYER = 'inheritance';

export function anomalyAvailable(ctx: GameContext, id: string): boolean {
  const a = ctx.content.anomalies.get(id);
  return !a.requires || checkCondition(ctx.state, a.requires);
}

/** Best stage mastered (0 = never). */
export function anomalyBest(ctx: GameContext, id: string): number {
  return ctx.state.anomalyBest[id] ?? 0;
}

/** Highest stage that may be started: one above the best mastered, at most `maxLevel`. */
export function maxStartLevel(ctx: GameContext, id: string): number {
  return Math.min(ctx.balance.anomalies.maxLevel, anomalyBest(ctx, id) + 1);
}

/** Goal of an anomaly at a stage (countable goals × goalGrowth^(stage − 1)). */
export function anomalyGoal(ctx: GameContext, id: string, level: number): Condition {
  const def = ctx.content.anomalies.get(id);
  return level <= 1 ? def.goal : scaleCondition(def.goal, Math.pow(ctx.balance.anomalies.goalGrowth, level - 1));
}

/** Goal as text: generated for earned resources (so it scales), otherwise the content text. */
export function anomalyGoalText(ctx: GameContext, id: string, level: number): string {
  const goal = anomalyGoal(ctx, id, level);
  if (goal.type === 'resourceEarned') return `${formatNumber(goal.amount)} ${ctx.content.resources.get(goal.resource).name} in diesem Lauf verdienen`;
  return ctx.content.anomalies.get(id).goalText;
}

/** Active anomalies of the running challenge with their stages. */
export function activeAnomalies(ctx: GameContext): { id: string; level: number }[] {
  return Object.entries(ctx.state.anomaly?.levels ?? {}).map(([id, level]) => ({ id, level }));
}

/** Progress of the running challenge towards all goals (0–1, the slowest goal counts). */
export function anomalyProgress(ctx: GameContext): number | null {
  const active = activeAnomalies(ctx);
  if (active.length === 0) return null;
  return conditionProgress(ctx.state, { type: 'all', of: active.map((a) => anomalyGoal(ctx, a.id, a.level)) });
}

/**
 * Starts a challenge with one or more anomalies (id → stage). Resets the run
 * like an inheritance, without currency.
 */
export function startAnomalies(ctx: GameContext, levels: Record<string, number>): ActionResult {
  if (!ctx.state.features['anomalies']) return { ok: false, reason: 'Anomalien sind noch nicht freigeschaltet.' };
  if (ctx.state.anomaly) return { ok: false, reason: 'Es läuft bereits eine Anomalie.' };
  const chosen = Object.entries(levels).filter(([, l]) => l > 0);
  if (chosen.length === 0) return { ok: false, reason: 'Wähle mindestens eine Anomalie.' };
  for (const [id, level] of chosen) {
    if (!ctx.content.anomalies.has(id) || !anomalyAvailable(ctx, id)) return { ok: false, reason: 'Noch nicht verfügbar.' };
    if (!Number.isInteger(level) || level > maxStartLevel(ctx, id)) return { ok: false, reason: `Stufe ${level} von „${ctx.content.anomalies.get(id).name}“ ist noch nicht freigeschaltet.` };
  }
  resetLayer(ctx, ctx.content.prestigeLayers.get(ANOMALY_RESET_LAYER));
  ctx.state.anomaly = { levels: Object.fromEntries(chosen) };
  ctx.invalidate();
  for (const [id] of chosen) ctx.bus.emit('anomalyStarted', { anomaly: id });
  checkUnlocks(ctx);
  return { ok: true };
}

/** One anomaly at a stage (stage I by default). */
export function startAnomaly(ctx: GameContext, id: string, level = 1): ActionResult {
  return startAnomalies(ctx, { [id]: level });
}

/** Leaves the anomaly without reward (the run continues under normal rules). */
export function abandonAnomaly(ctx: GameContext): ActionResult {
  if (!ctx.state.anomaly) return { ok: false, reason: 'Keine Anomalie aktiv.' };
  ctx.state.anomaly = null;
  ctx.invalidate();
  return { ok: true };
}

/** Called from the unlock system every step: completes the challenge once every goal is met. */
export function checkAnomaly(ctx: GameContext): void {
  const active = activeAnomalies(ctx);
  if (active.length === 0) return;
  if (!active.every((a) => checkCondition(ctx.state, anomalyGoal(ctx, a.id, a.level)))) return;
  for (const a of active) {
    ctx.state.anomaliesCompleted[a.id] = true;
    ctx.state.anomalyBest[a.id] = Math.max(anomalyBest(ctx, a.id), a.level);
  }
  const total = active.reduce((n, a) => n + a.level, 0);
  const cfg = ctx.balance.anomalies;
  if (total > ctx.state.anomalyRecord) {
    const shards = (total - ctx.state.anomalyRecord) * cfg.shardsPerRecordPoint;
    ctx.state.anomalyRecord = total;
    if (shards > 0) grant(ctx, 'aeonShards', D(shards), 'anomaly:record');
    ctx.bus.emit('anomalyRecord', { total, shards });
  }
  ctx.state.anomaly = null;
  ctx.invalidate();
  for (const a of active) ctx.bus.emit('anomalyCompleted', { anomaly: a.id, level: a.level });
}

export function ruleActive(ctx: GameContext, rule: 'noPotions'): boolean {
  return activeAnomalies(ctx).some((a) => ctx.content.anomalies.get(a.id).rules?.[rule] === true);
}

export const anomalyProvider: ModifierProvider = (ctx, into) => {
  for (const a of activeAnomalies(ctx)) {
    if (!ctx.content.anomalies.has(a.id)) continue;
    const def = ctx.content.anomalies.get(a.id);
    into.addAll(`anomaly:${a.id}`, def.modifiers);
    if (a.level > 1 && def.perLevel) into.addAll(`anomaly:${a.id}:stage`, def.perLevel, a.level - 1);
  }
  for (const def of ctx.content.anomalies.list) {
    const best = ctx.state.anomalyBest[def.id] ?? (ctx.state.anomaliesCompleted[def.id] ? 1 : 0);
    if (best > 0) into.addAll(`anomalyReward:${def.id}`, def.reward, best);
  }
  if (ctx.state.anomalyRecord > 0) into.addAll('anomalyRecord', ctx.balance.anomalies.recordModifiers, ctx.state.anomalyRecord);
};
