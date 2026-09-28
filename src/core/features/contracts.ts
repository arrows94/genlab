import { D, type Decimal } from '../num';
import { checkCondition } from '../conditions';
import { findCreature, removeCreature } from '../creatures';
import { activeLoci, catalogueGenome, expressLocus, libraryHas } from '../genetics';
import { grant } from '../resources';
import { Rng } from '../rng';
import { productionRates } from '../systems/production';
import type { AlleleDef, ContractRequirementSpec, ContractTemplateDef, GeneLocusDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { System } from '../systems/types';
import type { ContractOffer, ContractRequirement, Creature } from '../state';
import { consumeBlocker } from './stable';

/**
 * Gen-Aufträge: every day a board of contracts asks for a creature with
 * specific genes ("reinerbig Gestreift", "Wasser-Art mit Ergiebig", "3 Top-
 * Allele reinerbig"). Delivering hands the creature over for rewards.
 *
 * Offers are rolled from content templates with a seed per save and day, so
 * they are stable over reloads and need no server. Open parameters come from
 * what the player knows (gene library, dex), so every contract is reachable
 * with the breeding planner, sequencing and splicing. Completed contracts
 * raise the contract level, which unlocks harder templates.
 */
const DAY_MS = 86_400_000;
const TIER_ORDER: Record<string, number> = { base: 0, hybrid: 1, rareHybrid: 2, mythic: 3 };
const TIER_LABEL: Record<string, string> = { base: 'Basis-Art', hybrid: 'Hybrid-Art', rareHybrid: 'Seltene Hybrid-Art', mythic: 'Mythische Art' };

/** Contract day index; a day starts at `balance.contracts.dayStartHourUtc`. */
export function contractDay(ctx: GameContext, nowMs: number): number {
  return Math.floor((nowMs - ctx.balance.contracts.dayStartHourUtc * 3_600_000) / DAY_MS);
}

/** Wall-clock time when the next board appears. */
export function nextContractDay(ctx: GameContext, nowMs: number): number {
  return (contractDay(ctx, nowMs) + 1) * DAY_MS + ctx.balance.contracts.dayStartHourUtc * 3_600_000;
}

/** Contract level from completed contracts (1 …). */
export function contractLevel(ctx: GameContext): number {
  const done = ctx.state.contracts.completed;
  return Math.max(1, ctx.balance.contracts.levelThresholds.filter((t) => done >= t).length);
}

/** Completed contracts needed for the next level, or null at the top. */
export function nextLevelAt(ctx: GameContext): number | null {
  return ctx.balance.contracts.levelThresholds[contractLevel(ctx)] ?? null;
}

function eligibleTemplates(ctx: GameContext): ContractTemplateDef[] {
  const level = contractLevel(ctx);
  return ctx.content.contracts.list.filter((t) => t.level <= level && t.weight > 0 && (!t.requires || checkCondition(ctx.state, t.requires)));
}

// ---------------------------------------------------------------- rolling

/** Alleles worth asking for: not the most common one of the locus. */
function notDefault(locus: GeneLocusDef): AlleleDef[] {
  const common = Math.max(...locus.alleles.map((a) => a.weight));
  return locus.alleles.filter((a) => a.weight < common);
}

/** Recessive alleles with an effect – only visible in homozygous creatures. */
function recessive(locus: GeneLocusDef): AlleleDef[] {
  const top = Math.max(...locus.alleles.map((a) => a.dominance));
  return locus.alleles.filter((a) => a.dominance < top && (a.modifiers.length > 0 || a.visual));
}

/** Species the player has discovered (dex). */
function knownSpecies(ctx: GameContext) {
  const ids = new Set(Object.keys(ctx.state.dex).map((k) => k.split(':')[0]!));
  return ctx.content.species.list.filter((s) => ids.has(s.id));
}

interface Roll {
  rng: Rng;
  usedLoci: Set<string>;
  minTier: number;
}

function rollGene(ctx: GameContext, spec: Extract<ContractRequirementSpec, { kind: 'expresses' | 'genotype' }>, roll: Roll): { locus: string; allele: string } | null {
  const options: { locus: string; allele: string; known: boolean }[] = [];
  for (const locus of activeLoci(ctx)) {
    if (roll.usedLoci.has(locus.id) || (spec.locus && spec.locus !== locus.id)) continue;
    if (spec.kind === 'expresses' && spec.category && locus.category !== spec.category) continue;
    const alleles = spec.allele
      ? locus.alleles.filter((a) => a.id === spec.allele)
      : spec.kind === 'genotype' && spec.recessive
        ? recessive(locus)
        : notDefault(locus);
    for (const a of alleles) options.push({ locus: locus.id, allele: a.id, known: libraryHas(ctx, locus.id, a.id) });
  }
  // Prefer alleles from the gene library: the player knows them and can splice them in.
  const known = options.filter((o) => o.known);
  const pool = known.length > 0 ? known : options;
  if (pool.length === 0) return null;
  const pick = roll.rng.pick(pool);
  roll.usedLoci.add(pick.locus);
  return { locus: pick.locus, allele: pick.allele };
}

function rollRequirement(ctx: GameContext, spec: ContractRequirementSpec, roll: Roll): ContractRequirement | null {
  switch (spec.kind) {
    case 'expresses':
    case 'genotype': {
      const gene = rollGene(ctx, spec, roll);
      return gene ? { kind: spec.kind, ...gene } : null;
    }
    case 'element': {
      if (spec.element) return { kind: 'element', element: spec.element };
      const elements = [...new Set(knownSpecies(ctx).filter((s) => (TIER_ORDER[s.tier] ?? 0) >= roll.minTier).map((s) => s.element))];
      return elements.length > 0 ? { kind: 'element', element: roll.rng.pick(elements) } : null;
    }
    case 'minTier':
      // Only ask for tiers the player has already reached once.
      return knownSpecies(ctx).some((s) => (TIER_ORDER[s.tier] ?? 0) >= (TIER_ORDER[spec.tier] ?? 0)) ? { kind: 'minTier', tier: spec.tier } : null;
    case 'topLoci':
      return activeLoci(ctx).filter((l) => l.alleles.some((a) => a.top)).length >= spec.count ? { ...spec } : null;
    case 'minRarity':
    case 'minGeneration':
      return { ...spec };
  }
}

function makeOffer(ctx: GameContext, t: ContractTemplateDef, rng: Rng): ContractOffer | null {
  const tier = t.requirements.find((r) => r.kind === 'minTier');
  const roll: Roll = { rng, usedLoci: new Set(), minTier: tier?.kind === 'minTier' ? (TIER_ORDER[tier.tier] ?? 0) : 0 };
  const requirements: ContractRequirement[] = [];
  for (const spec of t.requirements) {
    const req = rollRequirement(ctx, spec, roll);
    if (!req) return null;
    requirements.push(req);
  }
  return { template: t.id, requirements, done: false };
}

/**
 * One offer for a board slot. The last slot prefers the highest level
 * available, so there is always one challenging contract.
 */
function rollOffer(ctx: GameContext, day: number, slot: number, variant: number, exclude: Set<string>): ContractOffer | null {
  const rng = Rng.fromSeed(`contracts:${ctx.state.createdAt}:${day}:${slot}:${variant}`);
  let pool = eligibleTemplates(ctx).filter((t) => !exclude.has(t.id));
  if (slot === ctx.balance.contracts.offersPerDay - 1) {
    const top = Math.max(0, ...pool.map((t) => t.level));
    const hard = pool.filter((t) => t.level === top);
    if (hard.length > 0) pool = hard;
  }
  while (pool.length > 0) {
    const weights: Record<string, number> = {};
    for (const t of pool) weights[t.id] = t.weight;
    const t = ctx.content.contracts.get(rng.weighted(weights));
    const offer = makeOffer(ctx, t, rng);
    if (offer) return offer;
    pool = pool.filter((x) => x.id !== t.id);
  }
  return null;
}

/** Rolls a new board when the day changed (runs every tick; cheap). */
export function refreshContracts(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['contracts']) return;
  const day = contractDay(ctx, nowMs);
  const board = ctx.state.contracts;
  if (board.day === day) return;
  const offers: ContractOffer[] = [];
  const used = new Set<string>();
  for (let slot = 0; slot < ctx.balance.contracts.offersPerDay; slot++) {
    const offer = rollOffer(ctx, day, slot, 0, used);
    if (!offer) continue;
    used.add(offer.template);
    offers.push(offer);
  }
  board.day = day;
  board.offers = offers;
  board.rerolls = 0;
}

