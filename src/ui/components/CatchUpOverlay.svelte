<script lang="ts">
  import { untrack } from 'svelte';
  import { content } from '@content/index';
  import { formatDuration } from '@core/format';
  import { expressedAppearance } from '@core/genetics';
  import type { Creature } from '@core/state';
  import { game, view } from '../store.svelte';
  import { sync } from '../sync.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import DnaHelix from './DnaHelix.svelte';

  /**
   * „Dein Labor holt auf“: shown while a long absence is computed in slices, and before that
   * while the game holds for a new version or the cloud save (`view.waitFor`). A few of the player's own
   * creatures carry DNA to the lab and data back to the archive. It stays at least
   * `MIN_SHOW_MS`, so a quick catch-up does not just flash; a quick download never shows it.
   */
  const MIN_SHOW_MS = 1200;
  const WAIT_DELAY_MS = 300;
  const LINES: { text: string; feature?: string }[] = [
    { text: 'Gene werden sortiert …' },
    { text: 'Futter wird geerntet …' },
    { text: 'Eier werden gewärmt …', feature: 'breeding' },
    { text: 'Expeditionen kehren heim …', feature: 'expedition' },
    { text: 'Genome werden entschlüsselt …', feature: 'sequencing' },
    { text: 'Messdaten werden abgeglichen …' },
  ];

  let open = $state(false);
  let leaving = $state(false);
  let done = $state(0);
  let requestedMs = $state(0);
  let shownAt = 0;
  let line = $state(0);
  let crew = $state<Creature[]>([]);

  /** Favourites first, then the rarest; one per species where possible. */
  function pickCrew(): Creature[] {
    const rank = (c: Creature) => (c.locked ? 100 : 0) + content.rarities.get(c.rarity).order;
    const sorted = [...game.state.creatures].sort((a, b) => rank(b) - rank(a));
    const picked: Creature[] = [];
    for (const c of sorted) if (picked.length < 3 && !picked.some((p) => p.speciesId === c.speciesId)) picked.push(c);
    for (const c of sorted) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
    return picked;
  }

  const lines = $derived(LINES.filter((l) => !l.feature || game.state.features[l.feature]));

  // Quick checks never show the screen; installing a new version does at once (the page reloads).
  // The sync conflict dialog must stay visible: the game waits for the player there.
  let waitShown = $state(false);
  $effect(() => {
    const wait = view.waitFor;
    if (!wait || sync.conflict) return void (waitShown = false);
    if (wait === 'install') return void (waitShown = true);
    // From one wait to the next the screen stays.
    if (untrack(() => waitShown)) return;
    const timer = setTimeout(() => (waitShown = true), WAIT_DELAY_MS);
    return () => clearTimeout(timer);
  });
  const waiting = $derived(!view.catchUp && waitShown);
  const WAIT_TEXT = {
    update: '🔄 Suche nach einer neuen Version …',
    install: '✨ Neue Version wird eingespielt …',
    sync: '☁️ Abgleich mit deinen anderen Geräten …',
  };
  const active = $derived(view.catchUp ?? (waitShown ? { done: 0, requestedMs: 0 } : null));

  $effect(() => {
    const c = active;
    if (c) {
      leaving = false;
      if (!open) {
        open = true;
        shownAt = performance.now();
        crew = pickCrew();
        line = 0;
      }
      done = c.done;
      requestedMs = c.requestedMs;
      return;
    }
    if (!open || leaving) return;
    done = 1;
    const close = setTimeout(() => (leaving = true), Math.max(0, MIN_SHOW_MS - (performance.now() - shownAt)));
    return () => clearTimeout(close);
  });

  $effect(() => {
    if (!open) return;
    const timer = setInterval(() => (line = (line + 1) % Math.max(1, lines.length)), 2200);
    return () => clearInterval(timer);
  });

  const BASES = ['A', 'T', 'G', 'C'];
</script>

