import { D } from './num';
import { ModifierSet } from './modifiers';
import type { GameContext } from './context';
import { activeLatent } from './creatures';
import { resonanceProvider, talentProvider } from './features/talents';
import { anomalyProvider } from './features/anomalies';
import { weeklyProvider } from './features/weekly';
import { grandResearchProvider } from './features/grandResearch';

/**
 * A modifier provider contributes modifiers from one part of the state.
 * New bonus sources (tower relics, aeon talents ...) = one new provider.
 */
export type ModifierProvider = (ctx: GameContext, into: ModifierSet) => void;

export const upgradeProvider: ModifierProvider = (ctx, into) => {
  for (const [id, level] of Object.entries(ctx.state.upgrades)) {
    if (level > 0 && ctx.content.upgrades.has(id)) {
      const def = ctx.content.upgrades.get(id);
      into.addAll(`upgrade:${id}`, def.modifiers, Math.pow(level, def.levelPower ?? 1));
    }
  }
};

export const achievementProvider: ModifierProvider = (ctx, into) => {
  for (const def of ctx.content.achievements.list) {
    if (ctx.state.achievements[def.id]) into.addAll(`achievement:${def.id}`, def.modifiers);
  }
};

export const dexProvider: ModifierProvider = (ctx, into) => {
  const perRarity: Record<string, number> = {};
  for (const key of Object.keys(ctx.state.dex)) {
    const rarity = key.split(':')[1] ?? '';
    perRarity[rarity] = (perRarity[rarity] ?? 0) + 1;
  }
  for (const reward of ctx.content.dexRewards.list) {
    const count = perRarity[reward.rarity] ?? 0;
    if (count > 0) into.addAll(`dex:${reward.id}`, reward.modifiersPerEntry, count);
  }
};

export const prestigeProvider: ModifierProvider = (ctx, into) => {
  for (const layer of ctx.content.prestigeLayers.list) {
    const points = (ctx.state.resources[layer.currency] ?? D(0)).toNumber();
    if (points > 0) into.addAll(`prestige:${layer.id}`, layer.modifiersPerPoint, points);
  }
};

export const buffProvider: ModifierProvider = (ctx, into) => {
  for (const buff of ctx.state.buffs) {
    if (buff.creatureId === null) into.addAll(`buff:${buff.source}`, buff.modifiers);
  }
};

export const globalAbilityProvider: ModifierProvider = (ctx, into) => {
  for (const c of ctx.state.creatures) {
    for (const id of c.abilities) {
      const def = ctx.content.abilities.has(id) ? ctx.content.abilities.get(id) : null;
      if (def?.scope === 'global') into.addAll(`ability:${id}#${c.id}`, def.modifiers);
    }
    const latent = activeLatent(ctx, c);
    if (latent?.scope === 'global') into.addAll(`latent:${latent.id}#${c.id}`, latent.modifiers);
  }
};

export const DEFAULT_PROVIDERS: ModifierProvider[] = [
  upgradeProvider,
  achievementProvider,
  dexProvider,
  prestigeProvider,
  buffProvider,
  globalAbilityProvider,
  talentProvider,
  anomalyProvider,
  weeklyProvider,
  grandResearchProvider,
  resonanceProvider,
];
