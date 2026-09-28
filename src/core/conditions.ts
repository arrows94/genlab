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
