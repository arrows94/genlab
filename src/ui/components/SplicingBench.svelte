<script lang="ts">
  import { onMount } from 'svelte';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { expressedAppearance, genomeReport, libraryHas } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { describeModifier, sortCreatures, type CreatureSort } from '@core/queries';
  import { instabilityChance, isFullySpliced, maxSplices, splice, spliceCost, splicePreview, splicesLeft } from '@core/features/splicing';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSortSelect from './CreatureSortSelect.svelte';

  /**
   * Gene splicing workbench: pick a sequenced creature from a filterable
   * gallery (finished ones hidden by default), then its genome as a DNA ladder
   * with clickable allele slots, the gene library as donor capsules, a live
   * before/after preview and a risk gauge.
   */
  let targetId = $state<number | null>(null);
  /** Gallery open although a target is chosen ("Wechseln"). */
  let choosing = $state(false);
  let search = $state('');
  let locusId = $state<string | null>(null);
  let slot = $state<0 | 1>(0);
  let donor = $state<string | null>(null);
  /** Flash feedback after a splice: success on the target locus, or the scrambled locus. */
  let flash = $state<{ locus: string; kind: 'ok' | 'fail' | 'scrambled' }[]>([]);
  let message = $state<{ text: string; ok: boolean } | null>(null);

  const species = (c: Creature) => content.species.get(c.speciesId);

  /** Loci with a top allele: how many are homozygous for it. */
  function topScore(c: Creature) {
    const withTop = genomeReport(game, c.genome).filter((r) => r.top);
    return { perfect: withTop.filter((r) => r.perfect).length, total: withTop.length };
  }

  const gallery = $derived.by(() => {
    view.slowFrame;
    const sequenced = game.state.creatures.filter((c) => c.sequenced);
    const q = search.trim().toLowerCase();
    const { sort, invert } = viewState.splicing;
    const matching = sequenced.filter((c) => !q || c.name.toLowerCase().includes(q) || species(c).name.toLowerCase().includes(q));
    // The shared creature sort; „Versuche übrig“ is the bench's own (strongest first on ties).
    const ordered = sort === 'left'
      ? sortCreatures(game, matching, 'power').sort((a, b) => splicesLeft(game, b) - splicesLeft(game, a))
      : sortCreatures(game, matching, sort as CreatureSort);
    if (invert) ordered.reverse();
    const all = ordered.map((c) => ({ c, left: splicesLeft(game, c), done: isFullySpliced(game, c), top: topScore(c) }));
    const shown = viewState.splicing.hideDone ? all.filter((t) => !t.done || t.c.id === targetId) : all;
    return {
      total: sequenced.length,
      hidden: all.length - shown.length,
      // Finished ones (when shown) stay behind the others.
      tiles: [...shown.filter((t) => !t.done), ...shown.filter((t) => t.done)],
    };
  });

  const data = $derived.by(() => {
    view.frame;
    const target = targetId !== null ? findCreature(game, targetId) : undefined;
    const report = target?.sequenced ? genomeReport(game, target.genome) : [];
    const rungs = report.map((r) => ({
      ...r,
      phenotype: r.expression.map((e) => e.allele.name).join(' / '),
      // The library holds a better allele than this locus has twice.
      improvable: !!r.top && !r.perfect && libraryHas(game, r.locus.id, r.top.id),
    }));
    const rung = rungs.find((r) => r.locus.id === locusId) ?? null;
    return {
      target,
      look: target ? expressedAppearance(game, target) : null,
      species: target ? species(target) : null,
      rungs,
      rung,
      improvable: rungs.filter((r) => r.improvable).length,
      donors: rung
        ? rung.locus.alleles.map((a) => ({
            a,
            known: libraryHas(game, rung.locus.id, a.id),
            effects: a.modifiers.map((m) => describeModifier(game, m)),
            current: target?.genome[rung.locus.id]?.[slot] === a.id,
          }))
        : [],
      preview: target && rung && donor ? splicePreview(game, target, rung.locus.id, slot, donor) : null,
      cost: target ? spliceCost(game, target) : null,
      max: maxSplices(game),
      used: target?.splices ?? 0,
      risk: instabilityChance(game),
    };
  });

  const showGallery = $derived(choosing || !data.target);
  const canSplice = $derived(
    !!data.target && !!data.rung && !!donor && data.used < data.max && !!data.cost && canAfford(game.state, data.cost) && !data.donors.find((d) => d.a.id === donor)?.current,
  );

  function pickTarget(id: number) {
    targetId = id;
    choosing = false;
    locusId = null;
    donor = null;
    message = null;
  }
  let sideEl: HTMLElement | undefined = $state();
  function pickSlot(l: string, s: 0 | 1) {
    locusId = l;
    slot = s;
    donor = null;
    // Single-column layout: bring the donor capsules into view.
    if (window.matchMedia('(max-width: 720px)').matches) requestAnimationFrame(() => sideEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  onMount(() =>
    game.bus.on('spliced', (e) => {
      if (e.creatureId !== targetId) return;
      flash = e.success ? [{ locus: e.locus, kind: 'ok' }] : [{ locus: e.locus, kind: 'fail' }, ...(e.scrambledLocus ? [{ locus: e.scrambledLocus, kind: 'scrambled' as const }] : [])];
      const name = (id: string) => content.genes.get(id).name;
      message = e.success
        ? { text: `Erfolg! ${name(e.locus)} wurde umgeschrieben.`, ok: true }
        : { text: `Instabil! ${name(e.locus)} blieb unverändert${e.scrambledLocus ? `, dafür ist ${name(e.scrambledLocus)} mutiert` : ''}.`, ok: false };
      donor = null;
      setTimeout(() => (flash = []), 1400);
    }),
  );

  function doSplice() {
    if (targetId !== null && locusId && donor) act(splice(game, targetId, locusId, slot, donor));
  }
  const flashOf = (l: string) => flash.find((f) => f.locus === l)?.kind ?? '';
</script>

<section class="panel bench">
  <header class="head">
    <div>
      <h3>✂️ Gen-Splicing</h3>
      <p class="muted small">Wähle ein Allel im Genom und ersetze es durch eines aus deiner Genbibliothek.</p>
    </div>
    <div class="risk" title="Chance, dass der Eingriff instabil wird: das Ziel bleibt dann unverändert und ein anderes Gen mutiert">
      <span class="small">Instabilität</span>
      <div class="gauge"><div style="left: {data.risk * 100}%"></div></div>
      <b class="num">{formatPercent(data.risk, 0)}</b>
    </div>
  </header>

  {#if showGallery}
    <div class="gallery">
      <div class="toolbar">
        <input type="search" placeholder="Name oder Art suchen …" bind:value={search} />
        <CreatureSortSelect bind:value={viewState.splicing.sort} bind:inverted={viewState.splicing.invert} genetics extra={[{ id: 'left', label: 'Versuche übrig' }]} />
        <label class="toggle" class:on={viewState.splicing.hideDone} title="Kreaturen ohne Versuche oder mit perfektem Genom ausblenden">
          <input type="checkbox" bind:checked={viewState.splicing.hideDone} /> Fertige ausblenden
        </label>
        {#if gallery.hidden > 0}<span class="small muted">{gallery.hidden} ausgeblendet</span>{/if}
        {#if data.target}<button class="close" onclick={() => (choosing = false)}>Abbrechen</button>{/if}
      </div>
      <div class="tiles">
        {#each gallery.tiles as t (t.c.id)}
          {@const sp = species(t.c)}
          <button
            class="tile"
            class:on={targetId === t.c.id}
            class:done={t.done}
            style="--el: {content.elements.get(sp.element).color}; --rarity: {content.rarities.get(t.c.rarity).color}"
            title="{t.c.name} · {sp.name} · {content.rarities.get(t.c.rarity).name}"
            onclick={() => pickTarget(t.c.id)}
          >
            {#if t.top.total > 0 && t.top.perfect === t.top.total}<span class="badge gold">perfekt</span>{:else if t.left === 0}<span class="badge">fertig</span>{/if}
            <CreatureSvg appearance={expressedAppearance(game, t.c)} shape={sp.shape} tier={sp.tier} size={42} shiny={t.c.shiny} />
            <span class="tname">{t.c.name}</span>
            <span class="pips" title="{t.left} von {data.max} Versuchen übrig">
              {#each Array.from({ length: data.max }, (_, i) => i) as i (i)}<span class="pip" class:used={i >= t.left}></span>{/each}
            </span>
            <span class="small num muted" title="Loci reinerbig mit dem besten Allel">✦ {t.top.perfect}/{t.top.total}</span>
          </button>
        {:else}
          <p class="small muted empty">
            {#if gallery.total === 0}Noch keine sequenzierte Kreatur – erst im Sequenzierlabor entschlüsseln.
            {:else if search}Keine Kreatur passt zur Suche.
            {:else}Alle sequenzierten Kreaturen sind fertig gesplict. Blende sie ein, um sie trotzdem anzusehen.{/if}
          </p>
        {/each}
      </div>
    </div>
  {/if}

  {#if data.target && data.look && data.species && !choosing}
    {@const el = content.elements.get(data.species.element)}
    <div class="subject" style="--el: {el.color}; --rarity: {content.rarities.get(data.target.rarity).color}">
      <span class="portrait"><CreatureSvg appearance={data.look} shape={data.species.shape} tier={data.species.tier} shiny={data.target.shiny} size={64} /></span>
      <div class="who">
        <b class="sname">{data.target.name}</b>
        <span class="small muted">{data.species.name} · {el.name}</span>
        <div class="pips big" title="Splicing-Versuche">
          {#each Array.from({ length: data.max }, (_, i) => i) as i (i)}<span class="pip" class:used={i < data.used}></span>{/each}
          <span class="muted small">{data.max - data.used} von {data.max} Versuchen</span>
        </div>
      </div>
      <div class="facts">
        {#if data.improvable > 0}<span class="fact up" title="Loci, deren bestes Allel du schon in der Bibliothek hast">↑ {data.improvable} verbesserbar</span>
        {:else}<span class="fact muted">keine Top-Allele mehr offen</span>{/if}
        <button class="close" onclick={() => (choosing = true)}>Wechseln</button>
      </div>
    </div>

    <div class="work">
      <!-- DNA ladder -->
      <div class="ladder" role="list">
        {#each data.rungs as r (r.locus.id)}
          <div class="rung {flashOf(r.locus.id)}" class:active={locusId === r.locus.id} class:perfect={r.perfect} role="listitem" title={r.locus.description}>
            <span class="lname">
              {#if r.perfect}<span class="star" title="Reinerbig mit dem besten Allel">★</span>{:else if r.improvable}<span class="up" title="Bestes Allel ({r.top?.name}) liegt in der Bibliothek">↑</span>{/if}
              {r.locus.name}
            </span>
            <div class="pair">
              {#each [0, 1] as const as s (s)}
                {@const al = r.alleles[s]}
                <button
                  class="allele"
                  class:selected={locusId === r.locus.id && slot === s}
                  class:masked={!r.expressed[s]}
                  class:top={al?.top}
                  style="--c: {al?.color ?? '#555'}"
                  title="{al?.name ?? '?'}{r.expressed[s] ? '' : ' (verdeckt)'} – Allel {s + 1} ersetzen"
                  onclick={() => pickSlot(r.locus.id, s)}
                >{al?.symbol ?? '?'}</button>
                {#if s === 0}<span class="bond"></span>{/if}
              {/each}
            </div>
            <span class="pheno small">{r.phenotype}</span>
          </div>
        {/each}
      </div>

      <!-- Donor library + preview -->
      <div class="side" bind:this={sideEl}>
        {#if data.rung}
          <h4>Genbibliothek · {data.rung.locus.name} <span class="muted">(Allel {slot + 1})</span></h4>
          <div class="donors">
            {#each data.donors as d (d.a.id)}
              <button
                class="donor"
                class:chosen={donor === d.a.id}
                class:locked={!d.known}
                class:top={d.known && d.a.top}
                disabled={!d.known || d.current}
                style="--c: {d.a.color}"
                onclick={() => (donor = d.a.id)}
              >
                <span class="sym num">{d.known ? d.a.symbol : '?'}</span>
                <span class="dname">{d.known ? d.a.name : 'Unbekannt'}{#if d.known && d.a.top}<span class="star"> ★</span>{/if}</span>
                <span class="eff">{d.current ? 'aktuell in diesem Slot' : d.known ? (d.effects.join(', ') || 'keine Wirkung') : 'noch nicht katalogisiert'}</span>
              </button>
            {/each}
          </div>

          {#if data.preview}
            {@const p = data.preview}
            <div class="preview">
              <div class="change">
                <span class="from">{p.phenotypeBefore}</span>
                <span class="arrow">→</span>
                <span class="to" class:same={!p.visibleChange}>{p.phenotypeAfter}</span>
              </div>
              {#if !p.visibleChange}<p class="small muted">Keine sichtbare Änderung – das neue Allel wird vom anderen überdeckt (rezessiv). Es wird aber vererbt.</p>{/if}
              <div class="deltas">
                {#each content.stats.list as s (s.id)}
                  {@const before = p.statsBefore[s.id] ?? 0}
                  {@const after = p.statsAfter[s.id] ?? 0}
                  <span class="delta num" class:up={after > before} class:down={after < before}>
                    <span class="muted">{s.short}</span> {formatNumber(after)}
                    {#if after !== before}<small>{after > before ? '▲' : '▼'} {formatNumber(Math.abs(after - before))}</small>{/if}
                  </span>
                {/each}
              </div>
            </div>
          {/if}

          <button class="primary go" disabled={!canSplice} onclick={doSplice}>
            ✂️ Splicen {#if data.cost}· <CostLabel cost={data.cost} />{/if}
          </button>
          {#if data.used >= data.max}<p class="small warn">Diese Kreatur verträgt keine weiteren Eingriffe.</p>{/if}
        {:else}
          <div class="hint">
            <span class="big">🧬</span>
            <p>Tippe links auf ein Allel, das du ersetzen möchtest.</p>
            {#if data.improvable > 0}<p class="small">Gene mit <b class="up">↑</b> lassen sich mit einem Top-Allel aus deiner Bibliothek verbessern.</p>{/if}
          </div>
        {/if}
        {#if message}<p class="message" class:ok={message.ok}>{message.text}</p>{/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .bench { margin-bottom: 1rem; display: grid; gap: 0.7rem; }
  .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem 1rem; }
  .head h3 { margin: 0; }
  .head p { margin: 0.15rem 0 0; }
  .small { font-size: 0.8rem; }
  .risk { display: grid; grid-template-columns: auto 110px auto; gap: 0.4rem; align-items: center; }
  .gauge { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #2fd3c4, #f2c14e, #ff6b6b); position: relative; }
  .gauge div { position: absolute; top: -3px; bottom: -3px; width: 3px; margin-left: -1.5px; border-radius: 2px; background: #fff; box-shadow: 0 0 6px #fff; }

  /* Target gallery */
  .gallery { display: grid; gap: 0.45rem; padding: 0.55rem; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); }
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.7rem; }
  .toolbar input[type='search'] { flex: 1 1 12rem; max-width: 20rem; }
  .toggle { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; padding: 0.25rem 0.55rem; border-radius: 8px; border: 1px solid var(--line); }
  .toggle.on { border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); }
  .close { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
  .toolbar .close { margin-left: auto; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 17rem; overflow-y: auto; padding: 2px; }
  .tile {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.15rem; padding: 0.4rem 0.25rem 0.3rem; border-radius: 10px;
    border: 2px solid color-mix(in srgb, var(--el) 45%, var(--line)); background: radial-gradient(circle at 50% 25%, color-mix(in srgb, var(--el) 14%, transparent), var(--panel) 70%);
  }
  .tile:hover { border-color: var(--teal); }
  .tile.on { border-color: var(--gold); box-shadow: 0 0 12px #f2c14e66; }
  .tile.done { opacity: 0.55; filter: saturate(0.6); }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rarity); }
  .badge { position: absolute; top: 3px; right: 3px; font-size: 0.6rem; padding: 0 0.3rem; border-radius: 99px; background: var(--line); color: var(--text); }
  .badge.gold { background: color-mix(in srgb, var(--gold) 30%, transparent); color: var(--gold); }
  .empty { grid-column: 1 / -1; margin: 0.3rem 0; }

  .pips { display: flex; gap: 0.2rem; align-items: center; }
  .pip { width: 7px; height: 7px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 5px var(--teal); }
  .pip.used { background: var(--line); box-shadow: none; }
  .pips.big { gap: 0.25rem; margin-top: 0.2rem; }
  .pips.big .pip { width: 10px; height: 10px; }

  /* Chosen subject */
  .subject {
    display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: center; padding: 0.5rem 0.7rem; border-radius: var(--radius);
    background: radial-gradient(circle at 0% 50%, color-mix(in srgb, var(--el) 22%, transparent), transparent 55%), var(--bg-2);
    border: 1px solid color-mix(in srgb, var(--el) 40%, var(--line));
  }
  .portrait { line-height: 0; padding: 0.15rem; border-radius: 50%; background: #0005; border: 2px solid color-mix(in srgb, var(--el) 60%, transparent); }
  .who { display: grid; gap: 0.05rem; }
  .sname { font-size: 1.05rem; border-bottom: 2px solid var(--rarity); justify-self: start; }
  .facts { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
  .fact { font-size: 0.78rem; padding: 0.15rem 0.5rem; border-radius: 99px; border: 1px solid var(--line); }
  .fact.up { color: var(--teal); border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }

  .work { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr); gap: 1rem; }
  .ladder {
    display: grid; gap: 0.3rem; padding: 0.5rem 0.3rem; border-radius: var(--radius);
    background: linear-gradient(180deg, #06110f, var(--bg-2)); border: 1px solid var(--line);
  }
  .rung { display: grid; grid-template-columns: 7.5rem auto 1fr; align-items: center; gap: 0.5rem; padding: 0.15rem 0.4rem; border-radius: 10px; transition: background 0.2s; }
  .rung.active { background: color-mix(in srgb, var(--teal) 12%, transparent); }
  .rung.perfect .lname { color: var(--gold); }
  .lname { color: var(--muted); font-size: 0.8rem; text-align: right; }
  .star { color: var(--gold); }
  .up { color: var(--teal); font-weight: 700; }
  .pair { display: flex; align-items: center; position: relative; isolation: isolate; }
  /* The two DNA backbones run through every rung behind the allele capsules. */
  .pair::before, .pair::after {
    content: ''; position: absolute; top: -0.35rem; bottom: -0.35rem; width: 3px; border-radius: 2px; z-index: -1;
  }
  .pair::before { left: calc(1.3rem - 1.5px); background: color-mix(in srgb, var(--teal) 45%, transparent); }
  .pair::after { right: calc(1.3rem - 1.5px); background: color-mix(in srgb, var(--violet) 45%, transparent); }
  .bond { width: 22px; height: 3px; background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 7px); }
  .allele {
    width: 2.6rem; height: 1.9rem; padding: 0; border-radius: 999px; font-family: var(--mono); font-weight: 700; font-size: 0.85rem;
    background: color-mix(in srgb, var(--c) 35%, var(--bg-2)); border: 2px solid color-mix(in srgb, var(--c) 70%, transparent); color: #fff;
    text-shadow: 0 1px 2px #000a; transition: transform 0.15s, box-shadow 0.15s;
  }
  .allele:hover { border-color: #fff; }
  .allele.masked { opacity: 0.5; border-style: dashed; }
  .allele.top { box-shadow: 0 0 8px color-mix(in srgb, var(--c) 60%, transparent); }
  .allele.selected { opacity: 1; border-color: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal) 60%, transparent), 0 0 14px var(--c); transform: scale(1.08); }
  .pheno { color: var(--text); opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .rung.ok { animation: ok-flash 1.3s ease-out; }
  .rung.fail { animation: fail-shake 0.5s ease-in-out 2; }
  .rung.scrambled { animation: scramble 1.3s ease-out; }
  @keyframes ok-flash { 0% { background: color-mix(in srgb, var(--teal) 55%, transparent); box-shadow: 0 0 18px var(--teal); } 100% { background: transparent; } }
  @keyframes fail-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); background: color-mix(in srgb, var(--danger) 30%, transparent); } 75% { transform: translateX(6px); } }
  @keyframes scramble { 0% { background: color-mix(in srgb, var(--violet) 55%, transparent); box-shadow: 0 0 18px var(--violet); } 100% { background: transparent; } }

  .side { display: flex; flex-direction: column; gap: 0.6rem; }
  h4 { margin: 0; font-size: 0.95rem; }
  .donors { display: grid; gap: 0.4rem; }
  .donor {
    display: grid; grid-template-columns: 2.6rem 1fr; grid-template-rows: auto auto; column-gap: 0.6rem; text-align: left; padding: 0.45rem 0.6rem;
    border: 1px solid color-mix(in srgb, var(--c) 55%, var(--line)); background: linear-gradient(90deg, color-mix(in srgb, var(--c) 22%, var(--bg-2)), var(--bg-2));
  }
  .donor .sym { grid-row: span 2; align-self: center; justify-self: center; width: 2.4rem; height: 2.4rem; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, var(--c) 45%, #0008); font-weight: 700; color: #fff; }
  .donor.top .sym { box-shadow: 0 0 10px color-mix(in srgb, var(--c) 70%, transparent); }
  .dname { font-weight: 600; }
  .eff { font-size: 0.75rem; color: var(--muted); }
  .donor.chosen { border-color: #fff; box-shadow: 0 0 14px color-mix(in srgb, var(--c) 70%, transparent); }
  .donor.locked { filter: grayscale(1); opacity: 0.45; border-style: dashed; }
  .donor:disabled:not(.locked) { opacity: 0.6; }

  .preview { border: 1px solid var(--line); border-radius: 10px; padding: 0.6rem; background: var(--bg-2); }
  .change { display: flex; gap: 0.5rem; align-items: center; font-weight: 600; flex-wrap: wrap; }
  .from { color: var(--muted); text-decoration: line-through; }
  .arrow { color: var(--teal); }
  .to { color: var(--gold); }
  .to.same { color: var(--muted); }
  .deltas { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr)); gap: 0.3rem; margin-top: 0.45rem; font-size: 0.8rem; }
  .delta { padding: 0.15rem 0.4rem; border-radius: 6px; background: var(--panel); border: 1px solid var(--line); }
  .delta small { font-size: 0.7rem; }
  .delta.up { color: var(--teal); border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }
  .delta.down { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 50%, var(--line)); }
  .go { width: 100%; padding: 0.7rem; font-size: 1rem; }
  .warn { color: var(--danger); margin: 0; }
  .hint { display: grid; place-items: center; text-align: center; padding: 1.5rem 0.5rem; border: 1px dashed var(--line); border-radius: 10px; color: var(--muted); }
  .hint .big { font-size: 2rem; }
  .hint p { margin: 0.3rem 0 0; }
  .message { margin: 0; padding: 0.5rem 0.7rem; border-radius: 8px; background: color-mix(in srgb, var(--danger) 18%, transparent); color: #ffd0d0; animation: fade-in 0.3s ease-out; }
  .message.ok { background: color-mix(in srgb, var(--teal) 18%, transparent); color: #c9fff8; }

  @media (max-width: 720px) {
    .work { grid-template-columns: 1fr; }
    .rung { grid-template-columns: 5.5rem auto 1fr; }
    .facts { margin-left: 0; }
  }
</style>
