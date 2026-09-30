<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { view, answer } from '../store.svelte';

  /** In-game confirmation dialog for `ask()` (see store). Enter confirms, Escape cancels. */
  let okButton: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (view.confirm) okButton?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (!view.confirm) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      answer(false);
    }
  }
</script>

<svelte:window onkeydowncapture={onKey} />

{#if view.confirm}
  <div class="backdrop" transition:fade={{ duration: 120 }} onclick={(e) => e.target === e.currentTarget && answer(false)} role="presentation">
    <div class="dialog panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text" transition:scale={{ duration: 150, start: 0.92 }}>
      <p id="confirm-text">{view.confirm.text}</p>
      <div class="buttons">
        <button onclick={() => answer(false)}>Abbrechen</button>
        <button bind:this={okButton} class:primary={!view.confirm.danger} class:danger={view.confirm.danger} onclick={() => answer(true)}>{view.confirm.ok}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Scrollable backdrop + margin:auto: centred, but a long text can still be scrolled to its buttons. */
  .backdrop { position: fixed; inset: 0; z-index: 50; background: #000a; display: flex; flex-direction: column; overflow-y: auto; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
  .dialog { margin: auto; flex: none; max-width: 26rem; width: 100%; padding: 1.1rem 1.2rem 1rem; box-shadow: 0 12px 40px #000a; }
  p { margin: 0 0 1rem; line-height: 1.45; white-space: pre-line; }
  .buttons { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; }
</style>
