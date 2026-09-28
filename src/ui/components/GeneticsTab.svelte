<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { formatDuration } from '@core/format';
  import { DEEP_SEQUENCE, SEQUENCE, isBeingSequenced, sequencerSlots, sequencerUsed, sequencingCost, sequencingTimeMs, startSequencing, type SequenceData } from '@core/features/sequencing';
  import { deepSequencingBlocker, deepSequencingCost, deepSequencingTimeMs, startDeepSequencing } from '@core/features/deepSequencing';
  import { activeLoci, libraryHas } from '@core/genetics';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CostLabel from './CostLabel.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import DnaSequence from './DnaSequence.svelte';
  import SplicingBench from './SplicingBench.svelte';

  let toSequence = $state<number | null>(null);
  let inspect = $state<number | null>(null);
  let toDeep = $state<number | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const selected = toSequence !== null ? findCreature(game, toSequence) : undefined;
    const libraryTotal = activeLoci(game).reduce((n, l) => n + l.alleles.length, 0);
    return {
      slots: sequencerSlots(game),
      used: sequencerUsed(game),
      running: game.state.processes.filter((p) => p.kind === SEQUENCE || p.kind === DEEP_SEQUENCE).map((p) => ({
        id: p.id,
        deep: p.kind === DEEP_SEQUENCE,
        name: findCreature(game, (p.data as SequenceData).creatureId)?.name ?? '?',
        progress: p.elapsedMs / p.durationMs,
        remaining: processRemainingMs(game, p),
      })),
      unsequenced: game.state.creatures.filter((c) => !c.sequenced && !isBeingSequenced(game, c.id)),
      cost: selected ? sequencingCost(game, selected) : null,
      time: sequencingTimeMs(game),
      inspected: inspect !== null ? findCreature(game, inspect) : undefined,
      libraryCount: Object.keys(game.state.geneLibrary).length,
      libraryTotal,
      splicing: game.state.features['splicing'] === true,
      deepOn: game.state.features['deepSequencing'] === true,
      deepCandidates: game.state.creatures.filter((c) => !deepSequencingBlocker(game, c)),
      deepCost: deepSequencingCost(game),
      deepTime: deepSequencingTimeMs(game),
    };
  });

  const library = $derived.by(() => {
    view.frame;
    return activeLoci(game).map((locus) => ({
      locus,
      alleles: locus.alleles.map((a) => ({ a, found: libraryHas(game, locus.id, a.id) })),
    }));
  });

</script>

<h2>Genlabor</h2>

<section class="grid two">
  <article class="panel">
    <h3>🔬 Sequenzierlabor <span class="muted num">{data.used}/{data.slots}</span></h3>
    {#each data.running as r (r.id)}
      <div class="running" class:deep={r.deep}>
        <span>{r.name}{#if r.deep}<span class="small deep-tag">&ensp;· Tiefensequenzierung</span>{/if}</span>
        <DnaHelix progress={r.progress} pairs={14} width={180} height={30} />
        <span class="num small muted">noch {formatDuration(r.remaining)}</span>
      </div>
    {/each}
    {#if data.used < data.slots}
      <CreaturePicker creatures={data.unsequenced} bind:value={toSequence} placeholder="Unbekanntes Genom wählen …" />
      <p class="small muted">Dauer {formatDuration(data.time)}. Die Kreatur arbeitet währenddessen weiter.</p>
      <button class="primary" disabled={!data.cost || !canAfford(game.state, data.cost)} onclick={() => toSequence !== null && act(startSequencing(game, toSequence)) && (toSequence = null)}>
        Sequenzieren {#if data.cost}· <CostLabel cost={data.cost} />{/if}
      </button>
    {/if}
  </article>

  <article class="panel">
    <h3>🧬 Genom ansehen</h3>
    <CreaturePicker creatures={game.state.creatures} bind:value={inspect} />
    {#if data.inspected}
      <div class="inspect">
        <DnaSequence genome={data.inspected.genome} known={data.inspected.sequenced} detailed />
        {#if !data.inspected.sequenced}<p class="small muted">Noch nicht sequenziert – nur das Aussehen verrät etwas.</p>{/if}
      </div>
    {/if}
  </article>
</section>

{#if data.deepOn}
  <section class="panel deep-panel">
    <h3>🧿 Tiefensequenzierung</h3>
    <p class="small muted">
      Manche Kreaturen tragen eine verborgene <b>Erbanlage</b> – stark, vererbbar, aber erst wirksam, wenn sie aufgedeckt ist.
      Die Tiefensequenzierung dauert {formatDuration(data.deepTime)} und belegt einen Sequenzierer.{#if game.state.talents['ancientGenes']} Dabei kann ein schlummerndes Urgen erwachen.{/if}
    </p>
    {#if data.used >= data.slots}
      <p class="small muted">Alle Sequenzierer sind belegt.</p>
    {:else}
      <CreaturePicker creatures={data.deepCandidates} bind:value={toDeep} placeholder="Sequenzierte Kreatur wählen …" />
      <button class="primary" disabled={toDeep === null || !canAfford(game.state, data.deepCost)} onclick={() => toDeep !== null && act(startDeepSequencing(game, toDeep)) && (toDeep = null)}>
        Tief sequenzieren · <CostLabel cost={data.deepCost} />
      </button>
    {/if}
  </section>
{/if}

<section class="panel library">
  <h3>📚 Genbibliothek <span class="muted num">{data.libraryCount}/{data.libraryTotal}</span></h3>
  <div class="loci">
    {#each library as { locus, alleles } (locus.id)}
      <div class="locus">
        <div class="lname" title={locus.description}>{locus.name}</div>
        <div class="alleles">
          {#each alleles as { a, found } (a.id)}
            <span class="allele" class:found style="--c: {a.color}" title={found ? `${a.name} (${a.symbol})` : 'unbekannt'}>
              {found ? a.symbol : '?'}
              <small>{found ? a.name : '???'}</small>
            </span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

{#if data.splicing}
  <SplicingBench />
{/if}

<style>
  section { margin-bottom: 1rem; }
  .two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .small { font-size: 0.85rem; margin: 0.35rem 0; }
  button { width: 100%; }
  .running { display: grid; gap: 0.2rem; margin-bottom: 0.6rem; }
  .deep-tag { color: var(--violet); }
  .deep-panel { border-color: color-mix(in srgb, var(--violet) 45%, var(--line)); }
  .inspect { margin-top: 0.6rem; }
  .loci { display: grid; gap: 0.5rem; }
  .locus { display: grid; grid-template-columns: 9rem 1fr; gap: 0.5rem; align-items: center; }
  .lname { color: var(--muted); font-size: 0.85rem; }
  .alleles { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .allele {
    display: flex; flex-direction: column; align-items: center; min-width: 4.5rem; padding: 0.25rem 0.4rem;
    border-radius: 8px; border: 1px dashed var(--line); color: var(--muted); font-family: var(--mono);
  }
  .allele small { font-family: system-ui, sans-serif; font-size: 0.65rem; }
  .allele.found { border: 1px solid var(--c); color: var(--text); background: color-mix(in srgb, var(--c) 18%, transparent); }
  @media (max-width: 480px) { .locus { grid-template-columns: 1fr; gap: 0.2rem; } }
</style>
