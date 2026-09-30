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
  /* Height comes from the backdrop (minus safe areas), not 100vh: in an iOS home-screen app 100vh is taller
     than the visible screen, and Safari does not shrink a 1fr grid row under max-height – a long changelog
     pushed the close button off screen. Flex column: only the entries scroll, the button stays visible. */
  .backdrop { position: fixed; inset: 0; background: #000a; display: flex; flex-direction: column; overflow-y: auto; z-index: 30; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); }
  .modal { margin: auto; width: min(480px, 100%); max-height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 0.6rem; border-color: var(--violet); }
  h2 { margin: 0; flex: none; }
  .entries { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: grid; align-content: start; gap: 0.8rem; padding-right: 0.2rem; }
  h3 { margin: 0 0 0.3rem; }
  h3 small { font-weight: 400; font-size: 0.78rem; }
  ul { margin: 0; padding-left: 1.1rem; display: grid; gap: 0.3rem; font-size: 0.9rem; }
  .secret { list-style: none; margin-left: -1.1rem; color: var(--muted); font-style: italic; }
  .primary { align-self: flex-end; flex: none; }
</style>
