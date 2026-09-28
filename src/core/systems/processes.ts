import type { GameContext } from '../context';
import type { Process } from '../state';
import type { System } from './types';

export interface ProcessHandler {
  /** Called once when the process finishes. */
  complete(ctx: GameContext, process: Process): void;
}

const handlers = new Map<string, ProcessHandler>();

/** Register a timed system (eggs, missions, sequencing ...) without touching the tick. */
export function registerProcessHandler(kind: string, handler: ProcessHandler): void {
  handlers.set(kind, handler);
}

export function getProcessHandler(kind: string): ProcessHandler | undefined {
  return handlers.get(kind);
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

/** Skips time on all running processes (time crystal). */
export function skipProcessTime(ctx: GameContext, ms: number): void {
  for (const p of ctx.state.processes) p.elapsedMs = Math.min(p.durationMs, p.elapsedMs + ms);
}

export const processSystem: System = {
  id: 'processes',
  update(ctx, dtMs) {
    const mods = ctx.mods();
    const finished: Process[] = [];
    for (const p of ctx.state.processes) {
      p.elapsedMs += dtMs * Math.max(0, mods.factor(`process.${p.kind}.speed`));
      if (p.elapsedMs >= p.durationMs) finished.push(p);
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
