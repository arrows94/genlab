<script lang="ts">
  import { content } from '@content/index';
  import { formatPercent } from '@core/format';
  import { breedingPreview } from '@core/features/planner';
  import type { Creature } from '@core/state';
  import { game, view } from '../store.svelte';

  let { a, b }: { a: Creature; b: Creature } = $props();

  const preview = $derived.by(() => {
    view.frame;
    return breedingPreview(game, a, b);
  });
</script>

<div class="planner">
  <h4>Zuchtplaner</h4>
  <div class="cols">
    <div>
      <h5>Art</h5>
      <ul>
        {#each preview.species as s, i (i)}
          <li><span>{s.id ? content.species.get(s.id).name : '??? (unbekannte Kreuzung)'}</span><span class="num">{formatPercent(s.p, 0)}</span></li>
        {/each}
      </ul>
      <h5>Seltenheit</h5>
      <ul>
        {#each content.rarities.list as r (r.id)}
          <li><span style="color: {r.color}">{r.name}</span><span class="num">{formatPercent(preview.rarity[r.id] ?? 0, 1)}</span></li>
        {/each}
      </ul>
      <h5>Grundwerte</h5>
      <ul>
        {#each content.stats.list as s (s.id)}
          <li><span>{s.name}</span><span class="num">{preview.stats[s.id]?.[0]}–{preview.stats[s.id]?.[1]}</span></li>
        {/each}
      </ul>
    </div>
    <div>
      <h5>Gene <span class="muted">(Mutation {formatPercent(preview.mutationChance * game.balance.genetics.alleleMutationFactor, 1)} je Allel)</span></h5>
      {#if preview.loci.every((l) => !l.known)}
        <p class="muted small">Unbekannt – sequenziere beide Eltern im Genlabor, um die Vererbung genau vorherzusagen.</p>
      {:else}
        <table>
          <tbody>
            {#each preview.loci as l (l.locus)}
              <tr>
                <th>{l.name}</th>
                <td>
                  {#each l.outcomes as o (o.key)}
                    <span class="outcome"><span class="num">{o.key}</span> {o.phenotype} <b class="num">{formatPercent(o.p, 0)}</b></span>
                  {/each}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</div>

<style>
  .planner { margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid var(--line); }
  h4 { margin: 0 0 0.4rem; }
  h5 { margin: 0.5rem 0 0.2rem; font-size: 0.8rem; color: var(--muted); font-weight: 600; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; }
  ul { list-style: none; margin: 0; padding: 0; font-size: 0.82rem; }
  li { display: flex; justify-content: space-between; gap: 0.5rem; }
  table { border-collapse: collapse; font-size: 0.78rem; width: 100%; }
  th { text-align: left; font-weight: 500; color: var(--muted); padding: 0.15rem 0.4rem 0.15rem 0; vertical-align: top; white-space: nowrap; }
  td { padding: 0.15rem 0; }
  .outcome { display: inline-block; margin: 0 0.5rem 0.15rem 0; }
  .small { font-size: 0.82rem; }
</style>
