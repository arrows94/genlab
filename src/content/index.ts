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
import { researchThemes, upgrades } from './upgrades';
import { capsules } from './capsules';
import { anomalies, bossTraits, relics, resonances, talents, weeklyMutations } from './endgame';
import { techniques } from './techniques';
import { megaProjects } from './megaProjects';
import { contracts } from './contracts';
import { voyageDecisions, voyageDestinations, voyageEvents } from './voyages';
import { breedingRituals } from './rituals';
import { latentTraits } from './latent';
import { grandResearch } from './grandResearch';
import { nameLists } from './names';

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
  talents,
  anomalies,
  weeklyMutations,
  contracts,
  voyageDestinations,
  voyageEvents,
  voyageDecisions,
  breedingRituals,
  latentTraits,
  grandResearch,
  resonances,
  megaProjects,
  researchThemes,
  bossTraits,
  relics,
  techniques,
  nameLists,
};

/** Validated content. Throws a readable error listing every broken entry. */
export const content = buildContentDB(contentData);
