import { D } from '../num';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { System } from '../systems/types';

/**
 * GenLab RPG: a single monster goes into a dungeon alone. Unlike the rest of
 * the game it is played actively and turn by turn. Runs cost a Fackel; the
 * Fackeln come back by the real clock up to a small stock, so the dungeon
 * cannot be spammed and a day off costs nothing.
 */

const HOUR = 3_600_000;

export function torches(ctx: GameContext): number {
  return Math.floor((ctx.state.resources['torches'] ?? D(0)).toNumber());
}

/** Wall clock of the next Fackel (null while the stock is full or the RPG is locked). */
export function nextTorchAt(ctx: GameContext): number | null {
  const at = ctx.state.rpg.torchAt;
  if (!ctx.state.features['rpg'] || at <= 0) return null;
  return at + ctx.balance.rpg.torchHours * HOUR;
}

/**
 * Refills Fackeln by the real clock: one every `torchHours` below the stock
 * limit. The first call after the unlock fills the stock once.
 */
export function refreshTorches(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['rpg']) return;
  const r = ctx.state.rpg;
  const cfg = ctx.balance.rpg;
  const have = torches(ctx);
  if (r.torchAt < 0) {
    grant(ctx, 'torches', Math.max(0, cfg.maxTorches - have), 'rpg:torch');
    r.torchAt = 0;
    return;
  }
  if (have >= cfg.maxTorches) {
    r.torchAt = 0;
    return;
  }
  if (r.torchAt === 0) {
    r.torchAt = nowMs;
    return;
  }
  const interval = cfg.torchHours * HOUR;
  const ready = Math.floor((nowMs - r.torchAt) / interval);
  if (ready <= 0) return;
  const add = Math.min(ready, cfg.maxTorches - have);
  grant(ctx, 'torches', add, 'rpg:torch');
  r.torchAt = have + add >= cfg.maxTorches ? 0 : r.torchAt + ready * interval;
}

export const rpgSystem: System = {
  id: 'rpg',
  update(ctx) {
    refreshTorches(ctx);
  },
};
