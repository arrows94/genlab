import { D } from '../num';
import { inheritAbilities } from '../abilities';
import { createCreature, creatureModifiers, creaturePower, findCreature, inheritLatent } from '../creatures';
import { inheritGenome } from '../genetics';
import { checkCondition } from '../conditions';
import { rarityWeights, rollRarity } from '../rarity';
import type { BreedingRitualDef } from '../content/types';
import { averageBase, reprofileStats, rollOffspringSpecies } from './hybrids';
import { stableFree } from './stable';
import { lineageDepth, recordLineage } from './dynasty';
import { childGivenName, foundFamily } from '../names';
import { trySpend } from '../resources';
import { registerProcessHandler, startProcess } from '../systems/processes';
import type { Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { AncestorInfo, Appearance, Creature, StatBlock } from '../state';

export const EGG = 'egg';

export interface EggData extends Record<string, unknown> {
  parents: [number, number];
  generation: number;
  /** Besondere Brut: ritual id (missing = normal egg). */
  ritual?: string;
  /** Ritual eggs: Keimprobe – the parents as they were when the ritual began (they stay free). */
  sample?: [Creature, Creature];
}

export function nestSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.nest', ctx.balance.breeding.baseNests));
}

/** Places in the Ritualnest (Besondere Brut runs there, next to the normal nests). */
export function ritualNestSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.ritualNest', ctx.balance.breeding.ritualNests));
}

/** Every egg, normal and ritual. */
export function eggs(ctx: GameContext) {
  return ctx.state.processes.filter((p) => p.kind === EGG);
}

/** Eggs in the normal nests. */
export function nestEggs(ctx: GameContext) {
  return eggs(ctx).filter((p) => !(p.data as EggData).ritual);
}

/** Eggs in the Ritualnest. */
export function ritualEggs(ctx: GameContext) {
  return eggs(ctx).filter((p) => !!(p.data as EggData).ritual);
}

export function offspringGeneration(a: Creature | undefined, b: Creature | undefined): number {
  return Math.max(a?.generation ?? 1, b?.generation ?? 1) + 1;
}

/**
 * Cost mainly grows with the offspring's generation (deeper lines cost
 * more) and mildly with the number of creatures owned.
 */
export function breedingCost(ctx: GameContext, generation = 2): Cost {
  const owned = Math.max(1, ctx.state.creatures.length);
  const discount = ctx.mods().factor('cost.breeding');
  const cost: Cost = {};
  for (const c of ctx.balance.breeding.costs) {
    if (generation < c.fromGeneration) continue;
    cost[c.resource] = D(c.base)
      .mul(D(c.generationGrowth).pow(generation - 2))
      .mul(D(c.creatureGrowth).pow(owned - 1))
      .mul(discount)
      .ceil();
  }
  return cost;
}

/** Breeding time; parents' own `breeding.time` modifiers (e.g. fertility genes) apply too. */
export function breedingTimeMs(ctx: GameContext, generation: number, parents: (Creature | undefined)[] = []): number {
  const b = ctx.balance.breeding;
  let seconds = ctx.mods().apply('breeding.time', b.baseTimeSec * (1 + b.timePerGeneration * (generation - 1)));
  for (const p of parents) {
    if (!p) continue;
    // creatureModifiers only carries global stat.* targets, so this is the parent's own share.
    seconds *= creatureModifiers(ctx, p).factor('breeding.time');
  }
  return Math.max(1000, seconds * 1000);
}

export function mutationChance(ctx: GameContext, ritual?: BreedingRitualDef): number {
  return Math.min(1, Math.max(0, ctx.mods().apply('breeding.mutation', ctx.balance.breeding.mutationChance) + (ritual?.mutationAdd ?? 0)));
}

/** Rituals the player can use right now (Besondere Brut). */
export function availableRituals(ctx: GameContext): BreedingRitualDef[] {
  if (!ctx.state.features['specialBreeding']) return [];
  return ctx.content.breedingRituals.list.filter((r) => !r.requires || checkCondition(ctx.state, r.requires));
}

/** Rarity weights for an egg: a ritual boosts rare+ and cuts everything below its minimum. */
export function eggRarityWeights(ctx: GameContext, ritual?: BreedingRitualDef): Record<string, number> {
  const base = rarityWeights(ctx.content, ctx.balance, ctx.mods());
  if (!ritual) return base;
  const floor = ritual.minRarity ? ctx.content.rarities.get(ritual.minRarity).order : 0;
  const rare = ctx.content.rarities.get('rare').order;
  const out: Record<string, number> = {};
  for (const [id, w] of Object.entries(base)) {
    const order = ctx.content.rarities.get(id).order;
    if (order < floor) continue;
    out[id] = order >= rare ? w * (1 + (ritual.rarityBoost ?? 0)) : w;
  }
  return Object.values(out).some((w) => w > 0) ? out : { [ritual.minRarity ?? 'common']: 1 };
}

