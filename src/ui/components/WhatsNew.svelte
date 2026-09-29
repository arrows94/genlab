<script lang="ts">
  import { formatReleaseDate, hiddenText } from '../changelog';
  import { closeNews, news } from '../news.svelte';
  import { view } from '../store.svelte';

  /** "Was ist neu?" – waits until the welcome-back summary is closed. */
</script>

{#if news.open && !view.offline}
  <div class="backdrop" role="presentation" onclick={closeNews}>
    <div class="panel modal" role="dialog" aria-modal="true" aria-labelledby="news-title" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && closeNews()}>
      <h2 id="news-title">✨ Was ist neu?</h2>
      <div class="entries">
        {#each news.entries as e (e.id)}
          <section>
            <h3>{e.title} <small class="muted">· {formatReleaseDate(e.date)}</small></h3>
            <ul>
              {#each e.items as text, i (i)}<li>{text}</li>{/each}
              {#if e.hidden > 0}<li class="secret">🔒 {hiddenText(e.hidden)}</li>{/if}
            </ul>
          </section>
        {/each}
      </div>
      <button class="primary" onclick={closeNews}>Los geht's</button>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: #000a; display: grid; place-items: center; z-index: 30; padding: 1rem; }
  .modal { width: min(480px, 100%); max-height: calc(100vh - 2rem); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 0.6rem; border-color: var(--violet); }
  h2 { margin: 0; }
  .entries { overflow-y: auto; display: grid; gap: 0.8rem; padding-right: 0.2rem; }
  h3 { margin: 0 0 0.3rem; }
  h3 small { font-weight: 400; font-size: 0.78rem; }
  ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.3rem; font-size: 0.9rem; }
  .secret { list-style: none; margin-left: -1.1rem; color: var(--muted); font-style: italic; }
  .primary { justify-self: end; }
</style>
