import { D } from './num';
import type { Condition } from './content/types';
import type { GameState } from './state';

/**
 * Dex entries counted per `species:rarity` filter: `"emberpup:rare"` (0/1), `"emberpup:"`
 * (any rarity), `":rare"` (any species) and `":"` (all). Unlocks are checked every step,
 * also offline, so the counts are kept per dex object. The dex only ever gains entries
 * (a reset replaces the whole object), so its size tells when they are out of date.
 */
export type DexCounts = ReadonlyMap<string, number>;

const dexCache = new WeakMap<Record<string, boolean>, { size: number; counts: DexCounts }>();

export function dexCounts(dex: Record<string, boolean>): DexCounts {
  const keys = Object.keys(dex);
  const cached = dexCache.get(dex);
  if (cached?.size === keys.length) return cached.counts;
  const counts = new Map<string, number>();
  const add = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  for (const key of keys) {
    const at = key.indexOf(':');
    const species = at < 0 ? key : key.slice(0, at);
    const rarity = at < 0 ? '' : key.slice(at + 1).split(':')[0]!;
    if (rarity) add(`${species}:${rarity}`);
    add(`${species}:`);
    add(`:${rarity}`);
    add(':');
  }
  dexCache.set(dex, { size: keys.length, counts });
  return counts;
}

/** `dex` may be passed in when many conditions are checked against the same state. */
export function checkCondition(state: GameState, c: Condition, dex?: DexCounts): boolean {
  switch (c.type) {
    case 'always':
      return true;
    case 'resourceEarned':
      return (state.earned[c.resource] ?? D(0)).gte(c.amount);
    case 'resourceOwned':
      return (state.resources[c.resource] ?? D(0)).gte(c.amount);
    case 'upgradeLevel':
      return (state.upgrades[c.upgrade] ?? 0) >= c.level;
    case 'feature':
      return state.features[c.feature] === true;
    case 'creatureCount':
      return state.creatures.length >= c.count;
    case 'statistic':
      return (state.statistics[c.statistic] ?? 0) >= c.amount;
    case 'dex':
      return ((dex ?? dexCounts(state.dex)).get(`${c.species ?? ''}:${c.rarity ?? ''}`) ?? 0) >= (c.count ?? 1);
    case 'prestigeCount':
      return (state.prestige[c.layer]?.count ?? 0) >= c.count;
    case 'talent':
      return state.talents?.[c.talent] === true;
    case 'towerFloor':
      return Math.max(state.tower?.best ?? 0, state.tower?.bestEver ?? 0, state.tower?.run?.floor ?? 0) >= c.floor;
    case 'anomaly':
      return state.anomaliesCompleted?.[c.anomaly] === true;
    case 'megaProject':
      return (state.megaProjects?.[c.project]?.stage ?? 0) >= c.stage;
    case 'geneLibrary':
      return Object.keys(state.geneLibrary ?? {}).length >= c.count;
    case 'all':
      return c.of.every((sub) => checkCondition(state, sub, dex ??= dexCounts(state.dex)));
    case 'any':
      return c.of.some((sub) => checkCondition(state, sub, dex ??= dexCounts(state.dex)));
  }
}

/**
 * Progress towards a countable condition (0–1), e.g. for a goal bar:
 * earned/owned resources, statistics, creature count, tower floor, gene
 * library, dex count. `all` takes the slowest part, `any` the fastest.
 * Returns null for yes/no conditions.
 */
export function conditionProgress(state: GameState, c: Condition): number | null {
  const share = (have: number, need: number) => (need <= 0 ? 1 : Math.min(1, Math.max(0, have / need)));
  switch (c.type) {
    case 'resourceEarned':
      return share((state.earned[c.resource] ?? D(0)).toNumber(), c.amount);
    case 'resourceOwned':
      return share((state.resources[c.resource] ?? D(0)).toNumber(), c.amount);
    case 'statistic':
      return share(state.statistics[c.statistic] ?? 0, c.amount);
    case 'creatureCount':
      return share(state.creatures.length, c.count);
    case 'towerFloor':
      return share(Math.max(state.tower?.best ?? 0, state.tower?.bestEver ?? 0, state.tower?.run?.floor ?? 0), c.floor);
    case 'geneLibrary':
      return share(Object.keys(state.geneLibrary ?? {}).length, c.count);
    case 'all':
    case 'any': {
      const parts = c.of.map((x) => conditionProgress(state, x) ?? (checkCondition(state, x) ? 1 : 0));
      if (parts.length === 0) return 1;
      return c.type === 'all' ? Math.min(...parts) : Math.max(...parts);
    }
    default:
      return null;
  }
}

/** The same condition with every countable target × factor (rounded up); yes/no parts stay. */
export function scaleCondition(c: Condition, factor: number): Condition {
  const up = (n: number) => Math.ceil(n * factor);
  switch (c.type) {
    case 'resourceEarned':
    case 'resourceOwned':
    case 'statistic':
      return { ...c, amount: up(c.amount) };
    case 'creatureCount':
    case 'geneLibrary':
      return { ...c, count: up(c.count) };
    case 'towerFloor':
      return { ...c, floor: up(c.floor) };
    case 'all':
    case 'any':
      return { ...c, of: c.of.map((x) => scaleCondition(x, factor)) };
    default:
      return c;
  }
}
