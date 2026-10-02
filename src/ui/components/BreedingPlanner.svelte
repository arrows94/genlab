<script lang="ts">
  import { meter } from '../meter';
  import { content } from '@content/index';
  import { formatNumber, formatPercent } from '@core/format';
  import { breedingPreview } from '@core/features/planner';
  import type { Creature } from '@core/state';
  import type { BreedingRitualDef } from '@core/content/types';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /** Visual breeding planner: species bars, rarity strip, stat ranges vs. parents, gene outcomes. */
  let { a, b, ritual }: { a: Creature; b: Creature; ritual?: BreedingRitualDef } = $props();

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };

  const preview = $derived.by(() => {
    view.frame;
    return breedingPreview(game, a, b, ritual);
  });
  // Parent marks use base stats like the predicted range (both before rarity and bonuses).
  const stats = $derived.by(() => {
    view.frame;
    return content.stats.list.map((s) => {
      const [lo, hi] = preview.stats[s.id] ?? [0, 0];
      const pa = a.stats[s.id] ?? 0;
      const pb = b.stats[s.id] ?? 0;
      const max = Math.max(1, hi, pa, pb) * 1.05;
      return { s, lo, hi, pa, pb, max };
    });
  });
  const rarities = $derived(content.rarities.list.map((r) => ({ r, p: preview.rarity[r.id] ?? 0 })).filter((x) => x.p > 0));
</script>

<div class="planner">
  <div class="cols">
    <section>
      <h5>Art</h5>
      <ul class="species">
        {#each preview.species as s, i (i)}
          {@const sp = s.id ? content.species.get(s.id) : null}
          <li>
            <span class="icon" class:unknown={!sp}>
              {#if sp}<CreatureSvg appearance={{ ...neutral, hue: sp.hue }} shape={sp.shape} tier={sp.tier} size={28} />{:else}❔{/if}
            </span>
            <span class="sname">{sp ? sp.name : 'Unbekannte Kreuzung'}</span>
            <span class="pbar" use:meter={s.p}><span style="width: {s.p * 100}%" class:hybrid={!sp || sp.tier !== 'base'}></span></span>
            <b class="num">{formatPercent(s.p, 0)}</b>
          </li>
        {/each}
      </ul>

      <h5>Seltenheit</h5>
      <div class="strip">
        {#each rarities as { r, p } (r.id)}
          <span style="flex: {p}; background: {r.color}" title="{r.name} {formatPercent(p, 1)}"></span>
        {/each}
      </div>
      <div class="legend">
        {#each rarities as { r, p } (r.id)}
          <span><i style="background: {r.color}"></i>{r.name} <b class="num">{formatPercent(p, 1)}</b></span>
        {/each}
      </div>
    </section>

    <section>
      <h5>Grundwerte <span class="muted">(Balken: möglicher Bereich · ▲ Eltern)</span></h5>
      <ul class="stats">
        {#each stats as st (st.s.id)}
          <li>
            <span class="stname">{st.s.name}</span>
            <span class="range">
              <span class="band" style="left: {(st.lo / st.max) * 100}%; width: {Math.max(1.5, ((st.hi - st.lo) / st.max) * 100)}%"></span>
              <span class="mark a" style="left: {(st.pa / st.max) * 100}%" title="{a.name}: {formatNumber(st.pa)}"></span>
              <span class="mark b" style="left: {(st.pb / st.max) * 100}%" title="{b.name}: {formatNumber(st.pb)}"></span>
            </span>
            <span class="num small">{formatNumber(st.lo)}–{formatNumber(st.hi)}</span>
          </li>
        {/each}
      </ul>
    </section>
  </div>

  <h5>Gene <span class="muted">(Mutation {formatPercent(preview.mutationChance * game.balance.genetics.alleleMutationFactor, 1)} je Allel)</span></h5>
  {#if preview.loci.every((l) => !l.known)}
    <p class="muted small">🔒 Unbekannt – sequenziere beide Eltern im Genlabor, um die Vererbung genau vorherzusagen.</p>
  {:else}
    <div class="loci">
      {#each preview.loci as l (l.locus)}
        <div class="locus">
          <span class="lname">{l.name}</span>
          <div class="outs">
            {#each l.outcomes as o (o.key)}
              <span class="out" style="--p: {o.p}">
                <span class="num key">{o.key}</span>
                <span>{o.phenotype}</span>
                <b class="num">{formatPercent(o.p, 0)}</b>
              </span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .planner { margin-top: 0.4rem; }
  h5 { margin: 0.6rem 0 0.3rem; font-size: 0.8rem; color: var(--muted); font-weight: 600; }
  h5 .muted { font-weight: 400; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.4rem 1rem; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; font-size: 0.82rem; }
  .small { font-size: 0.78rem; }

  .species li { display: grid; grid-template-columns: 28px minmax(0, 7rem) 1fr auto; align-items: center; gap: 0.4rem; }
  .icon { display: grid; place-items: center; width: 28px; height: 28px; }
  .icon.unknown { font-size: 1rem; }
  .sname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pbar { height: 8px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .pbar span { display: block; height: 100%; background: linear-gradient(90deg, var(--petrol), var(--teal)); }
  .pbar span.hybrid { background: linear-gradient(90deg, var(--violet), #ff7ad9); }

  .strip { display: flex; height: 12px; border-radius: 99px; overflow: hidden; border: 1px solid var(--line); }
  .strip span { min-width: 3px; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.2rem 0.7rem; margin-top: 0.3rem; font-size: 0.75rem; }
  .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.25rem; }

  .stats li { display: grid; grid-template-columns: minmax(0, 5.5rem) 1fr 4.5rem; align-items: center; gap: 0.5rem; }
  .stname { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .range { position: relative; height: 10px; border-radius: 99px; background: var(--bg-2); }
  .band { position: absolute; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, var(--petrol), var(--teal)); opacity: 0.85; }
  .mark { position: absolute; top: -5px; translate: -50% 0; width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 6px solid var(--gold); }
  .mark.b { border-top-color: #ff7ad9; }
  .stats .num { text-align: right; }

  .loci { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.35rem; }
  .locus { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.35rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .lname { font-size: 0.75rem; color: var(--muted); }
  .outs { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .out {
    display: inline-flex; gap: 0.3rem; align-items: center; padding: 0.1rem 0.45rem; border-radius: 6px; font-size: 0.75rem;
    background: linear-gradient(90deg, color-mix(in srgb, var(--teal) 28%, transparent) calc(var(--p) * 100%), transparent calc(var(--p) * 100%));
    border: 1px solid var(--line);
  }
  .key { color: var(--teal); }
</style>
