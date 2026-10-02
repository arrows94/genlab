<script lang="ts">
  import { content } from '@content/index';
  import { formatPercent } from '@core/format';
  import { keeperBonus, nestKeeperSlots, nestKeepers, setNestKeeper } from '@core/features/breeding';
  import { inRecycler } from '@core/features/automation';
  import { game, view, act } from '../store.svelte';

  /**
   * Nestwärter: one creature at the nests whose own breeding bonuses (Brutpfleger, Mutagen, Fruchtbar …)
   * count for every egg. Only free or working creatures with such a bonus are offered.
   */
  let pick = $state<number | null>(null);

  const bonusText = (b: { time: number; mutation: number }) =>
    [b.time < 1 ? `−${formatPercent(1 - b.time, 0)} Brutzeit` : '', b.mutation > 0 ? `+${formatPercent(b.mutation, 0)} Mutation` : ''].filter(Boolean).join(' · ');

  const data = $derived.by(() => {
    view.slowFrame;
    const keepers = nestKeepers(game).map((c) => ({ c, bonus: keeperBonus(game, c) }));
    const candidates = game.state.creatures
      .filter((c) => (c.job === null || c.job.kind === 'building') && !inRecycler(game, c.id))
      .map((c) => ({ c, bonus: keeperBonus(game, c) }))
      .filter((x) => x.bonus.time < 1 || x.bonus.mutation > 0)
      .sort((x, y) => x.bonus.time - y.bonus.time || y.bonus.mutation - x.bonus.mutation)
      .slice(0, 20);
    return { keepers, candidates, slots: nestKeeperSlots(game) };
  });
  const chosen = $derived(data.candidates.find((x) => x.c.id === pick) ?? data.candidates[0] ?? null);
</script>

<article class="panel keeper">
  <h3>🪺 Nestwärter <span class="muted small">{data.keepers.length}/{data.slots} · seine Brut-Boni gelten für jedes Ei</span></h3>
  {#each data.keepers as k (k.c.id)}
    <div class="row">
      <span><b>{k.c.name}</b> <span class="muted small">{content.species.get(k.c.speciesId).name}</span></span>
      <span class="bonus">{bonusText(k.bonus) || 'keine Brut-Boni'}</span>
      <button onclick={() => act(setNestKeeper(game, null))}>Ablösen</button>
    </div>
  {/each}
  {#if data.candidates.length > 0}
    <div class="row">
      <select value={chosen?.c.id} onchange={(e) => (pick = Number(e.currentTarget.value))} title="Kreatur für den Nestwärter-Platz">
        {#each data.candidates as x (x.c.id)}<option value={x.c.id}>{x.c.name} – {bonusText(x.bonus)}</option>{/each}
      </select>
      <button class="primary" disabled={!chosen} onclick={() => chosen && act(setNestKeeper(game, chosen.c.id))}>
        {data.keepers.length >= data.slots ? 'Austauschen' : 'Einsetzen'}
      </button>
    </div>
    <p class="muted small">Der Nestwärter arbeitet und brütet nicht selbst, solange er wacht.</p>
  {:else if data.keepers.length === 0}
    <p class="muted small">Keine freie Kreatur mit Brut-Boni – etwa Brutpfleger, Mutagen oder das Gen „Fruchtbar“. Züchte gezielt darauf: Haben beide Eltern dieselbe Fähigkeit, erbt das Kind sie fast immer.</p>
  {/if}
</article>

<style>
  .keeper { display: grid; gap: 0.45rem; margin-bottom: 0.8rem; }
  h3 { margin: 0; }
  .small { font-size: 0.8rem; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  .row select { flex: 1 1 14rem; min-width: 0; }
  .bonus { color: var(--teal); font-size: 0.85rem; }
  p { margin: 0; }
</style>
