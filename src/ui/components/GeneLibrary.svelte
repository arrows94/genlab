<script lang="ts">
  import Meter from './Meter.svelte';
  import { activeLoci, libraryHas } from '@core/genetics';
  import { game, view } from '../store.svelte';
  import { viewState } from '../viewState.svelte';

  /**
   * Gene library as a compact matrix: one line per gene with small allele
   * dots (symbol, colour, ★ for rare), progress per gene and category.
   * Complete genes can be hidden, the whole panel folds to its header.
   */
  const CATEGORIES: { id: string; name: string; icon: string }[] = [
    { id: 'stat', name: 'Werte', icon: '💪' },
    { id: 'trait', name: 'Eigenschaften', icon: '✨' },
    { id: 'visual', name: 'Aussehen', icon: '🎨' },
  ];
  /** Alleles at most this common count as rare finds. */
  const RARE_WEIGHT = 10;

  const lib = $derived.by(() => {
    view.slowFrame;
    const rows = activeLoci(game).map((locus) => {
      const alleles = locus.alleles.map((a) => ({ a, found: libraryHas(game, locus.id, a.id), rare: a.weight <= RARE_WEIGHT }));
      const found = alleles.filter((x) => x.found).length;
      return { locus, alleles, found, complete: found === alleles.length };
    });
    const found = rows.reduce((n, r) => n + r.found, 0);
    const total = rows.reduce((n, r) => n + r.alleles.length, 0);
    const groups = CATEGORIES.map((c) => {
      const all = rows.filter((r) => r.locus.category === c.id);
      return { ...c, all, rows: viewState.genome.hideCompleteGenes ? all.filter((r) => !r.complete) : all };
    }).filter((g) => g.all.length > 0);
    return { groups, found, total, complete: rows.filter((r) => r.complete).length, genes: rows.length, rareMissing: rows.flatMap((r) => r.alleles).filter((x) => x.rare && !x.found).length };
  });
</script>

<section class="panel library">
  <button class="head" onclick={() => (viewState.genome.libraryOpen = !viewState.genome.libraryOpen)} aria-expanded={viewState.genome.libraryOpen}>
    <h3>📚 Genbibliothek</h3>
    <span class="num count">{lib.found}/{lib.total}</span>
    <span class="bar"><Meter value={lib.found / Math.max(1, lib.total)} tone="violet" title="{lib.found} von {lib.total} Allelen" /></span>
    <span class="small muted sum">{lib.complete}/{lib.genes} Gene komplett{#if lib.rareMissing}{' · '}{lib.rareMissing} seltene ★ offen{/if}</span>
    <span class="chev" aria-hidden="true">{viewState.genome.libraryOpen ? '▾' : '▸'}</span>
  </button>

  {#if viewState.genome.libraryOpen}
    <div class="tools">
      <label class="toggle" class:on={viewState.genome.hideCompleteGenes}>
        <input type="checkbox" bind:checked={viewState.genome.hideCompleteGenes} /> komplette Gene ausblenden
      </label>
      <span class="small muted">★ = selten · Neue Allele aus Sequenzieren, Genom-Turm und Gen-Aufträgen</span>
    </div>
    {#each lib.groups as g (g.id)}
      <div class="group">
        <span class="gname"><span aria-hidden="true">{g.icon}</span> {g.name} <span class="num muted">{g.all.filter((r) => r.complete).length}/{g.all.length}</span></span>
        {#if g.rows.length === 0}
          <span class="small muted done">alle komplett ✓</span>
        {:else}
          <div class="rows">
            {#each g.rows as r (r.locus.id)}
              <div class="row" class:complete={r.complete} title={r.locus.description}>
                <span class="lname">{r.locus.name}</span>
                <span class="dots">
                  {#each r.alleles as { a, found, rare } (a.id)}
                    <span class="dot" class:found class:rare style="--c: {a.color}" title={found ? `${a.name} (${a.symbol})${rare ? ' · selten' : ''}` : rare ? 'seltenes Allel – unbekannt' : 'unbekannt'}>
                      {found ? a.symbol : '?'}
                    </span>
                  {/each}
                </span>
                <span class="num n" class:full={r.complete}>{r.complete ? '✓' : `${r.found}/${r.alleles.length}`}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</section>

<style>
  .library { display: grid; gap: 0.45rem; margin-bottom: 1rem; padding-block: 0.55rem; }
  .head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.7rem; width: 100%; padding: 0; border: 0; background: none; text-align: left; color: inherit; }
  h3 { margin: 0; }
  .count { font-weight: 700; }
  .bar { display: flex; flex: 1 1 6rem; max-width: 14rem; }
  .small { font-size: 0.78rem; }
  .chev { margin-left: auto; color: var(--muted); }
  .tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.8rem; }
  .toggle { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; padding: 0.2rem 0.5rem; border-radius: 8px; border: 1px solid var(--line); }
  .toggle.on { border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); }

  .group { display: grid; gap: 0.25rem; }
  .gname { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .done { padding-left: 0.3rem; }
  .rows { display: grid; gap: 0.25rem 0.6rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 19rem), 1fr)); }
  .row {
    display: grid; grid-template-columns: 7.8rem 1fr auto; align-items: center; gap: 0.4rem; padding: 0.2rem 0.45rem;
    border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); border-left: 3px solid var(--line);
  }
  .row.complete { border-left-color: var(--gold); opacity: 0.75; }
  .lname { font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dots { display: flex; flex-wrap: wrap; gap: 0.2rem; }
  .dot {
    position: relative; display: grid; place-items: center; min-width: 1.55rem; height: 1.55rem; padding: 0 0.2rem; border-radius: 99px;
    font-family: var(--mono); font-size: 0.7rem; font-weight: 700; color: var(--muted); border: 1px dashed var(--line);
  }
  .dot.found { color: #fff; text-shadow: 0 1px 2px #000a; border: 1px solid color-mix(in srgb, var(--c) 80%, transparent); background: color-mix(in srgb, var(--c) 45%, var(--bg-2)); }
  .dot.rare::after { content: '★'; position: absolute; top: -6px; right: -4px; font-size: 0.55rem; color: var(--gold); }
  .dot.rare:not(.found)::after { opacity: 0.5; }
  .n { font-size: 0.75rem; color: var(--muted); }
  .n.full { color: var(--gold); font-weight: 700; }
</style>
