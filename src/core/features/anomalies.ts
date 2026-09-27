import { checkCondition } from '../conditions';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { ModifierProvider } from '../providers';
import { resetLayer } from '../prestige';
import { checkUnlocks } from '../systems/unlocks';

/**
 * Anomaly challenges: a run with changed rules. Starting one performs an
 * inheritance-style reset (without currency); reaching the goal completes
 * it and grants a permanent reward.
 */
export const ANOMALY_RESET_LAYER = 'inheritance';

export function anomalyAvailable(ctx: GameContext, id: string): boolean {
  const a = ctx.content.anomalies.get(id);
  return !a.requires || checkCondition(ctx.state, a.requires);
}

export function startAnomaly(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['anomalies']) return { ok: false, reason: 'Anomalien sind noch nicht freigeschaltet.' };
  if (ctx.state.anomaly) return { ok: false, reason: 'Es läuft bereits eine Anomalie.' };
  if (!anomalyAvailable(ctx, id)) return { ok: false, reason: 'Noch nicht verfügbar.' };
  resetLayer(ctx, ctx.content.prestigeLayers.get(ANOMALY_RESET_LAYER));
  ctx.state.anomaly = { id };
  ctx.invalidate();
  ctx.bus.emit('anomalyStarted', { anomaly: id });
  checkUnlocks(ctx);
  return { ok: true };
}

/** Leaves the anomaly without reward (the run continues under normal rules). */
export function abandonAnomaly(ctx: GameContext): ActionResult {
  if (!ctx.state.anomaly) return { ok: false, reason: 'Keine Anomalie aktiv.' };
  ctx.state.anomaly = null;
  ctx.invalidate();
  return { ok: true };
}

/** Called from the unlock system every step. */
export function checkAnomaly(ctx: GameContext): void {
  const run = ctx.state.anomaly;
  if (!run) return;
  const def = ctx.content.anomalies.get(run.id);
  if (!checkCondition(ctx.state, def.goal)) return;
  ctx.state.anomaliesCompleted[run.id] = true;
  ctx.state.anomaly = null;
  ctx.invalidate();
  ctx.bus.emit('anomalyCompleted', { anomaly: run.id });
}

export function ruleActive(ctx: GameContext, rule: 'noPotions'): boolean {
  const run = ctx.state.anomaly;
  return !!run && ctx.content.anomalies.get(run.id).rules?.[rule] === true;
}

export const anomalyProvider: ModifierProvider = (ctx, into) => {
  const run = ctx.state.anomaly;
  if (run) into.addAll(`anomaly:${run.id}`, ctx.content.anomalies.get(run.id).modifiers);
  for (const a of ctx.content.anomalies.list) if (ctx.state.anomaliesCompleted[a.id]) into.addAll(`anomalyReward:${a.id}`, a.reward);
};
