<script lang="ts">
  import { dialog } from '../dialog';
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { view } from '../store.svelte';
  import { play } from '../sound';

  // A friendly greeting when the summary of the time away opens.
  $effect(() => {
    if (view.offline) play('welcome');
  });

  /** Wording for finished processes by kind; unknown kinds are not listed. */
  const COMPLETED: Record<string, (n: number) => string> = {
    mission: (n) => (n === 1 ? '1 Expedition zurückgekehrt' : `${n} Expeditionen zurückgekehrt`),
    egg: (n) => (n === 1 ? '1 Ei geschlüpft' : `${n} Eier geschlüpft`),
    deepSequence: (n) => (n === 1 ? '1 Tiefensequenzierung fertig' : `${n} Tiefensequenzierungen fertig`),
    grandResearch: (n) => (n === 1 ? '1 Großforschung abgeschlossen' : `${n} Großforschungen abgeschlossen`),
    voyage: () => 'Die Wochenexpedition ist zurück – eine Entscheidung wartet',
    sequence: (n) => (n === 1 ? '1 Genom sequenziert' : `${n} Genome sequenziert`),
  };
</script>

{#if view.offline}
  {@const r = view.offline}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (view.offline = null)}>
    <div class="panel modal" role="dialog" aria-modal="true" tabindex="-1" use:dialog={{ onescape: () => (view.offline = null) }}>
      <h2>Willkommen zurück!</h2>
      <p>Du warst {formatDuration(r.requestedMs)} weg.</p>
      {#if r.simulatedMs < r.requestedMs}
        <p class="muted small">Die Produktion ist auf {formatDuration(r.capMs)} begrenzt – Expeditionen, Brut und Sequenzierung liefen trotzdem weiter.</p>
      {/if}
      <ul>
        {#each Object.entries(r.gained) as [res, amount] (res)}
          <li class="num">+{formatNumber(amount)} {content.resources.get(res).icon} {content.resources.get(res).name}</li>
        {/each}
        {#each Object.entries(r.completed ?? {}) as [kind, n] (kind)}
          {#if COMPLETED[kind]}<li>✔ {COMPLETED[kind](n)}</li>{/if}
        {/each}
      </ul>
      <button class="primary" onclick={() => (view.offline = null)}>Weiter</button>
    </div>
  </div>
{/if}

<style>
  /* Scrollable backdrop + margin:auto: centred, but a long summary can still be scrolled to its button. */
  .backdrop { position: fixed; inset: 0; background: #000a; display: flex; flex-direction: column; overflow-y: auto; z-index: 30; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
  .modal { margin: auto; width: min(420px, 100%); flex: none; }
  ul { list-style: none; padding: 0; }
  .small { font-size: 0.85rem; }
</style>
