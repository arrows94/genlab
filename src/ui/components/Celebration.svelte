<script lang="ts">
  import { untrack } from 'svelte';
  import { content } from '@content/index';
  import { findCreature } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { view, game } from '../store.svelte';
  import { play } from '../sound';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaHelix from './DnaHelix.svelte';

  /**
   * Full-screen moment for the rare highlights: the first perfect genome of a
   * species („OPTIMALE DNS“) and its first shiny creature. Plays a fanfare,
   * closes on tap or after a few seconds; several wait in a queue.
   */
  const SHOW_MS = 6500;
  const current = $derived(view.celebrations[0] ?? null);

  const info = $derived.by(() => {
    const cur = current;
    if (!cur) return null;
    const species = content.species.get(cur.species);
    const c = findCreature(game, cur.creatureId);
    const perfect = cur.kind === 'perfect';
    return {
      key: cur.key,
      perfect,
      title: perfect ? 'OPTIMALE DNS' : 'SCHILLERND!',
      species,
      name: c?.name ?? species.name,
      look: c ? expressedAppearance(game, c) : { hue: species.hue, pattern: 'none', eyes: 'round', horn: 'none' },
      shiny: !perfect || !!c?.shiny,
      text: perfect
        ? `Jedes Gen in Bestform – das erste perfekte Genom einer ${species.name}.`
        : `Eine seltene Farbmutation – die erste schillernde ${species.name}.`,
    };
  });

  function dismiss(key: number) {
    view.celebrations = view.celebrations.filter((c) => c.key !== key);
  }

  $effect(() => {
    const cur = current;
    if (!cur) return;
    untrack(() => play(cur.kind));
    const timer = setTimeout(() => dismiss(cur.key), SHOW_MS);
    return () => clearTimeout(timer);
  });

  const sparks = Array.from({ length: 28 }, (_, i) => ({ a: (i * 360) / 28 + (i % 3) * 5, d: 120 + (i % 5) * 38, s: 5 + (i % 4) * 2, delay: (i % 7) * 0.06 }));
</script>

<svelte:window onkeydown={(e) => info && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && dismiss(info.key)} />

