<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber } from '@core/format';
  import { cellarIntervalMs, cellarLevelLabel, cellarRowOf, environmentAt } from '@core/features/cellar';
  import { advanceReplay, fightSeconds, finalState, replayStart, timedEvents, type LastResult } from '@core/features/towerReplay';
  import type { Fighter } from '@core/features/tower';
  import type { Creature } from '@core/state';
  import { game, view } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import { viewState, type ReplaySpeed } from '../viewState.svelte';
  import { play } from '../sound';
  import CreatureSvg from './CreatureSvg.svelte';
  import Meter from './Meter.svelte';

  /**
   * Keller arena: a vault under the lab – broken breeding tanks, veins that
   * pulse like a heartbeat, dripping water, ground fog. The torch lights a cone
   * around the team (its size follows the Fackellicht); foes stay glowing eyes
   * in the dark until they strike or are struck. The boss is a black copy of
   * the player's own line. The environment of the section shows (water line,
   * spores, haze, falling rock, roots, a seal). Only CSS and inline SVG.
   */
  let { team, foes, light, env }: { team: Creature[]; foes: Fighter[]; light: number; env: string | null } = $props();

  type Kind = 'hit' | 'crit' | 'weak' | 'miss' | 'heal' | 'dot' | 'tech';
  interface Unit { name: string; speciesId: string; element: string; maxHp: number; team: boolean; creature: Creature | null; boss?: boolean; shadow?: boolean; tint?: string }

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
  const REPLAY_MS_PER_SEC = 700;
  const el = (id: string) => content.elements.get(id);

  let replay = $state<{ key: string; hp: number[]; clock: number; end: number; idx: number; attacker: number; target: number; done: boolean } | null>(null);
  /** Foes the torch caught: they struck or were struck in this fight. */
  let seen = $state<Record<number, boolean>>({});
  let popups = $state<{ id: number; t: number; text: string; kind: Kind }[]>([]);
  let banner = $state<{ win: boolean; level: number } | null>(null);
  let lastKey: string | null = null;
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let popupId = 0;

  type CellarResult = NonNullable<typeof game.state.cellar.lastResult>;
  const keyOf = (lr: CellarResult | null) => (lr ? `${lr.floor}-${lr.at ?? 0}-${lr.win}` : '');

  function stopReplay() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = null;
    timer = null;
  }

  function show(t: number, text: string, kind: Kind) {
    const id = ++popupId;
    popups = [...popups.slice(-6), { id, t, text, kind }];
    setTimeout(() => (popups = popups.filter((x) => x.id !== id)), 1000);
  }

  /** The level's end sounds: a gong (or the crackle of a rest vault), new surroundings, the shadow waiting – or the fall. */
  function endSounds(lr: LastResult) {
    if (!lr.win) return play('cellarDefeat');
    const cfg = game.balance.cellar;
    play(lr.floor % cfg.restEvery === 0 ? 'cellarRest' : 'cellarGong');
    const next = lr.floor + 1;
    const env = environmentAt(game, next);
    if (env && env !== environmentAt(game, lr.floor)) setTimeout(() => play('cellarEnv'), 700);
    if (next % cfg.bossEvery === 0) setTimeout(() => play('shadowRises'), 1100);
  }

  function finish(lr: LastResult, key: string, seconds: number) {
    if (!replay || replay.key !== key) return;
    replay = { ...replay, ...finalState(lr), clock: seconds, attacker: -1, target: -1, done: true };
    endSounds(lr);
    banner = { win: lr.win, level: lr.floor };
    timer = setTimeout(() => (banner = null), 1900);
  }

  function startReplay(lr: CellarResult, key: string) {
    stopReplay();
    const events = timedEvents(lr);
    const seconds = fightSeconds(game, lr, events);
    const start = replayStart(lr);
    replay = { key, hp: start.hp, clock: 0, end: seconds, idx: 0, attacker: -1, target: -1, done: false };
    seen = {};
    popups = [];
    banner = null;
    // Lichtfresser: the torch dies as the fight begins.
    if (lr.light === 0) play('torchOut');
    if (prefs.reduceMotion || viewState.tower.replaySpeed === 0) return finish(lr, key, seconds);
    const budgetMs = Math.max(900, Math.min(cellarIntervalMs(game) * 0.85 - 400, seconds * REPLAY_MS_PER_SEC));
    const rate = seconds / budgetMs;
    let last = performance.now();
    const step = (now: number) => {
      if (!replay || replay.key !== key) return;
      const speed = viewState.tower.replaySpeed;
      if (speed === 0) return finish(lr, key, seconds);
      const clock = Math.min(seconds, replay.clock + (now - last) * rate * speed);
      last = now;
      const { state: next, fired } = advanceReplay({ ...replay, elements: [], marks: {} }, events, clock);
      for (const { e } of fired) {
        // The torch catches whoever takes part.
        const nextSeen = { ...seen, [e.a]: true, [e.t]: true };
        seen = nextSeen;
        if (e.kind === 'miss') show(e.t, 'Daneben!', 'miss');
        else if (e.kind === 'heal') show(e.t, `+${formatNumber(e.dmg)}`, 'heal');
        else if (e.kind === 'dot') show(e.t, `−${formatNumber(e.dmg)}`, 'dot');
        else if (e.kind === 'phase' && e.trait && content.bossTraits.has(e.trait)) show(e.t, `${content.bossTraits.get(e.trait).icon} ${content.bossTraits.get(e.trait).name}!`, 'tech');
        else if (!e.kind || e.kind === 'tech' || e.kind === 'reflect') {
          show(e.t, `−${formatNumber(e.dmg)}${e.crit ? ' Kritisch!' : ''}`, e.crit || e.m > 1 ? 'crit' : e.m < 1 ? 'weak' : 'hit');
          play(e.crit || e.m > 1 ? 'hitCrit' : 'hit');
          if (e.hp <= 0) play('ko');
        }
      }
      replay = { ...replay, clock, idx: next.idx, hp: next.hp, attacker: next.attacker, target: next.target };
      if (clock >= seconds) return finish(lr, key, seconds);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  $effect(() => {
    view.frame;
    const lr = game.state.cellar.lastResult;
    const key = keyOf(lr);
    if (key === lastKey) return;
    const first = lastKey === null;
    lastKey = key;
    untrack(() => {
      if (!lr || !lr.fighters?.length) return void (replay = null);
      // Opening the view shows the last result; new fights are replayed.
      if (first) {
        const events = timedEvents(lr);
        const end = fightSeconds(game, lr, events);
        replay = { key, hp: finalState(lr).hp, clock: end, end, idx: events.length, attacker: -1, target: -1, done: true };
        seen = Object.fromEntries((lr.fighters ?? []).map((_, i) => [i, true]));
      } else startReplay(lr, key);
    });
  });
  onDestroy(stopReplay);

  /** The replayed fight while it runs (and its banner), otherwise the team before the next level. */
  const arena = $derived.by(() => {
    view.frame;
    const lr = game.state.cellar.lastResult;
    if (replay && lr?.fighters?.length && replay.key === keyOf(lr) && (!replay.done || !!banner)) {
      const ids = game.state.cellar.run?.team ?? game.state.cellar.team;
      let k = 0;
      const units: Unit[] = lr.fighters.map((f) => {
        if (!f.team) return { ...f, creature: null };
        // Fallen members sat the fight out: match the fighters to the team by species in order.
        while (k < ids.length) {
          const c = game.state.creatures.find((x) => x.id === ids[k]);
          k++;
          if (c && c.speciesId === f.speciesId) return { ...f, creature: c };
        }
        return { ...f, creature: null };
      });
      return { mode: 'fight' as const, level: lr.floor, units, hp: replay.hp, light: lr.light ?? light, env: lr.env ?? env };
    }
    const units: Unit[] = [
      ...team.map((c) => ({ name: c.name, speciesId: c.speciesId, element: content.species.get(c.speciesId).element, maxHp: 1, team: true, creature: c })),
      ...foes.map((f) => ({ name: f.name, speciesId: f.speciesId, element: f.element, maxHp: f.maxHp, team: false, creature: null, boss: f.boss, shadow: f.shadow, tint: f.tint })),
    ];
    return { mode: 'preview' as const, level: 0, units, hp: units.map((u) => u.maxHp), light, env };
  });
  const teamUnits = $derived(arena.units.map((u, i) => ({ u, i })).filter((x) => x.u.team));
  const foeUnits = $derived(arena.units.map((u, i) => ({ u, i })).filter((x) => !x.u.team));
  /** Radius of the light cone in % of the vault: the torch, smaller in the Finsternis, almost nothing when eaten. */
  const cone = $derived(arena.light <= 0 ? 9 : (arena.env === 'darkness' ? 0.6 : 1) * (16 + 30 * arena.light));
  const lightOut = $derived(arena.light <= 0);

  const look = (u: Unit) => (u.creature ? expressedAppearance(game, u.creature) : { ...neutral, hue: content.species.get(u.speciesId).hue });
  const rowOf = (u: Unit) => (u.creature ? cellarRowOf(game, u.creature.id) : 'front');

  const SPEEDS: { v: ReplaySpeed; label: string; title: string }[] = [
    { v: 1, label: '1×', title: 'Normale Wiedergabe' },
    { v: 2, label: '2×', title: 'Doppelt so schnell' },
    { v: 0, label: '⏭', title: 'Wiedergabe überspringen' },
  ];
  // Fixed positions for drops, spores and dust, so nothing jumps between frames.
  const DROPS = [12, 47, 83];
  const SPORES = Array.from({ length: 14 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 0.7) % 6, s: 4 + (i % 4) }));
  const DUST = Array.from({ length: 10 }, (_, i) => ({ x: 55 + ((i * 13) % 40), d: (i * 0.45) % 3 }));
