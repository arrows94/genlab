import { toCost, canAfford } from '../costs';
import { findCreature, registerDex } from '../creatures';
import { trySpend } from '../resources';
import { checkUnlocks } from '../systems/unlocks';
import type { EvolutionDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import { carriesAllele, rarityAtLeast, reprofileStats } from './hybrids';

/** Evolutions whose `from` species matches the creature. */
export function evolutionsFor(ctx: GameContext, c: Creature): EvolutionDef[] {
  return ctx.content.evolutions.list.filter((e) => e.from === c.speciesId);
}

export interface EvolutionCheck {
  evolution: EvolutionDef;
  /** Requirement label → fulfilled (null = unknown because genome is hidden). */
  requirements: { label: string; met: boolean | null }[];
  ready: boolean;
}

export function checkEvolution(ctx: GameContext, c: Creature, e: EvolutionDef): EvolutionCheck {
  const req = e.requires;
  const list: EvolutionCheck['requirements'] = [];
  if (req.minGeneration) list.push({ label: `Generation ≥ ${req.minGeneration}`, met: c.generation >= req.minGeneration });
  if (req.minRarity) list.push({ label: `Seltenheit ≥ ${ctx.content.rarities.get(req.minRarity).name}`, met: rarityAtLeast(ctx, c.rarity, req.minRarity) });
  if (req.allele) {
    const locus = ctx.content.genes.get(req.allele.locus);
    const allele = locus.alleles.find((a) => a.id === req.allele!.allele);
    list.push({ label: `Allel ${allele?.name ?? req.allele.allele} (${locus.name})`, met: c.sequenced ? carriesAllele(c, req.allele.locus, req.allele.allele) : null });
  }
  if (req.cost) list.push({ label: 'Kosten', met: canAfford(ctx.state, toCost(req.cost)) });
  if (c.job) list.push({ label: 'Kreatur ist frei', met: c.job.kind === 'building' });
  return { evolution: e, requirements: list, ready: list.every((r) => r.met === true) };
}

export function evolve(ctx: GameContext, creatureId: number, evolutionId: string): ActionResult {
  if (!ctx.state.features['evolution']) return { ok: false, reason: 'Evolution ist noch nicht freigeschaltet.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const e = ctx.content.evolutions.get(evolutionId);
  if (e.from !== c.speciesId) return { ok: false, reason: 'Diese Kreatur kann sich so nicht entwickeln.' };
  const check = checkEvolution(ctx, c, e);
  const unknown = check.requirements.find((r) => r.met === null);
  if (unknown) return { ok: false, reason: 'Das Genom muss zuerst sequenziert werden.' };
  const missing = check.requirements.find((r) => r.met === false);
  if (missing) return { ok: false, reason: `Bedingung fehlt: ${missing.label}` };
  if (e.requires.cost && !trySpend(ctx, toCost(e.requires.cost))) return { ok: false, reason: 'Nicht genug Ressourcen.' };

  const from = c.speciesId;
  c.stats = reprofileStats(ctx, c.stats, ctx.content.species.get(from).baseStats, e.to);
  if (c.name === ctx.content.species.get(from).name) c.name = ctx.content.species.get(e.to).name;
  c.speciesId = e.to;
  registerDex(ctx, c.speciesId, c.rarity);
  ctx.invalidate();
  ctx.bus.emit('evolved', { creatureId: c.id, from, to: e.to });
  checkUnlocks(ctx);
  return { ok: true };
}