/** One rarity step up (the highest stays). */
export function nextRarity(ctx: GameContext, id: string): string {
  const order = ctx.content.rarities.get(id).order;
  const higher = ctx.content.rarities.list.filter((r) => r.order > order).sort((a, b) => a.order - b.order);
  return higher[0]?.id ?? id;
}

/**
 * Rarity of a hatchling; undefined = rolled by `createCreature` as usual.
 * Äon talent „Aufstrebende Brut“ may lift it one step.
 */
function hatchRarity(ctx: GameContext, ritual?: BreedingRitualDef): string | undefined {
  const up = Math.min(1, ctx.mods().apply('breeding.rarityUp', 0));
  if (!ritual && up <= 0) return undefined;
  const rarity = rollRarity(ctx.rng, ritual ? eggRarityWeights(ctx, ritual) : rarityWeights(ctx.content, ctx.balance, ctx.mods()));
  return up > 0 && ctx.rng.chance(up) ? nextRarity(ctx, rarity) : rarity;
}

/** Normal cost plus the ritual's extra cost. */
export function eggCost(ctx: GameContext, generation: number, ritual?: BreedingRitualDef): Cost {
  const cost = breedingCost(ctx, generation);
  for (const [res, amount] of Object.entries(ritual?.cost ?? {})) cost[res] = (cost[res] ?? D(0)).add(amount);
  return cost;
}

export function eggTimeMs(ctx: GameContext, generation: number, parents: (Creature | undefined)[], ritual?: BreedingRitualDef): number {
  return ritual ? ritual.hours * 3_600_000 : breedingTimeMs(ctx, generation, parents);
}

export function canBreed(ctx: GameContext, a: Creature | undefined, b: Creature | undefined, ritual?: BreedingRitualDef): ActionResult {
  if (!ctx.state.features['breeding']) return { ok: false, reason: 'Die Brutstation ist noch nicht freigeschaltet.' };
  if (!a || !b) return { ok: false, reason: 'Wähle zwei Kreaturen.' };
  if (a.id === b.id) return { ok: false, reason: 'Wähle zwei verschiedene Kreaturen.' };
  // Working creatures are pulled from their building automatically.
  if ((a.job && a.job.kind !== 'building') || (b.job && b.job.kind !== 'building')) return { ok: false, reason: 'Beide Kreaturen müssen frei sein.' };
  if (ritual) {
    if (ritualEggs(ctx).length >= ritualNestSlots(ctx)) return { ok: false, reason: 'Das Ritualnest ist belegt.' };
  } else if (nestEggs(ctx).length >= nestSlots(ctx)) return { ok: false, reason: 'Alle Nester sind belegt.' };
  if (stableFree(ctx) <= 0) return { ok: false, reason: 'Der Stall ist voll.' };
  return { ok: true };
}

export function startBreeding(ctx: GameContext, aId: number, bId: number, ritualId?: string): ActionResult {
  const a = findCreature(ctx, aId);
  const b = findCreature(ctx, bId);
  const ritual = ritualId ? availableRituals(ctx).find((r) => r.id === ritualId) : undefined;
  if (ritualId && !ritual) return { ok: false, reason: 'Dieses Brutritual ist nicht verfügbar.' };
  const check = canBreed(ctx, a, b, ritual);
  if (!check.ok) return check;
  const generation = offspringGeneration(a, b);
  if (!trySpend(ctx, eggCost(ctx, generation, ritual))) return { ok: false, reason: 'Nicht genug Ressourcen.' };
  const data: EggData = { parents: [aId, bId], generation };
  if (ritual) {
    // A ritual only needs a Keimprobe: the parents stay free for everything else.
    data.ritual = ritual.id;
    data.sample = [structuredClone(a!), structuredClone(b!)];
  }
  const proc = startProcess(ctx, EGG, eggTimeMs(ctx, generation, [a, b], ritual), data);
  if (!ritual) {
    a!.job = { kind: 'nest', target: String(proc.id) };
    b!.job = { kind: 'nest', target: String(proc.id) };
  }
  ctx.invalidate();
  return { ok: true };
}


/**
 * Averaged parent stats with variance; mutated stats get an extra multiplier.
 * `breeding.statBonus` is deliberately not baked in here: it would compound
 * every generation. It applies on top instead (see `creatureOwnModifiers`).
 */
export function inheritStats(ctx: GameContext, a: Creature, b: Creature, mutation: number): StatBlock {
  const { balance, rng } = ctx;
  const out: StatBlock = {};
  const [lo, hi] = balance.breeding.mutationStatRange;
  for (const s of ctx.content.stats.list) {
    let value = (((a.stats[s.id] ?? 0) + (b.stats[s.id] ?? 0)) / 2) * rng.range(1 - balance.creature.statVariance, 1 + balance.creature.statVariance);
    if (rng.chance(mutation)) value *= rng.range(lo, hi);
    out[s.id] = Math.max(1, Math.round(value));
  }
  return out;
}

