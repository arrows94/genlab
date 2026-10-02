<script lang="ts">
  /**
   * Backdrop of a facility: growing fields (farm), a mine entrance with a
   * rolling cart, a lab bench with bubbling flasks. `level` (0–1) is how
   * busy the facility is – fields grow taller, more flasks bubble.
   */
  let { kind, level, idle }: { kind: string; level: number; idle: boolean } = $props();

  const crops = Array.from({ length: 14 }, (_, i) => ({ x: 18 + i * 21, row: i % 2 }));
  const bubbles = [0, 1, 2, 3, 4, 5];
  const sparks = [{ x: 60, y: 60 }, { x: 240, y: 58 }, { x: 284, y: 76 }, { x: 30, y: 84 }];
</script>

<svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMid slice" class="scene {kind}" class:idle aria-hidden="true">
  {#if kind === 'farm'}
    <defs>
      <linearGradient id="farm-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1d4a57" />
        <stop offset="100%" stop-color="#0f2d33" />
      </linearGradient>
    </defs>
    <rect width="320" height="110" fill="url(#farm-sky)" />
    <circle cx="282" cy="24" r="13" fill="#f2c14e" class="sun" />
    <path d="M0 62 Q60 40 130 58 T320 50 V110 H0 Z" fill="#1c4a3a" />
    <path d="M0 74 Q90 62 180 72 T320 68 V110 H0 Z" fill="#245a3f" />
    {#each [0, 1, 2] as r (r)}
      <rect x="0" y={80 + r * 10} width="320" height="5" rx="2" fill="#5a3d25" opacity="0.8" />
    {/each}
    {#each crops as c, i (i)}
      <g class="crop" style="transform-origin: {c.x}px {86 + c.row * 10}px; animation-delay: {(i % 5) * 0.3}s; --h: {0.45 + level * 0.55}">
        <path d="M{c.x} {86 + c.row * 10} v-12" stroke="#8fd16a" stroke-width="2" />
        <ellipse cx={c.x - 4} cy={78 + c.row * 10} rx="4" ry="2" fill="#8fd16a" transform="rotate(-30 {c.x - 4} {78 + c.row * 10})" />
        <ellipse cx={c.x + 4} cy={76 + c.row * 10} rx="4" ry="2" fill="#a5e07d" transform="rotate(30 {c.x + 4} {76 + c.row * 10})" />
        {#if level > 0.5}<circle cx={c.x} cy={73 + c.row * 10} r="2.4" fill="#f2c14e" />{/if}
      </g>
    {/each}
  {:else if kind === 'mine'}
    <rect width="320" height="110" fill="#14222a" />
    <path d="M0 110 V48 L50 20 L96 38 L150 8 L214 34 L262 16 L320 40 V110 Z" fill="#2b3a44" />
    <path d="M0 110 V70 L70 52 L140 64 L230 50 L320 66 V110 Z" fill="#33444f" />
    <!-- entrance -->
    <path d="M120 96 V62 Q150 38 180 62 V96 Z" fill="#0a1216" />
    <path d="M120 96 V62 Q150 38 180 62 V96" fill="none" stroke="#6b4a2b" stroke-width="5" />
    <ellipse cx="150" cy="84" rx="20" ry="12" fill="#f2a93b" opacity="0.25" class="glow" />
    <circle cx="192" cy="58" r="3" fill="#ffd27a" class="lantern" />
    <!-- rails -->
    <rect x="0" y="98" width="320" height="2" fill="#7a8a93" />
    <rect x="0" y="104" width="320" height="2" fill="#7a8a93" />
    {#each Array.from({ length: 16 }, (_, i) => i) as i (i)}<rect x={i * 20 + 4} y="97" width="4" height="10" fill="#5a3d25" />{/each}
    <!-- cart -->
    <g class="cart">
      <path d="M0 80 H34 L30 96 H4 Z" fill="#6b7780" />
      <path d="M3 80 Q10 70 17 76 Q24 68 31 80 Z" fill="#f2c14e" />
      <circle cx="9" cy="98" r="3.5" fill="#1a1a1a" /><circle cx="26" cy="98" r="3.5" fill="#1a1a1a" />
    </g>
    {#each sparks as s, i (i)}
      <path d="M{s.x} {s.y - 4} L{s.x + 2} {s.y} L{s.x} {s.y + 4} L{s.x - 2} {s.y} Z" fill="#ffe08a" class="spark" style="animation-delay: {i * 0.7}s" />
    {/each}
  {:else}
    <rect width="320" height="110" fill="#10202a" />
    <rect x="0" y="0" width="320" height="110" fill="url(#lab-grid)" opacity="0.5" />
    <defs>
      <pattern id="lab-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0 H0 V16" fill="none" stroke="#1a3440" stroke-width="1" /></pattern>
    </defs>
    <rect x="10" y="88" width="300" height="8" rx="2" fill="#2c5560" />
    <rect x="20" y="96" width="8" height="14" fill="#1f4650" /><rect x="292" y="96" width="8" height="14" fill="#1f4650" />
    <path d="M86 44 H150 V54 H214" fill="none" stroke="#3d6b75" stroke-width="3" />
    {#each [{ x: 70, c: '#b38cff' }, { x: 150, c: '#2fd3c4' }, { x: 230, c: '#8fd16a' }] as f, i (i)}
      {@const on = !idle && level * 3 > i - 0.01}
      <g class="flask" class:on>
        <path d="M{f.x - 7} 40 V56 L{f.x - 22} 86 Q{f.x} 92 {f.x + 22} 86 L{f.x + 7} 56 V40 Z" fill="#dcefee" opacity="0.15" stroke="#9ec9cc" stroke-width="1.5" />
        <path d="M{f.x - 16} 74 L{f.x - 21} 86 Q{f.x} 92 {f.x + 21} 86 L{f.x + 16} 74 Z" fill={f.c} opacity="0.85" class="liquid" />
        {#each bubbles as b (b)}
          <circle cx={f.x - 10 + b * 4} cy="84" r={1.2 + (b % 3) * 0.6} fill="#fff" opacity="0.7" class="bubble" style="animation-delay: {(b * 0.37 + i * 0.2).toFixed(2)}s" />
        {/each}
      </g>
    {/each}
  {/if}
</svg>

<style>
  .scene { width: 100%; height: 100%; display: block; }
  .scene.idle { filter: saturate(0.35) brightness(0.7); }
  .scene.idle * { animation-play-state: paused !important; }

  .crop { transform: scaleY(var(--h)); animation: sway 3s ease-in-out infinite; transform-box: view-box; }
  @keyframes sway { 0%, 100% { transform: scaleY(var(--h)) skewX(-4deg); } 50% { transform: scaleY(var(--h)) skewX(4deg); } }
  .sun { filter: drop-shadow(0 0 8px var(--gold)); animation: pulse 4s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.8; } }

  .cart { animation: roll 7s ease-in-out infinite; }
  @keyframes roll { 0%, 8% { transform: translateX(150px) scale(0.6); opacity: 0; } 20% { opacity: 1; transform: translateX(110px) scale(0.9); } 55%, 62% { transform: translateX(270px) scale(1); opacity: 1; } 100% { transform: translateX(-40px); opacity: 1; } }
  .glow { animation: pulse 2.4s ease-in-out infinite; }
  .lantern { filter: drop-shadow(0 0 5px #ffd27a); }
  .spark { animation: twinkle 2.8s ease-in-out infinite; }
  @keyframes twinkle { 0%, 100% { opacity: 0.1; } 50% { opacity: 1; } }

  .flask .bubble { opacity: 0; }
  .flask.on .bubble { animation: bubble 1.8s ease-in infinite; }
  .flask.on .liquid { filter: drop-shadow(0 0 6px currentColor); animation: pulse 2s ease-in-out infinite; }
  .flask:not(.on) .liquid { opacity: 0.35; }
  @keyframes bubble { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.8; } 100% { transform: translateY(-46px); opacity: 0; } }
</style>
