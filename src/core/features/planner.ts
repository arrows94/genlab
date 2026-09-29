import type { GameContext } from '../context';
import type { Creature } from '../state';
import { activeLoci, genotypeDistribution, phenotypeLabel } from '../genetics';
import { rarityChances } from '../rarity';
import type { BreedingRitualDef } from '../content/types';
import { eggRarityWeights, mutationChance } from './breeding';
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

export function breedingPreview(ctx: GameContext, a: Creature, b: Creature, ritual?: BreedingRitualDef): BreedingPreview {
  const known = a.sequenced && b.sequenced;
  const loci: LocusPreview[] = activeLoci(ctx).map((locus) => {
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
    const matching = ctx.content.recipes.list.filter((r) => recipeMatches(ctx, r, a, b));
    for (const r of matching) {
      // Kreuzungsritual: a matching recipe is certain (split evenly if several match).
      const p = ritual?.guaranteedHybrid ? 1 / matching.length : remaining * Math.min(1, hybridChance(ctx, r) * (ritual?.hybridMult ?? 1));
      species.push({ id: isRecipeDiscovered(ctx, r) ? r.result : null, p });
      remaining -= p;
    }
  }
  if (a.speciesId === b.speciesId) species.push({ id: a.speciesId, p: remaining });
  else species.push({ id: a.speciesId, p: remaining / 2 }, { id: b.speciesId, p: remaining / 2 });

  const v = ctx.balance.creature.statVariance;
  const [, hi] = ctx.balance.breeding.mutationStatRange;
  const stats: Record<string, [number, number]> = {};
  for (const s of ctx.content.stats.list) {
    const avg = ((a.stats[s.id] ?? 0) + (b.stats[s.id] ?? 0)) / 2;
    stats[s.id] = [Math.max(1, Math.round(avg * (1 - v))), Math.round(avg * (1 + v) * hi)];
  }

  return {
    species,
    rarity: rarityChances(eggRarityWeights(ctx, ritual)),
    loci,
    stats,
    mutationChance: mutationChance(ctx, ritual),
  };
}
