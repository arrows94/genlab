import { canAfford } from './costs';
import { nextUpgradeCost, upgradeAvailable } from './actions';
import type { GameContext } from './context';
import type { UpgradeDef } from './content/types';
import type { Creature } from './state';
import { creatureModifiers, creaturePower, effectiveStats } from './creatures';

/** Read-only helpers for the UI (keeps rules out of components). */

export function visibleUpgrades(ctx: GameContext, category: UpgradeDef['category'] = 'research'): UpgradeDef[] {
  return ctx.content.upgrades.list.filter((u) => u.category === category && upgradeAvailable(ctx, u.id));
}

export function affordableUpgradeCount(ctx: GameContext): number {
  return visibleUpgrades(ctx).filter((u) => {
    const cost = nextUpgradeCost(ctx, u.id);
    return cost !== null && canAfford(ctx.state, cost);
  }).length;
}

export function unlockedTabs(ctx: GameContext): string[] {
  const tabs: string[] = [];
  for (const f of ctx.content.features.list) {
    if (f.tab && ctx.state.features[f.id] && !tabs.includes(f.tab)) tabs.push(f.tab);
  }
  return tabs;
}

export function visibleResources(ctx: GameContext) {
  return ctx.content.resources.list.filter((r) => !r.feature || ctx.state.features[r.feature] || ctx.state.resources[r.id]?.gt(0));
}

export function dexCount(ctx: GameContext): { found: number; total: number } {
  return {
    found: Object.keys(ctx.state.dex).length,
    total: ctx.content.species.list.length * ctx.content.rarities.list.length,
  };
}

// --- Creature list: filter & sort (Kreaturenliste) ---

export interface CreatureFilter {
  search: string;
  species: string | null;
  element: string | null;
  rarity: string | null;
  /** all | idle | working | busy (nest/mission) | locked */
  status: 'all' | 'idle' | 'working' | 'busy' | 'locked';
  /** Only sequenced creatures carrying this allele. */
  allele: { locus: string; allele: string } | null;
  /** Hide creatures that are away on an expedition (ignored when the status filter asks for busy ones). */
  hideAway: boolean;
}

export type CreatureSort = 'newest' | 'oldest' | 'rarity' | 'generation' | 'power' | 'name' | `stat:${string}`;

export const EMPTY_FILTER: CreatureFilter = { search: '', species: null, element: null, rarity: null, status: 'all', allele: null, hideAway: false };

export function filterCreatures(ctx: GameContext, f: CreatureFilter): Creature[] {
  const q = f.search.trim().toLowerCase();
  return ctx.state.creatures.filter((c) => {
    const species = ctx.content.species.get(c.speciesId);
    if (q && !c.name.toLowerCase().includes(q) && !species.name.toLowerCase().includes(q)) return false;
    if (f.species && c.speciesId !== f.species) return false;
    if (f.element && species.element !== f.element) return false;
    if (f.rarity && c.rarity !== f.rarity) return false;
    if (f.status === 'idle' && c.job !== null) return false;
    if (f.status === 'working' && c.job?.kind !== 'building') return false;
    if (f.status === 'busy' && !(c.job && c.job.kind !== 'building')) return false;
    if (f.status === 'locked' && !c.locked) return false;
    if (f.hideAway && f.status !== 'busy' && c.job?.kind === 'mission') return false;
    if (f.allele && !(c.sequenced && c.genome[f.allele.locus]?.includes(f.allele.allele))) return false;
    return true;
  });
}

export function sortCreatures(ctx: GameContext, list: Creature[], sort: CreatureSort): Creature[] {
  const rarity = (c: Creature) => ctx.content.rarities.get(c.rarity).order;
  const out = [...list];
  if (sort.startsWith('stat:')) {
    const stat = sort.slice(5);
    const cache = new Map(out.map((c) => [c.id, effectiveStats(ctx, c)[stat] ?? 0]));
    return out.sort((a, b) => cache.get(b.id)! - cache.get(a.id)!);
  }
  switch (sort) {
    case 'newest':
      return out.sort((a, b) => b.id - a.id);
    case 'oldest':
      return out.sort((a, b) => a.id - b.id);
    case 'rarity':
      return out.sort((a, b) => rarity(b) - rarity(a) || b.generation - a.generation);
    case 'generation':
      return out.sort((a, b) => b.generation - a.generation || rarity(b) - rarity(a));
    case 'name':
      return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    case 'power': {
      const cache = new Map(out.map((c) => [c.id, creaturePower(ctx, c)]));
      return out.sort((a, b) => cache.get(b.id)! - cache.get(a.id)!);
    }
  }
  return out;
}

