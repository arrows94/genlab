<script lang="ts">
  import { content } from '@content/index';
  import { conditionProgress } from '@core/conditions';
  import {
    abandonAnomaly, activeAnomalies, anomalyAvailable, anomalyBest, anomalyGoal, anomalyGoalText, anomalyProgress, maxStartLevel, startAnomalies,
  } from '@core/features/anomalies';
  import { game, view, act, save, ask } from '../store.svelte';

  /** Chosen stage per anomaly for the next run (0 = not part of it). */
  let pick = $state<Record<string, number>>({});

  const ROMAN = ['–', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const maxLevel = game.balance.anomalies.maxLevel;

  const data = $derived.by(() => {
    view.frame;
    const active = activeAnomalies(game);
    const running = active.length > 0;
    const list = content.anomalies.list.map((a) => {
      const level = running ? (game.state.anomaly?.levels[a.id] ?? 0) : (pick[a.id] ?? 0);
      return {
        a,
        best: anomalyBest(game, a.id),
        max: maxStartLevel(game, a.id),
        available: anomalyAvailable(game, a.id),
        level,
        goal: level > 0 ? anomalyGoalText(game, a.id, level) : anomalyGoalText(game, a.id, Math.max(1, anomalyBest(game, a.id) + 1)),
        progress: running && level > 0 ? conditionProgress(game.state, anomalyGoal(game, a.id, level)) : null,
      };
    });
    const total = list.reduce((n, x) => n + x.level, 0);
    const record = game.state.anomalyRecord;
    return {
      running,
      list,
      total,
      record,
      newShards: Math.max(0, total - record) * game.balance.anomalies.shardsPerRecordPoint,
      progress: anomalyProgress(game),
      mastered: list.filter((x) => x.best > 0).length,
      aeon: !!game.state.features.aeon,
    };
  });

  function choose(id: string, level: number) {
    pick = { ...pick, [id]: pick[id] === level ? 0 : level };
  }

  async function start() {
    const chosen = Object.fromEntries(Object.entries(pick).filter(([, l]) => l > 0));
    const names = Object.entries(chosen).map(([id, l]) => `${content.anomalies.get(id).name} ${ROMAN[l]}`).join(', ');
    if (!(await ask(`Anomalie-Lauf starten (${names})? Das setzt deinen Lauf wie eine Vererbung zurück – ohne Erbgut-Gewinn.`, { ok: 'Starten', danger: true }))) return;
    if (act(startAnomalies(game, chosen))) {
      pick = {};
      save();
    }
  }
  async function abandon() {
    if (await ask('Anomalie abbrechen? Es gibt keine Belohnung.', { ok: 'Abbrechen', danger: true })) act(abandonAnomaly(game));
  }
</script>

<header class="tab-head">
  <h2>🌀 Anomalien</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{data.mastered}/{data.list.length}</b><small>gemeistert</small></span>
    <span class="kpi" title="Höchste Gesamtschwierigkeit (Summe der Stufen) eines geschafften Laufs"><b class="num">🏆 {data.record}</b><small>Rekord-Schwierigkeit</small></span>
    <span class="kpi" class:live={data.running}><b class="num">{data.running ? data.total : '–'}</b><small>{data.running ? 'läuft gerade' : 'kein Lauf'}</small></span>
  </div>
</header>
<p class="muted small intro">
  Durchläufe mit veränderten Regeln. Jede Anomalie hat die Stufen I–{ROMAN[maxLevel]}; die nächste öffnet sich, wenn du die vorige meisterst.
  Du kannst mehrere kombinieren – geschafft ist der Lauf, wenn alle Ziele erreicht sind. Die Belohnung wächst mit der besten Stufe,
  und ein neuer Rekord in der Gesamtschwierigkeit bringt dauerhaft mehr Produktion und Erbgut{#if data.aeon} sowie Äon-Splitter{/if}. Beim Start wird dein Lauf wie bei einer Vererbung zurückgesetzt (ohne Erbgut).
</p>

{#if data.running}
  <article class="panel run">
    <div class="rhead">
      <b>▶ Anomalie-Lauf · Schwierigkeit {data.total}</b>
      <button onclick={abandon}>Abbrechen</button>
    </div>
    {#if data.progress !== null}
      <div class="goal big" title="Fortschritt – das langsamste Ziel zählt"><div style="width: {data.progress * 100}%"></div><span class="num">{Math.floor(data.progress * 100)} %</span></div>
    {/if}
  </article>
{/if}

<div class="grid">
  {#each data.list as x (x.a.id)}
    <article class="panel card" class:active={x.level > 0} class:done={x.best > 0} class:locked={!x.available}>
      <div class="chead">
        <h3>{x.a.name}</h3>
        {#if x.best > 0}<span class="badge">✓ Stufe {ROMAN[x.best]}</span>{/if}
      </div>
      <p class="small">{x.a.description}</p>
      {#if x.a.levelText}<p class="small muted per">Je weitere Stufe: {x.a.levelText}</p>{/if}

      {#if !data.running}
        <div class="stages" role="group" aria-label="Stufe für {x.a.name}">
          {#each Array.from({ length: maxLevel }, (_, i) => i + 1) as l (l)}
            <button class="stage" class:on={x.level === l} class:mastered={l <= x.best} disabled={!x.available || l > x.max} title={l > x.max ? 'Erst die vorige Stufe meistern' : `Stufe ${ROMAN[l]}`} onclick={() => choose(x.a.id, l)}>{ROMAN[l]}</button>
          {/each}
        </div>
      {:else if x.level > 0}
        <p class="small live">▶ Stufe {ROMAN[x.level]}</p>
      {/if}

      <p class="small"><b>Ziel{x.level > 0 ? ` (Stufe ${ROMAN[x.level]})` : ''}:</b> {x.goal}</p>
      {#if x.progress !== null}
        <div class="goal"><div style="width: {x.progress * 100}%"></div><span class="num">{Math.floor(x.progress * 100)} %</span></div>
      {/if}
      <p class="small reward"><b>Belohnung:</b> {x.a.rewardText} – je gemeisterter Stufe{#if x.best > 0}{' '}<span class="muted">(jetzt ×{x.best})</span>{/if}</p>
    </article>
  {/each}
</div>

{#if !data.running}
  <div class="panel summary">
    <span class="small">
      Gesamtschwierigkeit <b class="num">{data.total}</b> · Rekord <b class="num">{data.record}</b>
      {#if data.newShards > 0}<span class="gain">&nbsp;· neuer Rekord{#if data.aeon}: +{data.newShards} ⏳ Äon-Splitter{/if}</span>{/if}
    </span>
    <button class="primary" disabled={data.total === 0} onclick={start}>Anomalie-Lauf starten</button>
  </div>
{/if}

<style>
  .small { font-size: 0.82rem; margin: 0.3rem 0; }
  .per { margin-top: -0.2rem; font-size: 0.76rem; }
  .intro { margin: -0.2rem 0 0.7rem; }
  .run { margin-bottom: 0.75rem; border-color: var(--violet); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 35%, transparent); display: grid; gap: 0.4rem; }
  .rhead { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .card { display: flex; flex-direction: column; gap: 0.1rem; }
  .card.active { border-color: var(--violet); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 35%, transparent); }
  .card.locked { opacity: 0.55; }
  .chead { display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; }
  .chead h3 { margin: 0; }
  .done h3 { color: var(--gold); }
  .badge { font-size: 0.72rem; color: var(--gold); white-space: nowrap; }
  .reward { color: var(--gold); margin-top: auto; }
  .live { color: var(--violet); font-weight: 600; }
  .stages { display: flex; gap: 0.25rem; margin: 0.3rem 0; }
  .stage { flex: 1; padding: 0.25rem 0; font-size: 0.8rem; font-weight: 700; }
  .stage.mastered { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); color: var(--gold); }
  .stage.on { background: color-mix(in srgb, var(--violet) 35%, var(--panel-2)); border-color: var(--violet); color: #fff; }
  .goal { position: relative; height: 16px; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); overflow: hidden; margin: 0.2rem 0 0.4rem; }
  .goal.big { height: 20px; }
  .goal div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--teal)); transition: width 0.4s; }
  .goal span { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.7rem; font-weight: 700; text-shadow: 0 1px 2px #000; }
  .summary { position: sticky; z-index: 5; bottom: 0.5rem; margin-top: 0.75rem; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .gain { color: var(--gold); font-weight: 600; }
  /* Phones: stay above the bottom tab bar. */
  @media (max-width: 640px) { .summary { bottom: calc(4.6rem + env(safe-area-inset-bottom)); z-index: 5; } }
</style>
