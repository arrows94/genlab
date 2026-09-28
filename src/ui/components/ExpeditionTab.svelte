<script lang="ts">
  import { fade } from 'svelte/transition';
  import { content } from '@content/index';
  import { canAfford, toCost } from '@core/costs';
  import { effectiveStats, findCreature } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import {
    campSlots, campsUsed, hintChance, missionAvailable, missionDurationMs, missionRewardFactor, missionSpecies, runningMissions, startMission, wildChance,
    type MissionData,
  } from '@core/features/expedition';
  import { processRemainingMs } from '@core/systems/processes';
  import type { Condition } from '@core/content/types';
  import type { Creature } from '@core/state';
  import { game, view, act, ask } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CostLabel from './CostLabel.svelte';
  import VoyagePanel from './VoyagePanel.svelte';
  import { runningVoyage, type VoyageData } from '@core/features/voyage';

  /**
   * Expeditions as a world map: regions are nodes around the camp, running
   * expeditions travel there and back along the paths. Below: camp slots,
   * the selected region with loot/wild creatures, creature tiles and a log of
   * recent returns.
   */

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
  const CAMP = { x: 70, y: 205 };
  const RING = 2 * Math.PI * 20;

  /** Visual placement of the known regions; unknown ids get a fallback spot. */
  const layout: Record<string, { x: number; y: number; icon: string; color: string }> = {
    short: { x: 175, y: 160, icon: '🌲', color: '#66bb6a' },
    medium: { x: 300, y: 112, icon: '⛰️', color: '#c49a6c' },
    long: { x: 452, y: 62, icon: '🏔️', color: '#b0bec5' },
    frostpeak: { x: 560, y: 138, icon: '❄️', color: '#80deea' },
    shadowwood: { x: 318, y: 222, icon: '🦇', color: '#9575cd' },
    crystalcaves: { x: 490, y: 222, icon: '💠', color: '#f48fb1' },
    mistmoor: { x: 405, y: 162, icon: '🌫️', color: '#a5b4c8' },
    cloudridge: { x: 575, y: 42, icon: '☁️', color: '#e1bee7' },
  };
  /** Journeys (Tagesreisen) take half a day or more. */
  const JOURNEY_MS = 12 * 3_600_000;
  function place(id: string, i: number) {
    return layout[id] ?? { x: 140 + ((i * 97) % 440), y: 60 + ((i * 53) % 170), icon: '🧭', color: '#2fd3c4' };
  }

  type Pt = [number, number];
  const trees: Pt[] = [[140, 140], [155, 128], [196, 138], [206, 176], [128, 172], [215, 152]];
  const darkTrees: Pt[] = [[290, 214], [302, 236], [345, 208], [352, 238], [330, 246]];
  const crystals: Pt[] = [[468, 232], [512, 236], [520, 206]];

  let chosen = $state<number | null>(null);

  function control(p: { x: number; y: number }) {
    return { x: (CAMP.x + p.x) / 2, y: Math.min(CAMP.y, p.y) - 45 };
  }
  function pathOf(p: { x: number; y: number }) {
    const c = control(p);
    return `M${CAMP.x} ${CAMP.y} Q${c.x} ${c.y} ${p.x} ${p.y}`;
  }
  /** Traveller position: out to the region in the first half, back in the second. */
  function travel(p: { x: number; y: number }, progress: number) {
    const t = progress < 0.5 ? progress * 2 : 2 - progress * 2;
    const c = control(p);
    const u = 1 - t;
    return { x: u * u * CAMP.x + 2 * u * t * c.x + t * t * p.x, y: u * u * CAMP.y + 2 * u * t * c.y + t * t * p.y, back: progress >= 0.5 };
  }
  function lockText(cond: Condition | undefined): string {
    if (cond?.type === 'upgradeLevel') return `${content.upgrades.get(cond.upgrade).name} Stufe ${cond.level}`;
    if (cond?.type === 'prestigeCount') return `nach der ${cond.count}. ${content.prestigeLayers.get(cond.layer).name}`;
    return 'noch nicht erschlossen';
  }
  const seen = (speciesId: string) => Object.keys(game.state.dex).some((k) => k.startsWith(`${speciesId}:`));
  const look = (c: Creature) => expressedAppearance(game, c);

  const data = $derived.by(() => {
    view.frame;
    const running = runningMissions(game).map((p) => {
      const d = p.data as MissionData;
      return { id: p.id, missionId: d.missionId, mission: content.missions.get(d.missionId), creature: findCreature(game, d.creatureId), progress: Math.min(1, p.elapsedMs / p.durationMs), remaining: processRemainingMs(game, p) };
    });
    const regions = content.missions.list.map((m, i) => ({ def: m, pos: place(m.id, i), open: missionAvailable(game, m.id), busy: running.filter((r) => r.missionId === m.id).length }));
    const sel = content.missions.has(viewState.expedition.region) && missionAvailable(game, viewState.expedition.region) ? viewState.expedition.region : 'short';
    const def = content.missions.get(sel);
    const idle = game.state.creatures
      .filter((c) => c.job === null || c.job.kind === 'building')
      .map((c) => ({ c, spd: effectiveStats(game, c).spd ?? 0, factor: missionRewardFactor(game, c) }))
      .sort((a, b) => b.spd - a.spd)
      .slice(0, 40);
    const chosenCreature = chosen !== null ? findCreature(game, chosen) : undefined;
    const vp = runningVoyage(game);
    const voyage = vp
      ? { dest: content.voyageDestinations.get((vp.data as VoyageData).destination), progress: Math.min(1, vp.elapsedMs / vp.durationMs), remaining: processRemainingMs(game, vp), size: (vp.data as VoyageData).team.length }
      : null;
    return {
      slots: campSlots(game),
      used: campsUsed(game),
      voyage,
      voyageOn: game.state.features['voyage'] === true,
      running,
      regions,
      sel,
      def,
      pos: place(sel, content.missions.list.indexOf(def)),
      duration: missionDurationMs(game, sel),
      journey: missionDurationMs(game, sel) >= JOURNEY_MS,
      minRarity: def.wildMinRarity ? content.rarities.get(def.wildMinRarity) : null,
      wild: wildChance(game, sel),
      hint: game.state.features['hybrids'] ? hintChance(game, sel) : 0,
      species: missionSpecies(game, sel).map((id) => ({ s: content.species.get(id), seen: seen(id) })),
      cost: toCost(def.cost),
      affordable: canAfford(game.state, toCost(def.cost)),
      factor: missionRewardFactor(game, chosenCreature),
      idle,
      chosenCreature,
    };
  });

  function select(id: string) {
    if (missionAvailable(game, id)) viewState.expedition.region = id;
  }
  async function send() {
    const c = data.chosenCreature;
    if (!c) return;
    // Journeys bind a creature and a camp for a long time – make that a conscious choice.
    if (data.journey && !(await ask(`${c.name} ist ${formatDuration(data.duration)} unterwegs und fehlt so lange bei Arbeit, Zucht und Turm. Losschicken?`, { ok: 'Losschicken' }))) return;
    if (act(startMission(game, c.id, data.sel))) chosen = null;
  }
