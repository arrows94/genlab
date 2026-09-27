<script lang="ts">
  /** Stylised DNA helix; `progress` (0–1) fills the base pairs. The game's visual signature. */
  let { progress = 1, pairs = 12, width = 160, height = 36, animated = true }: {
    progress?: number; pairs?: number; width?: number; height?: number; animated?: boolean;
  } = $props();

  const colors = ['#2fd3c4', '#9b6bff', '#f2c14e', '#ff7a90'];
  const items = $derived(
    Array.from({ length: pairs }, (_, i) => {
      const x = ((i + 0.5) / pairs) * width;
      const phase = (i / pairs) * Math.PI * 2;
      return { x, phase, filled: i / pairs < progress, color: colors[i % colors.length] };
    }),
  );
</script>

<svg class:animated viewBox="0 0 {width} {height}" {width} {height} role="img" aria-label="DNA">
  {#each items as p, i (i)}
    {@const y1 = height / 2 + Math.sin(p.phase) * (height / 2 - 4)}
    {@const y2 = height / 2 - Math.sin(p.phase) * (height / 2 - 4)}
    <g style="animation-delay: {-i * 0.12}s">
      <line x1={p.x} y1={y1} x2={p.x} y2={y2} stroke={p.filled ? p.color : '#1f4650'} stroke-width="3" stroke-linecap="round" />
      <circle cx={p.x} cy={y1} r="3" fill={p.filled ? '#2fd3c4' : '#1f4650'} />
      <circle cx={p.x} cy={y2} r="3" fill={p.filled ? '#9b6bff' : '#1f4650'} />
    </g>
  {/each}
</svg>

<style>
  svg { display: block; overflow: visible; }
  .animated g { animation: twist 2.4s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
  @keyframes twist {
    0%, 100% { transform: scaleY(1); }
    50% { transform: scaleY(-1); }
  }
</style>
