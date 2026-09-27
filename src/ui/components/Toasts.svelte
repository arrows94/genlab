<script lang="ts">
  import { view } from '../store.svelte';
</script>

<div class="toasts" aria-live="polite">
  {#each view.toasts as t (t.id)}
    <div class="toast {t.kind}">{t.text}</div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed; z-index: 20; left: 50%; transform: translateX(-50%);
    bottom: calc(1rem + env(safe-area-inset-bottom)); display: grid; gap: 0.4rem;
    width: min(92vw, 420px); pointer-events: none;
  }
  .toast {
    background: var(--panel-2); border: 1px solid var(--line); border-left: 4px solid var(--teal);
    border-radius: 10px; padding: 0.6rem 0.8rem; box-shadow: 0 6px 20px #0008; animation: in 0.25s ease-out;
  }
  .unlock { border-left-color: var(--violet); }
  .rare { border-left-color: var(--gold); }
  .error { border-left-color: var(--danger); }
  @media (max-width: 640px) {
    .toasts { bottom: calc(5rem + env(safe-area-inset-bottom)); }
  }
  @keyframes in { from { opacity: 0; transform: translateY(8px); } }
</style>
