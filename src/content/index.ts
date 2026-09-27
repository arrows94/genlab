import type { ContentData } from '@core/content/types';
import { buildContentDB } from '@core/content/validate';
import { abilities } from './abilities';
import { buildings } from './buildings';
import { elements } from './elements';
import { genes } from './genes';
import { missions } from './missions';
import { potions } from './potions';
import { achievements, dexRewards, features, prestigeLayers } from './progression';
import { rarities } from './rarities';
import { evolutions, recipes } from './recipes';
import { resources } from './resources';
import { species } from './species';
import { stats } from './stats';
import { upgrades } from './upgrades';
import { capsules } from './capsules';

export { balance } from './balance';

export const contentData: ContentData = {
  resources,
  stats,
  elements,
  rarities,
  species,
  genes,
  abilities,
  recipes,
  evolutions,
  buildings,
  upgrades,
  potions,
  missions,
  dexRewards,
  features,
  achievements,
  prestigeLayers,
  capsules,
};

/** Validated content. Throws a readable error listing every broken entry. */
export const content = buildContentDB(contentData);
