import type { AlleleDef, GeneLocusDef } from './content/types';
import { checkCondition } from './conditions';
import type { GameContext } from './context';
import type { ModifierDef, SourcedModifier } from './modifiers';
import type { Appearance, Creature, Genome } from './state';

/**
 * Genetics: every creature carries two alleles per locus. Offspring get one
 * random allele from each parent (Mendel) plus a small mutation chance.
 *
 * Expression:
 *  - different dominance → only the more dominant allele is expressed
 *  - equal dominance, different alleles → codominant, both at 50 %
 *  - homozygous → that allele at 100 %
 */

export type Expression = { allele: AlleleDef; share: number }[];

/** Loci that currently exist (some are gated, e.g. by an Äon talent). */
export function activeLoci(ctx: GameContext): GeneLocusDef[] {
  return ctx.content.genes.list.filter((l) => !l.requires || checkCondition(ctx.state, l.requires));
}

/** Perfect genome: every active locus that has a `top` allele is homozygous for it. */
export function isPerfectGenome(ctx: GameContext, genome: Genome): boolean {
  const loci = activeLoci(ctx).filter((l) => l.alleles.some((a) => a.top));
  return loci.length > 0 && loci.every((l) => {
    const top = l.alleles.find((a) => a.top)!.id;
    const pair = genome[l.id];
    return pair?.[0] === top && pair[1] === top;
  });
}

export function alleleDef(locus: GeneLocusDef, id: string): AlleleDef | undefined {
  return locus.alleles.find((a) => a.id === id);
}

export function expressLocus(locus: GeneLocusDef, pair: readonly [string, string]): Expression {
  const a = alleleDef(locus, pair[0]);
  const b = alleleDef(locus, pair[1]);
  if (!a || !b) {
    const known = a ?? b;
    return known ? [{ allele: known, share: 1 }] : [];
  }
  if (a.id === b.id) return [{ allele: a, share: 1 }];
  if (a.dominance > b.dominance) return [{ allele: a, share: 1 }];
  if (b.dominance > a.dominance) return [{ allele: b, share: 1 }];
  return [
    { allele: a, share: 0.5 },
    { allele: b, share: 0.5 },
  ];
}

/** Human readable phenotype, e.g. "Kraftvoll" or "Ergiebig/Normal". */
export function phenotypeLabel(locus: GeneLocusDef, pair: readonly [string, string]): string {
  return expressLocus(locus, pair)
    .map((e) => e.allele.name)
    .join('/');
}

function scaled(m: ModifierDef, share: number): number {
  return m.op === 'mult' ? Math.pow(m.value, share) : m.value * share;
}

export function genomeModifiers(ctx: GameContext, genome: Genome): SourcedModifier[] {
  const out: SourcedModifier[] = [];
  for (const [locusId, pair] of Object.entries(genome)) {
    if (!ctx.content.genes.has(locusId)) continue;
    const locus = ctx.content.genes.get(locusId);
    for (const { allele, share } of expressLocus(locus, pair)) {
      for (const m of allele.modifiers) out.push({ ...m, value: scaled(m, share), source: `gene:${locusId}:${allele.id}` });
    }
  }
  return out;
}

export function rollAllele(ctx: GameContext, locus: GeneLocusDef): string {
  const weights: Record<string, number> = {};
  for (const a of locus.alleles) weights[a.id] = a.weight;
  return ctx.rng.weighted(weights);
}

export function rollGenome(ctx: GameContext): Genome {
  const genome: Genome = {};
  for (const locus of activeLoci(ctx)) genome[locus.id] = [rollAllele(ctx, locus), rollAllele(ctx, locus)];
  return genome;
}

/**
 * Fills loci that are missing (old saves, or loci added to the content later)
 * so new genes need no save migration.
 */
export function ensureGenomes(ctx: GameContext): void {
  for (const c of ctx.state.creatures) {
    if (!c.genome) c.genome = {};
    for (const locus of activeLoci(ctx)) {
      const pair = c.genome[locus.id];
      if (!pair || !alleleDef(locus, pair[0]) || !alleleDef(locus, pair[1])) c.genome[locus.id] = [rollAllele(ctx, locus), rollAllele(ctx, locus)];
    }
  }
  ctx.invalidate();
}

/** Mendel: one random allele from each parent per locus, each may mutate. */
export function inheritGenome(ctx: GameContext, a: Genome, b: Genome, mutationChance: number): Genome {
  const rate = mutationChance * ctx.balance.genetics.alleleMutationFactor;
  const genome: Genome = {};
  for (const locus of activeLoci(ctx)) {
    const pick = (pair: [string, string] | undefined) => {
      const allele = pair ? pair[ctx.rng.chance(0.5) ? 0 : 1] : rollAllele(ctx, locus);
      return ctx.rng.chance(rate) ? rollAllele(ctx, locus) : allele;
    };
    genome[locus.id] = [pick(a[locus.id]), pick(b[locus.id])];
  }
  return genome;
}

