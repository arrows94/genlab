import { D, type NumLike } from './num';
import { canAfford, type Cost } from './costs';
import type { GameContext } from './context';

export function grant(ctx: GameContext, resource: string, amount: NumLike, source: string): void {
  const value = D(amount);
  if (value.lte(0)) return;
  const s = ctx.state;
  s.resources[resource] = (s.resources[resource] ?? D(0)).add(value);
  s.earned[resource] = (s.earned[resource] ?? D(0)).add(value);
  s.earnedTotal[resource] = (s.earnedTotal[resource] ?? D(0)).add(value);
  ctx.bus.emit('resourceGained', { resource, amount: value, source });
}

/** Quiet variant for continuous production (no event per tick). */
export function produce(ctx: GameContext, resource: string, amount: NumLike): void {
  const value = D(amount);
  if (value.lte(0)) return;
  const s = ctx.state;
  s.resources[resource] = (s.resources[resource] ?? D(0)).add(value);
  s.earned[resource] = (s.earned[resource] ?? D(0)).add(value);
  s.earnedTotal[resource] = (s.earnedTotal[resource] ?? D(0)).add(value);
}

/** Deducts the cost if affordable. Returns whether it was paid. */
export function trySpend(ctx: GameContext, cost: Cost): boolean {
  if (!canAfford(ctx.state, cost)) return false;
  for (const [res, amount] of Object.entries(cost)) {
    ctx.state.resources[res] = (ctx.state.resources[res] ?? D(0)).sub(amount);
  }
  return true;
}
