<script lang="ts">
  import { inbox, openInbox } from '../inbox.svelte';
</script>

<button class="bell" class:has={inbox.unread > 0} onclick={() => openInbox()} aria-label="Nachrichten{inbox.unread ? ` (${inbox.unread} neu)` : ''}" title="Nachrichten">
  <span aria-hidden="true">🔔</span>
  {#if inbox.unread}<span class="badge num">{inbox.unread > 99 ? '99+' : inbox.unread}</span>{/if}
</button>

<style>
  .bell { position: relative; padding: 0.3rem 0.55rem; font-size: 1.05rem; line-height: 1; background: var(--bg-2); }
  .bell.has span[aria-hidden] { display: inline-block; animation: ring 0.6s ease-in-out 2; transform-origin: 50% 10%; }
  .badge {
    position: absolute; top: -6px; right: -6px; min-width: 1.2rem; height: 1.2rem; padding: 0 0.3rem;
    border-radius: 999px; background: var(--violet); font-size: 0.7rem; display: grid; place-items: center;
  }
  @keyframes ring {
    0%, 100% { rotate: 0deg; }
    25% { rotate: 14deg; }
    75% { rotate: -14deg; }
  }
</style>