export function inheritAppearance(ctx: GameContext, a: Creature, b: Creature): Appearance {
  const { balance, rng } = ctx;
  const trait = <K extends 'pattern' | 'eyes' | 'horn'>(key: K, options: string[]) =>
    rng.chance(balance.appearance.mutationChance) ? rng.pick(options) : rng.chance(0.5) ? a.appearance[key] : b.appearance[key];
  // Average hues on the colour circle.
  const diff = ((b.appearance.hue - a.appearance.hue + 540) % 360) - 180;
  const hue = Math.round((a.appearance.hue + diff / 2 + rng.range(-8, 8) + 360) % 360);
  return {
    hue,
    pattern: trait('pattern', balance.appearance.patterns),
    eyes: trait('eyes', balance.appearance.eyes),
    horn: trait('horn', balance.appearance.horns),
  };
}

/**
 * Family of a child: the stronger parent's, else the other one's. Without any,
 * the stronger parent founds a family (named after its element) and carries
 * it from now on, so its later children share it.
 */
function inheritFamily(ctx: GameContext, a: Creature, b: Creature): string {
  const [strong, weak] = creaturePower(ctx, a) >= creaturePower(ctx, b) ? [a, b] : [b, a];
  const known = strong.family ?? weak.family;
  if (known) return known;
  const family = foundFamily(ctx, ctx.content.species.get(strong.speciesId).element);
  const founder = findCreature(ctx, strong.id);
  if (founder && !founder.family) founder.family = family;
  return family;
}

/** Pedigree snapshot: the creature plus its own parents (grandparents of the child). */
function snapshot(c: Creature): AncestorInfo {
  return {
    name: c.name,
    speciesId: c.speciesId,
    rarity: c.rarity,
    generation: c.generation,
    parents: c.ancestry?.map((p) => ({ ...p, parents: null })) ?? null,
  };
}

registerProcessHandler(EGG, {
  complete(ctx, proc) {
    const data = proc.data as EggData;
    const live = data.parents.map((id) => findCreature(ctx, id));
    for (const p of live) if (p?.job?.kind === 'nest' && p.job.target === String(proc.id)) p.job = null;
    // Ritual eggs hatch from their Keimprobe, normal eggs from the parents in the nest.
    const [a, b] = data.sample ?? live;
    if (!a || !b) return; // parents vanished (should not happen) – egg is lost
    const ritual = data.ritual && ctx.content.breedingRituals.has(data.ritual) ? ctx.content.breedingRituals.get(data.ritual) : undefined;
    const mutation = mutationChance(ctx, ritual);
    const speciesId = rollOffspringSpecies(ctx, a, b, ritual?.hybridMult ?? 1, ritual?.guaranteedHybrid ?? false);
    // Normal eggs roll their rarity in createCreature; a ritual rolls from its own weights.
    const rarity = hatchRarity(ctx, ritual);
    let stats = inheritStats(ctx, a, b, mutation);
    // A new species (hybrid) takes on its own stat profile.
    if (speciesId !== a.speciesId && speciesId !== b.speciesId) stats = reprofileStats(ctx, stats, averageBase(ctx, a.speciesId, b.speciesId), speciesId);
    const family = inheritFamily(ctx, a, b);
    const nameFor = () => `${childGivenName(ctx, a, b, family)} ${family}`;
    const lineage = lineageDepth(ctx, speciesId, a, b);
    const child = createCreature(ctx, {
      speciesId,
      rarity,
      latent: inheritLatent(ctx, a, b, ctx.state.nextId),
      name: nameFor(),
      generation: data.generation,
      parents: data.parents,
      stats,
      exactStats: true,
      appearance: inheritAppearance(ctx, a, b),
      abilities: inheritAbilities(ctx, a.abilities, b.abilities, mutation),
      genome: inheritGenome(ctx, a.genome, b.genome, mutation),
      ancestry: [snapshot(a), snapshot(b)],
      lineage,
      family,
      source: 'hatch',
    });
    recordLineage(ctx, child);
    ctx.bus.emit('eggHatched', { creatureId: child.id, parents: data.parents });

    // Twin births (Äon talent): a second child from the same parents, if the stable has room.
    const twinChance = Math.min(1, ctx.mods().apply('breeding.twinChance', 0));
    if (twinChance > 0 && stableFree(ctx) > 0 && ctx.rng.chance(twinChance)) {
      const twin = createCreature(ctx, {
        speciesId,
        rarity: hatchRarity(ctx, ritual),
        latent: inheritLatent(ctx, a, b, ctx.state.nextId),
        name: nameFor(),
        generation: data.generation,
        parents: data.parents,
        stats: inheritStats(ctx, a, b, mutation),
        exactStats: true,
        appearance: inheritAppearance(ctx, a, b),
        abilities: inheritAbilities(ctx, a.abilities, b.abilities, mutation),
        genome: inheritGenome(ctx, a.genome, b.genome, mutation),
        ancestry: [snapshot(a), snapshot(b)],
        lineage,
        family,
        source: 'hatch',
      });
      ctx.bus.emit('eggHatched', { creatureId: twin.id, parents: data.parents });
    }
  },
});
