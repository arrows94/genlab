<script lang="ts">
  import type { Appearance } from '@core/state';

  let { appearance, shape, size = 96 }: { appearance: Appearance & { saturation?: number; lightness?: number }; shape: string; size?: number } = $props();

  const sat = $derived(appearance.saturation ?? 65);
  const lig = $derived(appearance.lightness ?? 55);
  const body = $derived(`hsl(${appearance.hue} ${sat}% ${lig}%)`);
  const dark = $derived(`hsl(${appearance.hue} ${sat * 0.85}% ${lig * 0.62}%)`);
  const light = $derived(`hsl(${(appearance.hue + 20) % 360} ${Math.min(90, sat + 15)}% ${Math.min(92, lig + 20)}%)`);

  const bodyPath = $derived(
    {
      blob: 'M20 62 C18 36 34 22 50 22 C66 22 82 36 80 62 C79 78 66 84 50 84 C34 84 21 78 20 62 Z',
      drop: 'M50 14 C62 34 80 46 78 64 C76 80 64 86 50 86 C36 86 24 80 22 64 C20 46 38 34 50 14 Z',
      round: 'M50 20 C72 20 84 38 84 56 C84 76 70 86 50 86 C30 86 16 76 16 56 C16 38 28 20 50 20 Z',
      wing: 'M50 28 C64 28 74 40 74 56 C74 74 64 84 50 84 C36 84 26 74 26 56 C26 40 36 28 50 28 Z',
    }[shape] ?? 'M20 62 C18 36 34 22 50 22 C66 22 82 36 80 62 C79 78 66 84 50 84 C34 84 21 78 20 62 Z',
  );
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
  {#if shape === 'wing'}
    <path d="M28 50 C8 38 6 60 18 66 C22 62 26 58 30 58 Z" fill={light} opacity="0.85" />
    <path d="M72 50 C92 38 94 60 82 66 C78 62 74 58 70 58 Z" fill={light} opacity="0.85" />
  {/if}

  {#if appearance.horn === 'nub'}
    <circle cx="38" cy="26" r="5" fill={dark} /><circle cx="62" cy="26" r="5" fill={dark} />
  {:else if appearance.horn === 'curved'}
    <path d="M36 30 C28 18 30 10 38 8 C36 16 40 22 42 28 Z" fill={light} />
    <path d="M64 30 C72 18 70 10 62 8 C64 16 60 22 58 28 Z" fill={light} />
  {:else if appearance.horn === 'antenna'}
    <line x1="44" y1="26" x2="38" y2="10" stroke={dark} stroke-width="2" /><circle cx="38" cy="10" r="3" fill={light} />
    <line x1="56" y1="26" x2="62" y2="10" stroke={dark} stroke-width="2" /><circle cx="62" cy="10" r="3" fill={light} />
  {/if}

  <path d={bodyPath} fill={body} stroke={dark} stroke-width="2" />

  {#if appearance.pattern === 'spots'}
    <circle cx="34" cy="66" r="4" fill={dark} opacity="0.5" />
    <circle cx="66" cy="70" r="5" fill={dark} opacity="0.5" />
    <circle cx="58" cy="78" r="3" fill={dark} opacity="0.5" />
  {:else if appearance.pattern === 'stripes'}
    <path d="M30 70 Q50 64 70 70" stroke={dark} stroke-width="3" fill="none" opacity="0.5" />
    <path d="M32 78 Q50 72 68 78" stroke={dark} stroke-width="3" fill="none" opacity="0.5" />
  {:else if appearance.pattern === 'rings'}
    <circle cx="50" cy="70" r="9" stroke={light} stroke-width="3" fill="none" opacity="0.7" />
  {/if}

  <ellipse cx="50" cy="72" rx="14" ry="8" fill={light} opacity="0.35" />

  {#if appearance.eyes === 'sleepy'}
    <path d="M36 48 Q41 52 46 48" stroke="#102" stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M54 48 Q59 52 64 48" stroke="#102" stroke-width="3" fill="none" stroke-linecap="round" />
  {:else if appearance.eyes === 'sharp'}
    <path d="M34 44 L46 48 L36 52 Z" fill="#fff" /><circle cx="41" cy="48" r="2.5" fill="#102" />
    <path d="M66 44 L54 48 L64 52 Z" fill="#fff" /><circle cx="59" cy="48" r="2.5" fill="#102" />
  {:else}
    {@const r = appearance.eyes === 'wide' ? 7 : 5.5}
    <circle cx="41" cy="48" r={r} fill="#fff" /><circle cx="42" cy="49" r={r * 0.5} fill="#102" />
    <circle cx="59" cy="48" r={r} fill="#fff" /><circle cx="60" cy="49" r={r * 0.5} fill="#102" />
  {/if}
  <path d="M45 60 Q50 64 55 60" stroke="#102" stroke-width="2" fill="none" stroke-linecap="round" />
</svg>
