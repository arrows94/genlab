import { EMPTY_FILTER, type CreatureFilter, type CreatureSort } from '@core/queries';

/**
 * View settings that must survive tab switches (components are re-created
 * when the tab changes) and reloads: list filters, sort order, dex mode …
 * Per device, stored separately from the save game.
 */
const KEY = 'genlab.view';

interface ViewState {
  list: { filter: CreatureFilter; sort: CreatureSort; alleleKey: string; showFilters: boolean };
  /** Dex view; the key replaced the old `mode` so everyone starts on the new gallery once. */
  dex: { view: 'cards' | 'table' | 'tree' };
  recycler: { element: string };
  expedition: { region: string };
  breeding: { species: string };
  research: { theme: string; affordableOnly: boolean };
}

const defaults = (): ViewState => ({
  list: { filter: { ...EMPTY_FILTER }, sort: 'newest', alleleKey: '', showFilters: false },
  dex: { view: 'cards' },
  recycler: { element: 'fire' },
  expedition: { region: 'short' },
  breeding: { species: '' },
  research: { theme: '', affordableOnly: false },
});

function load(): ViewState {
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<ViewState>;
    return {
      list: { ...base.list, ...saved.list, filter: { ...base.list.filter, ...saved.list?.filter } },
      dex: { view: ['cards', 'table', 'tree'].includes(saved.dex?.view ?? '') ? saved.dex!.view : base.dex.view },
      recycler: { ...base.recycler, ...saved.recycler },
      expedition: { ...base.expedition, ...saved.expedition },
      breeding: { ...base.breeding, ...saved.breeding },
      research: { ...base.research, ...saved.research },
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
