import { D } from '../num';
import { findCreature } from '../creatures';
import { alleleDef, libraryHas, rollAllele } from '../genetics';
import { trySpend } from '../resources';
import type { Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';

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

export function instabilityChance(ctx: GameContext): number {
  return Math.min(1, Math.max(0, ctx.mods().apply('splicing.instability', ctx.balance.genetics.splicing.instability)));
}

export function splice(ctx: GameContext, creatureId: number, locusId: string, slot: 0 | 1, alleleId: string): ActionResult {
  if (!ctx.state.features['splicing']) return { ok: false, reason: 'Gen-Splicing ist noch nicht freigeschaltet.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (!c.sequenced) return { ok: false, reason: 'Nur sequenzierte Kreaturen können verändert werden.' };
  if (!ctx.content.genes.has(locusId)) return { ok: false, reason: 'Unbekanntes Gen.' };
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
    const others = ctx.content.genes.list.filter((l) => l.id !== locusId);
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
  ctx.bus.emit('spliced', { creatureId, locus: locusId, success, scrambledLocus });
  return { ok: true };
}
