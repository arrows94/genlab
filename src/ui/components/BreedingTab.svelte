<script lang="ts">
  import { lineageDepth } from '@core/features/dynasty';
  import { scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { creaturePower, effectiveStats, findCreature } from '@core/creatures';
  import { activeLoci, expressedAppearance, libraryHas } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { autoEggs, autoNestSlots, availableRituals, eggCost, eggTimeMs, mutationChance, nestEggs, nestSlots, offspringGeneration, ritualEggs, ritualNestSlots, breedByHand, lastPair, openRitualEgg, type EggData } from '@core/features/breeding';
  import { isWaiting, processRemainingMs } from '@core/systems/processes';
  import { planAutoBreed } from '@core/features/automation';
  import { stableCapacity, stableFree } from '@core/features/stable';
  import type { Creature, Process } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import { viewState } from '../viewState.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EggSvg from './EggSvg.svelte';
  import BreedingPlanner from './BreedingPlanner.svelte';
  import SortToggle from './SortToggle.svelte';
  import DynastyPanel from './DynastyPanel.svelte';
  import BreedingAutomat from './BreedingAutomat.svelte';
  import NestCard from './NestCard.svelte';
  import RitualReveal from './RitualReveal.svelte';
  import CreatureTile from './CreatureTile.svelte';
  import Meter from './Meter.svelte';

  /**
   * Brutstation: a row of nests with eggs tinted by both parents (cracking
   * near the end), fresh hatchlings, a pairing altar with two parent sockets
   * and candidate tiles, and the visual breeding planner.
   */


  let parentA = $state<number | null>(null);
  /** Besondere Brut: chosen ritual (null = normal egg). */
  let ritualId = $state<string | null>(null);
  let parentB = $state<number | null>(null);
  let search = $state('');
  /** Ritual egg breaking open right now (short animation before the hatch). */
  let opening = $state<number | null>(null);
  /** Hatchling of the last opened ritual egg, shown big with its rarity glow. */
  let reveal = $state<{ id: number; ritual: string } | null>(null);

  // Lists, costs and filters: the slow tick is enough (actions refresh at once); egg progress runs below.
  const data = $derived.by(() => {
    view.slowFrame;
    const a = parentA !== null ? findCreature(game, parentA) : undefined;
    const b = parentB !== null ? findCreature(game, parentB) : undefined;
    const generation = offspringGeneration(a, b);
    const rituals = availableRituals(game);
    const ritual = rituals.find((r) => r.id === ritualId);
    const cost = eggCost(game, generation, ritual);
    const q = search.trim().toLowerCase();
    const { rarity } = viewState.breeding;
    const split = game.state.features['breedSplit'] === true && prefs.breedingSplit;
    const base = game.state.creatures
      .filter((c) => c.job === null || c.job.kind === 'building')
      .filter((c) => !rarity || c.rarity === rarity)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || content.species.get(c.speciesId).name.toLowerCase().includes(q))
      .map((c) => ({ c, power: creaturePower(game, c), key: sortKey(c) }));
    /** One candidate list: its species filter, the chosen parent(s) on top so they never scroll out of reach. */
    const listFor = (species: string, chosen: (number | null)[]) => {
      const pool = base.filter((x) => !species || x.c.speciesId === species);
      const first = (x: { c: Creature }) => (chosen.includes(x.c.id) ? 0 : 1);
      const shown = pool.sort((x, y) => first(x) - first(y) || (viewState.breeding.invert ? -1 : 1) * compareCandidates(x, y)).slice(0, 60);
      return { shown, hidden: pool.length - shown.length };
    };
    // Zwei Zuchtlisten: one list per parent, each with its own species filter.
    const listA = listFor(viewState.breeding.species, split ? [parentA] : [parentA, parentB]);
    const listB = split ? listFor(viewState.breeding.speciesB, [parentB]) : null;
    const candidates = listA.shown;
    const pool = { length: listA.shown.length + listA.hidden };
    const stableCap = stableCapacity(game);
    const free = stableFree(game);
    return {
      a,
      b,
      stableUsed: stableCap - free,
      stableCap,
      stableFull: free <= 0,
      automaton: game.state.features['autoBreed'] === true,
      autoBreed: game.state.automation.autoBreed,
      recycler: game.state.features['recycler'] === true,
      recycleAuto: game.state.features['autoRecycle'] === true,
      recycleAutoOn: game.state.automation.autoRecycle.enabled,
      hybrids: game.state.features['hybrids'] === true,
      knownAlleles: activeLoci(game).flatMap((l) => l.alleles.filter((al) => libraryHas(game, l.id, al.id)).map((al) => ({ id: `${l.id}:${al.id}`, label: `${l.name}: ${al.name} (${al.symbol})` }))),
      ownedSpecies: content.species.list.filter((s) => game.state.creatures.some((c) => c.speciesId === s.id)),
      slots: nestSlots(game),
      ritualSlots: game.state.features['specialBreeding'] ? ritualNestSlots(game) : 0,
      autoSlots: game.state.features['autoBreed'] ? autoNestSlots(game) : 0,
      hatchlings: view.hatchlings.map((h) => ({ key: h.key, c: findCreature(game, h.id) })).filter((h): h is { key: number; c: Creature } => !!h.c),
      candidates,
      hidden: pool.length - candidates.length,
      split,
      candidatesB: listB?.shown ?? [],
      hiddenB: listB?.hidden ?? 0,
      last: lastPair(game),
      cost,
      affordable: canAfford(game.state, cost),
      generation,
      time: eggTimeMs(game, generation, [a, b], ritual),
      mutation: mutationChance(game, ritual, [a, b]),
      rituals,
      ritual,
      special: game.state.features['specialBreeding'] === true,
      dynasties: game.state.features['dynasties'] === true,
      // Pure line of the child (a hybrid would break it).
      lineage: a && b ? lineageDepth(game, a.speciesId, a, b) : 0,
    };
  });

  // Pair search is heavier than the rest – refreshed at the slow rate.
  const autoPlan = $derived.by(() => {
    view.slowFrame;
    return game.state.features['autoBreed'] && game.state.automation.autoBreed.enabled ? planAutoBreed(game) : null;
  });

  /** Eggs in the nests with their progress bars (fast tick). */
  const nests = $derived.by(() => {
    view.frame;
    return { eggs: nestEggs(game).map(eggView), ritualEggs: ritualEggs(game).map(eggView), autoEggs: autoEggs(game).map(eggView) };
  });

  const nestsFull = $derived(nests.eggs.length >= data.slots);
  const ritualFull = $derived(nests.ritualEggs.length >= data.ritualSlots);
  /** Normal nests first, then the Ritualnest (Besondere Brut) and the Automatennest (Zuchtautomat). */
  const nestList = $derived([
    ...Array.from({ length: data.slots }, (_, i) => ({ key: `n${i}`, egg: nests.eggs[i], ritual: false, auto: false })),
    ...Array.from({ length: data.ritualSlots }, (_, i) => ({ key: `r${i}`, egg: nests.ritualEggs[i], ritual: true, auto: false })),
    ...Array.from({ length: data.autoSlots }, (_, i) => ({ key: `a${i}`, egg: nests.autoEggs[i], ritual: false, auto: true })),
  ]);

  function eggView(p: Process) {
    const d = p.data as EggData;
    // Ritual eggs show their Keimprobe (the parents may have changed or gone since).
    const parents = d.sample ?? d.parents.map((id) => findCreature(game, id));
    return {
      id: p.id,
      progress: Math.min(1, p.elapsedMs / p.durationMs),
      ready: isWaiting(game, p),
      remaining: processRemainingMs(game, p),
      parents,
      hues: parents.map((c) => (c ? expressedAppearance(game, c).hue : 180)) as [number, number],
      generation: d.generation,
      ritual: d.ritual && content.breedingRituals.has(d.ritual) ? content.breedingRituals.get(d.ritual) : null,
    };
  }

  const sortArrow = $derived(viewState.breeding.invert ? '↑' : '↓');
  const sortAz = $derived(viewState.breeding.invert ? 'Z–A' : 'A–Z');
  const rarityOrder = (c: Creature) => content.rarities.get(c.rarity).order;
  /** Secondary value for the chosen sort (stat sorts need the effective stats). */
  function sortKey(c: Creature): number {
    const sort = viewState.breeding.sort;
    return sort.startsWith('stat:') ? (effectiveStats(game, c)[sort.slice(5)] ?? 0) : 0;
  }
  function compareCandidates(x: { c: Creature; power: number; key: number }, y: { c: Creature; power: number; key: number }): number {
    const sort = viewState.breeding.sort;
    if (sort.startsWith('stat:')) return y.key - x.key;
    switch (sort) {
      case 'rarity':
        return rarityOrder(y.c) - rarityOrder(x.c) || y.power - x.power;
      case 'generation':
        return y.c.generation - x.c.generation || y.power - x.power;
      case 'lineage':
        return (y.c.lineage ?? 0) - (x.c.lineage ?? 0) || y.c.generation - x.c.generation || y.power - x.power;
      case 'species':
        return content.species.get(x.c.speciesId).name.localeCompare(content.species.get(y.c.speciesId).name, 'de') || rarityOrder(y.c) - rarityOrder(x.c) || y.power - x.power;
      case 'name':
        return x.c.name.localeCompare(y.c.name, 'de');
      default:
        return y.power - x.power;
    }
  }

  function look(c: Creature) {
    return expressedAppearance(game, c);
  }
  function pick(id: number) {
    if (parentA === id) parentA = null;
    else if (parentB === id) parentB = null;
    else if (parentA === null) parentA = id;
    else if (parentB === null) parentB = id;
    else parentB = id;
  }
  /** Zwei Zuchtlisten: each list fills its own parent (tap again to clear). */
  function pickSide(id: number, side: 'a' | 'b') {
    if (side === 'a') {
      parentA = parentA === id ? null : id;
      if (parentB === id) parentB = null;
    } else {
      parentB = parentB === id ? null : id;
      if (parentA === id) parentA = null;
    }
  }
  /** Zuchtbuch: the last pair (and its ritual) back into the sockets. */
  function repeatLast() {
    const l = data.last;
    if (!l) return;
    parentA = l.a.id;
    parentB = l.b.id;
    ritualId = l.ritual;
  }
  /** Ritual eggs are opened by hand: crack, then the hatchling is revealed. */
  function openEgg(id: number, ritual: string) {
    if (opening !== null) return;
    opening = id;
    setTimeout(() => {
      opening = null;
      const result = openRitualEgg(game, id);
      if (act(result) && result.hatched?.[0]) reveal = { id: result.hatched[0].id, ritual };
    }, prefs.reduceMotion ? 0 : 700);
  }
  const revealed = $derived.by(() => {
    view.frame;
    const c = reveal ? findCreature(game, reveal.id) : undefined;
    return c ? { c, sp: content.species.get(c.speciesId), rar: content.rarities.get(c.rarity) } : null;
  });

  function breed() {
    if (parentA === null || parentB === null) return;
    if (act(breedByHand(game, parentA, parentB, data.ritual?.id))) {
      parentA = null;
      parentB = null;
    }
  }
