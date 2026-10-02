<script lang="ts">
  import type { Appearance } from '@core/state';
  import { prefs } from '../prefs.svelte';

  let { appearance, shape, tier = 'base', size = 96, shiny = false }: {
    appearance: Appearance & { saturation?: number; lightness?: number };
    shape: string;
    tier?: string;
    size?: number;
    shiny?: boolean;
  } = $props();
  const gid = `shiny-${Math.random().toString(36).slice(2, 9)}`;

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
      spiky: 'M50 16 L58 30 L74 26 L70 42 L84 50 L70 60 L76 76 L60 74 L50 88 L40 74 L24 76 L30 60 L16 50 L30 42 L26 26 L42 30 Z',
      serpent: 'M22 70 C18 50 30 30 50 28 C70 26 82 40 80 56 C78 70 70 72 72 82 C60 88 40 88 30 82 C26 78 24 76 22 70 Z',
      dragon: 'M50 22 C66 22 78 36 78 54 C78 74 66 86 50 86 C34 86 22 74 22 54 C22 36 34 22 50 22 Z',
    }[shape] ?? 'M20 62 C18 36 34 22 50 22 C66 22 82 36 80 62 C79 78 66 84 50 84 C34 84 21 78 20 62 Z',
  );
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
  {#if shape === 'dragon'}
    <path d="M26 48 C4 30 2 56 10 70 C16 62 22 60 28 62 Z" fill={dark} opacity="0.9" />
    <path d="M74 48 C96 30 98 56 90 70 C84 62 78 60 72 62 Z" fill={dark} opacity="0.9" />
    <path d="M50 86 C56 94 66 96 74 92" stroke={dark} stroke-width="4" fill="none" stroke-linecap="round" />
  {/if}
  {#if shape === 'serpent'}
    <path d="M72 82 C84 84 92 78 94 70" stroke={body} stroke-width="7" fill="none" stroke-linecap="round" />
  {/if}
  {#if tier === 'mythic'}
    <circle cx="50" cy="54" r="46" fill="none" stroke={light} stroke-width="1.5" stroke-dasharray="4 6" class="aura" />
  {/if}
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

  {#if shiny}
    <defs>
      <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <!-- SVG <animate> ignores the CSS reduce-motion rule, so it is left out instead. -->
        <stop offset="0%" stop-color="#ff7ad9">{#if !prefs.reduceMotion}<animate attributeName="stop-color" values="#ff7ad9;#7ad9ff;#b8ff7a;#ff7ad9" dur="4s" repeatCount="indefinite" />{/if}</stop>
        <stop offset="50%" stop-color={body} />
        <stop offset="100%" stop-color="#7ad9ff">{#if !prefs.reduceMotion}<animate attributeName="stop-color" values="#7ad9ff;#ffe07a;#ff7ad9;#7ad9ff" dur="4s" repeatCount="indefinite" />{/if}</stop>
      </linearGradient>
    </defs>
  {/if}
  <path d={bodyPath} fill={shiny ? `url(#${gid})` : body} stroke={dark} stroke-width="2" />
  {#if shiny}
    <text x="80" y="24" font-size="14" class="sparkle">✦</text>
  {/if}

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

<style>
  .sparkle { fill: #fff6a8; animation: twinkle 1.4s ease-in-out infinite; }
  @keyframes twinkle { 50% { opacity: 0.2; } }
  .aura { transform-origin: 50px 54px; animation: spin 12s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
