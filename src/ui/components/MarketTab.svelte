<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { formatDuration, formatPercent } from '@core/format';
  import { potionCost, potionNeedsCreature, usePotion } from '@core/features/market';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CostLabel from './CostLabel.svelte';

  let target = $state<number | null>(null);
  let stat = $state('atk');

  const data = $derived.by(() => {
    view.frame;
    const creature = target !== null ? findCreature(game, target) : undefined;
    return {
      creature,
      buffs: game.state.buffs.map((b) => ({
        id: b.id,
        name: content.potions.has(b.source) ? content.potions.get(b.source).name : b.source,
        who: b.creatureId !== null ? (findCreature(game, b.creatureId)?.name ?? '?') : 'alle',
        remaining: b.remainingMs,
      })),
      potions: content.potions.list
        .filter((p) => game.state.features[p.feature])
        .map((p) => {
          const needs = potionNeedsCreature(game, p.id);
          const cost = potionCost(game, p.id, needs ? target : null);
          return { def: p, needs, cost, affordable: canAfford(game.state, cost) };
        }),
    };
  });
</script>

<h2>Markt</h2>

<article class="panel target">
  <h3>Ziel für Kreatur-Tränke</h3>
  <CreaturePicker creatures={game.state.creatures} bind:value={target} />
  {#if data.creature}
    <p class="small muted">
      Kraftfutter bisher: {#each content.stats.list as s (s.id)}<span class="num boost">{s.short} +{formatPercent(data.creature.boosts[s.id] ?? 0, 0)}</span>{/each}
    </p>
  {/if}
</article>

<div class="grid">
  {#each data.potions as p (p.def.id)}
    <article class="panel">
      <h3>{p.def.name}</h3>
      <p class="muted small">{p.def.description}</p>
      {#if p.def.kind === 'permanentStat'}
        <select bind:value={stat}>
          {#each content.stats.list as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
        </select>
      {/if}
      <button
        class="primary"
        disabled={(p.needs && target === null) || !p.affordable}
        onclick={() => act(usePotion(game, p.def.id, p.needs ? target : null, p.def.kind === 'permanentStat' ? stat : null))}
      >
        Kaufen · <CostLabel cost={p.cost} />
      </button>
    </article>
  {/each}
</div>

{#if data.buffs.length > 0}
  <h3 class="active">Aktive Effekte</h3>
  <ul>
    {#each data.buffs as b (b.id)}
      <li>{b.name} ({b.who}) · <span class="num">{formatDuration(b.remaining)}</span></li>
    {/each}
  </ul>
{/if}

<style>
  .small { font-size: 0.85rem; margin: 0.3rem 0; }
  .target { margin-bottom: 0.75rem; }
  .boost { margin-right: 0.6rem; }
  select { width: 100%; margin-bottom: 0.4rem; }
  button { width: 100%; }
  .active { margin-top: 1rem; }
</style>