export const contractSystem: System = {
  id: 'contracts',
  update(ctx) {
    refreshContracts(ctx);
  },
};

/** Swaps an open offer for another one (limited per day). */
export function rerollContract(ctx: GameContext, slot: number): ActionResult {
  if (!ctx.state.features['contracts']) return { ok: false, reason: 'Gen-Aufträge sind noch nicht freigeschaltet.' };
  const board = ctx.state.contracts;
  const offer = board.offers[slot];
  if (!offer) return { ok: false, reason: 'Auftrag nicht gefunden.' };
  if (offer.done) return { ok: false, reason: 'Der Auftrag ist bereits erledigt.' };
  if (board.rerolls >= ctx.balance.contracts.rerollsPerDay) return { ok: false, reason: 'Heute kein Tausch mehr möglich.' };
  // Other templates of the board stay excluded; the same template with other genes is fine.
  const others = new Set(board.offers.filter((_, i) => i !== slot).map((o) => o.template));
  const same = JSON.stringify(offer);
  let next: ContractOffer | null = null;
  for (let attempt = 1; attempt <= 8 && !next; attempt++) {
    const candidate = rollOffer(ctx, board.day, slot, (board.rerolls + 1) * 100 + attempt, others);
    if (candidate && JSON.stringify(candidate) !== same) next = candidate;
  }
  if (!next) return { ok: false, reason: 'Gerade gibt es keinen anderen Auftrag.' };
  board.offers[slot] = next;
  board.rerolls++;
  return { ok: true };
}

