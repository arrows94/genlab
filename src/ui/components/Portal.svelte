<script lang="ts">
  import { untrack } from 'svelte';
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { findCreature } from '@core/creatures';
  import { game, view, portalCovered, portalDone } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import { play } from '../sound';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * The portal between the lab and the other world (GenLab RPG). In: a vortex opens over the lab, pulls the
   * monster in and swallows the screen; then the other world appears. Out: the same backwards. The screen switches
   * at the moment everything is covered. With reduced motion only a short fade.
   */
  const COVER_MS = { full: 1700, reduced: 250 };
  const END_MS = { full: 2500, reduced: 550 };

  const portal = $derived(view.portal);
  /** The timers follow the portal's key only (the portal object changes when it covers the screen). */
  const portalKey = $derived(view.portal?.key ?? null);
  const creature = $derived(portal ? findCreature(game, portal.creatureId) ?? null : null);
  const species = $derived(creature ? content.species.get(creature.speciesId) : null);
  const reduced = $derived(prefs.reduceMotion);

  $effect(() => {
    const key = portalKey;
    if (key === null) return;
    const mode = untrack(() => (prefs.reduceMotion ? 'reduced' : 'full'));
    untrack(() => play('portal', view.portal?.dir === 'out' ? 1 : 0));
    const t1 = setTimeout(() => view.portal?.key === key && portalCovered(), COVER_MS[mode]);
    const t2 = setTimeout(() => view.portal?.key === key && portalDone(), END_MS[mode]);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  });
</script>

{#if portal}
  {#key portal.key}
    <div class="portal {portal.dir}" class:reduced aria-hidden="true">
      {#if !reduced}
        <div class="vortex"></div>
        <div class="vortex inner"></div>
        {#if creature && species}
          <div class="monster">
            <CreatureSvg appearance={expressedAppearance(game, creature)} shape={species.shape} tier={species.tier} size={120} shiny={creature.shiny} />
          </div>
        {/if}
        <p class="caption">{portal.dir === 'in' ? `Ein Sog erfasst ${creature?.name ?? 'dein Monster'} …` : 'Zurück ins Labor …'}</p>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .portal { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; overflow: hidden; pointer-events: all; }
  /* The dark veil: in, it grows over the lab and lifts off the other world; out, the same the other way. */
  .portal::before { content: ''; position: absolute; inset: 0; background: #05030a; opacity: 0; animation: veil 2.5s ease-in-out forwards; }
  @keyframes veil { 0% { opacity: 0; } 55% { opacity: 0.35; } 68%, 76% { opacity: 1; } 100% { opacity: 0; } }

  .vortex {
    position: absolute; width: 60vmax; height: 60vmax; border-radius: 50%;
    background: conic-gradient(from 0deg, var(--teal), #1a0f3a, var(--violet), #05030a, var(--gold), #1a0f3a, var(--teal));
    filter: blur(6px); opacity: 0;
    -webkit-mask: radial-gradient(circle, #000 0 35%, transparent 70%); mask: radial-gradient(circle, #000 0 35%, transparent 70%);
    animation: open 2.5s ease-in forwards, spin 0.9s linear infinite;
  }
  .vortex.inner { width: 30vmax; height: 30vmax; animation-duration: 2.5s, 0.5s; animation-direction: normal, reverse; }
  @keyframes open {
    0% { opacity: 0; scale: 0.05; }
    30% { opacity: 1; scale: 0.6; }
    68% { opacity: 1; scale: 3.2; }
    78% { opacity: 1; scale: 3.2; }
    100% { opacity: 0; scale: 4; }
  }
  @keyframes spin { to { rotate: 360deg; } }

  .monster { position: relative; z-index: 1; filter: drop-shadow(0 0 16px color-mix(in srgb, var(--violet) 67%, transparent)); }
  .in .monster { animation: pulled 1.7s cubic-bezier(0.55, 0, 0.9, 0.5) forwards; }
  @keyframes pulled {
    0% { transform: translateY(18vh) scale(1) rotate(0deg); opacity: 1; }
    35% { transform: translateY(8vh) scale(0.9) rotate(-25deg); }
    100% { transform: translateY(0) scale(0) rotate(900deg); opacity: 0.2; }
  }
  .out .monster { opacity: 0; animation: thrown 2.5s ease-out forwards; }
  @keyframes thrown {
    0%, 60% { transform: scale(0) rotate(-900deg); opacity: 0; }
    62% { opacity: 1; }
    90% { transform: scale(1.15) rotate(0deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 0; }
  }

  .caption { position: absolute; bottom: 18vh; z-index: 1; margin: 0; padding: 0 1rem; text-align: center; font-size: 1.1rem; letter-spacing: 0.05em; color: #e9dcff; text-shadow: 0 0 12px var(--violet); opacity: 0; animation: caption 2.5s ease-in-out forwards; }
  @keyframes caption { 0%, 10% { opacity: 0; } 25%, 60% { opacity: 1; } 70%, 100% { opacity: 0; } }

  /* Reduced motion: only a short fade through dark. */
  .portal.reduced::before { animation: veil-short 0.55s ease-in-out forwards; }
  @keyframes veil-short { 0% { opacity: 0; } 45%, 55% { opacity: 1; } 100% { opacity: 0; } }
</style>