</script>

{#snippet socket(c: Creature | undefined, label: string, clear: () => void, color: string)}
  {#if c}
    {@const sp = content.species.get(c.speciesId)}
    {@const rar = content.rarities.get(c.rarity)}
    <button class="socket filled" style="--el: {content.elements.get(sp.element).color}; --mark: {color}" title="Entfernen" onclick={clear}>
      <span class="x">×</span>
      <CreatureSvg appearance={look(c)} shape={sp.shape} tier={sp.tier} size={84} shiny={c.shiny} />
      <b class="pname">{c.name}</b>
      <span class="small muted">{sp.name} · <span style="color: {rar.color}">{rar.name}</span></span>
      <span class="small num muted">Gen {c.generation} · Σ {formatNumber(creaturePower(game, c))}{c.sequenced ? ' · 🧬' : ''}</span>
    </button>
  {:else}
    <div class="socket empty" style="--mark: {color}">
      <span class="plus">+</span>
      <span class="small muted">{label}</span>
    </div>
  {/if}
{/snippet}

<header class="tab-head">
  <h2>🥚 Brutstation</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{nests.eggs.length}/{data.slots}</b><small>Nester</small></span>
    <span class="kpi" class:warn={data.stableFull}>
      <b class="num">{data.stableUsed}/{data.stableCap}</b><small>Stall</small>
      <Meter size="sm" value={data.stableUsed / Math.max(1, data.stableCap)} low={data.stableFull} title="Stall-Belegung" />
    </span>
    <span class="kpi"><b class="num">{formatPercent(data.mutation, 1)}</b><small>Mutation</small></span>
  </div>
</header>

{#if data.automaton}
  <BreedingAutomat auto={data.autoBreed} plan={autoPlan} hybrids={data.hybrids} dynasties={data.dynasties} knownAlleles={data.knownAlleles} ownedSpecies={data.ownedSpecies} recycler={data.recycler} recycleAuto={data.recycleAuto} recycleAutoOn={data.recycleAutoOn} />
{/if}

<!-- Nests -->
<div class="nests">
  {#each nestList as n (n.key)}
    <NestCard egg={n.egg} ritual={n.ritual} auto={n.auto} {opening} onopen={openEgg} />
  {/each}
</div>

{#if revealed}
  <RitualReveal {revealed} ritualName={reveal?.ritual ?? ''} onclose={() => (reveal = null)} />
{/if}

{#if data.hatchlings.length}
  <div class="hatched">
    <span class="small muted">Frisch geschlüpft:</span>
    {#each data.hatchlings as h (h.key)}
      {@const sp = content.species.get(h.c.speciesId)}
      {@const rar = content.rarities.get(h.c.rarity)}
      <button class="chick" class:hybrid={sp.tier !== 'base'} style="--rc: {rar.color}" title="Details" onclick={() => (view.detail = h.c.id)} in:scale={{ duration: 500, start: 0.3 }}>
        <CreatureSvg appearance={look(h.c)} shape={sp.shape} tier={sp.tier} size={36} shiny={h.c.shiny} />
        <span class="cname">{h.c.name}</span>
        <span class="tiny" style="color: {rar.color}">{rar.name}{sp.tier !== 'base' ? ' · Hybrid' : ''}</span>
      </button>
    {/each}
  </div>
{/if}

<!-- Pairing altar -->
{#snippet tileList(list: typeof data.candidates, hidden: number, side: 'a' | 'b' | null)}
  <div class="tiles" class:half={!!side}>
    {#each list as t (t.c.id)}
      {@const sp = content.species.get(t.c.speciesId)}
      <CreatureTile
        creature={t.c}
        mark={parentA === t.c.id ? 1 : parentB === t.c.id ? 2 : null}
        info="Gen {t.c.generation} · {viewState.breeding.sort.startsWith('stat:') ? `${content.stats.get(viewState.breeding.sort.slice(5)).short} ${formatNumber(t.key)}` : `Σ ${formatNumber(t.power)}`}"
        onclick={() => (side ? pickSide(t.c.id, side) : pick(t.c.id))}
      >
        {#snippet corner()}
          {#if t.c.sequenced}<span title="Sequenziert">🧬</span>{/if}
          {#if t.c.job?.kind === 'building'}<span title="Arbeitet gerade" class="muted">⚒</span>{/if}
        {/snippet}
        {#if t.c.name !== sp.name}<span class="tiny muted sp">{sp.name}</span>{/if}
        {#if data.dynasties && t.c.lineage > 0}<span class="tiny num lin" title="Reine Linie">👑 {t.c.lineage}</span>{/if}
      </CreatureTile>
    {:else}
      <p class="muted small">Keine freien Kreaturen.</p>
    {/each}
  </div>
  {#if hidden > 0}<p class="tiny muted more">… und {hidden} weitere – Suche oder Filter grenzen die Liste ein.</p>{/if}
{/snippet}

<article class="panel altar">
  <h3>Neues Ei</h3>
  <div class="pair">
    {@render socket(data.a, 'Elternteil 1', () => (parentA = null), 'var(--gold)')}
    <div class="link">
      {#if data.a && data.b}
        <span class="egg preview"><EggSvg hueA={look(data.a).hue} hueB={look(data.b).hue} size={46} /></span>
      {:else}
        <span class="heart">❤</span>
      {/if}
      <DnaHelix progress={data.a && data.b ? 1 : data.a || data.b ? 0.5 : 0} pairs={10} width={90} height={26} />
      {#if data.last}
        {@const same = parentA === data.last.a.id && parentB === data.last.b.id}
        <button
          class="repeat"
          disabled={same}
          title="Letztes Paar wieder auswählen: {data.last.a.name} × {data.last.b.name}{data.last.ritual ? ' (mit Ritual)' : ''}"
          aria-label="Letztes Paar wieder auswählen"
          onclick={repeatLast}
        >↻</button>
      {/if}
    </div>
    {@render socket(data.b, 'Elternteil 2', () => (parentB = null), '#ff7ad9')}
  </div>

  {#if data.special}
    <div class="rituals" role="radiogroup" aria-label="Brutart">
      <button class="ritual" class:on={!data.ritual} role="radio" aria-checked={!data.ritual} onclick={() => (ritualId = null)}>
        <b>🥚 Normal</b><span class="tiny muted">schnell, normale Chancen</span>
      </button>
      {#each data.rituals as r (r.id)}
        <button class="ritual" class:on={data.ritual?.id === r.id} role="radio" aria-checked={data.ritual?.id === r.id} title={r.description} onclick={() => (ritualId = r.id)}>
          <b>{r.icon} {r.name}</b><span class="tiny muted">{r.hours} h · {r.description}</span>
        </button>
      {/each}
    </div>
    {#if data.ritual}<p class="small muted note">Dauert {data.ritual.hours} {data.ritual.hours === 1 ? 'Stunde' : 'Stunden'} im Ritualnest, neben den normalen Nestern. Die Eltern bleiben frei – eine Keimprobe genügt.</p>{/if}
  {/if}

  <div class="facts">
    <span class="fact">🧬 Gen <b class="num">{data.generation}</b></span>
    <span class="fact">⏱ <b class="num">{formatDuration(data.time)}</b></span>
    <span class="fact">✨ Mutation <b class="num">{formatPercent(data.mutation)}</b></span>
    {#if data.dynasties && data.lineage > 0}<span class="fact" title="Reine Linie, solange das Kind dieselbe Art wird (ein Hybrid bricht sie)">👑 Linie <b class="num">{data.lineage}</b></span>{/if}
  </div>
  <button class="primary go" disabled={parentA === null || parentB === null || !data.affordable || (data.ritual ? ritualFull : nestsFull) || data.stableFull} onclick={breed}>
    🥚 Brüten · <CostLabel cost={data.cost} />
  </button>
  <p class="small muted note">
    {#if data.ritual && ritualFull}{data.ritualSlots > 1 ? 'Alle Ritualnester sind belegt.' : 'Das Ritualnest ist belegt.'}{:else if !data.ritual && nestsFull}Alle Nester sind belegt.{:else if data.stableFull}Der Stall ist voll.{:else if data.ritual}Die Eltern arbeiten weiter.{:else}Arbeitende Eltern werden von ihrer Anlage abgezogen.{/if}
  </p>

  {#if data.a && data.b}
    <details class="plan" open>
      <summary><b>🔮 Zuchtplaner</b> <span class="small muted">Was kann schlüpfen?</span></summary>
      <BreedingPlanner a={data.a} b={data.b} ritual={data.ritual} />
    </details>
  {/if}

  <div class="cand-head">
    <h4>Kandidaten</h4>
    <div class="filters">
      <input type="search" placeholder="Name oder Art …" bind:value={search} />
      {#if !data.split}
        <select bind:value={viewState.breeding.species}>
          <option value="">Alle Arten</option>
          {#each data.ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
        </select>
      {/if}
      <select bind:value={viewState.breeding.rarity}>
        <option value="">Alle Seltenheiten</option>
        {#each content.rarities.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
      </select>
      <span class="sortgroup">
        <select bind:value={viewState.breeding.sort} title="Sortierung">
          <option value="power">{sortArrow} Gesamtstärke</option>
          <option value="rarity">{sortArrow} Seltenheit</option>
          <option value="generation">{sortArrow} Generation</option>
          {#if data.dynasties}<option value="lineage">{sortArrow} Reine Linie</option>{/if}
          <option value="species">Art ({sortAz})</option>
          <option value="name">Name ({sortAz})</option>
          {#each content.stats.list as st (st.id)}<option value={`stat:${st.id}`}>{sortArrow} {st.name}</option>{/each}
        </select>
        <SortToggle bind:inverted={viewState.breeding.invert} />
      </span>
    </div>
  </div>
  {#if data.split}
    <div class="split">
      <section class="side a">
        <div class="side-head">
          <b style="color: var(--gold)">Elternteil 1</b>
          <select bind:value={viewState.breeding.species} title="Art für Elternteil 1">
            <option value="">Alle Arten</option>
            {#each data.ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </select>
        </div>
        {@render tileList(data.candidates, data.hidden, 'a')}
      </section>
      <section class="side b">
        <div class="side-head">
          <b style="color: #ff7ad9">Elternteil 2</b>
          <select bind:value={viewState.breeding.speciesB} title="Art für Elternteil 2">
            <option value="">Alle Arten</option>
            {#each data.ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </select>
          {#if data.a}<button class="tiny same" title="Nur die Art von Elternteil 1" onclick={() => (viewState.breeding.speciesB = data.a!.speciesId)}>= wie 1</button>{/if}
        </div>
        {@render tileList(data.candidatesB, data.hiddenB, 'b')}
      </section>
    </div>
  {:else}
    {@render tileList(data.candidates, data.hidden, null)}
  {/if}
</article>

{#if data.dynasties}<DynastyPanel />{/if}

<p class="muted small hint">
  Nachwuchs erbt gemittelte Werte, Aussehen und Fähigkeiten der Eltern. Mutationen können Werte steigern oder neue Fähigkeiten bringen.
  Die Seltenheit wird bei jeder Geburt neu gewürfelt ({content.rarities.list.length} Stufen).
</p>

<style>
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.68rem; }
  .repeat {
    display: grid; place-items: center; width: 2.2rem; height: 2.2rem; padding: 0; border-radius: 50%; font-size: 1.15rem; line-height: 1;
    border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); background: color-mix(in srgb, var(--teal) 12%, var(--bg-2));
  }
  .repeat:hover:not(:disabled) { box-shadow: 0 0 10px color-mix(in srgb, var(--teal) 50%, transparent); }
  .repeat:disabled { opacity: 0.35; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .side { display: grid; gap: 0.35rem; align-content: start; padding: 0.4rem; border-radius: 10px; background: var(--bg-2); border: 1px solid var(--line); }
  .side.a { border-top: 3px solid var(--gold); }
  .side.b { border-top: 3px solid #ff7ad9; }
  .side-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
  .side-head select { flex: 1 1 8rem; min-width: 0; }
  .same { padding: 0.15rem 0.45rem; }
  @media (max-width: 720px) { .split { grid-template-columns: 1fr; } }

  .kpi.warn { border-color: var(--danger); }


  /* Nests */
  .nests { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; }
  .egg { position: relative; z-index: 1; margin-bottom: 12px; transform-origin: 50% 90%; }
  @keyframes rock { 0%, 100% { rotate: -2deg; } 50% { rotate: 2deg; } }

  .hatched { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-top: 0.6rem; }
  .chick {
    display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem 0.2rem 0.3rem; border-radius: 99px;
    border: 1px solid color-mix(in srgb, var(--rc) 60%, var(--line)); background: color-mix(in srgb, var(--rc) 10%, var(--bg-2));
  }
  .chick.hybrid { border-color: var(--violet); box-shadow: 0 0 10px color-mix(in srgb, var(--violet) 40%, transparent); }
  .cname { font-weight: 600; font-size: 0.8rem; }

  /* Altar */
  .altar { margin-top: 0.75rem; }
  .altar h3 { margin-top: 0; }
  .pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.6rem; }
  .socket {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem;
    min-height: 11rem; padding: 0.5rem; border-radius: 14px; text-align: center;
  }
  .socket.empty { border: 2px dashed color-mix(in srgb, var(--mark) 50%, var(--line)); background: var(--bg-2); }
  .socket.filled { border: 2px solid var(--mark); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 22%, transparent), var(--bg-2) 70%); box-shadow: 0 0 14px color-mix(in srgb, var(--mark) 35%, transparent); }
  .plus { font-size: 2rem; color: var(--mark); opacity: 0.7; }
  .pname { font-size: 0.95rem; }
  .x { position: absolute; top: 4px; right: 10px; color: var(--muted); font-size: 1.1rem; }
  .socket.filled:hover .x { color: var(--danger); }
  .link { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
  .heart { font-size: 1.6rem; color: #ff7a90; opacity: 0.6; }
  .preview { margin: 0; animation: rock 2s ease-in-out infinite; }
  .facts { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.35rem; margin: 0.7rem 0 0.5rem; }
  .rituals { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.35rem; margin-top: 0.7rem; }
  .ritual { display: grid; gap: 0.15rem; text-align: left; padding: 0.4rem 0.55rem; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-2); }
  .ritual.on { border-color: var(--gold); box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 27%, transparent); }
  .fact { padding: 0.15rem 0.6rem; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.8rem; }
  .go { width: 100%; background: linear-gradient(90deg, var(--petrol), #c26bd8); }
  .note { text-align: center; margin: 0.3rem 0 0; }
  .plan { margin-top: 0.6rem; padding: 0.5rem 0.7rem; border: 1px solid var(--line); border-radius: 10px; background: color-mix(in srgb, var(--violet) 6%, var(--bg-2)); }
  .plan summary { cursor: pointer; }

  .cand-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.4rem; margin: 0.9rem 0 0.4rem; }
  .cand-head h4 { margin: 0; }
  .filters { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .filters input { width: 11rem; }
  .sortgroup { display: flex; gap: 0.3rem; }
  .lin { color: var(--gold); font-weight: 700; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 22rem; overflow-y: auto; padding: 2px; }
  .sp { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { margin: 0.3rem 0 0; text-align: center; }
  .hint { margin-top: 1rem; }

  @media (max-width: 600px) {
    .nests { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4rem; }
    .pair { grid-template-columns: 1fr 1fr; }
    .link { grid-column: 1 / -1; grid-row: 2; flex-direction: row; justify-content: center; }
    .socket { min-height: 9rem; }
    .socket :global(svg) { width: 64px; height: 64px; }
    .filters input { width: 100%; }
    .filters select { flex: 1 1 30%; min-width: 0; }
    .sortgroup { flex: 1 1 100%; min-width: 0; }
    .sortgroup select { flex: 1 1 auto; }
  }
</style>
