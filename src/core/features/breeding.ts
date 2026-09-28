import { D } from '../num';
import { inheritAbilities } from '../abilities';
import { createCreature, creatureModifiers, findCreature, inheritLatent } from '../creatures';
import { inheritGenome } from '../genetics';
import { checkCondition } from '../conditions';
import { rarityWeights, rollRarity } from '../rarity';
import type { BreedingRitualDef } from '../content/types';
import { averageBase, reprofileStats, rollOffspringSpecies } from './hybrids';
import { stableFree } from './stable';
import { blendNames } from '../names';
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
}

export function nestSlots(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.nest', ctx.balance.breeding.baseNests));
}

export function eggs(ctx: GameContext) {
  return ctx.state.processes.filter((p) => p.kind === EGG);
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

/** Normal cost plus the ritual's extra cost. */
export function eggCost(ctx: GameContext, generation: number, ritual?: BreedingRitualDef): Cost {
  const cost = breedingCost(ctx, generation);
  for (const [res, amount] of Object.entries(ritual?.cost ?? {})) cost[res] = (cost[res] ?? D(0)).add(amount);
  return cost;
}

export function eggTimeMs(ctx: GameContext, generation: number, parents: (Creature | undefined)[], ritual?: BreedingRitualDef): number {
  return ritual ? ritual.hours * 3_600_000 : breedingTimeMs(ctx, generation, parents);
}

export function canBreed(ctx: GameContext, a: Creature | undefined, b: Creature | undefined): ActionResult {
  if (!ctx.state.features['breeding']) return { ok: false, reason: 'Die Brutstation ist noch nicht freigeschaltet.' };
  if (!a || !b) return { ok: false, reason: 'Wähle zwei Kreaturen.' };
  if (a.id === b.id) return { ok: false, reason: 'Wähle zwei verschiedene Kreaturen.' };
  // Working creatures are pulled from their building automatically.
  if ((a.job && a.job.kind !== 'building') || (b.job && b.job.kind !== 'building')) return { ok: false, reason: 'Beide Kreaturen müssen frei sein.' };
  if (eggs(ctx).length >= nestSlots(ctx)) return { ok: false, reason: 'Alle Nester sind belegt.' };
  if (stableFree(ctx) <= 0) return { ok: false, reason: 'Der Stall ist voll.' };
  return { ok: true };
}

export function startBreeding(ctx: GameContext, aId: number, bId: number, ritualId?: string): ActionResult {
  const a = findCreature(ctx, aId);
  const b = findCreature(ctx, bId);
  const check = canBreed(ctx, a, b);
  if (!check.ok) return check;
  const ritual = ritualId ? availableRituals(ctx).find((r) => r.id === ritualId) : undefined;
  if (ritualId && !ritual) return { ok: false, reason: 'Dieses Brutritual ist nicht verfügbar.' };
  const generation = offspringGeneration(a, b);
  if (!trySpend(ctx, eggCost(ctx, generation, ritual))) return { ok: false, reason: 'Nicht genug Ressourcen.' };
  const data: EggData = { parents: [aId, bId], generation, ...(ritual ? { ritual: ritual.id } : {}) };
  const proc = startProcess(ctx, EGG, eggTimeMs(ctx, generation, [a, b], ritual), data);
  a!.job = { kind: 'nest', target: String(proc.id) };
  b!.job = { kind: 'nest', target: String(proc.id) };
  ctx.invalidate();
  return { ok: true };
}


/** Averaged parent stats with variance; mutated stats get an extra multiplier. */
export function inheritStats(ctx: GameContext, a: Creature, b: Creature, mutation: number): StatBlock {
  const { balance, rng } = ctx;
  const out: StatBlock = {};
  const [lo, hi] = balance.breeding.mutationStatRange;
  const bonus = ctx.mods().apply('breeding.statBonus', 1);
  for (const s of ctx.content.stats.list) {
    let value = (((a.stats[s.id] ?? 0) + (b.stats[s.id] ?? 0)) / 2) * rng.range(1 - balance.creature.statVariance, 1 + balance.creature.statVariance);
    if (rng.chance(mutation)) value *= rng.range(lo, hi);
    out[s.id] = Math.max(1, Math.round(value * bonus));
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
    const [a, b] = data.parents.map((id) => findCreature(ctx, id));
    for (const p of [a, b]) if (p?.job?.kind === 'nest') p.job = null;
    if (!a || !b) return; // parents vanished (should not happen) – egg is lost
    const ritual = data.ritual && ctx.content.breedingRituals.has(data.ritual) ? ctx.content.breedingRituals.get(data.ritual) : undefined;
    const mutation = mutationChance(ctx, ritual);
    const speciesId = rollOffspringSpecies(ctx, a, b, ritual?.hybridMult ?? 1);
    // Normal eggs roll their rarity in createCreature; a ritual rolls from its own weights.
    const rarity = ritual ? rollRarity(ctx.rng, eggRarityWeights(ctx, ritual)) : undefined;
    let stats = inheritStats(ctx, a, b, mutation);
    // A new species (hybrid) takes on its own stat profile.
    if (speciesId !== a.speciesId && speciesId !== b.speciesId) stats = reprofileStats(ctx, stats, averageBase(ctx, a.speciesId, b.speciesId), speciesId);
    const nameFor = () => blendNames(ctx.rng, a.name, b.name, ctx.balance.creature.offspringName, ctx.content.species.get(speciesId).name);
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
      source: 'hatch',
    });
    ctx.bus.emit('eggHatched', { creatureId: child.id, parents: data.parents });

    // Twin births (Äon talent): a second child from the same parents, if the stable has room.
    const twinChance = Math.min(1, ctx.mods().apply('breeding.twinChance', 0));
    if (twinChance > 0 && stableFree(ctx) > 0 && ctx.rng.chance(twinChance)) {
      const twin = createCreature(ctx, {
        speciesId,
        rarity: ritual ? rollRarity(ctx.rng, eggRarityWeights(ctx, ritual)) : undefined,
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
        source: 'hatch',
      });
      ctx.bus.emit('eggHatched', { creatureId: twin.id, parents: data.parents });
    }
  },
});
