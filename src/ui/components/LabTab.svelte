<script lang="ts">
  import { collect, collectAmounts } from '@core/actions';
  import { formatNumber } from '@core/format';
  import { content } from '@content/index';
  import { filterCreatures, sortCreatures } from '@core/queries';
  import { activeLoci } from '@core/genetics';
  import { activeListFilters, resetListFilters, viewState } from '../viewState.svelte';
  import { batchSellValue, canConsume, sell, stableCapacity } from '@core/features/stable';
  import { batchFragments } from '@core/features/recycler';
  import { inRecycler, sendToRecycler, speciesLostWith } from '@core/features/automation';
  import { game, view, act, ask, toast } from '../store.svelte';
  import CreatureCard from './CreatureCard.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EvolvePanel from './EvolvePanel.svelte';
  import CostLabel from './CostLabel.svelte';
  import DailyCard from './DailyCard.svelte';
  import SortToggle from './SortToggle.svelte';

  // Filters live in viewState so they survive tab switches.
  const list = viewState.list;
  let selecting = $state(false);
  let selected = $state<Set<number>>(new Set());
  let limit = $state(60);
  const activeFilters = $derived(activeListFilters());

  const data = $derived.by(() => {
    view.frame;
    const [locus, allele] = list.alleleKey ? list.alleleKey.split(':') : [];
    const f = { ...list.filter, allele: locus && allele ? { locus, allele } : null };
    const sorted = sortCreatures(game, filterCreatures(game, f), list.sort);
    const shown = list.invert ? sorted.reverse() : sorted;
    const chosen = game.state.creatures.filter((c) => selected.has(c.id) && canConsume(game, c));
    return {
      list: shown,
      total: game.state.creatures.length,
      capacity: stableCapacity(game),
      chosen,
      sellValue: batchSellValue(game, chosen),
      fragments: game.state.features['recycler'] ? batchFragments(game, chosen) : null,
      species: content.species.list.filter((s) => game.state.creatures.some((c) => c.speciesId === s.id)),
      away: game.state.creatures.filter((c) => c.job?.kind === 'mission').length,
      working: game.state.creatures.filter((c) => c.job?.kind === 'building').length,
      alleles: activeLoci(game).flatMap((l) => l.alleles.filter((a) => game.state.geneLibrary[`${l.id}:${a.id}`]).map((a) => ({ key: `${l.id}:${a.id}`, label: `${l.name}: ${a.name} (${a.symbol})` }))),
    };
  });

  const perClick = $derived.by(() => {
    view.frame;
    return Object.entries(collectAmounts(game));
  });

  let pulse = $state(0);
  /** Floating "+X" numbers at the click position. */
  let floaters = $state<{ id: number; x: number; y: number; text: string }[]>([]);
  let floaterId = 0;
  function onCollect(e: MouseEvent) {
    const gain = perClick.map(([res, amount]) => `+${formatNumber(amount)} ${content.resources.get(res).icon}`).join(' ');
    if (!act(collect(game))) return;
    pulse++;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = { id: ++floaterId, x: (e.clientX || rect.left + rect.width / 2) - rect.left + (Math.random() * 30 - 15), y: (e.clientY || rect.top + rect.height / 2) - rect.top, text: gain };
    floaters = [...floaters.slice(-8), f];
    setTimeout(() => (floaters = floaters.filter((x) => x.id !== f.id)), 900);
  }

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }
  function selectAllVisible() {
    selected = new Set(data.list.filter((c) => canConsume(game, c)).map((c) => c.id));
  }
  /** Warning when a batch would take the last creature(s) of a species from the stable. */
  function lossWarning(ids: number[]): string {
    const lost = speciesLostWith(game, ids).map((id) => content.species.get(id).name);
    return lost.length ? ` ⚠️ Damit gibst du deine letzte${lost.length > 1 ? 'n' : ''} ${lost.join(', ')} ab – die Art ist dann nicht mehr in deinem Stall.` : '';
  }
  async function doSell() {
    const ids = data.chosen.map((c) => c.id);
    if (!ids.length) return;
    if ((await ask(`${ids.length} Kreatur(en) verkaufen?${lossWarning(ids)}`, { ok: 'Verkaufen', danger: true })) && act(sell(game, ids))) selected = new Set();
  }
  async function doRecycle() {
    const ids = data.chosen.filter((c) => !inRecycler(game, c.id)).map((c) => c.id);
    if (!ids.length) return;
    const text = `${ids.length} Kreatur(en) zum Gen-Recycler schicken? Sie werden in der Zerlege-Kammer nacheinander recycelt – bis dahin kannst du sie dort zurückholen.${lossWarning(ids)}`;
    if ((await ask(text, { ok: 'Zum Recycler', danger: true })) && act(sendToRecycler(game, ids))) {
      selected = new Set();
      toast(`♻️ ${ids.length} ${ids.length === 1 ? 'Kreatur wartet' : 'Kreaturen warten'} auf die Zerlege-Kammer.`);
    }
  }
