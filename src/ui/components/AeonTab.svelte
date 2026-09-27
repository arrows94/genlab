<script lang="ts">
  import { content } from '@content/index';
  import { formatNumber } from '@core/format';
  import { performPrestige, prestigeGain } from '@core/prestige';
  import { buyTalent, talentAvailable, AEON_CURRENCY } from '@core/features/talents';
  import { game, view, act, save } from '../store.svelte';

  const layer = content.prestigeLayers.get('aeon');

  const data = $derived.by(() => {
    view.frame;
    const shards = game.state.resources[AEON_CURRENCY];
    const tiers = [...new Set(content.talents.list.map((t) => t.tier))].sort((a, b) => a - b);
    return {
      gain: prestigeGain(game, layer.id),
      shards,
      count: game.state.prestige[layer.id]?.count ?? 0,
      anomaly: game.state.anomaly !== null,
      tiers: tiers.map((tier) => ({
        tier,
        talents: content.talents.list
          .filter((t) => t.tier === tier)
          .map((t) => ({ t, owned: !!game.state.talents[t.id], available: talentAvailable(game, t.id), affordable: (shards?.toNumber() ?? 0) >= t.cost })),
      })),
    };
  });

  function doAeon() {
    if (confirm(`Äon einleiten? ${layer.description}`) && act(performPrestige(game, layer.id))) save();
  }
</script>

<h2>⏳ Äon</h2>
<article class="panel">
  <p>{layer.description}</p>
  <p class="num">Äon-Splitter: {formatNumber(data.shards ?? 0)} · Äonen: {data.count}</p>
  <p class="small muted">Gewinn: √(Erbgut / {formatNumber(game.balance.prestige['aeon']?.divisor ?? 0)}) – je mehr Erbgut du besitzt, desto mehr Splitter.</p>
  <button class="primary" disabled={data.gain.lte(0) || data.anomaly} onclick={doAeon}>
    Äon einleiten für <span class="num">+{formatNumber(data.gain)}</span> ⏳
  </button>
</article>

<h3>Talentbaum</h3>
<div class="tree">
  {#each data.tiers as row (row.tier)}
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
  {/each}
</div>

<style>
  .small { font-size: 0.8rem; margin: 0.25rem 0; }
  h3 { margin: 1rem 0 0.5rem; }
  .tree { display: grid; gap: 0.75rem; }
  .tier { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); position: relative; }
  .talent { display: flex; flex-direction: column; gap: 0.2rem; }
  .talent.owned { border-color: var(--gold); box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 30%, transparent); }
  .talent.locked { opacity: 0.55; }
  .req { color: var(--violet); }
  .done { color: var(--gold); font-weight: 600; }
  button { margin-top: auto; }
</style>
