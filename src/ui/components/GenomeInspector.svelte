<script lang="ts" module>
  /** Inspected creature, kept across tab switches for this session (ids belong to the save, not the device). */
  let lastInspected: number | null = null;
</script>

<script lang="ts">
  import { content } from '@content/index';
  import { findCreature } from '@core/creatures';
  import { expressedAppearance, genomeReport } from '@core/genetics';
  import { maxSplices } from '@core/features/splicing';
  import type { Creature } from '@core/state';
  import { game, view } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import GenomeView from './GenomeView.svelte';
  import CreatureSortSelect from './CreatureSortSelect.svelte';
  import { sortCreatures, type CreatureSort } from '@core/queries';

  /**
   * "Genom ansehen": a searchable, filterable creature gallery (shown in
   * pages, so big stables stay manageable) that collapses into an ID card
   * with ‹ › to step through the filtered list, and the genome below.
   */
  const PAGE = 20;

  let inspect = $state<number | null>(lastInspected);
  let choosing = $state(false);
  let search = $state('');
  let shown = $state(PAGE);

  const species = (c: Creature) => content.species.get(c.speciesId);
  /** Loci homozygous for their top allele (only known for sequenced creatures). */
  const topCount = (c: Creature) => (c.sequenced ? genomeReport(game, c.genome).filter((r) => r.perfect).length : -1);

  const gallery = $derived.by(() => {
    view.slowFrame;
    const q = search.trim().toLowerCase();
    const all = game.state.creatures;
    const { sequencedOnly } = viewState.genome;
    // A remembered species filter whose creatures are all gone would show an empty list.
    const sp = all.some((c) => c.speciesId === viewState.genome.species) ? viewState.genome.species : '';
    const matching = all
      .filter((c) => (!sequencedOnly || c.sequenced) && (!sp || c.speciesId === sp))
      .filter((c) => !q || c.name.toLowerCase().includes(q) || species(c).name.toLowerCase().includes(q));
    const sorted = sortCreatures(game, matching, viewState.genome.sort as CreatureSort);
    if (viewState.genome.invert) sorted.reverse();
    const list = sorted.map((c) => ({ c, top: topCount(c) }));
    // Species present in the stable, for the filter.
    const present = [...new Set(all.map((c) => c.speciesId))].map((id) => content.species.get(id)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { list, total: all.length, present, species: sp };
  });

  const current = $derived.by(() => {
    view.frame;
    return inspect !== null ? findCreature(game, inspect) : undefined;
  });
  const showGallery = $derived(choosing || !current);
  /** Position of the inspected creature in the filtered list (−1 when filtered out). */
  const index = $derived(current ? gallery.list.findIndex((t) => t.c.id === current.id) : -1);

  function pick(id: number) {
    inspect = lastInspected = id;
    choosing = false;
  }
  function step(delta: number) {
    const n = gallery.list.length;
    if (n === 0) return;
    const next = gallery.list[((index < 0 ? 0 : index + delta) % n + n) % n];
    if (next) pick(next.c.id);
  }
  // A new filter starts at the first page again.
  $effect(() => {
    search;
    viewState.genome.sort;
    viewState.genome.invert;
    viewState.genome.species;
    viewState.genome.sequencedOnly;
    shown = PAGE;
  });
</script>

<section class="panel inspector">
  <div class="ihead">
    <h3>🔎 Genom ansehen</h3>
    {#if current && !choosing}<button class="small-btn" onclick={() => (choosing = true)}>Andere Kreatur wählen</button>{/if}
  </div>

  {#if showGallery}
    <div class="gallery">
      <div class="toolbar">
        <input type="search" placeholder="Name oder Art suchen …" bind:value={search} />
        <select value={gallery.species} onchange={(e) => (viewState.genome.species = e.currentTarget.value)} title="Art">
          <option value="">Alle Arten</option>
          {#each gallery.present as sp (sp.id)}<option value={sp.id}>{sp.name}</option>{/each}
        </select>
        <CreatureSortSelect bind:value={viewState.genome.sort} bind:inverted={viewState.genome.invert} genetics />
        <label class="toggle" class:on={viewState.genome.sequencedOnly}>
          <input type="checkbox" bind:checked={viewState.genome.sequencedOnly} /> nur sequenzierte
        </label>
        <span class="small muted count num">{gallery.list.length}/{gallery.total}</span>
        {#if current}<button class="small-btn" onclick={() => (choosing = false)}>Abbrechen</button>{/if}
      </div>
      <div class="tiles">
        {#each gallery.list.slice(0, shown) as t (t.c.id)}
          {@const sp = species(t.c)}
          <button
            class="tile"
            class:on={inspect === t.c.id}
            class:unknown={!t.c.sequenced}
            style="--el: {content.elements.get(sp.element).color}; --rarity: {content.rarities.get(t.c.rarity).color}"
            title="{t.c.name} · {sp.name} · {content.rarities.get(t.c.rarity).name}"
            onclick={() => pick(t.c.id)}
          >
            <CreatureSvg appearance={expressedAppearance(game, t.c)} shape={sp.shape} tier={sp.tier} size={40} shiny={t.c.shiny} />
            <span class="tname">{t.c.name}</span>
            <span class="small num muted" title={t.c.sequenced ? 'Gene reinerbig mit dem besten Allel' : 'Genom noch nicht sequenziert'}>{t.c.sequenced ? `✦ ${t.top}` : 'unbekannt'}</span>
          </button>
        {:else}
          <p class="small muted empty">Keine Kreatur passt zu Suche und Filter.</p>
        {/each}
      </div>
      {#if gallery.list.length > shown}
        <button class="more" onclick={() => (shown += PAGE)}>Mehr anzeigen ({gallery.list.length - shown} weitere)</button>
      {/if}
    </div>
  {/if}

  {#if current && !choosing}
    {@const c = current}
    {@const sp = species(c)}
    {@const el = content.elements.get(sp.element)}
    {@const rar = content.rarities.get(c.rarity)}
    <div class="idcard" style="--el: {el.color}; --rarity: {rar.color}">
      <button class="nav" title="Vorherige" disabled={gallery.list.length < 2 && index >= 0} onclick={() => step(-1)}>‹</button>
      <button class="portrait" title="Details zu {c.name}" onclick={() => (view.detail = c.id)}>
        <CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={72} shiny={c.shiny} />
      </button>
      <div class="who">
        <b class="iname">{c.name}</b>
        <span class="small muted">{sp.name} · Gen {c.generation}{#if index >= 0}{' · '}<span class="num">{index + 1}/{gallery.list.length}</span>{/if}</span>
        <div class="tags">
          <span class="tag el">{el.name}</span>
          <span class="tag rar">{rar.name}</span>
          {#if c.sequenced}<span class="tag ok">🧬 sequenziert</span>{:else}<span class="tag">❔ unbekannt</span>{/if}
          {#if game.state.features['splicing'] && c.sequenced}<span class="tag" title="Splicing-Eingriffe">✂️ {c.splices ?? 0}/{maxSplices(game)}</span>{/if}
        </div>
      </div>
      <button class="nav" title="Nächste" disabled={gallery.list.length < 2 && index >= 0} onclick={() => step(1)}>›</button>
    </div>
    <GenomeView genome={c.genome} known={c.sequenced} />
    {#if !c.sequenced}<p class="small muted">Noch nicht sequenziert – nur das Aussehen verrät etwas. Im Sequenzierlabor lässt sich das Genom entschlüsseln.</p>{/if}
  {:else if !current}
    <p class="small muted hint">Wähle eine Kreatur, um ihre Gene, verdeckten Allele und Top-Allele zu sehen.</p>
  {/if}
</section>

<style>
  .inspector { display: grid; gap: 0.5rem; margin-bottom: 1rem; }
  .ihead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; }
  h3 { margin: 0; }
  .small { font-size: 0.8rem; }
  .small-btn { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
  .hint { margin: 0; }

  .gallery { display: grid; gap: 0.45rem; padding: 0.55rem; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
  .toolbar input[type='search'] { flex: 1 1 11rem; max-width: 18rem; }
  .toolbar select { flex: 0 1 auto; max-width: 11rem; }
  .toggle { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1px solid var(--line); }
  .toggle.on { border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); }
  .count { margin-left: auto; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.2rem, 1fr)); gap: 0.4rem; padding: 2px; }
  .tile {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.25rem; border-radius: 10px;
    border: 2px solid color-mix(in srgb, var(--el) 45%, var(--line)); background: radial-gradient(circle at 50% 25%, color-mix(in srgb, var(--el) 14%, transparent), var(--panel) 70%);
  }
  .tile:hover { border-color: var(--teal); }
  .tile.on { border-color: var(--gold); box-shadow: 0 0 12px #f2c14e66; }
  .tile.unknown { opacity: 0.7; }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rarity); }
  .empty { grid-column: 1 / -1; margin: 0.3rem 0; }
  .more { justify-self: center; font-size: 0.82rem; }

  .idcard {
    display: flex; gap: 0.6rem; align-items: center; padding: 0.5rem 0.6rem; border-radius: var(--radius);
    background: radial-gradient(circle at 10% 50%, color-mix(in srgb, var(--el) 22%, transparent), transparent 55%), var(--bg-2);
    border: 1px solid color-mix(in srgb, var(--el) 40%, var(--line));
  }
  .nav { flex: none; width: 2rem; height: 2.6rem; padding: 0; font-size: 1.4rem; line-height: 1; }
  .nav:last-child { margin-left: auto; }
  .portrait { flex: none; padding: 0.2rem; border-radius: 50%; line-height: 0; background: color-mix(in srgb, var(--el) 14%, #0006); border: 2px solid color-mix(in srgb, var(--el) 60%, transparent); }
  .who { display: grid; gap: 0.1rem; min-width: 0; }
  .iname { font-size: 1.05rem; border-bottom: 2px solid var(--rarity); justify-self: start; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.2rem; }
  .tag { font-size: 0.72rem; padding: 0.05rem 0.45rem; border-radius: 99px; border: 1px solid var(--line); background: var(--panel); }
  .tag.el { border-color: var(--el); background: color-mix(in srgb, var(--el) 18%, transparent); }
  .tag.rar { border-color: var(--rarity); color: var(--rarity); }
  .tag.ok { border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); color: var(--teal); }

  @media (max-width: 480px) {
    .toolbar select { flex: 1 1 8rem; max-width: none; }
    .count { margin-left: 0; }
  }
</style>
