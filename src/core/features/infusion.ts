
import { toCost } from '../costs';
import { checkPerfection, creaturePower, effectiveStats, findCreature, registerDex, removeCreature } from '../creatures';
import { activeLoci, alleleDef } from '../genetics';
import { trySpend } from '../resources';
import { checkUnlocks } from '../systems/unlocks';
import type { AlleleDef, GeneLocusDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import { canConsume, takeConsumable } from './stable';

/**
 * Infusion: a target absorbs creatures of the same species for EP.
 * Levels give a stat bonus; sequenced victims may pass on better alleles.
 * At max level a breakthrough raises the rarity by one (up to legendary).
 */

export function infusionEp(ctx: GameContext, victim: Creature): number {
  const b = ctx.balance.infusion;
  return Math.round((b.epByRarity[victim.rarity] ?? 0) * (1 + b.epPerGeneration * (victim.generation - 1)) * ctx.mods().factor('infusion.ep'));
}

/** EP needed to go from level − 1 to `level`. */
export function epForLevel(ctx: GameContext, level: number): number {
  const b = ctx.balance.infusion;
  return Math.round(b.levelEpBase * Math.pow(b.levelEpGrowth, level - 1));
}

export function maxInfusionLevel(ctx: GameContext): number {
  return ctx.balance.infusion.maxLevel;
}

/** Applies EP; returns the resulting level and leftover EP (capped at max level). */
export function applyEp(ctx: GameContext, level: number, ep: number): { level: number; ep: number } {
  const max = maxInfusionLevel(ctx);
  while (level < max && ep >= epForLevel(ctx, level + 1)) {
    ep -= epForLevel(ctx, level + 1);
    level++;
  }
  if (level >= max) ep = 0;
  return { level, ep };
}

/** Heuristic value of an allele: rare alleles with effects are "better"; purely visual ones are neutral. */
export function alleleQuality(a: AlleleDef | undefined): number {
  if (!a || a.modifiers.length === 0) return 0;
  return 100 - a.weight;
}

/** The best allele transfer a victim could give the target, if any. */
export function bestTransfer(ctx: GameContext, target: Creature, victim: Creature): { locus: GeneLocusDef; slot: 0 | 1; allele: string; gain: number } | null {
  if (!target.sequenced || !victim.sequenced) return null;
  let best: { locus: GeneLocusDef; slot: 0 | 1; allele: string; gain: number } | null = null;
  for (const locus of activeLoci(ctx)) {
    const tp = target.genome[locus.id];
    const vp = victim.genome[locus.id];
    if (!tp || !vp) continue;
    const donor = [...vp].sort((x, y) => alleleQuality(alleleDef(locus, y)) - alleleQuality(alleleDef(locus, x)))[0]!;
    const slot: 0 | 1 = alleleQuality(alleleDef(locus, tp[0])) <= alleleQuality(alleleDef(locus, tp[1])) ? 0 : 1;
    const gain = alleleQuality(alleleDef(locus, donor)) - alleleQuality(alleleDef(locus, tp[slot]));
    if (gain > 0 && (!best || gain > best.gain)) best = { locus, slot, allele: donor, gain };
  }
  return best;
}

export interface InfusionPreview {
  ep: number;
  level: number;
  newLevel: number;
  newEp: number;
  transferChance: number;
  /** Victims that could pass on a better allele. */
  transferCandidates: number;
}

export function infusionPreview(ctx: GameContext, target: Creature, victims: Creature[]): InfusionPreview {
  const ep = victims.reduce((sum, v) => sum + infusionEp(ctx, v), 0);
  const result = applyEp(ctx, target.infusion.level, target.infusion.ep + ep);
  return {
    ep,
    level: target.infusion.level,
    newLevel: result.level,
    newEp: result.ep,
    transferChance: transferChance(ctx),
    transferCandidates: victims.filter((v) => bestTransfer(ctx, target, v)).length,
  };
}

export function transferChance(ctx: GameContext): number {
  return Math.min(1, ctx.mods().apply('infusion.transferChance', ctx.balance.infusion.alleleTransferChance));
}

/** Same-species creatures that could be absorbed by `target`. */
export function infusionCandidates(ctx: GameContext, target: Creature): Creature[] {
  return ctx.state.creatures.filter((c) => c.id !== target.id && c.speciesId === target.speciesId);
}

export function infuse(ctx: GameContext, targetId: number, victimIds: number[]): ActionResult {
  if (!ctx.state.features['infusion']) return { ok: false, reason: 'Infusion ist noch nicht freigeschaltet.' };
  const target = findCreature(ctx, targetId);
  if (!target) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (victimIds.includes(targetId)) return { ok: false, reason: 'Eine Kreatur kann sich nicht selbst aufnehmen.' };
  if (target.infusion.level >= maxInfusionLevel(ctx)) return { ok: false, reason: 'Maximale Infusionsstufe erreicht – Durchbruch möglich.' };
  const victims = takeConsumable(ctx, victimIds);
  if (typeof victims === 'string') return { ok: false, reason: victims };
  if (victims.some((v) => v.speciesId !== target.speciesId)) return { ok: false, reason: 'Nur Kreaturen derselben Art können infundiert werden.' };

  const preview = infusionPreview(ctx, target, victims);
  const transferred: { locus: string; allele: string }[] = [];
  for (const v of victims) {
    const t = bestTransfer(ctx, target, v);
    if (t && ctx.rng.chance(preview.transferChance)) {
      target.genome[t.locus.id]![t.slot] = t.allele;
      transferred.push({ locus: t.locus.id, allele: t.allele });
    }
    removeCreature(ctx, v.id, 'infused');
  }
  target.infusion = { level: preview.newLevel, ep: preview.newEp };
  ctx.invalidate();
  checkPerfection(ctx, target);
  ctx.bus.emit('infused', { targetId, victims: victims.length, ep: preview.ep, levelsGained: preview.newLevel - preview.level, transferred });
  checkUnlocks(ctx);
  return { ok: true };
}

export function nextRarity(ctx: GameContext, rarity: string): string | null {
  const order = ctx.content.rarities.get(rarity).order;
  const max = ctx.content.rarities.get(ctx.balance.infusion.maxBreakthroughRarity).order;
  if (order >= max) return null;
  return ctx.content.rarities.list.find((r) => r.order === order + 1)?.id ?? null;
}

export function breakthroughCost(ctx: GameContext, c: Creature) {
  return toCost(ctx.balance.infusion.breakthroughCost[c.rarity] ?? {});
}

/** Partners for a breakthrough: same species and same rarity. */
export function breakthroughPartners(ctx: GameContext, c: Creature): Creature[] {
  return ctx.state.creatures.filter((x) => x.id !== c.id && x.speciesId === c.speciesId && x.rarity === c.rarity);
}

export function breakthrough(ctx: GameContext, targetId: number, partnerId: number): ActionResult {
  if (!ctx.state.features['infusion']) return { ok: false, reason: 'Infusion ist noch nicht freigeschaltet.' };
  const target = findCreature(ctx, targetId);
  if (!target) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  if (target.infusion.level < maxInfusionLevel(ctx)) return { ok: false, reason: `Erst Infusionsstufe +${maxInfusionLevel(ctx)} erreichen.` };
  const next = nextRarity(ctx, target.rarity);
  if (!next) return { ok: false, reason: 'Höher geht es per Durchbruch nicht – Mythisch gibt es nur durch Zucht.' };
  const partner = takeConsumable(ctx, [partnerId]);
  if (typeof partner === 'string') return { ok: false, reason: partner };
  const p = partner[0]!;
  if (p.speciesId !== target.speciesId || p.rarity !== target.rarity) return { ok: false, reason: 'Partner muss dieselbe Art und Seltenheit haben.' };
  if (!trySpend(ctx, breakthroughCost(ctx, target))) return { ok: false, reason: 'Nicht genug Ressourcen.' };

  removeCreature(ctx, p.id, 'breakthrough');
  target.rarity = next;
  target.infusion = { level: 0, ep: 0 };
  registerDex(ctx, target.speciesId, next);
  ctx.invalidate();
  ctx.bus.emit('breakthrough', { creatureId: target.id, rarity: next });
  checkUnlocks(ctx);
  return { ok: true };
}


export interface InfusionPick {
  /** Highest rarity that may be taken. */
  maxRarity: string;
  /** 'all' takes every match; the others stop as soon as the EP reach the next / the maximum level. */
  goal: 'all' | 'nextLevel' | 'maxLevel';
  /** Only sequenced victims that could pass on a better allele. */
  donorsOnly?: boolean;
}

/**
 * Quick selection for the infusion chamber: consumable same-species victims
 * up to a rarity, cheapest first (rarity, generation, power). Shiny and
 * infused creatures are never picked automatically – only by hand.
 */
export function pickInfusionVictims(ctx: GameContext, target: Creature, pick: InfusionPick): Creature[] {
  const order = (id: string) => ctx.content.rarities.get(id).order;
  const max = order(pick.maxRarity);
  const power = new Map<number, number>();
  const pool = infusionCandidates(ctx, target)
    .filter((c) => canConsume(ctx, c) && !c.shiny && (c.infusion?.level ?? 0) === 0 && order(c.rarity) <= max)
    .filter((c) => !pick.donorsOnly || bestTransfer(ctx, target, c) !== null);
  for (const c of pool) power.set(c.id, creaturePower(ctx, c));
  pool.sort((x, y) => order(x.rarity) - order(y.rarity) || x.generation - y.generation || power.get(x.id)! - power.get(y.id)!);
  if (pick.goal === 'all') return pool;

  const level = target.infusion.level;
  const cap = maxInfusionLevel(ctx);
  const goal = pick.goal === 'nextLevel' ? Math.min(level + 1, cap) : cap;
  const out: Creature[] = [];
  let ep = target.infusion.ep;
  for (const v of pool) {
    if (applyEp(ctx, level, ep).level >= goal) break;
    out.push(v);
    ep += infusionEp(ctx, v);
  }
  return out;
}

/** Progress towards the next level as 0–1 (1 at max level). */
export function infusionProgress(ctx: GameContext, level: number, ep: number): number {
  if (level >= maxInfusionLevel(ctx)) return 1;
  return Math.min(1, ep / epForLevel(ctx, level + 1));
}

/** Effective stats the creature would have at another infusion level. */
export function statsAtInfusion(ctx: GameContext, c: Creature, level: number) {
  return effectiveStats(ctx, { ...c, infusion: { level, ep: 0 } });
}
