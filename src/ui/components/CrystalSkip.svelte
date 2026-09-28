<script lang="ts">
  import { isLongProject, timeCrystals, useTimeCrystal } from '@core/features/timeCrystals';
  import type { Process } from '@core/state';
  import { game, view, act } from '../store.svelte';

  /** "⌛ −4 h" on a long project; hidden for short processes and before crystals exist. */
  let { process }: { process: Process | undefined } = $props();

  const data = $derived.by(() => {
    view.slowFrame;
    const p = process;
    return {
      show: !!p && isLongProject(game, p) && game.state.features['contracts'] === true,
      owned: timeCrystals(game),
      skip: `${game.balance.timeCrystals.skipHours} h`,
    };
  });
</script>

{#if data.show && process}
  <button
    class="skip"
    disabled={data.owned < 1}
    title={data.owned < 1 ? 'Keine Zeitkristalle – es gibt sie für Gen-Aufträge ab Stufe 3, die Tagesbelohnung und Turm-Meilensteine.' : `Einen Zeitkristall einsetzen (${data.owned} vorhanden)`}
    onclick={() => process && act(useTimeCrystal(game, process.id))}
  >
    ⌛ −{data.skip} <span class="count num">({data.owned})</span>
  </button>
{/if}

<style>
  .skip { font-size: 0.72rem; padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid #8ecbff66; background: #8ecbff14; color: #cfe8ff; white-space: nowrap; }
  .skip:disabled { opacity: 0.45; }
  .count { color: var(--muted); }
</style>
