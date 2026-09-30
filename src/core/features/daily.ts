import { D, type Decimal } from '../num';
import { catalogueSamples } from '../genetics';
import { grant } from '../resources';
import { rewardAmounts } from '../rewards';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import { contractDay, nextContractDay } from './contracts';

/**
 * Tagesbelohnung: a gift once per day (same day boundary as the contract
 * board). The Treue-Kalender moves one step per claim, not per calendar day,
 * so a break never resets it. Rewards grow with production like contracts.
 */
export function dailySteps(ctx: GameContext): number {
  return ctx.balance.daily.rewards.length;
}

export function dailyAvailable(ctx: GameContext, nowMs = ctx.state.lastTickAt): boolean {
  return ctx.state.features['daily'] === true && ctx.state.daily.day !== contractDay(ctx, nowMs);
}

/** When the next gift can be claimed. */
export function nextDailyAt(ctx: GameContext, nowMs = ctx.state.lastTickAt): number {
  return dailyAvailable(ctx, nowMs) ? nowMs : nextContractDay(ctx, nowMs);
}

export function dailyReward(ctx: GameContext, step = ctx.state.daily.step): { amounts: Record<string, Decimal>; alleleSamples: number } {
  const spec = ctx.balance.daily.rewards[step % dailySteps(ctx)] ?? {};
  const amounts = rewardAmounts(ctx, spec, 'daily.reward');
  // Fackeln for the GenLab RPG: a fixed number, they do not grow with production.
  if (ctx.state.features['rpg']) {
    const cfg = ctx.balance.rpg;
    amounts['torches'] = D(step % dailySteps(ctx) === dailySteps(ctx) - 1 ? cfg.dailyTorchesLast : cfg.dailyTorches);
  }
  return { amounts, alleleSamples: spec.alleleSamples ?? 0 };
}

export function claimDaily(ctx: GameContext, nowMs = ctx.state.lastTickAt): ActionResult {
  if (!ctx.state.features['daily']) return { ok: false, reason: 'Die Tagesbelohnung ist noch nicht freigeschaltet.' };
  if (!dailyAvailable(ctx, nowMs)) return { ok: false, reason: 'Heute schon abgeholt – morgen gibt es die nächste.' };
  const daily = ctx.state.daily;
  const step = daily.step % dailySteps(ctx);
  const reward = dailyReward(ctx, step);
  for (const [res, amount] of Object.entries(reward.amounts)) grant(ctx, res, amount, 'daily');
  catalogueSamples(ctx, reward.alleleSamples);
  daily.day = contractDay(ctx, nowMs);
  daily.step = (step + 1) % dailySteps(ctx);
  daily.claimed++;
  ctx.bus.emit('dailyClaimed', { step });
  return { ok: true };
}
