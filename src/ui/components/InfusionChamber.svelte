<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { consumeBlocker } from '@core/features/stable';
  import {
    batchInfusionVictims, breakthrough, breakthroughCost, breakthroughPartners, epForLevel, infuse, infusionCandidates, infusionEp,
    infusionPreview, infusionProgress, maxInfusionLevel, nextRarity, statsAtInfusion,
  } from '@core/features/infusion';
  import type { Creature } from '@core/state';
  import { game, view, act, ask } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CostLabel from './CostLabel.svelte';

  /**
   * Infusion chamber: the target sits in an EP ring, same-species creatures
   * are picked as tiles and "flow" into it. At max level the chamber turns
   * into the breakthrough view.
   */
  let { creature }: { creature: Creature } = $props();

  let selected = $state<Set<number>>(new Set());
  let partner = $state<number | null>(null);
  let burst = $state<{ id: number; lines: string[]; color: string } | null>(null);
  let burstId = 0;

  const RING = 2 * Math.PI * 54;

  const data = $derived.by(() => {
    view.frame;
    const c = creature;
    const max = maxInfusionLevel(game);
    const level = c.infusion.level;
    const tiles = infusionCandidates(game, c).map((v) => ({
      v,
      ep: infusionEp(game, v),
      blocker: consumeBlocker(game, v),
      look: expressedAppearance(game, v),
      species: content.species.get(v.speciesId),
      rarity: content.rarities.get(v.rarity),
    }));
    const chosen = tiles.filter((t) => selected.has(t.v.id) && !t.blocker).map((t) => t.v);
    const preview = chosen.length ? infusionPreview(game, c, chosen) : null;
    const next = nextRarity(game, c.rarity);
    return {
      max,
      level,
      ep: c.infusion.ep,
      need: level < max ? epForLevel(game, level + 1) : 0,
      progress: infusionProgress(game, level, c.infusion.ep),
      look: expressedAppearance(game, c),
      species: content.species.get(c.speciesId),
      rarity: content.rarities.get(c.rarity),
      tiles,
      chosen,
      preview,
      incoming: preview ? (preview.newLevel > level ? 1 : infusionProgress(game, preview.newLevel, preview.newEp)) : 0,
      statsNow: statsAtInfusion(game, c, level),
      statsAfter: preview ? statsAtInfusion(game, c, preview.newLevel) : null,
      commons: batchInfusionVictims(game, c, 'common').map((v) => v.id),
      uncommons: batchInfusionVictims(game, c, 'uncommon').map((v) => v.id),
      next: next ? content.rarities.get(next) : null,
      partners: breakthroughPartners(game, c).map((p) => ({ p, blocker: consumeBlocker(game, p), look: expressedAppearance(game, p) })),
      btCost: breakthroughCost(game, c),
    };
  });

  function toggle(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }
  async function doInfuse() {
    const ids = data.chosen.map((v) => v.id);
    if (ids.length && (await ask(`${ids.length} Kreatur(en) in ${creature.name} infundieren? Sie verschwinden dabei.`, { ok: 'Infundieren' })) && act(infuse(game, creature.id, ids))) selected = new Set();
  }
  async function doBreakthrough() {
    const p = partner;
    if (p !== null && (await ask('Durchbruch durchführen? Der Partner verschwindet.', { ok: 'Durchbruch' })) && act(breakthrough(game, creature.id, p))) partner = null;
  }
  function showBurst(lines: string[], color: string) {
    const id = ++burstId;
    burst = { id, lines, color };
    setTimeout(() => burst?.id === id && (burst = null), 1800);
  }

  onMount(() => {
    const offs = [
      game.bus.on('infused', (e) => {
        if (e.targetId !== creature.id) return;
        const lines = [`+${formatNumber(e.ep)} EP`];
        if (e.levelsGained > 0) lines.push(`Stufe +${creature.infusion.level}!`);
        for (const t of e.transferred) lines.push(`🧬 ${content.genes.get(t.locus).alleles.find((a) => a.id === t.allele)?.name}`);
        showBurst(lines, e.levelsGained > 0 ? 'var(--gold)' : 'var(--violet)');
      }),
      game.bus.on('breakthrough', (e) => {
        if (e.creatureId !== creature.id) return;
        const r = content.rarities.get(e.rarity);
        showBurst(['Durchbruch!', r.name], r.color);
      }),
    ];
    return () => offs.forEach((off) => off());
  });
