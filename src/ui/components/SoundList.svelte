<script lang="ts">
  import { SOUND_GROUPS, preview, type SoundKey } from '../sound';
  import { prefs, updatePrefs } from '../prefs.svelte';

  /** Options → Töne: switch single sounds or whole groups off, with a sample for each. */
  let open = $state(false);
  const off = $derived(new Set(prefs.mutedSounds));

  function toggle(id: SoundKey, on: boolean) {
    const next = new Set(prefs.mutedSounds);
    if (on) next.delete(id);
    else next.add(id);
    updatePrefs({ mutedSounds: [...next] });
  }
  function toggleGroup(ids: SoundKey[], on: boolean) {
    const next = new Set(prefs.mutedSounds);
    for (const id of ids) {
      if (on) next.delete(id);
      else next.add(id);
    }
    updatePrefs({ mutedSounds: [...next] });
  }
</script>

<div class="sounds">
  <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
    <span>Einzelne Klänge</span>
    <span class="muted small">{off.size ? `${off.size} aus` : 'alle an'} {open ? '▾' : '▸'}</span>
  </button>
  {#if open}
    {#if off.size}<button class="small reset" onclick={() => updatePrefs({ mutedSounds: [] })}>Alle wieder einschalten</button>{/if}
    {#each SOUND_GROUPS as g (g.name)}
      {@const ids = g.sounds.map((x) => x.id)}
      {@const allOn = ids.every((id) => !off.has(id))}
      <fieldset>
        <legend>
          <label><input type="checkbox" checked={allOn} indeterminate={!allOn && ids.some((id) => !off.has(id))} onchange={(e) => toggleGroup(ids, e.currentTarget.checked)} /> {g.name}</label>
        </legend>
        <div class="grid">
          {#each g.sounds as snd (snd.id)}
            <div class="row" class:dim={off.has(snd.id)}>
              <label><input type="checkbox" checked={!off.has(snd.id)} onchange={(e) => toggle(snd.id, e.currentTarget.checked)} /> {snd.name}</label>
              <button class="play" title="Probe hören" aria-label="{snd.name} anhören" onclick={() => preview(snd.id)}>▶</button>
            </div>
          {/each}
        </div>
      </fieldset>
    {/each}
  {/if}
</div>

<style>
  .sounds { display: grid; gap: 0.4rem; margin-top: 0.3rem; }
  .head { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0.35rem 0.55rem; font-size: 0.88rem; }
  .small { font-size: 0.8rem; }
  .reset { justify-self: start; }
  fieldset { margin: 0; padding: 0.35rem 0.55rem 0.45rem; border: 1px solid var(--line); border-radius: 10px; }
  legend { padding: 0 0.3rem; font-size: 0.82rem; font-weight: 600; }
  legend label, .row label { display: flex; align-items: center; gap: 0.35rem; }
  .grid { display: grid; gap: 0.1rem 0.8rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr)); }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 0.3rem; font-size: 0.82rem; }
  .row.dim label { color: var(--muted); }
  .play { padding: 0 0.4rem; font-size: 0.7rem; line-height: 1.5; }
</style>
