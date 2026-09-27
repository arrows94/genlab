<script lang="ts">
  import { collect, collectAmounts } from '@core/actions';
  import { formatNumber } from '@core/format';
  import { content } from '@content/index';
  import { EMPTY_FILTER, filterCreatures, sortCreatures, type CreatureFilter, type CreatureSort } from '@core/queries';
  import { batchSellValue, canConsume, sell, stableCapacity } from '@core/features/stable';
  import { batchFragments, recycle } from '@core/features/recycler';
  import { game, view, act } from '../store.svelte';
  import CreatureCard from './CreatureCard.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EvolvePanel from './EvolvePanel.svelte';
  import CostLabel from './CostLabel.svelte';

  let filter = $state<CreatureFilter>({ ...EMPTY_FILTER });
  let sort = $state<CreatureSort>('newest');
  let alleleKey = $state('');
  let selecting = $state(false);
  let selected = $state<Set<number>>(new Set());
  let limit = $state(60);

  const data = $derived.by(() => {
    view.frame;
    const [locus, allele] = alleleKey ? alleleKey.split(':') : [];
    const f = { ...filter, allele: locus && allele ? { locus, allele } : null };
    const list = sortCreatures(game, filterCreatures(game, f), sort);
    const chosen = game.state.creatures.filter((c) => selected.has(c.id) && canConsume(game, c));
    return {
      list,
      total: game.state.creatures.length,
      capacity: stableCapacity(game),
      chosen,
      sellValue: batchSellValue(game, chosen),
      fragments: game.state.features['recycler'] ? batchFragments(game, chosen) : null,
      species: content.species.list.filter((s) => game.state.creatures.some((c) => c.speciesId === s.id)),
      alleles: content.genes.list.flatMap((l) => l.alleles.filter((a) => game.state.geneLibrary[`${l.id}:${a.id}`]).map((a) => ({ key: `${l.id}:${a.id}`, label: `${l.name}: ${a.name} (${a.symbol})` }))),
    };
  });

  const perClick = $derived.by(() => {
    view.frame;
    return Object.entries(collectAmounts(game));
  });

  let pulse = $state(0);
  function onCollect() {
    if (act(collect(game))) pulse++;
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
  function doSell() {
    if (data.chosen.length && confirm(`${data.chosen.length} Kreatur(en) verkaufen?`) && act(sell(game, data.chosen.map((c) => c.id)))) selected = new Set();
  }
  function doRecycle() {
    if (data.chosen.length && confirm(`${data.chosen.length} Kreatur(en) recyceln?`) && act(recycle(game, data.chosen.map((c) => c.id)))) selected = new Set();
  }
</script>

<section class="panel collect">
  <div>
    <h2>Genlabor</h2>
    <p class="muted">Sammle Nahrung für deine Kreaturen.</p>
  </div>
  <button class="primary big" onclick={onCollect}>
    Sammeln
    <span class="num gain">
      {#each perClick as [res, amount] (res)}+{formatNumber(amount)} {content.resources.get(res).icon} {/each}
    </span>
  </button>
  {#key pulse}<div class="helix"><DnaHelix progress={1} /></div>{/key}
</section>

<section>
  <div class="head">
    <h2>Kreaturen <span class="num" class:full={data.total >= data.capacity}>{data.total}/{data.capacity}</span></h2>
    <button class:active={selecting} onclick={() => { selecting = !selecting; selected = new Set(); }}>{selecting ? 'Auswahl beenden' : 'Auswählen'}</button>
  </div>

  <div class="toolbar panel">
    <input type="search" placeholder="Suchen …" bind:value={filter.search} />
    <select bind:value={filter.species}>
      <option value={null}>Alle Arten</option>
      {#each data.species as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
    </select>
    <select bind:value={filter.element}>
      <option value={null}>Alle Elemente</option>
      {#each content.elements.list as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
    </select>
    <select bind:value={filter.rarity}>
      <option value={null}>Alle Seltenheiten</option>
      {#each content.rarities.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
    </select>
    <select bind:value={filter.status}>
      <option value="all">Alle</option>
      <option value="idle">Frei</option>
      <option value="working">Arbeitend</option>
      <option value="busy">Brütend / unterwegs</option>
      <option value="locked">Favoriten</option>
    </select>
    {#if data.alleles.length > 0}
      <select bind:value={alleleKey}>
        <option value="">Jedes Allel</option>
        {#each data.alleles as a (a.key)}<option value={a.key}>{a.label}</option>{/each}
      </select>
    {/if}
    <select bind:value={sort}>
      <option value="newest">Neueste</option>
      <option value="oldest">Älteste</option>
      <option value="rarity">Seltenheit</option>
      <option value="generation">Generation</option>
      <option value="power">Gesamtstärke</option>
      {#each content.stats.list as s (s.id)}<option value={`stat:${s.id}`}>{s.name}</option>{/each}
      <option value="name">Name</option>
    </select>
  </div>

  {#if selecting}
    <div class="batch panel">
      <span class="num">{data.chosen.length} gewählt</span>
      <button onclick={selectAllVisible}>Alle sichtbaren (frei)</button>
      <button onclick={() => (selected = new Set())}>Keine</button>
      <button class="danger" disabled={!data.chosen.length} onclick={doSell}>Verkaufen · <CostLabel cost={data.sellValue} /></button>
      {#if data.fragments}
        <button disabled={!data.chosen.length} onclick={doRecycle}>Recyceln · <span class="num">{formatNumber(data.fragments)} 🧩</span></button>
      {/if}
      <span class="muted small">Favoriten und beschäftigte Kreaturen werden nie verbraucht.</span>
    </div>
  {/if}

  <div class="grid">
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
  .helix { animation: pop 0.3s ease-out; }
  @keyframes pop { from { transform: scale(1.12); filter: brightness(1.6); } to { transform: scale(1); } }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .head h2 { margin: 0; }
  .head .num { color: var(--muted); font-size: 0.95rem; }
  .head .num.full { color: var(--danger); }
  .head button.active { border-color: var(--teal); }
  .toolbar { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0.6rem; margin-bottom: 0.6rem; }
  .toolbar input { flex: 1 1 10rem; }
  .toolbar select { flex: 0 1 auto; }
  .batch { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.6rem; margin-bottom: 0.6rem; position: sticky; top: 0.4rem; z-index: 5; }
  .small { font-size: 0.8rem; }
  .more { width: 100%; margin-top: 0.75rem; }
  @media (max-width: 640px) { .toolbar select, .toolbar input { flex: 1 1 45%; } }
</style>
