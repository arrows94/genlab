<script lang="ts">
  import { content } from '@content/index';
  import { assignJob } from '@core/actions';
  import { formatNumber } from '@core/format';
  import { jobCount, jobSlots } from '@core/systems/production';
  import { game, view, act } from '../store.svelte';
  import { autoAssign, setAutoAssign } from '@core/features/automation';

  const data = $derived.by(() => {
    view.frame;
    const rates = game.productionRates();
    const buildings = content.buildings.list
      .filter((b) => game.state.features[b.feature])
      .map((b) => ({
        def: b,
        used: jobCount(game, b.id),
        slots: jobSlots(game, b.id),
        workers: game.state.creatures.filter((c) => c.job?.kind === 'building' && c.job.target === b.id),
        rate: rates[b.produces],
      }));
    const idle = game.state.creatures.filter((c) => c.job === null);
    return { buildings, idle, planner: game.state.features['autoAssign'] === true, auto: game.state.automation.autoAssign };
  });
</script>

<h2>Anlagen</h2>
{#if data.planner}
  <div class="panel planner">
    <b>🗂️ Arbeitsplaner</b>
    <button class="primary" onclick={() => act(autoAssign(game))}>Jetzt optimal verteilen</button>
    <label><input type="checkbox" checked={data.auto} onchange={(e) => act(setAutoAssign(game, e.currentTarget.checked))} /> automatisch (alle {game.balance.automation.intervalSec} s)</label>
  </div>
{/if}
<div class="grid">
  {#each data.buildings as b (b.def.id)}
    <article class="panel">
      <h3>{b.def.icon} {b.def.name} <span class="muted num">{b.used}/{b.slots}</span></h3>
      <p class="muted small">{b.def.description}</p>
      {#if b.rate}<p class="num">+{formatNumber(b.rate)} {content.resources.get(b.def.produces).icon}/s</p>{/if}
      <ul>
        {#each b.workers as w (w.id)}
          <li>{w.name} <button onclick={() => act(assignJob(game, w.id, null))}>Abziehen</button></li>
        {/each}
      </ul>
      {#if b.used < b.slots && data.idle.length > 0}
        <select onchange={(e) => { const id = Number(e.currentTarget.value); if (id) act(assignJob(game, id, b.def.id)); e.currentTarget.value = ''; }}>
          <option value="">+ Kreatur zuweisen …</option>
          {#each data.idle as c (c.id)}<option value={c.id}>{c.name} ({content.species.get(c.speciesId).name})</option>{/each}
        </select>
      {/if}
    </article>
  {/each}
</div>

<style>
  .small { font-size: 0.85rem; }
  ul { list-style: none; padding: 0; margin: 0.5rem 0; display: grid; gap: 0.35rem; }
  li { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  li button { padding: 0.2rem 0.5rem; font-size: 0.8rem; }
  select { width: 100%; }
  .planner { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; }
</style>
