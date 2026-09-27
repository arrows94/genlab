import { checkCondition } from '../conditions';
import { createCreature } from '../creatures';
import { checkAnomaly } from '../features/anomalies';
import type { GameContext } from '../context';
import type { System } from './types';

export function unlockFeature(ctx: GameContext, feature: string): boolean {
  if (ctx.state.features[feature]) return false;
  ctx.content.features.get(feature);
  ctx.state.features[feature] = true;
  const silent = ctx.state.seenHints[feature] === true;
  ctx.state.seenHints[feature] = true;
  ctx.invalidate();
  ctx.bus.emit('featureUnlocked', { feature, silent });
  const grant = ctx.content.features.get(feature).grantsCreature;
  if (grant) createCreature(ctx, { speciesId: grant.species, rarity: grant.rarity, source: 'other' });
  return true;
}

/** Checks feature conditions, dex milestones and achievements. */
export function checkUnlocks(ctx: GameContext): void {
  const { state, content } = ctx;
  for (const f of content.features.list) {
    if (!state.features[f.id] && f.condition && checkCondition(state, f.condition)) unlockFeature(ctx, f.id);
  }
  const perRarity: Record<string, number> = {};
  for (const key of Object.keys(state.dex)) {
    const rarity = key.split(':')[1] ?? '';
    perRarity[rarity] = (perRarity[rarity] ?? 0) + 1;
  }
  for (const reward of content.dexRewards.list) {
    for (const milestone of reward.unlocksFeatures ?? []) {
      if ((perRarity[reward.rarity] ?? 0) >= milestone.count) milestone.features.forEach((f) => unlockFeature(ctx, f));
    }
  }
  checkAnomaly(ctx);
  for (const a of content.achievements.list) {
    if (!state.achievements[a.id] && checkCondition(state, a.condition)) {
      state.achievements[a.id] = true;
      ctx.invalidate();
      ctx.bus.emit('achievementUnlocked', { achievement: a.id });
    }
  }
}

export const unlockSystem: System = {
  id: 'unlocks',
  update(ctx) {
    checkUnlocks(ctx);
  },
};
