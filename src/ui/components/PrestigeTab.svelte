<script lang="ts">
  import { content } from '@content/index';
  import { formatNumber } from '@core/format';
  import { performPrestige, prestigeGain } from '@core/prestige';
  import { game, view, act, save } from '../store.svelte';

  const layer = content.prestigeLayers.get('inheritance');
  const data = $derived.by(() => {
    view.frame;
    return {
      gain: prestigeGain(game, layer.id),
      owned: game.state.resources[layer.currency],
      count: game.state.prestige[layer.id]?.count ?? 0,
    };
  });

  function confirmPrestige() {
    if (confirm(`${layer.name} durchführen? ${layer.description}`) && act(performPrestige(game, layer.id))) save();
  }
</script>

<h2>{layer.name}</h2>
<article class="panel">
  <p>{layer.description}</p>
  <p class="num">Besitz: {formatNumber(data.owned ?? 0)} {content.resources.get(layer.currency).icon} · Durchläufe: {data.count}</p>
  <p class="muted small">Jeder Punkt: +2 % Nahrungs- und Goldproduktion.</p>
  <button class="primary" disabled={data.gain.lte(0)} onclick={confirmPrestige}>
    Vererben für <span class="num">+{formatNumber(data.gain)}</span> {content.resources.get(layer.currency).icon}
  </button>
</article>

<style>
  .small { font-size: 0.85rem; }
</style>