</script>

<section class="chamber">
  <h3>🔮 Infusion <span class="num lvl">+{data.level}<span class="muted">/{data.max}</span></span></h3>

  <div class="core">
    <div class="ring-wrap" class:pulse={!!burst} style="--rc: {data.rarity.color}">
      <svg viewBox="0 0 128 128" class="ring" aria-hidden="true">
        <defs>
          <linearGradient id="inf-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#9b6bff" />
            <stop offset="100%" stop-color="#f2c14e" />
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="54" class="track" />
        {#if data.preview}
          <circle cx="64" cy="64" r="54" class="incoming" stroke-dasharray="{RING * data.incoming} {RING}" />
        {/if}
        <circle cx="64" cy="64" r="54" class="fill" stroke-dasharray="{RING * data.progress} {RING}" />
      </svg>
      <div class="creature"><CreatureSvg appearance={data.look} shape={data.species.shape} tier={data.species.tier} shiny={creature.shiny} size={78} /></div>
      <span class="badge num">+{data.level}</span>
      {#if burst}
        {#key burst.id}
          <div class="burst" style="--bc: {burst.color}">
            {#each burst.lines as line, i (i)}<span style="animation-delay: {i * 0.15}s">{line}</span>{/each}
          </div>
        {/key}
      {/if}
    </div>

    <div class="info">
      <div class="pips" title="Infusionsstufen">
        {#each Array.from({ length: data.max }, (_, i) => i + 1) as n (n)}
          <span class="pip" class:on={n <= data.level} class:soon={!!data.preview && n > data.level && n <= data.preview.newLevel}></span>
        {/each}
      </div>
      {#if data.level < data.max}
        <p class="small num">{formatNumber(data.ep)} / {formatNumber(data.need)} EP bis <b>+{data.level + 1}</b></p>
      {:else}
        <p class="small max">Maximale Stufe erreicht</p>
      {/if}
      <p class="small muted">Je Stufe +{formatPercent(game.balance.infusion.statPerLevel, 0)} auf alle Werte</p>
      <div class="stats">
        {#each content.stats.list as s (s.id)}
          {@const now = data.statsNow[s.id] ?? 0}
          {@const after = data.statsAfter?.[s.id] ?? now}
          <span class="stat num" class:up={after > now}>{s.short} {now}{#if after > now}<b> → {after}</b>{/if}</span>
        {/each}
      </div>
    </div>
  </div>

  {#if data.level < data.max}
    <div class="pick-head">
      <b class="small">Artgenossen aufnehmen</b>
      <div class="quick">
        <button disabled={!data.commons.length} onclick={() => (selected = new Set(data.commons))}>Alle Gewöhnlichen ({data.commons.length})</button>
        <button disabled={!data.uncommons.length} onclick={() => (selected = new Set(data.uncommons))}>bis Ungewöhnlich ({data.uncommons.length})</button>
        {#if selected.size}<button onclick={() => (selected = new Set())}>Leeren</button>{/if}
      </div>
    </div>

    {#if data.tiles.length === 0}
      <p class="muted small empty">Keine weiteren {data.species.name} vorhanden – brüte oder finde welche.</p>
    {:else}
      <div class="tiles">
        {#each data.tiles as t (t.v.id)}
          <button
            class="tile"
            class:on={selected.has(t.v.id)}
            class:blocked={!!t.blocker}
            disabled={!!t.blocker}
            title={t.blocker ?? `${t.v.name} · ${t.rarity.name} · Gen ${t.v.generation}`}
            style="--rc: {t.rarity.color}"
            onclick={() => toggle(t.v.id)}
            out:scale={{ duration: 450, start: 0.2, opacity: 0 }}
          >
            <CreatureSvg appearance={t.look} shape={t.species.shape} tier={t.species.tier} shiny={t.v.shiny} size={44} />
            <span class="tname">{t.v.name}</span>
            <span class="tep num">{t.blocker ? (t.v.locked ? '★' : '⚙') : `+${formatNumber(t.ep)} EP`}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#if data.preview}
      <p class="small summary num">
        +{formatNumber(data.preview.ep)} EP → Stufe <b>+{data.preview.newLevel}</b>
        {#if data.preview.transferCandidates > 0}<span class="dna"> · 🧬 {data.preview.transferCandidates}× {formatPercent(data.preview.transferChance, 0)} Chance auf ein besseres Allel</span>{/if}
      </p>
    {/if}
    <button class="primary go" disabled={!data.chosen.length} onclick={doInfuse}>
      🔮 {data.chosen.length ? `${data.chosen.length} infundieren` : 'Kreaturen auswählen'}
    </button>
  {:else if data.next}
    <div class="bt">
      <div class="bt-row">
        <span class="rbadge" style="--c: {data.rarity.color}">{data.rarity.name}</span>
        <span class="arrow">➜</span>
        <span class="rbadge next" style="--c: {data.next.color}">{data.next.name}</span>
      </div>
      <p class="small muted">Durchbruch mit einer {data.species.name} derselben Seltenheit. Die Infusionsstufe beginnt danach neu.</p>
      {#if data.partners.length === 0}
        <p class="small muted empty">Kein Partner: Es braucht eine weitere {data.species.name} ({data.rarity.name}).</p>
      {:else}
        <div class="tiles">
          {#each data.partners as t (t.p.id)}
            <button class="tile" class:on={partner === t.p.id} class:blocked={!!t.blocker} disabled={!!t.blocker} title={t.blocker ?? t.p.name} style="--rc: {data.rarity.color}" onclick={() => (partner = t.p.id)} out:scale={{ duration: 450, start: 0.2, opacity: 0 }}>
              <CreatureSvg appearance={t.look} shape={data.species.shape} tier={data.species.tier} shiny={t.p.shiny} size={44} />
              <span class="tname">{t.p.name}</span>
              <span class="tep num">Gen {t.p.generation}</span>
            </button>
          {/each}
        </div>
      {/if}
      <button class="primary go bt-go" style="--c: {data.next.color}" disabled={partner === null || !canAfford(game.state, data.btCost)} onclick={doBreakthrough}>
        💥 Durchbruch · <CostLabel cost={data.btCost} />
      </button>
    </div>
  {:else}
    <p class="small muted">Höchste Seltenheit per Durchbruch erreicht. Mythisch gibt es nur durch Zucht und Glück.</p>
  {/if}
</section>

<style>
  .chamber { border-top: 1px solid var(--line); margin-top: 0.75rem; padding-top: 0.25rem; }
  h3 { display: flex; align-items: baseline; gap: 0.5rem; }
  .lvl { color: var(--gold); }
  .small { font-size: 0.8rem; margin: 0.2rem 0; }
  .core { display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap; }

  .ring-wrap { position: relative; width: 140px; height: 140px; flex: 0 0 auto; }
  .ring { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--bg-2); stroke-width: 10; }
  .fill { fill: none; stroke: url(#inf-grad); stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.8s ease-out; filter: drop-shadow(0 0 4px #9b6bff); }
  .incoming { fill: none; stroke: #f2c14e; stroke-width: 10; stroke-linecap: round; opacity: 0.35; animation: breathe 1.4s ease-in-out infinite; }
  @keyframes breathe { 50% { opacity: 0.7; } }
  .creature { position: absolute; inset: 0; display: grid; place-items: center; }
  .creature :global(svg) { border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--rc) 22%, transparent), transparent 70%); }
  .badge {
    position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%); padding: 0.05rem 0.55rem; border-radius: 99px;
    background: linear-gradient(90deg, #9b6bff, #f2c14e); color: #111; font-weight: 800; font-size: 0.85rem; box-shadow: 0 0 10px #f2c14e88;
  }
  .ring-wrap.pulse .ring { animation: ring-pulse 0.9s ease-out; }
  @keyframes ring-pulse { 0% { filter: drop-shadow(0 0 0 #f2c14e); } 40% { filter: drop-shadow(0 0 18px #f2c14e) brightness(1.6); } 100% { filter: none; } }
  .burst { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .burst span {
    font-weight: 800; color: var(--bc); text-shadow: 0 0 8px var(--bc), 0 2px 4px #000; font-size: 1.05rem; white-space: nowrap;
    animation: rise 1.6s ease-out both;
  }
  @keyframes rise { 0% { opacity: 0; transform: translateY(14px) scale(0.7); } 20% { opacity: 1; transform: translateY(0) scale(1.1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-26px); } }

  .info { flex: 1 1 220px; min-width: 0; }
  .pips { display: flex; gap: 4px; margin-bottom: 0.3rem; }
  .pip { flex: 1; max-width: 22px; height: 8px; border-radius: 3px; background: var(--bg-2); border: 1px solid var(--line); }
  .pip.on { background: linear-gradient(90deg, #9b6bff, #f2c14e); border-color: transparent; box-shadow: 0 0 6px #f2c14e66; }
  .pip.soon { background: #f2c14e55; border-color: #f2c14e; animation: breathe 1.2s ease-in-out infinite; }
  .max { color: var(--gold); font-weight: 600; }
  .stats { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; font-size: 0.8rem; margin-top: 0.3rem; }
  .stat.up b { color: var(--teal); }

  .pick-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.8rem; }
  .quick { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .quick button { font-size: 0.75rem; padding: 0.25rem 0.55rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.4rem; margin: 0.5rem 0; max-height: 15rem; overflow-y: auto; padding: 2px; }
  .tile {
    display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.25rem; border-radius: 10px;
    border: 2px solid color-mix(in srgb, var(--rc) 60%, var(--line)); background: var(--bg-2); position: relative;
  }
  .tile.on { border-color: var(--gold); box-shadow: 0 0 12px #f2c14e88; background: color-mix(in srgb, #f2c14e 12%, var(--bg-2)); }
  .tile.on::after { content: '✓'; position: absolute; top: 2px; right: 6px; color: var(--gold); font-weight: 800; }
  .tile.blocked { opacity: 0.4; }
  .tname { font-size: 0.72rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tep { font-size: 0.7rem; color: var(--violet); }
  .summary { margin: 0.2rem 0 0.5rem; }
  .dna { color: var(--teal); }
  .go { width: 100%; padding: 0.65rem; font-size: 1rem; }
  .empty { padding: 0.6rem; border: 1px dashed var(--line); border-radius: 10px; text-align: center; }

  @media (max-width: 520px) {
    .core { justify-content: center; }
    .info { flex-basis: 100%; }
  }

  .bt { margin-top: 0.6rem; }
  .bt-row { display: flex; align-items: center; justify-content: center; gap: 0.75rem; margin: 0.4rem 0; }
  .rbadge { padding: 0.3rem 0.8rem; border-radius: 99px; border: 2px solid var(--c); color: var(--c); font-weight: 700; }
  .rbadge.next { box-shadow: 0 0 14px var(--c); animation: breathe 1.4s ease-in-out infinite; }
  .arrow { color: var(--gold); font-size: 1.3rem; }
  .bt-go { background: linear-gradient(90deg, var(--petrol), var(--c)); }
</style>
