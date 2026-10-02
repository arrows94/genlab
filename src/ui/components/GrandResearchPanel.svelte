<script lang="ts">
  import { meter } from '../meter';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { formatDuration } from '@core/format';
  import {
    grandAvailable, grandCost, grandHours, grandLevel, grandSlots, runningGrandResearch, startGrandResearch, type GrandResearchData,
  } from '@core/features/grandResearch';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CostLabel from './CostLabel.svelte';
  import CrystalSkip from './CrystalSkip.svelte';

  /** Großforschung: the research slot(s) on top, the projects below (folded away by default). */
  const data = $derived.by(() => {
    view.slowFrame;
    const running = runningGrandResearch(game).map((p) => {
      const d = p.data as GrandResearchData;
      return { p, def: content.grandResearch.get(d.project), level: d.level, progress: Math.min(1, p.elapsedMs / p.durationMs), remaining: processRemainingMs(game, p) };
    });
    const slots = grandSlots(game);
    const busy = running.length >= slots;
    const projects = content.grandResearch.list
      .filter((def) => grandAvailable(game, def))
      .map((def) => {
        const level = grandLevel(game, def.id);
        const inProgress = running.some((r) => r.def.id === def.id);
        const next = level + (inProgress ? 1 : 0) + 1;
        const done = next > def.maxLevel;
        const cost = done ? null : grandCost(game, def, next);
        return { def, level, inProgress, done, cost, hours: done ? 0 : grandHours(def, next), canStart: !done && !busy && !!cost && canAfford(game.state, cost) };
      });
    return { running, slots, projects, startable: projects.filter((x) => x.canStart).length };
  });
</script>

<section class="grand" class:open={viewState.research.grandOpen}>
  <button class="ghead" aria-expanded={viewState.research.grandOpen} onclick={() => (viewState.research.grandOpen = !viewState.research.grandOpen)}>
    <h2>📜 Großforschung</h2>
    <span class="small muted">{data.running.length}/{data.slots} belegt{#if data.startable > 0} · <span class="ready">{data.startable} startbereit</span>{/if}</span>
    <span class="chev">{viewState.research.grandOpen ? 'Projekte einklappen ▴' : 'Projekte zeigen ▾'}</span>
  </button>
  {#if viewState.research.grandOpen}
    <p class="small muted intro">Projekte über Stunden und Tage mit großen Boni. Die Stufen bleiben für immer – auch über Vererbung und Äon –, und ein laufendes Projekt forscht durch jeden Neustart weiter.</p>
  {/if}

  <div class="slots">
    {#each Array.from({ length: data.slots }, (_, i) => i) as i (i)}
      {@const r = data.running[i]}
      <article class="panel slot" class:busy={!!r}>
        {#if r}
          <span class="icon">{r.def.icon}</span>
          <div class="info">
            <b>{r.def.name} · Stufe {r.level}</b>
            <div class="bar" use:meter={r.progress}><div style="width: {r.progress * 100}%"></div></div>
            <span class="small num muted">noch {formatDuration(r.remaining)} <CrystalSkip process={r.p} /></span>
          </div>
        {:else}
          <span class="icon">🧪</span>
          <span class="muted">Forschungsplatz frei – wähle ein Projekt.</span>
        {/if}
      </article>
    {/each}
  </div>

  {#if viewState.research.grandOpen}
    <div class="grid projects">
      {#each data.projects as x (x.def.id)}
        <article class="panel project" class:done={x.done}>
          <div class="top">
            <span class="picon">{x.def.icon}</span>
            <div>
              <h3>{x.def.name}</h3>
              <span class="pips" title="Stufe {x.level} von {x.def.maxLevel}">
                {#each Array.from({ length: x.def.maxLevel }, (_, i) => i) as i (i)}<span class="pip" class:on={i < x.level} class:run={x.inProgress && i === x.level}></span>{/each}
              </span>
            </div>
          </div>
          <p class="small muted">{x.def.description}</p>
          {#if x.done}
            <span class="max">{x.inProgress ? 'Letzte Stufe läuft' : 'Vollständig erforscht'}</span>
          {:else}
            <button class="primary" disabled={!x.canStart} onclick={() => act(startGrandResearch(game, x.def.id))}>
              ⏱ {formatDuration(x.hours * 3_600_000)} · {#if x.cost}<CostLabel cost={x.cost} />{/if}
            </button>
          {/if}
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .grand { margin-bottom: 1rem; padding: 0.5rem 0.6rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--bg-2); }
  .ghead { width: 100%; display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.3rem 0.7rem; padding: 0.1rem 0; border: 0; background: none; text-align: left; }
  .ghead h2 { margin: 0; }
  .chev { margin-left: auto; font-size: 0.78rem; color: var(--muted); }
  .ready { color: var(--gold); font-weight: 600; }
  .intro { margin: 0.4rem 0 0.6rem; }
  .small { font-size: 0.82rem; }
  .slots { display: grid; gap: 0.4rem; margin-top: 0.5rem; }
  .grand.open .slots { margin-bottom: 0.8rem; }
  .slot { display: flex; align-items: center; gap: 0.7rem; padding: 0.4rem 0.7rem; border-style: dashed; }
  .slot.busy { border-style: solid; border-color: var(--gold); }
  .icon { font-size: 1.4rem; }
  .info { display: grid; gap: 0.25rem; flex: 1; }
  .bar { height: 8px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--petrol), var(--gold)); }
  .projects { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); margin-bottom: 0.3rem; }
  .project { display: grid; gap: 0.35rem; align-content: start; }
  .project.done { opacity: 0.7; }
  .top { display: flex; gap: 0.55rem; align-items: center; }
  .picon { font-size: 1.6rem; }
  h3 { margin: 0; }
  .pips { display: flex; gap: 3px; margin-top: 3px; }
  .pip { width: 14px; height: 6px; border-radius: 3px; background: var(--panel-2); border: 1px solid var(--line); }
  .pip.on { background: var(--gold); border-color: var(--gold); }
  .pip.run { background: repeating-linear-gradient(90deg, var(--gold) 0 3px, transparent 3px 6px); }
  .max { color: var(--gold); font-size: 0.85rem; }
  .primary { width: 100%; }
</style>
