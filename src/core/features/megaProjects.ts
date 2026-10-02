import { D, type Decimal } from '../num';
import { checkCondition } from '../conditions';
import { registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import type { Cost } from '../costs';
import type { MegaProjectDef, MegaProjectStageDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { MegaProjectState, Process } from '../state';

/**
 * Großprojekte: buildings that take days. Each stage is paid in over any
 * number of visits (whatever is on hand, up to what is still missing), then
 * builds by the real clock. Deposits and finished stages are never reset,
 * and a running construction keeps going through inheritance and Äon.
 */
export const MEGA_PROJECT = 'megaProject';

export interface MegaProjectData extends Record<string, unknown> {
  project: string;
  /** Stage being built (1-based). */
  stage: number;
}

registerResetSurvivor((_ctx, p) => p.kind === MEGA_PROJECT);

export function megaState(ctx: GameContext, id: string): MegaProjectState {
  return ctx.state.megaProjects[id] ?? { stage: 0, paid: {} };
}

export function megaAvailable(ctx: GameContext, def: MegaProjectDef): boolean {
  return !!ctx.state.features['megaProjects'] && (!def.requires || checkCondition(ctx.state, def.requires));
}

/** The stage currently paid into or built (null when finished). */
export function currentStage(ctx: GameContext, def: MegaProjectDef): MegaProjectStageDef | null {
  return def.stages[megaState(ctx, def.id).stage] ?? null;
}

export function megaConstruction(ctx: GameContext, id: string): Process | undefined {
  return ctx.state.processes.find((p) => p.kind === MEGA_PROJECT && (p.data as MegaProjectData).project === id);
}

/** What the current stage still needs, per resource (empty when fully paid). */
export function megaRemaining(ctx: GameContext, def: MegaProjectDef): Cost {
  const stage = currentStage(ctx, def);
  const out: Cost = {};
  if (!stage) return out;
  const paid = megaState(ctx, def.id).paid;
  for (const [res, amount] of Object.entries(stage.cost)) {
    const left = D(amount).sub(paid[res] ?? D(0));
    if (left.gt(0)) out[res] = left;
  }
  return out;
}

/** Paid share of the current stage (0–1), averaged over its resources. */
export function megaProgress(ctx: GameContext, def: MegaProjectDef): number {
  const stage = currentStage(ctx, def);
  if (!stage) return 1;
  const paid = megaState(ctx, def.id).paid;
  const parts = Object.entries(stage.cost).map(([res, amount]) => Math.min(1, (paid[res] ?? D(0)).div(amount).toNumber()));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 1;
}

/** What a deposit of `share` (0–1) of the owned resources would pay in now. */
export function depositPreview(ctx: GameContext, def: MegaProjectDef, share = 1): Cost {
  const out: Cost = {};
  if (megaConstruction(ctx, def.id)) return out;
  for (const [res, left] of Object.entries(megaRemaining(ctx, def))) {
    const owned = ctx.state.resources[res] ?? D(0);
    const give = minDecimal(owned.mul(share).floor(), left);
    if (give.gt(0)) out[res] = give;
  }
  return out;
}

function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lt(b) ? a : b;
}

/**
 * Pays in up to `share` of every owned resource the current stage still
 * needs. The last deposit starts the construction.
 */
export function depositMegaProject(ctx: GameContext, id: string, share = 1): ActionResult {
  if (!ctx.state.features['megaProjects']) return { ok: false, reason: 'Großprojekte sind noch nicht freigeschaltet.' };
  const def = ctx.content.megaProjects.get(id);
  if (!megaAvailable(ctx, def)) return { ok: false, reason: 'Dieses Großprojekt ist noch nicht verfügbar.' };
  const stage = currentStage(ctx, def);
  if (!stage) return { ok: false, reason: 'Bereits fertig gebaut.' };
  if (megaConstruction(ctx, id)) return { ok: false, reason: 'Diese Bauphase wird gerade gebaut.' };
  const give = depositPreview(ctx, def, Math.min(1, Math.max(0, share)));
  if (Object.keys(give).length === 0) return { ok: false, reason: 'Nichts zum Einzahlen vorhanden.' };

  const st = (ctx.state.megaProjects[id] ??= { stage: 0, paid: {} });
  for (const [res, amount] of Object.entries(give)) {
    ctx.state.resources[res] = (ctx.state.resources[res] ?? D(0)).sub(amount);
    st.paid[res] = (st.paid[res] ?? D(0)).add(amount);
  }
  if (Object.keys(megaRemaining(ctx, def)).length === 0) {
    const data: MegaProjectData = { project: id, stage: st.stage + 1 };
    startProcess(ctx, MEGA_PROJECT, stage.hours * 3_600_000, data);
  }
  return { ok: true };
}

registerProcessHandler(MEGA_PROJECT, {
  complete(ctx, proc) {
    const { project, stage } = proc.data as MegaProjectData;
    if (!ctx.content.megaProjects.has(project)) return;
    const st = (ctx.state.megaProjects[project] ??= { stage: 0, paid: {} });
    if (stage <= st.stage) return;
    st.stage = stage;
    st.paid = {};
    ctx.invalidate();
    ctx.bus.emit('megaProjectStage', { project, stage });
  },
});
