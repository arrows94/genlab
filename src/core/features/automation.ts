import { assignJob } from '../actions';
import { effectiveStats, creaturePower } from '../creatures';
import { canAfford } from '../costs';
import { jobCount, jobSlots } from '../systems/production';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { AutoBreedConfig, AutoRecycleConfig, Creature } from '../state';
import { D } from '../num';
import type { System } from '../systems/types';
import { breedingCost, eggs, nestSlots, offspringGeneration, startBreeding } from './breeding';
import { checkCondition } from '../conditions';
import { carriesAllele, hybridChance, isRecipeDiscovered, rarityAtLeast, recipeMatches } from './hybrids';
import { recycle } from './recycler';
import { canConsume, sell, stableFree } from './stable';

/**
 * Automation (unlockable): auto-assign jobs by best fit and auto-breeding
 * towards a goal (strength, new hybrids, dex gaps, an allele, abilities or
 * cheap fodder), with a resource budget and an optional stable cleanup,
 * plus the Recycling-Automat. Runs as a system every `automation.intervalSec`, so it also
 * works during offline progress.
 */

/** Rule ids for auto-breeding: "power" (sum of stats) or a stat id. */
export function breedRuleScore(ctx: GameContext, c: Creature, rule: string): number {
  return rule === 'power' ? creaturePower(ctx, c) : (effectiveStats(ctx, c)[rule] ?? 0);
}

/** Breeding goals besides "power" and the stat ids. */
export const BREED_GOALS = ['hybrid', 'dex', 'allele', 'abilities', 'cheap'] as const;

export type AutoBreedPlan = { ok: true; a: Creature; b: Creature } | { ok: false; reason: string };

/**
 * Fills every unlocked building with the best available creatures for its
 * work stat. Only idle or already working creatures are moved.
 */
export function autoAssign(ctx: GameContext): ActionResult {
  if (!ctx.state.features['autoAssign']) return { ok: false, reason: 'Der Arbeitsplaner ist noch nicht freigeschaltet.' };
  const pool = ctx.state.creatures.filter((c) => c.job === null || c.job.kind === 'building');
  for (const c of pool) c.job = null;
  ctx.invalidate();
  const buildings = ctx.content.buildings.list.filter((b) => ctx.state.features[b.feature]);
  const stats = new Map(pool.map((c) => [c.id, effectiveStats(ctx, c)]));
  // Buildings with fewer slots first, so scarce places get the specialists.
  for (const b of [...buildings].sort((x, y) => jobSlots(ctx, x.id) - jobSlots(ctx, y.id))) {
    const free = pool.filter((c) => c.job === null).sort((x, y) => (stats.get(y.id)![b.workStat] ?? 0) - (stats.get(x.id)![b.workStat] ?? 0));
    for (const c of free) {
      if (jobCount(ctx, b.id) >= jobSlots(ctx, b.id)) break;
      assignJob(ctx, c.id, b.id);
    }
  }
  return { ok: true };
}

/** Two creatures with the highest score (ties: higher power), or null. */
function topTwo(ctx: GameContext, pool: Creature[], score: (c: Creature) => number): [Creature, Creature] | null {
  const power = new Map(pool.map((c) => [c.id, creaturePower(ctx, c)]));
  const scored = pool.map((c) => ({ c, s: score(c) })).sort((x, y) => y.s - x.s || power.get(y.c.id)! - power.get(x.c.id)!);
  return scored.length >= 2 ? [scored[0]!.c, scored[1]!.c] : null;
}

/** First a ∈ as, b ∈ bs (distinct) where `a` passes `first`; linear, as it runs every few sim seconds. */
function firstPair(as: Creature[], bs: Creature[], first: (c: Creature) => boolean): [Creature, Creature] | null {
  for (const a of as) {
    if (!first(a)) continue;
    const b = bs.find((x) => x.id !== a.id);
    if (b) return [a, b];
  }
  return null;
}

