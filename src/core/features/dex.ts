import type { GameContext } from '../context';
import type { HybridRecipeDef, SpeciesDef, SpeciesTier } from '../content/types';
import { isRecipeDiscovered, isSpeciesDiscovered } from './hybrids';
import { missionAvailable } from './expedition';

/**
 * Read model for the dex family tree. What the player may see:
 *  - base species: always named
 *  - other species: "???" until discovered
 *  - recipes: parents + requirements once discovered, only the hint once hinted
 */
export interface OriginView {
  kind: 'recipe' | 'evolution' | 'egg';
  id: string;
  /** Revealed = result discovered. */
  revealed: boolean;
  hinted: boolean;
  hint: string | null;
  /** Parent / source names (null = unknown to the player). */
  from: (string | null)[];
  requirements: string[];
}

export interface TreeNode {
  species: SpeciesDef;
  discovered: boolean;
  /** Number of rarities found. */
  rarities: number;
  /** Perfection hunt: perfect genome / shiny seen for this species. */
  perfect: boolean;
  shiny: boolean;
  origins: OriginView[];
}

export const TIER_ORDER: SpeciesTier[] = ['base', 'hybrid', 'rareHybrid', 'mythic', 'primal'];
export const TIER_NAMES: Record<SpeciesTier, string> = { base: 'Basisarten', hybrid: 'Hybride', rareHybrid: 'Seltene Hybride', mythic: 'Mythische Endformen', primal: 'Urzeitwesen' };

function recipeRequirements(ctx: GameContext, r: HybridRecipeDef): string[] {
  const out: string[] = [];
  const req = r.requires;
  if (req?.minGeneration) out.push(`Generation ≥ ${req.minGeneration}`);
  if (req?.minRarity) out.push(`beide ≥ ${ctx.content.rarities.get(req.minRarity).name}`);
  if (req?.allele) {
    const locus = ctx.content.genes.get(req.allele.locus);
    out.push(`Allel ${locus.alleles.find((a) => a.id === req.allele!.allele)?.name} (${locus.name})`);
  }
  return out;
}

export interface PerfectionSummary {
  perfect: number;
  shiny: number;
  mythic: number;
  species: number;
  mythicTotal: number;
}

export function perfectionSummary(ctx: GameContext): PerfectionSummary {
  const mythics = ctx.content.species.list.filter((s) => s.tier === 'mythic');
  return {
    perfect: Object.keys(ctx.state.perfection.perfect).length,
    shiny: Object.keys(ctx.state.perfection.shiny).length,
    mythic: mythics.filter((s) => isSpeciesDiscovered(ctx, s.id)).length,
    species: ctx.content.species.list.length,
    mythicTotal: mythics.length,
  };
}

export function familyTree(ctx: GameContext): { tier: SpeciesTier; name: string; nodes: TreeNode[] }[] {
  const nameIfKnown = (id: string) => {
    const s = ctx.content.species.get(id);
    return s.tier === 'base' || isSpeciesDiscovered(ctx, id) ? s.name : null;
  };
  return TIER_ORDER.map((tier) => ({
    tier,
    name: TIER_NAMES[tier],
    nodes: ctx.content.species.list
      .filter((s) => s.tier === tier)
      .map((s) => {
        const origins: OriginView[] = [];
        for (const r of ctx.content.recipes.list.filter((x) => x.result === s.id)) {
          const revealed = isRecipeDiscovered(ctx, r);
          const hinted = ctx.state.recipeHints[r.id] === true;
          origins.push({
            kind: 'recipe',
            id: r.id,
            revealed,
            hinted,
            hint: hinted || revealed ? r.hint : null,
            from: revealed ? r.parents.map(nameIfKnown) : [null, null],
            requirements: revealed ? recipeRequirements(ctx, r) : [],
          });
        }
        for (const e of ctx.content.evolutions.list.filter((x) => x.to === s.id)) {
          const sourceKnown = isSpeciesDiscovered(ctx, e.from);
          const revealed = isSpeciesDiscovered(ctx, s.id);
          origins.push({
            kind: 'evolution',
            id: e.id,
            revealed,
            hinted: sourceKnown,
            hint: sourceKnown ? (e.description ?? null) : null,
            from: [sourceKnown ? ctx.content.species.get(e.from).name : null],
            requirements: sourceKnown ? [e.requires.minGeneration ? `Generation ≥ ${e.requires.minGeneration}` : '', e.requires.minRarity ? `≥ ${ctx.content.rarities.get(e.requires.minRarity).name}` : ''].filter(Boolean) : [],
          });
        }
        // Urzeitwesen: the Urzeit-Ei is named once the player found one (no spoiler before).
        if (s.tier === 'primal') {
          const known = !!ctx.state.features['primalEggs'];
          origins.push({ kind: 'egg', id: s.id, revealed: isSpeciesDiscovered(ctx, s.id), hinted: known, hint: known ? 'Schlüpft aus einem Urzeit-Ei.' : null, from: [], requirements: [] });
        }
        return {
          species: s,
          discovered: isSpeciesDiscovered(ctx, s.id),
          rarities: ctx.content.rarities.list.filter((r) => ctx.state.dex[`${s.id}:${r.id}`]).length,
          perfect: ctx.state.perfection.perfect[s.id] === true,
          shiny: ctx.state.perfection.shiny[s.id] === true,
          origins,
        };
      }),
  }));
}

/** A place where a species lives in the wild (null name = region not yet opened). */
export interface HabitatView {
  kind: 'mission' | 'voyage';
  id: string;
  name: string | null;
}

/**
 * Where a species can be found wild: expedition regions (explicit species
 * list, or every wild species when a region has none) and voyage
 * destinations. Regions the player cannot reach yet stay unnamed.
 */
export function speciesHabitats(ctx: GameContext, speciesId: string): HabitatView[] {
  const s = ctx.content.species.get(speciesId);
  const out: HabitatView[] = [];
  for (const m of ctx.content.missions.list) {
    const lives = m.species ? m.species.includes(speciesId) : s.wild;
    if (lives) out.push({ kind: 'mission', id: m.id, name: missionAvailable(ctx, m.id) ? m.name : null });
  }
  for (const d of ctx.content.voyageDestinations.list) {
    if (d.species.includes(speciesId)) out.push({ kind: 'voyage', id: d.id, name: ctx.state.features['voyage'] ? d.name : null });
  }
  return out;
}

/** Dex progress of one species tier: entries (species × rarity) and discovered species. */
export function tierProgress(ctx: GameContext, tier: SpeciesTier): { entries: number; entriesTotal: number; species: number; speciesTotal: number } {
  const list = ctx.content.species.list.filter((s) => s.tier === tier);
  const rarities = ctx.content.rarities.list;
  return {
    entries: list.reduce((n, s) => n + rarities.filter((r) => ctx.state.dex[`${s.id}:${r.id}`]).length, 0),
    entriesTotal: list.length * rarities.length,
    species: list.filter((s) => isSpeciesDiscovered(ctx, s.id)).length,
    speciesTotal: list.length,
  };
}
