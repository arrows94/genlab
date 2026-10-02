<script lang="ts">
  import { content } from '@content/index';
  import { effectiveStats } from '@core/creatures';
  import { formatNumberParts } from '@core/format';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { renameCreature, toggleLock } from '@core/actions';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaSequence from './DnaSequence.svelte';
  import { expressedAppearance } from '@core/genetics';
  import type { Snippet } from 'svelte';

  let { creature, children, selectable = false, selected = false, onselect }: {
    creature: Creature;
    children?: Snippet;
    selectable?: boolean;
    selected?: boolean;
    onselect?: () => void;
  } = $props();

  const species = $derived(content.species.get(creature.speciesId));
  const rarity = $derived(content.rarities.get(creature.rarity));
  const element = $derived(content.elements.get(species.element));
  const stats = $derived.by(() => {
    view.slowFrame;
    return effectiveStats(game, creature);
  });
  const look = $derived.by(() => {
    view.slowFrame;
    return expressedAppearance(game, creature);
  });
  const infusion = $derived.by(() => {
    view.slowFrame;
    return creature.infusion?.level ?? 0;
  });
  /** Freshly hatched/found creatures get a "NEU" marker for a few seconds. */
  const isNew = $derived.by(() => {
    view.slowFrame;
    return game.state.simTimeMs - creature.bornAt < 15_000 && creature.bornAt > 0;
  });
  const sequenced = $derived.by(() => {
    view.slowFrame;
    return creature.sequenced;
  });

  /**
   * Fields that change in place (favourite, job, recycler, name …). The list
   * passes the same object every frame, so they must be re-read on the tick.
   */
  const live = $derived.by(() => {
    view.slowFrame;
    const a = game.state.automation;
    return {
      locked: creature.locked,
      name: creature.name,
      epithet: creature.epithet,
      lineage: creature.lineage,
      abilities: [...creature.abilities],
      job: creature.job ? jobText(creature.job) : '',
      recycler: a.recycling?.creatureId === creature.id ? 'chamber' : a.recycleQueue.includes(creature.id) ? 'queue' : null,
    };
  });

  function jobText(job: NonNullable<Creature['job']>): string {
    if (job.kind === 'building') return `Arbeitet: ${content.buildings.get(job.target).name}`;
    if (job.kind === 'nest') return '🥚 Brütet';
    if (job.kind === 'mission') return '🧭 Auf Erkundung';
    if (job.kind === 'tower') return '🗼 Im Genom-Turm';
    if (job.kind === 'rpg') return '🔥 Im Dungeon';
    if (job.kind === 'keeper') return '🪺 Nestwärter';
    return 'Beschäftigt';
  }

  const TIER_LABELS: Record<string, string> = { hybrid: 'Hybrid', rareHybrid: 'Seltener Hybrid', mythic: 'Mythisch' };
  /** Rarity order from which the frame shimmers (3 = Episch); one step higher also glows. */
  const SHIMMER_FROM = 3;

  let editing = $state(false);
  let draft = $state('');

  function startEdit() {
    draft = creature.name;
    editing = true;
  }
  function commit() {
    act(renameCreature(game, creature.id, draft));
    editing = false;
  }
</script>

<article
  class="card"
  class:glow={rarity.glow}
  class:selected
  class:plain={rarity.order <= 1}
  class:rare={rarity.order >= 2}
  class:shimmer={rarity.order >= SHIMMER_FROM}
  class:radiant={rarity.order >= SHIMMER_FROM + 1}
  style="--rarity: {rarity.color}; --element: {element.color}"