/** Undiscovered hybrid recipe with the best chance whose parents are available. */
function hybridPair(ctx: GameContext, pool: Creature[]): [Creature, Creature] | null {
  if (!ctx.state.features['hybrids']) return null;
  const recipes = ctx.content.recipes.list.filter((r) => !isRecipeDiscovered(ctx, r)).sort((x, y) => hybridChance(ctx, y) - hybridChance(ctx, x));
  for (const r of recipes) {
    const req = r.requires;
    if (req?.condition && !checkCondition(ctx.state, req.condition)) continue;
    const fits = (c: Creature) => (!req?.minGeneration || c.generation >= req.minGeneration) && (!req?.minRarity || rarityAtLeast(ctx, c.rarity, req.minRarity));
    const as = pool.filter((c) => c.speciesId === r.parents[0] && fits(c));
    const bs = pool.filter((c) => c.speciesId === r.parents[1] && fits(c));
    const carrier = (c: Creature) => !req?.allele || carriesAllele(c, req.allele.locus, req.allele.allele);
    const pair = firstPair(as, bs, carrier) ?? firstPair(bs, as, carrier);
    if (pair && recipeMatches(ctx, r, pair[0], pair[1])) return pair;
  }
  return null;
}

/** Species with the most missing dex rarities; its two lowest generations (cheapest egg). */
function dexPair(ctx: GameContext, pool: Creature[]): [Creature, Creature] | null {
  const bySpecies = new Map<string, Creature[]>();
  for (const c of pool) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
  let best: { missing: number; pair: [Creature, Creature] } | null = null;
  for (const [species, list] of bySpecies) {
    if (list.length < 2) continue;
    const missing = ctx.content.rarities.list.filter((r) => !ctx.state.dex[`${species}:${r.id}`]).length;
    if (missing === 0 || (best && best.missing >= missing)) continue;
    const [a, b] = [...list].sort((x, y) => x.generation - y.generation);
    best = { missing, pair: [a!, b!] };
  }
  return best?.pair ?? null;
}

/** Copies of the target allele – only for sequenced creatures (the genome must be known). */
function alleleCopies(c: Creature, target: string | null): number {
  if (!target || !c.sequenced) return 0;
  const [locus = '', allele = ''] = target.split(':');
  return (c.genome[locus] ?? []).filter((x) => x === allele).length;
}

function abilityScore(ctx: GameContext, c: Creature): number {
  return c.abilities.reduce((sum, id) => sum + (ctx.content.abilities.has(id) ? ctx.content.rarities.get(ctx.content.abilities.get(id).tier).order + 1 : 0), 0);
}

/** The pair the automaton would breed next, or why it waits. */
export function planAutoBreed(ctx: GameContext): AutoBreedPlan {
  const cfg = ctx.state.automation.autoBreed;
  if (eggs(ctx).length >= nestSlots(ctx)) return { ok: false, reason: 'Alle Nester sind belegt.' };
  if (stableFree(ctx) <= 0 && cfg.cleanup === 'off') return { ok: false, reason: 'Der Stall ist voll.' };
  const pool = ctx.state.creatures.filter((c) => (c.job === null || c.job.kind === 'building') && (cfg.rule === 'hybrid' || !cfg.species || c.speciesId === cfg.species));
  let pair: [Creature, Creature] | null = null;
  let none = 'Keine zwei freien Kreaturen.';
  switch (cfg.rule) {
    case 'hybrid':
      pair = hybridPair(ctx, pool);
      none = 'Kein Paar für einen unentdeckten Hybriden.';
      break;
    case 'dex':
      pair = dexPair(ctx, pool);
      none = 'Keine Art mit Dex-Lücken und zwei freien Kreaturen.';
      break;
    case 'allele': {
      pair = topTwo(ctx, pool.filter((c) => c.sequenced), (c) => alleleCopies(c, cfg.allele));
      if (pair && alleleCopies(pair[0], cfg.allele) === 0) pair = null;
      none = cfg.allele ? 'Keine sequenzierte Kreatur trägt das Ziel-Allel.' : 'Kein Ziel-Allel gewählt.';
      break;
    }
    case 'abilities':
      pair = topTwo(ctx, pool, (c) => abilityScore(ctx, c));
      break;
    case 'cheap':
      pair = topTwo(ctx, pool, (c) => -c.generation);
      break;
    default:
      pair = topTwo(ctx, pool, (c) => breedRuleScore(ctx, c, cfg.rule));
  }
  if (!pair) return { ok: false, reason: none };
  const [a, b] = pair;
  const cost = breedingCost(ctx, offspringGeneration(a, b));
  if (!canAfford(ctx.state, cost)) return { ok: false, reason: 'Nicht genug Ressourcen.' };
  for (const [res, amount] of Object.entries(cost)) {
    if (amount.gt((ctx.state.resources[res] ?? D(0)).mul(cfg.budget))) return { ok: false, reason: `Über dem Budget (${Math.round(cfg.budget * 100)} % der Vorräte).` };
  }
  return { ok: true, a, b };
}

