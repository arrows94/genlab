<script lang="ts">
  import { content } from '@content/index';
  import { findCreature } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { statBreakdown } from '@core/queries';
  import { toggleLock } from '@core/actions';
  import { batchSellValue, consumeBlocker, sell } from '@core/features/stable';
  import { fragmentValue, recycle } from '@core/features/recycler';
  import {
    batchInfusionVictims, breakthrough, breakthroughCost, breakthroughPartners, epForLevel, infuse, infusionCandidates, infusionPreview, maxInfusionLevel, nextRarity,
  } from '@core/features/infusion';
  import { canConsume } from '@core/features/stable';
  import { canAfford } from '@core/costs';
  import { game, view, act } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaSequence from './DnaSequence.svelte';
  import EvolvePanel from './EvolvePanel.svelte';
  import CostLabel from './CostLabel.svelte';

  let victims = $state<Set<number>>(new Set());
  let partner = $state<number | null>(null);

  const c = $derived.by(() => {
    view.frame;
    return view.detail !== null ? findCreature(game, view.detail) : undefined;
  });

  const data = $derived.by(() => {
    view.frame;
    if (!c) return null;
    const species = content.species.get(c.speciesId);
    const candidates = infusionCandidates(game, c);
    const chosen = candidates.filter((v) => victims.has(v.id) && canConsume(game, v));
    const max = maxInfusionLevel(game);
    return {
      species,
      rarity: content.rarities.get(c.rarity),
      element: content.elements.get(species.element),
      look: expressedAppearance(game, c),
      stats: statBreakdown(game, c),
      infusion: c.infusion,
      max,
      nextEp: c.infusion.level < max ? epForLevel(game, c.infusion.level + 1) : 0,
      candidates: candidates.map((v) => ({ v, ok: canConsume(game, v) })),
      preview: chosen.length ? infusionPreview(game, c, chosen) : null,
      chosen,
      commons: batchInfusionVictims(game, c, 'common'),
      nextRarity: nextRarity(game, c.rarity),
      partners: breakthroughPartners(game, c).filter((p) => canConsume(game, p)),
      btCost: breakthroughCost(game, c),
      blocker: consumeBlocker(game, c),
      sellValue: batchSellValue(game, [c]),
      fragments: fragmentValue(game, c),
    };
  });

  function close() {
    view.detail = null;
    victims = new Set();
    partner = null;
  }
  function toggleVictim(id: number) {
    const next = new Set(victims);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    victims = next;
  }
  function doInfuse(ids: number[]) {
    if (!c || ids.length === 0) return;
    if (confirm(`${ids.length} Kreatur(en) in ${c.name} infundieren? Sie verschwinden dabei.`) && act(infuse(game, c.id, ids))) victims = new Set();
  }
  function doSell() {
    if (c && confirm(`${c.name} verkaufen?`) && act(sell(game, [c.id]))) close();
  }
  function doRecycle() {
    if (c && confirm(`${c.name} recyceln?`) && act(recycle(game, [c.id]))) close();
  }
  function fmtMod(op: string, v: number) {
    if (op === 'pct') return `${v >= 0 ? '+' : ''}${formatPercent(v, 1)}`;
    if (op === 'mult') return `×${formatNumber(v, { decimals: 2 })}`;
    return `${v >= 0 ? '+' : ''}${formatNumber(v)}`;
  }
</script>

