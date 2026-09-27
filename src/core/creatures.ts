import { ModifierSet, type SourcedModifier } from './modifiers';
import type { GameContext } from './context';
import { dexKey, type Creature, type StatBlock } from './state';

export interface CreateCreatureOptions {
  speciesId: string;
  rarity: string;
  generation?: number;
  parents?: [number, number] | null;
  stats?: StatBlock;
  abilities?: string[];
  source?: 'start' | 'hatch' | 'wild' | 'capsule' | 'other';
}

/** Creates a creature with rolled stats/appearance and registers it (dex, events). */
export function createCreature(ctx: GameContext, opts: CreateCreatureOptions): Creature {
  const { content, balance, rng, state } = ctx;
  const species = content.species.get(opts.speciesId);
  content.rarities.get(opts.rarity);

  const stats: StatBlock = {};
  for (const stat of content.stats.list) {
    const base = opts.stats?.[stat.id] ?? species.baseStats[stat.id] ?? 0;
    const variance = balance.creature.statVariance;
    stats[stat.id] = Math.max(1, Math.round(base * rng.range(1 - variance, 1 + variance)));
  }

  const hueShift = rng.range(-balance.creature.hueVariance, balance.creature.hueVariance);
  const creature: Creature = {
    id: state.nextId++,
    speciesId: species.id,
    name: species.name,
    rarity: opts.rarity,
    generation: opts.generation ?? 1,
    stats,
    appearance: {
      hue: Math.round((species.hue + hueShift + 360) % 360),
      pattern: rng.pick(balance.appearance.patterns),
      eyes: rng.pick(balance.appearance.eyes),
      horn: rng.pick(balance.appearance.horns),
    },
    abilities: opts.abilities ?? [],
    genome: null,
    sequenced: false,
    parents: opts.parents ?? null,
    job: null,
    locked: false,
    bornAt: state.simTimeMs,
  };
  state.creatures.push(creature);
  registerDex(ctx, creature.speciesId, creature.rarity);
  ctx.invalidate();
  ctx.bus.emit('creatureAdded', { creatureId: creature.id, source: opts.source ?? 'other' });
  return creature;
}

export function registerDex(ctx: GameContext, species: string, rarity: string): boolean {
  const key = dexKey(species, rarity);
  if (ctx.state.dex[key]) return false;
  ctx.state.dex[key] = true;
  ctx.invalidate();
  ctx.bus.emit('dexDiscovered', { species, rarity });
  return true;
}

export function findCreature(ctx: GameContext, id: number): Creature | undefined {
  return ctx.state.creatures.find((c) => c.id === id);
}

/** Modifiers that apply to one creature only (self abilities, creature buffs, alleles). */
export function creatureOwnModifiers(ctx: GameContext, c: Creature): SourcedModifier[] {
  const out: SourcedModifier[] = [];
  for (const id of c.abilities) {
    if (!ctx.content.abilities.has(id)) continue;
    const def = ctx.content.abilities.get(id);
    if (def.scope === 'global') continue;
    for (const m of def.modifiers) out.push({ ...m, source: `ability:${id}` });
  }
  for (const buff of ctx.state.buffs) {
    if (buff.creatureId === c.id) for (const m of buff.modifiers) out.push({ ...m, source: `buff:${buff.source}` });
  }
  if (c.genome) {
    for (const [locusId, pair] of Object.entries(c.genome)) {
      if (!ctx.content.genes.has(locusId)) continue;
      const locus = ctx.content.genes.get(locusId);
      for (const alleleId of pair) {
        const allele = locus.alleles.find((a) => a.id === alleleId);
        // Each allele contributes half; expression rules are refined in the genetics phase.
        if (allele) for (const m of allele.modifiers) out.push({ ...m, value: m.op === 'mult' ? Math.sqrt(m.value) : m.value / 2, source: `gene:${locusId}` });
      }
    }
  }
  return out;
}

/** Combined modifier set for a creature: global + its own. */
export function creatureModifiers(ctx: GameContext, c: Creature): ModifierSet {
  const global = ctx.mods();
  const set = new ModifierSet(creatureOwnModifiers(ctx, c));
  for (const target of global.targets()) {
    if (target.startsWith('stat.') || target.startsWith('creature.')) for (const m of global.list(target)) set.push(m);
  }
  return set;
}

/** Final stats: base × rarity multiplier, then `stat.<id>` modifiers. */
export function effectiveStats(ctx: GameContext, c: Creature): StatBlock {
  const mods = creatureModifiers(ctx, c);
  const rarityMult = ctx.balance.rarity.statMultiplier[c.rarity] ?? 1;
  const out: StatBlock = {};
  for (const stat of ctx.content.stats.list) {
    out[stat.id] = Math.round(mods.apply(`stat.${stat.id}`, (c.stats[stat.id] ?? 0) * rarityMult));
  }
  return out;
}

export function isBusy(c: Creature): boolean {
  return c.job !== null;
}
