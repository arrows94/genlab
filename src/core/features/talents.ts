import { D } from '../num';
import { unlockFeature } from '../systems/unlocks';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { ModifierProvider } from '../providers';
import { ensureGenomes } from '../genetics';
import { checkCondition } from '../conditions';
import type { ResonanceDef } from '../content/types';

/**
 * Äon talent tree: bought with the Äon currency, never reset. Talents add
 * mechanics (twin births, extra gene loci, permanent automation, bigger
 * tower team …) rather than only percentages.
 */
export const AEON_CURRENCY = 'aeonShards';

/** Extra unlock (e.g. an Äon-Observatorium stage) is met. */
export function talentUnlocked(ctx: GameContext, id: string): boolean {
  const t = ctx.content.talents.get(id);
  return !t.unlock || checkCondition(ctx.state, t.unlock);
}

export function talentAvailable(ctx: GameContext, id: string): boolean {
  const t = ctx.content.talents.get(id);
  return talentUnlocked(ctx, id) && t.requires.every((r) => ctx.state.talents[r]);
}

export function buyTalent(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['aeon']) return { ok: false, reason: 'Das Äon ist noch nicht erreicht.' };
  const t = ctx.content.talents.get(id);
  if (ctx.state.talents[id]) return { ok: false, reason: 'Bereits gelernt.' };
  if (!talentUnlocked(ctx, id)) return { ok: false, reason: 'Diese Talentstufe ist noch versiegelt.' };
  if (!talentAvailable(ctx, id)) return { ok: false, reason: 'Erst die vorherigen Talente lernen.' };
  const owned = ctx.state.resources[AEON_CURRENCY] ?? D(0);
  if (owned.lt(t.cost)) return { ok: false, reason: 'Nicht genug Äon-Splitter.' };
  ctx.state.resources[AEON_CURRENCY] = owned.sub(t.cost);
  ctx.state.talents[id] = true;
  t.unlocksFeatures?.forEach((f) => unlockFeature(ctx, f));
  ctx.invalidate();
  // Talents can activate new gene loci.
  ensureGenomes(ctx);
  ctx.bus.emit('talentBought', { talent: id });
  return { ok: true };
}

export const talentProvider: ModifierProvider = (ctx, into) => {
  for (const t of ctx.content.talents.list) if (ctx.state.talents[t.id]) into.addAll(`talent:${t.id}`, t.modifiers);
};

/**
 * Resonanz: endless nodes for the shards left over once the tree is
 * complete. Costs grow geometrically, effects with `level^levelPower`.
 */
export function resonanceLevel(ctx: GameContext, id: string): number {
  return ctx.state.resonance[id] ?? 0;
}

export function resonanceCost(def: ResonanceDef, level: number): number {
  return Math.ceil(def.cost * Math.pow(def.costGrowth, level));
}

/** Effect scale at a level (1 at level 1, then diminishing). */
export function resonanceScale(def: ResonanceDef, level: number): number {
  return level > 0 ? Math.pow(level, def.levelPower) : 0;
}

export function resonanceAvailable(ctx: GameContext, def: ResonanceDef): boolean {
  return !!ctx.state.features['aeon'] && (!def.requires || checkCondition(ctx.state, def.requires));
}

export function buyResonance(ctx: GameContext, id: string): ActionResult {
  const def = ctx.content.resonances.get(id);
  if (!resonanceAvailable(ctx, def)) return { ok: false, reason: 'Die Resonanz ist noch nicht erwacht.' };
  const level = resonanceLevel(ctx, id);
  const cost = resonanceCost(def, level);
  const owned = ctx.state.resources[AEON_CURRENCY] ?? D(0);
  if (owned.lt(cost)) return { ok: false, reason: 'Nicht genug Äon-Splitter.' };
  ctx.state.resources[AEON_CURRENCY] = owned.sub(cost);
  ctx.state.resonance[id] = level + 1;
  ctx.invalidate();
  ctx.bus.emit('resonanceBought', { resonance: id, level: level + 1 });
  return { ok: true };
}

export const resonanceProvider: ModifierProvider = (ctx, into) => {
  for (const [id, level] of Object.entries(ctx.state.resonance)) {
    if (level > 0 && ctx.content.resonances.has(id)) {
      const def = ctx.content.resonances.get(id);
      into.addAll(`resonance:${id}`, def.modifiers, resonanceScale(def, level));
    }
  }
};
