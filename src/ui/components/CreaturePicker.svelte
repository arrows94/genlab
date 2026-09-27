<script lang="ts">
  import { content } from '@content/index';
  import type { Creature } from '@core/state';

  let { creatures, value = $bindable(null), placeholder = 'Kreatur wählen …' }: {
    creatures: Creature[]; value?: number | null; placeholder?: string;
  } = $props();
</script>

<select value={value ?? ''} onchange={(e) => (value = e.currentTarget.value ? Number(e.currentTarget.value) : null)}>
  <option value="">{placeholder}</option>
  {#each creatures as c (c.id)}
    <option value={c.id}>{c.name} · {content.species.get(c.speciesId).name} · {content.rarities.get(c.rarity).name} · Gen {c.generation}</option>
  {/each}
</select>

<style>
  select { width: 100%; }
</style>
