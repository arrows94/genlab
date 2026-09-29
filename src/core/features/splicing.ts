import { D } from '../num';
import { checkPerfection, effectiveStats, findCreature } from '../creatures';
import { activeLoci, alleleDef, isPerfectGenome, libraryHas, phenotypeLabel, rollAllele } from '../genetics';
import { trySpend } from '../resources';
import type { Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature, StatBlock } from '../state';

/**
 * Gene splicing: replace one allele of a sequenced creature with an allele
 * from the gene library. Expensive, limited per creature, and it can fail:
 * an unstable splice leaves the target locus untouched but scrambles one
 * allele of another random locus.
 */
export function spliceCost(ctx: GameContext, c: Creature): Cost {
  const cfg = ctx.balance.genetics.splicing;
  const factor = D(cfg.costGrowth).pow(c.splices ?? 0).mul(ctx.mods().factor('cost.splicing'));
  const cost: Cost = {};
  for (const [res, amount] of Object.entries(cfg.cost)) cost[res] = D(amount).mul(factor).ceil();
  return cost;
}

export function maxSplices(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('splicing.max', ctx.balance.genetics.splicing.maxPerCreature));
}

/** Splice attempts this creature has left. */
export function splicesLeft(ctx: GameContext, c: Creature): number {
  return Math.max(0, maxSplices(ctx) - (c.splices ?? 0));
}

/** Nothing left to do at the splicing bench: no attempts left or already a perfect genome. */
export function isFullySpliced(ctx: GameContext, c: Creature): boolean {
  return splicesLeft(ctx, c) === 0 || isPerfectGenome(ctx, c.genome);
}

export function instabilityChance(ctx: GameContext): number {
  return Math.min(1, Math.max(0, ctx.mods().apply('splicing.instability', ctx.balance.genetics.splicing.instability)));
}

export function splice(ctx: GameContext, creatureId: number, locusId: string, slot: 0 | 1, alleleId: string): ActionResult {
  if (!ctx.state.features['splicing']) return { ok: false, reason: 'Gen-Splicing ist noch nicht freigeschaltet.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (!c.sequenced) return { ok: false, reason: 'Nur sequenzierte Kreaturen können verändert werden.' };
  if (!activeLoci(ctx).some((l) => l.id === locusId)) return { ok: false, reason: 'Unbekanntes Gen.' };
  const locus = ctx.content.genes.get(locusId);
  if (!alleleDef(locus, alleleId)) return { ok: false, reason: 'Unbekanntes Allel.' };
  if (!libraryHas(ctx, locusId, alleleId)) return { ok: false, reason: 'Dieses Allel fehlt in der Genbibliothek.' };
  if (c.genome[locusId]?.[slot] === alleleId) return { ok: false, reason: 'Das Allel ist bereits vorhanden.' };
  if ((c.splices ?? 0) >= maxSplices(ctx)) return { ok: false, reason: 'Keine Splicing-Versuche mehr für diese Kreatur.' };
  if (!trySpend(ctx, spliceCost(ctx, c))) return { ok: false, reason: 'Nicht genug Ressourcen.' };

  c.splices = (c.splices ?? 0) + 1;
  let success = true;
  let scrambledLocus: string | null = null;
  if (ctx.rng.chance(instabilityChance(ctx))) {
    success = false;
    // Only loci that currently exist (the Urgen needs its Äon talent).
    const others = activeLoci(ctx).filter((l) => l.id !== locusId);
    if (others.length > 0) {
      const other = ctx.rng.pick(others);
      const pair = c.genome[other.id] ?? [rollAllele(ctx, other), rollAllele(ctx, other)];
      pair[ctx.rng.chance(0.5) ? 0 : 1] = rollAllele(ctx, other);
      c.genome[other.id] = pair;
      scrambledLocus = other.id;
    }
  } else {
    const pair = c.genome[locusId] ?? [alleleId, alleleId];
    pair[slot] = alleleId;
    c.genome[locusId] = pair;
  }
  ctx.invalidate();
  checkPerfection(ctx, c);
  ctx.bus.emit('spliced', { creatureId, locus: locusId, success, scrambledLocus });
  return { ok: true };
}

export interface SplicePreview {
  /** Allele currently in the chosen slot. */
  current: string;
  phenotypeBefore: string;
  phenotypeAfter: string;
  statsBefore: StatBlock;
  statsAfter: StatBlock;
  /** False when the new allele is masked (e.g. recessive next to a dominant one). */
  visibleChange: boolean;
}

/** What a successful splice would change – for the splicing workbench. */
export function splicePreview(ctx: GameContext, c: Creature, locusId: string, slot: 0 | 1, alleleId: string): SplicePreview | null {
  const locus = activeLoci(ctx).find((l) => l.id === locusId);
  const pair = c.genome[locusId];
  if (!locus || !pair) return null;
  const next: [string, string] = [pair[0], pair[1]];
  next[slot] = alleleId;
  const after = { ...c, genome: { ...c.genome, [locusId]: next } };
  const phenotypeBefore = phenotypeLabel(locus, pair);
  const phenotypeAfter = phenotypeLabel(locus, next);
  return {
    current: pair[slot],
    phenotypeBefore,
    phenotypeAfter,
    statsBefore: effectiveStats(ctx, c),
    statsAfter: effectiveStats(ctx, after),
    visibleChange: phenotypeBefore !== phenotypeAfter,
  };
}