{#if open}
  <div class="catchup" class:leaving role="status" aria-live="polite" ontransitionend={() => leaving && (open = false)}>
    <div class="card">
      <h2>Dein Labor holt auf …</h2>
      {#if waiting && view.waitFor === 'sync'}
        <p class="muted">Erst schauen deine Kreaturen nach, ob ein anderes Gerät schon weiter ist.</p>
      {:else if waiting}
        <p class="muted">Erst holt sich dein Labor die neueste Version.</p>
      {:else}
        <p class="muted">Du warst {formatDuration(requestedMs)} weg – deine Kreaturen bringen alles auf den neuesten Stand.</p>
      {/if}

      <div class="scene" aria-hidden="true">
        <div class="terminal left">
          <div class="screen"><div class="scroll">{#each Array(12) as _, i (i)}<span>{BASES[i % 4]}{BASES[(i * 3 + 1) % 4]}{BASES[(i + 2) % 4]}</span>{/each}</div></div>
          <small>Genarchiv</small>
          {#each BASES as b, i (b)}<span class="base" style:--d="{i * 0.7}s">{b}</span>{/each}
        </div>

        <div class="track">
          {#each crew as c, i (c.id)}
            {@const sp = content.species.get(c.speciesId)}
            <div class="walk" style:--delay="{-i * 1.5}s" style:--lane="{i * 9}px" style:z-index={3 - i}>
              <div class="carrier">
                <span class="packet dna">
                  <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 2 C15 7 5 13 15 18 M15 2 C5 7 15 13 5 18" /><path class="rung" d="M7 5h6M7 10h6M7 15h6" /></svg>
                </span>
                <span class="packet data"><svg viewBox="0 0 20 20" width="14" height="14"><rect x="3" y="3" width="14" height="14" rx="3" /><path d="M7 8h6M7 12h4" /></svg></span>
                <div class="face"><div class="bob"><CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={44} shiny={c.shiny} /></div></div>
              </div>
            </div>
          {/each}
        </div>

        <div class="terminal right">
          <div class="screen"><div class="scroll slow">{#each Array(12) as _, i (i)}<span>{(i * 37) % 2}{(i * 11 + 1) % 2}{(i * 5) % 2}{(i * 7 + 1) % 2}</span>{/each}</div></div>
          <small>Brutlabor</small>
          {#each BASES as b, i (b)}<span class="base" style:--d="{0.35 + i * 0.7}s">{b}</span>{/each}
        </div>
      </div>

      <DnaHelix progress={done} width={240} height={36} />
      {#if waiting}
        <div class="bar waiting" role="progressbar" aria-busy="true"><div class="fill"></div></div>
        <p class="line">{#key view.waitFor}<span>{WAIT_TEXT[view.waitFor ?? 'sync']}</span>{/key}</p>
      {:else}
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(done * 100)}>
          <div class="fill" style:width="{done * 100}%"></div>
        </div>
        <p class="line">{#key line}<span>{lines[line % Math.max(1, lines.length)]?.text}</span>{/key}<span class="num pct">{Math.floor(done * 100)} %</span></p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .catchup {
    position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; overflow-y: auto;
    background: radial-gradient(circle at 50% 40%, var(--bg-2), var(--bg) 70%);
    padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    transition: opacity 0.45s ease; animation: appear 0.35s ease;
  }
  .catchup.leaving { opacity: 0; }
  @keyframes appear { from { opacity: 0; } }
  .card { width: min(520px, 100%); display: grid; justify-items: center; gap: 0.6rem; text-align: center; }
  h2 { margin: 0; color: var(--teal); letter-spacing: 0.02em; }
  .muted { margin: 0; color: var(--muted); font-size: 0.9rem; }

  .scene { position: relative; width: 100%; height: 120px; display: flex; align-items: flex-end; gap: 0.25rem; margin: 0.6rem 0 0.2rem; }
  .terminal { position: relative; flex: none; width: 68px; display: grid; justify-items: center; gap: 0.2rem; }
  .terminal small { font-size: 0.7rem; color: var(--muted); }
  .screen {
    width: 60px; height: 70px; overflow: hidden; border-radius: 8px; border: 2px solid var(--line);
    background: #021014; box-shadow: 0 0 14px #2fd3c455, inset 0 0 10px #2fd3c433;
    font-family: var(--mono); font-size: 0.6rem; line-height: 1.15; color: var(--teal);
  }
  .right .screen { color: var(--violet); box-shadow: 0 0 14px #9b6bff55, inset 0 0 10px #9b6bff33; }
  .scroll { display: grid; animation: scroll 3s linear infinite; }
  .scroll.slow { animation-duration: 4.2s; }
  @keyframes scroll { to { transform: translateY(-50%); } }
  .base {
    position: absolute; top: 30px; left: 50%; font-family: var(--mono); font-size: 0.75rem; font-weight: 700; color: var(--gold);
    opacity: 0; animation: rise 2.8s ease-out infinite; animation-delay: var(--d);
  }
  @keyframes rise {
    0% { opacity: 0; transform: translate(-50%, 0); }
    20% { opacity: 0.9; }
    100% { opacity: 0; transform: translate(calc(-50% + 14px), -46px); }
  }

  .track { position: relative; flex: 1; height: 100%; border-bottom: 2px dashed var(--line); margin-bottom: 1.3rem; }
  .walk {
    --s: 44px; position: absolute; left: 0; bottom: var(--lane); width: 100%;
    animation: walk 4.5s ease-in-out infinite; animation-delay: var(--delay);
  }
  /* The wrapper spans the track, so translateX(100%) is the full way across. */
  @keyframes walk {
    0%, 4% { transform: translateX(0); }
    46%, 54% { transform: translateX(calc(100% - var(--s))); }
    96%, 100% { transform: translateX(0); }
  }
  .carrier { position: relative; width: var(--s); }
  .face { animation: turn 4.5s linear infinite; animation-delay: var(--delay); }
  @keyframes turn { 0%, 49% { transform: scaleX(1); } 50%, 99% { transform: scaleX(-1); } }
  .bob { animation: bob 0.4s ease-in-out infinite alternate; }
  @keyframes bob { from { transform: translateY(0) rotate(-3deg); } to { transform: translateY(-5px) rotate(3deg); } }
  .packet { position: absolute; left: 50%; top: -20px; translate: -50% 0; opacity: 0; animation: 4.5s linear infinite; animation-delay: var(--delay); }
  .packet svg { display: block; filter: drop-shadow(0 0 4px currentColor); }
  .dna { color: var(--gold); animation-name: carry-there; }
  .dna path { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
  .dna .rung { stroke-width: 1.2; opacity: 0.7; }
  .data { color: var(--violet); animation-name: carry-back; }
  .data rect { fill: #9b6bff44; stroke: currentColor; stroke-width: 1.6; }
  .data path { stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; }
  @keyframes carry-there { 0%, 3% { opacity: 0; } 6%, 44% { opacity: 1; } 48%, 100% { opacity: 0; } }
  @keyframes carry-back { 0%, 52% { opacity: 0; } 56%, 94% { opacity: 1; } 98%, 100% { opacity: 0; } }

  .bar { width: min(320px, 100%); height: 8px; border-radius: 99px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, var(--teal), var(--violet)); transition: width 0.2s linear; }
  .bar.waiting .fill { width: 35%; animation: sweep 1.3s ease-in-out infinite alternate; }
  @keyframes sweep { from { transform: translateX(-100%); } to { transform: translateX(290%); } }
  .line { margin: 0; display: flex; gap: 0.6rem; align-items: baseline; font-size: 0.9rem; min-height: 1.4em; }
  .line span:first-child { animation: fade 0.4s ease; }
  @keyframes fade { from { opacity: 0; transform: translateY(4px); } }
  .pct { color: var(--teal); }

  @media (max-width: 420px) {
    .terminal { width: 54px; }
    .screen { width: 48px; height: 58px; }
  }
  :global(.reduce-motion) .catchup *, :global(.reduce-motion) .catchup { animation: none !important; }
  :global(.reduce-motion) .base, :global(.reduce-motion) .packet.data { display: none; }
  :global(.reduce-motion) .packet.dna { opacity: 1; }
  :global(.reduce-motion) .bar.waiting .fill { width: 100%; opacity: 0.5; }
  :global(.reduce-motion) .walk:nth-child(2) { transform: translateX(calc(50% - var(--s) / 2)); }
  :global(.reduce-motion) .walk:nth-child(3) { transform: translateX(calc(100% - var(--s))); }
</style>
