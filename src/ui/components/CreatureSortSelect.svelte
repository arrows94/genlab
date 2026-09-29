<script lang="ts">
  import { content } from '@content/index';
  import type { CreatureSort } from '@core/queries';
  import { game } from '../store.svelte';
  import SortToggle from './SortToggle.svelte';

  /**
   * The creature sort used by every creature picker (list, breeding, genome
   * viewer, splicing …): the `sortCreatures` orders plus optional extra ones
   * of the picker, and ⇅ to flip. Unknown values fall back to the first option.
   */
  let {
    value = $bindable('power'),
    inverted = $bindable(false),
    extra = [],
    genetics = false,
  }: {
    value?: string;
    inverted?: boolean;
    /** Picker-specific orders shown first (id, label). */
    extra?: { id: string; label: string }[];
    /** Offer „Top-Allele“ (only meaningful where genomes are known). */
    genetics?: boolean;
  } = $props();

  const options = $derived<{ id: CreatureSort | string; label: string }[]>([
    ...extra,
    { id: 'power', label: 'Gesamtstärke' },
    ...(genetics ? [{ id: 'top', label: 'Top-Allele' }] : []),
    { id: 'rarity', label: 'Seltenheit' },
    { id: 'generation', label: 'Generation' },
    ...(game.state.features['dynasties'] ? [{ id: 'lineage', label: 'Reine Linie' }] : []),
    { id: 'newest', label: 'Neueste' },
    { id: 'oldest', label: 'Älteste' },
    ...content.stats.list.map((s) => ({ id: `stat:${s.id}`, label: s.name })),
    { id: 'name', label: 'Name' },
  ]);
  $effect(() => {
    if (!options.some((o) => o.id === value)) value = options[0]!.id;
  });
</script>

<span class="sortgroup">
  <select bind:value title="Sortierung">
    {#each options as o (o.id)}<option value={o.id}>{o.label}</option>{/each}
  </select>
  <SortToggle bind:inverted />
</span>

<style>
  .sortgroup { display: inline-flex; gap: 0.3rem; align-items: stretch; }
  select { max-width: 11rem; }
</style>
