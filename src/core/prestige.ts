import { D, type Decimal } from './num';
import { createCreature } from './creatures';
import { grant } from './resources';
import { checkUnlocks } from './systems/unlocks';
import type { GameContext } from './context';
import type { ActionResult } from './actions';

/** Currency gained by resetting now: floor((Σ earned / divisor)^exponent) × modifiers. */
export function prestigeGain(ctx: GameContext, layerId: string): Decimal {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const tuning = ctx.balance.prestige[layerId];
  if (!tuning) throw new Error(`balance.prestige.${layerId} fehlt`);
  let total = D(0);
  for (const res of layer.gainFrom) total = total.add(ctx.state.earned[res] ?? D(0));
  const raw = total.div(tuning.divisor).pow(tuning.exponent).mul(ctx.mods().factor(`prestige.${layerId}.gain`)).floor();
  return raw.gte(tuning.minGain) ? raw : D(0);
}

/**
 * Resets everything the layer's `resets` config lists and awards the
 * currency. What survives is purely data (see `PrestigeLayerDef.resets`).
 */
export function performPrestige(ctx: GameContext, layerId: string): ActionResult {
  const layer = ctx.content.prestigeLayers.get(layerId);
  if (!ctx.state.features[layer.feature]) return { ok: false, reason: 'Noch nicht freigeschaltet.' };
  const gain = prestigeGain(ctx, layerId);
  if (gain.lte(0)) return { ok: false, reason: 'Noch kein Gewinn möglich.' };

  const s = ctx.state;
  const r = layer.resets;
  for (const res of r.resources) s.resources[res] = D(ctx.balance.start.resources[res] ?? 0);
  s.earned = {};
  if (r.creatures) s.creatures = [];
  if (r.processes) s.processes = [];
  if (r.buffs) s.buffs = [];
  if (r.dex) s.dex = {};
  if (r.features) s.features = {};
  for (const id of Object.keys(s.upgrades)) {
    const def = ctx.content.upgrades.has(id) ? ctx.content.upgrades.get(id) : null;
    if (def && r.upgradeCategories.includes(def.category)) delete s.upgrades[id];
  }
  s.prestige[layerId] = { count: (s.prestige[layerId]?.count ?? 0) + 1 };
  ctx.invalidate();

  grant(ctx, layer.currency, gain, `prestige:${layerId}`);
  if (s.creatures.length === 0) {
    createCreature(ctx, { speciesId: ctx.balance.start.species, rarity: ctx.balance.start.rarity, source: 'start' });
  }
  ctx.bus.emit('prestige', { layer: layerId, gain });
  checkUnlocks(ctx);
  return { ok: true };
}
