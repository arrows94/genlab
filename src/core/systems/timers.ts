import type { GameContext } from '../context';
import type { Buff, Process } from '../state';
import { expireBuffs } from './buffs';
import { completeProcesses, isWaiting } from './processes';

/** Offline cap for the full simulation (production, automation, tower …). */
export function offlineCapMs(ctx: GameContext): number {
  return ctx.mods().apply('offline.capHours', ctx.balance.offline.capHours) * 3_600_000;
}

/** Tolerance for floating point drift when a timer lands exactly on its end. */
const EPSILON_MS = 1e-3;

/**
 * Lets running timers (processes and buffs) follow the real clock without
 * simulating anything else: no production, no automation, no tower. Used for
 * the part of an absence beyond the offline cap, so long projects (expeditions,
 * eggs, sequencing …) finish on time however long the player was away.
 *
 * Only processes that are already running advance; anything a completion
 * starts waits for the next real tick, so chains stay limited to the cap.
 * The time is split at every completion/expiry, because those can change
 * `process.<kind>.speed` for the remaining processes.
 */
export function advanceTimers(ctx: GameContext, ms: number): void {
  // Finished processes waiting for the player take no time.
  const running = new Set<Process>(ctx.state.processes.filter((p) => !isWaiting(ctx, p)));
  let remaining = ms;
  while (remaining > 0 && (running.size > 0 || ctx.state.buffs.length > 0)) {
    for (const p of running) if (!ctx.state.processes.includes(p)) running.delete(p);
    const mods = ctx.mods();
    const speeds = new Map<Process, number>();
    let dt = remaining;
    for (const p of running) {
      const speed = Math.max(0, mods.factor(`process.${p.kind}.speed`));
      speeds.set(p, speed);
      if (speed > 0) dt = Math.min(dt, (p.durationMs - p.elapsedMs) / speed);
    }
    for (const b of ctx.state.buffs) dt = Math.min(dt, b.remainingMs);
    dt = Math.max(0, dt);

    const finished: Process[] = [];
    for (const p of running) {
      p.elapsedMs = Math.min(p.durationMs, p.elapsedMs + dt * speeds.get(p)!);
      if (p.elapsedMs >= p.durationMs - EPSILON_MS) finished.push(p);
    }
    const expired: Buff[] = [];
    for (const b of ctx.state.buffs) {
      b.remainingMs -= dt;
      if (b.remainingMs <= EPSILON_MS) expired.push(b);
    }
    remaining -= dt;

    // Same order as a live step: processes first, then buffs.
    for (const p of finished) {
      p.elapsedMs = p.durationMs;
      running.delete(p);
    }
    completeProcesses(ctx, finished.filter((p) => !isWaiting(ctx, p)));
    expireBuffs(ctx, expired);
  }
}
