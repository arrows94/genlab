<script lang="ts">
  import { content } from '@content/index';
  import { formatNumber, formatPercent } from '@core/format';
  import { performPrestige, prestigeGain, resetImpactText } from '@core/prestige';
  import {
    buyResonance, buyTalent, resonanceAvailable, resonanceCost, resonanceLevel, resonanceScale, talentAvailable, talentUnlocked, AEON_CURRENCY,
  } from '@core/features/talents';
  import type { Condition } from '@core/content/types';
  import { game, view, act, save, ask } from '../store.svelte';
  import MegaProjectPanel from './MegaProjectPanel.svelte';

  const layer = content.prestigeLayers.get('aeon');

  /** "Äon-Observatorium: Kuppel" for a sealed tier. */
  function sealText(c: Condition | undefined): string {
    if (c?.type !== 'megaProject') return 'Noch versiegelt.';
    const def = content.megaProjects.get(c.project);
    return `Öffnet sich mit „${def.stages[c.stage - 1]?.name}“ (${def.name}, Bauphase ${c.stage}).`;
  }

  const data = $derived.by(() => {
    view.frame;
    const shards = game.state.resources[AEON_CURRENCY]?.toNumber() ?? 0;
    const tiers = [...new Set(content.talents.list.map((t) => t.tier))].sort((a, b) => a - b);
    const resonances = content.resonances.list.map((def) => {
      const level = resonanceLevel(game, def.id);
      const cost = resonanceCost(def, level);
      return { def, level, cost, scale: resonanceScale(def, level), next: resonanceScale(def, level + 1), affordable: shards >= cost };
    });
    return {
      gain: prestigeGain(game, layer.id),
      shards,
      count: game.state.prestige[layer.id]?.count ?? 0,
      anomaly: game.state.anomaly !== null,
      learned: content.talents.list.filter((t) => game.state.talents[t.id]).length,
      mega: !!game.state.features['megaProjects'],
      tiers: tiers.map((tier) => {
        const talents = content.talents.list.filter((t) => t.tier === tier);
        const sealed = talents.every((t) => !talentUnlocked(game, t.id));
        return {
          tier,
          sealed,
          seal: sealed ? sealText(talents[0]?.unlock) : '',
          talents: talents.map((t) => ({ t, owned: !!game.state.talents[t.id], available: talentAvailable(game, t.id), affordable: shards >= t.cost })),
        };
      }),
      resonanceOpen: resonances.some((r) => resonanceAvailable(game, r.def)),
      resonanceSeal: sealText(content.resonances.list[0]?.requires),
      resonances,
    };
  });

  /** "+25 %" for the first modifier of a resonance at this scale. */
  function effect(def: (typeof content.resonances.list)[number], scale: number): string {
    const m = def.modifiers[0];
    if (!m) return '';
    const v = m.value * scale;
    return m.op === 'add' && m.target === 'breeding.mutation' ? `+${formatPercent(v)}` : m.op === 'mult' ? `×${v.toFixed(2)}` : `+${formatPercent(v, 0)}`;
  }

  async function doAeon() {
    if ((await ask(`Äon einleiten? ${layer.description} ${resetImpactText(game)}`, { ok: 'Äon einleiten', danger: true })) && act(performPrestige(game, layer.id))) save();
  }
</script>

<header class="tab-head">
  <h2>⏳ Äon</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">⏳ {formatNumber(data.shards)}</b><small>Äon-Splitter</small></span>
    <span class="kpi"><b class="num">{data.count}</b><small>Äonen</small></span>
    <span class="kpi"><b class="num">{data.learned}/{content.talents.list.length}</b><small>Talente</small></span>
  </div>
</header>

<article class="panel">
  <p>{layer.description}</p>
  <p class="small muted">Gewinn: √(Erbgut / {formatNumber(game.balance.prestige['aeon']?.divisor ?? 0)}) – je mehr Erbgut du besitzt, desto mehr Splitter.</p>
  <button class="primary" disabled={data.gain.lte(0) || data.anomaly} onclick={doAeon}>
    Äon einleiten für <span class="num">+{formatNumber(data.gain)}</span> ⏳
  </button>
</article>

