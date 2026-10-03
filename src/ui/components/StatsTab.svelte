<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { game, view } from '../store.svelte';

  const LABELS: Record<string, string> = {
    clicks: 'Sammel-Klicks',
    collectFinds: 'Fundstücke beim Sammeln',
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

  /** Readable label of a milestone key (feature:…, achievement:…, tower:…). */
  function milestoneLabel(key: string): string | null {
    const [kind, id = ''] = key.split(':');
    if (kind === 'feature') return content.features.has(id) ? `🔓 ${content.features.get(id).name}` : null;
    if (kind === 'achievement') return content.achievements.has(id) ? `🏆 ${content.achievements.get(id).name}` : null;
    if (kind === 'tower') return `🗼 Turm-Etage ${id}`;
    return null;
  }

  const data = $derived.by(() => {
    view.frame;
    const s = game.state.statistics;
    const sessions = s['sessions'] ?? 0;
    return {
      active: s['activeMs'] ?? 0,
      sessions,
      longest: s['record.session'] ?? 0,
      average: sessions > 0 ? (s['activeMs'] ?? 0) / sessions : 0,
      milestones: Object.entries(game.state.milestones)
        .map(([key, m]) => ({ key, label: milestoneLabel(key), ...m }))
        .filter((m): m is typeof m & { label: string } => m.label !== null)
        .sort((a, b) => a.activeMs - b.activeMs || a.simMs - b.simMs),
      playTime: game.state.simTimeMs,
      stats: Object.keys(LABELS).filter((k) => game.state.statistics[k]).map((k) => [k, game.state.statistics[k]!] as const),
      records: [
        ['Höchste Generation', String(game.state.statistics['record.generation'] ?? 0)],
        ['Beste Seltenheit', content.rarities.list.find((r) => r.order === (game.state.statistics['record.rarity'] ?? 0))?.name ?? '–'],
        ['Höchste Infusion', `+${game.state.statistics['record.infusion'] ?? 0}`],
        ...(game.state.features['dynasties'] ? [['Tiefste reine Linie', String(game.state.statistics['record.lineage'] ?? 0)] as const] : []),
        ...(game.state.features['cellar'] ? [['Tiefste Keller-Ebene', `−${game.state.statistics['record.cellarLevel'] ?? 0}`] as const] : []),
      ] as const,
      earned: Object.entries(game.state.earnedTotal),
      achievements: content.achievements.list.map((a) => ({ def: a, done: !!game.state.achievements[a.id], at: game.state.milestones[`achievement:${a.id}`] })),
    };
  });
</script>

<header class="tab-head">
  <h2>📊 Statistik</h2>
  <div class="kpis">
    <span class="kpi" title="Zeit, in der du wirklich gespielt hast: Spiel sichtbar und in den letzten 2 Minuten eine Eingabe."><b class="num">{formatDuration(data.active)}</b><small>Aktiv gespielt</small></span>
    <span class="kpi"><b class="num">{Object.keys(game.state.dex).length}</b><small>Dex-Einträge</small></span>
    <span class="kpi"><b class="num">{data.achievements.filter((a) => a.done).length}/{data.achievements.length}</b><small>Erfolge</small></span>
  </div>
</header>
<div class="grid">
  <article class="panel">
    <h3>Spielzeit</h3>
    <dl>
      <dt title="Spiel sichtbar und in den letzten 2 Minuten eine Eingabe">Aktiv gespielt</dt><dd class="num">{formatDuration(data.active)}</dd>
      <dt title="Simulierte Zeit, auch offline und im Hintergrund">Mit Offline-Zeit</dt><dd class="num">{formatDuration(data.playTime)}</dd>
      <dt>Sitzungen</dt><dd class="num">{formatNumber(data.sessions)}</dd>
      {#if data.sessions > 0}
        <dt>Längste Sitzung</dt><dd class="num">{formatDuration(data.longest)}</dd>
        <dt>Ø Sitzung</dt><dd class="num">{formatDuration(data.average)}</dd>
      {/if}
    </dl>
    <p class="small muted">Eine neue Sitzung beginnt nach mehr als 5 Minuten Pause.</p>
  </article>
  <article class="panel">
    <h3>Meilensteine <span class="small muted">aktive Spielzeit</span></h3>
    {#if data.milestones.length === 0}
      <p class="small muted">Noch keine – sie werden ab jetzt festgehalten.</p>
    {:else}
      <ol class="miles">
        {#each data.milestones as m (m.key)}
          <li><span>{m.label}</span><span class="num" title="Insgesamt mit Offline-Zeit: {formatDuration(m.simMs)}">{m.activeMs > 0 ? formatDuration(m.activeMs) : 'zu Beginn'}</span></li>
        {/each}
      </ol>
      <p class="small muted">Gezählt seit dem Update mit der aktiven Spielzeit; Früheres ist nicht erfasst.</p>
    {/if}
  </article>
  <article class="panel">
    <h3>Allgemein</h3>
    <dl>
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
        <li class:done={a.done}>{a.done ? '🏆' : '🔒'} <b>{a.def.name}</b> <span class="muted">– {a.def.description}</span>{#if a.at && a.at.activeMs > 0}{' · '}<span class="small at num">nach {formatDuration(a.at.activeMs)} aktiv</span>{/if}</li>
      {/each}
    </ul>
  </article>
</div>

<style>
  dl { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 1rem; margin: 0; }
  dd { margin: 0; text-align: right; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; font-size: 0.9rem; }
  li:not(.done) { opacity: 0.6; }
  .small { font-size: 0.8rem; }
  .at { color: var(--teal); }
  .miles { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.25rem; font-size: 0.88rem; max-height: 22rem; overflow-y: auto; }
  .miles li { display: flex; justify-content: space-between; gap: 0.75rem; opacity: 1; }
</style>
