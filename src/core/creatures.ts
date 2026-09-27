import { ModifierSet, type SourcedModifier } from './modifiers';
import { rollStartingAbilities } from './abilities';
import { rarityWeights, rollRarity } from './rarity';
import { genomeModifiers, isPerfectGenome, rollGenome } from './genetics';
import type { GameContext } from './context';
import { dexKey, type AncestorInfo, type Appearance, type Creature, type Genome, type StatBlock } from './state';

export type CreatureSource = 'start' | 'hatch' | 'wild' | 'capsule' | 'other';

export interface CreateCreatureOptions {
  speciesId: string;
  /** Omitted → rolled with the current rarity weights. */
  rarity?: string;
  generation?: number;
  parents?: [number, number] | null;
  /** Base stats before variance; defaults to the species' base stats. */
  stats?: StatBlock;
  /** Skip the random variance (stats already rolled, e.g. by breeding). */
  exactStats?: boolean;
  appearance?: Appearance;
  /** Omitted → rolled starting abilities. */
  abilities?: string[];
  /** Omitted → rolled wild genome (hidden until sequenced). */
  genome?: Genome;
  ancestry?: AncestorInfo[] | null;
  /** Omitted → rolled with the (tiny) shiny chance. */
  shiny?: boolean;
  source?: CreatureSource;
}

export function rollAppearance(ctx: GameContext, speciesHue: number): Appearance {
  const { balance, rng } = ctx;
  const hueShift = rng.range(-balance.creature.hueVariance, balance.creature.hueVariance);
  return {
    hue: Math.round((speciesHue + hueShift + 360) % 360),
    pattern: rng.pick(balance.appearance.patterns),
    eyes: rng.pick(balance.appearance.eyes),
    horn: rng.pick(balance.appearance.horns),
  };
}

/** Creates a creature with rolled stats/appearance and registers it (dex, events). */
export function createCreature(ctx: GameContext, opts: CreateCreatureOptions): Creature {
  const { content, balance, rng, state } = ctx;
  const species = content.species.get(opts.speciesId);
  const rarity = opts.rarity ?? rollRarity(rng, rarityWeights(content, balance, ctx.mods()));
  content.rarities.get(rarity);

  const stats: StatBlock = {};
  for (const stat of content.stats.list) {
    const base = opts.stats?.[stat.id] ?? species.baseStats[stat.id] ?? 0;
    const variance = opts.exactStats ? 0 : balance.creature.statVariance;
    stats[stat.id] = Math.max(1, Math.round(base * rng.range(1 - variance, 1 + variance)));
  }

  const creature: Creature = {
    id: state.nextId++,
    speciesId: species.id,
    name: species.name,
    rarity,
    generation: opts.generation ?? 1,
    stats,
    appearance: opts.appearance ?? rollAppearance(ctx, species.hue),
    abilities: opts.abilities ?? rollStartingAbilities(ctx),
    genome: opts.genome ?? rollGenome(ctx),
    sequenced: false,
    splices: 0,
    shiny: opts.shiny ?? ctx.rng.chance(Math.min(1, ctx.mods().apply('creature.shinyChance', balance.perfection.shinyChance))),
    boosts: {},
    boostUses: 0,
    parents: opts.parents ?? null,
    ancestry: opts.ancestry ?? null,
    infusion: { level: 0, ep: 0 },
    job: null,
    locked: false,
    bornAt: state.simTimeMs,
  };
  state.creatures.push(creature);
  registerDex(ctx, creature.speciesId, creature.rarity);
  ctx.invalidate();
  ctx.bus.emit('creatureAdded', { creatureId: creature.id, source: opts.source ?? 'other' });
  checkPerfection(ctx, creature);
  return creature;
}

/**
 * Perfection hunt: records shiny creatures and (for sequenced creatures)
 * perfect genomes per species. Call after anything that changes a genome.
 */
export function checkPerfection(ctx: GameContext, c: Creature): void {
  const p = ctx.state.perfection;
  if (c.shiny && !p.shiny[c.speciesId]) {
    p.shiny[c.speciesId] = true;
    ctx.bus.emit('shiny', { creatureId: c.id, species: c.speciesId });
  }
  if (c.sequenced && !p.perfect[c.speciesId] && isPerfectGenome(ctx, c.genome)) {
    p.perfect[c.speciesId] = true;
    ctx.bus.emit('perfectGenome', { creatureId: c.id, species: c.speciesId });
  }
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

/** Modifiers that apply to one creature only (abilities, creature buffs, potion boosts, alleles). */
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
  for (const [stat, value] of Object.entries(c.boosts ?? {})) {
    if (value) out.push({ target: `stat.${stat}`, op: 'pct', value, source: 'boost' });
  }
  const infusionLevel = c.infusion?.level ?? 0;
  if (infusionLevel > 0) {
    for (const s of ctx.content.stats.list) out.push({ target: `stat.${s.id}`, op: 'pct', value: infusionLevel * ctx.balance.infusion.statPerLevel, source: 'infusion' });
  }
  if (c.genome) out.push(...genomeModifiers(ctx, c.genome));
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

/** Sum of effective stats – a simple "power" score for sorting and auto-assignment. */
export function creaturePower(ctx: GameContext, c: Creature): number {
  return Object.values(effectiveStats(ctx, c)).reduce((a, b) => a + b, 0);
}

export function isBusy(c: Creature): boolean {
  return c.job !== null;
}

export function removeCreature(ctx: GameContext, id: number, reason: string): void {
  ctx.state.creatures = ctx.state.creatures.filter((c) => c.id !== id);
  ctx.invalidate();
  ctx.bus.emit('creatureRemoved', { creatureId: id, reason });
}