{#if info}
  {#key info.key}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="celebrate" class:perfect={info.perfect} class:shiny={!info.perfect} role="alertdialog" aria-live="assertive" aria-label={info.title} tabindex="-1" onclick={() => dismiss(info.key)}>
      <div class="flash"></div>
      <div class="rays"></div>
      <div class="stage">
        <div class="burst" aria-hidden="true">
          {#each sparks as s, i (i)}<span class="spark" style="--a: {s.a}deg; --d: {s.d}px; --s: {s.s}px; --delay: {s.delay}s"></span>{/each}
        </div>
        <div class="title" aria-hidden="true">
          {#each [...info.title] as ch, i (i)}<span style="--i: {i}">{ch === ' ' ? '\u00a0' : ch}</span>{/each}
        </div>
        {#if info.perfect}<div class="helix"><DnaHelix progress={1} pairs={18} width={260} height={34} /></div>{/if}
        <div class="hero"><CreatureSvg appearance={info.look} shape={info.species.shape} tier={info.species.tier} size={170} shiny={info.shiny} /></div>
        <p class="name"><b>{info.name}</b>{#if info.name !== info.species.name}{' · '}{info.species.name}{/if}</p>
        <p class="text">{info.text}</p>
        <span class="tap">Tippen zum Weiter{view.celebrations.length > 1 ? ` · noch ${view.celebrations.length - 1}` : ''}</span>
      </div>
    </div>
  {/key}
{/if}

<style>
  .celebrate {
    --c1: #2fd3c4; --c2: #f2c14e;
    position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; overflow: hidden; cursor: pointer; padding: 1rem;
    background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--c1) 22%, #06121599), #000000e6 70%);
    animation: fade-in 0.25s ease-out;
  }
  .celebrate.shiny { --c1: #ff7ad9; --c2: #7ad9ff; }
  @keyframes fade-in { from { opacity: 0; } }

  .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 0.6s ease-out; pointer-events: none; }
  @keyframes flash { 0% { opacity: 0.75; } 100% { opacity: 0; } }

  .rays {
    position: absolute; left: 50%; top: 48%; width: 170vmax; height: 170vmax; translate: -50% -50%; opacity: 0.35;
    background: repeating-conic-gradient(from 0deg, var(--c1) 0deg 6deg, transparent 6deg 18deg, var(--c2) 18deg 24deg, transparent 24deg 36deg);
    mask: radial-gradient(circle, #000 8%, transparent 55%);
    animation: spin 14s linear infinite;
  }
  .shiny .rays { background: repeating-conic-gradient(from 0deg, #ff7ad9 0deg 6deg, transparent 6deg 12deg, #ffe07a 12deg 18deg, transparent 18deg 24deg, #7ad9ff 24deg 30deg, transparent 30deg 36deg); }
  @keyframes spin { to { rotate: 360deg; } }

  .stage { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.4rem; text-align: center; max-width: 36rem; }
  .burst { position: absolute; left: 50%; top: 58%; width: 0; height: 0; }
  .spark {
    position: absolute; width: var(--s); height: var(--s); border-radius: 50%; background: var(--c2); box-shadow: 0 0 10px var(--c2);
    opacity: 0; animation: fly 1.3s cubic-bezier(0.1, 0.8, 0.3, 1) var(--delay) forwards;
  }
  .spark:nth-child(3n) { background: var(--c1); box-shadow: 0 0 10px var(--c1); }
  @keyframes fly {
    0% { transform: rotate(var(--a)) translateY(0) scale(1.4); opacity: 1; }
    100% { transform: rotate(var(--a)) translateY(calc(-1 * var(--d))) scale(0.2); opacity: 0; }
  }

  .title {
    margin: 0; font-size: clamp(2.2rem, 9vw, 4.6rem); font-weight: 900; letter-spacing: 0.08em; line-height: 1; white-space: nowrap;
    color: #fff; text-shadow: 0 0 18px var(--c1), 0 0 42px var(--c1), 0 4px 0 #0008;
  }
  .shiny .title span { background: linear-gradient(90deg, #ff7ad9, #ffe07a, #7ad9ff, #b8ff7a); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 0 14px #ff7ad9aa); }
  .title span { display: inline-block; animation: slam 0.5s cubic-bezier(0.2, 1.8, 0.4, 1) both; animation-delay: calc(0.35s + var(--i) * 0.06s); }
  @keyframes slam { from { transform: translateY(-40px) scale(2.4); opacity: 0; filter: blur(4px); } }

  .helix { opacity: 0; animation: rise 0.6s ease-out 1.1s forwards; filter: drop-shadow(0 0 8px var(--c1)); }
  .hero { position: relative; animation: hero 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) 0.9s both, bob 2.4s ease-in-out 1.7s infinite; filter: drop-shadow(0 0 22px var(--c1)); }
  @keyframes hero { from { transform: scale(0.2) rotate(-12deg); opacity: 0; } }
  @keyframes bob { 50% { transform: translateY(-8px); } }
  .name { margin: 0.2rem 0 0; font-size: 1.15rem; animation: rise 0.5s ease-out 1.4s both; }
  .text { margin: 0; color: var(--muted); animation: rise 0.5s ease-out 1.6s both; }
  .tap { margin-top: 0.8rem; font-size: 0.75rem; color: var(--muted); animation: rise 0.5s ease-out 2.2s both; }
  @keyframes rise { from { transform: translateY(10px); opacity: 0; } to { opacity: 1; } }

  :global(.reduce-motion) .celebrate *, :global(.reduce-motion) .celebrate { animation: none !important; }
  :global(.reduce-motion) .spark, :global(.reduce-motion) .flash { display: none; }
  :global(.reduce-motion) .helix { opacity: 1; }
</style>