</script>

<header class="head">
  <h2>🧭 Erkundung</h2>
  <span class="muted num">{data.used}/{data.slots} Camps belegt</span>
</header>

<!-- World map -->
<div class="map panel">
  <svg viewBox="0 0 620 270" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Weltkarte">
    <defs>
      <radialGradient id="exp-ground" cx="30%" cy="70%" r="90%">
        <stop offset="0%" stop-color="#16373b" />
        <stop offset="100%" stop-color="#0a1a1e" />
      </radialGradient>
      <filter id="exp-fog"><feGaussianBlur stdDeviation="7" /></filter>
    </defs>
    <rect x="-300" width="1220" height="270" fill="url(#exp-ground)" />
    <!-- scenery -->
    <path d="M-300 246 L0 250 C120 230 150 262 260 244 S430 258 620 236 L920 240 L920 270 L-300 270 Z" fill="#0f2a2e" />
    <path d="M240 270 C250 240 220 215 245 190 S300 160 290 130" stroke="#1e5a7a" stroke-width="5" fill="none" opacity="0.7" stroke-linecap="round" />
    {#each trees as [x, y], i (i)}
      <polygon points="{x},{y - 16} {x - 8},{y} {x + 8},{y}" fill="#2e7d4f" opacity="0.8" />
    {/each}
    <ellipse cx="280" cy="128" rx="46" ry="18" fill="#3b4a3a" opacity="0.7" />
    <ellipse cx="325" cy="122" rx="36" ry="14" fill="#44523f" opacity="0.7" />
    <polygon points="400,92 440,28 480,92" fill="#4a5a66" />
    <polygon points="440,92 475,40 510,92" fill="#56666f" />
    <polygon points="430,44 440,28 450,44" fill="#e8f1f5" />
    <polygon points="468,50 475,40 482,50" fill="#e8f1f5" />
    <polygon points="535,165 562,108 592,165" fill="#5d7f8a" opacity="0.9" />
    <polygon points="552,128 562,108 572,128" fill="#e0f7fa" />
    {#each darkTrees as [x, y], i (i)}
      <polygon points="{x},{y - 18} {x - 8},{y} {x + 8},{y}" fill="#2a2140" opacity="0.9" />
    {/each}
    {#each crystals as [x, y], i (i)}
      <polygon points="{x},{y - 16} {x - 5},{y - 4} {x},{y} {x + 5},{y - 4}" fill="#f48fb1" opacity="0.65" />
    {/each}

    <!-- paths -->
    {#each data.regions as r (r.def.id)}
      <path d={pathOf(r.pos)} class="route" class:open={r.open} class:sel={r.def.id === data.sel} />
    {/each}

    <!-- camp -->
    <g transform="translate({CAMP.x} {CAMP.y})">
      <circle r="24" class="camp" />
      <text class="emoji" y="7" text-anchor="middle">🏕️</text>
      <text class="label" y="40" text-anchor="middle">Camp</text>
    </g>

    <!-- regions -->
    {#each data.regions as r (r.def.id)}
      <g
        transform="translate({r.pos.x} {r.pos.y})"
        class="node"
        class:locked={!r.open}
        class:sel={r.def.id === data.sel}
        style="--rc: {r.pos.color}"
        role="button"
        tabindex={r.open ? 0 : -1}
        aria-label={r.def.name}
        onclick={() => select(r.def.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && select(r.def.id)}
      >
        {#if r.open}
          <circle r="22" class="disc" />
          <text class="emoji" y="7" text-anchor="middle">{r.pos.icon}</text>
          <text class="label" y="38" text-anchor="middle">{r.def.name}</text>
          {#if r.busy}<g transform="translate(17 -17)"><circle r="8" class="badge" /><text y="4" text-anchor="middle" class="badge-t">{r.busy}</text></g>{/if}
        {:else}
          <circle r="30" class="fog" filter="url(#exp-fog)" />
          <text class="emoji" y="6" text-anchor="middle">🔒</text>
          <text class="label dim" y="38" text-anchor="middle">{lockText(r.def.requires)}</text>
        {/if}
      </g>
    {/each}

    <!-- travellers -->
    {#each data.running as r (r.id)}
      {@const p = travel(place(r.missionId, content.missions.list.indexOf(r.mission)), r.progress)}
      {#if r.creature}
        {@const sp = content.species.get(r.creature.speciesId)}
        <g transform="translate({p.x - 15} {p.y - 26})" class="traveller" class:back={p.back}>
          <ellipse cx="15" cy="29" rx="10" ry="3" fill="#000" opacity="0.35" />
          <CreatureSvg appearance={look(r.creature)} shape={sp.shape} tier={sp.tier} size={30} shiny={r.creature.shiny} />
        </g>
      {/if}
    {/each}
  </svg>
</div>

<!-- Camps -->
<div class="camps">
  {#each Array.from({ length: Math.max(data.slots, data.used) }, (_, i) => i) as i (i)}
    {@const r = data.running[i]}
    {#if !r && data.voyage && i === data.running.length}
      <article class="camp-card" style="--rc: {content.elements.get(data.voyage.dest.element).color}">
        <div class="ring-wrap">
          <svg viewBox="0 0 48 48" width="48" height="48" class="ring">
            <circle cx="24" cy="24" r="20" class="track" />
            <circle cx="24" cy="24" r="20" class="fill" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - data.voyage.progress)} />
          </svg>
          <span class="avatar">{data.voyage.dest.icon}</span>
        </div>
        <div class="camp-info">
          <b>🗺️ {data.voyage.dest.name}</b>
          <span class="small muted">Wochenexpedition · {data.voyage.size} {data.voyage.size === 1 ? 'Kreatur' : 'Kreaturen'}</span>
          <span class="small num">noch {formatDuration(data.voyage.remaining)}</span>
        </div>
      </article>
    {:else if r}
      {@const pos = place(r.missionId, content.missions.list.indexOf(r.mission))}
      <article class="camp-card" style="--rc: {pos.color}">
        <div class="ring-wrap">
          <svg viewBox="0 0 48 48" width="48" height="48" class="ring">
            <circle cx="24" cy="24" r="20" class="track" />
            <circle cx="24" cy="24" r="20" class="fill" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - r.progress)} />
          </svg>
          {#if r.creature}
            {@const sp = content.species.get(r.creature.speciesId)}
            <span class="avatar"><CreatureSvg appearance={look(r.creature)} shape={sp.shape} tier={sp.tier} size={34} /></span>
          {/if}
        </div>
        <div class="camp-info">
          <b>{pos.icon} {r.mission.name}</b>
          <span class="small muted">{r.creature?.name ?? '?'} · {r.progress < 0.5 ? 'unterwegs' : 'auf dem Rückweg'}</span>
          <span class="small num">noch {formatDuration(r.remaining)}</span>
        </div>
      </article>
    {:else}
      <article class="camp-card free"><span>⛺</span><span class="small muted">Freies Camp</span></article>
    {/if}
  {/each}
</div>

{#if data.voyageOn}<VoyagePanel />{/if}

<div class="lower">
  <!-- Selected region -->
  <article class="panel region" style="--rc: {data.pos.color}">
    <div class="banner">
      <span class="big-icon">{data.pos.icon}</span>
      <div>
        <h3>{data.def.name}</h3>
        <p class="small muted">{data.def.description}</p>
      </div>
    </div>

    <div class="facts">
      {#if data.journey}<span class="fact journey">🌙 Tagesreise</span>{/if}
      <span class="fact">⏱ <b class="num">{formatDuration(data.duration)}</b></span>
      <span class="fact">🐾 <b class="num">{formatPercent(data.wild, 0)}</b> wilde Kreatur</span>
      {#if data.minRarity}<span class="fact" style="color: {data.minRarity.color}">✦ mindestens {data.minRarity.name}</span>{/if}
      {#if data.hint > 0}<span class="fact">📜 <b class="num">{formatPercent(data.hint, 0)}</b> Rezepthinweis</span>{/if}
    </div>
    <div class="meter" title="Chance auf eine wilde Kreatur"><div style="width: {data.wild * 100}%"></div></div>
    {#if data.minRarity}<p class="small muted">Garantierter Fund – er findet auch in einem vollen Stall Platz.</p>{/if}

    <h4>Beute {#if data.chosenCreature}<span class="small muted">mit {data.chosenCreature.name} (×{formatNumber(data.factor, { decimals: 2 })})</span>{/if}</h4>
    <div class="loot">
      {#each Object.entries(data.def.rewards) as [res, [min, max]] (res)}
        {@const r = content.resources.get(res)}
        <span class="loot-chip" style="--c: {r.color}" title={r.name}>
          <span class="li">{r.icon}</span>
          <span class="num">{formatNumber(Math.floor(min * data.factor))}–{formatNumber(Math.ceil(max * data.factor))}</span>
        </span>
      {/each}
    </div>

    <h4>Heimische Arten</h4>
    <div class="natives">
      {#each data.species as { s, seen } (s.id)}
        <span class="native" class:unseen={!seen} title={seen ? s.name : 'Unentdeckt'}>
          <CreatureSvg appearance={{ ...neutral, hue: s.hue }} shape={s.shape} tier={s.tier} size={36} />
          <span class="tiny">{seen ? s.name : '???'}</span>
        </span>
      {/each}
    </div>
  </article>

  <!-- Explorer choice -->
  <article class="panel crew">
    <div class="crew-head">
      <h3>Wer geht los?</h3>
      <span class="small muted">💨 Tempo erhöht die Beute</span>
    </div>
    {#if data.used >= data.slots}
      <p class="muted small">Alle Camps sind belegt.</p>
    {:else}
      <div class="tiles">
        {#each data.idle as t (t.c.id)}
          {@const sp = content.species.get(t.c.speciesId)}
          <button
            class="tile"
            class:on={chosen === t.c.id}
            style="--el: {content.elements.get(sp.element).color}; --rar: {content.rarities.get(t.c.rarity).color}"
            title="{t.c.name} · {sp.name} · {content.rarities.get(t.c.rarity).name}"
            onclick={() => (chosen = chosen === t.c.id ? null : t.c.id)}
          >
            <CreatureSvg appearance={look(t.c)} shape={sp.shape} tier={sp.tier} size={42} shiny={t.c.shiny} />
            <span class="tname">{t.c.name}</span>
            <span class="tiny num">💨 {formatNumber(t.spd)} · ×{formatNumber(t.factor, { decimals: 2 })}</span>
          </button>
        {:else}
          <p class="muted small">Keine freie Kreatur.</p>
        {/each}
      </div>
    {/if}
    <button class="primary go" disabled={chosen === null || !data.affordable || data.used >= data.slots} onclick={send}>
      🧭 Nach {data.def.name} schicken · <CostLabel cost={data.cost} />
    </button>
  </article>
</div>

<!-- Returns -->
{#if view.returns.length}
  <article class="panel returns">
    <h3>📬 Zurückgekehrt</h3>
    <ul>
      {#each view.returns as r (r.id)}
        {@const c = findCreature(game, r.creatureId)}
        {@const pos = place(r.missionId, content.missions.list.findIndex((m) => m.id === r.missionId))}
        <li in:fade={{ duration: 300 }} class:wildfind={!!r.wildSpecies}>
          <span class="ricon">{pos.icon}</span>
          <span class="rname">{c?.name ?? '?'} <span class="muted small">aus {content.missions.has(r.missionId) ? content.missions.get(r.missionId).name : r.missionId}</span></span>
          <span class="rloot num">{#each r.rewards as [res, v] (res)}<span>+{v} {content.resources.get(res).icon}</span>{/each}</span>
          {#if r.wildSpecies && content.species.has(r.wildSpecies)}
            {@const s = content.species.get(r.wildSpecies)}
            <span class="wild"><CreatureSvg appearance={{ ...neutral, hue: s.hue }} shape={s.shape} tier={s.tier} size={24} /> {s.name} gefunden!</span>
          {/if}
        </li>
      {/each}
    </ul>
  </article>
{/if}

<style>
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.68rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  .head h2 { margin: 0 0 0.5rem; }

  /* Map */
  .map { padding: 0; overflow-x: auto; overflow-y: hidden; background: #0a1a1e; }
  .map svg { display: block; width: 100%; height: auto; max-height: 400px; margin: 0 auto; }
  .route { fill: none; stroke: var(--line); stroke-width: 2; stroke-dasharray: 3 6; opacity: 0.5; }
  .route.open { stroke: #6fb7b0; opacity: 0.55; }
  .route.sel { stroke: var(--gold); opacity: 0.95; stroke-width: 2.5; animation: march 1.2s linear infinite; }
  @keyframes march { to { stroke-dashoffset: -18; } }
  .camp { fill: #3a2a18; stroke: var(--gold); stroke-width: 2; }
  .emoji { font-size: 20px; pointer-events: none; }
  .label { font-size: 10px; fill: var(--text); paint-order: stroke; stroke: #071317; stroke-width: 3px; font-weight: 600; pointer-events: none; }
  .label.dim { fill: var(--muted); font-weight: 400; font-size: 10px; }
  .node { cursor: pointer; outline: none; }
  .node.locked { cursor: default; }
  .disc { fill: color-mix(in srgb, var(--rc) 30%, #0c1f25); stroke: var(--rc); stroke-width: 2; transition: stroke-width 0.2s; }
  .node:hover .disc, .node:focus-visible .disc { stroke-width: 4; }
  .node.sel .disc { stroke: var(--gold); stroke-width: 4; filter: drop-shadow(0 0 6px #f2c14e); }
  .fog { fill: #9fb3b6; opacity: 0.28; }
  .badge { fill: var(--teal); }
  .badge-t { font-size: 10px; font-weight: 800; fill: #071317; }
  .traveller { animation: bob 0.6s ease-in-out infinite alternate; }
  .traveller.back :global(svg) { transform: scaleX(-1); }
  @keyframes bob { to { translate: 0 -3px; } }

  /* Camps */
  .camps { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.5rem; margin: 0.75rem 0; }
  .camp-card {
    display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.7rem; border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--rc) 55%, var(--line)); background: linear-gradient(90deg, color-mix(in srgb, var(--rc) 14%, var(--panel)), var(--panel));
  }
  .camp-card.free { border-style: dashed; border-color: var(--line); background: var(--bg-2); justify-content: center; min-height: 64px; }
  .ring-wrap { position: relative; width: 48px; height: 48px; flex: none; }
  .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--bg-2); stroke-width: 4; }
  .fill { fill: none; stroke: var(--rc); stroke-width: 4; stroke-linecap: round; transition: stroke-dashoffset 0.2s linear; }
  .avatar { position: absolute; inset: 7px; display: grid; place-items: center; }
  .camp-info { display: flex; flex-direction: column; min-width: 0; }
  .camp-info b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Lower */
  .lower { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 0.75rem; align-items: start; }
  .region { border-top: 3px solid var(--rc); }
  .banner { display: flex; align-items: center; gap: 0.7rem; margin: -0.2rem 0 0.4rem; }
  .banner h3 { margin: 0; }
  .banner p { margin: 0.1rem 0 0; }
  .big-icon {
    font-size: 1.8rem; width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: 50%; flex: none;
    background: radial-gradient(circle, color-mix(in srgb, var(--rc) 40%, transparent), transparent 70%); border: 2px solid var(--rc);
  }
  .facts { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .fact { padding: 0.15rem 0.55rem; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.8rem; }
  .fact.journey { border-color: var(--violet); color: #d7c6ff; }
  .meter { height: 6px; border-radius: 99px; background: var(--bg-2); overflow: hidden; margin: 0.45rem 0 0.2rem; }
  .meter div { height: 100%; background: linear-gradient(90deg, var(--petrol), var(--rc)); }
  h4 { margin: 0.7rem 0 0.35rem; font-size: 0.9rem; }
  .loot { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .loot-chip { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.6rem; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--c) 60%, var(--line)); background: color-mix(in srgb, var(--c) 10%, var(--bg-2)); }
  .li { font-size: 1.1rem; }
  .natives { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .native { display: flex; flex-direction: column; align-items: center; width: 4.2rem; }
  .native.unseen :global(svg) { filter: brightness(0) opacity(0.45); }
  .native.unseen .tiny { color: var(--muted); }

  .crew-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; flex-wrap: wrap; }
  .crew-head h3 { margin: 0 0 0.5rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.2rem, 1fr)); gap: 0.4rem; max-height: 19rem; overflow-y: auto; padding: 2px; margin-bottom: 0.6rem; }
  .tile { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.2rem; border-radius: 10px; border: 2px solid color-mix(in srgb, var(--el) 40%, var(--line)); background: var(--bg-2); position: relative; }
  .tile.on { border-color: var(--gold); box-shadow: 0 0 12px #f2c14e88; background: color-mix(in srgb, #f2c14e 12%, var(--bg-2)); }
  .tile.on::after { content: '✓'; position: absolute; top: 2px; right: 6px; color: var(--gold); font-weight: 800; }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rar); }
  .go { width: 100%; background: linear-gradient(90deg, var(--petrol), var(--teal)); }

  /* Returns */
  .returns { margin-top: 0.75rem; }
  .returns ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.3rem; }
  .returns li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.85rem; }
  .returns li.wildfind { border-color: var(--violet); box-shadow: 0 0 10px #9b6bff44; }
  .rloot { display: flex; gap: 0.5rem; margin-left: auto; }
  .wild { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--violet); font-weight: 600; }

  @media (max-width: 760px) {
    .lower { grid-template-columns: 1fr; }
    .map svg { min-width: 560px; max-height: none; }
    .camps { grid-template-columns: 1fr; gap: 0.35rem; }
    .camp-card { padding: 0.35rem 0.6rem; }
    .camp-card.free { min-height: 36px; }
  }
</style>
