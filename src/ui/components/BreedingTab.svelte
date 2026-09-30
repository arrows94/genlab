<script lang="ts">
  import { scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { creaturePower, effectiveStats, findCreature } from '@core/creatures';
  import { activeLoci, expressedAppearance, libraryHas } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { availableRituals, eggCost, eggTimeMs, mutationChance, nestEggs, nestSlots, offspringGeneration, ritualEggs, ritualNestSlots, breedByHand, lastPair, type EggData } from '@core/features/breeding';
  import { processRemainingMs } from '@core/systems/processes';
  import { planAutoBreed, setAutoBreed } from '@core/features/automation';
  import { stableCapacity, stableFree } from '@core/features/stable';
  import type { AutoBreedConfig, Creature, Process } from '@core/state';
  import { game, view, act, openTab } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import { viewState } from '../viewState.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EggSvg from './EggSvg.svelte';
  import BreedingPlanner from './BreedingPlanner.svelte';
  import CrystalSkip from './CrystalSkip.svelte';
  import SortToggle from './SortToggle.svelte';
  import DynastyPanel from './DynastyPanel.svelte';

  /**
   * Brutstation: a row of nests with eggs tinted by both parents (cracking
   * near the end), fresh hatchlings, a pairing altar with two parent sockets
   * and candidate tiles, and the visual breeding planner.
   */

  const twigs: [number, number, number, number][] = [[10, 24, 60, 14], [22, 32, 104, 20], [16, 16, 94, 30], [30, 30, 110, 22], [6, 20, 70, 32]];

  let parentA = $state<number | null>(null);
  /** Besondere Brut: chosen ritual (null = normal egg). */
  let ritualId = $state<string | null>(null);
  let parentB = $state<number | null>(null);
  let search = $state('');

  const data = $derived.by(() => {
    view.frame;
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
      eggs: nestEggs(game).map(eggView),
      ritualSlots: game.state.features['specialBreeding'] ? ritualNestSlots(game) : 0,
      ritualEggs: ritualEggs(game).map(eggView),
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
      mutation: mutationChance(game, ritual),
      rituals,
      ritual,
      special: game.state.features['specialBreeding'] === true,
      dynasties: game.state.features['dynasties'] === true,
      // Pure line of the child (a hybrid would break it).
      lineage: a && b && a.speciesId === b.speciesId ? Math.min(a.lineage ?? 0, b.lineage ?? 0) + 1 : 0,
    };
  });

  // Pair search is heavier than the rest – refreshed at the slow rate.
  const autoPlan = $derived.by(() => {
    view.slowFrame;
    return game.state.features['autoBreed'] && game.state.automation.autoBreed.enabled ? planAutoBreed(game) : null;
  });

  const nestsFull = $derived(data.eggs.length >= data.slots);
  const ritualFull = $derived(data.ritualEggs.length >= data.ritualSlots);
  /** Normal nests first, then the Ritualnest (Besondere Brut). */
  const nestList = $derived([
    ...Array.from({ length: data.slots }, (_, i) => ({ key: `n${i}`, egg: data.eggs[i], ritual: false })),
    ...Array.from({ length: data.ritualSlots }, (_, i) => ({ key: `r${i}`, egg: data.ritualEggs[i], ritual: true })),
  ]);

  function eggView(p: Process) {
    const d = p.data as EggData;
    // Ritual eggs show their Keimprobe (the parents may have changed or gone since).
    const parents = d.sample ?? d.parents.map((id) => findCreature(game, id));
    return {
      id: p.id,
      progress: Math.min(1, p.elapsedMs / p.durationMs),
      remaining: processRemainingMs(game, p),
      parents,
      hues: parents.map((c) => (c ? expressedAppearance(game, c).hue : 180)) as [number, number],
      generation: d.generation,
      ritual: d.ritual && content.breedingRituals.has(d.ritual) ? content.breedingRituals.get(d.ritual) : null,
    };
  }

  const BUDGETS = [[1, 'alle Vorräte'], [0.5, '50 %'], [0.25, '25 %'], [0.1, '10 %']] as const;
  const GOAL_HINTS: Record<string, string> = {
    power: 'Die zwei stärksten Kreaturen.',
    hybrid: 'Eltern eines noch unentdeckten Hybrid-Rezepts (höchste Chance zuerst).',
    dex: 'Die günstigsten zwei einer Art, der noch Dex-Einträge fehlen.',
    allele: 'Sequenzierte Träger des Ziel-Allels – reinerbige zuerst.',
    abilities: 'Kreaturen mit den meisten und seltensten Fähigkeiten.',
    lineage: 'Die zwei tiefsten reinen Linien einer Art – so wächst die Dynastie Generation für Generation.',
    cheap: 'Die niedrigsten Generationen – billiger Nachwuchs für Infusion und Recycler.',
  };

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

  function setAuto(patch: Partial<AutoBreedConfig>) {
    act(setAutoBreed(game, patch));
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
    <span class="kpi"><b class="num">{data.eggs.length}/{data.slots}</b><small>Nester</small></span>
    <span class="kpi" class:warn={data.stableFull}>
      <b class="num">{data.stableUsed}/{data.stableCap}</b><small>Stall</small>
      <span class="mini"><span style="width: {Math.min(100, (data.stableUsed / Math.max(1, data.stableCap)) * 100)}%"></span></span>
    </span>
    <span class="kpi"><b class="num">{formatPercent(data.mutation, 1)}</b><small>Mutation</small></span>
  </div>
</header>

{#if data.automaton}
  {@const auto = data.autoBreed}
  <div class="panel auto" class:on={auto.enabled}>
    <div class="auto-row">
      <label class="switch"><input type="checkbox" checked={auto.enabled} onchange={(e) => setAuto({ enabled: e.currentTarget.checked })} /> <b>🤖 Zuchtautomat</b></label>
      <label>Ziel
        <select value={auto.rule} onchange={(e) => setAuto({ rule: e.currentTarget.value })}>
          <optgroup label="Stärke">
            <option value="power">Gesamtstärke</option>
            {#each content.stats.list as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </optgroup>
          <optgroup label="Sammeln">
            {#if data.hybrids}<option value="hybrid">Neue Hybride entdecken</option>{/if}
            <option value="dex">Dex-Lücken füllen</option>
            <option value="abilities">Fähigkeiten</option>
            <option value="allele">Gen-Ziel (Allel)</option>
            {#if data.dynasties}<option value="lineage">Reine Linie vertiefen</option>{/if}
          </optgroup>
          <optgroup label="Verwertung">
            <option value="cheap">Günstiger Nachwuchs</option>
          </optgroup>
        </select>
      </label>
      {#if auto.rule === 'allele'}
        <label>Allel
          <select value={auto.allele ?? ''} onchange={(e) => setAuto({ allele: e.currentTarget.value || null })}>
            <option value="">– wählen –</option>
            {#each data.knownAlleles as al (al.id)}<option value={al.id}>{al.label}</option>{/each}
          </select>
        </label>
      {/if}
      {#if auto.rule !== 'hybrid'}
        <label>Art
          <select value={auto.species ?? ''} onchange={(e) => setAuto({ species: e.currentTarget.value || null })}>
            <option value="">beliebig</option>
            {#each data.ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
          </select>
        </label>
      {/if}
    </div>
    <div class="auto-row">
      <label title="Ein Ei darf höchstens diesen Anteil jeder Ressource kosten.">Budget pro Ei
        <select value={String(auto.budget)} onchange={(e) => setAuto({ budget: Number(e.currentTarget.value) })}>
          {#each BUDGETS as [v, label] (v)}<option value={String(v)}>{label}</option>{/each}
        </select>
      </label>
    </div>
    <p class="auto-status small">
      <span class="muted">{GOAL_HINTS[auto.rule] ?? `Die zwei mit dem höchsten Wert in ${content.stats.get(auto.rule).name}.`}</span>
      {#if autoPlan}
        {#if autoPlan.ok}<span class="next">Nächstes Paar: <b>{autoPlan.a.name}</b> × <b>{autoPlan.b.name}</b></span>
        {:else}<span class="wait">Wartet: {autoPlan.reason}</span>{/if}
      {/if}
    </p>
    <p class="auto-status small">
      <span class="muted">
        Ist der Stall voll, wartet der Zuchtautomat.
        {#if data.recycleAuto}Platz schafft der Recycling-Automat mit seiner Zerlege-Kammer{data.recycleAutoOn ? '' : ' (gerade ausgeschaltet)'}.{:else if data.recycler}Platz schaffst du im Labor oder im Gen-Recycler – der Recycling-Automat kann das später übernehmen.{:else}Platz schaffst du im Labor (verkaufen).{/if}
      </span>
      {#if data.recycler}<button class="to-recycler" onclick={() => openTab('recycler')}>♻️ Zum Gen-Recycler</button>{/if}
    </p>
  </div>
{/if}

<!-- Nests -->
<div class="nests">
  {#each nestList as n (n.key)}
    {@const egg = n.egg}
    <article class="nest" class:busy={!!egg} class:soon={!!egg && egg.progress > 0.85} class:ritualnest={n.ritual}>
      {#if n.ritual}<span class="rn-label tiny">✨ Ritualnest</span>{/if}
      <div class="egg-wrap">
        {#if egg}
          <span class="glow" style="--h: {egg.hues[0]}; opacity: {0.25 + egg.progress * 0.6}"></span>
          <span class="egg"><EggSvg hueA={egg.hues[0]} hueB={egg.hues[1]} progress={egg.progress} size={52} /></span>
        {:else}
          <span class="egg"><EggSvg hueA={180} hueB={200} size={44} ghost /></span>
        {/if}
        <svg class="twigs" viewBox="0 0 120 40" aria-hidden="true">
          <ellipse cx="60" cy="22" rx="52" ry="14" fill="#4a3320" />
          <ellipse cx="60" cy="18" rx="40" ry="8" fill="#2b1d12" />
          {#each twigs as [x1, y1, x2, y2], j (j)}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7a5433" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
          {/each}
        </svg>
      </div>
      {#if egg}
        <div class="parents">
          {#each egg.parents as p, j (j)}
            {#if p}
              {@const sp = content.species.get(p.speciesId)}
              <span title={p.name}><CreatureSvg appearance={look(p)} shape={sp.shape} tier={sp.tier} size={24} /></span>
            {/if}
            {#if j === 0}<span class="times">×</span>{/if}
          {/each}
        </div>
        <span class="small">{egg.parents.map((p) => p?.name ?? '?').join(' × ')}</span>
        <DnaHelix progress={egg.progress} pairs={14} width={130} height={22} />
        <span class="small num">{#if egg.ritual}<span class="ritual-tag" title={egg.ritual.name}>{egg.ritual.icon}</span>{' '}{/if}<span class="gen">Gen {egg.generation}</span> · noch {formatDuration(egg.remaining)}</span>
        <CrystalSkip process={game.state.processes.find((p) => p.id === egg.id)} />
      {:else}
        <span class="small muted">{n.ritual ? 'Frei für ein Brutritual' : 'Freies Nest'}</span>
      {/if}
    </article>
  {/each}
</div>

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
      {@const rar = content.rarities.get(t.c.rarity)}
      <button
        class="tile"
        class:a={parentA === t.c.id}
        class:b={parentB === t.c.id}
        style="--el: {content.elements.get(sp.element).color}; --rc: {rar.color}"
        title="{t.c.name} · {sp.name} · {rar.name}"
        onclick={() => (side ? pickSide(t.c.id, side) : pick(t.c.id))}
      >
        <CreatureSvg appearance={look(t.c)} shape={sp.shape} tier={sp.tier} size={42} shiny={t.c.shiny} />
        <span class="tname">{t.c.name}</span>
        {#if t.c.name !== sp.name}<span class="tiny muted sp">{sp.name}</span>{/if}
        <span class="tiny num muted">Gen {t.c.generation} · {#if viewState.breeding.sort.startsWith('stat:')}{content.stats.get(viewState.breeding.sort.slice(5)).short} {formatNumber(t.key)}{:else}Σ {formatNumber(t.power)}{/if}</span>
        {#if data.dynasties && t.c.lineage > 0}<span class="tiny num lin" title="Reine Linie">👑 {t.c.lineage}</span>{/if}
        {#if t.c.sequenced}<span class="seq" title="Sequenziert">🧬</span>{/if}
        {#if t.c.job?.kind === 'building'}<span class="work" title="Arbeitet gerade">⚒</span>{/if}
      </button>
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
    {#if data.ritual && ritualFull}Das Ritualnest ist belegt.{:else if !data.ritual && nestsFull}Alle Nester sind belegt.{:else if data.stableFull}Der Stall ist voll.{:else if data.ritual}Die Eltern arbeiten weiter.{:else}Arbeitende Eltern werden von ihrer Anlage abgezogen.{/if}
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
  .to-recycler { align-self: flex-start; font-size: 0.78rem; padding: 0.2rem 0.6rem; }
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
  .mini { width: 100%; height: 3px; border-radius: 99px; background: var(--panel-2); overflow: hidden; margin-top: 2px; }
  .mini span { display: block; height: 100%; background: var(--teal); }
  .kpi.warn .mini span { background: var(--danger); }

  .auto { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
  .auto-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .auto-status { margin: 0; display: flex; gap: 0.3rem 0.75rem; flex-wrap: wrap; }
  .auto-status .next { color: var(--teal); }
  .auto-status .wait { color: var(--gold); }
  .auto.on { border-color: var(--teal); box-shadow: 0 0 12px #2fd3c433; }

  /* Nests */
  .nests { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.6rem; }
  .nest {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.6rem 0.5rem; text-align: center;
    border-radius: var(--radius); border: 1px dashed var(--line); background: var(--bg-2);
  }
  .nest.busy { border: 1px solid var(--line); background: radial-gradient(circle at 50% 30%, #f2c14e14, var(--panel) 70%); }
  .nest.soon { border-color: var(--gold); }
  .nest.ritualnest { position: relative; border: 1px dashed color-mix(in srgb, var(--violet) 60%, var(--line)); background: radial-gradient(circle at 50% 30%, #9b6bff1f, var(--panel) 70%); }
  .rn-label { position: absolute; top: 0.3rem; left: 0.5rem; color: var(--violet); font-weight: 700; }
  .egg-wrap { position: relative; width: 120px; height: 86px; display: grid; justify-items: center; align-items: end; }
  .twigs { position: absolute; bottom: 0; width: 120px; height: 40px; }
  .egg { position: relative; z-index: 1; margin-bottom: 12px; transform-origin: 50% 90%; }
  .glow { position: absolute; bottom: 10px; width: 80px; height: 80px; border-radius: 50%; background: radial-gradient(circle, hsl(var(--h) 80% 60% / 0.7), transparent 65%); }
  .busy .egg { animation: rock 3s ease-in-out infinite; }
  .soon .egg { animation: wobble 0.45s ease-in-out infinite; }
  @keyframes rock { 0%, 100% { rotate: -2deg; } 50% { rotate: 2deg; } }
  @keyframes wobble { 0%, 100% { rotate: -9deg; } 50% { rotate: 9deg; } }
  .parents { display: flex; align-items: center; gap: 0.2rem; }
  .times { color: var(--muted); font-size: 0.8rem; }
  .gen { color: var(--violet); }

  .hatched { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-top: 0.6rem; }
  .chick {
    display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem 0.2rem 0.3rem; border-radius: 99px;
    border: 1px solid color-mix(in srgb, var(--rc) 60%, var(--line)); background: color-mix(in srgb, var(--rc) 10%, var(--bg-2));
  }
  .chick.hybrid { border-color: var(--violet); box-shadow: 0 0 10px #9b6bff66; }
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
  .ritual.on { border-color: var(--gold); box-shadow: 0 0 10px #f2c14e44; }
  .ritual-tag { font-size: 0.9rem; }
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
  .tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.2rem; border-radius: 10px; border: 2px solid color-mix(in srgb, var(--el) 40%, var(--line)); background: var(--bg-2); }
  .tile.a { border-color: var(--gold); box-shadow: 0 0 12px #f2c14e88; }
  .tile.b { border-color: #ff7ad9; box-shadow: 0 0 12px #ff7ad988; }
  .tile.a::after, .tile.b::after { position: absolute; top: 2px; left: 6px; font-weight: 800; font-size: 0.75rem; }
  .tile.a::after { content: '1'; color: var(--gold); }
  .tile.b::after { content: '2'; color: #ff7ad9; }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rc); }
  .sp { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .more { margin: 0.3rem 0 0; text-align: center; }
  .seq { position: absolute; top: 2px; right: 5px; font-size: 0.7rem; }
  .work { position: absolute; top: 18px; right: 6px; font-size: 0.7rem; color: var(--muted); }
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
