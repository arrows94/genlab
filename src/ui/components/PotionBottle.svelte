<script lang="ts">
  /**
   * A potion bottle for the market shelf. The shape follows the potion kind
   * (round flask, slim vial, big jug, hourglass), the liquid its colour.
   */
  let { kind, color = '#2fd3c4', size = 64, glow = false }: { kind: string; color?: string; size?: number; glow?: boolean } = $props();
  const uid = `pb-${Math.random().toString(36).slice(2, 8)}`;
</script>

<svg viewBox="0 0 60 80" width={size} height={size * (80 / 60)} class:glow style="--c: {color}" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-l" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color={color} stop-opacity="0.75" />
      <stop offset="45%" stop-color={color} />
      <stop offset="100%" stop-color={color} stop-opacity="0.6" />
    </linearGradient>
    <clipPath id="{uid}-c">
      {#if kind === 'permanentStat'}
        <path d="M24 16 V28 C12 32 6 42 6 54 C6 68 17 76 30 76 C43 76 54 68 54 54 C54 42 48 32 36 28 V16 Z" />
      {:else if kind === 'creatureBuff'}
        <path d="M22 14 V30 L16 40 V70 Q16 76 22 76 H38 Q44 76 44 70 V40 L38 30 V14 Z" />
      {:else if kind === 'globalBuff'}
        <path d="M22 14 V24 C10 26 8 34 8 44 V66 Q8 76 18 76 H42 Q52 76 52 66 V44 C52 34 50 26 38 24 V14 Z" />
      {:else if kind === 'abilityLevel'}
        <path d="M24 14 V30 L10 60 Q7 76 30 76 Q53 76 50 60 L36 30 V14 Z" />
      {:else}
        <path d="M14 14 H46 C46 30 34 38 34 45 C34 52 46 60 46 76 H14 C14 60 26 52 26 45 C26 38 14 30 14 14 Z" />
      {/if}
    </clipPath>
  </defs>
  <!-- liquid -->
  <g clip-path="url(#{uid}-c)">
    <rect x="0" y="0" width="60" height="80" fill="#0c1f25" opacity="0.55" />
    {#if kind === 'timeSkip'}
      <rect x="0" y="12" width="60" height="18" fill="url(#{uid}-l)" class="sand-top" />
      <rect x="0" y="58" width="60" height="22" fill="url(#{uid}-l)" />
      <rect x="29" y="30" width="2" height="30" fill={color} class="stream" />
    {:else}
      <path d="M0 {kind === 'creatureBuff' ? 36 : 42} Q15 {kind === 'creatureBuff' ? 32 : 38} 30 {kind === 'creatureBuff' ? 36 : 42} T60 {kind === 'creatureBuff' ? 36 : 42} V80 H0 Z" fill="url(#{uid}-l)" class="wave" />
      {#each [0, 1, 2, 3] as b (b)}
        <circle cx={18 + b * 8} cy="70" r={1.2 + (b % 2)} fill="#fff" opacity="0.7" class="bubble" style="animation-delay: {b * 0.45}s" />
      {/each}
    {/if}
  </g>
  <!-- glass outline + shine -->
  {#if kind === 'permanentStat'}
    <path d="M24 16 V28 C12 32 6 42 6 54 C6 68 17 76 30 76 C43 76 54 68 54 54 C54 42 48 32 36 28 V16 Z" class="glass" />
  {:else if kind === 'creatureBuff'}
    <path d="M22 14 V30 L16 40 V70 Q16 76 22 76 H38 Q44 76 44 70 V40 L38 30 V14 Z" class="glass" />
  {:else if kind === 'globalBuff'}
    <path d="M22 14 V24 C10 26 8 34 8 44 V66 Q8 76 18 76 H42 Q52 76 52 66 V44 C52 34 50 26 38 24 V14 Z" class="glass" />
    <path d="M52 40 Q60 44 58 54 Q56 60 50 60" fill="none" stroke="#9ec9cc" stroke-width="2.5" opacity="0.7" />
  {:else if kind === 'abilityLevel'}
    <path d="M24 14 V30 L10 60 Q7 76 30 76 Q53 76 50 60 L36 30 V14 Z" class="glass" />
    <text x="30" y="64" text-anchor="middle" font-size="13" fill="#fff" opacity="0.8">✦</text>
  {:else}
    <path d="M14 14 H46 C46 30 34 38 34 45 C34 52 46 60 46 76 H14 C14 60 26 52 26 45 C26 38 14 30 14 14 Z" class="glass" />
    <rect x="10" y="74" width="40" height="5" rx="2" fill="#6b4a2b" />
  {/if}
  <path d="M{kind === 'timeSkip' ? 18 : 14} 50 Q{kind === 'timeSkip' ? 18 : 14} 40 20 34" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.35" />
  <!-- cork -->
  <rect x={kind === 'timeSkip' ? 10 : 20} y="6" width={kind === 'timeSkip' ? 40 : 20} height="9" rx="3" fill="#8a5a33" />
  <rect x={kind === 'timeSkip' ? 10 : 20} y="6" width={kind === 'timeSkip' ? 40 : 20} height="3" rx="1.5" fill="#a8703f" />
</svg>

<style>
  svg { display: block; overflow: visible; }
  svg.glow { filter: drop-shadow(0 0 10px var(--c)); }
  .glass { fill: none; stroke: #9ec9cc; stroke-width: 2; opacity: 0.85; }
  .wave { animation: slosh 3.2s ease-in-out infinite; }
  @keyframes slosh { 50% { transform: translateY(1.5px); } }
  .bubble { animation: rise 2.4s ease-in infinite; opacity: 0; }
  @keyframes rise { 0% { transform: translateY(0); opacity: 0; } 20% { opacity: 0.8; } 100% { transform: translateY(-26px); opacity: 0; } }
  .stream { animation: pour 1.2s linear infinite; }
  @keyframes pour { 50% { opacity: 0.4; } }
</style>
