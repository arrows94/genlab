<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { formatNumber, formatPercent } from '@core/format';
  import { capsuleCost, capsuleOdds, fragmentValue, openCapsules, pityCounter, type CapsuleResult } from '@core/features/recycler';
  import { autoRecycleCandidates, setAutoRecycle } from '@core/features/automation';
  import { D } from '@core/num';
  import type { AutoRecycleConfig } from '@core/state';
  import { stableFree } from '@core/features/stable';
  import { game, view, act, refresh, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import { expressedAppearance } from '@core/genetics';
  import { findCreature } from '@core/creatures';
  import { viewState } from '../viewState.svelte';
  import { prefs } from '../prefs.svelte';
  import GeneCapsule from './GeneCapsule.svelte';
  import RecyclerChamber from './RecyclerChamber.svelte';

  const recycler = viewState.recycler;
  let results = $state<CapsuleResult[] | null>(null);
  /** Opening sequence: the capsule rattles, bursts open, then the cards flip in one by one. */
  let phase = $state<'charge' | 'burst' | 'reveal'>('reveal');
  /** Skipped: all cards at once, no stagger. */
  let instant = $state(false);
  let opened = $state<{ color: string; accent: string } | null>(null);
  let timers: ReturnType<typeof setTimeout>[] = [];

  /** Look of each capsule kind (visual only): cap colour and liquid colour. */
  function capsuleLook(id: string): { color: string; accent: string } {
    if (id === 'element') return { color: content.elements.get(recycler.element)?.color ?? '#9b6bff', accent: '#9b6bff' };
    if (id === 'premium') return { color: '#f2c14e', accent: '#ff5fa2' };
    return { color: '#2fd3c4', accent: '#4aa3ff' };
  }

  const reducedMotion = () =>
    prefs.reduceMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const data = $derived.by(() => {
    view.frame;
    return {
      free: stableFree(game),
      fragments: game.state.resources['fragments'] ?? D(0),
      opened: game.state.statistics['capsulesOpened'] ?? 0,
      capsules: content.capsules.list.map((c) => {
        const odds = capsuleOdds(game, c.id);
        return {
          def: c,
          look: capsuleLook(c.id),
          odds: content.rarities.list.filter((r) => (odds[r.id] ?? 0) > 0).map((r) => ({ r, p: odds[r.id] ?? 0 })),
          pity: pityCounter(game, c.id),
          cost1: capsuleCost(game, c.id, 1),
          cost10: capsuleCost(game, c.id, 10),
        };
      }),
    };
  });

  const KEEP = [0, 1, 2, 3, 5, 10];

  // Candidate search walks all creatures – refreshed at the slow rate.
  const auto = $derived.by(() => {
    view.slowFrame;
    if (!game.state.features['autoRecycle']) return null;
    const cfg = game.state.automation.autoRecycle;
    const candidates = autoRecycleCandidates(game);
    return {
      cfg,
      count: candidates.length,
      fragments: candidates.reduce((sum, c) => sum.add(fragmentValue(game, c)), D(0)),
    };
  });

  function setAuto(patch: Partial<AutoRecycleConfig>) {
    act(setAutoRecycle(game, patch));
  }

  function open(id: string, count: number) {
    const def = content.capsules.get(id);
    view.muteDex = true;
    const res = openCapsules(game, id, count, def.elementChoice ? recycler.element : null);
    view.muteDex = false;
    refresh();
    if (!res.ok) {
      toast(res.reason, 'error', 3500, false);
      return;
    }
    clearTimers();
    results = res.results;
    opened = capsuleLook(id);
    if (reducedMotion()) {
      instant = true;
      phase = 'reveal';
      return;
    }
    instant = false;
    phase = 'charge';
    timers = [setTimeout(() => (phase = 'burst'), 800), setTimeout(() => (phase = 'reveal'), 1250)];
  }

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers = [];
  }
  /** Tap during the animation skips to the result; tap on the result closes it. */
  function onBackdrop() {
    if (phase !== 'reveal') skip();
    else close();
  }
  function skip() {
    clearTimers();
    instant = true;
    phase = 'reveal';
  }
  function close() {
    clearTimers();
    results = null;
  }
  $effect(() => () => clearTimers());

  const shown = $derived.by(() =>
    (results ?? []).map((r) => {
      const c = findCreature(game, r.creatureId);
      return { r, c, species: content.species.get(r.speciesId), rarity: content.rarities.get(r.rarity), look: c ? expressedAppearance(game, c) : null };
    }),
  );
  /** Best rarity of the batch: tints the glow while the capsule rattles, and a banner from Episch on. */
  const best = $derived(shown.reduce<(typeof shown)[number]['rarity'] | null>((b, s) => (!b || s.rarity.order > b.order ? s.rarity : b), null));
  const tally = $derived(
    content.rarities.list
      .map((r) => ({ r, n: shown.filter((s) => s.rarity.id === r.id).length }))
      .filter((x) => x.n > 0)
      .reverse(),
  );