</script>

<header class="tab-head">
  <h2>🧪 Labor</h2>
  <div class="kpis">
    <span class="kpi" class:warn={data.total >= data.capacity}><b class="num">{data.total}/{data.capacity}</b><small>im Stall</small></span>
    <span class="kpi"><b class="num">{data.working}</b><small>bei der Arbeit</small></span>
    {#if data.away > 0}<span class="kpi"><b class="num">{data.away}</b><small>unterwegs</small></span>{/if}
  </div>
</header>

{#if game.state.features['daily']}<DailyCard />{/if}

<section class="panel collect">
  <div>
    <h3>🍖 Sammeln</h3>
    <p class="muted">Sammle Nahrung für deine Kreaturen.</p>
  </div>
  <button class="primary big" onclick={onCollect}>
    {#each floaters as f (f.id)}<span class="floater num" style="left: {f.x}px; top: {f.y}px">{f.text}</span>{/each}
    Sammeln
    <span class="num gain">
      {#each perClick as [res, amount] (res)}+{formatNumber(amount)} {content.resources.get(res).icon} {/each}
    </span>
  </button>
  <div class="helix"><DnaHelix progress={1} spin={pulse} /></div>
</section>

<section>
  <div class="head">
    <h2>Kreaturen <span class="num" class:full={data.total >= data.capacity}>{data.total}/{data.capacity}</span></h2>
    <div class="head-actions">
      {#if data.away > 0 || list.filter.hideAway}
        <button
          class:active={list.filter.hideAway}
          title={list.filter.hideAway ? 'Kreaturen auf Erkundung wieder anzeigen' : 'Kreaturen auf Erkundung ausblenden'}
          onclick={() => (list.filter.hideAway = !list.filter.hideAway)}
        >🧭 {list.filter.hideAway ? `${data.away} unterwegs ausgeblendet` : 'Unterwegs ausblenden'}</button>
      {/if}
      <button class="filter-toggle" class:active={list.showFilters} onclick={() => (list.showFilters = !list.showFilters)}>Filter{activeFilters ? ` (${activeFilters})` : ''} ▾</button>
      <button class:active={selecting} onclick={() => { selecting = !selecting; selected = new Set(); }}>{selecting ? 'Auswahl beenden' : 'Auswählen'}</button>
    </div>
  </div>

  <div class="toolbar panel" class:open={list.showFilters}>
    <input type="search" placeholder="Suchen …" bind:value={list.filter.search} />
    <select bind:value={list.filter.species}>
      <option value={null}>Alle Arten</option>
      {#each data.species as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
    </select>
    <select bind:value={list.filter.element}>
      <option value={null}>Alle Elemente</option>
      {#each content.elements.list as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
    </select>
    <select bind:value={list.filter.rarity}>
      <option value={null}>Alle Seltenheiten</option>
      {#each content.rarities.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
    </select>
    <select bind:value={list.filter.status}>
      <option value="all">Alle</option>
      <option value="idle">Frei</option>
      <option value="working">Arbeitend</option>
      <option value="busy">Brütend / unterwegs</option>
      <option value="locked">Favoriten</option>
    </select>
    {#if data.alleles.length > 0}
      <select bind:value={list.alleleKey}>
        <option value="">Jedes Allel</option>
        {#each data.alleles as a (a.key)}<option value={a.key}>{a.label}</option>{/each}
      </select>
    {/if}
    <span class="sortgroup">
      <select bind:value={list.sort} title="Sortierung">
        <option value="newest">Neueste</option>
        <option value="oldest">Älteste</option>
        <option value="rarity">Seltenheit</option>
        <option value="generation">Generation</option>
        {#if game.state.features['dynasties']}<option value="lineage">Reine Linie</option>{/if}
        <option value="power">Gesamtstärke</option>
        {#each content.stats.list as s (s.id)}<option value={`stat:${s.id}`}>{s.name}</option>{/each}
        <option value="name">Name</option>
      </select>
      <SortToggle bind:inverted={list.invert} />
    </span>
    {#if activeFilters > 0}
      <button class="reset" onclick={resetListFilters}>Filter zurücksetzen ({activeFilters})</button>
    {/if}
  </div>

  {#if selecting}
    <div class="batch panel">
      <span class="num">{data.chosen.length} gewählt</span>
      <button onclick={selectAllVisible}>Alle sichtbaren (frei)</button>
      <button onclick={() => (selected = new Set())}>Keine</button>
      <button class="danger" disabled={!data.chosen.length} onclick={doSell}>Verkaufen · <CostLabel cost={data.sellValue} /></button>
      {#if data.fragments}
        <button disabled={!data.chosen.length} onclick={doRecycle}>♻️ Zum Recycler · <span class="num">≈ {formatNumber(data.fragments)} 🧩</span></button>
      {/if}
      <span class="muted small">Favoriten und beschäftigte Kreaturen werden nie verbraucht.</span>
    </div>
  {/if}

  <div class="grid cards">
    {#each data.list.slice(0, limit) as c (c.id)}
      <CreatureCard creature={c} selectable={selecting} selected={selected.has(c.id)} onselect={() => toggle(c.id)}>
        <EvolvePanel creature={c} />
      </CreatureCard>
    {:else}
      <p class="muted">Keine Kreatur passt zum Filter.</p>
    {/each}
  </div>
  {#if data.list.length > limit}
    <button class="more" onclick={() => (limit += 60)}>Mehr anzeigen ({data.list.length - limit} weitere)</button>
  {/if}
</section>

<style>
  section { margin-bottom: 1rem; }
  .collect { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; justify-content: space-between; }
  .collect p { margin: 0; }
  .big { font-size: 1.15rem; padding: 0.9rem 1.6rem; display: flex; flex-direction: column; align-items: center; min-width: 11rem; }
  .gain { font-size: 0.8rem; opacity: 0.85; }
  .big { position: relative; overflow: visible; }
  .floater { position: absolute; pointer-events: none; font-size: 0.95rem; font-weight: 700; color: var(--gold); text-shadow: 0 1px 4px #000; white-space: nowrap; transform: translate(-50%, -50%); animation: float-up 0.9s ease-out forwards; }
  @keyframes float-up { to { transform: translate(-50%, -260%); opacity: 0; } }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .head h2 { margin: 0; }
  .head .num { color: var(--muted); font-size: 0.95rem; }
  .head .num.full { color: var(--danger); }
  .head button.active { border-color: var(--teal); }
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.6rem; margin-bottom: 0.6rem; }
  .toolbar input { flex: 1 1 10rem; }
  .toolbar select { flex: 0 1 auto; }
  .sortgroup { display: flex; gap: 0.3rem; flex: 0 1 auto; }
  .batch { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.6rem; margin-bottom: 0.6rem; position: sticky; top: calc(var(--header-h, 0px) + 0.4rem); z-index: 5; }
  .small { font-size: 0.8rem; }
  .more { width: 100%; margin-top: 0.75rem; }
  .head { flex-wrap: wrap; gap: 0.4rem; }
  .head-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .filter-toggle { display: none; }
  @media (max-width: 640px) {
    .toolbar select, .toolbar input, .sortgroup { flex: 1 1 45%; }
    .sortgroup select { flex: 1 1 auto; min-width: 0; }
    .filter-toggle { display: inline-block; }
    .toolbar:not(.open) { display: none; }
    .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .cards :global(.card) { padding: 0.5rem; }
    .cards :global(.card svg) { width: 72px; height: 72px; }
  }
</style>
