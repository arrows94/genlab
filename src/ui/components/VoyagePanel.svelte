<script lang="ts">
  import { content } from '@content/index';
  import { canAfford, toCost } from '@core/costs';
  import { effectiveStats, findCreature } from '@core/creatures';
  import { campSlots, campsUsed, missionRewardFactor } from '@core/features/expedition';
  import {
    optionRewards, pendingDecision, resolveVoyage, revealedEvents, runningVoyage, startVoyage, voyageDestination, voyageDurationMs,
    type VoyageData,
  } from '@core/features/voyage';
  import { activeMutation, nextWeekStart } from '@core/features/weekly';
  import { expressedAppearance } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { processRemainingMs } from '@core/systems/processes';
  import type { Creature } from '@core/state';
  import { game, view, act, ask, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * Wochenexpedition: plan (destination of the week + team), follow the
   * voyage day by day, and decide at the return.
   */
  let team = $state<number[]>([]);
  const look = (c: Creature) => expressedAppearance(game, c);

  const data = $derived.by(() => {
    view.slowFrame;
    const now = Date.now();
    const cfg = game.balance.voyage;
    const proc = runningVoyage(game);
    const pending = game.state.voyage.pending;
    const decision = pendingDecision(game);
    const dest = proc
      ? content.voyageDestinations.get((proc.data as VoyageData).destination)
      : pending
        ? content.voyageDestinations.get(pending.destination)
        : voyageDestination(game, now);
    const chosen = team.map((id) => findCreature(game, id)).filter((c): c is Creature => !!c && (c.job === null || c.job.kind === 'building'));
    const factor = chosen.reduce((n, c) => n + missionRewardFactor(game, c), 0) * (1 + game.state.voyage.nextBonus);
    return {
      cfg,
      dest,
      mutation: activeMutation(game, now),
      weekLeft: nextWeekStart(game, now) - now,
      cost: toCost(cfg.cost),
      affordable: canAfford(game.state, toCost(cfg.cost)),
      campFree: campsUsed(game) < campSlots(game),
      bonus: game.state.voyage.nextBonus,
      duration: voyageDurationMs(game),
      running: proc
        ? {
            progress: Math.min(1, proc.elapsedMs / proc.durationMs),
            remaining: processRemainingMs(game, proc),
            team: (proc.data as VoyageData).team.map((id) => findCreature(game, id)).filter((c): c is Creature => !!c),
            events: revealedEvents(game, proc),
          }
        : null,
      pending: pending && decision
        ? {
            decision,
            events: pending.events.map((id, i) => ({ day: i + 1, event: content.voyageEvents.get(id) })),
            team: pending.team.map((id) => findCreature(game, id)).filter((c): c is Creature => !!c),
            samples: pending.alleleSamples,
            rewards: [optionRewards(game, 0), optionRewards(game, 1)] as const,
          }
        : null,
      chosen,
      factor,
      idle: game.state.creatures
        .filter((c) => c.job === null || c.job.kind === 'building')
        .map((c) => ({ c, spd: effectiveStats(game, c).spd ?? 0, f: missionRewardFactor(game, c) }))
        .sort((a, b) => b.spd - a.spd)
        .slice(0, 30),
    };
  });

  function toggle(id: number) {
    if (team.includes(id)) team = team.filter((x) => x !== id);
    else if (team.length < data.cfg.maxTeam) team = [...team, id];
  }

  async function start() {
    const names = data.chosen.map((c) => c.name).join(', ');
    if (!(await ask(`${names} ${data.chosen.length === 1 ? 'ist' : 'sind'} ${data.cfg.days} Tage unterwegs und ${data.chosen.length === 1 ? 'fehlt' : 'fehlen'} so lange bei Arbeit, Zucht und Turm. Losschicken?`, { ok: 'Aufbrechen' }))) return;
    if (act(startVoyage(game, data.chosen.map((c) => c.id)))) team = [];
  }

  function decide(option: 0 | 1) {
    if (act(resolveVoyage(game, option))) toast('Die Wochenexpedition ist abgeschlossen.', 'unlock');
  }
</script>

<article class="panel voyage" style="--el: {content.elements.get(data.dest.element).color}">
  <header class="vhead">
    <span class="dicon">{data.dest.icon}</span>
    <div>
      <h3>🗺️ Wochenexpedition · {data.dest.name}</h3>
      <p class="small muted">{data.dest.description}</p>
    </div>
  </header>

  {#if data.pending}
    <!-- Return: events + decision -->
    <div class="back">
      <div class="team-row">
        {#each data.pending.team as c (c.id)}
          {@const sp = content.species.get(c.speciesId)}
          <span class="member"><CreatureSvg appearance={look(c)} shape={sp.shape} tier={sp.tier} size={34} /><small>{c.name}</small></span>
        {/each}
        <b>Das Team ist zurück!</b>
      </div>
      <ol class="log">
        {#each data.pending.events as { day, event } (day)}<li><span class="day">Tag {day}</span> {event.text}</li>{/each}
      </ol>
      <p class="decision">{data.pending.decision.text}</p>
      <div class="options">
        {#each data.pending.decision.options as o, i (i)}
          <button class="option" onclick={() => decide(i as 0 | 1)}>
            <b>{o.label}</b>
            <span class="small muted">{o.description}</span>
            <span class="small"><CostLabel cost={data.pending.rewards[i]!} />{#if data.pending.samples > 0}<span class="sample" title="Seltenste fehlende Allele für die Genbibliothek"> · +{data.pending.samples} Genprobe</span>{/if}</span>
          </button>
        {/each}
      </div>
    </div>
  {:else if data.running}
    <!-- Under way: seven-day track with the events so far -->
    <div class="team-row">
      {#each data.running.team as c (c.id)}
        {@const sp = content.species.get(c.speciesId)}
        <span class="member"><CreatureSvg appearance={look(c)} shape={sp.shape} tier={sp.tier} size={34} /><small>{c.name}</small></span>
      {/each}
      <span class="small num muted">noch {formatDuration(data.running.remaining)}</span>
    </div>
    <div class="track" title="{formatPercent(data.running.progress, 0)} der Reise">
      <div class="fill" style="width: {data.running.progress * 100}%"></div>
      {#each Array.from({ length: data.cfg.days }, (_, i) => i + 1) as d (d)}
        <span class="mark" class:reached={data.running.progress * data.cfg.days >= d} style="left: {(d / data.cfg.days) * 100}%">{d}</span>
      {/each}
    </div>
    <ol class="log">
      {#each data.running.events as { day, event } (day)}<li><span class="day">Tag {day}</span> {event.text}</li>{:else}<li class="muted">Das Team ist gerade aufgebrochen …</li>{/each}
    </ol>
  {:else}
    <!-- Planning -->
    <div class="facts">
      <span class="fact">⏱ <b class="num">{data.cfg.days} Tage</b></span>
      <span class="fact">👥 bis zu {data.cfg.maxTeam} Kreaturen</span>
      <span class="fact">📜 {data.cfg.events} Ereignisse unterwegs</span>
      {#if data.bonus > 0}<span class="fact bonus">🗺️ +{formatPercent(data.bonus, 0)} Beute (alte Karte)</span>{/if}
      <span class="fact muted">Neues Ziel in {formatDuration(data.weekLeft)}</span>
    </div>
    {#if data.mutation}<p class="small muted">Passend zur Wochen-Mutation „{data.mutation.name}“.</p>{/if}

    <div class="loot">
      {#each Object.entries(data.dest.rewards) as [res, [min, max]] (res)}
        {@const r = content.resources.get(res)}
        <span class="chip" style="--c: {r.color}">{r.icon} <span class="num">{formatNumber(Math.floor(min * Math.max(1, data.factor)))}–{formatNumber(Math.ceil(max * Math.max(1, data.factor)))}</span></span>
      {/each}
      <span class="small muted">{data.chosen.length > 0 ? `mit diesem Team (×${formatNumber(data.factor, { decimals: 2 })})` : 'pro Teammitglied'}</span>
    </div>
    <div class="natives">
      {#each data.dest.species as id (id)}
        {@const s = content.species.get(id)}
        <span title={s.name}><CreatureSvg appearance={{ hue: s.hue, pattern: 'none', eyes: 'round', horn: 'none' }} shape={s.shape} tier={s.tier} size={28} /></span>
      {/each}
      <span class="small muted">können sich bei der Rückkehr anschließen</span>
    </div>

    {#if !data.campFree}
      <p class="small muted">Alle Camps sind belegt.</p>
    {:else}
      <div class="tiles">
        {#each data.idle as t (t.c.id)}
          {@const sp = content.species.get(t.c.speciesId)}
          <button class="tile" class:on={team.includes(t.c.id)} style="--rar: {content.rarities.get(t.c.rarity).color}" title="{t.c.name} · {sp.name}" onclick={() => toggle(t.c.id)}>
            <CreatureSvg appearance={look(t.c)} shape={sp.shape} tier={sp.tier} size={38} shiny={t.c.shiny} />
            <span class="tname">{t.c.name}</span>
            <span class="tiny num">💨 {formatNumber(t.spd)} · ×{formatNumber(t.f, { decimals: 2 })}</span>
          </button>
        {/each}
      </div>
      <button class="primary go" disabled={data.chosen.length === 0 || !data.affordable} onclick={start}>
        🗺️ Team ({data.chosen.length}/{data.cfg.maxTeam}) aufbrechen lassen · <CostLabel cost={data.cost} />
      </button>
    {/if}
  {/if}
</article>

<style>
  .voyage { margin-bottom: 1rem; border-color: color-mix(in srgb, var(--el) 45%, var(--line)); display: grid; gap: 0.6rem; }
  .vhead { display: flex; gap: 0.7rem; align-items: center; }
  .vhead h3 { margin: 0; }
  .vhead p { margin: 0.15rem 0 0; }
  .dicon { font-size: 2rem; width: 3rem; height: 3rem; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--el) 20%, var(--bg-2)); border: 1px solid var(--el); }
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.66rem; }
  .facts, .loot, .natives, .team-row { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
  .fact, .chip { padding: 0.15rem 0.55rem; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.8rem; }
  .fact.bonus { border-color: var(--gold); color: var(--gold); }
  .chip { border-color: var(--c); }
  .member { display: flex; flex-direction: column; align-items: center; }
  .member small { font-size: 0.66rem; }

  .track { position: relative; height: 10px; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); margin: 0.6rem 0 1rem; }
  .track .fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--petrol), var(--el)); }
  .mark { position: absolute; top: 12px; transform: translateX(-50%); font-size: 0.65rem; color: var(--muted); }
  .mark.reached { color: var(--text); font-weight: 700; }

  .log { margin: 0; padding-left: 0; list-style: none; display: grid; gap: 0.25rem; font-size: 0.85rem; }
  .log li { padding: 0.25rem 0.5rem; border-radius: 8px; background: var(--bg-2); }
  .day { display: inline-block; min-width: 3.2rem; color: var(--el); font-weight: 700; }

  .back { display: grid; gap: 0.6rem; }
  .decision { margin: 0.2rem 0 0; font-weight: 600; }
  .options { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; }
  .option { display: grid; gap: 0.3rem; text-align: left; padding: 0.7rem; border-radius: 10px; border: 1px solid var(--el); background: color-mix(in srgb, var(--el) 10%, var(--bg-2)); }
  .option:hover { box-shadow: 0 0 12px color-mix(in srgb, var(--el) 40%, transparent); }
  .sample { color: var(--teal); }

  .tiles { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .tile { display: flex; flex-direction: column; align-items: center; width: 5.2rem; padding: 0.25rem; border: 1px solid var(--line); border-top: 2px solid var(--rar); border-radius: 10px; background: var(--bg-2); }
  .tile.on { border-color: var(--el); box-shadow: 0 0 10px color-mix(in srgb, var(--el) 45%, transparent); }
  .tname { font-size: 0.68rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .go { width: 100%; }
</style>
