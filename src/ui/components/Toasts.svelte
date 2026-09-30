<script lang="ts">
  import { view } from '../store.svelte';
  import { openInbox } from '../inbox.svelte';

  /** Tapping a toast opens the notification center with the full history. */
  function open() {
    view.toasts = [];
    openInbox(true);
  }
</script>

<div class="toasts" class:world={view.world !== 'off'} aria-live="polite">
  {#each view.toasts as t (t.id)}
    <button class="toast {t.kind}" onclick={open} title="Alle Nachrichten anzeigen">{t.text}</button>
  {/each}
</div>

<style>
  /* Bottom right, away from the centred page and its send and start buttons. */
  .toasts {
    position: fixed; z-index: 20; right: max(1rem, env(safe-area-inset-right));
    bottom: calc(1rem + env(safe-area-inset-bottom)); display: grid; gap: 0.4rem;
    width: min(92vw, 360px); pointer-events: none;
  }
  .toast {
    pointer-events: auto; text-align: left; width: 100%;
    background: var(--panel-2); border: 1px solid var(--line); border-left: 4px solid var(--teal);
    border-radius: 10px; padding: 0.6rem 0.8rem; box-shadow: 0 6px 20px #0008; animation: in 0.25s ease-out;
  }
  .unlock { border-left-color: var(--violet); }
  .rare { border-left-color: var(--gold); }
  .error { border-left-color: var(--danger); }
  @media (max-width: 640px) {
    /* Phones: the buttons sit at the bottom in thumb reach, so the messages drop in right below the header. */
    .toasts { right: auto; left: 50%; transform: translateX(-50%); bottom: auto; top: calc(var(--header-h, 4rem) + 0.4rem); }
    .toast { animation-name: drop; padding: 0.45rem 0.7rem; font-size: 0.9rem; }
  }
  /* The other world has no header: its skills sit at the bottom. */
  .toasts.world { right: auto; left: 50%; transform: translateX(-50%); bottom: auto; top: calc(0.5rem + env(safe-area-inset-top)); }
  .world .toast { animation-name: drop; }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
  @keyframes drop { from { opacity: 0; transform: translateY(-8px); } }
</style>
