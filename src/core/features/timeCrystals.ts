import { D } from '../num';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Process } from '../state';

/**
 * Zeitkristalle: a scarce currency (Gen-Aufträge from level 3, the daily
 * gift, tower milestones) that shortens one long project (≥ 1 h) by a few
 * hours. Market potions only speed up short processes, so long projects
 * stay long unless a crystal is spent on purpose.
 */
export const TIME_CRYSTALS = 'timeCrystals';

export function isLongProject(ctx: GameContext, p: Process): boolean {
  return p.durationMs >= ctx.balance.timeCrystals.longProjectHours * 3_600_000;
}

export function crystalSkipMs(ctx: GameContext): number {
  return ctx.balance.timeCrystals.skipHours * 3_600_000;
}

export function timeCrystals(ctx: GameContext): number {
  return Math.floor(ctx.state.resources[TIME_CRYSTALS]?.toNumber() ?? 0);
}

export function useTimeCrystal(ctx: GameContext, processId: number): ActionResult {
  const p = ctx.state.processes.find((x) => x.id === processId);
  if (!p) return { ok: false, reason: 'Das Projekt läuft nicht mehr.' };
  if (!isLongProject(ctx, p)) return { ok: false, reason: 'Zeitkristalle wirken nur auf lange Projekte.' };
  if (p.elapsedMs >= p.durationMs) return { ok: false, reason: 'Das Projekt ist schon fertig.' };
  if (timeCrystals(ctx) < 1) return { ok: false, reason: 'Kein Zeitkristall vorhanden.' };
  ctx.state.resources[TIME_CRYSTALS] = ctx.state.resources[TIME_CRYSTALS]!.sub(D(1));
  // Real hours: with a speed modifier the project moves on by that much more.
  const speed = Math.max(0, ctx.mods().factor(`process.${p.kind}.speed`));
  p.elapsedMs = Math.min(p.durationMs, p.elapsedMs + crystalSkipMs(ctx) * speed);
  ctx.bus.emit('timeCrystalUsed', { processId: p.id, kind: p.kind });
  return { ok: true };
}