/** Appearance with visual alleles applied (the phenotype is always visible). */
export interface RenderAppearance extends Appearance {
  saturation: number;
  lightness: number;
}

export function expressedAppearance(ctx: GameContext, c: Creature): RenderAppearance {
  const out: RenderAppearance = { ...c.appearance, saturation: 65, lightness: 55 };
  for (const [locusId, pair] of Object.entries(c.genome ?? {})) {
    if (!ctx.content.genes.has(locusId)) continue;
    const expressed = expressLocus(ctx.content.genes.get(locusId), pair);
    for (const { allele, share } of expressed) {
      const v = allele.visual;
      if (!v) continue;
      if (v.hueShift) out.hue = Math.round((out.hue + v.hueShift * share + 360) % 360);
      if (share >= 1) {
        if (v.saturation !== undefined) out.saturation = v.saturation;
        if (v.lightness !== undefined) out.lightness = v.lightness;
        if (v.pattern) out.pattern = v.pattern;
        if (v.horn) out.horn = v.horn;
      } else {
        if (v.saturation !== undefined) out.saturation = (out.saturation + v.saturation) / 2;
        if (v.lightness !== undefined) out.lightness = (out.lightness + v.lightness) / 2;
      }
    }
  }
  return out;
}

/** Adds every allele of a genome to the gene library. Returns newly catalogued keys. */
export function catalogueGenome(ctx: GameContext, genome: Genome): string[] {
  const added: string[] = [];
  for (const [locus, pair] of Object.entries(genome)) {
    for (const allele of new Set(pair)) {
      const key = `${locus}:${allele}`;
      if (ctx.state.geneLibrary[key]) continue;
      ctx.state.geneLibrary[key] = true;
      added.push(key);
      ctx.bus.emit('alleleCatalogued', { locus, allele });
    }
  }
  return added;
}

export function libraryHas(ctx: GameContext, locus: string, allele: string): boolean {
  return ctx.state.geneLibrary[`${locus}:${allele}`] === true;
}

/** Alleles still missing in the gene library, rarest first (gene samples fill these). */
export function missingAlleles(ctx: GameContext): { locus: string; allele: string }[] {
  const out: { locus: string; allele: string; weight: number }[] = [];
  for (const locus of activeLoci(ctx)) {
    for (const a of locus.alleles) if (!libraryHas(ctx, locus.id, a.id)) out.push({ locus: locus.id, allele: a.id, weight: a.weight });
  }
  return out.sort((x, y) => x.weight - y.weight).map(({ locus, allele }) => ({ locus, allele }));
}

/** Adds the rarest missing alleles to the gene library. */
export function catalogueSamples(ctx: GameContext, count: number): void {
  for (const { locus, allele } of missingAlleles(ctx).slice(0, Math.max(0, count))) catalogueGenome(ctx, { [locus]: [allele, allele] });
}

/** Normalised genotype key (sorted by dominance, then id): "K/k". */
export function genotypeKey(locus: GeneLocusDef, pair: readonly [string, string]): string {
  const sorted = [...pair].sort((x, y) => {
    const dx = alleleDef(locus, x)?.dominance ?? 0;
    const dy = alleleDef(locus, y)?.dominance ?? 0;
    return dy - dx || x.localeCompare(y);
  });
  return sorted.join('/');
}

/** Offspring genotype probabilities for one locus (ignoring mutation). */
export function genotypeDistribution(locus: GeneLocusDef, a: readonly [string, string], b: readonly [string, string]): { pair: [string, string]; key: string; p: number }[] {
  const map = new Map<string, { pair: [string, string]; p: number }>();
  for (const x of a) {
    for (const y of b) {
      const pair: [string, string] = [x, y];
      const key = genotypeKey(locus, pair);
      const entry = map.get(key);
      if (entry) entry.p += 0.25;
      else map.set(key, { pair, p: 0.25 });
    }
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((x, y) => y.p - x.p);
}

/** Pseudo DNA bases for the visual sequence, stable per allele id. */
export function alleleBases(allele: string, length = 4): string {
  const bases = 'ATCG';
  let h = 0;
  for (const ch of allele) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  let out = '';
  for (let i = 0; i < length; i++) {
    out += bases[(h >>> (i * 2)) & 3];
  }
  return out;
}
