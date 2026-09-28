import { D, type Decimal } from './num';
import { productionRates } from './systems/production';
import type { ResourceAmounts } from './content/types';
import type { GameContext } from './context';

/** A reward that grows with the game: minutes of production plus fixed amounts. */
export interface RewardSpec {
  /** Minutes of the current production of every produced resource. */
  minutes?: number;
  /** Fixed amounts; only granted once the resource's feature is unlocked. */
  resources?: ResourceAmounts;
}

/** Concrete amounts right now, scaled by the `factorTarget` modifier (e.g. `contracts.reward`). */
export function rewardAmounts(ctx: GameContext, spec: RewardSpec, factorTarget?: string): Record<string, Decimal> {
  const factor = factorTarget ? ctx.mods().factor(factorTarget) : 1;
  const out: Record<string, Decimal> = {};
  const add = (res: string, v: Decimal) => (out[res] = (out[res] ?? D(0)).add(v));
  if (spec.minutes) {
    for (const [res, rate] of Object.entries(productionRates(ctx))) if (rate.gt(0)) add(res, rate.mul(60 * spec.minutes));
  }
  for (const [res, amount] of Object.entries(spec.resources ?? {})) {
    const feature = ctx.content.resources.get(res).feature;
    if (!feature || ctx.state.features[feature]) add(res, D(amount));
  }
  for (const res of Object.keys(out)) out[res] = out[res]!.mul(factor).floor();
  return out;
}
