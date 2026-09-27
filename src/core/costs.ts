import { D, type Decimal } from './num';
import type { ModifierSet } from './modifiers';
import type { ResourceAmounts, UpgradeDef } from './content/types';
import type { GameState } from './state';

export type Cost = Record<string, Decimal>;

/** Cost of the level after `level` levels are owned: base × growth^level. */
export function costAtLevel(base: number, growth: number, level: number): Decimal {
  return D(base).mul(D(growth).pow(level));
}

/** Total cost of buying `count` levels starting at `level` (geometric series). */
export function bulkCost(base: number, growth: number, level: number, count: number): Decimal {
  if (count <= 0) return D(0);
  if (growth === 1) return D(base).mul(count);
  const first = costAtLevel(base, growth, level);
  return first.mul(D(growth).pow(count).sub(1)).div(growth - 1);
}

/** Max levels affordable with `budget`, starting at `level`. */
export function maxAffordable(base: number, growth: number, level: number, budget: Decimal): number {
  const first = costAtLevel(base, growth, level);
  if (budget.lt(first)) return 0;
  if (growth === 1) return Math.floor(budget.div(base).toNumber());
  // budget ≥ first × (g^n − 1)/(g − 1)  →  n ≤ log_g(budget × (g−1)/first + 1)
  const n = Math.floor(D(budget).mul(growth - 1).div(first).add(1).log10() / Math.log10(growth));
  // Correct floating point rounding at the boundary in both directions.
  let result = Math.max(0, n);
  while (result > 0 && bulkCost(base, growth, level, result).gt(budget)) result--;
  while (bulkCost(base, growth, level, result + 1).lte(budget.mul(1 + 1e-12))) result++;
  return result;
}

/** Scales a resource cost map (e.g. by `cost.upgrade` modifiers). */
export function scaleCost(amounts: ResourceAmounts, factor: Decimal | number, extra = 1): Cost {
  const out: Cost = {};
  for (const [res, amount] of Object.entries(amounts)) out[res] = D(amount).mul(factor).mul(extra);
  return out;
}

export function upgradeCost(def: UpgradeDef, level: number, mods: ModifierSet, count = 1): Cost {
  const discount = mods.factor('cost.upgrade') * mods.factor(`cost.upgrade.${def.id}`);
  const out: Cost = {};
  for (const [res, base] of Object.entries(def.cost)) {
    out[res] = bulkCost(base, def.costGrowth, level, count).mul(discount).ceil();
  }
  return out;
}

export function canAfford(state: GameState, cost: Cost): boolean {
  return Object.entries(cost).every(([res, amount]) => (state.resources[res] ?? D(0)).gte(amount));
}

export function toCost(amounts: ResourceAmounts): Cost {
  return scaleCost(amounts, 1);
}
