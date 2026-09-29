<script lang="ts">
  import { content } from '@content/index';
  import { abandonAnomaly, anomalyAvailable, startAnomaly } from '@core/features/anomalies';
  import { conditionProgress } from '@core/conditions';
  import { game, view, act, save, ask } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    return {
      active: game.state.anomaly?.id ?? null,
      progress: game.state.anomaly ? conditionProgress(game.state, content.anomalies.get(game.state.anomaly.id).goal) : null,
      list: content.anomalies.list.map((a) => ({ a, done: !!game.state.anomaliesCompleted[a.id], available: anomalyAvailable(game, a.id) })),
    };
  });

  async function start(id: string) {
    if ((await ask('Anomalie starten? Das setzt deinen Lauf wie eine Vererbung zurück – ohne Erbgut-Gewinn.', { ok: 'Starten', danger: true })) && act(startAnomaly(game, id))) save();
  }
  async function abandon() {
    if (await ask('Anomalie abbrechen? Es gibt keine Belohnung.', { ok: 'Abbrechen', danger: true })) act(abandonAnomaly(game));
  }
</script>

<header class="tab-head">
  <h2>🌀 Anomalien</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{data.list.filter((x) => x.done).length}/{data.list.length}</b><small>gemeistert</small></span>
    <span class="kpi" class:live={!!data.active}><b>{data.active ? content.anomalies.get(data.active).name : '–'}</b><small>{data.active ? 'läuft gerade' : 'keine aktiv'}</small></span>
  </div>
</header>
<p class="muted small">Durchläufe mit veränderten Regeln. Wer das Ziel erreicht, erhält eine dauerhafte Belohnung. Beim Start wird dein Lauf wie bei einer Vererbung zurückgesetzt (ohne Erbgut).</p>

<div class="grid">
  {#each data.list as { a, done, available } (a.id)}
    <article class="panel" class:active={data.active === a.id} class:done>
      <h3>{a.name} {#if done}<span class="badge">✓ gemeistert</span>{/if}</h3>
      <p class="small">{a.description}</p>
      <p class="small"><b>Ziel:</b> {a.goalText}</p>
      <p class="small reward"><b>Belohnung:</b> {a.rewardText}</p>
      {#if data.active === a.id}
        <p class="small live">▶ läuft gerade</p>
        {#if data.progress !== null}
          <div class="goal" title="Fortschritt zum Ziel"><div style="width: {data.progress * 100}%"></div><span class="num">{Math.floor(data.progress * 100)} %</span></div>
        {/if}
        <button onclick={abandon}>Abbrechen</button>
      {:else}
        <button class="primary" disabled={!!data.active || !available} onclick={() => start(a.id)}>{done ? 'Erneut spielen' : 'Starten'}</button>
      {/if}
    </article>
  {/each}
</div>

<style>
  .small { font-size: 0.82rem; margin: 0.3rem 0; }
  .reward { color: var(--gold); }
  .active { border-color: var(--violet); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 35%, transparent); }
  .done h3 { color: var(--gold); }
  .badge { font-size: 0.7rem; color: var(--gold); }
  .live { color: var(--violet); font-weight: 600; }
  button { width: 100%; }
  .goal { position: relative; height: 16px; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); overflow: hidden; margin: 0.2rem 0 0.5rem; }
  .goal div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--teal)); transition: width 0.4s; }
  .goal span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.7rem; font-weight: 700; text-shadow: 0 1px 2px #000; }
  .grid { margin-top: 0.4rem; }
</style>
