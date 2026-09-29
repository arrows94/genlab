<script lang="ts">
  import { onMount } from 'svelte';
  import { play, startHum } from '../sound';
  import { content } from '@content/index';
  import { toggleLock } from '@core/actions';
  import { autoRecycleCandidates, inRecycler, recycleDurationMs, recyclerQueue, recyclingNow, takeBackFromRecycler } from '@core/features/automation';
  import type { Creature } from '@core/state';
  import { fragmentValue } from '@core/features/recycler';
  import { stableFree } from '@core/features/stable';
  import { formatDuration, formatNumber } from '@core/format';
  import { expressedAppearance } from '@core/genetics';
  import { game, view, act, toast } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * Zerlege-Kammer of the Gen-Recycler: the creature being taken apart right
   * now (it shrinks and fades as the progress fills) and the queue behind it –
   * first what the player sent (can be taken back), then the Recycling-Automat's
   * picks (can be rescued as a favourite).
   */
  const QUEUE = 6;

  const now = $derived.by(() => {
    view.frame;
    const r = recyclingNow(game);
    if (!r) return null;
    return {
      ...r,
      species: content.species.get(r.creature.speciesId),
      rarity: content.rarities.get(r.creature.rarity),
      look: expressedAppearance(game, r.creature),
      fragments: fragmentValue(game, r.creature),
    };
  });

  // The candidate search walks all creatures – refreshed at the slow rate.
  const info = $derived.by(() => {
    view.slowFrame;
    const cfg = game.state.automation.autoRecycle;
    const automat = !!game.state.features['autoRecycle'];
    const mine = recyclerQueue(game);
    const picks = automat && cfg.enabled ? autoRecycleCandidates(game).filter((c) => !inRecycler(game, c.id)) : [];
    const entry = (c: Creature, manual: boolean) => ({ c, manual, species: content.species.get(c.speciesId), rarity: content.rarities.get(c.rarity), look: expressedAppearance(game, c) });
    const list = [...mine.map((c) => entry(c, true)), ...picks.map((c) => entry(c, false))];
    const speed = content.upgrades.has('recyclerSpeed') ? content.upgrades.get('recyclerSpeed') : null;
    return {
      cfg,
      automat,
      next: list.slice(0, QUEUE),
      total: list.length,
      waitingFull: cfg.when === 'full' && stableFree(game) > 0,
      duration: recycleDurationMs(game),
      manualDuration: recycleDurationMs(game, true),
      faster: !!speed && (speed.maxLevel === null || (game.state.upgrades[speed.id] ?? 0) < speed.maxLevel),
    };
  });

  const idleText = $derived(
    !info.automat ? 'Schicke Kreaturen im Labor („Auswählen“ → „Zum Recycler“) oder aus der Detailansicht hierher.'
    : !info.cfg.enabled ? 'Der Automat ist ausgeschaltet – im Labor kannst du Kreaturen selbst schicken.'
    : info.waitingFull ? 'Wartet, bis der Stall voll ist.'
    : info.total === 0 ? 'Keine Kreatur erfüllt die Regeln.'
    : 'Die nächste Kreatur kommt gleich in die Kammer.',
  );

  /** Fragments flying out of the machine after each creature. */
  let pops = $state<{ id: number; text: string }[]>([]);
  let popId = 0;
  onMount(() =>
    game.bus.on('recycled', (e) => {
      play('recycled');
      const id = ++popId;
      pops = [...pops, { id, text: `+${formatNumber(e.fragments)} 🧩` }];
      setTimeout(() => (pops = pops.filter((p) => p.id !== id)), 1400);
    }),
  );

  // The chamber hums quietly while something is being taken apart (only while it is on screen).
  const working = $derived(!!now);
  $effect(() => {
    if (!working) return;
    return startHum();
  });

  /** What the player sent goes back to the stable; an automat pick is kept as a favourite. */
  function rescue() {
    const cur = now;
    if (!cur) return;
    if (cur.manual) {
      if (act(takeBackFromRecycler(game, cur.creature.id))) toast(`↩ ${cur.creature.name} ist zurück im Stall.`);
    } else if (act(toggleLock(game, cur.creature.id))) toast(`★ ${cur.creature.name} ist jetzt Favorit und bleibt.`);
  }