{#if data.mega}
  <h3>🏗️ Großprojekt</h3>
  <MegaProjectPanel />
{/if}

<h3>Talentbaum</h3>
<div class="tree">
  {#each data.tiers as row (row.tier)}
    <div class="tier-row" class:sealed={row.sealed}>
      <span class="tier-label">Stufe {row.tier}</span>
      {#if row.sealed}
        <div class="seal">
          <span class="lock">🔒</span>
          <div>
            <span class="small">{row.seal}</span>
            <span class="small muted names">{row.talents.map((x) => x.t.name).join(' · ')}</span>
          </div>
        </div>
      {:else}
        <div class="tier">
          {#each row.talents as { t, owned, available, affordable } (t.id)}
            <article class="panel talent" class:owned class:locked={!available && !owned}>
              <b>{t.name}</b>
              <p class="small muted">{t.description}</p>
              {#if t.requires.length}<p class="small req">benötigt: {t.requires.map((r) => content.talents.get(r).name).join(', ')}</p>{/if}
              {#if owned}
                <span class="done">✓ gelernt</span>
              {:else}
                <button class="primary" disabled={!available || !affordable} onclick={() => act(buyTalent(game, t.id))}>Lernen · <span class="num">{t.cost} ⏳</span></button>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</div>

{#if data.mega}
  <h3>〰️ Äon-Resonanz</h3>
  {#if data.resonanceOpen}
    <p class="small muted intro">Endlos steigerbar: Jede Stufe kostet mehr und bringt etwas weniger – so bleiben Splitter immer etwas wert.</p>
    <div class="grid resonances">
      {#each data.resonances as r (r.def.id)}
        <article class="panel resonance" class:active={r.level > 0}>
          <div class="rtop">
            <span class="ricon" style="--level: {Math.min(1, r.level / 10)}">{r.def.icon}</span>
            <div>
              <b>{r.def.name}</b>
              <span class="small muted num">Stufe {r.level}</span>
            </div>
          </div>
          <p class="small muted">{r.def.description}</p>
          <p class="small num">
            {#if r.level > 0}<span class="muted">Wirkung</span> {effect(r.def, r.scale)} → {effect(r.def, r.next)}{:else}<span class="muted">Stufe 1:</span> {effect(r.def, r.next)}{/if}
          </p>
          <button class="primary" disabled={!r.affordable} onclick={() => act(buyResonance(game, r.def.id))}>Verstärken · <span class="num">{r.cost} ⏳</span></button>
        </article>
      {/each}
    </div>
  {:else}
    <div class="seal"><span class="lock">🔒</span><span class="small">{data.resonanceSeal}</span></div>
  {/if}
{/if}

<style>
  .small { font-size: 0.8rem; margin: 0.25rem 0; }
  h3 { margin: 1rem 0 0.5rem; }
  .intro { margin: -0.3rem 0 0.6rem; }
  .tree { display: grid; gap: 0.75rem; }
  .tier-row { display: grid; gap: 0.3rem; }
  .tier-label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .tier { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); position: relative; }
  .talent { display: flex; flex-direction: column; gap: 0.2rem; }
  .talent.owned { border-color: var(--gold); box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 30%, transparent); }
  .talent.locked { opacity: 0.55; }
  .req { color: var(--violet); }
  .done { color: var(--gold); font-weight: 600; }
  .talent button { margin-top: auto; }
  .seal { display: flex; align-items: center; gap: 0.7rem; padding: 0.6rem 0.8rem; border: 1px dashed color-mix(in srgb, var(--violet) 60%, var(--line)); border-radius: var(--radius); background: color-mix(in srgb, var(--violet) 7%, transparent); }
  .seal > div { display: grid; }
  .lock { font-size: 1.4rem; }
  .names { font-style: italic; }
  .resonances { grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }
  .resonance { display: flex; flex-direction: column; gap: 0.25rem; }
  .resonance.active { border-color: color-mix(in srgb, var(--violet) 70%, var(--line)); }
  .rtop { display: flex; align-items: center; gap: 0.55rem; }
  .rtop > div { display: grid; }
  .ricon { font-size: 1.6rem; filter: drop-shadow(0 0 calc(var(--level) * 10px) var(--violet)); }
  .resonance button { margin-top: auto; }
</style>
