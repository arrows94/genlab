<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { game, view } from '../store.svelte';

  const LABELS: Record<string, string> = {
    clicks: 'Sammel-Klicks',
    creaturesObtained: 'Kreaturen erhalten',
    hatched: 'Geschlüpft',
    wildFound: 'Wilde Kreaturen gefunden',
    'creatures.capsule': 'Aus Kapseln',
    dexEntries: 'Dex-Einträge',
    upgradesBought: 'Forschungen gekauft',
    sequenced: 'Genome sequenziert',
    evolved: 'Evolutionen',
    infused: 'Kreaturen infundiert',
    breakthroughs: 'Durchbrüche',
    sold: 'Verkauft',
    recycled: 'Recycelt',
    capsulesOpened: 'Kapseln geöffnet',
    potionsUsed: 'Tränke benutzt',
    'completed.mission': 'Erkundungen',
  };

  const data = $derived.by(() => {
    view.frame;
    return {
      playTime: game.state.simTimeMs,
      stats: Object.keys(LABELS).filter((k) => game.state.statistics[k]).map((k) => [k, game.state.statistics[k]!] as const),
      records: [
        ['Höchste Generation', String(game.state.statistics['record.generation'] ?? 0)],
        ['Beste Seltenheit', content.rarities.list.find((r) => r.order === (game.state.statistics['record.rarity'] ?? 0))?.name ?? '–'],
        ['Höchste Infusion', `+${game.state.statistics['record.infusion'] ?? 0}`],
        ...(game.state.features['dynasties'] ? [['Tiefste reine Linie', String(game.state.statistics['record.lineage'] ?? 0)] as const] : []),
      ] as const,
      earned: Object.entries(game.state.earnedTotal),
      achievements: content.achievements.list.map((a) => ({ def: a, done: !!game.state.achievements[a.id] })),
    };
  });
</script>

<header class="tab-head">
  <h2>📊 Statistik</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{formatDuration(data.playTime)}</b><small>Spielzeit</small></span>
    <span class="kpi"><b class="num">{Object.keys(game.state.dex).length}</b><small>Dex-Einträge</small></span>
    <span class="kpi"><b class="num">{data.achievements.filter((a) => a.done).length}/{data.achievements.length}</b><small>Erfolge</small></span>
  </div>
</header>
<div class="grid">
  <article class="panel">
    <h3>Allgemein</h3>
    <dl>
      <dt>Spielzeit</dt><dd class="num">{formatDuration(data.playTime)}</dd>
      {#each data.stats as [k, v] (k)}<dt>{LABELS[k]}</dt><dd class="num">{formatNumber(v)}</dd>{/each}
    </dl>
  </article>
  <article class="panel">
    <h3>Rekorde</h3>
    <dl>
      {#each data.records as [k, v] (k)}<dt>{k}</dt><dd class="num">{v}</dd>{/each}
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
