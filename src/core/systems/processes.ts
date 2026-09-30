import type { GameContext } from '../context';
import type { Process } from '../state';
import type { System } from './types';

export interface ProcessHandler {
  /** Called once when the process finishes. */
  complete(ctx: GameContext, process: Process): void;
  /** True if a finished process waits for the player (e.g. a ritual egg to open) instead of completing on its own. */
  waitsForPlayer?(ctx: GameContext, process: Process): boolean;
}

const handlers = new Map<string, ProcessHandler>();

/** Register a timed system (eggs, missions, sequencing ...) without touching the tick. */
export function registerProcessHandler(kind: string, handler: ProcessHandler): void {
  handlers.set(kind, handler);
}

export function getProcessHandler(kind: string): ProcessHandler | undefined {
  return handlers.get(kind);
}

/**
 * Processes that keep running through a prestige reset (travellers are not in
 * the lab). Features register a predicate for their kinds.
 */
const resetSurvivors: ((ctx: GameContext, p: Process) => boolean)[] = [];
export function registerResetSurvivor(test: (ctx: GameContext, p: Process) => boolean): void {
  resetSurvivors.push(test);
}

export function survivesReset(ctx: GameContext, p: Process): boolean {
  return resetSurvivors.some((test) => test(ctx, p));
}

/** Finished, but held back until the player completes it (`completeProcesses`). */
export function isWaiting(ctx: GameContext, p: Process): boolean {
  return p.elapsedMs >= p.durationMs && !!handlers.get(p.kind)?.waitsForPlayer?.(ctx, p);
}

export function startProcess(ctx: GameContext, kind: string, durationMs: number, data: Record<string, unknown> = {}): Process {
  const process: Process = { id: ctx.state.nextId++, kind, durationMs, elapsedMs: 0, data };
  ctx.state.processes.push(process);
  ctx.bus.emit('processStarted', { processId: process.id, kind });
  return process;
}

/** Remaining real time in ms, considering `process.<kind>.speed`. */
export function processRemainingMs(ctx: GameContext, p: Process): number {
  const speed = Math.max(0.0001, ctx.mods().factor(`process.${p.kind}.speed`));
  return Math.max(0, (p.durationMs - p.elapsedMs) / speed);
}

/** Skips time on running processes shorter than `maxDurationMs` (Zeittrank: only short ones). */
export function skipProcessTime(ctx: GameContext, ms: number, maxDurationMs = Infinity): void {
  for (const p of ctx.state.processes) if (p.durationMs < maxDurationMs) p.elapsedMs = Math.min(p.durationMs, p.elapsedMs + ms);
}

export const processSystem: System = {
  id: 'processes',
  update(ctx, dtMs) {
    const mods = ctx.mods();
    const finished: Process[] = [];
    for (const p of ctx.state.processes) {
      p.elapsedMs += dtMs * Math.max(0, mods.factor(`process.${p.kind}.speed`));
      if (p.elapsedMs < p.durationMs) continue;
      p.elapsedMs = p.durationMs;
      if (!isWaiting(ctx, p)) finished.push(p);
    }
    completeProcesses(ctx, finished);
  },
};

/** Removes finished processes and runs their completion handlers (in the given order). */
export function completeProcesses(ctx: GameContext, finished: Process[]): void {
  if (finished.length === 0) return;
  ctx.state.processes = ctx.state.processes.filter((p) => !finished.includes(p));
  for (const p of finished) {
    getProcessHandler(p.kind)?.complete(ctx, p);
    ctx.bus.emit('processCompleted', { processId: p.id, kind: p.kind });
  }
  ctx.invalidate();
}
