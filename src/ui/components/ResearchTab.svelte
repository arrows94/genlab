<script lang="ts">
  import Meter from './Meter.svelte';
  import { buyUpgrade } from '@core/actions';
  import { CHANCE_TARGET, formatDuration, formatModifier, formatNumber, formatPercent } from '@core/format';
  import { researchEffect, researchTree, type ResearchNode } from '@core/research';
  import type { UpgradeDef } from '@core/content/types';
  import { game, view, act } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CostLabel from './CostLabel.svelte';
  import GrandResearchPanel from './GrandResearchPanel.svelte';

  /** More pips than this become a bar with a counter. */
  const MAX_PIPS = 12;

  const data = $derived.by(() => {
    view.frame;
    const branches = researchTree(game, 'research');
    const infinite = researchTree(game, 'infinite').flatMap((b) => b.nodes);
    const all = branches.flatMap((b) => b.nodes);
    const f = viewState.research;
    const shown = branches
      .filter((b) => !f.theme || b.theme.id === f.theme)
      // Filtered lists lose their parents, so they are shown flat.
      .map((b) => ({ ...b, affordable: b.nodes.filter((x) => x.affordable).length, nodes: f.affordableOnly ? b.nodes.filter((x) => x.affordable).map((x) => ({ ...x, depth: 0 })) : b.nodes }))
      .filter((b) => b.nodes.length > 0);
    return {
      branches,
      shown,
      infinite: f.affordableOnly ? infinite.filter((x) => x.affordable) : infinite,
      affordable: all.filter((x) => x.affordable).length,
      infiniteAffordable: infinite.filter((x) => x.affordable).length,
      levels: all.reduce((s, x) => s + x.level, 0),
      maxed: all.filter((x) => x.status === 'maxed').length,
      open: all.filter((x) => x.status !== 'locked').length,
    };
  });

  /** "×2,07", "−27 %", "+150 %", "+2" – the current total effect. */
  function effectText(def: UpgradeDef, level: number): string {
    const e = researchEffect(def, level);
    if (!e) return '';
    const target = def.modifiers[0]!.target;
    if (e.op === 'add' && !CHANCE_TARGET.test(target)) return `${formatModifier('add', e.value)}${target.startsWith('production.') ? '/s' : ''}`;
    return formatModifier(e.op, e.value, { decimals: 0, percentAdd: CHANCE_TARGET.test(target), reductionPercent: true });
  }

  function buy(x: ResearchNode) {
    act(buyUpgrade(game, x.def.id));
  }

  const pickTheme = (id: string) => (viewState.research.theme = viewState.research.theme === id ? '' : id);
</script>

<header class="tab-head">
  <h2>📜 Forschung</h2>
  <div class="kpis">
    <span class="kpi" class:live={data.affordable > 0}><b class="num">{data.affordable}</b><small>bezahlbar</small></span>
    <span class="kpi"><b class="num">{data.levels}</b><small>Stufen erforscht</small></span>
    <span class="kpi"><b class="num">{data.maxed}/{data.open}</b><small>abgeschlossen</small></span>
  </div>
</header>

