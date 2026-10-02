<script lang="ts">
  import { content } from '@content/index';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /** Leaderboard: the best tower runs, plus the most recent ones. */
  const tw = $derived.by(() => {
    view.slowFrame;
    const t = game.state.tower;
    return { best: t.best, leaderboard: [...t.leaderboard], history: [...t.history] };
  });
  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
  const medal = (i: number) => ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
</script>

<article class="panel board">
  <h3>🏆 Bestenliste</h3>
  {#if tw.leaderboard.length === 0}
    <p class="muted small">Noch keine Läufe.</p>
  {:else}
    <ol>
      {#each tw.leaderboard.slice(0, game.balance.tower.leaderboardSize) as e, i (i)}
        <li class="podium">
          <span class="medal">{medal(i)}</span>
          <span class="bfloor num">Etage {e.floor}</span>
          {@render minis(e.team)}
          <span class="small muted when">{new Date(e.at).toLocaleDateString('de-DE')}</span>
        </li>
      {/each}
    </ol>
  {/if}
  {#if tw.history.length > 0}
    <h4>🕑 Letzte Läufe</h4>
    <ol class="history">
      {#each tw.history as e, i (i)}
        <li class:record={e.floor > 0 && e.floor === tw.best}>
          <span class="bfloor num">Etage {e.floor}</span>
          <span class="small muted range num" title="Start ab Etage {e.startFloor}">ab {e.startFloor}</span>
          {@render minis(e.team)}
          <span class="small muted when">{new Date(e.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </li>
      {/each}
    </ol>
  {/if}
</article>

{#snippet minis(team: string[])}
  <span class="minis">
    {#each team as s, j (j)}
      {#if content.species.has(s)}
        {@const sp = content.species.get(s)}
        <span title={sp.name}><CreatureSvg appearance={{ ...neutral, hue: sp.hue }} shape={sp.shape} tier={sp.tier} size={26} /></span>
      {/if}
    {/each}
  </span>
{/snippet}

<style>
  .small { font-size: 0.8rem; }



  /* Tower column */

  /* Arena */
  /* Arena floor in perspective behind the fighters. */






  /* Foes stand out even when they share species and element with the team. */


  /* Team */

  /* Leaderboard */
  .board { margin-top: 0.75rem; }
  .board ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.3rem; }
  .board li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.6rem; padding: 0.25rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .board li.podium { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
  .medal { width: 1.8rem; text-align: center; font-size: 1.1rem; }
  .bfloor { font-weight: 700; min-width: 5.5rem; }
  .board h4 { margin: 0.8rem 0 0.4rem; }
  .history li { padding-block: 0.1rem; }
  .history li.record { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
  .range { min-width: 3.5rem; }
  .minis { display: flex; gap: 2px; }
  .when { margin-left: auto; white-space: nowrap; }

  @media (max-width: 760px) {
  }
</style>

