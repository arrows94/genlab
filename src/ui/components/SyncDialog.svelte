<script lang="ts">
  import { dialog } from '../dialog';
  import { fade, scale } from 'svelte/transition';
  import { resolveConflict, sync } from '../sync.svelte';
  import SaveCompare from './SaveCompare.svelte';

  /** The player picks one save when devices disagree (see sync.svelte.ts). Escape = decide later. */
  function onKey(e: KeyboardEvent) {
    if (sync.conflict && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      resolveConflict('later');
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if sync.conflict}
  {@const c = sync.conflict}
  <div class="backdrop" transition:fade={{ duration: 120 }} role="presentation">
    <div class="dialog panel" use:dialog role="alertdialog" aria-modal="true" aria-labelledby="sync-title" transition:scale={{ duration: 150, start: 0.92 }}>
      {#if c.kind === 'connect'}
        <h3 id="sync-title">☁️ Welchen Spielstand behalten?</h3>
        <p>Zu diesem Code gibt es einen Cloud-Stand von „{c.remote.device}“. Beide Geräte spielen danach mit demselben Stand weiter.</p>
      {:else}
        <h3 id="sync-title">☁️ Auf zwei Geräten gespielt</h3>
        <p>Seit dem letzten Abgleich wurde hier und auf „{c.remote.device}“ gespielt. Genlab kann nur einen der beiden Stände behalten.</p>
      {/if}
      <SaveCompare other={c.remote.state} otherLabel="Cloud" otherSavedAt={c.remote.savedAt} />
      <p class="small muted">Der andere Stand wird überschrieben. Die Zeit seit dem Speichern wird als Offline-Fortschritt nachgeholt.</p>
      <div class="buttons">
        <button onclick={() => resolveConflict('later')}>{c.kind === 'connect' ? 'Abbrechen' : 'Später'}</button>
        <button onclick={() => resolveConflict('local')}>Diesen Stand behalten</button>
        <button class="primary" onclick={() => resolveConflict('remote')}>Cloud-Stand laden</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 55; background: #000a; display: grid; place-items: center; padding: 1rem; }
  .dialog { max-width: 28rem; width: 100%; max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.1rem 1.2rem 1rem; box-shadow: 0 12px 40px #000a; }
  h3 { margin-top: 0; }
  p { line-height: 1.45; margin: 0 0 0.7rem; }
  .small { font-size: 0.82rem; }
  .buttons { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.8rem; }
</style>
