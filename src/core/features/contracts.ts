import { D, type Decimal } from '../num';
import { checkCondition } from '../conditions';
import { findCreature, isOccupied, removeCreature } from '../creatures';
import { activeLoci, catalogueSamples, expressLocus, libraryHas } from '../genetics';
import { grant } from '../resources';
import { Rng } from '../rng';
import { rewardAmounts } from '../rewards';
import type { AlleleDef, ContractRequirementSpec, ContractTemplateDef, GeneLocusDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { System } from '../systems/types';
import { processRemainingMs, registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import type { ContractOffer, ContractRequirement, Creature, RpgItem } from '../state';
import { rpgLevel } from './rpgCombat';
import { consumeBlocker } from './stable';

/**
 * Gen-Aufträge: every day a board of contracts asks for a creature with
 * specific genes ("reinerbig Gestreift", "Wasser-Art mit Ergiebig", "3 Top-
 * Allele reinerbig"). Delivering hands the creature over for rewards. Some
 * clients only borrow the creature for a few hours (`delivery: 'loan'`), others
 * ask for a piece of GenLab RPG equipment instead (`delivery: 'item'`).
 *
 * Offers are rolled from content templates with a seed per save and day, so
 * they are stable over reloads and need no server. Open parameters come from
 * what the player knows (gene library, dex), so every contract is reachable
 * with the breeding planner, sequencing and splicing. Completed contracts
 * raise the contract level („Ruf“), which unlocks harder templates and a
 * bigger board: at Ruf N there are N 1★ offers, N−1 2★ … down to one N★.
 */
const DAY_MS = 86_400_000;
/** A creature on loan to a client: away like a traveller, back after `loanHours`. */
export const CONTRACT_LOAN = 'contractLoan';

export interface ContractLoanData extends Record<string, unknown> {
  creatureId: number;
  template: string;
}
const TIER_ORDER: Record<string, number> = { base: 0, hybrid: 1, rareHybrid: 2, mythic: 3 };
const SLOT_LABEL: Record<string, string> = { weapon: 'Waffe', armor: 'Panzer', charm: 'Talisman' };
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

/**
 * Star levels of the day's board, easiest first: at Ruf N, N× 1★, (N−1)× 2★ … 1× N★.
 * Short boards are filled up with 1★ to `offersPerDay`.
 */
export function boardLevels(level: number, minOffers: number): number[] {
  const out: number[] = [];
  for (let star = 1; star <= level; star++) for (let i = 0; i < level - star + 1; i++) out.push(star);
  while (out.length < minOffers) out.unshift(1);
  return out;
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
    case 'rpgLevel':
      return { ...spec };
    case 'item': {
      const slots = [...new Set(ctx.content.rpgGear.list.map((g) => g.slot))];
      const slot = spec.slot ?? (slots.length > 0 ? roll.rng.pick(slots) : null);
      return slot ? { kind: 'item', minRarity: spec.minRarity, slot } : null;
    }
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

const offerKey = (o: ContractOffer) => JSON.stringify([o.template, o.requirements]);

/**
 * One offer of `star` level for a board slot (the nearest lower level when
 * none is available). Templates not yet on the board come first; once all
 * are used a template may repeat, but never with the same genes (`avoid`).
 */
function rollOffer(ctx: GameContext, day: number, slot: number, variant: number, star: number, usedTemplates: Set<string>, avoid: Set<string>): ContractOffer | null {
  const rng = Rng.fromSeed(`contracts:${ctx.state.createdAt}:${day}:${slot}:${variant}`);
  const eligible = eligibleTemplates(ctx);
  const level = Math.max(0, ...eligible.filter((t) => t.level <= star).map((t) => t.level));
  const atLevel = eligible.filter((t) => t.level === level);
  const fresh = atLevel.filter((t) => !usedTemplates.has(t.id));
  let pool = fresh.length > 0 ? fresh : atLevel;
  let tries = 8;
  while (pool.length > 0 && tries-- > 0) {
    const weights: Record<string, number> = {};
    for (const t of pool) weights[t.id] = t.weight;
    const t = ctx.content.contracts.get(rng.weighted(weights));
    const offer = makeOffer(ctx, t, rng);
    if (!offer) pool = pool.filter((x) => x.id !== t.id);
    else if (!avoid.has(offerKey(offer))) return offer;
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
  const avoid = new Set<string>();
  for (const [slot, star] of boardLevels(contractLevel(ctx), ctx.balance.contracts.offersPerDay).entries()) {
    const offer = rollOffer(ctx, day, slot, 0, star, used, avoid);
    if (!offer) continue;
    used.add(offer.template);
    avoid.add(offerKey(offer));
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
  // Same star level; templates of the other offers come last, and no offer of the board is repeated.
  const others = new Set(board.offers.filter((_, i) => i !== slot).map((o) => o.template));
  const avoid = new Set(board.offers.map(offerKey));
  const star = ctx.content.contracts.get(offer.template).level;
  let next: ContractOffer | null = null;
  for (let attempt = 1; attempt <= 8 && !next; attempt++) {
    next = rollOffer(ctx, board.day, slot, (board.rerolls + 1) * 100 + attempt, star, others, avoid);
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
    case 'rpgLevel':
      return ok(rpgLevel(ctx, c.id).level >= req.level);
    case 'item':
      return 'unmet';
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

/** How the client takes the delivery: for good, on loan, or a piece of equipment. */
export function contractDelivery(ctx: GameContext, offer: ContractOffer): 'creature' | 'loan' | 'item' {
  return ctx.content.contracts.get(offer.template).delivery ?? 'creature';
}

/** Hours a loaned creature stays with the client. */
export function loanHours(ctx: GameContext, offer: ContractOffer): number {
  return ctx.content.contracts.get(offer.template).loanHours ?? 0;
}

/** Equipment the offer accepts: right slot, rarity high enough, not worn. */
export function itemCandidates(ctx: GameContext, offer: ContractOffer): RpgItem[] {
  const req = offer.requirements.find((r) => r.kind === 'item');
  if (!req || req.kind !== 'item') return [];
  const r = ctx.state.rpg;
  const worn = new Set(Object.values(r.equipped));
  const min = ctx.content.rarities.get(req.minRarity).order;
  return r.items.filter((i) => !worn.has(i.id) && ctx.content.rpgGear.has(i.gear) && ctx.content.rpgGear.get(i.gear).slot === req.slot
    && ctx.content.rarities.has(i.rarity) && ctx.content.rarities.get(i.rarity).order >= min);
}

/**
 * Why this creature cannot be handed over for the offer right now (null = it can).
 * A loan does not consume the creature: favourites may go, busy ones may not.
 */
export function deliveryBlocker(ctx: GameContext, offer: ContractOffer, c: Creature): string | null {
  if (contractDelivery(ctx, offer) !== 'loan') return consumeBlocker(ctx, c);
  return isOccupied(c) ? `${c.name} ist beschäftigt.` : null;
}

/** Creatures that fulfil the offer, and unsequenced ones that still might. */
export function contractCandidates(ctx: GameContext, offer: ContractOffer): { ready: Creature[]; maybe: Creature[] } {
  const ready: Creature[] = [];
  const maybe: Creature[] = [];
  if (contractDelivery(ctx, offer) === 'item') return { ready, maybe };
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
  return ctx.state.contracts.offers.filter((o) => !o.done && (contractDelivery(ctx, o) === 'item'
    ? itemCandidates(ctx, o).length > 0
    : ctx.state.creatures.some((c) => offerStatus(ctx, c, o) === 'met'))).length;
}

// ---------------------------------------------------------------- rewards

/** Resource rewards at the current production (shown live on the card), plus Fackeln once the GenLab RPG is open. */
export function contractReward(ctx: GameContext, offer: ContractOffer): Record<string, Decimal> {
  const out = rewardAmounts(ctx, ctx.content.contracts.get(offer.template).reward, 'contracts.reward');
  if (ctx.state.features['rpg'] && ctx.balance.rpg.contractTorches > 0) out['torches'] = (out['torches'] ?? D(0)).add(ctx.balance.rpg.contractTorches);
  return out;
}

function openOffer(ctx: GameContext, slot: number): ContractOffer | string {
  if (!ctx.state.features['contracts']) return 'Gen-Aufträge sind noch nicht freigeschaltet.';
  const offer = ctx.state.contracts.offers[slot];
  if (!offer) return 'Auftrag nicht gefunden.';
  if (offer.done) return 'Der Auftrag ist bereits erledigt.';
  return offer;
}

/** Rewards arrive, the offer is done and counts for the Ruf. */
function completeOffer(ctx: GameContext, offer: ContractOffer, creatureId: number | null): void {
  const template = ctx.content.contracts.get(offer.template);
  for (const [res, amount] of Object.entries(contractReward(ctx, offer))) grant(ctx, res, amount, `contract:${template.id}`);
  catalogueSamples(ctx, template.reward.alleleSamples ?? 0);
  offer.done = true;
  ctx.state.contracts.completed++;
  ctx.invalidate();
  ctx.bus.emit('contractCompleted', { template: template.id, creatureId, level: template.level });
}

/** Hands a matching creature over: it leaves (or goes on loan), the rewards arrive. */
export function deliverContract(ctx: GameContext, slot: number, creatureId: number): ActionResult {
  const offer = openOffer(ctx, slot);
  if (typeof offer === 'string') return { ok: false, reason: offer };
  const delivery = contractDelivery(ctx, offer);
  if (delivery === 'item') return { ok: false, reason: 'Dieser Auftrag verlangt Ausrüstung.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const status = offerStatus(ctx, c, offer);
  if (status === 'unknown') return { ok: false, reason: 'Erst das Genom sequenzieren.' };
  if (status === 'unmet') return { ok: false, reason: 'Die Kreatur erfüllt den Auftrag nicht.' };
  const blocker = deliveryBlocker(ctx, offer, c);
  if (blocker) return { ok: false, reason: blocker };
  if (ctx.state.creatures.length <= 1) return { ok: false, reason: 'Mindestens eine Kreatur muss bleiben.' };

  if (delivery === 'loan') {
    const data: ContractLoanData = { creatureId: c.id, template: offer.template };
    const proc = startProcess(ctx, CONTRACT_LOAN, loanHours(ctx, offer) * 3_600_000, data);
    c.job = { kind: 'mission', target: String(proc.id) };
  } else {
    removeCreature(ctx, c.id, 'contract');
  }
  completeOffer(ctx, offer, creatureId);
  return { ok: true };
}

/** Hands a piece of RPG equipment over (instead of taking it apart for Runen). */
export function deliverItem(ctx: GameContext, slot: number, itemId: number): ActionResult {
  const offer = openOffer(ctx, slot);
  if (typeof offer === 'string') return { ok: false, reason: offer };
  if (contractDelivery(ctx, offer) !== 'item') return { ok: false, reason: 'Dieser Auftrag verlangt eine Kreatur.' };
  const r = ctx.state.rpg;
  if (r.run) return { ok: false, reason: 'Während eines Laufs nicht möglich.' };
  const item = r.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'Diese Ausrüstung besitzt du nicht.' };
  if (Object.values(r.equipped).includes(itemId)) return { ok: false, reason: 'Lege sie zuerst ab.' };
  if (!itemCandidates(ctx, offer).includes(item)) return { ok: false, reason: 'Diese Ausrüstung erfüllt den Auftrag nicht.' };
  r.items = r.items.filter((i) => i !== item);
  completeOffer(ctx, offer, null);
  return { ok: true };
}

/** Creatures currently on loan: who, to which client, and how long until they are back. */
export function activeLoans(ctx: GameContext): { creature: Creature; client: string; remainingMs: number }[] {
  const out: { creature: Creature; client: string; remainingMs: number }[] = [];
  for (const p of ctx.state.processes) {
    if (p.kind !== CONTRACT_LOAN) continue;
    const d = p.data as ContractLoanData;
    const c = findCreature(ctx, d.creatureId);
    if (!c) continue;
    const client = ctx.content.contracts.has(d.template) ? ctx.content.contracts.get(d.template).client : '';
    out.push({ creature: c, client, remainingMs: processRemainingMs(ctx, p) });
  }
  return out;
}

registerProcessHandler(CONTRACT_LOAN, {
  complete(ctx, proc) {
    const c = findCreature(ctx, (proc.data as ContractLoanData).creatureId);
    if (c?.job?.kind === 'mission' && c.job.target === String(proc.id)) c.job = null;
    ctx.invalidate();
  },
});
// A loaned creature is not at home: like travellers, it and its loan survive an inheritance.
registerResetSurvivor((_ctx, p) => p.kind === CONTRACT_LOAN);

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
    case 'rpgLevel':
      return `GenLab-RPG-Stufe ${req.level} oder höher`;
    case 'item':
      return `${SLOT_LABEL[req.slot] ?? 'Ausrüstung'} ab ${ctx.content.rarities.get(req.minRarity).name}`;
  }
}
