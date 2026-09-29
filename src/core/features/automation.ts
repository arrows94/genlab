import { assignJob } from '../actions';
import { effectiveStats, creaturePower, findCreature } from '../creatures';
import { canAfford } from '../costs';
import { jobCount, jobSlots } from '../systems/production';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { AutoBreedConfig, AutoRecycleConfig, Creature } from '../state';
import { D } from '../num';
import type { System } from '../systems/types';
import { breedingCost, nestEggs, nestSlots, offspringGeneration, startBreeding } from './breeding';
import { checkCondition } from '../conditions';
import { carriesAllele, hybridChance, isRecipeDiscovered, rarityAtLeast, recipeMatches } from './hybrids';
import { recycle } from './recycler';
import { canConsume, sell, stableFree } from './stable';
import { isBeingSequenced, sequencerSlots, sequencerUsed, sequencingCost, startSequencing } from './sequencing';

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
export const BREED_GOALS = ['hybrid', 'dex', 'allele', 'abilities', 'lineage', 'cheap'] as const;

export type AutoBreedPlan = { ok: true; a: Creature; b: Creature } | { ok: false; reason: string };

/**
 * Fills every unlocked building with the best available creatures for its
 * work stat. Only idle or already working creatures are moved.
 */
export function autoAssign(ctx: GameContext): ActionResult {
  if (!ctx.state.features['autoAssign']) return { ok: false, reason: 'Der Arbeitsplaner ist noch nicht freigeschaltet.' };
  // The creature in the Zerlege-Kammer stays put (only the player can take it out).
  const pool = ctx.state.creatures.filter((c) => (c.job === null || c.job.kind === 'building') && !inRecycler(ctx, c.id));
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

/**
 * Stammbaum-Dynastie: the two deepest lines of one species (the child gets
 * the shallower line + 1). Lower generations first at the same depth – cheaper eggs.
 */
function lineagePair(pool: Creature[]): [Creature, Creature] | null {
  const bySpecies = new Map<string, Creature[]>();
  for (const c of pool) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
  let best: { depth: number; generation: number; pair: [Creature, Creature] } | null = null;
  for (const list of bySpecies.values()) {
    if (list.length < 2) continue;
    const [a, b] = [...list].sort((x, y) => (y.lineage ?? 0) - (x.lineage ?? 0) || x.generation - y.generation);
    const depth = Math.min(a!.lineage ?? 0, b!.lineage ?? 0);
    const generation = Math.max(a!.generation, b!.generation);
    if (!best || depth > best.depth || (depth === best.depth && generation < best.generation)) best = { depth, generation, pair: [a!, b!] };
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
  if (nestEggs(ctx).length >= nestSlots(ctx)) return { ok: false, reason: 'Alle Nester sind belegt.' };
  if (stableFree(ctx) <= 0 && cfg.cleanup === 'off') return { ok: false, reason: 'Der Stall ist voll.' };
  const pool = ctx.state.creatures.filter((c) => (c.job === null || c.job.kind === 'building') && !inRecycler(ctx, c.id) && (cfg.rule === 'hybrid' || !cfg.species || c.speciesId === cfg.species));
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
    case 'lineage':
      pair = lineagePair(pool);
      none = 'Keine zwei freien Kreaturen derselben Art.';
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

/**
 * The strongest N creatures of every species (N = „mindestens N jeder Art
 * behalten“ of the Recycling-Automat). No automation may remove them – the
 * stable cleanup of the Zuchtautomat follows the same rule. Every creature
 * of a species counts, also busy ones.
 */
export function keptPerSpecies(ctx: GameContext): Set<number> {
  const n = ctx.state.automation.autoRecycle.keepPerSpecies;
  const kept = new Set<number>();
  if (n <= 0) return kept;
  const bySpecies = new Map<string, Creature[]>();
  for (const c of ctx.state.creatures) bySpecies.set(c.speciesId, [...(bySpecies.get(c.speciesId) ?? []), c]);
  const power = new Map(ctx.state.creatures.map((c) => [c.id, creaturePower(ctx, c)]));
  for (const list of bySpecies.values()) {
    for (const c of [...list].sort((x, y) => power.get(y.id)! - power.get(x.id)!).slice(0, n)) kept.add(c.id);
  }
  return kept;
}

/**
 * Weakest creature the stable cleanup may remove: never favourites, shiny,
 * infused, above the rarity limit, or among the strongest N of its species.
 */
export function cleanupCandidate(ctx: GameContext, keep: readonly number[] = []): Creature | null {
  const cfg = ctx.state.automation.autoBreed;
  const kept = keptPerSpecies(ctx);
  // The creature in the Zerlege-Kammer is already on its way – take the next one.
  return weakestFirst(ctx, ctx.state.creatures.filter((c) => !keep.includes(c.id) && !kept.has(c.id) && !inRecycler(ctx, c.id) && expendable(ctx, c, cfg.cleanupMaxRarity)))[0] ?? null;
}

/** Everything the Recycling-Automat may take right now, weakest first. */
export function autoRecycleCandidates(ctx: GameContext): Creature[] {
  const cfg = ctx.state.automation.autoRecycle;
  // The strongest N of each species stay, counting every creature of that species.
  const kept = keptPerSpecies(ctx);
  // Never the pair the Zuchtautomat is about to breed.
  if (ctx.state.automation.autoBreed.enabled && ctx.state.features['autoBreed']) {
    const plan = planAutoBreed(ctx);
    if (plan.ok) kept.add(plan.a.id).add(plan.b.id);
  }
  const out = weakestFirst(ctx, ctx.state.creatures.filter((c) => !kept.has(c.id) && !(cfg.keepSequenced && c.sequenced) && expendable(ctx, c, cfg.maxRarity)));
  // At least one creature must remain.
  return out.length >= ctx.state.creatures.length ? out.slice(0, -1) : out;
}

// ---- Zerlege-Kammer: the Recycling-Automat takes one creature at a time ----

/** Creature is in the Zerlege-Kammer (the other automations leave it alone). */
export function inRecycler(ctx: GameContext, id: number): boolean {
  return ctx.state.automation.recycling?.creatureId === id;
}

/** Time the Recycling-Automat needs per creature (research „Schnellzerlegung“ shortens it). */
export function recycleDurationMs(ctx: GameContext): number {
  const r = ctx.balance.recycler;
  return Math.max(r.autoMinSec, ctx.mods().apply('recycler.time', r.autoSec)) * 1000;
}

function recyclerRunning(ctx: GameContext): boolean {
  return ctx.state.automation.autoRecycle.enabled && !!ctx.state.features['autoRecycle'] && !!ctx.state.features['recycler'];
}

/** Next creature for the chamber by the rules („nur wenn der Stall voll ist“ waits for a full stable). */
function nextForChamber(ctx: GameContext): Creature | null {
  if (ctx.state.automation.autoRecycle.when === 'full' && stableFree(ctx) > 0) return null;
  return autoRecycleCandidates(ctx)[0] ?? null;
}

/** Cheap per-step check: the player may rescue the creature (favourite, put to work, sequencing …). */
function stillExpendable(ctx: GameContext, c: Creature | undefined): c is Creature {
  const cfg = ctx.state.automation.autoRecycle;
  return !!c && expendable(ctx, c, cfg.maxRarity) && !(cfg.keepSequenced && c.sequenced);
}

/** The creature in the Zerlege-Kammer with its progress, or null. */
export function recyclingNow(ctx: GameContext): { creature: Creature; progress: number; remainingMs: number; durationMs: number } | null {
  const cur = ctx.state.automation.recycling;
  const creature = cur ? findCreature(ctx, cur.creatureId) : undefined;
  if (!cur || !creature) return null;
  const durationMs = recycleDurationMs(ctx);
  return { creature, progress: Math.min(1, cur.elapsedMs / durationMs), remainingMs: Math.max(0, durationMs - cur.elapsedMs), durationMs };
}

/** Puts the next creature into the empty chamber; returns whether one went in. */
export function fillRecycler(ctx: GameContext): boolean {
  if (!recyclerRunning(ctx) || ctx.state.automation.recycling) return false;
  const next = nextForChamber(ctx);
  if (!next) return false;
  ctx.state.automation.recycling = { creatureId: next.id, elapsedMs: 0 };
  return true;
}

/**
 * Runs the chamber for `dtMs`: a finished creature is recycled (if the rules
 * still allow it) and the next one goes in right away, so offline steps
 * process several creatures.
 */
export function advanceRecycler(ctx: GameContext, dtMs: number): void {
  const a = ctx.state.automation;
  if (!a.recycling) return;
  if (!recyclerRunning(ctx)) {
    a.recycling = null; // switched off: the creature is free again
    return;
  }
  let budget = dtMs;
  for (let i = 0; i < 1000 && a.recycling && budget > 0; i++) {
    const cur = a.recycling;
    if (!stillExpendable(ctx, findCreature(ctx, cur.creatureId))) {
      a.recycling = null;
      break;
    }
    const need = recycleDurationMs(ctx) - cur.elapsedMs;
    if (budget < need) {
      cur.elapsedMs += budget;
      break;
    }
    budget -= need;
    a.recycling = null;
    // Once inside, it is recycled – only a rescue (checked above) or „je Art behalten“ stops it.
    // The rules for picking (e.g. the Zuchtautomat's next pair) were checked when it went in.
    if (!keptPerSpecies(ctx).has(cur.creatureId)) recycle(ctx, [cur.creatureId], true);
    fillRecycler(ctx);
  }
}

export const recyclerSystem: System = {
  id: 'recycler',
  update(ctx, dtMs) {
    advanceRecycler(ctx, dtMs);
  },
};

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

/**
 * Sequenzier-Roboter: fills free sequencer slots with the strongest
 * unsequenced creatures it can afford. Returns how many it started.
 */
export function autoSequenceOnce(ctx: GameContext): number {
  let started = 0;
  const queue = ctx.state.creatures
    .filter((c) => !c.sequenced && !isBeingSequenced(ctx, c.id))
    .sort((a, b) => creaturePower(ctx, b) - creaturePower(ctx, a));
  for (const c of queue) {
    if (sequencerUsed(ctx) >= sequencerSlots(ctx)) break;
    if (!canAfford(ctx.state, sequencingCost(ctx, c))) break;
    if (startSequencing(ctx, c.id).ok) started++;
  }
  return started;
}

export function setAutoSequence(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['autoSequence']) return { ok: false, reason: 'Der Sequenzier-Roboter ist noch nicht erforscht.' };
  ctx.state.automation.autoSequence = enabled;
  return { ok: true };
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
    if (a.autoRecycle.enabled && ctx.state.features['autoRecycle']) fillRecycler(ctx);
    if (a.autoBreed.enabled && ctx.state.features['autoBreed']) autoBreedOnce(ctx);
    if (a.autoAssign && ctx.state.features['autoAssign']) autoAssign(ctx);
    if (a.autoSequence && ctx.state.features['autoSequence']) autoSequenceOnce(ctx);
  },
};
