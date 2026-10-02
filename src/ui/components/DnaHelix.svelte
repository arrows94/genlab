<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * Stylised DNA helix; `progress` (0–1) fills the base pairs from the left, the pair at the edge
   * partly (it fades in), so a slowly rising value moves smoothly. The game's visual signature.
   * Each change of `spin` speeds up the twist for a moment (it keeps its position and eases back).
   */
  let { progress = 1, pairs = 12, width = 160, height = 36, animated = true, spin = 0 }: {
    progress?: number; pairs?: number; width?: number; height?: number; animated?: boolean; spin?: number;
  } = $props();

  const MAX_RATE = 6;
  let svg: SVGSVGElement | undefined = $state();
  let rate = 1;
  let boost = $state(0);
  let frame = 0;
  let last = 0;

  function applyRate() {
    // playbackRate keeps the current phase, so the helix never jumps back to its start.
    for (const a of svg?.getAnimations({ subtree: true }) ?? []) a.playbackRate = rate;
    boost = (rate - 1) / (MAX_RATE - 1);
  }
  function decay(now: number) {
    const dt = now - last;
    last = now;
    rate = 1 + (rate - 1) * Math.exp(-dt / 1000);
    if (rate < 1.02) rate = 1;
    applyRate();
    frame = rate > 1 ? requestAnimationFrame(decay) : 0;
  }
  let seen = untrack(() => spin);
  $effect(() => {
    if (spin === seen || !animated) return;
    seen = spin;
    rate = Math.min(MAX_RATE, rate + 1);
    applyRate();
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(decay);
    }
  });
  $effect(() => () => cancelAnimationFrame(frame));

  const colors = ['#2fd3c4', '#9b6bff', '#f2c14e', '#ff7a90'];
  const items = $derived(
    Array.from({ length: pairs }, (_, i) => {
      const x = ((i + 0.5) / pairs) * width;
      const phase = (i / pairs) * Math.PI * 2;
      const fill = Math.min(1, Math.max(0, (progress - i / pairs) * pairs));
      return { x, phase, fill, color: colors[i % colors.length] };
    }),
  );
</script>

<svg bind:this={svg} class:animated style="--boost: {boost}" viewBox="0 0 {width} {height}" {width} {height} role="img" aria-label="DNA">
  {#each items as p, i (i)}
    {@const y1 = height / 2 + Math.sin(p.phase) * (height / 2 - 4)}
    {@const y2 = height / 2 - Math.sin(p.phase) * (height / 2 - 4)}
    <g style="animation-delay: {-i * 0.12}s">
      {#if p.fill < 1}
        <line x1={p.x} y1={y1} x2={p.x} y2={y2} stroke="#1f4650" stroke-width="3" stroke-linecap="round" />
        <circle cx={p.x} cy={y1} r="3" fill="#1f4650" />
        <circle cx={p.x} cy={y2} r="3" fill="#1f4650" />
      {/if}
      {#if p.fill > 0}
        <g opacity={p.fill}>
          <line x1={p.x} y1={y1} x2={p.x} y2={y2} stroke={p.color} stroke-width="3" stroke-linecap="round" />
          <circle cx={p.x} cy={y1} r="3" fill="#2fd3c4" />
          <circle cx={p.x} cy={y2} r="3" fill="#9b6bff" />
        </g>
      {/if}
    </g>
  {/each}
</svg>

<style>
  svg { display: block; overflow: visible; filter: brightness(calc(1 + var(--boost, 0) * 0.5)) drop-shadow(0 0 calc(var(--boost, 0) * 8px) var(--teal)); }
  .animated g { animation: twist 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes twist {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(-1); }
  }
</style>
