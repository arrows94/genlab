import { createChecks, type ContentChecks, type Kind } from './checks';
import {
  validateRpgDungeons,
  validateRpgEnemies,
  validateRpgEvents,
  validateRpgGear,
  validateRpgMeta,
  validateRpgSkills,
  validateRpgUpgrades,
} from './rpgValidators';
import type { ContentData, ContentDB, Registry } from './types';
import {
  validateAbilities,
  validateAchievements,
  validateAnomalies,
  validateBossTraits,
  validateBreedingRituals,
  validateBuildings,
  validateCapsules,
  validateCellarEnvironments,
  validateCellarMilestones,
  validateContracts,
  validateCourses,
  validateDexRewards,
  validateElements,
  validateEvolutions,
  validateFeatures,
  validateGeneConditions,
  validateGenes,
  validateGrandResearch,
  validateLatentTraits,
  validateMegaProjects,
  validateMissions,
  validateNameLists,
  validatePotions,
  validatePrestigeLayers,
  validateRarities,
  validateRecipes,
  validateRelics,
  validateRequiredNameLists,
  validateResearchThemes,
  validateResonances,
  validateResources,
  validateSpecies,
  validateTalents,
  validateTechniques,
  validateUpgrades,
  validateVoyageDecisions,
  validateVoyageDestinations,
  validateVoyageEvents,
  validateWeeklyMutations,
} from './validators';

export class ContentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Ungültige Spielinhalte (${issues.length} Fehler):\n  - ${issues.join('\n  - ')}`);
    this.name = 'ContentValidationError';
  }
}

/** Runs in this order; the issue list follows it. */
const CONTENT_VALIDATORS: readonly ((checks: ContentChecks) => void)[] = [
  validateResources,
  validateSpecies,
  validateElements,
  validateRequiredNameLists,
  validateNameLists,
  validateGenes,
  validateAbilities,
  validateRecipes,
  validateEvolutions,
  validateBuildings,
  validateUpgrades,
  validatePotions,
  validateMissions,
  validateDexRewards,
  validateFeatures,
  validateAchievements,
  validatePrestigeLayers,
  validateCapsules,
  validateTalents,
  validateAnomalies,
  validateWeeklyMutations,
  validateGeneConditions,
  validateVoyageDestinations,
  validateVoyageEvents,
  validateVoyageDecisions,
  validateGrandResearch,
  validateResearchThemes,
  validateBossTraits,
  validateCourses,
  validateCellarEnvironments,
  validateCellarMilestones,
  validateTechniques,
  validateRelics,
  validateRpgSkills,
  validateRpgEnemies,
  validateRpgDungeons,
  validateRpgEvents,
  validateRpgUpgrades,
  validateRpgGear,
  validateRpgMeta,
  validateResonances,
  validateMegaProjects,
  validateLatentTraits,
  validateBreedingRituals,
  validateContracts,
  validateRarities,
];

/**
 * Validates all content (shape, unique ids, cross references, modifier
 * targets, conditions) and returns a list of human readable issues.
 */
export function validateContent(data: ContentData): string[] {
  const checks = createChecks(data);
  for (const validate of CONTENT_VALIDATORS) validate(checks);
  return checks.issues;
}

function makeRegistry<T extends { id: string }>(kind: string, list: readonly T[]): Registry<T> {
  const map = new Map(list.map((e) => [e.id, e]));
  return {
    list,
    has: (id) => map.has(id),
    get(id) {
      const found = map.get(id);
      if (!found) throw new Error(`Unbekannte ${kind}-id "${id}"`);
      return found;
    },
  };
}

/** Validates content and builds lookup registries. Throws on any issue. */
export function buildContentDB(data: ContentData): ContentDB {
  const issues = validateContent(data);
  if (issues.length > 0) throw new ContentValidationError(issues);
  const db = Object.fromEntries(
    (Object.keys(data) as Kind[]).map((kind) => {
      const list: { id: string }[] = kind === 'rarities' ? [...data.rarities].sort((a, b) => a.order - b.order) : [...data[kind]];
      return [kind, makeRegistry(kind, list)];
    }),
  );
  // `Object.fromEntries` cannot express the per-kind mapped type, so this is
  // the one cast to ContentDB: each key `kind` holds a registry over `data[kind]`.
  return db as ContentDB;
}
