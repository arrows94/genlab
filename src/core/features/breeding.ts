import { D } from '../num';
import { inheritAbilities } from '../abilities';
import { createCreature, creatureModifiers, findCreature } from '../creatures';
import { inheritGenome } from '../genetics';
import { trySpend } from '../resources';
import { registerProcessHandler, startProcess } from '../systems/processes';
import type { Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Appearance, Creature, StatBlock } from '../state';

export const EGG = 'egg';

export interface EggData extends Record<string, unknown> {
  parents: [number, number];
  generation: number;
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

export function mutationChance(ctx: GameContext): number {
  return Math.min(1, Math.max(0, ctx.mods().apply('breeding.mutation', ctx.balance.breeding.mutationChance)));
}

export function canBreed(ctx: GameContext, a: Creature | undefined, b: Creature | undefined): ActionResult {
  if (!ctx.state.features['breeding']) return { ok: false, reason: 'Die Brutstation ist noch nicht freigeschaltet.' };
  if (!a || !b) return { ok: false, reason: 'Wähle zwei Kreaturen.' };
  if (a.id === b.id) return { ok: false, reason: 'Wähle zwei verschiedene Kreaturen.' };
  // Working creatures are pulled from their building automatically.
  if ((a.job && a.job.kind !== 'building') || (b.job && b.job.kind !== 'building')) return { ok: false, reason: 'Beide Kreaturen müssen frei sein.' };
  if (eggs(ctx).length >= nestSlots(ctx)) return { ok: false, reason: 'Alle Nester sind belegt.' };
  return { ok: true };
}

export function startBreeding(ctx: GameContext, aId: number, bId: number): ActionResult {
  const a = findCreature(ctx, aId);
  const b = findCreature(ctx, bId);
  const check = canBreed(ctx, a, b);
  if (!check.ok) return check;
  const generation = offspringGeneration(a, b);
  if (!trySpend(ctx, breedingCost(ctx, generation))) return { ok: false, reason: 'Nicht genug Ressourcen.' };
  const data: EggData = { parents: [aId, bId], generation };
  const proc = startProcess(ctx, EGG, breedingTimeMs(ctx, generation, [a, b]), data);
  a!.job = { kind: 'nest', target: String(proc.id) };
  b!.job = { kind: 'nest', target: String(proc.id) };
  ctx.invalidate();
  return { ok: true };
}

/** Species of the offspring: a matching hybrid recipe (if unlocked) or one of the parents. */
export function offspringSpecies(ctx: GameContext, a: Creature, b: Creature): string {
  if (ctx.state.features['hybrids']) {
    for (const r of ctx.content.recipes.list) {
      const [p1, p2] = r.parents;
      const match = (a.speciesId === p1 && b.speciesId === p2) || (a.speciesId === p2 && b.speciesId === p1);
      if (!match) continue;
      const req = r.requires;
      if (req?.minGeneration && Math.min(a.generation, b.generation) < req.minGeneration) continue;
      if (req?.minRarity) {
        const min = ctx.content.rarities.get(req.minRarity).order;
        if (ctx.content.rarities.get(a.rarity).order < min || ctx.content.rarities.get(b.rarity).order < min) continue;
      }
      if (ctx.rng.chance(r.chance)) return r.result;
    }
  }
  return ctx.rng.chance(0.5) ? a.speciesId : b.speciesId;
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

registerProcessHandler(EGG, {
  complete(ctx, proc) {
    const data = proc.data as EggData;
    const [a, b] = data.parents.map((id) => findCreature(ctx, id));
    for (const p of [a, b]) if (p?.job?.kind === 'nest') p.job = null;
    if (!a || !b) return; // parents vanished (should not happen) – egg is lost
    const mutation = mutationChance(ctx);
    const child = createCreature(ctx, {
      speciesId: offspringSpecies(ctx, a, b),
      generation: data.generation,
      parents: data.parents,
      stats: inheritStats(ctx, a, b, mutation),
      exactStats: true,
      appearance: inheritAppearance(ctx, a, b),
      abilities: inheritAbilities(ctx, a.abilities, b.abilities, mutation),
      genome: inheritGenome(ctx, a.genome, b.genome, mutation),
      source: 'hatch',
    });
    ctx.bus.emit('eggHatched', { creatureId: child.id, parents: data.parents });
  },
});
