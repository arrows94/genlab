import { D } from './num';
import type { Condition } from './content/types';
import type { GameState } from './state';

export function checkCondition(state: GameState, c: Condition): boolean {
  switch (c.type) {
    case 'always':
      return true;
    case 'resourceEarned':
      return (state.earned[c.resource] ?? D(0)).gte(c.amount);
    case 'resourceOwned':
      return (state.resources[c.resource] ?? D(0)).gte(c.amount);
    case 'upgradeLevel':
      return (state.upgrades[c.upgrade] ?? 0) >= c.level;
    case 'feature':
      return state.features[c.feature] === true;
    case 'creatureCount':
      return state.creatures.length >= c.count;
    case 'statistic':
      return (state.statistics[c.statistic] ?? 0) >= c.amount;
    case 'dex': {
      const matches = Object.keys(state.dex).filter((key) => {
        const [species, rarity] = key.split(':');
        return (!c.species || c.species === species) && (!c.rarity || c.rarity === rarity);
      });
      return matches.length >= (c.count ?? 1);
    }
    case 'prestigeCount':
      return (state.prestige[c.layer]?.count ?? 0) >= c.count;
    case 'talent':
      return state.talents?.[c.talent] === true;
    case 'towerFloor':
      return Math.max(state.tower?.best ?? 0, state.tower?.run?.floor ?? 0) >= c.floor;
    case 'anomaly':
      return state.anomaliesCompleted?.[c.anomaly] === true;
    case 'megaProject':
      return (state.megaProjects?.[c.project]?.stage ?? 0) >= c.stage;
    case 'geneLibrary':
      return Object.keys(state.geneLibrary ?? {}).length >= c.count;
    case 'all':
      return c.of.every((sub) => checkCondition(state, sub));
    case 'any':
      return c.of.some((sub) => checkCondition(state, sub));
  }
}

/**
 * Progress towards a countable condition (0–1), e.g. for a goal bar:
 * earned/owned resources, statistics, creature count, tower floor, gene
 * library, dex count. `all` takes the slowest part, `any` the fastest.
 * Returns null for yes/no conditions.
 */
export function conditionProgress(state: GameState, c: Condition): number | null {
  const share = (have: number, need: number) => (need <= 0 ? 1 : Math.min(1, Math.max(0, have / need)));
  switch (c.type) {
    case 'resourceEarned':
      return share((state.earned[c.resource] ?? D(0)).toNumber(), c.amount);
    case 'resourceOwned':
      return share((state.resources[c.resource] ?? D(0)).toNumber(), c.amount);
    case 'statistic':
      return share(state.statistics[c.statistic] ?? 0, c.amount);
    case 'creatureCount':
      return share(state.creatures.length, c.count);
    case 'towerFloor':
      return share(Math.max(state.tower?.best ?? 0, state.tower?.run?.floor ?? 0), c.floor);
    case 'geneLibrary':
      return share(Object.keys(state.geneLibrary ?? {}).length, c.count);
    case 'all':
    case 'any': {
      const parts = c.of.map((x) => conditionProgress(state, x) ?? (checkCondition(state, x) ? 1 : 0));
      if (parts.length === 0) return 1;
      return c.type === 'all' ? Math.min(...parts) : Math.max(...parts);
    }
    default:
      return null;
  }
}
