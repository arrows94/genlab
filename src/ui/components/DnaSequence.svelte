<script lang="ts">
  import { activeLoci, alleleDef, phenotypeLabel } from '@core/genetics';
  import { game, view } from '../store.svelte';
  import type { Genome } from '@core/state';

  /**
   * The game's signature view: the genome as a stylised DNA strand. Each locus
   * is a base-pair rung coloured by its two alleles. Unknown genomes show grey
   * rungs with "?". The detailed breakdown lives in `GenomeView`.
   */
  let { genome, known }: { genome: Genome; known: boolean } = $props();

  // Only active loci: gated genes (Urgen) appear once their talent is learned.
  const rows = $derived.by(() => {
    view.frame;
    return activeLoci(game).map((locus) => {
      const pair = genome[locus.id];
      const a = pair ? alleleDef(locus, pair[0]) : undefined;
      const b = pair ? alleleDef(locus, pair[1]) : undefined;
      return {
        locus,
        a,
        b,
        phenotype: pair ? phenotypeLabel(locus, pair) : '',
      };
    });
  });
</script>

<div class="strand" title={known ? rows.map((r) => `${r.locus.name}: ${r.a?.symbol}/${r.b?.symbol} (${r.phenotype})`).join('\n') : 'Genom unbekannt – im Sequenzierlabor entschlüsseln'}>
  {#each rows as r, i (r.locus.id)}
    <span class="pair" style="--d: {i * 0.15}s">
      <span class="half" style="background: {known ? r.a?.color : 'var(--line)'}"></span>
      <span class="half" style="background: {known ? r.b?.color : 'var(--line)'}"></span>
    </span>
  {/each}
  {#if !known}<span class="q">?</span>{/if}
</div>

<style>
  .strand { position: relative; display: flex; gap: 3px; align-items: center; height: 22px; }
  .pair { display: flex; flex-direction: column; gap: 2px; animation: wobble 3s ease-in-out infinite; animation-delay: var(--d); }
  .half { display: block; width: 7px; height: 8px; border-radius: 2px; }
  .q { position: absolute; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: var(--muted); font-weight: 700; }
  @keyframes wobble { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
</style>
