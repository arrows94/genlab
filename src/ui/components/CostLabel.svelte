<script lang="ts">
  import { content } from '@content/index';
  import { formatNumber } from '@core/format';
  import type { Cost } from '@core/costs';

  let { cost }: { cost: Cost } = $props();
</script>

{#each Object.entries(cost) as [res, amount] (res)}
  <span class="num cost">{formatNumber(amount)} {content.resources.get(res).icon}</span>
{:else}
  <span class="muted">kostenlos</span>
{/each}

<style>
  .cost + .cost { margin-left: 0.4rem; }
</style>