/** Human readable name for a modifier source id (bonus breakdown). */
export function sourceLabel(ctx: GameContext, source: string): string {
  const [kind, rest = ''] = source.split(':');
  const id = rest.split('#')[0] ?? '';
  const name = <T extends { id: string; name: string }>(reg: { has(id: string): boolean; get(id: string): T }, key: string) => (reg.has(key) ? reg.get(key).name : key);
  switch (kind) {
    case 'upgrade':
      return `Forschung: ${name(ctx.content.upgrades, id)}`;
    case 'achievement':
      return `Erfolg: ${name(ctx.content.achievements, id)}`;
    case 'prestige':
      return `Vererbung`;
    case 'dex':
      return 'Monster-Dex';
    case 'buff':
      return `Trank: ${name(ctx.content.potions, id)}`;
    case 'ability':
      return `Fähigkeit: ${name(ctx.content.abilities, id)}`;
    case 'gene': {
      const [locus = '', allele = ''] = rest.split(':');
      const def = ctx.content.genes.has(locus) ? ctx.content.genes.get(locus) : null;
      return `Gen: ${def?.alleles.find((a) => a.id === allele)?.name ?? allele} (${def?.name ?? locus})`;
    }
    case 'boost':
      return 'Kraftfutter';
    case 'infusion':
      return 'Infusion';
    default:
      return source;
  }
}

export interface StatBreakdown {
  stat: string;
  base: number;
  rarityMult: number;
  final: number;
  parts: { label: string; op: string; value: number }[];
}

/** Per-stat bonus breakdown for the creature detail view. */
export function statBreakdown(ctx: GameContext, c: Creature): StatBreakdown[] {
  const mods = creatureModifiers(ctx, c);
  const final = effectiveStats(ctx, c);
  return ctx.content.stats.list.map((s) => ({
    stat: s.id,
    base: c.stats[s.id] ?? 0,
    rarityMult: ctx.balance.rarity.statMultiplier[c.rarity] ?? 1,
    final: final[s.id] ?? 0,
    parts: mods.breakdown(`stat.${s.id}`).map((m) => ({ label: sourceLabel(ctx, m.source), op: m.op, value: m.value })),
  }));
}

/** Human readable modifier, e.g. "+20 % Angriff", "Brutzeit ×0,8". */
export function describeModifier(ctx: GameContext, m: { target: string; op: string; value: number }): string {
  const parts = m.target.split('.');
  const label = (() => {
    if (parts[0] === 'stat' && ctx.content.stats.has(parts[1] ?? '')) return ctx.content.stats.get(parts[1]!).name;
    if (parts[0] === 'production' && ctx.content.resources.has(parts[1] ?? '')) return `${ctx.content.resources.get(parts[1]!).name}-Ertrag`;
    const known: Record<string, string> = {
      'breeding.time': 'Brutzeit',
      'breeding.mutation': 'Mutationschance',
      'tower.elementDamage': 'Element-Schaden (Turm)',
      'tower.damage': 'Turm-Schaden',
    };
    return known[m.target] ?? m.target;
  })();
  const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 1000) / 10} %`.replace('.', ',');
  if (m.op === 'pct') return `${pct(m.value)} ${label}`;
  if (m.op === 'mult') return `${label} ×${String(Math.round(m.value * 100) / 100).replace('.', ',')}`;
  if (m.target === 'breeding.mutation') return `${pct(m.value)} ${label}`;
  return `${m.value >= 0 ? '+' : ''}${m.value} ${label}`;
}
