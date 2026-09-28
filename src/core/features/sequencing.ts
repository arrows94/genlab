import { D } from '../num';
import { checkPerfection, findCreature } from '../creatures';
import { catalogueGenome } from '../genetics';
import { trySpend } from '../resources';
import { registerProcessHandler, startProcess } from '../systems/processes';
import type { Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';

/**
 * Sequencing lab: reveals a creature's hidden genome for essence + time and
 * catalogues its alleles in the gene library. The creature keeps working
 * (only a sample goes into the lab).
 */
export const SEQUENCE = 'sequence';
/** Tiefensequenzierung shares the sequencer slots (see deepSequencing.ts). */
export const DEEP_SEQUENCE = 'deepSequence';

export interface SequenceData extends Record<string, unknown> {
  creatureId: number;
}

export function sequencerSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.sequencer', ctx.balance.genetics.sequencing.baseSlots));
}

/** Sequencer slots in use: normal and deep sequencing. */
export function sequencerUsed(ctx: GameContext): number {
  return ctx.state.processes.filter((p) => p.kind === SEQUENCE || p.kind === DEEP_SEQUENCE).length;
}

export function isBeingSequenced(ctx: GameContext, creatureId: number): boolean {
  return ctx.state.processes.some((p) => (p.kind === SEQUENCE || p.kind === DEEP_SEQUENCE) && (p.data as SequenceData).creatureId === creatureId);
}

export function sequencingCost(ctx: GameContext, c: Creature): Cost {
  const cfg = ctx.balance.genetics.sequencing;
  const factor = (1 + cfg.costPerGeneration * (c.generation - 1)) * ctx.mods().factor('cost.sequencing');
  const cost: Cost = {};
  for (const [res, amount] of Object.entries(cfg.cost)) cost[res] = D(amount).mul(factor).ceil();
  return cost;
}

export function sequencingTimeMs(ctx: GameContext): number {
  return Math.max(1000, ctx.mods().apply('sequencing.time', ctx.balance.genetics.sequencing.baseTimeSec) * 1000);
}

export function startSequencing(ctx: GameContext, creatureId: number): ActionResult {
  if (!ctx.state.features['sequencing']) return { ok: false, reason: 'Das Sequenzierlabor ist noch nicht freigeschaltet.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (c.sequenced) return { ok: false, reason: 'Genom ist bereits entschlüsselt.' };
  if (isBeingSequenced(ctx, creatureId)) return { ok: false, reason: 'Wird bereits sequenziert.' };
  if (sequencerUsed(ctx) >= sequencerSlots(ctx)) return { ok: false, reason: 'Alle Sequenzierer sind belegt.' };
  if (!trySpend(ctx, sequencingCost(ctx, c))) return { ok: false, reason: 'Nicht genug Essenz.' };
  const data: SequenceData = { creatureId };
  startProcess(ctx, SEQUENCE, sequencingTimeMs(ctx), data);
  return { ok: true };
}

/** Marks a creature as sequenced and catalogues its alleles. */
export function revealGenome(ctx: GameContext, c: Creature): void {
  c.sequenced = true;
  catalogueGenome(ctx, c.genome);
  checkPerfection(ctx, c);
  ctx.invalidate();
  ctx.bus.emit('sequenced', { creatureId: c.id });
}

registerProcessHandler(SEQUENCE, {
  complete(ctx, proc) {
    const c = findCreature(ctx, (proc.data as SequenceData).creatureId);
    if (c && !c.sequenced) revealGenome(ctx, c);
  },
});
