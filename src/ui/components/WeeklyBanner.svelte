<script lang="ts">
  import { activeMutation, nextWeekStart } from '@core/features/weekly';
  import { formatDuration } from '@core/format';
  import { game, view } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    const m = activeMutation(game);
    return m ? { m, left: nextWeekStart(game, game.state.lastTickAt) - game.state.lastTickAt } : null;
  });
</script>

{#if data}
  <div class="weekly" title="Wechselt in {formatDuration(data.left)}">
    <span class="tag">Woche</span>
    <b>{data.m.name}</b>
    <span class="muted">{data.m.description}</span>
  </div>
{/if}

<style>
  .weekly {
    display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; font-size: 0.82rem;
    background: linear-gradient(90deg, color-mix(in srgb, var(--violet) 25%, var(--panel)), var(--panel));
    border: 1px solid var(--violet); border-radius: 10px; padding: 0.35rem 0.7rem; margin-bottom: 0.6rem;
  }
  .tag { background: var(--violet); color: #fff; border-radius: 99px; padding: 0 0.45rem; font-size: 0.7rem; font-weight: 700; }
</style>