/** Automations may only remove consumable creatures that are not shiny, not infused and at most `maxRarity`. */
function expendable(ctx: GameContext, c: Creature, maxRarity: string): boolean {
  return canConsume(ctx, c) && !c.shiny && (c.infusion?.level ?? 0) === 0 && ctx.content.rarities.get(c.rarity).order <= ctx.content.rarities.get(maxRarity).order;
}

/** Weakest first: lower rarity, then lower power. */
function weakestFirst(ctx: GameContext, list: Creature[]): Creature[] {
  const power = new Map(list.map((c) => [c.id, creaturePower(ctx, c)]));
  return [...list].sort((x, y) => ctx.content.rarities.get(x.rarity).order - ctx.content.rarities.get(y.rarity).order || power.get(x.id)! - power.get(y.id)!);
}

/** Weakest creature the stable cleanup may remove (never favourites, shiny, infused or above the rarity limit). */
export function cleanupCandidate(ctx: GameContext, keep: readonly number[] = []): Creature | null {
  const cfg = ctx.state.automation.autoBreed;
  return weakestFirst(ctx, ctx.state.creatures.filter((c) => !keep.includes(c.id) && expendable(ctx, c, cfg.cleanupMaxRarity)))[0] ?? null;
}

/** Everything the Recycling-Automat may take right now, weakest first. */
export function autoRecycleCandidates(ctx: GameContext): Creature[] {
  const cfg = ctx.state.automation.autoRecycle;
  // The strongest N of each species stay, counting every creature of that species.
  const kept = new Set<number>();
  const bySpecies = new Map<string, Creature[]>();
  for (const c of ctx.state.creatures) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
  const power = new Map(ctx.state.creatures.map((c) => [c.id, creaturePower(ctx, c)]));
  for (const list of bySpecies.values()) {
    const strongest = [...list].sort((x, y) => power.get(y.id)! - power.get(x.id)!).slice(0, cfg.keepPerSpecies);
    for (const c of strongest) kept.add(c.id);
  }
  // Never the pair the Zuchtautomat is about to breed.
  if (ctx.state.automation.autoBreed.enabled && ctx.state.features['autoBreed']) {
    const plan = planAutoBreed(ctx);
    if (plan.ok) kept.add(plan.a.id).add(plan.b.id);
  }
  const out = weakestFirst(ctx, ctx.state.creatures.filter((c) => !kept.has(c.id) && !(cfg.keepSequenced && c.sequenced) && expendable(ctx, c, cfg.maxRarity)));
  // At least one creature must remain.
  return out.length >= ctx.state.creatures.length ? out.slice(0, -1) : out;
}

/** Recycles by the rules; returns how many creatures were recycled. */
export function autoRecycleOnce(ctx: GameContext): number {
  if (!ctx.state.features['recycler']) return 0;
  const cfg = ctx.state.automation.autoRecycle;
  if (cfg.when === 'full' && stableFree(ctx) > 0) return 0;
  const candidates = autoRecycleCandidates(ctx);
  const batch = cfg.when === 'full' ? candidates.slice(0, 1) : candidates;
  if (batch.length === 0) return 0;
  return recycle(ctx, batch.map((c) => c.id), true).ok ? batch.length : 0;
}

