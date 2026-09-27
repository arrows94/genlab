import type { GameContext } from '../context';
import type { Creature } from '../state';
import { genotypeDistribution, phenotypeLabel } from '../genetics';
import { rarityChances, rarityWeights } from '../rarity';
import { mutationChance } from './breeding';
import { hybridChance, isRecipeDiscovered, recipeMatches } from './hybrids';

/**
 * Breeding planner (Zuchtplaner): outcome probabilities for a pair.
 * Genotypes are only exact when both parents are sequenced.
 */
export interface LocusPreview {
  locus: string;
  name: string;
  known: boolean;
  outcomes: { key: string; pair: [string, string]; phenotype: string; p: number }[];
}

export interface BreedingPreview {
  species: { id: string | null; p: number }[];
  rarity: Record<string, number>;
  loci: LocusPreview[];
  stats: Record<string, [number, number]>;
  mutationChance: number;
}

export function breedingPreview(ctx: GameContext, a: Creature, b: Creature): BreedingPreview {
  const known = a.sequenced && b.sequenced;
  const loci: LocusPreview[] = ctx.content.genes.list.map((locus) => {
    const pa = a.genome[locus.id];
    const pb = b.genome[locus.id];
    if (!known || !pa || !pb) return { locus: locus.id, name: locus.name, known: false, outcomes: [] };
    return {
      locus: locus.id,
      name: locus.name,
      known: true,
      outcomes: genotypeDistribution(locus, pa, pb).map((o) => ({ ...o, phenotype: phenotypeLabel(locus, o.pair) })),
    };
  });

  // Species: matching hybrid recipes first (unknown ones stay "???" = null), rest split between parents.
  const species: { id: string | null; p: number }[] = [];
  let remaining = 1;
  if (ctx.state.features['hybrids']) {
    for (const r of ctx.content.recipes.list) {
      if (!recipeMatches(ctx, r, a, b)) continue;
      const p = remaining * hybridChance(ctx, r);
      species.push({ id: isRecipeDiscovered(ctx, r) ? r.result : null, p });
      remaining -= p;
    }
  }
  if (a.speciesId === b.speciesId) species.push({ id: a.speciesId, p: remaining });
  else species.push({ id: a.speciesId, p: remaining / 2 }, { id: b.speciesId, p: remaining / 2 });

  const v = ctx.balance.creature.statVariance;
  const [, hi] = ctx.balance.breeding.mutationStatRange;
  const bonus = ctx.mods().apply('breeding.statBonus', 1);
  const stats: Record<string, [number, number]> = {};
  for (const s of ctx.content.stats.list) {
    const avg = ((a.stats[s.id] ?? 0) + (b.stats[s.id] ?? 0)) / 2;
    stats[s.id] = [Math.max(1, Math.round(avg * (1 - v) * bonus)), Math.round(avg * (1 + v) * hi * bonus)];
  }

  return {
    species,
    rarity: rarityChances(rarityWeights(ctx.content, ctx.balance, ctx.mods())),
    loci,
    stats,
    mutationChance: mutationChance(ctx),
  };
}
