<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { cellarLevelLabel, cellarView, setCellarAuto, startCellarRun, stopCellarRun } from '@core/features/cellar';
  import { game, view, act } from '../store.svelte';
  import Meter from './Meter.svelte';
  import CellarTeam from './CellarTeam.svelte';
  import DarkRelicPanel from './DarkRelicPanel.svelte';
  import CellarArena from './CellarArena.svelte';

  /**
   * Genom-Keller (functional view, the dark look comes later): header figures,
   * starting a descent, the shaft below with the next level's surroundings and
   * foes, the last fight, the Keller team, dark relics, Tiefen-Meilensteine and
   * the latest descents.
   */
  const data = $derived.by(() => {
    view.slowFrame;
    return cellarView(game);
  });
  const el = (id: string) => content.elements.get(id);
  const trait = (id: string | undefined) => (id && content.bossTraits.has(id) ? content.bossTraits.get(id) : null);
  const species = (id: string) => (content.species.has(id) ? content.species.get(id).name : id);
</script>

<div class="cellar">
<header class="tab-head">
  <h2>🕳️ Genom-Keller</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{data.best > 0 ? cellarLevelLabel(game, data.best) : '–'}</b><small>Tiefste Ebene</small></span>
    <span class="kpi"><b class="num">🚩 {data.checkpoint > 0 ? `−${data.checkpoint}` : 'Eingang'}</b><small>Kontrollpunkt</small></span>
    <span class="kpi" class:live={!!data.run}><b class="num">{data.run ? cellarLevelLabel(game, data.run.level) : '–'}</b><small>{data.run ? 'Aktueller Abstieg' : 'Kein Abstieg'}</small></span>
    <span class="kpi" title="Je Tag {data.perDay} neue Abstiege, bis zu {data.maxAttempts} lassen sich ansparen."><b class="num">⬇ {data.attempts}/{data.maxAttempts}</b><small>Abstiege</small></span>
    <span class="kpi"><b class="num">🌒 {formatNumber(data.marks)}</b><small>Schattenmarken</small></span>
    <span class="kpi" title="Äon-Splitter für neue Boss-Tiefen: höchstens {game.balance.cellar.weeklyShards} pro Woche."><b class="num">⏳ {data.shardRoom}</b><small>Splitter frei</small></span>
  </div>
</header>

