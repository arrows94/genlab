import { D, type Decimal } from './num';
import { createCreature } from './creatures';
import { grant } from './resources';
import { checkUnlocks, unlockFeature } from './systems/unlocks';
import type { PrestigeLayerDef } from './content/types';
import type { GameContext } from './context';
import type { ActionResult } from './actions';

/**
 * Currency gained by resetting now:
 * floor((Σ source / divisor)^exponent) × `prestige.<layer>.gain`.
 * Source is "earned this run" or, for layers like Äon, "currently owned".
 */
export function prestigeGain(ctx: GameContext, layerId: string): Decimal {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const tuning = ctx.balance.prestige[layerId];
  if (!tuning) throw new Error(`balance.prestige.${layerId} fehlt`);
  const source = layer.gainSource === 'owned' ? ctx.state.resources : ctx.state.earned;
  let total = D(0);
  for (const res of layer.gainFrom) total = total.add(source[res] ?? D(0));
  const raw = total.div(tuning.divisor).pow(tuning.exponent).mul(ctx.mods().factor(`prestige.${layerId}.gain`)).floor();
  return raw.gte(tuning.minGain) ? raw : D(0);
}

/**
 * Applies a layer's reset (what survives is data: `PrestigeLayerDef.resets`),
 * then restores what talents guarantee and gives a fresh start creature.
 * Used by prestige layers and by starting an anomaly.
 */
export function resetLayer(ctx: GameContext, layer: PrestigeLayerDef): void {
  const s = ctx.state;
  const r = layer.resets;
  for (const res of r.resources) s.resources[res] = D(ctx.balance.start.resources[res] ?? 0);
  s.earned = {};
  if (r.creatures) {
    s.creatures = [];
    s.tower.run = null;
    s.tower.team = [];
  }
  if (r.processes) s.processes = [];
  if (r.buffs) s.buffs = [];
  if (r.dex) s.dex = {};
  if (r.features) s.features = {};
  for (const id of Object.keys(s.upgrades)) {
    const def = ctx.content.upgrades.has(id) ? ctx.content.upgrades.get(id) : null;
    if (def && r.upgradeCategories.includes(def.category)) delete s.upgrades[id];
  }
  ctx.invalidate();
  applyTalentGuarantees(ctx);
  if (s.creatures.length === 0) {
    createCreature(ctx, { speciesId: ctx.balance.start.species, rarity: ctx.balance.start.rarity, source: 'start' });
  }
}

/** Talent effects that must survive resets: permanent features and start resources. */
export function applyTalentGuarantees(ctx: GameContext): void {
  for (const t of ctx.content.talents.list) {
    if (!ctx.state.talents[t.id]) continue;
    t.unlocksFeatures?.forEach((f) => unlockFeature(ctx, f));
    for (const [res, amount] of Object.entries(t.onReset ?? {})) grant(ctx, res, amount, `talent:${t.id}`);
  }
}

export function performPrestige(ctx: GameContext, layerId: string): ActionResult {
  const layer = ctx.content.prestigeLayers.get(layerId);
  if (!ctx.state.features[layer.feature]) return { ok: false, reason: 'Noch nicht freigeschaltet.' };
  if (ctx.state.anomaly) return { ok: false, reason: 'Während einer Anomalie nicht möglich.' };
  const gain = prestigeGain(ctx, layerId);
  if (gain.lte(0)) return { ok: false, reason: 'Noch kein Gewinn möglich.' };

  resetLayer(ctx, layer);
  ctx.state.prestige[layerId] = { count: (ctx.state.prestige[layerId]?.count ?? 0) + 1 };
  grant(ctx, layer.currency, gain, `prestige:${layerId}`);
  ctx.invalidate();
  ctx.bus.emit('prestige', { layer: layerId, gain });
  checkUnlocks(ctx);
  return { ok: true };
}
