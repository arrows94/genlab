import { D, type NumLike } from './num';
import { canAfford, type Cost } from './costs';
import { formatNumber } from './format';
import type { GameContext } from './context';
import type { ActionResult } from './actions';

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

/** „Nicht genug Essenz – es fehlen 1,2 Tsd.“: names what is missing (null when affordable). */
export function missingText(ctx: GameContext, cost: Cost): string | null {
  const missing = Object.entries(cost)
    .map(([res, amount]) => ({ res, short: amount.sub(ctx.state.resources[res] ?? D(0)) }))
    .filter((m) => m.short.gt(0));
  if (missing.length === 0) return null;
  const name = (res: string) => {
    const n = ctx.content.resources.has(res) ? ctx.content.resources.get(res).name : res;
    return n.endsWith('kristall') ? `${n}e` : n; // „Evolutionskristalle“, „Zeitkristalle“
  };
  if (missing.length === 1) return `Nicht genug ${name(missing[0]!.res)} – es fehlen ${formatNumber(missing[0]!.short.ceil())}.`;
  const names = missing.map((m) => name(m.res));
  return `Nicht genug ${names.slice(0, -1).join(', ')} und ${names.at(-1)}.`;
}

/** Pays the cost, or says what is missing. */
export function spend(ctx: GameContext, cost: Cost): ActionResult {
  const missing = missingText(ctx, cost);
  if (missing) return { ok: false, reason: missing };
  trySpend(ctx, cost);
  return { ok: true };
}
