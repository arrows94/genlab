<script lang="ts">
  import { content } from '@content/index';
  import { dexKey } from '@core/state';
  import { dexCount } from '@core/queries';
  import { familyTree, perfectionSummary } from '@core/features/dex';
  import { viewState } from '../viewState.svelte';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  // Kept in viewState so the chosen view survives tab switches.
  const dex = viewState.dex;

  const data = $derived.by(() => {
    view.frame;
    return { dex: { ...game.state.dex }, count: dexCount(game), tree: familyTree(game), perfection: perfectionSummary(game) };
  });

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
</script>

<div class="head">
  <h2>Monster-Dex <span class="muted num">{data.count.found}/{data.count.total}</span></h2>
  <div class="switch">
    <button class:active={dex.mode === 'grid'} onclick={() => (dex.mode = 'grid')}>Raster</button>
    <button class:active={dex.mode === 'tree'} onclick={() => (dex.mode = 'tree')}>Stammbaum</button>
  </div>
</div>

<div class="panel perfection">
  <b>Perfektions-Jagd</b>
  <span title="Alle Loci reinerbig mit Top-Allelen (sequenziert)">✦ Perfekte Genome <span class="num">{data.perfection.perfect}/{data.perfection.species}</span></span>
  <span title="Seltene Farbmutation">🌈 Schillernd <span class="num">{data.perfection.shiny}/{data.perfection.species}</span></span>
  <span>👑 Mythische Endformen <span class="num">{data.perfection.mythic}/{data.perfection.mythicTotal}</span></span>
</div>

{#if dex.mode === 'grid'}
  <div class="scroll panel">
    <table>
      <thead>
        <tr>
          <th>Art</th>
          {#each content.rarities.list as r (r.id)}<th style="color: {r.color}">{r.name}</th>{/each}
          <th title="Perfektes Genom">✦</th>
          <th title="Schillernd">🌈</th>
        </tr>
      </thead>
      <tbody>
        {#each data.tree as group (group.tier)}
          <tr class="group"><td colspan={content.rarities.list.length + 3}>{group.name}</td></tr>
          {#each group.nodes as n (n.species.id)}
            <tr>
              <td class="species" style="color: {content.elements.get(n.species.element).color}">{n.discovered || n.species.tier === 'base' ? n.species.name : '???'}</td>
              {#each content.rarities.list as r (r.id)}
                <td class="cell" class:found={data.dex[dexKey(n.species.id, r.id)]} style="--c: {r.color}">{data.dex[dexKey(n.species.id, r.id)] ? '●' : '·'}</td>
              {/each}
              <td class="cell" class:found={n.perfect} style="--c: var(--gold)">{n.perfect ? '✦' : '·'}</td>
              <td class="cell" class:found={n.shiny} style="--c: #ff7ad9">{n.shiny ? '🌈' : '·'}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="tree">
    {#each data.tree as group (group.tier)}
      <section>
        <h3>{group.name} <span class="muted num">{group.nodes.filter((n) => n.discovered).length}/{group.nodes.length}</span></h3>
        <div class="nodes">
          {#each group.nodes as n (n.species.id)}
            {@const element = content.elements.get(n.species.element)}
            <article class="node panel" class:unknown={!n.discovered} style="--el: {element.color}">
              <div class="art">
                <CreatureSvg appearance={{ ...neutral, hue: n.species.hue }} shape={n.species.shape} tier={n.species.tier} size={56} />
              </div>
              <div class="info">
                <b>{n.discovered || n.species.tier === 'base' ? n.species.name : '???'}</b>
                <span class="el">{element.name}{#if n.discovered} · {n.rarities}/{content.rarities.list.length}{/if}</span>
                {#each n.origins as o (o.id)}
                  <div class="origin">
                    {#if o.kind === 'recipe'}
                      <span class="num">{o.from.map((f) => f ?? '???').join(' × ')}</span>
                    {:else}
                      <span>✨ aus {o.from[0] ?? '???'}</span>
                    {/if}
                    {#if o.requirements.length}<span class="muted req">{o.requirements.join(' · ')}</span>{/if}
                    {#if o.hint && !o.revealed}<span class="hint">„{o.hint}“</span>{/if}
                  </div>
                {/each}
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

<style>
  .perfection { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; padding: 0.5rem 0.8rem; margin-bottom: 0.75rem; font-size: 0.85rem; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .head h2 { margin: 0; }
  .switch { display: flex; gap: 0.3rem; }
  .switch button.active { border-color: var(--teal); background: color-mix(in srgb, var(--petrol) 45%, var(--panel-2)); }
  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { padding: 0.35rem 0.5rem; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .group td { text-align: left; color: var(--violet); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 0.8rem; }
  .species { text-align: left; font-weight: 600; }
  .cell { color: var(--line); }
  .cell.found { color: var(--c); text-shadow: 0 0 8px var(--c); }

  .tree section { margin-bottom: 1rem; }
  .nodes { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .node { display: flex; gap: 0.6rem; padding: 0.6rem; border-left: 3px solid var(--el); }
  .node.unknown .art { filter: brightness(0) opacity(0.35); }
  .info { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.82rem; min-width: 0; }
  .el { color: var(--el); font-size: 0.75rem; }
  .origin { display: flex; flex-direction: column; margin-top: 0.2rem; }
  .req { font-size: 0.72rem; }
  .hint { font-style: italic; color: var(--gold); font-size: 0.75rem; }
</style>
