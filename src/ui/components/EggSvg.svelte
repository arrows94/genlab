<script lang="ts">
  /**
   * An egg tinted with both parents' hues (top/bottom). With `progress` the
   * shell starts to crack near the end of the incubation.
   */
  let { hueA, hueB, progress = 0, size = 64, ghost = false }: { hueA: number; hueB: number; progress?: number; size?: number; ghost?: boolean } = $props();
  const gid = `egg-${Math.random().toString(36).slice(2, 9)}`;
  const specks: [number, number, number][] = [[22, 26, 2.2], [38, 20, 1.6], [42, 38, 2.6], [18, 44, 1.8], [30, 54, 2], [44, 56, 1.4], [26, 36, 1.2]];
  const crack = $derived(progress < 0.6 ? 0 : Math.min(1, (progress - 0.6) / 0.35));
</script>

<svg viewBox="0 0 60 72" width={size} height={size * 1.2} aria-hidden="true" class:ghost>
  <defs>
    <linearGradient id="{gid}-g" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="hsl({hueA} 70% 78%)" />
      <stop offset="100%" stop-color="hsl({hueB} 65% 52%)" />
    </linearGradient>
    <radialGradient id="{gid}-h" cx="35%" cy="28%" r="40%">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
  </defs>
  <path d="M30 3 C45 3 56 28 56 45 C56 61 45 70 30 70 C15 70 4 61 4 45 C4 28 15 3 30 3 Z" fill="url(#{gid}-g)" stroke="hsl({hueB} 50% 30%)" stroke-width="1.2" />
  {#each specks as [x, y, r], i (i)}
    <circle cx={x} cy={y} r={r} fill="hsl({(hueA + 180) % 360} 45% 40%)" opacity="0.35" />
  {/each}
  <ellipse cx="30" cy="45" rx="26" ry="25" fill="url(#{gid}-h)" />
  {#if crack > 0}
    <path
      d="M12 34 L19 38 L16 44 L24 47 L22 52 L30 50 L34 56 L38 49 L45 52 L43 44 L49 40"
      fill="none" stroke="#2a1a10" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"
      stroke-dasharray="80" stroke-dashoffset={80 * (1 - crack)}
    />
  {/if}
</svg>

<style>
  svg { display: block; overflow: visible; }
  .ghost { opacity: 0.35; filter: grayscale(0.6); }
</style>
