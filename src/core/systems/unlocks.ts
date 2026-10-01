import { checkCondition, dexCounts } from '../conditions';
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

/**
 * Checks feature conditions, dex milestones and achievements. Runs every step (also offline),
 * so the dex is counted once and only recounted when an unlock granted a creature.
 */
export function checkUnlocks(ctx: GameContext): void {
  const { state, content } = ctx;
  let dex = dexCounts(state.dex);
  const unlock = (feature: string) => {
    if (unlockFeature(ctx, feature)) dex = dexCounts(state.dex);
  };
  for (const f of content.features.list) {
    if (!state.features[f.id] && f.condition && checkCondition(state, f.condition, dex)) unlock(f.id);
  }
  const perRarity = dex;
  for (const reward of content.dexRewards.list) {
    for (const milestone of reward.unlocksFeatures ?? []) {
      if ((perRarity.get(`:${reward.rarity}`) ?? 0) >= milestone.count) milestone.features.forEach(unlock);
    }
  }
  checkAnomaly(ctx);
  for (const a of content.achievements.list) {
    if (!state.achievements[a.id] && checkCondition(state, a.condition, dex)) {
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
