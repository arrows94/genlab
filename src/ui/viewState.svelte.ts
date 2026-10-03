import { EMPTY_FILTER, type CreatureFilter, type CreatureSort } from '@core/queries';

/**
 * View settings that must survive tab switches (components are re-created
 * when the tab changes) and reloads: list filters, sort order, dex mode …
 * Per device, stored separately from the save game.
 */
const KEY = 'genlab.view';

interface ViewState {
  /** `invert` flips the chosen sort (weakest first, most common first …). */
  list: { filter: CreatureFilter; sort: CreatureSort; invert: boolean; alleleKey: string; showFilters: boolean };
  /** Dex view; the key replaced the old `mode` so everyone starts on the new gallery once. */
  dex: { view: 'cards' | 'table' | 'tree' };
  recycler: { element: string };
  /** Tagesbelohnung: calendar expanded (otherwise a single line). */
  lab: { dailyOpen: boolean };
  /** Creature pickers (missions, Wochenexpedition) can hide working creatures and favourites. */
  expedition: { region: string; voyageOpen: boolean; hideWorking: boolean; hideLocked: boolean };
  /** `speciesB`: species filter of the second list (Zwei Zuchtlisten). */
  breeding: { species: string; speciesB: string; rarity: string; sort: BreedingSort; invert: boolean };
  research: { theme: string; affordableOnly: boolean; grandOpen: boolean };
  /** Splicing bench: hide creatures without attempts left or with a perfect genome. */
  splicing: { hideDone: boolean; sort: string; invert: boolean };
  /** Infusion quick selection: rarity limit and "only allele donors". */
  infusion: { maxRarity: string; donorsOnly: boolean };
  /** Genome viewer in the Genlabor: search and filters of the creature gallery. */
  genome: { sequencedOnly: boolean; species: string; libraryOpen: boolean; hideCompleteGenes: boolean; sort: string; invert: boolean };
  /** Tab bar: the tab last opened in each area (group id → tab id). */
  nav: { last: Record<string, string> };
  /**
   * Tempo of the fight replay in the arena (1×, 2× or 0 = skip to the result),
   * the protocol filter „Nur Wichtiges“ and whether the defeat analysis is open.
   * Candidate sort: order, ⇅ and the element for „Vorteil vs.“ ('' = the next enemy's).
   * `area`: the Turm or the Genom-Keller below it (the switch in the tower tab).
   */
  tower: { replaySpeed: ReplaySpeed; logImportant: boolean; defeatOpen: boolean; sort: TowerSort; invert: boolean; vsElement: string; area: TowerArea };
}

export type ReplaySpeed = 0 | 1 | 2;
export type TowerArea = 'tower' | 'cellar';

export const TOWER_SORTS = ['power', 'matchup', 'speed', 'hp', 'atk', 'def', 'role', 'rarity'] as const;
export type TowerSort = (typeof TOWER_SORTS)[number];

export type BreedingSort = 'power' | 'rarity' | 'generation' | 'lineage' | 'species' | 'name' | `stat:${string}`;

const defaults = (): ViewState => ({
  list: { filter: { ...EMPTY_FILTER, hideAway: true }, sort: 'newest', invert: false, alleleKey: '', showFilters: false },
  dex: { view: 'cards' },
  recycler: { element: 'fire' },
  lab: { dailyOpen: false },
  expedition: { region: 'short', voyageOpen: false, hideWorking: false, hideLocked: false },
  breeding: { species: '', speciesB: '', rarity: '', sort: 'power', invert: false },
  research: { theme: '', affordableOnly: false, grandOpen: false },
  splicing: { hideDone: true, sort: 'left', invert: false },
  infusion: { maxRarity: 'common', donorsOnly: false },
  genome: { sequencedOnly: false, species: '', libraryOpen: true, hideCompleteGenes: false, sort: 'power', invert: false },
  nav: { last: {} },
  tower: { replaySpeed: 1, logImportant: true, defeatOpen: true, sort: 'power', invert: false, vsElement: '', area: 'tower' },
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
      lab: { ...base.lab, ...saved.lab },
      expedition: { ...base.expedition, ...saved.expedition },
      breeding: { ...base.breeding, ...saved.breeding },
      research: { ...base.research, ...saved.research },
      splicing: { ...base.splicing, ...saved.splicing },
      infusion: { ...base.infusion, ...saved.infusion },
      genome: { ...base.genome, ...saved.genome },
      nav: { last: { ...base.nav.last, ...saved.nav?.last } },
      tower: {
        ...base.tower,
        ...saved.tower,
        replaySpeed: ([0, 1, 2] as const).find((v) => v === saved.tower?.replaySpeed) ?? base.tower.replaySpeed,
        sort: TOWER_SORTS.find((v) => v === saved.tower?.sort) ?? base.tower.sort,
        area: saved.tower?.area === 'cellar' ? 'cellar' : 'tower',
      },
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
  // "Unterwegs ausblenden" is a display preference, not a filter – keep it.
  viewState.list.filter = { ...EMPTY_FILTER, hideAway: viewState.list.filter.hideAway };
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
