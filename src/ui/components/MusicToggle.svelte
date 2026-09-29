<script lang="ts">
  import { prefs, updatePrefs } from '../prefs.svelte';

  /** Quick music switch in the header (volume lives in the options). */
</script>

<button
  class="music"
  class:on={prefs.music}
  onclick={() => updatePrefs({ music: !prefs.music })}
  aria-pressed={prefs.music}
  aria-label={prefs.music ? 'Musik ausschalten' : 'Musik einschalten'}
  title={prefs.music ? 'Musik aus' : 'Musik an'}
>
  <span aria-hidden="true">{prefs.music ? '🎵' : '🔇'}</span>
  {#if prefs.music}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{/if}
</button>

<style>
  .music { position: relative; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.3rem 0.55rem; font-size: 1.05rem; line-height: 1; background: var(--bg-2); }
  .music.on { border-color: color-mix(in srgb, var(--violet) 55%, var(--line)); }
  .eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 0.8rem; }
  .eq i { display: block; width: 3px; height: 40%; border-radius: 1px; background: var(--violet); animation: eq 0.9s ease-in-out infinite; }
  .eq i:nth-child(2) { animation-delay: 0.3s; }
  .eq i:nth-child(3) { animation-delay: 0.6s; }
  @keyframes eq { 0%, 100% { height: 30%; } 50% { height: 100%; } }
</style>
