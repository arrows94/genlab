<script lang="ts">
  import { formatNumber } from '@core/format';
  import { visibleResources } from '@core/queries';
  import { game, view } from '../store.svelte';

  const rows = $derived.by(() => {
    view.frame;
    const rates = game.productionRates();
    return visibleResources(game).map((r) => ({
      def: r,
      amount: game.state.resources[r.id],
      rate: rates[r.id],
    }));
  });
</script>

<div class="bar hscroll">
  {#each rows as row (row.def.id)}
    <div class="res" style="--c: {row.def.color}" title={row.def.description ?? row.def.name}>
      <span class="icon">{row.def.icon}</span>
      <span class="amount num" data-icon={row.def.icon}>{formatNumber(row.amount ?? 0)}</span>
      {#if row.rate}<span class="rate num">+{formatNumber(row.rate)}/s</span>{/if}
    </div>
  {/each}
</div>

<style>
  .bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  @media (max-width: 640px) {
    .bar { flex-wrap: nowrap; width: 100%; gap: 0.35rem; padding-bottom: 2px; }
    .res { flex: 0 0 auto; flex-direction: column; align-items: flex-start; gap: 0; padding: 0.2rem 0.5rem; }
    .res .icon { position: absolute; opacity: 0; width: 0; }
    .amount::before { content: attr(data-icon) ' '; }
    .rate { font-size: 0.65rem; }
  }
  .res {
    display: flex; align-items: baseline; gap: 0.35rem;
    background: var(--bg-2); border: 1px solid var(--line); border-left: 3px solid var(--c);
    border-radius: 8px; padding: 0.3rem 0.6rem;
  }
  .amount { font-weight: 700; color: var(--c); }
  .rate { font-size: 0.75rem; color: var(--muted); }
</style>
