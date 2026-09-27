<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { view } from '../store.svelte';
</script>

{#if view.offline}
  {@const r = view.offline}
  <div class="backdrop" role="presentation" onclick={() => (view.offline = null)}>
    <div class="panel modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && (view.offline = null)}>
      <h2>Willkommen zurück!</h2>
      <p>Du warst {formatDuration(r.requestedMs)} weg.</p>
      {#if r.simulatedMs < r.requestedMs}
        <p class="muted small">Offline-Fortschritt ist auf {formatDuration(r.capMs)} begrenzt.</p>
      {/if}
      <ul>
        {#each Object.entries(r.gained) as [res, amount] (res)}
          <li class="num">+{formatNumber(amount)} {content.resources.get(res).icon} {content.resources.get(res).name}</li>
        {/each}
      </ul>
      <button class="primary" onclick={() => (view.offline = null)}>Weiter</button>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 30; padding: 1rem; }
  .modal { width: min(420px, 100%); }
  ul { list-style: none; padding: 0; }
  .small { font-size: 0.85rem; }
</style>
