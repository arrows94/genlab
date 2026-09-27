import { D } from '../num';
import { unlockFeature } from '../systems/unlocks';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { ModifierProvider } from '../providers';
import { ensureGenomes } from '../genetics';

/**
 * Äon talent tree: bought with the Äon currency, never reset. Talents add
 * mechanics (twin births, extra gene loci, permanent automation, bigger
 * tower team …) rather than only percentages.
 */
export const AEON_CURRENCY = 'aeonShards';

export function talentAvailable(ctx: GameContext, id: string): boolean {
  const t = ctx.content.talents.get(id);
  return t.requires.every((r) => ctx.state.talents[r]);
}

export function buyTalent(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['aeon']) return { ok: false, reason: 'Das Äon ist noch nicht erreicht.' };
  const t = ctx.content.talents.get(id);
  if (ctx.state.talents[id]) return { ok: false, reason: 'Bereits gelernt.' };
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