// ---------------------------------------------------------------- matching

export type RequirementStatus = 'met' | 'unmet' | 'unknown';

function topLociCount(ctx: GameContext, c: Creature, homozygous: boolean): number {
  let n = 0;
  for (const locus of activeLoci(ctx)) {
    const top = locus.alleles.find((a) => a.top);
    const pair = c.genome[locus.id];
    if (!top || !pair) continue;
    if (homozygous ? pair[0] === top.id && pair[1] === top.id : expressLocus(locus, pair).some((e) => e.allele.id === top.id)) n++;
  }
  return n;
}

/** Gene requirements are `unknown` until the creature is sequenced. */
export function requirementStatus(ctx: GameContext, c: Creature, req: ContractRequirement): RequirementStatus {
  const species = ctx.content.species.get(c.speciesId);
  const ok = (v: boolean): RequirementStatus => (v ? 'met' : 'unmet');
  switch (req.kind) {
    case 'element':
      return ok(species.element === req.element);
    case 'minTier':
      return ok((TIER_ORDER[species.tier] ?? 0) >= (TIER_ORDER[req.tier] ?? 0));
    case 'minRarity':
      return ok(ctx.content.rarities.get(c.rarity).order >= ctx.content.rarities.get(req.rarity).order);
    case 'minGeneration':
      return ok(c.generation >= req.generation);
  }
  if (!c.sequenced) return 'unknown';
  switch (req.kind) {
    case 'expresses': {
      const pair = c.genome[req.locus];
      return ok(!!pair && ctx.content.genes.has(req.locus) && expressLocus(ctx.content.genes.get(req.locus), pair).some((e) => e.allele.id === req.allele));
    }
    case 'genotype': {
      const pair = c.genome[req.locus];
      return ok(!!pair && pair[0] === req.allele && pair[1] === req.allele);
    }
    case 'topLoci':
      return ok(topLociCount(ctx, c, req.homozygous) >= req.count);
  }
}

export function offerStatus(ctx: GameContext, c: Creature, offer: ContractOffer): RequirementStatus {
  const all = offer.requirements.map((r) => requirementStatus(ctx, c, r));
  if (all.includes('unmet')) return 'unmet';
  return all.includes('unknown') ? 'unknown' : 'met';
}

/** Creatures that fulfil the offer, and unsequenced ones that still might. */
export function contractCandidates(ctx: GameContext, offer: ContractOffer): { ready: Creature[]; maybe: Creature[] } {
  const ready: Creature[] = [];
  const maybe: Creature[] = [];
  for (const c of ctx.state.creatures) {
    const s = offerStatus(ctx, c, offer);
    if (s === 'met') ready.push(c);
    else if (s === 'unknown') maybe.push(c);
  }
  return { ready, maybe };
}

/** Open offers that a creature could fulfil right now (tab badge). */
export function fulfillableCount(ctx: GameContext): number {
  if (!ctx.state.features['contracts']) return 0;
  return ctx.state.contracts.offers.filter((o) => !o.done && ctx.state.creatures.some((c) => offerStatus(ctx, c, o) === 'met')).length;
}

