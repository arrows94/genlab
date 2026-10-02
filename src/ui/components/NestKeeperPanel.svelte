<script lang="ts">
  import { content } from '@content/index';
  import { formatPercent } from '@core/format';
  import { expressedAppearance } from '@core/genetics';
  import { keeperBonus, nestKeepers, setNestKeeper } from '@core/features/breeding';
  import { inRecycler } from '@core/features/automation';
  import { game, view, act } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * Nestwärter as a small card next to the nests: one creature whose own breeding bonuses (Brutpfleger, Mutagen,
   * Fruchtbar …) count for every egg. The picker only opens on demand.
   */
  let picking = $state(false);
  let pick = $state<number | null>(null);

  const bonusText = (b: { time: number; mutation: number }) =>
    [b.time < 1 ? `−${formatPercent(1 - b.time, 0)} Brutzeit` : '', b.mutation > 0 ? `+${formatPercent(b.mutation, 0)} Mutation` : ''].filter(Boolean).join(' · ');

  const data = $derived.by(() => {
    view.slowFrame;
    const keeper = nestKeepers(game)[0];
    const candidates = game.state.creatures
      .filter((c) => (c.job === null || c.job.kind === 'building') && !inRecycler(game, c.id))
      .map((c) => ({ c, bonus: keeperBonus(game, c) }))
      .filter((x) => x.bonus.time < 1 || x.bonus.mutation > 0)
      .sort((x, y) => x.bonus.time - y.bonus.time || y.bonus.mutation - x.bonus.mutation)
      .slice(0, 20);
    return { keeper: keeper ? { c: keeper, bonus: keeperBonus(game, keeper) } : null, candidates };
  });
  const chosen = $derived(data.candidates.find((x) => x.c.id === pick) ?? data.candidates[0] ?? null);

  function place() {
    if (chosen && act(setNestKeeper(game, chosen.c.id))) picking = false;
  }
</script>

<article class="keeper" class:busy={!!data.keeper} title="Nestwärter: seine Brut-Boni gelten für jedes Ei. Er arbeitet und brütet nicht selbst, solange er wacht.">
  <span class="label tiny">🪺 Nestwärter</span>
  {#if data.keeper}
    {@const sp = content.species.get(data.keeper.c.speciesId)}
    <CreatureSvg appearance={expressedAppearance(game, data.keeper.c)} shape={sp.shape} tier={sp.tier} size={40} shiny={data.keeper.c.shiny} />
    <span class="small name">{data.keeper.c.name}</span>
    <span class="tiny bonus">{bonusText(data.keeper.bonus) || 'keine Brut-Boni'}</span>
  {:else}
    <span class="small muted empty">Frei</span>
  {/if}

  {#if picking}
    {#if data.candidates.length > 0}
      <select value={chosen?.c.id} onchange={(e) => (pick = Number(e.currentTarget.value))} title="Kreatur für den Nestwärter-Platz">
        {#each data.candidates as x (x.c.id)}<option value={x.c.id}>{x.c.name} – {bonusText(x.bonus)}</option>{/each}
      </select>
      <span class="actions"><button class="primary" onclick={place}>Einsetzen</button><button onclick={() => (picking = false)}>Abbrechen</button></span>
    {:else}
      <span class="tiny muted">Keine freie Kreatur mit Brut-Boni (Brutpfleger, Mutagen, Gen „Fruchtbar“ …).</span>
      <button onclick={() => (picking = false)}>Schließen</button>
    {/if}
  {:else}
    <span class="actions">
      <button onclick={() => (picking = true)}>{data.keeper ? 'Wechseln' : 'Einsetzen'}</button>
      {#if data.keeper}<button onclick={() => act(setNestKeeper(game, null))}>Ablösen</button>{/if}
    </span>
  {/if}
</article>

<style>
  .keeper {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25rem;
    padding: 1.3rem 0.5rem 0.6rem; text-align: center; min-width: 0;
    border-radius: var(--radius); border: 1px dashed color-mix(in srgb, var(--gold) 45%, var(--line)); background: var(--bg-2);
  }
  .keeper.busy { background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--gold) 8%, transparent), var(--panel) 70%); }
  .label { position: absolute; top: 0.3rem; left: 0.5rem; color: var(--gold); font-weight: 700; }
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.68rem; }
  .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bonus { color: var(--teal); }
  .empty { margin: 0.6rem 0; }
  select { width: 100%; font-size: 0.75rem; }
  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; }
  .actions button { font-size: 0.72rem; padding: 0.15rem 0.5rem; }
</style>
