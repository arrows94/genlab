<script lang="ts">
  import { scale } from 'svelte/transition';
  import { expressedAppearance } from '@core/genetics';
  import type { RarityDef, SpeciesDef } from '@core/content/types';
  import type { Creature } from '@core/state';
  import { dialog } from '../dialog';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /** The hatchling of an opened ritual egg, shown big with its rarity glow. */
  let { revealed, ritualName, onclose }: { revealed: { c: Creature; sp: SpeciesDef; rar: RarityDef }; ritualName: string; onclose: () => void } = $props();

  const look = (c: Creature) => expressedAppearance(game, c);
</script>

<div class="reveal-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="reveal" class:hybrid={revealed.sp.tier !== 'base'} style="--rc: {revealed.rar.color}" role="dialog" aria-modal="true" aria-label="{ritualName} geöffnet" tabindex="-1" use:dialog={{ onescape: onclose }} in:scale={{ duration: 450, start: 0.4 }}>
    <span class="rays" aria-hidden="true"></span>
    <span class="small muted">{ritualName}</span>
    <span class="reveal-art"><CreatureSvg appearance={look(revealed.c)} shape={revealed.sp.shape} tier={revealed.sp.tier} size={110} shiny={revealed.c.shiny} /></span>
    <strong class="reveal-name">{revealed.c.name}</strong>
    <span class="small"><span class="rar">{revealed.rar.name}</span> · {revealed.sp.name}{revealed.sp.tier === 'primal' ? ' · Urzeitwesen' : revealed.sp.tier !== 'base' ? ' · Hybrid' : ''}</span>
    <div class="reveal-actions">
      <button onclick={() => { view.detail = revealed.c.id; onclose(); }}>Details</button>
      <button class="primary" onclick={onclose}>Weiter</button>
    </div>
  </div>
</div>

<style>
  .small { font-size: 0.8rem; }
  .reveal-backdrop { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 1rem; background: #0009; }
  .reveal {
    position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
    width: min(20rem, 100%); padding: 1.2rem 1rem 1rem; border-radius: 16px; text-align: center;
    border: 2px solid var(--rc); background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--rc) 30%, transparent), var(--panel) 70%);
    box-shadow: 0 0 40px color-mix(in srgb, var(--rc) 55%, transparent);
  }
  .reveal.hybrid { box-shadow: 0 0 40px color-mix(in srgb, var(--rc) 55%, transparent), 0 0 18px color-mix(in srgb, var(--violet) 67%, transparent); }
  .rays {
    position: absolute; left: 50%; top: 38%; width: 30rem; height: 30rem; translate: -50% -50%; z-index: 0; pointer-events: none;
    background: repeating-conic-gradient(color-mix(in srgb, var(--rc) 22%, transparent) 0 10deg, transparent 10deg 20deg);
    mask: radial-gradient(circle, #000 20%, transparent 60%); animation: spin 12s linear infinite;
  }
  @keyframes spin { to { rotate: 360deg; } }
  .reveal > :not(.rays) { position: relative; z-index: 1; }
  .reveal-name { font-size: 1.2rem; }
  .rar { color: var(--rc); font-weight: 700; }
  .reveal-actions { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
</style>