// ---------------------------------------------------------------- rewards

/** Resource rewards at the current production (shown live on the card). */
export function contractReward(ctx: GameContext, offer: ContractOffer): Record<string, Decimal> {
  const reward = ctx.content.contracts.get(offer.template).reward;
  const factor = ctx.mods().factor('contracts.reward');
  const out: Record<string, Decimal> = {};
  const add = (res: string, v: Decimal) => (out[res] = (out[res] ?? D(0)).add(v));
  if (reward.minutes) {
    for (const [res, rate] of Object.entries(productionRates(ctx))) if (rate.gt(0)) add(res, rate.mul(60 * reward.minutes));
  }
  for (const [res, amount] of Object.entries(reward.resources ?? {})) {
    const feature = ctx.content.resources.get(res).feature;
    if (!feature || ctx.state.features[feature]) add(res, D(amount));
  }
  for (const res of Object.keys(out)) out[res] = out[res]!.mul(factor).floor();
  return out;
}

/** Alleles still missing in the gene library, rarest first. */
export function missingAlleles(ctx: GameContext): { locus: string; allele: string }[] {
  const out: { locus: string; allele: string; weight: number }[] = [];
  for (const locus of activeLoci(ctx)) {
    for (const a of locus.alleles) if (!libraryHas(ctx, locus.id, a.id)) out.push({ locus: locus.id, allele: a.id, weight: a.weight });
  }
  return out.sort((x, y) => x.weight - y.weight).map(({ locus, allele }) => ({ locus, allele }));
}

/** Hands a matching creature over: it leaves, the rewards arrive. */
export function deliverContract(ctx: GameContext, slot: number, creatureId: number): ActionResult {
  if (!ctx.state.features['contracts']) return { ok: false, reason: 'Gen-Aufträge sind noch nicht freigeschaltet.' };
  const board = ctx.state.contracts;
  const offer = board.offers[slot];
  if (!offer) return { ok: false, reason: 'Auftrag nicht gefunden.' };
  if (offer.done) return { ok: false, reason: 'Der Auftrag ist bereits erledigt.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const status = offerStatus(ctx, c, offer);
  if (status === 'unknown') return { ok: false, reason: 'Erst das Genom sequenzieren.' };
  if (status === 'unmet') return { ok: false, reason: 'Die Kreatur erfüllt den Auftrag nicht.' };
  const blocker = consumeBlocker(ctx, c);
  if (blocker) return { ok: false, reason: blocker };
  if (ctx.state.creatures.length <= 1) return { ok: false, reason: 'Mindestens eine Kreatur muss bleiben.' };

  const template = ctx.content.contracts.get(offer.template);
  const rewards = contractReward(ctx, offer);
  removeCreature(ctx, c.id, 'contract');
  for (const [res, amount] of Object.entries(rewards)) grant(ctx, res, amount, `contract:${template.id}`);
  for (const { locus, allele } of missingAlleles(ctx).slice(0, template.reward.alleleSamples ?? 0)) catalogueGenome(ctx, { [locus]: [allele, allele] });
  offer.done = true;
  board.completed++;
  ctx.invalidate();
  ctx.bus.emit('contractCompleted', { template: template.id, creatureId, level: template.level });
  return { ok: true };
}

// ---------------------------------------------------------------- texts

export function requirementText(ctx: GameContext, req: ContractRequirement): string {
  switch (req.kind) {
    case 'expresses':
    case 'genotype': {
      const locus = ctx.content.genes.get(req.locus);
      const a = locus.alleles.find((x) => x.id === req.allele);
      return req.kind === 'expresses' ? `Zeigt „${a?.name ?? req.allele}“ (${locus.name})` : `Reinerbig ${a?.symbol}/${a?.symbol} – ${a?.name ?? req.allele} (${locus.name})`;
    }
    case 'element':
      return `Element ${ctx.content.elements.get(req.element).name}`;
    case 'minTier':
      return `${TIER_LABEL[req.tier] ?? req.tier} oder höher`;
    case 'topLoci':
      return `${req.count} Top-Allele ${req.homozygous ? 'reinerbig' : 'ausgeprägt'}`;
    case 'minRarity':
      return `Seltenheit ab ${ctx.content.rarities.get(req.rarity).name}`;
    case 'minGeneration':
      return `Ab Generation ${req.generation}`;
  }
}
