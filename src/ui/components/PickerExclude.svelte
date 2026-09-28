<script module lang="ts">
  import type { Creature } from '@core/state';
  import { viewState } from '../viewState.svelte';

  /**
   * Toggles shared by the expedition pickers: hide creatures working in a
   * facility and favourites (★ a creature to keep it off expeditions).
   */
  export function pickerAllows(c: Creature): boolean {
    const f = viewState.expedition;
    if (f.hideWorking && c.job?.kind === 'building') return false;
    if (f.hideLocked && c.locked) return false;
    return true;
  }
</script>

<div class="exclude">
  <label title="Kreaturen, die in einer Anlage arbeiten, nicht anbieten"><input type="checkbox" bind:checked={viewState.expedition.hideWorking} /> ⚒ Arbeitende ausblenden</label>
  <label title="Mit ★ markierte Kreaturen nicht anbieten – so lassen sich einzelne Kreaturen ausschließen"><input type="checkbox" bind:checked={viewState.expedition.hideLocked} /> ★ Favoriten ausblenden</label>
</div>

<style>
  .exclude { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; font-size: 0.78rem; color: var(--muted); margin-bottom: 0.4rem; }
  label { display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; }
  input { accent-color: var(--teal); margin: 0; }
</style>
