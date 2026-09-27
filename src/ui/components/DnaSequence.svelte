<script lang="ts">
  import { content } from '@content/index';
  import { alleleBases, alleleDef, phenotypeLabel } from '@core/genetics';
  import type { Genome } from '@core/state';

  /**
   * The game's signature view: the genome as a stylised DNA strand. Each locus
   * is a base-pair rung coloured by its two alleles. Unknown genomes show grey
   * rungs with "?".
   */
  let { genome, known, detailed = false }: { genome: Genome; known: boolean; detailed?: boolean } = $props();

  const rows = $derived(
    content.genes.list.map((locus) => {
      const pair = genome[locus.id];
      const a = pair ? alleleDef(locus, pair[0]) : undefined;
      const b = pair ? alleleDef(locus, pair[1]) : undefined;
      return {
        locus,
        a,
        b,
        phenotype: pair ? phenotypeLabel(locus, pair) : '',
        bases: pair ? alleleBases(pair[0], 3) + alleleBases(pair[1], 3) : '??????',
      };
    }),
  );
</script>

{#if detailed}
  <table class="detail">
    <tbody>
      {#each rows as r (r.locus.id)}
        <tr>
          <th>{r.locus.name}</th>
          <td class="rung">
            <span class="bar" style="background: {known ? r.a?.color : 'var(--line)'}"></span>
            <span class="bar" style="background: {known ? r.b?.color : 'var(--line)'}"></span>
          </td>
          <td class="num sym">{known ? `${r.a?.symbol}/${r.b?.symbol}` : '?/?'}</td>
          <td class="pheno">{known ? r.phenotype : 'unbekannt'}</td>
          <td class="num bases muted">{known ? r.bases : '······'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <div class="strand" title={known ? rows.map((r) => `${r.locus.name}: ${r.a?.symbol}/${r.b?.symbol} (${r.phenotype})`).join('\n') : 'Genom unbekannt – im Sequenzierlabor entschlüsseln'}>
    {#each rows as r, i (r.locus.id)}
      <span class="pair" style="--d: {i * 0.15}s">
        <span class="half" style="background: {known ? r.a?.color : 'var(--line)'}"></span>
        <span class="half" style="background: {known ? r.b?.color : 'var(--line)'}"></span>
      </span>
    {/each}
    {#if !known}<span class="q">?</span>{/if}
  </div>
{/if}

<style>
  .strand { position: relative; display: flex; gap: 3px; align-items: center; height: 22px; }
  .pair { display: flex; flex-direction: column; gap: 2px; animation: wobble 3s ease-in-out infinite; animation-delay: var(--d); }
  .half { display: block; width: 7px; height: 8px; border-radius: 2px; }
  .q { position: absolute; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: var(--muted); font-weight: 700; }
  @keyframes wobble { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }

  .detail { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  .detail th { text-align: left; font-weight: 500; color: var(--muted); padding: 0.2rem 0.5rem 0.2rem 0; white-space: nowrap; }
  .detail td { padding: 0.2rem 0.4rem; }
  .rung { display: flex; gap: 2px; }
  .bar { display: block; width: 26px; height: 10px; border-radius: 3px; }
  .sym { white-space: nowrap; }
  .bases { font-size: 0.7rem; letter-spacing: 0.1em; }
  @media (max-width: 480px) { .bases { display: none; } }
</style>
