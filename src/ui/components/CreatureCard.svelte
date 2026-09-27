<script lang="ts">
  import { content } from '@content/index';
  import { effectiveStats } from '@core/creatures';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { renameCreature, toggleLock } from '@core/actions';
  import CreatureSvg from './CreatureSvg.svelte';
  import type { Snippet } from 'svelte';

  let { creature, children }: { creature: Creature; children?: Snippet } = $props();

  const species = $derived(content.species.get(creature.speciesId));
  const rarity = $derived(content.rarities.get(creature.rarity));
  const element = $derived(content.elements.get(species.element));
  const stats = $derived.by(() => {
    view.frame;
    return effectiveStats(game, creature);
  });

  let editing = $state(false);
  let draft = $state('');

  function startEdit() {
    draft = creature.name;
    editing = true;
  }
  function commit() {
    act(renameCreature(game, creature.id, draft));
    editing = false;
  }
</script>

<article class="card" class:glow={rarity.glow} style="--rarity: {rarity.color}; --element: {element.color}">
  <header>
    <span class="rarity">{rarity.name}</span>
    <button class="lock" title={creature.locked ? 'Favorit (gesperrt)' : 'Als Favorit sperren'} onclick={() => act(toggleLock(game, creature.id))}>
      {creature.locked ? '★' : '☆'}
    </button>
  </header>
  <div class="art"><CreatureSvg appearance={creature.appearance} shape={species.shape} /></div>
  {#if editing}
    <form onsubmit={(e) => { e.preventDefault(); commit(); }}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={draft} maxlength="20" autofocus onblur={commit} />
    </form>
  {:else}
    <button class="name" onclick={startEdit} title="Umbenennen">{creature.name}</button>
  {/if}
  <div class="meta">
    <span class="element">{element.name}</span>
    <span>{species.name}</span>
    <span class="num">Gen {creature.generation}</span>
  </div>
  <dl class="stats">
    {#each content.stats.list as s (s.id)}
      <div><dt>{s.short}</dt><dd class="num">{stats[s.id]}</dd></div>
    {/each}
  </dl>
  {#if creature.job}
    <div class="job">Arbeitet: {content.buildings.has(creature.job.target) ? content.buildings.get(creature.job.target).name : creature.job.target}</div>
  {/if}
  {@render children?.()}
</article>

<style>
  .card {
    position: relative;
    background: linear-gradient(180deg, var(--panel-2), var(--bg-2));
    border: 2px solid var(--rarity);
    border-radius: var(--radius);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .card.glow { animation: mythic-glow 2.2s ease-in-out infinite; }
  header { display: flex; justify-content: space-between; align-items: center; }
  .rarity { color: var(--rarity); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .lock { background: none; border: none; padding: 0.1rem 0.3rem; color: var(--gold); font-size: 1.1rem; }
  .art { display: flex; justify-content: center; background: radial-gradient(circle, color-mix(in srgb, var(--element) 18%, transparent), transparent 70%); border-radius: 50%; }
  .name { background: none; border: none; padding: 0; font-weight: 700; font-size: 1.05rem; text-align: left; }
  .meta { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--muted); }
  .element { color: var(--element); }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; margin: 0; }
  .stats div { background: var(--bg-2); border-radius: 6px; padding: 0.2rem; text-align: center; }
  dt { font-size: 0.65rem; color: var(--muted); }
  dd { margin: 0; font-size: 0.9rem; }
  .job { font-size: 0.8rem; color: var(--teal); }
  input { width: 100%; }
</style>