{#if c && data}
  <div class="backdrop" role="presentation" onclick={close}>
    <div class="modal panel" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && close()}>
      <header style="--rarity: {data.rarity.color}; --el: {data.element.color}">
        <div class="art"><CreatureSvg appearance={data.look} shape={data.species.shape} tier={data.species.tier} size={120} shiny={c.shiny} /></div>
        <div class="title">
          <h2>{c.name}{#if data.infusion.level > 0}<span class="plus num"> +{data.infusion.level}</span>{/if}</h2>
          <p><span style="color: var(--rarity)">{data.rarity.name}</span> · <span style="color: var(--el)">{data.element.name}</span> · {data.species.name} · Gen {c.generation}</p>
          <p class="muted small">{data.species.description}</p>
          <div class="actions">
            <button onclick={() => act(toggleLock(game, c!.id))}>{c.locked ? '★ Favorit' : '☆ Als Favorit sperren'}</button>
            <button class="danger" disabled={!!data.blocker} title={data.blocker ?? ''} onclick={doSell}>Verkaufen · <CostLabel cost={data.sellValue} /></button>
            {#if game.state.features['recycler']}
              <button disabled={!!data.blocker} title={data.blocker ?? ''} onclick={doRecycle}>Recyceln · <span class="num">{formatNumber(data.fragments)} 🧩</span></button>
            {/if}
          </div>
        </div>
        <button class="close" onclick={close} aria-label="Schließen">✕</button>
      </header>

      <div class="cols">
        <section>
          <h3>Werte</h3>
          <table class="stats">
            <tbody>
              {#each data.stats as s (s.stat)}
                <tr>
                  <th>{content.stats.get(s.stat).name}</th>
                  <td class="num">{s.final}</td>
                  <td class="muted small">
                    Basis {s.base}{#if s.rarityMult !== 1} ×{formatNumber(s.rarityMult, { decimals: 2 })} Seltenheit{/if}
                    {#each s.parts as p, i (i)}<br />{fmtMod(p.op, p.value)} {p.label}{/each}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if c.abilities.length}
            <h3>Fähigkeiten</h3>
            <ul class="plain">
              {#each c.abilities as id (id)}
                {@const a = content.abilities.get(id)}
                <li><b style="color: {content.rarities.get(a.tier).color}">{a.name}</b> <span class="muted small">{a.description}</span></li>
              {/each}
            </ul>
          {/if}
          <EvolvePanel creature={c} />
        </section>

        <section>
          <h3>Genom {#if !c.sequenced}<span class="muted small">(unbekannt)</span>{/if}</h3>
          <DnaSequence genome={c.genome} known={c.sequenced} detailed />

          <h3>Stammbaum</h3>
          {#if c.ancestry}
            <div class="pedigree">
              {#each c.ancestry as p, i (i)}
                <div class="anc">
                  <b>{p.name}</b> <span class="muted small">{content.species.get(p.speciesId).name} · {content.rarities.get(p.rarity).name} · Gen {p.generation}</span>
                  {#if p.parents}
                    <div class="grand">
                      {#each p.parents as gp, j (j)}
                        <span class="small">↳ {gp.name} <span class="muted">({content.species.get(gp.speciesId).name}, Gen {gp.generation})</span></span>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <p class="muted small">Keine bekannten Eltern (Start, Wildfang oder Kapsel).</p>
          {/if}
        </section>
      </div>

      {#if game.state.features['infusion']}
        <section class="infusion">
          <h3>🔮 Infusion <span class="num">+{data.infusion.level}/{data.max}</span></h3>
          {#if data.infusion.level < data.max}
            <div class="bar"><div style="width: {Math.min(100, (data.infusion.ep / data.nextEp) * 100)}%"></div></div>
            <p class="small muted num">{formatNumber(data.infusion.ep)} / {formatNumber(data.nextEp)} EP bis +{data.infusion.level + 1} · je Stufe +{formatPercent(game.balance.infusion.statPerLevel, 0)} auf alle Werte</p>
            {#if data.candidates.length === 0}
              <p class="muted small">Keine weiteren Kreaturen dieser Art vorhanden.</p>
            {:else}
              <div class="victims">
                {#each data.candidates as { v, ok } (v.id)}
                  <label class:disabled={!ok}>
                    <input type="checkbox" disabled={!ok} checked={victims.has(v.id)} onchange={() => toggleVictim(v.id)} />
                    {v.name} <span class="small" style="color: {content.rarities.get(v.rarity).color}">{content.rarities.get(v.rarity).name}</span> <span class="muted small">Gen {v.generation}{v.locked ? ' · ★' : ''}{v.job ? ' · beschäftigt' : ''}</span>
                  </label>
                {/each}
              </div>
              {#if data.preview}
                <p class="small num">
                  +{formatNumber(data.preview.ep)} EP → Stufe +{data.preview.newLevel}
                  {#if data.preview.transferCandidates > 0} · {data.preview.transferCandidates}× {formatPercent(data.preview.transferChance, 0)} Chance auf Allel-Übertragung{/if}
                </p>
              {/if}
              <div class="row">
                <button class="primary" disabled={!data.chosen.length} onclick={() => doInfuse(data.chosen.map((v) => v.id))}>Infundieren ({data.chosen.length})</button>
                <button disabled={!data.commons.length} onclick={() => doInfuse(data.commons.map((v) => v.id))}>Alle Gewöhnlichen dieser Art ({data.commons.length})</button>
              </div>
            {/if}
          {:else if data.nextRarity}
            <p class="small">Maximale Stufe! <b>Durchbruch</b>: mit einer Kreatur derselben Art und Seltenheit + Material zur Seltenheit <b style="color: {content.rarities.get(data.nextRarity).color}">{content.rarities.get(data.nextRarity).name}</b>. Die Infusionsstufe beginnt danach neu.</p>
            <div class="row">
              <select bind:value={partner}>
                <option value={null}>Partner wählen …</option>
                {#each data.partners as p (p.id)}<option value={p.id}>{p.name} (Gen {p.generation})</option>{/each}
              </select>
              <button class="primary" disabled={partner === null || !canAfford(game.state, data.btCost)} onclick={() => partner !== null && confirm('Durchbruch durchführen? Der Partner verschwindet.') && act(breakthrough(game, c!.id, partner)) && (partner = null)}>
                Durchbruch · <CostLabel cost={data.btCost} />
              </button>
            </div>
          {:else}
            <p class="small muted">Höchste Seltenheit per Durchbruch erreicht. Mythisch gibt es nur durch Zucht und Glück.</p>
          {/if}
        </section>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: #000b; z-index: 25; overflow-y: auto; padding: 1rem; display: flex; justify-content: center; align-items: flex-start; }
  .modal { width: min(900px, 100%); margin: 1rem 0 5rem; position: relative; }
  header { display: flex; gap: 1rem; align-items: flex-start; border-bottom: 1px solid var(--line); padding-bottom: 0.75rem; margin-bottom: 0.75rem; }
  .art { background: radial-gradient(circle, color-mix(in srgb, var(--el) 20%, transparent), transparent 70%); border-radius: 50%; border: 2px solid var(--rarity); }
  .title { flex: 1; min-width: 0; }
  .title h2 { margin: 0 0 0.2rem; }
  .title p { margin: 0.15rem 0; }
  .plus { color: var(--gold); }
  .actions, .row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem; }
  .close { position: absolute; top: 0.6rem; right: 0.6rem; background: none; border: none; font-size: 1.2rem; }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
  h3 { margin: 0.6rem 0 0.4rem; }
  .small { font-size: 0.78rem; }
  .stats { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .stats th { text-align: left; font-weight: 500; color: var(--muted); vertical-align: top; padding: 0.25rem 0.5rem 0.25rem 0; }
  .stats td { vertical-align: top; padding: 0.25rem 0.4rem; }
  .stats td.num { font-weight: 700; font-size: 1rem; }
  .plain { list-style: none; padding: 0; margin: 0 0 0.5rem; display: grid; gap: 0.25rem; font-size: 0.85rem; }
  .pedigree { display: grid; gap: 0.4rem; }
  .anc { background: var(--bg-2); border-radius: 8px; padding: 0.4rem 0.5rem; font-size: 0.85rem; }
  .grand { display: grid; margin-top: 0.2rem; padding-left: 0.5rem; }
  .infusion { border-top: 1px solid var(--line); margin-top: 0.75rem; }
  .bar { height: 8px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--gold)); }
  .victims { display: grid; gap: 0.2rem; max-height: 12rem; overflow-y: auto; font-size: 0.85rem; margin: 0.4rem 0; }
  .victims label.disabled { opacity: 0.45; }
  @media (max-width: 640px) {
    .backdrop { padding: 0.4rem; }
    header { flex-direction: column; align-items: center; text-align: center; }
    .actions { justify-content: center; }
  }
</style>
