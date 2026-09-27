<script lang="ts">
  import { content } from '@content/index';
  import { dexKey } from '@core/state';
  import { dexCount } from '@core/queries';
  import { game, view } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    return { dex: { ...game.state.dex }, count: dexCount(game) };
  });
</script>

<h2>Monster-Dex <span class="muted num">{data.count.found}/{data.count.total}</span></h2>
<div class="scroll panel">
  <table>
    <thead>
      <tr>
        <th>Art</th>
        {#each content.rarities.list as r (r.id)}<th style="color: {r.color}">{r.name}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each content.species.list as s (s.id)}
        {@const known = content.rarities.list.some((r) => data.dex[dexKey(s.id, r.id)])}
        <tr>
          <td class="species" style="color: {content.elements.get(s.element).color}">{known || s.tier === 'base' ? s.name : '???'}</td>
          {#each content.rarities.list as r (r.id)}
            <td class="cell" class:found={data.dex[dexKey(s.id, r.id)]} style="--c: {r.color}">{data.dex[dexKey(s.id, r.id)] ? '●' : '·'}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { padding: 0.35rem 0.5rem; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .species { text-align: left; font-weight: 600; }
  .cell { color: var(--line); }
  .cell.found { color: var(--c); text-shadow: 0 0 8px var(--c); }
</style>
