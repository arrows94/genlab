<script lang="ts">
  /**
   * A gene capsule: coloured cap, glass half with a DNA strand floating in
   * liquid. `state` drives the opening: `idle` floats gently, `shake` rattles
   * (harder with `intensity`), `open` splits the halves apart.
   */
  let {
    color = '#2fd3c4', accent = '#9b6bff', size = 64, state = 'idle', glow = null,
  }: { color?: string; accent?: string; size?: number; state?: 'idle' | 'shake' | 'open'; glow?: string | null } = $props();
  const uid = `gc-${Math.random().toString(36).slice(2, 8)}`;
  const rungs = [0, 1, 2, 3, 4, 5];
</script>

<svg viewBox="0 0 60 110" width={size} height={size * (110 / 60)} class="cap {state}" style="--c: {color}; --a: {accent}; --g: {glow ?? color}" aria-hidden="true">
  <defs>
    <linearGradient id="{uid}-cap" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color={color} stop-opacity="0.7" />
      <stop offset="40%" stop-color={color} />
      <stop offset="100%" stop-color={color} stop-opacity="0.55" />
    </linearGradient>
    <linearGradient id="{uid}-liq" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color={accent} stop-opacity="0.35" />
      <stop offset="100%" stop-color={accent} stop-opacity="0.8" />
    </linearGradient>
    <radialGradient id="{uid}-halo">
      <stop offset="0%" stop-color="var(--g)" stop-opacity="0.9" />
      <stop offset="100%" stop-color="var(--g)" stop-opacity="0" />
    </radialGradient>
    <clipPath id="{uid}-glass"><path d="M8 55 H52 V80 A22 22 0 0 1 8 80 Z" /></clipPath>
  </defs>

  <!-- light that shines out when it opens -->
  <circle class="halo" cx="30" cy="55" r="34" fill="url(#{uid}-halo)" />

  <!-- lower half: glass with liquid and a DNA strand -->
  <g class="bottom">
    <g clip-path="url(#{uid}-glass)">
      <rect x="0" y="55" width="60" height="55" fill="#0c1f25" opacity="0.6" />
      <path class="liquid" d="M0 66 Q15 62 30 66 T60 66 V110 H0 Z" fill="url(#{uid}-liq)" />
      <g class="dna">
        {#each rungs as i (i)}
          {@const y = 60 + i * 7}
          {@const dx = Math.sin(i * 1.1) * 9}
          <line x1={30 - dx} y1={y} x2={30 + dx} y2={y} stroke={i % 2 ? color : accent} stroke-width="2" stroke-linecap="round" opacity="0.9" />
          <circle cx={30 - dx} cy={y} r="1.8" fill="#dff" />
          <circle cx={30 + dx} cy={y} r="1.8" fill="#dff" />
        {/each}
      </g>
    </g>
    <path d="M8 55 H52 V80 A22 22 0 0 1 8 80 Z" class="glass" />
    <path d="M14 62 V80 Q14 90 20 95" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.3" />
  </g>

  <!-- upper half: the coloured cap -->
  <g class="top">
    <path d="M8 55 V30 A22 22 0 0 1 52 30 V55 Z" fill="url(#{uid}-cap)" />
    <path d="M8 55 V30 A22 22 0 0 1 52 30 V55 Z" class="rim" />
    <path d="M15 44 V31 Q15 18 26 13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.35" />
    <rect x="6" y="51" width="48" height="6" rx="2.5" fill={color} class="band" />
  </g>
</svg>

<style>
  svg { display: block; overflow: visible; }
  .glass { fill: none; stroke: #9ec9cc; stroke-width: 2; opacity: 0.8; }
  .rim { fill: none; stroke: #ffffff55; stroke-width: 1.5; }
  .band { filter: brightness(0.8); }
  .halo { opacity: 0; transform-box: fill-box; transform-origin: center; }
  .top, .bottom { transform-box: view-box; transform-origin: 30px 55px; transition: transform 0.35s cubic-bezier(0.2, 1.4, 0.4, 1); }
  .liquid { animation: slosh 3s ease-in-out infinite; }
  .dna { animation: bob 3s ease-in-out infinite; }
  @keyframes slosh { 50% { transform: translateY(-2px); } }
  @keyframes bob { 50% { transform: translateY(-1.5px); } }

  .idle { animation: float 3.2s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-4px) rotate(2deg); } }

  .shake { animation: rattle 0.12s linear infinite alternate; filter: drop-shadow(0 0 10px var(--g)); }
  .shake .halo { opacity: 0.45; animation: pulse 0.5s ease-in-out infinite alternate; }
  @keyframes rattle { from { transform: rotate(-7deg) translateX(-2px); } to { transform: rotate(7deg) translateX(2px); } }
  @keyframes pulse { from { transform: scale(0.8); } to { transform: scale(1.15); } }

  .open { filter: drop-shadow(0 0 18px var(--g)); }
  .open .top { transform: translate(-6px, -26px) rotate(-28deg); }
  .open .bottom { transform: translate(5px, 18px) rotate(14deg); }
  .open .halo { opacity: 1; animation: burst 0.6s ease-out forwards; }
  @keyframes burst { from { transform: scale(0.3); opacity: 1; } to { transform: scale(1.8); opacity: 0.25; } }
</style>
