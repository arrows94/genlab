<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { formatDuration, formatPercent } from '@core/format';
  import { breedingCost, breedingTimeMs, eggs, mutationChance, nestSlots, offspringGeneration, startBreeding, type EggData } from '@core/features/breeding';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CostLabel from './CostLabel.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import BreedingPlanner from './BreedingPlanner.svelte';
  import { setAutoBreed } from '@core/features/automation';
  import { stableCapacity, stableFree } from '@core/features/stable';

  let parentA = $state<number | null>(null);
  let parentB = $state<number | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const available = game.state.creatures.filter((c) => c.job === null || c.job.kind === 'building');
    const a = parentA !== null ? findCreature(game, parentA) : undefined;
    const b = parentB !== null ? findCreature(game, parentB) : undefined;
    const generation = offspringGeneration(a, b);
    const cost = breedingCost(game, generation);
    return {
      a,
      b,
      stableFree: stableFree(game),
      stableCap: stableCapacity(game),
      automaton: game.state.features['autoBreed'] === true,
      autoBreed: game.state.automation.autoBreed,
      ownedSpecies: content.species.list.filter((s) => game.state.creatures.some((c) => c.speciesId === s.id)),
      slots: nestSlots(game),
      eggs: eggs(game).map((p) => {
        const d = p.data as EggData;
        return {
          id: p.id,
          progress: p.elapsedMs / p.durationMs,
          remaining: processRemainingMs(game, p),
          names: d.parents.map((id) => findCreature(game, id)?.name ?? '?'),
          generation: d.generation,
        };
      }),
      available,
      cost,
      affordable: canAfford(game.state, cost),
      generation,
      time: breedingTimeMs(game, generation, [a, b]),
      mutation: mutationChance(game),
    };
  });

  function breed() {
    if (parentA === null || parentB === null) return;
    if (act(startBreeding(game, parentA, parentB))) {
      parentA = null;
      parentB = null;
    }
  }
</script>

<h2>Brutstation <span class="muted num">{data.eggs.length}/{data.slots} Nester · Stall {data.stableCap - data.stableFree}/{data.stableCap}</span></h2>

{#if data.automaton}
  <div class="panel auto">
    <b>🤖 Zuchtautomat</b>
    <label><input type="checkbox" checked={data.autoBreed.enabled} onchange={(e) => act(setAutoBreed(game, e.currentTarget.checked, data.autoBreed.rule, data.autoBreed.species))} /> aktiv</label>
    <label>Züchte immer die zwei besten für
      <select value={data.autoBreed.rule} onchange={(e) => act(setAutoBreed(game, data.autoBreed.enabled, e.currentTarget.value, data.autoBreed.species))}>
        <option value="power">Gesamtstärke</option>
        {#each content.stats.list as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
    <label>Art
      <select value={data.autoBreed.species ?? ''} onchange={(e) => act(setAutoBreed(game, data.autoBreed.enabled, data.autoBreed.rule, e.currentTarget.value || null))}>
        <option value="">beliebig</option>
        {#each data.ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
      </select>
    </label>
  </div>
{/if}

<div class="grid">
  {#each data.eggs as egg (egg.id)}
    <article class="panel egg" class:soon={egg.progress > 0.85}>
      <h3><span class="eggicon">🥚</span> Ei · Gen {egg.generation}</h3>
      <p class="muted small">{egg.names.join(' × ')}</p>
      <DnaHelix progress={egg.progress} pairs={16} width={220} height={40} />
      <p class="num small">noch {formatDuration(egg.remaining)}</p>
    </article>
  {/each}

  {#if data.eggs.length < data.slots}
    <article class="panel">
      <h3>Neues Ei</h3>
      <div class="pick">
        <CreaturePicker creatures={data.available.filter((c) => c.id !== parentB)} bind:value={parentA} placeholder="Elternteil 1 …" />
        <CreaturePicker creatures={data.available.filter((c) => c.id !== parentA)} bind:value={parentB} placeholder="Elternteil 2 …" />
      </div>
      <p class="small muted">
        Generation <span class="num">{data.generation}</span> · Brutzeit <span class="num">{formatDuration(data.time)}</span> · Mutation <span class="num">{formatPercent(data.mutation)}</span>
      </p>
      <p class="small muted">Arbeitende Eltern werden von ihrer Anlage abgezogen.</p>
      <button class="primary" disabled={parentA === null || parentB === null || !data.affordable} onclick={breed}>
        Brüten · <CostLabel cost={data.cost} />
      </button>
      {#if data.a && data.b}<BreedingPlanner a={data.a} b={data.b} />{/if}
    </article>
  {/if}
</div>

<p class="muted small hint">
  Nachwuchs erbt gemittelte Werte, Aussehen und Fähigkeiten der Eltern. Mutationen können Werte steigern oder neue Fähigkeiten bringen.
  Die Seltenheit wird bei jeder Geburt neu gewürfelt ({content.rarities.list.length} Stufen).
</p>

<style>
  .small { font-size: 0.85rem; margin: 0.3rem 0; }
  .pick { display: grid; gap: 0.4rem; margin-bottom: 0.4rem; }
  .egg { display: flex; flex-direction: column; align-items: flex-start; }
  .eggicon { display: inline-block; }
  .soon .eggicon { animation: wobble 0.5s ease-in-out infinite; }
  @keyframes wobble { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
  article:has(:global(.planner)) { grid-column: 1 / -1; }
  button { width: 100%; }
  .hint { margin-top: 1rem; }
  .auto { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
</style>
