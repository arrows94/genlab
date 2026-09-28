import { EMPTY_FILTER, type CreatureFilter, type CreatureSort } from '@core/queries';

/**
 * View settings that must survive tab switches (components are re-created
 * when the tab changes) and reloads: list filters, sort order, dex mode …
 * Per device, stored separately from the save game.
 */
const KEY = 'genlab.view';

interface ViewState {
  list: { filter: CreatureFilter; sort: CreatureSort; alleleKey: string; showFilters: boolean };
  dex: { mode: 'grid' | 'tree' };
  recycler: { element: string };
  expedition: { region: string };
}

const defaults = (): ViewState => ({
  list: { filter: { ...EMPTY_FILTER }, sort: 'newest', alleleKey: '', showFilters: false },
  dex: { mode: 'grid' },
  recycler: { element: 'fire' },
  expedition: { region: 'short' },
});

function load(): ViewState {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ViewState>;
    return {
      list: { ...base.list, ...saved.list, filter: { ...base.list.filter, ...saved.list?.filter } },
      dex: { ...base.dex, ...saved.dex },
      recycler: { ...base.recycler, ...saved.recycler },
      expedition: { ...base.expedition, ...saved.expedition },
    };
  } catch {
    return base;
  }
}

export const viewState = $state<ViewState>(load());

/** Number of active list filters (for the "Filter (2)" label). */
export function activeListFilters(): number {
  const { filter, alleleKey } = viewState.list;
  return [filter.search, filter.species, filter.element, filter.rarity, filter.status !== 'all', alleleKey].filter(Boolean).length;
}

export function resetListFilters(): void {
  viewState.list.filter = { ...EMPTY_FILTER };
  viewState.list.alleleKey = '';
}

// Persist every change (cheap: a few small fields).
$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(viewState);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {
      /* private mode / storage full: keep in memory only */
    }
  });
});