/** Breeds the planned pair; frees a stable place first if the cleanup is on. */
export function autoBreedOnce(ctx: GameContext): boolean {
  const plan = planAutoBreed(ctx);
  if (!plan.ok) return false;
  const cfg = ctx.state.automation.autoBreed;
  if (stableFree(ctx) <= 0) {
    const victim = cleanupCandidate(ctx, [plan.a.id, plan.b.id]);
    if (!victim) return false;
    const done = cfg.cleanup === 'recycle' && ctx.state.features['recycler'] ? recycle(ctx, [victim.id], true) : sell(ctx, [victim.id], true);
    if (!done.ok || stableFree(ctx) <= 0) return false;
  }
  return startBreeding(ctx, plan.a.id, plan.b.id).ok;
}

export function setAutoAssign(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['autoAssign']) return { ok: false, reason: 'Der Arbeitsplaner ist noch nicht freigeschaltet.' };
  ctx.state.automation.autoAssign = enabled;
  return { ok: true };
}

export function setAutoBreed(ctx: GameContext, patch: Partial<AutoBreedConfig>): ActionResult {
  if (!ctx.state.features['autoBreed']) return { ok: false, reason: 'Der Zuchtautomat ist noch nicht freigeschaltet.' };
  const next = { ...ctx.state.automation.autoBreed, ...patch };
  if (next.rule !== 'power' && !ctx.content.stats.has(next.rule) && !(BREED_GOALS as readonly string[]).includes(next.rule)) return { ok: false, reason: 'Unbekannte Regel.' };
  if (next.species && !ctx.content.species.has(next.species)) return { ok: false, reason: 'Unbekannte Art.' };
  if (next.allele) {
    const [locus = '', allele = ''] = next.allele.split(':');
    if (!ctx.content.genes.has(locus) || !ctx.content.genes.get(locus).alleles.some((a) => a.id === allele)) return { ok: false, reason: 'Unbekanntes Allel.' };
  }
  if (!(next.budget > 0 && next.budget <= 1)) return { ok: false, reason: 'Ungültiges Budget.' };
  if (!['off', 'sell', 'recycle'].includes(next.cleanup)) return { ok: false, reason: 'Unbekannte Stall-Regel.' };
  if (!ctx.content.rarities.has(next.cleanupMaxRarity)) return { ok: false, reason: 'Unbekannte Seltenheit.' };
  ctx.state.automation.autoBreed = next;
  return { ok: true };
}

export function setAutoRecycle(ctx: GameContext, patch: Partial<AutoRecycleConfig>): ActionResult {
  if (!ctx.state.features['autoRecycle']) return { ok: false, reason: 'Der Recycling-Automat ist noch nicht freigeschaltet.' };
  const next = { ...ctx.state.automation.autoRecycle, ...patch };
  if (!ctx.content.rarities.has(next.maxRarity)) return { ok: false, reason: 'Unbekannte Seltenheit.' };
  if (!(Number.isInteger(next.keepPerSpecies) && next.keepPerSpecies >= 0)) return { ok: false, reason: 'Ungültige Anzahl.' };
  if (!['always', 'full'].includes(next.when)) return { ok: false, reason: 'Unbekannte Regel.' };
  ctx.state.automation.autoRecycle = next;
  return { ok: true };
}

export const automationSystem: System = {
  id: 'automation',
  update(ctx) {
    const a = ctx.state.automation;
    if (ctx.state.simTimeMs - a.lastRunMs < ctx.balance.automation.intervalSec * 1000) return;
    a.lastRunMs = ctx.state.simTimeMs;
    // Recycle first, so a full stable has room for the next egg.
    if (a.autoRecycle.enabled && ctx.state.features['autoRecycle']) autoRecycleOnce(ctx);
    if (a.autoBreed.enabled && ctx.state.features['autoBreed']) autoBreedOnce(ctx);
    if (a.autoAssign && ctx.state.features['autoAssign']) autoAssign(ctx);
  },
};
