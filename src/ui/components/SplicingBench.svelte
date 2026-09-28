<script lang="ts">
  import { onMount } from 'svelte';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { findCreature } from '@core/creatures';
  import { activeLoci, alleleDef, expressedAppearance, libraryHas, phenotypeLabel } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { describeModifier } from '@core/queries';
  import { instabilityChance, maxSplices, splice, spliceCost, splicePreview } from '@core/features/splicing';
  import { game, view, act } from '../store.svelte';
  import CreaturePicker from './CreaturePicker.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CostLabel from './CostLabel.svelte';

  /**
   * Gene splicing workbench: the target's genome as a DNA ladder with
   * clickable allele slots, the gene library as donor capsules, a live
   * before/after preview and a risk gauge.
   */
  let targetId = $state<number | null>(null);
  let locusId = $state<string | null>(null);
  let slot = $state<0 | 1>(0);
  let donor = $state<string | null>(null);
  /** Flash feedback after a splice: success on the target locus, or the scrambled locus. */
  let flash = $state<{ locus: string; kind: 'ok' | 'fail' | 'scrambled' }[]>([]);
  let message = $state<{ text: string; ok: boolean } | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const sequenced = game.state.creatures.filter((c) => c.sequenced);
    const target = targetId !== null ? findCreature(game, targetId) : undefined;
    const loci = activeLoci(game);
    const locus = loci.find((l) => l.id === locusId) ?? null;
    return {
      sequenced,
      target,
      look: target ? expressedAppearance(game, target) : null,
      species: target ? content.species.get(target.speciesId) : null,
      rungs: target
        ? loci.map((l) => {
            const pair = target.genome[l.id] ?? ['?', '?'];
            return { locus: l, pair, alleles: [alleleDef(l, pair[0]), alleleDef(l, pair[1])], phenotype: phenotypeLabel(l, pair) };
          })
        : [],
      locus,
      donors: locus
        ? locus.alleles.map((a) => ({
            a,
            known: libraryHas(game, locus.id, a.id),
            effects: a.modifiers.map((m) => describeModifier(game, m)),
            current: target?.genome[locus.id]?.[slot] === a.id,
          }))
        : [],
      preview: target && locus && donor ? splicePreview(game, target, locus.id, slot, donor) : null,
      cost: target ? spliceCost(game, target) : null,
      max: maxSplices(game),
      used: target?.splices ?? 0,
      risk: instabilityChance(game),
    };
  });

  const canSplice = $derived(
    !!data.target && !!data.locus && !!donor && data.used < data.max && !!data.cost && canAfford(game.state, data.cost) && !data.donors.find((d) => d.a.id === donor)?.current,
  );

  function pickTarget(id: number | null) {
    targetId = id;
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
    <h3>✂️ Gen-Splicing</h3>
    <p class="muted small">Wähle ein Allel im Genom und ersetze es durch eines aus deiner Genbibliothek.</p>
  </header>

  <div class="top">
    <div class="picker">
      <CreaturePicker creatures={data.sequenced} value={targetId} placeholder="Sequenzierte Kreatur wählen …" onchange={pickTarget} />
      {#if data.sequenced.length === 0}<p class="muted small">Noch keine sequenzierte Kreatur – erst im Sequenzierlabor entschlüsseln.</p>{/if}
    </div>
    {#if data.target && data.look && data.species}
      <div class="subject">
        <CreatureSvg appearance={data.look} shape={data.species.shape} tier={data.species.tier} shiny={data.target.shiny} size={64} />
        <div>
          <b>{data.target.name}</b>
          <div class="pips" title="Splicing-Versuche">
            {#each Array.from({ length: data.max }, (_, i) => i) as i (i)}<span class="pip" class:used={i < data.used}></span>{/each}
            <span class="muted small">{data.max - data.used} von {data.max} Versuchen</span>
          </div>
        </div>
      </div>
      <div class="risk" title="Chance, dass der Eingriff instabil wird">
        <span class="small">Instabilität</span>
        <div class="gauge"><div style="width: {data.risk * 100}%"></div></div>
        <b class="num">{formatPercent(data.risk, 0)}</b>
      </div>
    {/if}
  </div>

  {#if data.target}
    <div class="work">
      <!-- DNA ladder -->
      <div class="ladder" role="list">
        {#each data.rungs as r (r.locus.id)}
          <div class="rung {flashOf(r.locus.id)}" class:active={locusId === r.locus.id} role="listitem">
            <span class="lname">{r.locus.name}</span>
            <div class="pair">
              {#each [0, 1] as const as s (s)}
                {@const al = r.alleles[s]}
                <button
                  class="allele"
                  class:selected={locusId === r.locus.id && slot === s}
                  style="--c: {al?.color ?? '#555'}"
                  title="{al?.name ?? '?'} – Allel {s + 1} ersetzen"
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
        {#if data.locus}
          <h4>Genbibliothek · {data.locus.name} <span class="muted">(Allel {slot + 1})</span></h4>
          <div class="donors">
            {#each data.donors as d (d.a.id)}
              <button
                class="donor"
                class:chosen={donor === d.a.id}
                class:locked={!d.known}
                disabled={!d.known || d.current}
                style="--c: {d.a.color}"
                onclick={() => (donor = d.a.id)}
              >
                <span class="sym num">{d.known ? d.a.symbol : '?'}</span>
                <span class="dname">{d.known ? d.a.name : 'Unbekannt'}</span>
                <span class="eff">{d.current ? 'aktuell' : d.known ? (d.effects.join(', ') || 'keine Wirkung') : 'noch nicht katalogisiert'}</span>
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
                  <span class="delta num" class:up={after > before} class:down={after < before}>{s.short} {formatNumber(before)}{#if after !== before} → {formatNumber(after)}{/if}</span>
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
          </div>
        {/if}
        {#if message}<p class="message" class:ok={message.ok}>{message.text}</p>{/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .bench { margin-bottom: 1rem; }
  .head h3 { margin: 0; }
  .small { font-size: 0.8rem; }
  .top { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; align-items: center; margin: 0.6rem 0; }
  .picker { flex: 1 1 240px; }
  .subject { display: flex; gap: 0.6rem; align-items: center; }
  .pips { display: flex; gap: 0.25rem; align-items: center; margin-top: 0.2rem; }
  .pip { width: 10px; height: 10px; border-radius: 50%; background: var(--teal); box-shadow: 0 0 6px var(--teal); }
  .pip.used { background: var(--line); box-shadow: none; }
  .risk { display: grid; grid-template-columns: auto 110px auto; gap: 0.4rem; align-items: center; }
  .gauge { height: 8px; border-radius: 99px; background: linear-gradient(90deg, #2fd3c4, #f2c14e, #ff6b6b); position: relative; overflow: hidden; }
  .gauge div { position: absolute; inset: 0 auto 0 0; background: transparent; border-right: 3px solid #fff; box-shadow: 0 0 6px #fff; }

  .work { display: grid; grid-template-columns: minmax(260px, 1fr) minmax(260px, 1fr); gap: 1rem; }
  .ladder { display: grid; gap: 0.3rem; padding: 0.4rem 0; }
  .rung { display: grid; grid-template-columns: 7.5rem auto 1fr; align-items: center; gap: 0.5rem; padding: 0.15rem 0.4rem; border-radius: 10px; transition: background 0.2s; }
  .rung.active { background: color-mix(in srgb, var(--teal) 10%, transparent); }
  .lname { color: var(--muted); font-size: 0.8rem; text-align: right; }
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
    text-shadow: 0 1px 2px #000a;
  }
  .allele:hover { border-color: #fff; }
  .allele.selected { border-color: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--teal) 60%, transparent), 0 0 14px var(--c); transform: scale(1.08); }
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
  .deltas { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; margin-top: 0.4rem; font-size: 0.8rem; }
  .delta.up { color: var(--teal); }
  .delta.down { color: var(--danger); }
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
  }
</style>
