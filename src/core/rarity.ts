import type { Balance } from './content/balance';
import type { ContentDB } from './content/types';
import type { ModifierSet } from './modifiers';
import type { Rng } from './rng';

/** Effective drop weights per rarity after `rarity.weight.<id>` modifiers. */
export function rarityWeights(content: ContentDB, balance: Balance, mods: ModifierSet): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of content.rarities.list) {
    out[r.id] = Math.max(0, mods.apply(`rarity.weight.${r.id}`, balance.rarity.weights[r.id] ?? 0));
  }
  return out;
}

/** Probability per rarity (0–1), for displaying odds openly. */
export function rarityChances(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [id, w] of Object.entries(weights)) out[id] = total > 0 ? w / total : 0;
  return out;
}

export function rollRarity(rng: Rng, weights: Record<string, number>): string {
  return rng.weighted(weights);
}

export function rarityOrder(content: ContentDB, id: string): number {
  return content.rarities.get(id).order;
}
