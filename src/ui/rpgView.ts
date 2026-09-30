import { content } from '@content/index';
import { formatPercent } from '@core/format';
import { ALLELE_SAMPLES } from '@core/features/rpg';
import { itemValues } from '@core/features/rpgCombat';
import type { Game } from '@core/game';
import type { RpgCombatant, RpgItem, RpgStatus } from '@core/state';

/** Shared display helpers of the GenLab RPG (lab screen and the other world). */

export const STATUS_ICON: Record<RpgStatus['id'], string> = {
  burn: '🔥', poison: '☠️', stun: '💫', slow: '🐌', shield: '🛡️', evade: '🌬️', regen: '🌿', armor: '🪨', reflect: '💎',
};
export const STATUS_NAME: Record<RpgStatus['id'], string> = {
  burn: 'Brand', poison: 'Gift', stun: 'Betäubt', slow: 'Verlangsamt', shield: 'Schild', evade: 'Ausweichen', regen: 'Regeneration', armor: 'Panzerung', reflect: 'Rückstrahlung',
};

const VALUE_NAME: Record<string, string> = {
  hp: 'KP', atk: 'ANG', def: 'VER', spd: 'TMP', specialPower: 'Spezialangriff', chargePerRound: 'Aufladen je Runde', lifesteal: 'Lebensraub', crit: 'Krit-Chance', regen: 'KP je Runde',
};

/** „+12 % ANG · 4 % Krit-Chance“ */
export function itemText(game: Game, item: RpgItem): string {
  const v = itemValues(game, item);
  return [
    ...Object.entries(v.stats).map(([k, x]) => `+${formatPercent(x ?? 0, 0)} ${VALUE_NAME[k]}`),
    ...Object.entries(v.perks).map(([k, x]) => `${k === 'specialPower' ? '+' : ''}${formatPercent(x ?? 0, 1)} ${VALUE_NAME[k]}`),
  ].join(' · ');
}

export const rarityOf = (item: RpgItem) => content.rarities.get(item.rarity);
export const gearOf = (item: RpgItem) => content.rpgGear.get(item.gear);

export function lootList(loot: Record<string, number>): { icon: string; name: string; amount: number }[] {
  return Object.entries(loot).map(([res, amount]) =>
    res === ALLELE_SAMPLES ? { icon: '🧬', name: 'Genprobe', amount } : { icon: content.resources.get(res).icon, name: content.resources.get(res).name, amount },
  );
}

/** Width of a bar filled `a` of `b`. */
export const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;

/** Artwork of a foe: its species' colours with a fierce look. */
export function speciesLook(c: RpgCombatant) {
  const sp = content.species.get(c.speciesId);
  return { appearance: { hue: sp.hue, pattern: 'none', eyes: 'sharp', horn: 'none' }, shape: sp.shape, tier: sp.tier };
}