{#if game.state.features['grandResearch']}<GrandResearchPanel />{/if}

<div class="toolbar">
  <div class="chips">
    <button class="chip" class:on={!viewState.research.theme} onclick={() => (viewState.research.theme = '')}>Alle</button>
    {#each data.branches as b (b.theme.id)}
      {@const n = b.nodes.filter((x) => x.affordable).length}
      <button class="chip" class:on={viewState.research.theme === b.theme.id} onclick={() => pickTheme(b.theme.id)}>
        {b.theme.icon} {b.theme.name}{#if n > 0}<span class="badge num">{n}</span>{/if}
      </button>
    {/each}
  </div>
  <label class="only"><input type="checkbox" bind:checked={viewState.research.affordableOnly} /> nur bezahlbare</label>
</div>

{#snippet pips(x: ResearchNode)}
  {#if x.def.maxLevel === null}
    <span class="lvl num">Stufe {x.level} · ∞</span>
  {:else if x.def.maxLevel <= MAX_PIPS}
    <span class="pips" title="Stufe {x.level} von {x.def.maxLevel}">
      {#each Array.from({ length: x.def.maxLevel }, (_, i) => i) as i (i)}<span class="pip" class:on={i < x.level}></span>{/each}
    </span>
  {:else}
    <span class="lvlbar" title="Stufe {x.level} von {x.def.maxLevel}">
      <span class="track"><Meter value={x.level / x.def.maxLevel} /></span>
      <span class="num">{x.level}/{x.def.maxLevel}</span>
    </span>
  {/if}
{/snippet}

{#snippet action(x: ResearchNode)}
  {#if x.status === 'maxed'}
    <span class="done-tag">✓ {x.def.maxLevel === 1 ? 'Erforscht' : 'Maximal'}</span>
  {:else if x.status === 'locked'}
    <span class="lock">🔒</span>
  {:else if x.cost}
    <button class="buy" class:primary={x.affordable} disabled={!x.affordable} onclick={() => buy(x)}><CostLabel cost={x.cost} /></button>
    {#if x.etaMs !== null}<span class="eta num" title="Geschätzt aus der aktuellen Produktion">⏱ {formatDuration(x.etaMs)}</span>{/if}
  {/if}
{/snippet}

<div class="branches">
  {#each data.shown as b (b.theme.id)}
    <article class="panel branch">
      <div class="bhead">
        <h3>{b.theme.icon} {b.theme.name}</h3>
        {#if b.affordable > 0}<span class="small ready">{b.affordable} bezahlbar</span>{/if}
      </div>
      <ol class="nodes">
        {#each b.nodes as x (x.def.id)}
          <li class="node {x.status}" class:affordable={x.affordable} style="--depth: {x.depth}">
            <div class="main">
              <div class="line">
                <b class="name">{x.def.name}</b>
                {#if x.level > 0 && x.def.modifiers.length}<span class="effect num">{effectText(x.def, x.level)}</span>{/if}
              </div>
              <span class="desc small">{x.def.description}</span>
              {#if x.status === 'locked'}
                <span class="needs small">benötigt: {x.missing.join(' · ')}</span>
              {:else if x.def.maxLevel !== 1}
                {@render pips(x)}
              {/if}
            </div>
            <div class="act">{@render action(x)}</div>
          </li>
        {/each}
      </ol>
    </article>
  {:else}
    <p class="muted">Gerade ist keine Forschung bezahlbar.</p>
  {/each}
</div>

{#if data.infinite.length > 0}
  <section class="infinite">
    <div class="bhead">
      <h2>♾️ Unendliche Forschung</h2>
      {#if data.infiniteAffordable > 0}<span class="small ready">{data.infiniteAffordable} bezahlbar</span>{/if}
    </div>
    <p class="small muted intro">Ohne Obergrenze – jede Stufe wird teurer und bringt etwas weniger.</p>
    <div class="inf-grid">
      {#each data.infinite as x (x.def.id)}
        <article class="panel inf" class:affordable={x.affordable}>
          <div class="line">
            <b>{x.def.name}</b>
            <span class="lvl num">Stufe {x.level}</span>
          </div>
          <span class="desc small">{x.def.description}</span>
          <span class="small num">
            {#if x.level > 0}<span class="muted">Wirkung</span> {effectText(x.def, x.level)} → {effectText(x.def, x.level + 1)}{:else}<span class="muted">Stufe 1:</span> {effectText(x.def, 1)}{/if}
          </span>
          <div class="act row">{@render action(x)}</div>
        </article>
      {/each}
    </div>
  </section>
{/if}

<style>
  .small { font-size: 0.8rem; }

  .toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; margin: 0.4rem 0 0.7rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip { font-size: 0.8rem; padding: 0.25rem 0.6rem; border-radius: 99px; background: var(--bg-2); position: relative; }
  .chip.on { background: var(--petrol); border-color: var(--teal); color: #fff; }
  .badge { margin-left: 0.35rem; background: var(--gold); color: #1a1405; border-radius: 99px; padding: 0 0.35rem; font-size: 0.7rem; font-weight: 700; }
  .only { font-size: 0.85rem; white-space: nowrap; }

  .branches { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); align-items: start; }
  .branch { display: grid; gap: 0.4rem; }
  .bhead { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .bhead h3, .bhead h2 { margin: 0; }
  .ready { color: var(--gold); font-weight: 600; }

  .nodes { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
  .node {
    position: relative; display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: center;
    margin-left: calc(var(--depth) * 1.2rem); padding: 0.45rem 0.55rem; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-2);
  }
  /* Tree connector to the parent above */
  .node[style*='--depth: 1']::before, .node[style*='--depth: 2']::before {
    content: ''; position: absolute; left: -0.8rem; top: -0.45rem; width: 0.7rem; height: calc(50% + 0.45rem);
    border-left: 2px solid var(--line); border-bottom: 2px solid var(--line); border-bottom-left-radius: 6px;
  }
  .node.affordable { border-color: var(--gold); box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 20%, transparent); background: color-mix(in srgb, var(--gold) 6%, var(--bg-2)); }
  .node.maxed { opacity: 0.6; }
  .node.locked { border-style: dashed; opacity: 0.75; background: transparent; }
  .main { display: grid; gap: 0.15rem; min-width: 0; }
  .line { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; justify-content: space-between; }
  .name { font-size: 0.92rem; }
  .effect { font-size: 0.78rem; color: var(--teal); font-weight: 600; }
  .desc { color: var(--muted); }
  .needs { color: var(--violet); }

  .pips { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 2px; }
  .pip { width: 12px; height: 6px; border-radius: 3px; background: var(--panel-2); border: 1px solid var(--line); }
  .pip.on { background: var(--teal); border-color: var(--teal); }
  .lvlbar { display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
  .track { display: flex; flex: 1; max-width: 10rem; }
  .lvl { font-size: 0.75rem; color: var(--muted); }

  .act { display: flex; flex-direction: column; align-items: flex-end; gap: 0.15rem; }
  .act.row { flex-direction: row; align-items: center; justify-content: space-between; margin-top: auto; }
  .buy { font-size: 0.8rem; padding: 0.35rem 0.6rem; white-space: nowrap; }
  .eta { font-size: 0.7rem; color: var(--muted); }
  .done-tag { color: var(--gold); font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
  .lock { font-size: 1.1rem; opacity: 0.7; }

  .infinite { margin-top: 1.2rem; padding: 0.8rem; border-radius: var(--radius); border: 1px solid color-mix(in srgb, var(--violet) 55%, var(--line)); background: radial-gradient(ellipse at top left, color-mix(in srgb, var(--violet) 12%, transparent), transparent 60%); }
  .intro { margin: 0.2rem 0 0.6rem; }
  .inf-grid { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
  .inf { display: flex; flex-direction: column; gap: 0.3rem; }
  .inf.affordable { border-color: var(--gold); box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 20%, transparent); }

  @media (max-width: 560px) {
    .node { grid-template-columns: 1fr; }
    .act { flex-direction: row; align-items: center; justify-content: space-between; }
  }
</style>
