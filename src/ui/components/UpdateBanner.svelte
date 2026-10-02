<script lang="ts">
  import { onMount } from 'svelte';
  import { CURRENT_RELEASE, hiddenText, parseChangelog, visibleNews } from '../changelog';
  import { game, save, view } from '../store.svelte';

  /**
   * "Neue Version da": previews what the waiting version brings. This code
   * runs in the *old* version, so the notes come from the new build's
   * changelog.json (not in the offline cache, so it is fetched fresh).
   */
  const MAX_LINES = 3;
  let lines = $state<string[]>([]);
  let more = $state(0);

  onMount(async () => {
    try {
      const res = await fetch(`./changelog.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const entries = visibleNews(parseChangelog(await res.json()), CURRENT_RELEASE, (f) => game.state.features[f] === true);
      const all = entries.flatMap((e) => e.items);
      lines = all.slice(0, MAX_LINES);
      more = all.length - lines.length;
      const hidden = entries.reduce((n, e) => n + e.hidden, 0);
      if (lines.length === 0 && hidden > 0) lines = [hiddenText(hidden)];
    } catch {
      /* offline: the plain banner is enough */
    }
  });
</script>

<div class="update panel" role="status">
  <div class="text">
    <b>Eine neue Version von Genlab ist da.</b>
    {#if lines.length}
      <ul>
        {#each lines as line, i (i)}<li>{line}</li>{/each}
        {#if more > 0}<li class="muted">… und {more} {more === 1 ? 'weitere Neuerung' : 'weitere Neuerungen'}</li>{/if}
      </ul>
    {/if}
  </div>
  <div class="actions">
    <button class="primary" onclick={() => { save(); view.applyUpdate?.(); }}>Jetzt aktualisieren</button>
    <button class="later" title="Später – die Anzeige kommt wieder, wenn du ins Spiel zurückkehrst" onclick={() => (view.updateLater = true)}>Später</button>
  </div>
</div>

<style>
  .update {
    position: fixed; z-index: 15; left: 50%; transform: translateX(-50%); top: calc(0.5rem + env(safe-area-inset-top));
    width: max-content; max-width: min(560px, calc(100vw - 1rem));
    display: flex; gap: 0.75rem; align-items: center; padding: 0.5rem 0.8rem; border-color: var(--violet); font-size: 0.9rem;
  }
  .text { min-width: 0; }
  ul { margin: 0.3rem 0 0; padding-left: 1.1rem; font-size: 0.8rem; display: grid; gap: 0.15rem; }
  .muted { list-style: none; margin-left: -1.1rem; }
  .actions { flex: none; display: flex; gap: 0.4rem; }
  .later { color: var(--muted); }
  @media (max-width: 520px) {
    .update { flex-direction: column; align-items: stretch; }
    .actions > .primary { flex: 1; }
  }
</style>
