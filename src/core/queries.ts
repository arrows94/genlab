import { canAfford } from './costs';
import { nextUpgradeCost, upgradeAvailable } from './actions';
import type { GameContext } from './context';
import type { UpgradeDef } from './content/types';

/** Read-only helpers for the UI (keeps rules out of components). */

export function visibleUpgrades(ctx: GameContext, category: UpgradeDef['category'] = 'research'): UpgradeDef[] {
  return ctx.content.upgrades.list.filter((u) => u.category === category && upgradeAvailable(ctx, u.id));
}

export function affordableUpgradeCount(ctx: GameContext): number {
  return visibleUpgrades(ctx).filter((u) => {
    const cost = nextUpgradeCost(ctx, u.id);
    return cost !== null && canAfford(ctx.state, cost);
  }).length;
}

export function unlockedTabs(ctx: GameContext): string[] {
  const tabs: string[] = [];
  for (const f of ctx.content.features.list) {
    if (f.tab && ctx.state.features[f.id] && !tabs.includes(f.tab)) tabs.push(f.tab);
  }
  return tabs;
}

export function visibleResources(ctx: GameContext) {
  return ctx.content.resources.list.filter((r) => !r.feature || ctx.state.features[r.feature] || ctx.state.resources[r.id]?.gt(0));
}

export function dexCount(ctx: GameContext): { found: number; total: number } {
  return {
    found: Object.keys(ctx.state.dex).length,
    total: ctx.content.species.list.length * ctx.content.rarities.list.length,
  };
}