</script>

<header class="tab-head">
  <h2>♻️ Gen-Recycler & Kapseln</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">🧩 {formatNumber(data.fragments)}</b><small>Gen-Fragmente</small></span>
    <span class="kpi" class:warn={data.free <= 0}><b class="num">{data.free}</b><small>freie Stallplätze</small></span>
    <span class="kpi"><b class="num">{data.opened}</b><small>Kapseln geöffnet</small></span>
  </div>
</header>
<p class="muted small">
  Überzählige Kreaturen schickst du im <b>Labor</b> („Auswählen“ → „Zum Recycler“) oder aus der Detailansicht in die Zerlege-Kammer. Aus Gen-Fragmenten
  entstehen hier zufällige Kreaturen – auch Arten, die du noch nicht kennst. Alle Chancen stehen offen daneben. Nur Spielwährung, kein Echtgeld.
</p>

<div class="chamber-wrap"><RecyclerChamber /></div>

{#if auto}
  <div class="panel auto" class:on={auto.cfg.enabled}>
    <div class="auto-row">
      <label class="switch"><input type="checkbox" checked={auto.cfg.enabled} onchange={(e) => setAuto({ enabled: e.currentTarget.checked })} /> <b>♻️ Recycling-Automat</b></label>
      <label>Wann
        <select value={auto.cfg.when} onchange={(e) => setAuto({ when: e.currentTarget.value as AutoRecycleConfig['when'] })}>
          <option value="always">laufend alles Passende</option>
          <option value="full">nur wenn der Stall voll ist</option>
        </select>
      </label>
      <label>bis Seltenheit
        <select value={auto.cfg.maxRarity} onchange={(e) => setAuto({ maxRarity: e.currentTarget.value })}>
          {#each content.rarities.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
        </select>
      </label>
    </div>
    <div class="auto-row">
      <label>Je Art behalten
        <select value={String(auto.cfg.keepPerSpecies)} onchange={(e) => setAuto({ keepPerSpecies: Number(e.currentTarget.value) })}>
          {#each KEEP as n (n)}<option value={String(n)}>{n === 0 ? 'keine' : `die ${n} stärksten`}</option>{/each}
        </select>
      </label>
      <label class="switch"><input type="checkbox" checked={auto.cfg.keepSequenced} onchange={(e) => setAuto({ keepSequenced: e.currentTarget.checked })} /> Sequenzierte behalten</label>
    </div>
    <p class="small auto-status">
      <span class="muted">Der Automat füllt die Kammer, wenn nichts von dir wartet – eine Kreatur nach der anderen. Nie recycelt: Favoriten ★, Schillernde, infundierte und beschäftigte Kreaturen sowie das nächste Paar des Zuchtautomaten. Er ist der einzige Automat, der Kreaturen entfernt: Bei vollem Stall wartet der Zuchtautomat, bis hier Platz frei wird.</span>
      {#if auto.count > 0}<span class="hit">Nach den Regeln dran: <b class="num">{auto.count}</b> {auto.count === 1 ? 'Kreatur' : 'Kreaturen'} (≈ <span class="num">{formatNumber(auto.fragments)}</span> 🧩)</span>{/if}
    </p>
  </div>
{/if}

<div class="grid caps">
  {#each data.capsules as cap (cap.def.id)}
    {@const guaranteed = content.rarities.get(cap.def.pity.minRarity)}
    {@const left = cap.def.pity.threshold - cap.pity}
    <article class="panel capsule" style="--cc: {cap.look.color}">
      <div class="chead">
        <div class="pod"><GeneCapsule color={cap.look.color} accent={cap.look.accent} size={46} /></div>
        <div>
          <h3>{cap.def.name}</h3>
          <p class="muted small">{cap.def.description}</p>
        </div>
      </div>
      {#if cap.def.elementChoice}
        <select bind:value={recycler.element} aria-label="Element der Kapsel">
          {#each content.elements.list as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
        </select>
      {/if}
      <div class="oddsbar" aria-hidden="true">
        {#each cap.odds as o (o.r.id)}<span style="flex-grow: {o.p}; background: {o.r.color}" title="{o.r.name}: {formatPercent(o.p, o.p < 0.01 ? 2 : 1)}"></span>{/each}
      </div>
      <ul class="odds">
        {#each cap.odds as o (o.r.id)}
          <li><i style="background: {o.r.color}"></i><span style="color: {o.r.color}">{o.r.name}</span><b class="num">{formatPercent(o.p, o.p < 0.01 ? 2 : 1)}</b></li>
        {/each}
      </ul>
      <div class="pity" title="Spätestens jede {cap.def.pity.threshold}. Kapsel ist mindestens {guaranteed.name}.">
        <span class="small">🎯 Garantie <b style="color: {guaranteed.color}">{guaranteed.name}</b></span>
        <span class="small num" class:soon={left <= 3}>{left <= 1 ? 'nächste Kapsel!' : `spätestens in ${left}`}</span>
        <div class="pitybar"><div style="width: {(cap.pity / (cap.def.pity.threshold - 1)) * 100}%"></div></div>
      </div>
      <div class="row">
        <button class="primary" disabled={!canAfford(game.state, cap.cost1) || data.free < 1} onclick={() => open(cap.def.id, 1)}>Öffnen · <CostLabel cost={cap.cost1} /></button>
        <button disabled={!canAfford(game.state, cap.cost10) || data.free < 10} onclick={() => open(cap.def.id, 10)}>×10 · <CostLabel cost={cap.cost10} /></button>
      </div>
    </article>
  {/each}
</div>

{#if results && opened}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="backdrop" role="presentation" onclick={onBackdrop}>
    <div class="reveal {phase}" class:instant role="dialog" aria-modal="true" aria-label="Kapsel-Ergebnis" tabindex="-1"
      onkeydown={(e) => e.key === 'Escape' && close()} style="--best: {best?.color ?? opened.color}">
      {#if phase !== 'reveal'}
        <div class="stage">
          <div class="rays"></div>
          {#if phase === 'burst'}
            {#each Array.from({ length: 14 }, (_, i) => i) as i (i)}
              <span class="spark" style="--a: {i * (360 / 14)}deg; --d: {40 + (i % 3) * 22}px"></span>
            {/each}
          {/if}
          <div class="capwrap"><GeneCapsule color={opened.color} accent={opened.accent} size={96} state={phase === 'charge' ? 'shake' : 'open'} glow={best?.color ?? null} /></div>
        </div>
        <p class="muted small hint">Tippen zum Überspringen</p>
      {:else}
        <div class="panel result" role="presentation" onclick={(e) => e.stopPropagation()}>
          {#if best && best.order >= 3}
            <h3 class="banner" style="color: {best.color}">✨ {best.name}!</h3>
          {:else}
            <h3>Ergebnis</h3>
          {/if}
          {#if shown.length > 1}
            <div class="tally">
              {#each tally as t (t.r.id)}<span class="chip" style="--c: {t.r.color}"><b class="num">{t.n}×</b> {t.r.name}</span>{/each}
            </div>
          {/if}
          <div class="results" class:single={shown.length === 1}>
            {#each shown as s, i (s.r.creatureId)}
              <div class="res" class:glow={s.rarity.glow} class:shine={s.rarity.order >= 3} style="--c: {s.rarity.color}; --i: {i}">
                {#if s.r.newDex}<span class="new">NEU</span>{/if}
                {#if s.look}<CreatureSvg appearance={s.look} shape={s.species.shape} tier={s.species.tier} size={shown.length === 1 ? 96 : 56} />{/if}
                <b>{s.species.name}</b>
                <span class="small" style="color: var(--c)">{s.rarity.name}</span>
                {#if s.r.pity}<span class="small muted">🎯 Garantie</span>{/if}
              </div>
            {/each}
          </div>
          <button class="primary" onclick={close}>Weiter</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .small { font-size: 0.8rem; }
  .chamber-wrap { margin-bottom: 0.75rem; }
  .auto { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
  .auto.on { border-color: var(--teal); box-shadow: 0 0 12px #2fd3c433; }
  .auto-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .auto-status { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .auto-status .hit { color: var(--gold); }
  .caps { grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); }
  .capsule { display: flex; flex-direction: column; gap: 0.45rem; border-color: color-mix(in srgb, var(--cc) 35%, var(--line));
    background: radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--cc) 14%, transparent), transparent 55%), var(--panel); }
  .chead { display: flex; gap: 0.75rem; align-items: center; }
  .chead h3 { margin: 0 0 0.15rem; }
  .chead p { margin: 0; }
  .pod { flex: none; width: 58px; display: grid; place-items: center; padding: 0.3rem 0; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--cc) 22%, transparent), transparent 70%); }
  .capsule select { width: 100%; }
  .oddsbar { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--bg-2); border: 1px solid var(--line); }
  .oddsbar span { min-width: 2px; }
  .odds { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 0.1rem 0.9rem; font-size: 0.78rem; }
  .odds li { display: flex; align-items: center; gap: 0.35rem; }
  .odds i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .odds b { margin-left: auto; font-weight: 600; }
  .pity { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.2rem 0.5rem; padding: 0.4rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .pity .soon { color: var(--gold); font-weight: 700; }
  .pitybar { width: 100%; height: 6px; background: var(--panel-2); border-radius: 99px; overflow: hidden; }
  .pitybar div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--gold)); transition: width 0.4s; }
  .row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: auto; }
  .row button { flex: 1; }

  /* Opening */
  .backdrop { position: fixed; inset: 0; background: radial-gradient(circle, #0b1a20e6, #000d); z-index: 30; display: grid; place-items: center; padding: 1rem; }
  .reveal { width: min(680px, 100%); text-align: center; outline: none; }
  .stage { position: relative; height: 260px; display: grid; place-items: center; }
  .capwrap { position: relative; z-index: 1; }
  .rays { position: absolute; width: 320px; height: 320px; border-radius: 50%; opacity: 0.25;
    background: repeating-conic-gradient(from 0deg, var(--best) 0deg 7deg, transparent 7deg 24deg);
    mask: radial-gradient(circle, #000 20%, transparent 68%); animation: turn 6s linear infinite; transition: opacity 0.3s; }
  .burst .rays { opacity: 0.8; animation-duration: 2s; }
  @keyframes turn { to { transform: rotate(360deg); } }
  .spark { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: var(--best); box-shadow: 0 0 8px var(--best);
    animation: fly 0.55s ease-out forwards; }
  @keyframes fly { from { transform: rotate(var(--a)) translateY(0) scale(1.2); opacity: 1; } to { transform: rotate(var(--a)) translateY(calc(-1 * var(--d) - 50px)) scale(0.2); opacity: 0; } }
  .hint { margin: 0; }
  .result { max-height: 88vh; overflow-y: auto; animation: rise 0.25s ease-out; box-shadow: 0 0 40px color-mix(in srgb, var(--best) 30%, transparent); border-color: color-mix(in srgb, var(--best) 50%, var(--line)); }
  @keyframes rise { from { transform: translateY(12px) scale(0.97); opacity: 0; } }
  .banner { font-size: 1.4rem; margin: 0.2rem 0 0.4rem; text-shadow: 0 0 14px currentColor; animation: stamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  @keyframes stamp { from { transform: scale(2); opacity: 0; } }
  .tally { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3rem; }
  .chip { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid var(--c); color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
  .results { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 0.5rem; margin: 0.75rem 0; perspective: 800px; }
  .results.single { grid-template-columns: minmax(0, 200px); justify-content: center; }
  .res { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; border: 2px solid var(--c); border-radius: 12px; padding: 0.5rem 0.4rem; font-size: 0.8rem;
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%), var(--bg-2);
    animation: flip 0.45s cubic-bezier(0.2, 1.2, 0.4, 1) both; animation-delay: calc(var(--i) * 90ms); }
  .instant .res { animation-delay: 0s; }
  @keyframes flip { from { transform: rotateY(90deg) scale(0.8); opacity: 0; } }
  .res.shine::after { content: ''; position: absolute; inset: 0; background: linear-gradient(115deg, transparent 35%, #ffffff55 50%, transparent 65%);
    transform: translateX(-120%); animation: sweep 1.6s ease-in-out infinite; animation-delay: calc(var(--i) * 90ms + 0.4s); }
  @keyframes sweep { 60%, 100% { transform: translateX(120%); } }
  .res.glow { animation: flip 0.45s cubic-bezier(0.2, 1.2, 0.4, 1) both, mythic-glow 2.2s ease-in-out infinite; animation-delay: calc(var(--i) * 90ms), 0s; }
  .new { position: absolute; top: 4px; right: 4px; background: var(--gold); color: #000; border-radius: 99px; padding: 0 0.4rem; font-size: 0.62rem; font-weight: 700; z-index: 1; }
  @media (max-width: 640px) {
    .stage { height: 220px; }
    .results { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
  }
</style>
