<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { formatDuration, formatPercent } from '@core/format';
  import { isBeingSequenced, runningSequencing, sequencerSlots, sequencingCost, sequencingTimeMs, startSequencing, type SequenceData } from '@core/features/sequencing';
  import { instabilityChance, maxSplices, splice, spliceCost } from '@core/features/splicing';
  import { libraryHas } from '@core/genetics';
  import { processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CostLabel from './CostLabel.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import DnaSequence from './DnaSequence.svelte';

  let toSequence = $state<number | null>(null);
  let inspect = $state<number | null>(null);
  let spliceTarget = $state<number | null>(null);
  let spliceLocus = $state(content.genes.list[0]!.id);
  let spliceSlot = $state<0 | 1>(0);
  let spliceAllele = $state('');

  const data = $derived.by(() => {
    view.frame;
    const selected = toSequence !== null ? findCreature(game, toSequence) : undefined;
    const target = spliceTarget !== null ? findCreature(game, spliceTarget) : undefined;
    const libraryTotal = content.genes.list.reduce((n, l) => n + l.alleles.length, 0);
    return {
      slots: sequencerSlots(game),
      running: runningSequencing(game).map((p) => ({
        id: p.id,
        name: findCreature(game, (p.data as SequenceData).creatureId)?.name ?? '?',
        progress: p.elapsedMs / p.durationMs,
        remaining: processRemainingMs(game, p),
      })),
      unsequenced: game.state.creatures.filter((c) => !c.sequenced && !isBeingSequenced(game, c.id)),
      sequenced: game.state.creatures.filter((c) => c.sequenced),
      cost: selected ? sequencingCost(game, selected) : null,
      time: sequencingTimeMs(game),
      inspected: inspect !== null ? findCreature(game, inspect) : undefined,
      libraryCount: Object.keys(game.state.geneLibrary).length,
      libraryTotal,
      splicing: game.state.features['splicing'] === true,
      target,
      spliceCost: target ? spliceCost(game, target) : null,
      splicesLeft: target ? maxSplices(game) - (target.splices ?? 0) : 0,
      instability: instabilityChance(game),
    };
  });

  const library = $derived.by(() => {
    view.frame;
    return content.genes.list.map((locus) => ({
      locus,
      alleles: locus.alleles.map((a) => ({ a, found: libraryHas(game, locus.id, a.id) })),
    }));
  });

  const libraryAlleles = $derived.by(() => {
    view.frame;
    return content.genes.get(spliceLocus).alleles.filter((a) => libraryHas(game, spliceLocus, a.id));
  });
</script>

<h2>Genlabor</h2>

<section class="grid two">
  <article class="panel">
    <h3>🔬 Sequenzierlabor <span class="muted num">{data.running.length}/{data.slots}</span></h3>
    {#each data.running as r (r.id)}
      <div class="running">
        <span>{r.name}</span>
        <DnaHelix progress={r.progress} pairs={14} width={180} height={30} />
        <span class="num small muted">noch {formatDuration(r.remaining)}</span>
      </div>
    {/each}
    {#if data.running.length < data.slots}
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
  <section class="panel">
    <h3>✂️ Gen-Splicing</h3>
    <p class="small muted">Ersetze ein Allel durch eines aus der Genbibliothek. Instabilität {formatPercent(data.instability, 0)}: dann bleibt das Ziel unverändert und ein anderes Gen mutiert zufällig.</p>
    <div class="splice">
      <CreaturePicker creatures={data.sequenced} bind:value={spliceTarget} placeholder="Sequenzierte Kreatur …" />
      <select bind:value={spliceLocus} onchange={() => (spliceAllele = '')}>
        {#each content.genes.list as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
      </select>
      <select bind:value={spliceSlot}>
        <option value={0}>Allel 1{data.target ? ` (${data.target.genome[spliceLocus]?.[0]})` : ''}</option>
        <option value={1}>Allel 2{data.target ? ` (${data.target.genome[spliceLocus]?.[1]})` : ''}</option>
      </select>
      <select bind:value={spliceAllele}>
        <option value="">Neues Allel …</option>
        {#each libraryAlleles as a (a.id)}<option value={a.id}>{a.symbol} – {a.name}</option>{/each}
      </select>
    </div>
    {#if data.target}<p class="small muted num">Verbleibende Versuche: {data.splicesLeft}</p>{/if}
    <button class="primary" disabled={!data.target || !spliceAllele || data.splicesLeft <= 0 || !data.spliceCost || !canAfford(game.state, data.spliceCost)}
      onclick={() => spliceTarget !== null && act(splice(game, spliceTarget, spliceLocus, spliceSlot, spliceAllele))}>
      Splicen {#if data.spliceCost}· <CostLabel cost={data.spliceCost} />{/if}
    </button>
  </section>
{/if}

<style>
  section { margin-bottom: 1rem; }
  .two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .small { font-size: 0.85rem; margin: 0.35rem 0; }
  button { width: 100%; }
  .running { display: grid; gap: 0.2rem; margin-bottom: 0.6rem; }
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
  .splice { display: grid; gap: 0.4rem; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 0.4rem; }
  @media (max-width: 480px) { .locus { grid-template-columns: 1fr; gap: 0.2rem; } }
</style>
