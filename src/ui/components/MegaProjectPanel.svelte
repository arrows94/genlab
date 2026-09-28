<script lang="ts">
  import { content } from '@content/index';
  import { D } from '@core/num';
  import { formatDuration, formatNumber } from '@core/format';
  import {
    currentStage, depositMegaProject, depositPreview, megaAvailable, megaConstruction, megaProgress, megaState,
  } from '@core/features/megaProjects';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act, save } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CrystalSkip from './CrystalSkip.svelte';

  /**
   * Großprojekte: pay in over several visits, then each stage builds by the
   * clock. The Äon-Observatorium grows visibly with every finished stage.
   */
  const data = $derived.by(() => {
    view.slowFrame;
    return content.megaProjects.list
      .filter((def) => megaAvailable(game, def))
      .map((def) => {
        const st = megaState(game, def.id);
        const stage = currentStage(game, def);
        const proc = megaConstruction(game, def.id);
        return {
          def,
          done: st.stage,
          stage,
          proc,
          building: proc ? { progress: Math.min(1, proc.elapsedMs / proc.durationMs), remaining: processRemainingMs(game, proc) } : null,
          paidShare: megaProgress(game, def),
          rows: stage
            ? Object.entries(stage.cost).map(([res, total]) => {
                const paid = st.paid[res] ?? D(0);
                return { res, icon: content.resources.get(res).icon, name: content.resources.get(res).name, paid, total, share: Math.min(1, paid.div(total).toNumber()) };
              })
            : [],
          half: depositPreview(game, def, 0.5),
          all: depositPreview(game, def, 1),
        };
      });
  });

  function deposit(id: string, share: number) {
    if (act(depositMegaProject(game, id, share))) save();
  }
</script>

