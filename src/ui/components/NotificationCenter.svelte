<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { view } from '../store.svelte';
  import { clearInbox, inbox, openInbox, type InboxEntry } from '../inbox.svelte';

  /** Side panel with the message history (see inbox.svelte.ts). */
  const FILTERS: { id: string; label: string; match: (e: InboxEntry) => boolean }[] = [
    { id: 'all', label: 'Alle', match: () => true },
    { id: 'important', label: 'Wichtig', match: (e) => e.kind === 'rare' || e.kind === 'unlock' },
    { id: 'error', label: 'Warnungen', match: (e) => e.kind === 'error' },
  ];
  let filter = $state('all');

  const shown = $derived(inbox.entries.filter(FILTERS.find((f) => f.id === filter)!.match));

  /** Re-evaluated with the slow frame so "vor 2 Min." keeps up. */
  const now = $derived.by(() => {
    view.slowFrame;
    return Date.now();
  });

  function ago(at: number): string {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 45) return 'gerade eben';
    const m = Math.round(s / 60);
    if (m < 60) return `vor ${m} Min.`;
    const h = Math.floor(m / 60);
    if (h < 24) return `vor ${h} Std.`;
    return new Date(at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function onKey(e: KeyboardEvent) {
    if (inbox.open && e.key === 'Escape' && !view.confirm) {
      e.preventDefault();
      openInbox(false);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if inbox.open}
  <div class="backdrop" transition:fade={{ duration: 150 }} onclick={() => openInbox(false)} role="presentation"></div>
  <div class="center panel" role="dialog" aria-modal="true" aria-label="Nachrichten" transition:fly={{ x: 40, duration: 180 }}>
    <header>
      <h2>🔔 Nachrichten</h2>
      <button class="close" onclick={() => openInbox(false)} aria-label="Schließen">✕</button>
    </header>
    <div class="filters">
      {#each FILTERS as f (f.id)}
        <button class:active={filter === f.id} onclick={() => (filter = f.id)}>{f.label}</button>
      {/each}
      {#if inbox.entries.length}
        <button class="clear" onclick={clearInbox}>Leeren</button>
      {/if}
    </div>
    {#if shown.length}
      <ul>
        {#each shown as e (e.id)}
          <li class={e.kind}>
            <span class="text">{e.text}{#if e.count > 1}<span class="count num">×{e.count}</span>{/if}</span>
            <time class="muted" datetime={new Date(e.at).toISOString()}>{ago(e.at)}</time>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty muted">{inbox.entries.length ? 'Keine Nachrichten in dieser Auswahl.' : 'Noch keine Nachrichten. Alles, was unten kurz eingeblendet wird, landet hier.'}</p>
    {/if}
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 40; background: #0008; }
  .center {
    position: fixed; z-index: 41; top: 0; right: 0; bottom: 0; width: min(400px, 100vw);
    display: flex; flex-direction: column; gap: 0.6rem; margin: 0; border-radius: 0; border-width: 0 0 0 1px;
    padding: calc(0.8rem + env(safe-area-inset-top)) 0.9rem calc(0.8rem + env(safe-area-inset-bottom));
    box-shadow: -12px 0 40px #000a;
  }
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.15rem; }
  .close { padding: 0.3rem 0.6rem; }
  .filters { display: flex; gap: 0.35rem; flex-wrap: wrap; }
  .filters button { padding: 0.3rem 0.7rem; font-size: 0.85rem; }
  .filters button.active { border-color: var(--teal); background: color-mix(in srgb, var(--petrol) 45%, var(--panel-2)); }
  .filters .clear { margin-left: auto; }
  ul { list-style: none; margin: 0; padding: 0 0.2rem 0 0; overflow-y: auto; display: grid; gap: 0.4rem; align-content: start; flex: 1; }
  li {
    background: var(--panel-2); border: 1px solid var(--line); border-left: 4px solid var(--teal); border-radius: 10px;
    padding: 0.5rem 0.7rem; display: grid; gap: 0.2rem; font-size: 0.92rem; line-height: 1.35;
  }
  li.unlock { border-left-color: var(--violet); }
  li.rare { border-left-color: var(--gold); }
  li.error { border-left-color: var(--danger); }
  .count { margin-left: 0.4rem; font-size: 0.75rem; color: var(--muted); }
  time { font-size: 0.75rem; }
  .empty { text-align: center; margin-top: 2rem; }
</style>