</script>

<div class="kammer" class:busy={!!now}>
  <div class="machine" style="--p: {now?.progress ?? 0}; --rc: {now?.rarity.color ?? 'var(--line)'}">
    <div class="tube">
      {#if now}
        {#key now.creature.id}
          <div class="subject"><div class="jitter"><CreatureSvg appearance={now.look} shape={now.species.shape} tier={now.species.tier} size={78} shiny={now.creature.shiny} /></div></div>
        {/key}
        <div class="beam"></div>
        {#each [0, 1, 2, 3, 4] as i (i)}<span class="bit" style="--i: {i}"></span>{/each}
      {:else}
        <span class="empty" aria-hidden="true">♻️</span>
      {/if}
      <div class="liquid"></div>
    </div>
    <div class="socket"></div>
    {#each pops as p (p.id)}<span class="pop num">{p.text}</span>{/each}
  </div>

  <div class="info">
    <span class="label small muted">Zerlege-Kammer</span>
    {#if now}
      <div class="who">
        <b>{now.creature.name}</b>
        <span class="small" style="color: {now.rarity.color}">{now.rarity.name}</span>
        <span class="small muted">{now.species.name} · Gen {now.creature.generation}</span>
      </div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(now.progress * 100)}><span style="width: {now.progress * 100}%"></span></div>
      <div class="row">
        <span class="small num">noch {formatDuration(now.remainingMs)} · ≈ {formatNumber(now.fragments)} 🧩</span>
        {#if now.manual}
          <button class="rescue" onclick={rescue} title="Von dir geschickt – zurück in den Stall">↩ Zurückholen</button>
        {:else}
          <button class="rescue" onclick={rescue} title="Als Favorit markieren – Favoriten recycelt der Automat nie">★ Retten</button>
        {/if}
      </div>
    {:else}
      <div class="who"><b class="muted">Leer</b></div>
      <span class="small muted">{idleText}</span>
    {/if}
    {#if info.next.length > 0}
      <div class="queue">
        <span class="small muted">Warteschlange ({info.total})</span>
        <div class="minis">
          {#each info.next as q (q.c.id)}
            {#if q.manual}
              <button class="q mine" style="--rc: {q.rarity.color}" title="{q.c.name} · {q.species.name} · {q.rarity.name} – von dir geschickt, antippen zum Zurückholen" onclick={() => act(takeBackFromRecycler(game, q.c.id))}><CreatureSvg appearance={q.look} shape={q.species.shape} tier={q.species.tier} size={30} /></button>
            {:else}
              <span class="q" style="--rc: {q.rarity.color}" title="{q.c.name} · {q.species.name} · {q.rarity.name} – vom Recycling-Automaten gewählt"><CreatureSvg appearance={q.look} shape={q.species.shape} tier={q.species.tier} size={30} /></span>
            {/if}
          {/each}
          {#if info.total > info.next.length}<span class="small muted more">+{info.total - info.next.length}</span>{/if}
        </div>
      </div>
    {/if}
    <span class="small muted">⏱ {formatDuration(info.manualDuration)} je Kreatur, die du schickst{#if info.automat}{' · '}{formatDuration(info.duration)} für die des Automaten{/if}{#if info.faster}{' – '}schneller mit der Forschung „Schnellzerlegung“{/if}</span>
  </div>
</div>

<style>
  .kammer { display: flex; gap: 1rem; align-items: center; padding: 0.6rem; border-radius: 12px; background: var(--bg-2); border: 1px solid var(--line); }
  .kammer.busy { border-color: color-mix(in srgb, var(--teal) 45%, var(--line)); }

  .machine { position: relative; flex: none; width: 104px; display: flex; flex-direction: column; align-items: center; }
  .tube {
    position: relative; width: 96px; height: 118px; border-radius: 44px 44px 12px 12px; overflow: hidden; display: grid; place-items: center;
    border: 2px solid color-mix(in srgb, var(--rc) 55%, var(--line));
    background: radial-gradient(circle at 30% 20%, #ffffff18, transparent 45%), linear-gradient(180deg, #0f2a30, #081619);
    box-shadow: inset 0 0 18px #2fd3c422, 0 0 calc(6px + var(--p) * 14px) color-mix(in srgb, var(--rc) 40%, transparent);
  }
  .subject {
    position: relative; z-index: 1;
    transform: scale(calc(1 - var(--p) * 0.55));
    filter: saturate(calc(1 - var(--p) * 0.8)) brightness(calc(1 + var(--p) * 0.5));
    opacity: calc(1 - var(--p) * 0.55);
    transition: transform 0.2s linear, opacity 0.2s linear;
    animation: enter 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
  }
  .jitter { animation: jitter 0.3s steps(2) infinite; }
  @keyframes enter { from { transform: translateY(-60px) scale(0.6); opacity: 0; } }
  @keyframes jitter { 50% { transform: translate(1px, -1px) rotate(1deg); } }
  .beam {
    position: absolute; left: 6px; right: 6px; height: 2px; top: 20%; z-index: 2; border-radius: 2px;
    background: linear-gradient(90deg, transparent, #7ff6ea, transparent); box-shadow: 0 0 8px #7ff6ea;
    animation: scan 1.6s ease-in-out infinite alternate;
  }
  @keyframes scan { to { top: 78%; } }
  .bit {
    position: absolute; z-index: 2; bottom: 38%; left: calc(22% + var(--i) * 13%); width: 6px; height: 6px; border-radius: 2px;
    background: var(--violet); box-shadow: 0 0 6px var(--violet); opacity: 0;
    animation: rise 1.4s ease-out infinite; animation-delay: calc(var(--i) * 0.28s);
  }
  @keyframes rise { 0% { transform: translateY(0) rotate(0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-58px) rotate(180deg); opacity: 0; } }
  .liquid {
    position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--p) * 100%); z-index: 0;
    background: linear-gradient(180deg, #2fd3c455, #9b6bff66); transition: height 0.2s linear;
  }
  .empty { font-size: 1.8rem; opacity: 0.35; }
  .socket { width: 104px; height: 12px; margin-top: -2px; border-radius: 4px 4px 8px 8px; background: linear-gradient(180deg, var(--panel-2, #1b3238), var(--panel)); border: 1px solid var(--line); }
  .pop { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); color: var(--violet); font-weight: 700; white-space: nowrap; text-shadow: 0 0 8px #9b6bff88; animation: popup 1.4s ease-out forwards; pointer-events: none; }
  @keyframes popup { from { opacity: 0; transform: translate(-50%, 10px); } 15% { opacity: 1; } to { opacity: 0; transform: translate(-50%, -34px); } }

  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .label { text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.68rem; }
  .who { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.5rem; }
  .bar { height: 8px; border-radius: 99px; overflow: hidden; background: var(--panel); border: 1px solid var(--line); }
  .bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--violet)); transition: width 0.2s linear; }
  .row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4rem; }
  .rescue { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
  .queue { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.5rem; }
  .minis { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; }
  .q { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border-radius: 8px; background: var(--panel); border: 1px solid color-mix(in srgb, var(--rc) 45%, var(--line)); }
  .q.mine { border-style: dashed; border-color: var(--violet); cursor: pointer; }
  .more { margin-left: 0.2rem; }
  .small { font-size: 0.8rem; }

  :global(.reduce-motion) .jitter, :global(.reduce-motion) .beam, :global(.reduce-motion) .bit, :global(.reduce-motion) .subject, :global(.reduce-motion) .pop { animation: none; }
  :global(.reduce-motion) .beam, :global(.reduce-motion) .bit { display: none; }

  @media (max-width: 480px) {
    .kammer { gap: 0.7rem; }
    .machine, .socket { width: 84px; }
    .tube { width: 80px; height: 100px; }
  }
</style>
