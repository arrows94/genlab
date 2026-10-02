import { D } from '../num';
import { checkCondition } from '../conditions';
import { spend } from '../resources';
import { registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import type { Cost } from '../costs';
import type { GrandResearchDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { ModifierProvider } from '../providers';
import type { Process } from '../state';

/**
 * Großforschung: one (or more) research slots for projects that take hours
 * or days. Levels are permanent (never reset); a running project also keeps
 * going through an inheritance or an Äon.
 */
export const GRAND_RESEARCH = 'grandResearch';

export interface GrandResearchData extends Record<string, unknown> {
  project: string;
  level: number;
}

registerResetSurvivor((_ctx, p) => p.kind === GRAND_RESEARCH);

export function grandLevel(ctx: GameContext, id: string): number {
  return ctx.state.grandResearch[id] ?? 0;
}

export function grandSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.grandResearch', ctx.balance.grandResearch.baseSlots));
}

export function runningGrandResearch(ctx: GameContext): Process[] {
  return ctx.state.processes.filter((p) => p.kind === GRAND_RESEARCH);
}

/** Level the next run of this project would reach (running levels count as taken). */
function nextLevel(ctx: GameContext, def: GrandResearchDef): number {
  const running = runningGrandResearch(ctx).filter((p) => (p.data as GrandResearchData).project === def.id).length;
  return grandLevel(ctx, def.id) + running + 1;
}

export function grandCost(ctx: GameContext, def: GrandResearchDef, level = nextLevel(ctx, def)): Cost {
  const cost: Cost = {};
  for (const [res, amount] of Object.entries(def.cost)) cost[res] = D(amount).mul(D(def.costGrowth).pow(level - 1)).ceil();
  return cost;
}

export function grandHours(def: GrandResearchDef, level: number): number {
  return def.hours * Math.pow(def.hoursGrowth, level - 1);
}

export function grandAvailable(ctx: GameContext, def: GrandResearchDef): boolean {
  return !!ctx.state.features['grandResearch'] && (!def.requires || checkCondition(ctx.state, def.requires));
}

export function startGrandResearch(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['grandResearch']) return { ok: false, reason: 'Die Großforschung ist noch nicht freigeschaltet.' };
  const def = ctx.content.grandResearch.get(id);
  if (!grandAvailable(ctx, def)) return { ok: false, reason: 'Dieses Projekt ist noch nicht verfügbar.' };
  const level = nextLevel(ctx, def);
  if (level > def.maxLevel) return { ok: false, reason: 'Bereits vollständig erforscht.' };
  if (runningGrandResearch(ctx).length >= grandSlots(ctx)) return { ok: false, reason: 'Der Forschungsplatz ist belegt.' };
  const paid = spend(ctx, grandCost(ctx, def, level));
  if (!paid.ok) return paid;
  const data: GrandResearchData = { project: id, level };
  startProcess(ctx, GRAND_RESEARCH, grandHours(def, level) * 3_600_000, data);
  return { ok: true };
}

registerProcessHandler(GRAND_RESEARCH, {
  complete(ctx, proc) {
    const { project, level } = proc.data as GrandResearchData;
    if (!ctx.content.grandResearch.has(project)) return;
    ctx.state.grandResearch[project] = Math.max(grandLevel(ctx, project), level);
    ctx.invalidate();
    ctx.bus.emit('grandResearchDone', { project, level });
  },
});

export const grandResearchProvider: ModifierProvider = (ctx, into) => {
  for (const [id, level] of Object.entries(ctx.state.grandResearch)) {
    if (level > 0 && ctx.content.grandResearch.has(id)) into.addAll(`grand:${id}`, ctx.content.grandResearch.get(id).modifiers, level);
  }
};