>
  <header>
    {#if selectable}
      <input type="checkbox" checked={selected} onchange={() => onselect?.()} aria-label="Auswählen" />
    {/if}
    <span class="rarity">{rarity.name}</span>
    {#if isNew}<span class="new">NEU</span>{/if}
    <button class="lock" aria-label="Favorit" aria-pressed={live.locked} title={live.locked ? 'Favorit – geschützt vor Verkauf, Recycling und Infusion, nicht vor einer Vererbung' : 'Als Favorit sperren (schützt vor Verkauf, Recycling und Infusion)'} onclick={() => act(toggleLock(game, creature.id))}>
      {live.locked ? '★' : '☆'}
    </button>
  </header>
  <button class="art" title="Details" onclick={() => (view.detail = creature.id)}><CreatureSvg appearance={look} shape={species.shape} tier={species.tier} shiny={creature.shiny} /></button>
  {#if editing}
    <form onsubmit={(e) => { e.preventDefault(); commit(); }}>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={draft} maxlength={game.balance.creature.maxNameLength} autofocus onblur={commit} title="Mit Nachnamen („Kiko Sonnenschein“) erbt der Nachwuchs diesen Familiennamen." />
    </form>
  {:else}
    <button class="name" onclick={startEdit} title="Umbenennen">{live.name}{#if infusion > 0}<span class="plus num"> +{infusion}</span>{/if}</button>
    {#if live.epithet}<span class="epithet" title="Beiname">„{live.epithet}“</span>{/if}
  {/if}
  <div class="meta">
    <span class="element">{element.name}</span>
    <span>{species.name}</span>
    {#if species.tier !== 'base'}<span class="tier">{TIER_LABELS[species.tier]}</span>{/if}
    {#if creature.shiny}<span class="shiny">✦ Schillernd</span>{/if}
    <span class="num">Gen {creature.generation}</span>
    {#if live.recycler === 'chamber'}<span class="recy" title="Wird gerade im Gen-Recycler zerlegt – zurückholen in der Detailansicht oder im Recycler">♻ in der Zerlege-Kammer</span>
    {:else if live.recycler === 'queue'}<span class="recy" title="Wartet auf die Zerlege-Kammer – zurückholen in der Detailansicht oder im Recycler">♻ wartet auf den Recycler</span>{/if}
    {#if live.lineage > 0 && game.state.features['dynasties']}<span class="lineage num" title="Reine Linie: {live.lineage} Generationen in Folge dieselbe Art">👑 {live.lineage}</span>{/if}
  </div>
  <dl class="stats">
    {#each content.stats.list as s (s.id)}
      {@const [value, unit] = formatNumberParts(stats[s.id] ?? 0, { fullBelow: 1000 })}
      <div title="{s.name}: {(stats[s.id] ?? 0).toLocaleString('de-DE')}"><dt>{s.short}</dt><dd class="num">{value}{#if unit}<small>{unit}</small>{/if}</dd></div>
    {/each}
  </dl>
  <div class="dna"><DnaSequence genome={creature.genome} known={sequenced} /></div>
  {#if live.abilities.length > 0}
    <ul class="abilities">
      {#each live.abilities as id (id)}
        {@const a = content.abilities.get(id)}
        <li style="--t: {content.rarities.get(a.tier).color}" title={a.description}>{a.name}</li>
      {/each}
    </ul>
  {/if}
  {#if live.job}
    <div class="job">{live.job}</div>
  {/if}
  {@render children?.()}
</article>

<style>
  .card {
    position: relative;
    background: linear-gradient(180deg, var(--panel-2), var(--bg-2));
    border: 2px solid var(--rarity);
    border-radius: var(--radius);
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .card { animation: appear 0.3s ease-out; }
  /* Rarity frames: common/uncommon muted, rare with a tinted top, epic+ with a light sweeping along the
     frame, legendary+ additionally glowing. */
  .card.plain { border-color: color-mix(in srgb, var(--rarity) 55%, var(--line)); }
  .card.rare { background: linear-gradient(180deg, color-mix(in srgb, var(--rarity) 14%, var(--panel-2)), var(--bg-2) 55%); }
  .card.shimmer::before {
    content: ''; position: absolute; inset: -2px; border-radius: inherit; padding: 2px; pointer-events: none;
    background: linear-gradient(115deg, transparent 35%, #ffffffcc 48%, color-mix(in srgb, var(--rarity) 60%, #fff) 52%, transparent 65%) 0 0 / 300% 100% no-repeat;
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    mask-composite: exclude;
    animation: sheen 3.6s ease-in-out infinite;
  }
  .card.radiant { box-shadow: 0 0 12px color-mix(in srgb, var(--rarity) 35%, transparent); }
  .card.radiant::before { animation-duration: 2.6s; }
  @keyframes sheen { 0% { background-position: 100% 0; } 60%, 100% { background-position: 0% 0; } }
  .card.glow { animation: appear 0.3s ease-out, mythic-glow 2.2s ease-in-out 0.3s infinite; }
  .new { background: var(--gold); color: #000; border-radius: 99px; padding: 0 0.4rem; font-size: 0.62rem; font-weight: 800; animation: pulse-new 1s ease-in-out infinite; }
  @keyframes pulse-new { 50% { opacity: 0.55; } }
  header { display: flex; justify-content: space-between; align-items: center; }
  .rarity { color: var(--rarity); font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .lock { background: none; border: none; padding: 0.1rem 0.3rem; color: var(--gold); font-size: 1.1rem; }
  .card.selected { outline: 2px solid var(--teal); outline-offset: 2px; }
  header input { margin-right: auto; accent-color: var(--teal); width: 1.1rem; height: 1.1rem; }
  .plus { color: var(--gold); font-weight: 700; }
  .art { border: none; padding: 0; cursor: pointer; display: flex; justify-content: center; background: radial-gradient(circle, color-mix(in srgb, var(--element) 18%, transparent), transparent 70%); border-radius: 50%; }
  .name { background: none; border: none; padding: 0; font-weight: 700; font-size: 1.05rem; text-align: left; }
  .meta { display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--muted); }
  .lineage { color: var(--gold); font-weight: 700; }
  .recy { color: var(--violet); font-weight: 700; }
  .epithet { display: block; font-size: 0.75rem; font-style: italic; color: var(--gold); margin-top: -0.1rem; }
  .element { color: var(--element); }
  .tier { color: var(--violet); }
  .shiny { background: linear-gradient(90deg, #ff7ad9, #7ad9ff, #b8ff7a); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: 700; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; margin: 0; }
  .stats div { background: var(--bg-2); border-radius: 6px; padding: 0.2rem 0.1rem; text-align: center; min-width: 0; }
  dt { font-size: 0.65rem; color: var(--muted); }
  dd { margin: 0; font-size: 0.9rem; white-space: nowrap; }
  dd small { display: block; font-size: 0.6rem; color: var(--muted); }
  .job { font-size: 0.8rem; color: var(--teal); }
  .dna { display: flex; justify-content: center; }
  .abilities { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .abilities li { font-size: 0.7rem; border: 1px solid var(--t); color: var(--t); border-radius: 99px; padding: 0.05rem 0.45rem; }
  input { width: 100%; }
</style>