<div class="controls panel">
  {#if data.run}
    <span>Abstieg läuft · nächste Ebene in {formatDuration(Math.max(0, data.intervalMs - data.run.elapsedMs))}</span>
    <span class="torch" title="Fackellicht: sinkt mit jeder Ebene, eine Rast zündet es neu. Darunter gehen mehr Angriffe daneben – nicht bei Nachtsicht.">
      🔥 <Meter size="sm" tone="gold" value={data.light} /> {formatPercent(data.light, 0)}
      {#if data.torchMiss > 0}<span class="bad small">+{formatPercent(data.torchMiss, 0)} Fehlschläge</span>{/if}
    </span>
    <button class="danger" onclick={() => act(stopCellarRun(game))}>Abstieg abbrechen</button>
  {:else}
    <button class="primary" disabled={data.attempts < 1 || data.team.length === 0} onclick={() => act(startCellarRun(game))}>
      ⬇ Abstieg ab {data.checkpoint > 0 ? `Ebene −${data.checkpoint}` : 'dem Eingang'} starten
    </button>
    <span class="small muted">Das Team heilt zwischen den Ebenen nicht – nur alle {game.balance.cellar.restEvery} Ebenen in einem Rast-Gewölbe.</span>
  {/if}
  <label class="auto small"><input type="checkbox" checked={data.auto} onchange={(e) => act(setCellarAuto(game, e.currentTarget.checked))} /> Auto-Abstieg</label>
</div>

<div class="stage">
  <!-- The shaft below: the next ten levels -->
  <ol class="shaft panel">
    {#each data.shaft as s (s.level)}
      <li class:boss={s.boss} class:guard={s.guard} class:next={s.level === data.next}>
        <span class="num" title={s.label}>−{s.level}</span>
        <span class="marks">
          {#if s.env}<span title={s.env.name}>{s.env.icon}</span>{/if}
          {#if s.boss}<span title="Boss: Schatten deiner Dynastie">👑</span>{:else if s.guard}<span title="Wächter">🛡️</span>{/if}
          {#if s.rest}<span title="Rast-Gewölbe nach dieser Ebene">🔥</span>{/if}
          {#if s.checkpoint}<span title="Kontrollpunkt">🚩</span>{/if}
          {#if s.milestone}<span title="Tiefen-Meilenstein: {s.milestone.name}">🏅</span>{/if}
        </span>
      </li>
    {/each}
  </ol>

  <div class="next-col">
    <CellarArena team={data.team} foes={data.foes} light={data.light} env={data.env?.id ?? null} />
    <article class="panel">
      <h3>Nächste Ebene: {data.nextLabel}</h3>
      {#if data.env}
        <p class="env"><b>{data.env.icon} {data.env.name}</b> <span class="muted small">(Ebene −{data.section.from} bis −{data.section.to})</span><br /><span class="muted small">{data.env.description}</span></p>
      {:else}
        <p class="muted small">Ein schlichtes Gewölbe – ab Ebene −{game.balance.cellar.environmentFrom} hat jeder Abschnitt seine eigene Umgebung.</p>
      {/if}
      {#if data.rules.length}
        <ul class="rules small">
          {#each data.rules as r, i (i)}<li>{r === data.weekly ? '📅 ' : ''}{r.text}</li>{/each}
        </ul>
      {/if}
      <div class="foes">
        {#each data.foes as f, i (i)}
          {@const t = trait(f.trait)}
          {@const p = trait(f.phaseTrait)}
          <span class="foe" class:shadow={f.shadow} style="--el: {el(f.element).color}">
            {f.name} <span class="muted small">· {el(f.element).name} · {formatNumber(f.maxHp)} KP</span>
            {#if t}<span class="small" title={t.description}>{t.icon} {t.name}</span>{/if}
            {#if p}<span class="small" title="Unter halben KP: {p.description}">→ {p.icon} {p.name}</span>{/if}
          </span>
        {/each}
      </div>
    </article>

    {#if data.lastResult}
      <details class="panel last">
        <summary>Letzter Kampf: {cellarLevelLabel(game, data.lastResult.floor)} <span class:good={data.lastResult.win} class:bad={!data.lastResult.win}>{data.lastResult.win ? 'gewonnen' : 'verloren'}</span></summary>
        <ul class="log small muted">
          {#each data.lastResult.log.slice(-8) as line, i (i)}<li>{line}</li>{/each}
        </ul>
      </details>
    {/if}
  </div>
</div>

<CellarTeam team={data.team} next={data.next} enemyElement={data.foes[0]?.element ?? 'fire'} />

<DarkRelicPanel course="cellar" />

<div class="bottom">
  <article class="panel">
    <h3>🏅 Tiefen-Meilensteine <span class="muted small">{data.reached.length}/{content.cellarMilestones.list.length}</span></h3>
    <ul class="milestones small">
      {#each content.cellarMilestones.list as m (m.id)}
        {@const done = data.reached.includes(m)}
        <li class:done class:next={m === data.nextMilestone}>
          <span class="num">−{m.level}</span> <b>{done || m === data.nextMilestone ? m.name : '???'}</b>
          <span class="muted">{done || m === data.nextMilestone ? m.description : ''}</span>
        </li>
      {/each}
    </ul>
  </article>
  <article class="panel">
    <h3>Letzte Abstiege</h3>
    {#if data.history.length}
      <ul class="history small">
        {#each data.history as h, i (i)}
          <li><span class="num">−{h.startLevel} → −{h.level}</span> <span class="muted">{h.team.map(species).join(', ')}</span></li>
        {/each}
      </ul>
    {:else}
      <p class="muted small">Noch kein Abstieg.</p>
    {/if}
  </article>
</div>
</div>

<style>
  /* The Keller's own colours: green-black stone, pale bioluminescence, rust and bone; red only for eyes. */
  .cellar {
    --abyss: #050a08; --bile: #9fd88a; --rust: #8a4b2a; --bone: #d8d0bb; --blood: #e0313a;
    --panel: #0b1310; --panel-2: #111c16; --bg-2: #0d1612; --line: #24321f; --teal: var(--bile); --petrol: #2c4a30;
    color: var(--bone);
  }
  .cellar :global(.panel) { background: linear-gradient(180deg, #0d1712, #080e0b); border-color: #24321f; box-shadow: inset 0 1px 0 #ffffff08; }
  .cellar :global(.kpi) { background: #0b130f; border-color: #24321f; }
  .cellar h2 { color: var(--bone); text-shadow: 0 0 12px #9fd88a33; }
  summary { cursor: pointer; font-weight: 600; }
  .small { font-size: 0.8rem; }
  .good { color: var(--teal); }
  .bad { color: var(--danger); }
  h3 { margin: 0 0 0.4rem; font-size: 0.95rem; }
  .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
  .auto { margin-left: auto; display: inline-flex; align-items: center; gap: 0.3rem; }
  .torch { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 10rem; }
  .torch :global(.meter) { width: 5rem; }
  .stage { display: grid; grid-template-columns: 11rem 1fr; gap: 0.75rem; align-items: start; }
  .shaft { list-style: none; margin: 0; padding: 0.4rem; display: grid; gap: 0.2rem; }
  .shaft li { display: flex; justify-content: space-between; gap: 0.3rem; padding: 0.2rem 0.4rem; border-radius: 6px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.8rem; }
  .shaft li.next { border-color: var(--teal); }
  .shaft li.boss { border-color: var(--danger); }
  .shaft li.guard { border-color: var(--gold); }
  .marks { display: inline-flex; gap: 0.15rem; }
  .next-col { display: grid; gap: 0.75rem; min-width: 0; }
  .env { margin: 0 0 0.4rem; }
  .rules { margin: 0 0 0.5rem; padding-left: 1.1rem; }
  .foes { display: grid; gap: 0.25rem; }
  .foe { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; padding: 0.25rem 0.5rem; border-left: 3px solid var(--el); background: var(--bg-2); border-radius: 6px; font-size: 0.85rem; }
  .foe.shadow { background: color-mix(in srgb, #000 35%, var(--bg-2)); font-weight: 600; }
  .log { margin: 0; padding-left: 1.1rem; }
  .bottom { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: 0.75rem; margin-top: 0.75rem; }
  .milestones, .history { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.2rem; }
  .milestones li { opacity: 0.55; }
  .milestones li.done { opacity: 1; }
  .milestones li.done b { color: var(--gold); }
  .milestones li.next { opacity: 0.9; }
  @media (max-width: 760px) {
    .stage { grid-template-columns: 1fr; }
    .shaft { grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr)); }
    .auto { margin-left: 0; }
  }
</style>
