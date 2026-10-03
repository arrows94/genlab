<script lang="ts">
  import { activeMutation, nextWeekStart, upcomingMutation } from '@core/features/weekly';
  import { formatDuration } from '@core/format';
  import { game, view } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    const m = activeMutation(game);
    return m ? { m, next: upcomingMutation(game), left: nextWeekStart(game, game.state.lastTickAt) - game.state.lastTickAt } : null;
  });
</script>

{#if data}
  <div class="weekly">
    <span class="tag">Woche</span>
    <b>{data.m.name}</b>
    <span class="muted">{data.m.description}{#if data.m.cellar && game.state.features['cellar']} · Keller: {data.m.cellar.text}{/if}</span>
    {#if data.next}
      <span class="next" title={data.next.id === data.m.id ? '' : data.next.description}>
        {#if data.next.id === data.m.id}
          Bleibt auch nächste Woche
        {:else}
          Nächste Woche (in {formatDuration(data.left)}): <b>{data.next.name}</b><span class="muted nextdesc">&nbsp;– {data.next.description}</span>
        {/if}
      </span>
    {/if}
  </div>
{/if}

<style>
  .weekly {
    display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; font-size: 0.82rem;
    background: linear-gradient(90deg, color-mix(in srgb, var(--violet) 25%, var(--panel)), var(--panel));
    border: 1px solid var(--violet); border-radius: 10px; padding: 0.35rem 0.7rem; margin-bottom: 0.6rem;
  }
  @media (max-width: 640px) {
    .weekly { font-size: 0.75rem; padding: 0.25rem 0.5rem; margin-bottom: 0.4rem; }
  }
  .next { margin-left: auto; font-size: 0.76rem; color: var(--muted); }
  .next b { color: var(--text); }
  @media (max-width: 640px) {
    .next { margin-left: 0; width: 100%; }
    .nextdesc { display: none; }
  }
  .tag { background: var(--violet); color: #fff; border-radius: 99px; padding: 0 0.45rem; font-size: 0.7rem; font-weight: 700; }
</style>
