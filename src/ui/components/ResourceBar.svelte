<script lang="ts">
  import { formatNumber } from '@core/format';
  import { visibleResources } from '@core/queries';
  import { game, view } from '../store.svelte';

  /** Whole numbers from 100 on, one fixed decimal below – constant width while counting. */
  const fmt = (v: Parameters<typeof formatNumber>[0]) => formatNumber(v, { decimals: Number(v.toString()) < 100 ? 1 : 0, fixed: true });

  const rows = $derived.by(() => {
    view.slowFrame;
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
      <span class="amount num" data-icon={row.def.icon}>{fmt(row.amount ?? 0)}</span>
      {#if row.rate}<span class="rate num">+{fmt(row.rate)}/s</span>{/if}
    </div>
  {/each}
</div>

<style>
  .bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .res {
    display: flex; align-items: baseline; gap: 0.35rem;
    background: var(--bg-2); border: 1px solid var(--line); border-left: 3px solid var(--c);
    border-radius: 8px; padding: 0.3rem 0.6rem;
  }
  /* Fixed minimum widths: digits change, the chips don't move. */
  .amount { font-weight: 700; color: var(--c); display: inline-block; min-width: 9ch; text-align: right; }
  .rate { display: inline-block; min-width: 8ch; font-size: 0.75rem; color: var(--muted); }

  @media (max-width: 640px) {
    .bar { flex-wrap: nowrap; width: 100%; gap: 0.35rem; padding-bottom: 2px; }
    .res { flex: 0 0 auto; flex-direction: column; align-items: flex-start; gap: 0; padding: 0.2rem 0.5rem; }
    /* The icon moves into .amount::before. Not position:absolute – its containing block would be the
       sticky header, outside this scroller, so off-screen chips widened the page (sideways scrolling on iOS). */
    .res .icon { display: none; }
    .amount { min-width: 10ch; text-align: left; }
    .amount::before { content: attr(data-icon) ' '; }
    .rate { font-size: 0.65rem; min-width: 0; }
  }
</style>
