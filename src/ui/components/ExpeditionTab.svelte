<script lang="ts">
  import { content } from '@content/index';
  import { canAfford, toCost } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { campSlots, hintChance, missionAvailable, missionDurationMs, missionSpecies, runningMissions, startMission, wildChance, type MissionData } from '@core/features/expedition';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CostLabel from './CostLabel.svelte';

  let chosen = $state<number | null>(null);

  const data = $derived.by(() => {
    view.frame;
    return {
      slots: campSlots(game),
      running: runningMissions(game).map((p) => {
        const d = p.data as MissionData;
        return {
          id: p.id,
          mission: content.missions.get(d.missionId),
          creature: findCreature(game, d.creatureId)?.name ?? '?',
          progress: p.elapsedMs / p.durationMs,
          remaining: processRemainingMs(game, p),
        };
      }),
      idle: game.state.creatures.filter((c) => c.job === null || c.job.kind === 'building'),
      missions: content.missions.list.filter((m) => missionAvailable(game, m.id)).map((m) => ({
        def: m,
        species: m.species ? missionSpecies(game, m.id).map((s) => content.species.get(s).name) : null,
        hint: game.state.features['hybrids'] ? hintChance(game, m.id) : 0,
        cost: toCost(m.cost),
        affordable: canAfford(game.state, toCost(m.cost)),
        duration: missionDurationMs(game, m.id),
        wild: wildChance(game, m.id),
      })),
    };
  });

  function send(missionId: string) {
    if (chosen === null) return;
    if (act(startMission(game, chosen, missionId))) chosen = null;
  }
</script>

<h2>Erkundung <span class="muted num">{data.running.length}/{data.slots} Camps</span></h2>

{#if data.running.length > 0}
  <div class="grid running">
    {#each data.running as r (r.id)}
      <article class="panel">
        <h3>🧭 {r.mission.name}</h3>
        <p class="muted small">{r.creature} ist unterwegs</p>
        <div class="bar"><div style="width: {Math.min(100, r.progress * 100)}%"></div></div>
        <p class="num small">noch {formatDuration(r.remaining)}</p>
      </article>
    {/each}
  </div>
{/if}

{#if data.running.length < data.slots}
  <article class="panel pick">
    <CreaturePicker creatures={data.idle} bind:value={chosen} placeholder="Wer geht auf Erkundung? …" />
  </article>
{:else}
  <p class="muted">Alle Camps sind belegt.</p>
{/if}
<div class="grid">
    {#each data.missions as m (m.def.id)}
      <article class="panel">
        <h3>{m.def.name}</h3>
        <p class="muted small">{m.def.description}</p>
        <p class="small num">⏱ {formatDuration(m.duration)} · 🐾 {formatPercent(m.wild, 0)} wilde Kreatur{#if m.hint > 0} · 📜 {formatPercent(m.hint, 0)} Hinweis{/if}</p>
        {#if m.species}<p class="small muted">Heimat von: {m.species.join(', ')}</p>{/if}
        <p class="small num">
          Beute: {#each Object.entries(m.def.rewards) as [res, [min, max]] (res)}<span class="reward">{formatNumber(min)}–{formatNumber(max)} {content.resources.get(res).icon}</span>{/each}
        </p>
        <button class="primary" disabled={chosen === null || !m.affordable || data.running.length >= data.slots} onclick={() => send(m.def.id)}>
          Losschicken · <CostLabel cost={m.cost} />
        </button>
      </article>
    {/each}
</div>

<style>
  .small { font-size: 0.85rem; margin: 0.3rem 0; }
  .running, .pick { margin-bottom: 0.75rem; }
  .bar { height: 8px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--teal), var(--violet)); transition: width 0.2s linear; }
  .reward { margin-right: 0.5rem; }
  button { width: 100%; }
</style>
