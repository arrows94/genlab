<script lang="ts">
  import { content } from '@content/index';
  import { activeLatent } from '@core/creatures';
  import { findCreature } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { statBreakdown } from '@core/queries';
  import { dynastyRecord, dynastyTier, lineageBonus, nextTierDepth } from '@core/features/dynasty';
  import { toggleLock } from '@core/actions';
  import { batchSellValue, consumeBlocker, sell } from '@core/features/stable';
  import { fragmentValue } from '@core/features/recycler';
  import { inRecycler, sendToRecycler, takeBackFromRecycler } from '@core/features/automation';
  import { game, view, act, ask } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaSequence from './DnaSequence.svelte';
  import EvolvePanel from './EvolvePanel.svelte';
  import CostLabel from './CostLabel.svelte';
  import InfusionChamber from './InfusionChamber.svelte';

  const c = $derived.by(() => {
    view.frame;
    return view.detail !== null ? findCreature(game, view.detail) : undefined;
  });

  const data = $derived.by(() => {
    view.frame;
    if (!c) return null;
    const species = content.species.get(c.speciesId);
    return {
      species,
      rarity: content.rarities.get(c.rarity),
      element: content.elements.get(species.element),
      look: expressedAppearance(game, c),
      stats: statBreakdown(game, c),
      infusion: c.infusion,
      blocker: consumeBlocker(game, c),
      sellValue: batchSellValue(game, [c]),
      fragments: fragmentValue(game, c),
      recycling: inRecycler(game, c.id),
      dynasty: game.state.features['dynasties']
        ? (() => {
            const record = dynastyRecord(game, c.speciesId);
            return { own: lineageBonus(game, c), record, tier: dynastyTier(game, record), next: nextTierDepth(game, record), statPerTier: game.balance.dynasty.statPerTier };
          })()
        : null,
    };
  });

  function close() {
    view.detail = null;
  }
  async function doSell() {
    const cur = c;
    if (cur && (await ask(`${cur.name} verkaufen?`, { ok: 'Verkaufen', danger: true })) && act(sell(game, [cur.id]))) close();
  }
  async function doRecycle() {
    const cur = c;
    if (cur && (await ask(`${cur.name} zum Gen-Recycler schicken? In der Zerlege-Kammer kannst du es dir bis zuletzt noch anders überlegen.`, { ok: 'Zum Recycler', danger: true })) && act(sendToRecycler(game, [cur.id]))) close();
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
              {#if data.recycling}
                <button onclick={() => act(takeBackFromRecycler(game, c!.id))} title="Wartet auf die Zerlege-Kammer oder liegt schon darin. Vom Recycling-Automaten gewählte Kreaturen rettest du als Favorit.">↩ Aus dem Recycler holen</button>
              {:else}
                <button disabled={!!data.blocker} title={data.blocker ?? ''} onclick={doRecycle}>♻️ Zum Recycler · <span class="num">≈ {formatNumber(data.fragments)} 🧩</span></button>
              {/if}
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
                  <td class="num">{formatNumber(s.final)}</td>
                  <td class="muted small">
                    Basis {formatNumber(s.base)}{#if s.rarityMult !== 1} ×{formatNumber(s.rarityMult, { decimals: 2 })} Seltenheit{/if}
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
          {#if game.state.features['deepSequencing']}
            {@const latent = activeLatent(game, c)}
            <p class="latent">
              <b>Erbanlage:</b>
              {#if latent}<span class="lname">{latent.name}</span> <span class="muted small">{latent.description}</span>
              {:else if c.deepSequenced}<span class="muted">keine</span>
              {:else}<span class="muted">??? – nur die Tiefensequenzierung im Genlabor deckt sie auf.</span>{/if}
            </p>
          {/if}

          <h3>Stammbaum{#if c.family} <span class="muted small">· Familie {c.family}</span>{/if}</h3>
          {#if data.dynasty}
            {@const d = data.dynasty}
            <p class="small lineage">
              {#if c.lineage > 0}<b>👑 Reine Linie · Tiefe {c.lineage}</b> <span class="muted">(+{formatPercent(d.own)} Werte)</span>
              {:else}<span class="muted">Keine reine Linie – dafür müssen beide Eltern von derselben Art sein wie das Kind.</span>{/if}
              <br /><span class="muted">Dynastie {data.species.name}: Rekord {d.record}{#if d.tier > 0}{' · '}Stufe {d.tier} (+{formatPercent(d.tier * d.statPerTier)} Werte für die Art){/if}{#if d.next !== null}{' · '}nächste Stufe ab Tiefe {d.next}{/if}</span>
            </p>
          {/if}
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
        <InfusionChamber creature={c} />
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
  .actions { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem; }
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
  .lineage { margin: 0 0 0.5rem; }
  .lineage b { color: var(--gold); }
  .anc { background: var(--bg-2); border-radius: 8px; padding: 0.4rem 0.5rem; font-size: 0.85rem; }
  .grand { display: grid; margin-top: 0.2rem; padding-left: 0.5rem; }
  @media (max-width: 640px) {
    .backdrop { padding: 0.4rem; }
    header { flex-direction: column; align-items: center; text-align: center; }
    .actions { justify-content: center; }
  }
  .latent { margin: 0.5rem 0 0; font-size: 0.9rem; }
  .latent .lname { color: var(--gold); font-weight: 700; }
</style>
