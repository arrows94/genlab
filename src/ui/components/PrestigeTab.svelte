<script lang="ts">
  import { content } from '@content/index';
  import { formatDuration, formatNumber } from '@core/format';
  import { currentRunStart } from '@core/prestige';
  import { game, view } from '../store.svelte';
  import PrestigeOverview from './PrestigeOverview.svelte';

  const layer = content.prestigeLayers.get('inheritance');
  const currency = content.resources.get(layer.currency);

  const data = $derived.by(() => {
    view.slowFrame;
    return {
      owned: game.state.resources[layer.currency]?.toNumber() ?? 0,
      count: game.state.prestige[layer.id]?.count ?? 0,
      runMs: Math.max(0, game.state.lastTickAt - currentRunStart(game, layer.id)),
    };
  });
</script>

<header class="tab-head">
  <h2>♾️ {layer.name}</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{currency.icon} {formatNumber(data.owned)}</b><small>{currency.name}</small></span>
    <span class="kpi"><b class="num">{data.count}</b><small>Durchläufe</small></span>
    <span class="kpi"><b class="num">{formatDuration(data.runMs)}</b><small>dieser Lauf</small></span>
  </div>
</header>

<PrestigeOverview layerId={layer.id} />
