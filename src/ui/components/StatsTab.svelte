<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { game, view } from '../store.svelte';

  const LABELS: Record<string, string> = {
    clicks: 'Sammel-Klicks',
    creaturesObtained: 'Kreaturen erhalten',
    dexEntries: 'Dex-Einträge',
    upgradesBought: 'Forschungen gekauft',
  };

  const data = $derived.by(() => {
    view.frame;
    return {
      playTime: game.state.simTimeMs,
      stats: Object.entries(game.state.statistics).filter(([k]) => LABELS[k]),
      earned: Object.entries(game.state.earnedTotal),
      achievements: content.achievements.list.map((a) => ({ def: a, done: !!game.state.achievements[a.id] })),
    };
  });
</script>

<h2>Statistik</h2>
<div class="grid">
  <article class="panel">
    <h3>Allgemein</h3>
    <dl>
      <dt>Spielzeit</dt><dd class="num">{formatDuration(data.playTime)}</dd>
      {#each data.stats as [k, v] (k)}<dt>{LABELS[k]}</dt><dd class="num">{formatNumber(v)}</dd>{/each}
    </dl>
  </article>
  <article class="panel">
    <h3>Insgesamt verdient</h3>
    <dl>
      {#each data.earned as [res, v] (res)}
        <dt>{content.resources.get(res).icon} {content.resources.get(res).name}</dt><dd class="num">{formatNumber(v)}</dd>
      {/each}
    </dl>
  </article>
  <article class="panel">
    <h3>Erfolge</h3>
    <ul>
      {#each data.achievements as a (a.def.id)}
        <li class:done={a.done}>{a.done ? '🏆' : '🔒'} <b>{a.def.name}</b> <span class="muted">– {a.def.description}</span></li>
      {/each}
    </ul>
  </article>
</div>

<style>
  dl { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 1rem; margin: 0; }
  dd { margin: 0; text-align: right; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; font-size: 0.9rem; }
  li:not(.done) { opacity: 0.6; }
</style>