</script>

{#snippet unit(u: Unit, i: number)}
  {@const species = content.species.get(u.speciesId)}
  {@const hp = arena.hp[i] ?? u.maxHp}
  {@const pct = arena.mode === 'preview' ? 1 : Math.max(0, hp / u.maxHp)}
  {@const hidden = !u.team && !u.shadow && (arena.mode === 'preview' || !seen[i])}
  <div
    class="unit"
    class:team={u.team}
    class:foe={!u.team}
    class:hidden
    class:shadow={u.shadow}
    class:back={u.team && rowOf(u) === 'back'}
    class:lunge={arena.mode === 'fight' && replay?.attacker === i}
    class:struck={arena.mode === 'fight' && replay?.target === i}
    class:ko={arena.mode === 'fight' && hp <= 0}
    style="--el: {el(u.element).color}; --tint: {u.tint ?? 'transparent'}"
    title={hidden ? 'Etwas lauert in der Dunkelheit …' : u.name}
  >
    <div class="art">
      {#if u.boss}<span class="crown" aria-hidden="true">{u.shadow ? '🖤' : '👑'}</span>{/if}
      <div class="body"><CreatureSvg appearance={look(u)} shape={species.shape} tier={species.tier} size={u.boss ? 92 : 64} shiny={u.creature?.shiny ?? false} /></div>
      {#if !u.team}<span class="eyes" aria-hidden="true"><i></i><i></i></span>{/if}
      {#each popups.filter((p) => p.t === i) as p (p.id)}<span class="pop {p.kind}" style="--dx: {((p.id % 3) - 1) * 22}px">{p.text}</span>{/each}
    </div>
    {#if !hidden}
      <span class="uname">{u.name}</span>
      <Meter size="sm" value={pct} low={pct < 0.3} title="Lebenspunkte" />
    {:else}
      <span class="uname muted">???</span>
    {/if}
  </div>
{/snippet}

<div class="vault env-{arena.env ?? 'none'}" class:out={lightOut} style="--cone: {cone}%">
  <!-- Scenery: arch, stones, tanks, veins, sign, drops, fog -->
  <div class="stones" aria-hidden="true"></div>
  <div class="arch" aria-hidden="true"></div>
  <svg class="veins" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 8 C 12 14, 18 4, 30 12 S 44 22, 52 14" />
    <path d="M100 18 C 88 22, 84 12, 72 20 S 60 30, 54 24" />
    <path d="M6 0 C 8 10, 3 18, 9 26" />
    <path d="M94 0 C 90 8, 97 16, 91 30" />
  </svg>
  <div class="tank left" aria-hidden="true"><span class="crack"></span><span class="bubble"></span><span class="bubble b2"></span></div>
  <div class="tank right" aria-hidden="true"><span class="crack"></span><span class="bubble"></span></div>
  <span class="sign" aria-hidden="true">ZUCHTREIHE B-3 · AUSSCHUSS</span>
  {#each DROPS as x, k (k)}<span class="drip" style="left: {x}%; animation-delay: {k * 1.3}s" aria-hidden="true"></span>{/each}

  <!-- The environment of the section -->
  {#if arena.env === 'flooded'}<div class="water" aria-hidden="true"></div>{/if}
  {#if arena.env === 'spores'}{#each SPORES as s, k (k)}<span class="spore" style="left: {s.x}%; animation-delay: {s.d}s; width: {s.s}px; height: {s.s}px" aria-hidden="true"></span>{/each}{/if}
  {#if arena.env === 'shadowAura'}<div class="haze" aria-hidden="true"></div>{/if}
  {#if arena.env === 'collapse'}
    <svg class="cracks" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M58 0 L62 9 L57 15 L64 24" /><path d="M80 0 L77 7 L83 13" /></svg>
    {#each DUST as d, k (k)}<span class="dust" style="left: {d.x}%; animation-delay: {d.d}s" aria-hidden="true"></span>{/each}
  {/if}
  {#if arena.env === 'roots'}
    <svg class="roots" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 0 C 10 10, 4 22, 16 30 S 22 46, 14 60" /><path d="M100 0 C 90 12, 96 20, 86 32 S 80 48, 88 60" /><path d="M30 0 C 34 8, 28 14, 33 22" />
    </svg>
  {/if}
  {#if arena.env === 'diversity'}
    <svg class="sigil" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /><path d="M50 8 L86 71 L14 71 Z" /><path d="M50 92 L14 29 L86 29 Z" /></svg>
  {/if}
  <div class="fog" aria-hidden="true"></div>

  <!-- Darkness with the torch's cone around the team -->
  <div class="dark" aria-hidden="true"></div>
  <span class="torch" class:dead={lightOut} title={lightOut ? 'Das Licht ist verschluckt' : 'Fackellicht'} aria-hidden="true">{lightOut ? '🌘' : '🔥'}</span>

  <div class="stage">
    <div class="side team">{#each teamUnits as x (x.i)}{@render unit(x.u, x.i)}{/each}</div>
    <div class="side foes">{#each foeUnits as x (x.i)}{@render unit(x.u, x.i)}{/each}</div>
  </div>

  {#if banner}
    <div class="banner" class:win={banner.win}>{banner.win ? `${cellarLevelLabel(game, banner.level)} geschafft` : `Gefallen auf ${cellarLevelLabel(game, banner.level)}`}</div>
  {/if}
  <div class="speeds" role="group" aria-label="Wiedergabe">
    {#each SPEEDS as s (s.v)}<button class:on={viewState.tower.replaySpeed === s.v} title={s.title} onclick={() => (viewState.tower.replaySpeed = s.v)}>{s.label}</button>{/each}
  </div>
</div>

<style>
  .vault {
    --abyss: #050a08; --bile: #9fd88a; --rust: #7a4026; --bone: #d8d0bb; --blood: #e0313a; --moss: #1d2b1f;
    position: relative; height: 19rem; border-radius: 12px; overflow: hidden; border: 1px solid #23301f;
    background: radial-gradient(ellipse at 50% 110%, #16241a 0%, #0b130e 45%, var(--abyss) 80%);
    isolation: isolate;
  }
  .stones {
    position: absolute; inset: 0; z-index: 0; opacity: 0.35;
    background:
      repeating-linear-gradient(0deg, transparent 0 22px, #000 22px 24px),
      repeating-linear-gradient(90deg, transparent 0 46px, #000 46px 48px);
  }
  .arch { position: absolute; z-index: 0; left: 8%; right: 8%; top: -40%; height: 120%; border: 10px solid #141c15; border-bottom: 0; border-radius: 50% 50% 0 0; box-shadow: inset 0 0 40px #000; }
  .veins { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; fill: none; stroke: #5a1418; stroke-width: 0.7; opacity: 0.55; animation: heartbeat 1.6s ease-in-out infinite; }
  @keyframes heartbeat { 0%, 100% { opacity: 0.35; } 10% { opacity: 0.8; } 20% { opacity: 0.45; } 30% { opacity: 0.75; } }
  .tank { position: absolute; z-index: 0; bottom: 18%; width: 9%; height: 46%; border: 2px solid #3b4d40; border-radius: 40% 40% 8px 8px / 12% 12% 8px 8px; background: linear-gradient(180deg, transparent 30%, color-mix(in srgb, var(--bile) 22%, #0a120c) 30%); box-shadow: 0 0 18px color-mix(in srgb, var(--bile) 14%, transparent); }
  .tank.left { left: 4%; } .tank.right { right: 4%; height: 38%; }
  .crack { position: absolute; top: 18%; left: 30%; width: 40%; height: 30%; border-left: 1px solid #8aa69055; transform: skewX(-25deg); }
  .bubble { position: absolute; bottom: 4%; left: 40%; width: 4px; height: 4px; border-radius: 50%; background: var(--bile); opacity: 0; animation: bubble 3.2s linear infinite; }
  .bubble.b2 { left: 60%; animation-delay: 1.6s; }
  @keyframes bubble { 0% { transform: translateY(0); opacity: 0.6; } 60% { opacity: 0.4; } 100% { transform: translateY(-4.5rem); opacity: 0; } }
  .sign { position: absolute; z-index: 0; top: 12%; left: 50%; transform: translateX(-50%) rotate(-3deg); font: 700 0.6rem/1 var(--mono); letter-spacing: 0.14em; color: var(--bone); opacity: 0.18; border: 1px solid currentColor; padding: 0.15rem 0.4rem; }
  .drip { position: absolute; z-index: 0; top: 0; width: 2px; height: 7px; border-radius: 0 0 2px 2px; background: #7fb6a6; opacity: 0; animation: drip 3.9s ease-in infinite; }
  @keyframes drip { 0%, 40% { transform: translateY(0); opacity: 0; } 45% { opacity: 0.7; } 100% { transform: translateY(17rem); opacity: 0; } }
  .fog { position: absolute; z-index: 1; left: -20%; right: -20%; bottom: 0; height: 32%; background: linear-gradient(0deg, #9fb4a633, transparent); filter: blur(6px); animation: fog 12s ease-in-out infinite alternate; }
  @keyframes fog { from { transform: translateX(-4%); } to { transform: translateX(4%); } }

  /* Environments */
  .water { position: absolute; z-index: 3; left: 0; right: 0; bottom: 0; height: 22%; background: linear-gradient(180deg, #2a5d6a66, #071a20cc); border-top: 1px solid #6fb3c455; animation: wave 4s ease-in-out infinite alternate; }
  @keyframes wave { from { transform: translateY(2px); } to { transform: translateY(-3px); } }
  .spore { position: absolute; z-index: 3; bottom: -6px; border-radius: 50%; background: var(--bile); opacity: 0; box-shadow: 0 0 6px var(--bile); animation: spore 6s linear infinite; }
  @keyframes spore { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: 0.55; } 100% { transform: translate(14px, -18rem); opacity: 0; } }
  .haze { position: absolute; z-index: 1; inset: 0; background: radial-gradient(ellipse at 70% 40%, #5b2a8a55, transparent 65%); animation: haze 5s ease-in-out infinite alternate; }
  @keyframes haze { from { opacity: 0.5; } to { opacity: 1; } }
  .cracks { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; fill: none; stroke: #000; stroke-width: 0.6; }
  .dust { position: absolute; z-index: 3; top: -4px; width: 3px; height: 3px; background: #8a8173; opacity: 0; animation: dust 2.4s ease-in infinite; }
  @keyframes dust { 0% { transform: translateY(0); opacity: 0.8; } 100% { transform: translateY(18rem) rotate(200deg); opacity: 0; } }
  .roots { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; fill: none; stroke: #2a3a1c; stroke-width: 1.6; stroke-linecap: round; }
  .sigil { position: absolute; z-index: 1; top: 50%; left: 50%; width: 9rem; height: 9rem; transform: translate(-50%, -62%); fill: none; stroke: var(--blood); stroke-width: 1.2; opacity: 0.22; filter: drop-shadow(0 0 6px var(--blood)); animation: haze 3s ease-in-out infinite alternate; }

  /* Darkness: a cone of torchlight around the team, flickering a little. */
  .dark {
    position: absolute; z-index: 2; inset: 0; pointer-events: none;
    background: radial-gradient(circle at 26% 74%, transparent 0, transparent calc(var(--cone) * 0.55), rgba(0, 0, 0, 0.55) var(--cone), rgba(0, 0, 0, 0.88) calc(var(--cone) * 1.9));
    animation: flicker 2.7s steps(1) infinite;
    transition: background 0.6s;
  }
  @keyframes flicker { 0%, 100% { opacity: 1; } 12% { opacity: 0.93; } 13% { opacity: 1; } 47% { opacity: 0.96; } 48% { opacity: 1; } 71% { opacity: 0.91; } 72% { opacity: 1; } }
  .vault.out .dark { animation: none; }
  .torch { position: absolute; z-index: 4; left: 24%; top: 24%; font-size: 1.4rem; filter: drop-shadow(0 0 10px #ff9a3c); animation: torch 0.9s ease-in-out infinite alternate; }
  .torch.dead { filter: none; animation: none; opacity: 0.6; }
  @keyframes torch { from { transform: scale(1) rotate(-3deg); } to { transform: scale(1.08) rotate(3deg); } }

  /* Fighters */
  .stage { position: absolute; z-index: 3; inset: auto 0 6% 0; display: grid; grid-template-columns: 1fr 1fr; align-items: end; padding: 0 4%; }
  .side { display: flex; gap: 0.4rem; align-items: flex-end; }
  .side.foes { justify-content: flex-end; }
  .unit { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; width: 5.4rem; min-width: 0; transition: filter 0.4s, transform 0.2s; }
  .unit.back { transform: translateY(-0.9rem) scale(0.9); opacity: 0.92; }
  .unit :global(.meter) { width: 90%; }
  .uname { max-width: 100%; font-size: 0.68rem; color: var(--bone); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 3px #000; }
  .art { position: relative; display: grid; place-items: center; }
  .body { transition: filter 0.5s; }
  .unit.team .body { filter: drop-shadow(0 0 6px #ffb06a55); }
  .unit.foe .body { filter: saturate(0.45) sepia(0.35) hue-rotate(40deg) brightness(0.8) drop-shadow(0 0 8px var(--tint)); }
  /* Not yet caught by the torch: only the eyes glow. */
  .unit.hidden .body { filter: brightness(0) drop-shadow(0 0 2px #000); }
  .eyes { position: absolute; top: 38%; left: 50%; transform: translateX(-50%); display: flex; gap: 0.7rem; opacity: 0; transition: opacity 0.4s; }
  .eyes i { width: 5px; height: 4px; border-radius: 50%; background: var(--blood); box-shadow: 0 0 6px 2px var(--blood); animation: blink 4.5s infinite; }
  @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
  .unit.hidden .eyes, .unit.shadow .eyes { opacity: 1; }
  /* The shadow of the player's line: a black, trembling copy. */
  .unit.shadow .body { filter: brightness(0.08) contrast(1.6) drop-shadow(0 0 10px #000) drop-shadow(0 0 4px var(--blood)); animation: tremble 0.18s steps(2) infinite; }
  .unit.shadow .eyes { top: 36%; gap: 1.1rem; }
  @keyframes tremble { 0% { transform: skewX(0deg) translateX(0); } 50% { transform: skewX(-2deg) translateX(1px); } }
  .crown { position: absolute; top: -0.8rem; font-size: 0.9rem; z-index: 1; }
  .unit.lunge { transform: translateX(0.6rem); }
  .unit.foe.lunge { transform: translateX(-0.6rem); }
  .unit.struck .body { animation: struck 0.25s; }
  @keyframes struck { 50% { transform: translateX(-3px); filter: brightness(1.8); } }
  .unit.ko { opacity: 0.25; filter: grayscale(1); }
  .pop { position: absolute; top: -0.4rem; left: 50%; transform: translate(calc(-50% + var(--dx)), 0); font: 700 0.75rem/1 var(--mono); white-space: nowrap; color: var(--bone); text-shadow: 0 1px 3px #000; animation: rise 1s ease-out forwards; pointer-events: none; z-index: 2; }
  .pop.crit { color: #ffcf5a; font-size: 0.85rem; }
  .pop.weak { color: #9aa; }
  .pop.miss { color: #8fa3a8; font-style: italic; }
  .pop.heal { color: var(--bile); }
  .pop.dot { color: #c08ad8; }
  .pop.tech { color: var(--blood); }
  @keyframes rise { from { opacity: 1; transform: translate(calc(-50% + var(--dx)), 0); } to { opacity: 0; transform: translate(calc(-50% + var(--dx)), -1.6rem); } }
  .banner { position: absolute; z-index: 5; top: 38%; left: 50%; transform: translateX(-50%); padding: 0.35rem 1rem; border-radius: 8px; font-weight: 700; background: #000c; border: 1px solid var(--blood); color: var(--blood); white-space: nowrap; }
  .banner.win { border-color: var(--bile); color: var(--bile); }
  .speeds { position: absolute; z-index: 5; top: 0.4rem; right: 0.4rem; display: inline-flex; border: 1px solid #2b3a2c; border-radius: 6px; overflow: hidden; }
  .speeds button { border: 0; border-radius: 0; padding: 0.1rem 0.45rem; font-size: 0.7rem; background: #0b130ecc; color: var(--bone); }
  .speeds button.on { background: #2c4a30; }

  @media (max-width: 640px) {
    .vault { height: 16rem; }
    .stage { padding: 0 2%; gap: 0.3rem; }
    .side { gap: 0.15rem; }
    .unit { width: 3.4rem; }
    .uname { font-size: 0.58rem; }
    .unit :global(svg) { width: 40px; height: 40px; }
    .unit.foe.shadow :global(svg) { width: 56px; height: 56px; }
    .eyes { gap: 0.45rem; }
    .tank { width: 12%; }
    .sign { display: none; }
  }
</style>
