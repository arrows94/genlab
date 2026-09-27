import type { ModifierDef } from '../modifiers';
import type { GameContext } from '../context';
import type { Buff } from '../state';
import type { System } from './types';

export function addBuff(ctx: GameContext, source: string, modifiers: ModifierDef[], durationMs: number, creatureId: number | null = null): Buff {
  // Re-applying the same buff to the same target refreshes its duration.
  const existing = ctx.state.buffs.find((b) => b.source === source && b.creatureId === creatureId);
  if (existing) {
    existing.remainingMs = Math.max(existing.remainingMs, durationMs);
    return existing;
  }
  const buff: Buff = { id: ctx.state.nextId++, source, modifiers, remainingMs: durationMs, creatureId };
  ctx.state.buffs.push(buff);
  ctx.invalidate();
  return buff;
}

export const buffSystem: System = {
  id: 'buffs',
  update(ctx, dtMs) {
    if (ctx.state.buffs.length === 0) return;
    const expired: Buff[] = [];
    for (const b of ctx.state.buffs) {
      b.remainingMs -= dtMs;
      if (b.remainingMs <= 0) expired.push(b);
    }
    if (expired.length === 0) return;
    ctx.state.buffs = ctx.state.buffs.filter((b) => !expired.includes(b));
    ctx.invalidate();
    for (const b of expired) ctx.bus.emit('buffExpired', { buffId: b.id, source: b.source });
  },
};
