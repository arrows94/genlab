<script lang="ts">
  import { content } from '@content/index';
  import { buyUpgrade, nextUpgradeCost } from '@core/actions';
  import { canAfford } from '@core/costs';
  import { formatNumber } from '@core/format';
  import { visibleUpgrades } from '@core/queries';
  import { game, view, act } from '../store.svelte';
  import GrandResearchPanel from './GrandResearchPanel.svelte';

  const toRows = (category: 'research' | 'infinite') =>
    visibleUpgrades(game, category).map((u) => {
      const cost = nextUpgradeCost(game, u.id);
      return { def: u, level: game.state.upgrades[u.id] ?? 0, cost, affordable: cost !== null && canAfford(game.state, cost) };
    });
  const sections = $derived.by(() => {
    view.frame;
    return [
      { title: 'Forschung', rows: toRows('research') },
      { title: 'Unendliche Forschung', rows: toRows('infinite') },
    ].filter((s) => s.rows.length > 0);
  });
</script>

{#if game.state.features['grandResearch']}<GrandResearchPanel />{/if}

{#each sections as section (section.title)}
<h2>{section.title}</h2>
<div class="grid section">
  {#each section.rows as r (r.def.id)}
    <article class="panel">
      <h3>{r.def.name}</h3>
      <p class="muted small">{r.def.description}</p>
      <p class="num small">Stufe {r.level}{r.def.maxLevel !== null ? ` / ${r.def.maxLevel}` : ' / ∞'}</p>
      {#if r.cost}
        <button class="primary" disabled={!r.affordable} onclick={() => act(buyUpgrade(game, r.def.id))}>
          {#each Object.entries(r.cost) as [res, amount] (res)}
            <span class="num">{formatNumber(amount)} {content.resources.get(res).icon}</span>
          {/each}
        </button>
      {:else}
        <span class="max">Maximal</span>
      {/if}
    </article>
  {/each}
</div>
{/each}

<style>
  .section { margin-bottom: 1.25rem; }
  .small { font-size: 0.85rem; margin: 0.25rem 0; }
  button { width: 100%; margin-top: 0.4rem; }
  .max { color: var(--gold); font-weight: 600; }
</style>