{#each data as x (x.def.id)}
  <article class="panel mega" class:complete={!x.stage}>
    <div class="art" aria-hidden="true">
      {#if x.def.id === 'observatory'}
        <svg viewBox="0 0 120 120" class:rise={!!x.building}>
          <defs>
            <radialGradient id="obs-sky" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stop-color="#2a2466" />
              <stop offset="100%" stop-color="#081319" />
            </radialGradient>
            <linearGradient id="obs-dome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#b8a4ff" />
              <stop offset="100%" stop-color="#5b44b8" />
            </linearGradient>
          </defs>
          <rect width="120" height="120" rx="14" fill="url(#obs-sky)" />
          <!-- Sternkarte: stars and constellation lines -->
          <g class="part" class:built={x.done >= 4} class:work={x.building && x.done === 3}>
            <path d="M14 22 L30 14 L44 26 M84 12 L100 20 L106 36" stroke="#e1bee7" stroke-width="0.8" fill="none" opacity="0.6" />
            {#each [[14, 22], [30, 14], [44, 26], [84, 12], [100, 20], [106, 36], [64, 8], [20, 46]] as [cx, cy], i (i)}
              <circle {cx} {cy} r={i % 3 === 0 ? 1.8 : 1.2} fill="#fff6c8" class="star" style="animation-delay: {i * 0.4}s" />
            {/each}
          </g>
          <!-- Linsen: telescope out of the dome -->
          <g class="part" class:built={x.done >= 3} class:work={x.building && x.done === 2}>
            <rect x="62" y="40" width="30" height="8" rx="3" fill="#8ecbff" transform="rotate(-32 62 48)" />
            <circle cx="86" cy="33" r="4" fill="#dff3ff" transform="rotate(-32 62 48)" class="lens" />
          </g>
          <!-- Kuppel -->
          <g class="part" class:built={x.done >= 2} class:work={x.building && x.done === 1}>
            <path d="M34 72 A26 26 0 0 1 86 72 Z" fill="url(#obs-dome)" />
            <rect x="57" y="47" width="6" height="25" fill="#2a2466" opacity="0.7" />
          </g>
          <!-- Fundament -->
          <g class="part" class:built={x.done >= 1} class:work={x.building && x.done === 0}>
            <rect x="30" y="72" width="60" height="26" rx="2" fill="#2c5560" />
            <rect x="24" y="96" width="72" height="8" rx="2" fill="#1f4650" />
            <rect x="52" y="82" width="16" height="16" rx="8" fill="#0c1f25" />
          </g>
          <rect x="10" y="104" width="100" height="4" rx="2" fill="#153139" />
        </svg>
      {:else}
        <span class="big-icon">{x.def.icon}</span>
      {/if}
    </div>

    <div class="body">
      <div class="title">
        <h3>{x.def.icon} {x.def.name}</h3>
        <span class="small muted num">{x.done}/{x.def.stages.length} Bauphasen</span>
      </div>
      <p class="small muted">{x.def.description}</p>

      <ol class="stages">
        {#each x.def.stages as s, i (i)}
          <li class:done={i < x.done} class:current={i === x.done} class:building={i === x.done && !!x.building} title={s.description}>
            <span class="dot">{i < x.done ? '✓' : i + 1}</span>
            <span class="name">{s.name}</span>
          </li>
        {/each}
      </ol>

      {#if !x.stage}
        <p class="finished">✓ Vollendet – alles, was es freischaltet, bleibt für immer.</p>
      {:else}
        <div class="now">
          <b>Bauphase {x.done + 1}: {x.stage.name}</b>
          <p class="small muted">{x.stage.description}</p>
          {#if x.building}
            <div class="bar build"><div style="width: {x.building.progress * 100}%"></div></div>
            <span class="small num muted">🏗️ Im Bau · noch {formatDuration(x.building.remaining)} <CrystalSkip process={x.proc} /></span>
          {:else}
            <div class="rows">
              {#each x.rows as r (r.res)}
                <div class="row" title={r.name}>
                  <span class="ricon">{r.icon}</span>
                  <div class="bar"><div style="width: {r.share * 100}%" class:full={r.share >= 1}></div></div>
                  <span class="small num">{formatNumber(r.paid)} / {formatNumber(r.total)}</span>
                </div>
              {/each}
            </div>
            <div class="actions">
              <button disabled={Object.keys(x.half).length === 0} onclick={() => deposit(x.def.id, 0.5)}>
                Hälfte einzahlen{#if Object.keys(x.half).length} · <CostLabel cost={x.half} />{/if}
              </button>
              <button class="primary" disabled={Object.keys(x.all).length === 0} onclick={() => deposit(x.def.id, 1)}>
                Alles einzahlen{#if Object.keys(x.all).length} · <CostLabel cost={x.all} />{/if}
              </button>
            </div>
            <span class="small muted">
              {Math.round(x.paidShare * 100)} % eingezahlt · danach ⏱ {formatDuration(x.stage.hours * 3_600_000)} Bauzeit. Einzahlungen bleiben über jeden Neustart erhalten – auch kurz vor einem Äon.
            </span>
          {/if}
        </div>
      {/if}
    </div>
  </article>
{/each}

<style>
  .mega { display: grid; grid-template-columns: 150px 1fr; gap: 0.9rem; align-items: start; margin-bottom: 0.9rem; border-color: color-mix(in srgb, var(--violet) 55%, var(--line)); }
  .mega.complete { border-color: var(--gold); box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 25%, transparent); }
  @media (max-width: 560px) {
    .mega { grid-template-columns: 1fr; }
    .art { width: 120px; margin: 0 auto; }
  }
  .art svg { width: 100%; display: block; }
  .big-icon { font-size: 4rem; display: block; text-align: center; }
  .part { opacity: 0.12; transition: opacity 0.6s; }
  .part.built { opacity: 1; }
  .part.work { opacity: 0.45; animation: work 1.6s ease-in-out infinite; }
  @keyframes work { 50% { opacity: 0.2; } }
  .star { animation: twinkle 3s ease-in-out infinite; }
  @keyframes twinkle { 50% { opacity: 0.35; } }
  .lens { filter: drop-shadow(0 0 3px #8ecbff); }

  .body { display: grid; gap: 0.4rem; min-width: 0; }
  .title { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
  h3 { margin: 0; }
  .small { font-size: 0.82rem; margin: 0; }

  .stages { list-style: none; display: flex; padding: 0; margin: 0.2rem 0; gap: 0; }
  .stages li { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; position: relative; font-size: 0.72rem; color: var(--muted); text-align: center; }
  .stages li + li::before { content: ''; position: absolute; top: 11px; right: 50%; width: 100%; height: 2px; background: var(--line); z-index: 0; }
  .stages li.done + li::before { background: var(--gold); }
  .dot { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.72rem; position: relative; z-index: 1; }
  .done .dot { background: var(--gold); color: #1a1405; border-color: var(--gold); }
  .done { color: var(--text); }
  .stages .current .dot { border-color: var(--violet); box-shadow: 0 0 8px color-mix(in srgb, var(--violet) 60%, transparent); }
  .stages .current { color: var(--text); font-weight: 600; }
  .building .dot { animation: work 1.6s ease-in-out infinite; }

  .now { display: grid; gap: 0.35rem; }
  .rows { display: grid; gap: 0.3rem; }
  .row { display: grid; grid-template-columns: 1.4rem 1fr auto; align-items: center; gap: 0.5rem; }
  .ricon { text-align: center; }
  .bar { height: 8px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--teal)); transition: width 0.4s; }
  .bar div.full { background: var(--gold); }
  .bar.build div { background: repeating-linear-gradient(45deg, var(--gold) 0 8px, #d9a93a 8px 16px); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .actions button { flex: 1 1 12rem; font-size: 0.85rem; }
  .finished { color: var(--gold); margin: 0; }
</style>
