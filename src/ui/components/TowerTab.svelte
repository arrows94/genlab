<script lang="ts">
  import { meter } from '../meter';
  import { onDestroy, untrack } from 'svelte';
  import { scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { creaturePower, effectiveStats, findCreature } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatDuration, formatPercent } from '@core/format';
  import {
    actionIntervals, enemiesFor, isBossFloor, resolveInfo, veteranRank, techniqueFor, teamSynergies, ROLE_INFO, roleOf, rowOf, setRow, targetingOf, type Row, checkpoint, restartCheckpoint, elementMultiplier, enemyFor, fighterFor, fightIntervalMs, towerMilestones, floorRewardInfo, enrageFactor, floorsToBoss, nextMilestoneFloor, setTeam, setTowerAutoRestart, startRun, stopRun, teamSize,
  } from '@core/features/tower';
  import { describeModifier } from '@core/queries';
  import { STATUS_INFO, currentDefeat, fightProtocol } from '@core/features/towerReport';
  import {
    advanceReplay, fightSeconds as fightSecondsOf, finalState, gauge, intervalsOf, replayStart, timedEvents, upcomingActions, type LastResult, type ReplayEvent,
  } from '@core/features/towerReplay';
  import type { Creature } from '@core/state';
  import { game, view, act, ask } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import { viewState, type ReplaySpeed } from '../viewState.svelte';
  import { play } from '../sound';
  import CreatureSvg from './CreatureSvg.svelte';
  import WeeklyBossPanel from './WeeklyBossPanel.svelte';
  import RelicPanel from './RelicPanel.svelte';
  import TowerFloors from './TowerFloors.svelte';
  import TowerBoard from './TowerBoard.svelte';
  import SortToggle from './SortToggle.svelte';

  /**
   * Genom-Turm: tower column with the floors around the team, an arena that
   * replays the last fight (HP bars, damage popups, result banner) and then
   * previews the next opponent with a countdown ring, team sockets and
   * candidate tiles with element matchups.
   */

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
  const RING = 2 * Math.PI * 30;
  const MAX_SLOTS = 5;

  interface Unit {
    name: string;
    speciesId: string;
    element: string;
    maxHp: number;
    team: boolean;
    creature: Creature | null;
    row?: Row;
    boss?: boolean;
  }

  // ---- fight replay -------------------------------------------------------


  /**
   * The last fight replayed on its own time line: `clock` runs in fight
   * seconds, events fire when the clock passes them, the action gauges fill
   * with each fighter's interval.
   */
  let replay = $state<{
    key: string; hp: number[]; elements: string[]; clock: number; end: number; idx: number; attacker: number; target: number; done: boolean;
  } | null>(null);
  let popups = $state<{ id: number; t: number; text: string; kind: 'hit' | 'crit' | 'weak' | 'miss' | 'heal' | 'shift' | 'tech' | 'dot' | 'reflect' | 'critHit' | 'status' }[]>([]);
  /** Active statuses per fighter in the replay: status id → until (fight seconds). */
  let marks = $state<Record<number, Record<string, number>>>({});
  let sparks = $state<{ id: number; t: number; color: string }[]>([]);
  let banner = $state<{ win: boolean; floor: number; seconds: number } | null>(null);
  let shake = $state(false);
  let sortBy = $state<'power' | 'matchup' | 'speed'>('power');
  let invertSort = $state(false);
  let lastKey: string | null = null;
  /** Real milliseconds per second of fight time in the replay (and the preview gauges). */
  const REPLAY_MS_PER_SEC = 700;
  let popupId = 0;
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const keyOf = (lr: typeof game.state.tower.lastResult) => (lr ? `${lr.floor}-${lr.at ?? 0}-${lr.win}` : '');

  function stopReplay() {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    frame = null;
    timer = null;
  }

  const fightSeconds = (lr: LastResult, events: ReplayEvent[]) => fightSecondsOf(game, lr, events);

  function show(t: number, text: string, kind: (typeof popups)[number]['kind']) {
    const id = ++popupId;
    popups = [...popups.slice(-7), { id, t, text, kind }];
    setTimeout(() => (popups = popups.filter((x) => x.id !== id)), 1000);
  }

  function popup(e: ReplayEvent, attackerElement: string) {
    const id = ++popupId;
    const tech = e.tech && content.techniques.has(e.tech) ? content.techniques.get(e.tech) : null;
    // The technique's name above its user.
    if (e.kind === 'tech' && tech) {
      show(e.a, `${tech.icon} ${tech.name}!`, 'tech');
      play('technique');
      if (e.dmg <= 0) return;
    }
    if (e.kind === 'phase' && e.trait && content.bossTraits.has(e.trait)) {
      const tr = content.bossTraits.get(e.trait);
      show(e.t, `${tr.icon} ${tr.name}!`, 'tech');
      play('drum');
      return;
    }
    if (e.kind === 'enrage') {
      show(e.a, '😡 Wut!', 'tech');
      play('drum');
      return;
    }
    if (e.kind === 'sweep') {
      show(e.a, '🌊 Flächenangriff!', 'tech');
      play('technique');
      return;
    }
    if (e.kind === 'status') {
      if (e.status && STATUS[e.status]?.harmful) show(e.t, STATUS[e.status]!.icon, 'status');
      return;
    }
    const hit = !e.kind || e.kind === 'tech';
    const p =
      e.kind === 'miss' ? { text: tech ? `${tech.name} verfehlt` : 'Ausgewichen!', kind: 'miss' as const }
      : e.kind === 'heal' ? { text: `+${formatNumber(e.dmg)}`, kind: 'heal' as const }
      : e.kind === 'shift' ? { text: el(e.element ?? 'fire').name, kind: 'shift' as const }
      : e.kind === 'dot' ? { text: `${STATUS[e.status ?? 'burn']?.icon ?? ''} −${formatNumber(e.dmg)}`, kind: 'dot' as const }
      : e.kind === 'reflect' ? { text: `↩ −${formatNumber(e.dmg)}`, kind: 'reflect' as const }
      : e.crit ? { text: `−${formatNumber(e.dmg)} Kritisch!`, kind: 'critHit' as const }
      : e.m > 1 ? { text: `−${formatNumber(e.dmg)} Sehr effektiv!`, kind: 'crit' as const }
      : e.m < 1 ? { text: `−${formatNumber(e.dmg)} resistiert`, kind: 'weak' as const }
      : { text: `−${formatNumber(e.dmg)}${e.absorbed ? ` (🪨 ${formatNumber(e.absorbed)})` : ''}`, kind: 'hit' as const };
    show(e.t, p.text, p.kind);
    if (p.kind !== 'dot') play(p.kind === 'crit' || p.kind === 'critHit' ? 'hitCrit' : p.kind === 'weak' ? 'hitWeak' : p.kind === 'miss' ? 'whoosh' : p.kind === 'heal' ? 'talent' : p.kind === 'shift' ? 'toastInfo' : 'hit');
    if ((hit || e.kind === 'dot' || e.kind === 'reflect') && e.hp <= 0) play('ko');
    if (hit) {
      sparks = [...sparks.slice(-4), { id, t: e.t, color: el(attackerElement).color }];
      setTimeout(() => (sparks = sparks.filter((x) => x.id !== id)), 420);
      if (e.m > 1 && !prefs.reduceMotion) {
        shake = true;
        setTimeout(() => (shake = false), 260);
      }
    }
  }

  function finish(lr: LastResult, key: string, seconds: number) {
    if (!replay || replay.key !== key) return;
    const end = finalState(lr);
    replay = { ...replay, ...end, clock: seconds, attacker: -1, target: -1, done: true };
    banner = { win: lr.win, floor: lr.floor, seconds };
    if (lr.win) play('floorClear');
    timer = setTimeout(() => (banner = null), 1900);
  }

  function startReplay(lr: LastResult, key: string) {
    stopReplay();
    const events = timedEvents(lr);
    const fighters = lr.fighters ?? [];
    if (!fighters.length) return;
    const seconds = fightSeconds(lr, events);
    const start = replayStart(lr);
    replay = { key, hp: start.hp, elements: start.elements, clock: 0, end: seconds, idx: 0, attacker: -1, target: -1, done: false };
    banner = null;
    popups = [];
    marks = {};
    if (isBossFloor(game, lr.floor)) play('drum');
    if (prefs.reduceMotion || viewState.tower.replaySpeed === 0) return finish(lr, key, seconds);
    // One fixed time scale for every fight (short fights stay short, long ones long);
    // only fights that would outlast the pause until the next floor are sped up.
    const budgetMs = Math.max(900, Math.min(fightIntervalMs(game) * 0.85 - 400, seconds * REPLAY_MS_PER_SEC));
    const rate = seconds / budgetMs;
    let last = performance.now();
    const step = (now: number) => {
      if (!replay || replay.key !== key) return;
      // Tempo-Regler: 2× runs the clock twice as fast, „überspringen“ jumps to the result.
      const speed = viewState.tower.replaySpeed;
      if (speed === 0) return finish(lr, key, seconds);
      const clock = Math.min(seconds, replay.clock + (now - last) * rate * speed);
      last = now;
      const { state: next, fired } = advanceReplay({ ...replay, marks }, events, clock);
      marks = next.marks;
      for (const f of fired) popup(f.e, f.attackerElement);
      replay = { ...replay, clock, idx: next.idx, hp: next.hp, elements: next.elements, attacker: next.attacker, target: next.target };
      if (clock >= seconds) return finish(lr, key, seconds);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  }

  $effect(() => {
    view.frame;
    const lr = game.state.tower.lastResult;
    const key = keyOf(lr);
    if (key === lastKey) return;
    const first = lastKey === null;
    lastKey = key;
    untrack(() => {
      if (!lr || !lr.fighters?.length) {
        replay = null;
        return;
      }
      // Opening the tab shows the last result; new fights are replayed.
      if (first) {
        const events = timedEvents(lr);
        replay = { key, ...finalState(lr), clock: fightSeconds(lr, events), end: fightSeconds(lr, events), idx: events.length, attacker: -1, target: -1, done: true };
      } else startReplay(lr, key);
    });
  });

  onDestroy(stopReplay);

  const SPEEDS: { v: ReplaySpeed; label: string; title: string }[] = [
    { v: 1, label: '1×', title: 'Normale Wiedergabe' },
    { v: 2, label: '2×', title: 'Doppelt so schnell' },
    { v: 0, label: '⏭', title: 'Wiedergabe überspringen – gleich das Ergebnis zeigen' },
  ];

  // ---- derived view data -------------------------------------------------

  // Team, candidates and floor column: the slow tick is enough (a fight takes seconds); the bar runs in `timing`.
  const data = $derived.by(() => {
    view.slowFrame;
    const tw = game.state.tower;
    const size = teamSize(game);
    const teamIds = tw.run?.team ?? tw.team;
    const team = teamIds.map((id) => findCreature(game, id)).filter((c): c is Creature => !!c);
    const cp = checkpoint(game);
    const current = tw.run?.floor ?? cp;
    const nextFloor = current + 1;
    const enemy = enemyFor(game, nextFloor);
    const group = enemiesFor(game, nextFloor);
    const top = nextFloor + 3;
    const floors = [];
    for (let f = top; f >= Math.max(1, nextFloor - 4); f--) {
      const info = floorRewardInfo(game, f);
      const trait = info.boss ? enemyFor(game, f).trait : undefined;
      floors.push({ f, ...info, trait: trait ? content.bossTraits.get(trait) : null, cleared: tw.run ? f <= tw.run.floor : f <= tw.best, next: f === nextFloor, best: f === tw.best && tw.best > 0 });
    }
    const candidates = [...game.state.creatures]
      .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
      .map((c) => {
        const el = content.species.get(c.speciesId).element;
        const stats = effectiveStats(game, c);
        return { c, power: creaturePower(game, c), spd: stats.spd ?? 0, role: roleOf(game, stats), inTeam: tw.team.includes(c.id), dealt: elementMultiplier(game, el, enemy.element), taken: elementMultiplier(game, enemy.element, el) };
      })
      .sort((a, b) => (invertSort ? -1 : 1) * ((sortBy === 'matchup' ? b.dealt / b.taken - a.dealt / a.taken : sortBy === 'speed' ? b.spd - a.spd : 0) || b.power - a.power))
      .slice(0, 40);
    return {
      tw,
      size,
      team,
      cp,
      restartCp: restartCheckpoint(game),
      current,
      nextFloor,
      enemy,
      boss: isBossFloor(game, nextFloor),
      guard: enemy.guard === true,
      // The column shows only a few floors around the team – the next boss may be far above.
      bossIn: floorsToBoss(game, nextFloor),
      trait: enemy.trait ? content.bossTraits.get(enemy.trait) : null,
      targeting: targetingOf(game, enemy),
      group,
      phase: enemy.boss ? (group.find((x) => x.boss)?.phaseTrait ?? null) : null,
      // Rows as data, so the Vorne/Hinten switches re-render with every change.
      rows: Object.fromEntries(team.map((c) => [c.id, rowOf(game, c.id)])) as Record<number, Row>,
      synergies: teamSynergies(game, team.map((c) => content.species.get(c.speciesId).element), enemy.trait),
      roles: Object.fromEntries(team.map((c) => [c.id, roleOf(game, effectiveStats(game, c))])) as Record<number, ReturnType<typeof roleOf>>,
      milestones: towerMilestones(game),
      veteran: veteranRank(game),
      resolve: resolveInfo(game),
      nextMilestone: nextMilestoneFloor(game),
      reward: floorRewardInfo(game, nextFloor),
      floors,
      aboveBest: tw.best > top,
      candidates,
      matchups: team.map((c) => {
        const el = content.species.get(c.speciesId).element;
        return { c, dealt: elementMultiplier(game, el, enemy.element), taken: elementMultiplier(game, enemy.element, el) };
      }),
      auto: game.state.features['towerAuto'] === true,
    };
  });

  /** Countdown and bar to the next fight (fast tick). */
  const timing = $derived.by(() => {
    view.frame;
    const run = game.state.tower.run;
    const interval = fightIntervalMs(game);
    return { nextFightIn: run ? interval - run.elapsedMs : 0, progress: run ? Math.min(1, run.elapsedMs / interval) : 0 };
  });

  /** What the arena shows: the (replayed) last fight, or a preview of the next floor. */
  const arena = $derived.by(() => {
    view.frame;
    const lr = data.tw.lastResult;
    const showFight = !!replay && !!lr?.fighters?.length && replay.key === keyOf(lr) && (!replay.done || !!banner);
    if (showFight && lr?.fighters && replay) {
      const ids = lr.fighters.filter((f) => f.team).map((_, i) => data.tw.run?.team[i] ?? data.tw.team[i]);
      const units: Unit[] = lr.fighters.map((f, i) => {
        const c = f.team && ids[i] !== undefined ? findCreature(game, ids[i]!) : undefined;
        return { ...f, creature: c && c.speciesId === f.speciesId ? c : null };
      });
      const units2 = units.map((u, i) => ({ ...u, element: replay!.elements[i] ?? u.element }));
      return { mode: 'fight' as const, floor: lr.floor, units: units2, hp: replay.hp, intervals: intervalsOf(lr), clock: replay.clock, end: replay.end };
    }
    const units: Unit[] = [
      ...data.team.map((c) => ({ name: c.name, speciesId: c.speciesId, element: content.species.get(c.speciesId).element, maxHp: 1, team: true, creature: c, row: rowOf(game, c.id) })),
      ...data.group.map((e) => ({ name: e.name, speciesId: e.speciesId, element: e.element, maxHp: e.maxHp, team: false, creature: null, row: e.row, boss: e.boss })),
    ];
    // Preview: the same relative time line the next fight will use.
    const intervals = actionIntervals(game, [...data.team.map((c) => fighterFor(game, c)), ...data.group]);
    return { mode: 'preview' as const, floor: data.nextFloor, units, hp: units.map((u) => u.maxHp), intervals, clock: 0, end: 0 };
  });

  const order = $derived.by(() => {
    const alive = arena.units.map((_, i) => (arena.hp[i] ?? 1) > 0);
    return upcomingActions(arena.intervals, alive, arena.clock, 8);
  });
  const teamUnits = $derived(arena.units.map((u, i) => ({ u, i })).filter((x) => x.u.team));
  /** Team in two lines: the back row stands further from the enemy. */
  const backUnits = $derived(teamUnits.filter((x) => x.u.row === 'back'));
  const frontUnits = $derived(teamUnits.filter((x) => x.u.row !== 'back'));
  /** Foes: companions in front (towards the team), the boss behind them. */
  const foeUnits = $derived(arena.units.map((u, i) => ({ u, i })).filter((x) => !x.u.team));
  const foeFront = $derived(foeUnits.filter((x) => x.u.row !== 'back'));
  const foeBack = $derived(foeUnits.filter((x) => x.u.row === 'back'));

  function look(u: Unit) {
    return u.creature ? expressedAppearance(game, u.creature) : { ...neutral, hue: content.species.get(u.speciesId).hue };
  }
  function toggle(id: number) {
    const current = game.state.tower.team;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    act(setTeam(game, next));
  }
  async function stop() {
    if (await ask('Lauf beenden? Er wird in der Bestenliste eingetragen.', { ok: 'Beenden', danger: true })) act(stopRun(game));
  }
  /** „+15 % Turm-Schaden, +10 % Nahrung-Ertrag …“ – straight from the balance numbers. */
  const MILESTONE_BONUS = game.balance.tower.milestoneModifiers.map((m) => describeModifier(game, m)).join(', ');
  const TARGETING = {
    rows: `Greift zu ${formatPercent(game.balance.tower.frontShare, 0)} die vordere Reihe an (wenn beide Reihen besetzt sind).`,
    back: `Greift zu ${formatPercent(game.balance.tower.frontShare, 0)} die hintere Reihe an – schütze deine Angreifer anders.`,
    weakest: 'Jagt immer das Teammitglied mit den wenigsten KP – Reihen schützen nicht.',
  } as const;
  /** Status symbols in the arena. */
  const STATUS: Record<string, { icon: string; name: string; harmful: boolean }> = STATUS_INFO;

  /** Why the latest run was lost (until a later run gets past that floor). */
  const defeat = $derived.by(() => {
    view.slowFrame;
    return currentDefeat(game);
  });
  let logOpen = $state(false);
  /** Icon protocol of the last fight – built only while the protocol is open. */
  const protocol = $derived.by(() => {
    view.slowFrame;
    const lr = game.state.tower.lastResult;
    if (!logOpen || !lr?.fighters?.length) return [];
    const all = fightProtocol(game, lr);
    return viewState.tower.logImportant ? all.filter((p) => p.important) : all;
  });
  /** Statuses of a fighter still running at the replay clock. */
  const activeMarks = (i: number) => (arena.mode === 'fight' ? Object.entries(marks[i] ?? {}).filter(([, until]) => until > arena.clock).map(([id]) => STATUS[id]).filter((x) => !!x) : []);
  const mult = (m: number) => `×${formatNumber(m, { decimals: 1 })}`;
  const el = (id: string) => content.elements.get(id);
</script>

{#snippet who(f: { name: string; element: string; team: boolean } | undefined)}
  {#if f}<span class="who" class:foe={!f.team} style="--el: {el(f.element).color}" title="{f.team ? 'Team' : 'Gegner'}: {f.name}">{f.name}</span>{/if}
{/snippet}

{#snippet unit(u: Unit, i: number, big: boolean)}
  {@const species = content.species.get(u.speciesId)}
  {@const hp = arena.hp[i] ?? u.maxHp}
  {@const pct = arena.mode === 'preview' ? 1 : Math.max(0, hp / u.maxHp)}
  {@const iv = arena.intervals[i] ?? 1}
  {@const fighting = arena.mode === 'fight' && !replay?.done}
  {@const fill = fighting && hp > 0 ? gauge(arena.clock, iv) : 0}
  <div
    class="unit"
    class:big
    class:foe={!u.team}
    class:lunge={arena.mode === 'fight' && replay?.attacker === i}
    class:hit={arena.mode === 'fight' && replay?.target === i}
    class:ko={arena.mode === 'fight' && hp <= 0}
    style="--el: {el(u.element).color}"
  >
    <div class="art">
      {#if !u.team && (u.boss ?? (foeUnits.length === 1 && isBossFloor(game, arena.floor)))}<span class="crown">👑</span>{/if}
      <span class="platform" aria-hidden="true"></span>
      <CreatureSvg appearance={look(u)} shape={species.shape} tier={species.tier} size={big ? 104 : 60} shiny={u.creature?.shiny ?? false} />
      {#each sparks.filter((p) => p.t === i) as p (p.id)}<span class="spark" style="--sc: {p.color}" aria-hidden="true"></span>{/each}
      {#each popups.filter((p) => p.t === i) as p (p.id)}
        <span class="pop {p.kind}" style="--dx: {((p.id % 3) - 1) * 26}px; --dy: {(p.id % 2) * 12}px">{p.text}</span>
      {/each}
    </div>
    <span class="uname" title={u.name}>{u.name}</span>
    {#if activeMarks(i).length}
      <span class="marks">{#each activeMarks(i) as m (m.name)}<span class="mark" class:bad={m.harmful} title={m.name}>{m.icon}</span>{/each}</span>
    {/if}
    <div class="hpbar" title="Lebenspunkte" use:meter={pct}><div style="width: {pct * 100}%" class:low={pct < 0.3}></div></div>
    <div class="atbrow" title="Aktionsleiste: handelt alle {formatNumber(iv, { decimals: 2 })} s Kampfzeit">
      <div class="atb" class:idle={!fighting} class:ready={fill > 0.8}>
        {#if fighting}
          <div style="width: {fill * 100}%"></div>
        {:else if arena.mode === 'preview'}
          <div class="loop" style="animation-duration: {(iv * REPLAY_MS_PER_SEC) / 1000}s"></div>
        {/if}
      </div>
      <span class="eta num">{fighting ? (hp > 0 ? formatNumber(iv - (arena.clock % iv), { decimals: 1 }) : '–') : `${formatNumber(iv, { decimals: 1 })} s`}</span>
    </div>
    {#if !u.team}
      <!-- Small group foes only show what is left, so the line fits. -->
      <span class="small muted num kp">{arena.mode === 'fight' ? `${formatNumber(Math.max(0, hp))}${big ? ` / ${formatNumber(u.maxHp)}` : ''}` : formatNumber(u.maxHp)} KP</span>
    {/if}
  </div>
{/snippet}

<header class="tab-head">
  <h2>🗼 Genom-Turm</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{data.tw.best}</b><small>Rekord</small></span>
    <span class="kpi"><b class="num">🚩 {data.cp}</b><small>Checkpoint</small></span>
    <span class="kpi" class:live={!!data.tw.run}><b class="num">{data.tw.run ? data.tw.run.floor : '–'}</b><small>{data.tw.run ? 'Aktueller Lauf' : 'Kein Lauf'}</small></span>
    <span class="kpi"><b class="num">🗼 {formatNumber(game.state.resources['towerTokens'] ?? 0)}</b><small>Turm-Marken</small></span>
    <span class="kpi veteran" title="Kampferfahrung: Jede gewonnene Etage bringt Erfahrung – je höher, desto mehr, ein Boss {game.balance.tower.xpBossMult}-mal so viel. Sie bleibt bei jeder Vererbung und jedem Äon. Je Rang +{formatPercent(game.balance.tower.xpRankBonus, 0)} KP und Schaden im Turm und gegen den Wochen-Boss – jetzt +{formatPercent(data.veteran.bonus, 0)}. Noch {formatNumber(Math.ceil(data.veteran.need - data.veteran.into))} bis Rang {data.veteran.rank + 1}.">
      <b class="num">🎖 {data.veteran.rank}</b><small>Rang · +{formatPercent(data.veteran.bonus, 0)}</small>
      <span class="xpbar" use:meter={(data.veteran.into / data.veteran.need)}><span style="width: {Math.min(100, (data.veteran.into / data.veteran.need) * 100)}%"></span></span>
    </span>
    {#if data.resolve.bonus > 0}
      <span class="kpi resolve" title="Entschlossenheit: Seit {formatDuration(data.resolve.hours * 3_600_000)} kein neuer Rekord – dein Team beißt sich fest: je Tag +{formatPercent(game.balance.tower.resolvePerDay, 0)} KP und Schaden im Turm, höchstens +{formatPercent(game.balance.tower.resolveCap, 0)}. Ein neuer Rekord setzt sie zurück.">
        <b class="num">💪 +{formatPercent(data.resolve.bonus, 0)}</b><small>Entschlossenheit</small>
      </span>
    {/if}
    <span class="kpi" title="Alle {game.balance.tower.milestoneEvery} Etagen: einmalig {game.balance.tower.milestoneShards} Äon-Splitter und dauerhaft {MILESTONE_BONUS}"><b class="num">🏅 {data.milestones}</b><small>Meilensteine · nächster {data.nextMilestone}</small></span>
  </div>
</header>

{#if game.state.features['weeklyBoss']}<WeeklyBossPanel />{/if}

<div class="stage">
  <!-- Tower column -->
  <TowerFloors floors={data.floors} aboveBest={data.aboveBest} best={data.tw.best} team={data.team} boss={data.boss} bossIn={data.bossIn} />

  <!-- Arena -->
  <section class="arena panel" style="--foe: {el(data.enemy.element).color}">
    <div class="arena-head">
      <span class="floor-tag" class:boss={isBossFloor(game, arena.floor)}>Etage <b class="num">{arena.floor}</b></span>
      <span class="small muted">
        {#if arena.mode === 'fight'}
          {replay && !replay.done ? 'Kampf läuft …' : data.tw.lastResult?.win ? 'Gewonnen' : 'Verloren'}
        {:else if data.tw.run}
          Nächster Gegner
        {:else}
          Vorschau – starte einen Lauf
        {/if}
      </span>
      {#if arena.mode === 'fight'}
        <span class="clock num" title="Kampfzeit – kein Zeitlimit, aber ab {game.balance.tower.enrageAfterSec} s werden die Gegner wütend: jede Sekunde +{formatPercent(game.balance.tower.enrageGrowth, 0)} Schaden">⏱ {formatNumber(arena.clock, { decimals: 1 })} s{#if arena.clock > game.balance.tower.enrageAfterSec}<span class="wut"> 😡 ×{formatNumber(enrageFactor(game, arena.clock), { decimals: 1 })}</span>{/if}</span>
      {/if}
      <span class="speed" role="radiogroup" aria-label="Tempo der Wiedergabe">
        {#each SPEEDS as s (s.v)}
          <button role="radio" aria-checked={viewState.tower.replaySpeed === s.v} class:on={viewState.tower.replaySpeed === s.v} title={s.title} onclick={() => (viewState.tower.replaySpeed = s.v)}>{s.label}</button>
        {/each}
      </span>
    </div>
    {#if order.length}
      <div class="turns" aria-label="Zugfolge">
        <span class="small muted">Zugfolge</span>
        {#each order as o, k (`${o.i}-${o.at}`)}
          {@const u = arena.units[o.i]}
          {#if u}
            {@const sp = content.species.get(u.speciesId)}
            <span class="turn" class:foe={!u.team} class:now={k === 0} style="--el: {el(u.element).color}" title="{u.name} · {formatNumber(o.at, { decimals: 1 })} s">
              <CreatureSvg appearance={look(u)} shape={sp.shape} tier={sp.tier} size={22} />
            </span>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="field" class:shake>
      <div class="side team" class:rows={backUnits.length > 0 && frontUnits.length > 0}>
        {#if teamUnits.length === 0}
          <p class="muted small empty">Kein Team gewählt</p>
        {:else}
          {#if backUnits.length}
            <div class="line back" title="Hintere Reihe – wird seltener angegriffen">
              {#each backUnits as { u, i } (i)}{@render unit(u, i, false)}{/each}
            </div>
          {/if}
          {#if frontUnits.length}
            <div class="line front" title="Vordere Reihe – steckt die meisten Treffer ein">
              {#each frontUnits as { u, i } (i)}{@render unit(u, i, false)}{/each}
            </div>
          {/if}
        {/if}
      </div>

      <div class="vs">
        {#if data.tw.run && arena.mode === 'preview'}
          <svg viewBox="0 0 72 72" width="72" height="72" class="ring">
            <circle cx="36" cy="36" r="30" class="track" />
            <circle cx="36" cy="36" r="30" class="fill" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - timing.progress)} />
          </svg>
          <span class="count num">{formatDuration(timing.nextFightIn)}</span>
        {:else}
          <span class="vs-txt">VS</span>
        {/if}
      </div>

      <div class="side foes" class:rows={foeFront.length > 0 && foeBack.length > 0}>
        {#if foeFront.length}
          <div class="line">
            {#each foeFront as { u, i } (i)}{@render unit(u, i, foeUnits.length === 1)}{/each}
          </div>
        {/if}
        {#if foeBack.length}
          <div class="line">
            {#each foeBack as { u, i } (i)}{@render unit(u, i, true)}{/each}
          </div>
        {/if}
      </div>

      {#if banner}
        <div class="banner" class:win={banner.win} transition:scale={{ duration: 250, start: 0.6 }}>
          {banner.win ? `Etage ${banner.floor} geschafft!` : `Niederlage auf Etage ${banner.floor}`}
          <small class="num">nach {formatNumber(banner.seconds, { decimals: 1 })} s</small>
        </div>
      {/if}
    </div>

    {#if arena.mode === 'preview'}
      <div class="enemy-stats">
        <span class="elchip" style="--c: {el(data.enemy.element).color}">{el(data.enemy.element).name}</span>
        <span class="num small">❤ {formatNumber(data.enemy.hp)}</span>
        <span class="num small">⚔ {formatNumber(data.enemy.atk)}</span>
        <span class="num small">🛡 {formatNumber(data.enemy.def)}</span>
        <span class="num small">💨 {formatNumber(data.enemy.spd)}</span>
      </div>
      {#if data.trait}
        <p class="trait small"><b>{data.trait.icon} {data.trait.name}:</b> {data.trait.description}</p>
      {/if}
      {#if data.guard}
        <p class="trait small guard">🛡️ <b>Wächter-Etage:</b> die Gegner sind stärker – etwa wie drei Etagen weiter oben. Kein Checkpoint.</p>
      {/if}
      {#if data.phase && content.bossTraits.has(data.phase)}
        {@const ph = content.bossTraits.get(data.phase)}
        <p class="trait small phase"><b>Phase 2 unter {formatPercent(game.balance.tower.phaseAt, 0)} KP – {ph.icon} {ph.name}:</b> {ph.description}</p>
      {/if}
      {#if data.group.length > 1}
        <p class="small group">👥 {data.group.length} Gegner{data.group.some((x) => x.boss) ? ' – die Begleiter stehen vor dem Boss, dein Team greift zuerst sie an' : ' teilen sich die Stärke der Etage – dein Team nimmt sich den schwächsten zuerst vor'}.</p>
      {/if}
      <p class="aim small">🎯 {TARGETING[data.targeting]}</p>
      {#if data.matchups.length}
        <div class="matchups">
          {#each data.matchups as m (m.c.id)}
            <span class="mu" title="Schaden an {data.enemy.name} / erlittener Schaden">
              <span class="dot" style="background: {el(content.species.get(m.c.speciesId).element).color}"></span>
              {m.c.name}
              <b class:good={m.dealt > 1} class:bad={m.dealt < 1}>⚔ {mult(m.dealt)}</b>
              <b class:good={m.taken < 1} class:bad={m.taken > 1}>🛡 {mult(m.taken)}</b>
            </span>
          {/each}
        </div>
      {/if}
    {/if}

    <div class="rewards">
      <span class="small muted">Belohnung Etage {data.nextFloor}:</span>
      <span class="rw">🗼 {formatNumber(data.reward.tokens)}</span>
      {#if data.reward.catalyst}<span class="rw pink">💎 {data.reward.catalyst}</span>{/if}
      {#if data.reward.allele}<span class="rw teal">🧬 seltenes Allel</span>{/if}
      {#if data.reward.checkpoint}<span class="rw gold">🚩 Checkpoint</span>{/if}
      {#if data.reward.milestone && data.nextFloor > data.tw.best}<span class="rw gold">🏅 Meilenstein: +{game.balance.tower.milestoneShards} ⏳</span>{/if}
    </div>

    <div class="controls">
      {#if data.tw.run}
        <span class="small muted">Gestartet ab Etage {data.tw.run.startFloor} · Kampf alle {fightIntervalMs(game) / 1000} s</span>
        <button class="danger" onclick={stop}>Lauf beenden</button>
      {:else}
        <button class="primary go" disabled={data.team.length === 0} onclick={() => act(startRun(game, true))}>▶ Start ab Etage {data.cp + 1}</button>
        {#if data.cp > 0}<button disabled={data.team.length === 0} onclick={() => act(startRun(game, false))}>Ab Etage 1</button>{/if}
      {/if}
      {#if data.auto}
        <label class="small auto"><input type="checkbox" checked={data.tw.autoRestart} onchange={(e) => act(setTowerAutoRestart(game, e.currentTarget.checked))} /> Auto-Neustart <span class="muted" title="Startet wie dein letzter Lauf – ab dem Checkpoint oder ab Etage 1. Verliert ein Lauf gleich die erste Etage, beginnt der nächste einen Checkpoint tiefer; ein geschaffter Checkpoint holt ihn wieder hoch.">ab Etage {data.tw.restartFromCheckpoint ? data.restartCp + 1 : 1}</span></label>
      {/if}
    </div>

    {#if defeat}
      <details class="defeat" bind:open={viewState.tower.defeatOpen}>
        <summary>
          <b>Warum verloren?</b>
          <span class="small muted">Etage {defeat.floor} · {defeat.timeout ? 'Patt – abgebrochen' : `Team besiegt nach ${formatNumber(defeat.seconds, { decimals: 1 })} s`}</span>
        </summary>
        <div class="foehp" title="KP der Gegner am Ende des Kampfes">
          <span class="small muted">Gegner-KP übrig</span>
          <div class="bar" use:meter={defeat.foeHpLeft}><div style="width: {defeat.foeHpLeft * 100}%"></div></div>
          <b class="num small">{formatPercent(defeat.foeHpLeft, 0)}</b>
        </div>
        <ul class="reasons">
          {#each defeat.reasons as r (r.id)}
            <li>
              <span class="ricon">{r.icon}</span>
              <div>
                <b>{r.title}</b>
                <p class="small">{r.text}</p>
                <p class="small tip">💡 {r.tip}</p>
              </div>
            </li>
          {/each}
        </ul>
        <div class="members">
          {#each defeat.members as m (m.index)}
            <span class="member" class:down={m.downAt >= 0} style="--el: {el(m.element).color}">
              <span class="mname" title={m.name}>{m.name}</span>
              <span class="num small" title="Ausgeteilter Schaden">⚔ {formatNumber(m.dealt)}</span>
              <span class="num small muted" title="Eingesteckter Schaden">🩸 {formatNumber(m.taken)}</span>
              <span class="small muted">{m.downAt >= 0 ? `💀 ${formatNumber(m.downAt, { decimals: 1 })} s` : 'hielt durch'}</span>
            </span>
          {/each}
        </div>
      </details>
    {/if}

    {#if data.tw.lastResult}
      {@const lr = data.tw.lastResult}
      <details class="log" bind:open={logOpen}>
        <summary class="small muted">Kampfprotokoll · Etage {lr.floor} {lr.win ? '✅' : '❌'}</summary>
        {#if logOpen}
          {#if lr.fighters?.length}
            <label class="small muted only"><input type="checkbox" bind:checked={viewState.tower.logImportant} /> Nur Wichtiges</label>
            <ol class="proto">
              {#each protocol as p, k (k)}
                <li class={p.tone}>
                  <span class="at num">{formatNumber(p.at, { decimals: 1 })} s</span>
                  {#if p.a >= 0}{@render who(lr.fighters?.[p.a])}{/if}
                  <span class="pic">{p.icon}</span>
                  {#if p.t >= 0}{@render who(lr.fighters?.[p.t])}{/if}
                  <span class="ptx">{p.text}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <ul class="oldlog">{#each lr.log as line, i (i)}<li>{line}</li>{/each}</ul>
          {/if}
        {/if}
      </details>
    {/if}
  </section>
</div>

<!-- Team -->
<article class="panel team-panel">
  <div class="team-head">
    <h3>Team <span class="muted num">{data.team.length}/{data.size}</span></h3>
    <span class="small muted">{data.tw.run ? 'Während eines Laufs gesperrt.' : 'Teammitglieder können während eines Laufs nicht arbeiten oder brüten.'}</span>
  </div>
  {#if data.synergies.length}
    <div class="synergies">
      {#each data.synergies as syn, k (k)}
        {#if syn.kind === 'pair'}
          <span class="syn on" style="--c: {el(syn.elements[0]!).color}" title="Zwei oder mehr {el(syn.elements[0]!).name}-Kreaturen: +{formatPercent(syn.value, 0)} Angriff für sie">
            🤝 {el(syn.elements[0]!).name}-Paar · +{formatPercent(syn.value, 0)} ANG
          </span>
        {:else}
          <span class="syn" class:on={syn.active} title="Drei verschiedene Elemente: +{formatPercent(syn.value, 0)} Schaden gegen den Wandler">
            🌈 Vielfalt · +{formatPercent(syn.value, 0)} gegen den Wandler{syn.active ? '' : ' (nicht auf dieser Etage)'}
          </span>
        {/if}
      {/each}
    </div>
  {/if}
  <div class="sockets">
    {#each Array.from({ length: MAX_SLOTS }, (_, i) => i) as i (i)}
      {@const c = data.team[i]}
      {#if i >= data.size}
        <div class="socket locked" title="Weitere Plätze über Äon-Talente">🔒</div>
      {:else if c}
        {@const sp = content.species.get(c.speciesId)}
        {@const role = ROLE_INFO[data.roles[c.id] ?? 'tank']}
        {@const row = data.rows[c.id] ?? 'front'}
        {@const tech = techniqueFor(game, sp.element)}
        <div class="socket filled" class:back={row === 'back'} style="--el: {el(sp.element).color}">
          <span class="role" title="{role.name}: {role.hint}">{role.icon}</span>
          <CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={52} shiny={c.shiny} />
          <span class="sname">{c.name}</span>
          <span class="small num muted">Σ {formatNumber(creaturePower(game, c))}</span>
          {#if tech}<span class="stech" title="{tech.name}: {tech.description} (jede {game.balance.tower.techniqueEvery}. Aktion)">{tech.icon} {tech.name}</span>{/if}
          <span class="rowseg" role="group" aria-label="Reihe">
            <button class:on={row === 'front'} disabled={!!data.tw.run} title="Vordere Reihe: steckt die meisten Treffer ein" onclick={() => act(setRow(game, c.id, 'front'))}>Vorne</button>
            <button class:on={row === 'back'} disabled={!!data.tw.run} title="Hintere Reihe: wird seltener angegriffen" onclick={() => act(setRow(game, c.id, 'back'))}>Hinten</button>
          </span>
          {#if !data.tw.run}<button class="x" title="Aus dem Team nehmen" onclick={() => toggle(c.id)}>×</button>{/if}
        </div>
      {:else}
        <div class="socket empty-slot">+</div>
      {/if}
    {/each}
  </div>

  {#if !data.tw.run}
    <div class="team-head">
      <h3>Kandidaten</h3>
      <div class="sorting">
        <div class="seg">
          <button class:on={sortBy === 'power'} onclick={() => (sortBy = 'power')}>Stärke</button>
          <button class:on={sortBy === 'matchup'} onclick={() => (sortBy = 'matchup')}>Vorteil vs. {el(data.enemy.element).name}</button>
          <button class:on={sortBy === 'speed'} onclick={() => (sortBy = 'speed')} title="Schnelle Kreaturen handeln öfter und weichen langsameren Gegnern aus">Tempo</button>
        </div>
        <SortToggle bind:inverted={invertSort} />
      </div>
    </div>
    <div class="tiles">
      {#each data.candidates as t (t.c.id)}
        {@const sp = content.species.get(t.c.speciesId)}
        <button
          class="tile"
          class:on={t.inTeam}
          disabled={!t.inTeam && data.team.length >= data.size}
          style="--el: {el(sp.element).color}; --rc: {content.rarities.get(t.c.rarity).color}"
          title="{t.c.name} · {el(sp.element).name} · {content.rarities.get(t.c.rarity).name}"
          onclick={() => toggle(t.c.id)}
        >
          <CreatureSvg appearance={expressedAppearance(game, t.c)} shape={sp.shape} tier={sp.tier} size={44} shiny={t.c.shiny} />
          <span class="tname">{t.c.name}</span>
          <span class="num small muted">{sortBy === 'speed' ? `💨 ${formatNumber(t.spd)}` : `Σ ${formatNumber(t.power)}`}</span>
          {#if t.dealt > 1}<span class="adv good">▲</span>{:else if t.dealt < 1}<span class="adv bad">▼</span>{/if}
          <span class="trole" title={ROLE_INFO[t.role].name}>{ROLE_INFO[t.role].icon}</span>
        </button>
      {:else}
        <p class="muted small">Keine freien Kreaturen.</p>
      {/each}
    </div>
  {/if}
</article>

<RelicPanel />

<TowerBoard />

<style>
  .small { font-size: 0.8rem; }
  .good { color: var(--teal); }
  .bad { color: var(--danger); }


  .stage { display: grid; grid-template-columns: 11rem 1fr; gap: 0.75rem; align-items: start; }

  /* Tower column */
  .tower { display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 0.6rem 0.6rem 0; }
  .roof { height: 26px; margin: 0 10%; background: linear-gradient(180deg, var(--violet), var(--petrol)); clip-path: polygon(50% 0, 100% 100%, 0 100%); opacity: 0.85; }
  .floor {
    position: relative; display: flex; align-items: center; gap: 0.35rem; min-height: 32px; padding: 0 0.45rem;
    border: 1px solid var(--line); border-radius: 6px; background: repeating-linear-gradient(90deg, var(--bg-2) 0 18px, var(--panel-2) 18px 20px);
    color: var(--muted); font-size: 0.8rem;
  }
  .floor.ghost { background: none; border-style: dashed; justify-content: center; }
  .floor.cleared { color: var(--text); background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--teal) 10%, var(--bg-2)) 0 18px, var(--panel-2) 18px 20px); }
  .floor.boss { border-color: color-mix(in srgb, var(--danger) 60%, var(--line)); }
  .floor.guard { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
  .bossin { margin: 0.35rem 0 0; text-align: center; }
  .wut { color: var(--danger); font-weight: 700; }
  .veteran { gap: 0.1rem; }
  .xpbar { width: 100%; height: 3px; border-radius: 99px; background: var(--bg); overflow: hidden; }
  .xpbar span { display: block; height: 100%; background: var(--gold); }
  .trait.guard { border-color: color-mix(in srgb, var(--gold) 55%, var(--line)); background: color-mix(in srgb, var(--gold) 8%, transparent); }
  .floor.next { border: 2px solid var(--gold); color: var(--text); animation: glow 1.6s ease-in-out infinite; }
  .floor.best::after { content: ''; position: absolute; left: -4px; right: -4px; top: -3px; border-top: 2px dashed var(--gold); }
  .fnum { font-weight: 700; min-width: 1.8rem; }
  .icons { display: flex; gap: 1px; font-size: 0.8rem; }
  .check { margin-left: auto; color: var(--teal); font-weight: 800; }
  .squad { margin-left: auto; display: flex; }
  .squad :global(svg) { margin-left: -6px; }
  .rec { position: absolute; right: 4px; top: -10px; font-size: 0.6rem; color: var(--gold); background: var(--panel); padding: 0 3px; border-radius: 4px; }
  .base { height: 8px; margin: 0 -0.6rem; background: linear-gradient(90deg, transparent, var(--line), transparent); }
  @keyframes glow { 50% { box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 53%, transparent); } }

  /* Arena */
  .arena {
    position: relative; overflow: hidden;
    background:
      radial-gradient(ellipse at 75% 40%, color-mix(in srgb, var(--foe) 20%, transparent), transparent 55%),
      radial-gradient(ellipse at 25% 40%, color-mix(in srgb, var(--teal) 10%, transparent), transparent 50%),
      linear-gradient(180deg, #0b1d24, var(--panel) 70%);
  }
  .arena-head { display: flex; align-items: center; gap: 0.6rem; }
  .clock { margin-left: auto; font-weight: 700; font-size: 0.85rem; padding: 0.1rem 0.5rem; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); }
  .speed { display: inline-flex; margin-left: auto; border: 1px solid var(--line); border-radius: 99px; overflow: hidden; }
  .clock ~ .speed { margin-left: 0; }
  .speed button { border: 0; border-radius: 0; padding: 0.1rem 0.45rem; font-size: 0.75rem; background: var(--bg-2); }
  .speed button.on { background: var(--petrol); color: #fff; }
  .turns { display: flex; align-items: center; gap: 0.25rem; margin-top: 0.45rem; padding: 0.2rem 0.4rem; border-radius: 99px; background: #0006; border: 1px solid var(--line); overflow: hidden; }
  .turns > .small { margin-right: 0.25rem; white-space: nowrap; }
  .turn { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--el) 70%, transparent); background: color-mix(in srgb, var(--el) 20%, var(--bg-2)); transition: transform 0.2s; }
  .turn.foe { border-color: var(--danger); }
  .turn.foe :global(svg) { transform: scaleX(-1); }
  .turn.now { transform: scale(1.18); box-shadow: 0 0 8px var(--el); }
  .floor-tag { padding: 0.15rem 0.6rem; border-radius: 99px; border: 1px solid var(--line); background: var(--bg-2); }
  .floor-tag.boss { border-color: var(--danger); color: var(--danger); box-shadow: 0 0 10px #ff6b6b55; }
  .field { position: relative; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem; min-height: 14rem; padding: 0.75rem 0; }
  /* Arena floor in perspective behind the fighters. */
  .field::before {
    content: ''; position: absolute; left: -2rem; right: -2rem; bottom: 0; height: 55%; z-index: 0; pointer-events: none;
    background:
      repeating-linear-gradient(90deg, color-mix(in srgb, var(--teal) 8%, transparent) 0 1px, transparent 1px 48px),
      repeating-linear-gradient(0deg, color-mix(in srgb, var(--teal) 8%, transparent) 0 1px, transparent 1px 22px),
      radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--foe) 14%, transparent), transparent 70%);
    transform: perspective(300px) rotateX(55deg); transform-origin: 50% 100%;
    mask-image: linear-gradient(180deg, transparent, #000 40%);
  }
  .field > * { position: relative; z-index: 1; }
  .field.shake { animation: quake 0.26s; }
  @keyframes quake { 25% { transform: translate(-3px, 1px); } 50% { transform: translate(3px, -1px); } 75% { transform: translate(-2px, 0); } }
  .side { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
  .side.team { justify-content: flex-end; }
  .side.foes { display: flex; flex-direction: row; justify-content: center; align-items: center; gap: 0.6rem; }
  .side.foes .line { flex-direction: column; }
  .side.foes:not(.rows) .line { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .group { margin: 0.3rem 0 0; color: var(--muted); }
  .trait.phase { border-style: dashed; }
  .side.team.rows { display: grid; grid-template-columns: auto auto; justify-content: end; align-items: center; gap: 0.6rem; }
  .line { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
  .line.back { flex-direction: column; opacity: 0.92; }
  .line.back :global(.unit) { transform: scale(0.9); }
  .line.front { flex-direction: column; }
  .side.team:not(.rows) .line { flex-direction: row; }
  .empty { align-self: center; }

  .unit { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.15rem; width: 5.2rem; transition: transform 0.15s, opacity 0.4s, filter 0.4s; }
  .unit.big { width: 8.5rem; }
  .art { position: relative; display: grid; place-items: center; }
  .art :global(svg) { position: relative; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--el) 28%, transparent), transparent 70%); }
  .platform { position: absolute; bottom: -6px; left: 8%; right: 8%; height: 14px; border-radius: 50%; background: radial-gradient(ellipse, color-mix(in srgb, var(--el) 45%, transparent), transparent 70%); filter: blur(1px); }
  .unit.big .platform { box-shadow: 0 0 24px color-mix(in srgb, var(--el) 35%, transparent); }
  .spark { position: absolute; inset: 15%; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, #fff 0 10%, var(--sc) 25%, transparent 60%); animation: spark 0.4s ease-out forwards; }
  @keyframes spark { from { transform: scale(0.3) rotate(0deg); opacity: 1; } to { transform: scale(1.5) rotate(40deg); opacity: 0; } }
  .unit.foe .art :global(svg) { transform: scaleX(-1); }
  .unit.lunge { transform: translateX(10px) scale(1.06); }
  .unit.foe.lunge { transform: translateX(-12px) scale(1.06); }
  .unit.hit .art { animation: shake 0.3s; }
  .unit.hit .art :global(svg) { filter: drop-shadow(0 0 8px #ff6b6b); }
  .unit.ko { opacity: 0.35; filter: grayscale(1); }
  .crown { position: absolute; top: -14px; font-size: 1.3rem; z-index: 1; filter: drop-shadow(0 2px 3px #000); }
  .uname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .unit.big .uname { font-weight: 700; font-size: 0.85rem; }
  .hpbar { width: 100%; height: 6px; border-radius: 99px; background: var(--bg-2); overflow: hidden; border: 1px solid var(--line); }
  .hpbar div { height: 100%; background: linear-gradient(90deg, var(--petrol), var(--teal)); transition: width 0.25s; }
  .hpbar div.low { background: linear-gradient(90deg, #a33, var(--danger)); }
  .atbrow { display: flex; align-items: center; gap: 0.25rem; width: 100%; }
  .atb { flex: 1; height: 6px; border-radius: 99px; background: #0009; overflow: hidden; border: 1px solid #ffffff14; }
  .atb div { height: 100%; border-radius: 99px; background: linear-gradient(90deg, color-mix(in srgb, var(--gold) 45%, transparent), var(--gold)); }
  .atb.ready { box-shadow: 0 0 8px color-mix(in srgb, var(--gold) 70%, transparent); }
  .atb.ready div { background: linear-gradient(90deg, var(--gold), #fff6c9); }
  .eta { min-width: 1.9rem; font-size: 0.62rem; color: var(--gold); text-align: right; }
  .atb .loop { width: 100%; transform-origin: 0 50%; animation: fill linear infinite; }
  .atb.idle:not(:has(.loop)) { opacity: 0.4; }
  @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .kp { white-space: nowrap; }
  .pop { position: absolute; top: 8%; z-index: 2; font-weight: 800; color: #fff; white-space: nowrap; text-shadow: 0 2px 4px #000; animation: rise 1s ease-out forwards; pointer-events: none; }
  .pop.crit { color: var(--gold); font-size: 1.05rem; }
  .pop.weak { color: var(--muted); font-size: 0.8rem; }
  .pop.miss { color: var(--teal); font-style: italic; font-size: 0.85rem; }
  .pop.heal { color: #7dff9a; }
  .pop.tech { color: #fff; font-size: 0.85rem; background: color-mix(in srgb, var(--el) 55%, #000a); border: 1px solid var(--el); border-radius: 99px; padding: 0 0.45rem; top: -6px; }
  .pop.critHit { color: #ff9f43; font-size: 1.05rem; }
  .pop.dot { color: #ffb36b; font-size: 0.8rem; }
  .pop.reflect { color: #d7a7ff; font-size: 0.8rem; }
  .pop.status { font-size: 1.1rem; }
  .marks { display: flex; gap: 1px; font-size: 0.8rem; line-height: 1; min-height: 1rem; }
  .mark { padding: 0 1px; border-radius: 4px; background: #0007; }
  .mark.bad { background: color-mix(in srgb, var(--danger) 30%, #0008); }
  .pop.shift { color: var(--el); font-size: 0.85rem; border: 1px solid var(--el); border-radius: 99px; padding: 0 0.4rem; background: #000a; }
  @keyframes rise { from { transform: translate(var(--dx, 0), var(--dy, 0)); opacity: 1; } to { transform: translate(var(--dx, 0), calc(var(--dy, 0) - 38px)); opacity: 0; } }
  @keyframes shake { 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }

  .vs { position: relative; display: grid; place-items: center; width: 72px; height: 72px; }
  .vs-txt { font-weight: 900; font-size: 1.4rem; color: var(--gold); text-shadow: 0 0 10px color-mix(in srgb, var(--gold) 53%, transparent); }
  .ring { position: absolute; inset: 0; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--bg-2); stroke-width: 6; }
  .fill { fill: none; stroke: var(--gold); stroke-width: 6; stroke-linecap: round; transition: stroke-dashoffset 0.1s linear; }
  .count { font-size: 0.8rem; font-weight: 700; }

  .banner {
    position: absolute; left: 50%; top: 50%; translate: -50% -50%; padding: 0.5rem 1.2rem; border-radius: 12px;
    font-weight: 800; font-size: 1.15rem; background: color-mix(in srgb, var(--danger) 25%, var(--panel)); border: 2px solid var(--danger);
    box-shadow: 0 0 22px #ff6b6b66; white-space: nowrap;
  }
  .banner small { display: block; font-size: 0.75rem; font-weight: 600; text-align: center; opacity: 0.8; }
  .banner.win { background: color-mix(in srgb, var(--teal) 22%, var(--panel)); border-color: var(--teal); box-shadow: 0 0 22px color-mix(in srgb, var(--teal) 40%, transparent); }

  .enemy-stats { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; justify-content: flex-end; }
  .aim { margin: 0.3rem 0 0; color: var(--muted); }
  .trait { margin: 0.3rem 0 0; padding: 0.3rem 0.55rem; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--danger) 55%, var(--line)); background: color-mix(in srgb, var(--danger) 10%, transparent); }
  .elchip { padding: 0.05rem 0.5rem; border-radius: 99px; border: 1px solid var(--c); color: var(--c); font-size: 0.75rem; }
  .matchups { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .mu { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.5rem; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.75rem; }
  .mu b { font-weight: 700; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }

  .rewards { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-top: 0.6rem; }
  .rw { padding: 0.1rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); font-size: 0.8rem; }
  .rw.pink { border-color: #ff7ad9; }
  .rw.teal { border-color: var(--teal); }
  .rw.gold { border-color: var(--gold); }

  .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: 0.6rem; }
  .go { background: linear-gradient(90deg, var(--petrol), var(--violet)); }
  .auto { margin-left: auto; }
  .log { margin-top: 0.5rem; }
  .log summary, .defeat summary { cursor: pointer; }
  .oldlog { list-style: none; padding: 0; margin: 0.3rem 0 0; font-size: 0.75rem; font-family: var(--mono); color: var(--muted); }
  .only { display: inline-flex; align-items: center; gap: 0.3rem; margin: 0.35rem 0; }
  .proto { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; max-height: 18rem; overflow-y: auto; font-size: 0.75rem; }
  .proto li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem; padding: 0.1rem 0.4rem; border-radius: 6px; border-left: 3px solid var(--line); background: var(--bg-2); }
  .proto li.good { border-left-color: var(--teal); }
  .proto li.bad { border-left-color: var(--danger); }
  .at { min-width: 3.1rem; color: var(--muted); font-family: var(--mono); }
  .pic { width: 1.3rem; text-align: center; }
  .who {
    max-width: 9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 0.4rem; border-radius: 99px;
    border: 1px solid var(--el); background: color-mix(in srgb, var(--teal) 16%, transparent); color: var(--text);
  }
  /* Foes stand out even when they share species and element with the team. */
  .who.foe { border-style: dashed; background: color-mix(in srgb, var(--danger) 26%, transparent); }

  .defeat {
    margin-top: 0.6rem; padding: 0.45rem 0.6rem; border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--danger) 50%, var(--line)); background: color-mix(in srgb, var(--danger) 7%, var(--bg-2));
  }
  .foehp { display: flex; align-items: center; gap: 0.5rem; margin: 0.45rem 0 0.2rem; }
  .foehp .bar { flex: 1; height: 7px; border-radius: 99px; background: var(--bg); overflow: hidden; }
  .foehp .bar div { height: 100%; background: var(--danger); }
  .reasons { list-style: none; padding: 0; margin: 0.4rem 0 0; display: grid; gap: 0.45rem; }
  .reasons li { display: flex; gap: 0.5rem; align-items: flex-start; }
  .reasons p { margin: 0.1rem 0 0; }
  .ricon { width: 1.6rem; font-size: 1.2rem; line-height: 1.3; text-align: center; }
  .tip { color: var(--teal); }
  .members { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.5rem; }
  .member { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem; padding: 0.1rem 0.5rem; border-radius: 8px; border: 1px solid var(--el); background: var(--bg-2); font-size: 0.78rem; }
  .member.down { opacity: 0.75; }
  .mname { max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }

  /* Team */
  .team-panel { margin-top: 0.75rem; }
  .team-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; margin: 0.3rem 0 0.5rem; }
  .team-head h3 { margin: 0; }
  .sorting { display: flex; gap: 0.3rem; align-items: stretch; }
  .sockets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
  .socket {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1rem;
    min-height: 6.6rem; border-radius: 12px; border: 2px dashed var(--line); background: var(--bg-2); color: var(--muted); font-size: 1.4rem; padding: 0.3rem;
  }
  .socket.filled { border: 2px solid var(--el); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 18%, transparent), var(--bg-2) 70%); color: var(--text); font-size: 0.8rem; }
  .socket.locked { opacity: 0.45; font-size: 1.1rem; }
  .sname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
  .x { position: absolute; top: 2px; right: 3px; padding: 0 0.35rem; border: 0; background: none; color: var(--muted); font-size: 1rem; line-height: 1.2; }
  .x:hover { color: var(--danger); }
  .socket.back { border-style: dashed; }
  .role { position: absolute; top: 3px; left: 6px; font-size: 0.85rem; }
  .rowseg { display: inline-flex; margin-top: 0.15rem; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .rowseg button { border: 0; border-radius: 0; padding: 0.1rem 0.4rem; font-size: 0.68rem; background: var(--bg-2); }
  .rowseg button.on { background: var(--petrol); color: #fff; }
  .stech { font-size: 0.66rem; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .synergies { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.45rem; }
  .syn { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid var(--line); color: var(--muted); }
  .syn.on { color: var(--text); border-color: var(--c, var(--gold)); background: color-mix(in srgb, var(--c, var(--gold)) 15%, transparent); }
  .trole { position: absolute; bottom: 2px; left: 5px; font-size: 0.72rem; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .seg button { border: 0; border-radius: 0; font-size: 0.78rem; padding: 0.25rem 0.6rem; background: var(--bg-2); }
  .seg button.on { background: var(--petrol); color: #fff; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 22rem; overflow-y: auto; padding: 2px; }
  .tile {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.35rem 0.25rem;
    border-radius: 10px; border: 2px solid color-mix(in srgb, var(--el) 45%, var(--line)); background: var(--bg-2);
  }
  .tile.on { border-color: var(--gold); box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 53%, transparent); background: color-mix(in srgb, var(--gold) 12%, var(--bg-2)); }
  .tile.on::after { content: '✓'; position: absolute; top: 2px; left: 6px; color: var(--gold); font-weight: 800; }
  .tile:disabled { opacity: 0.45; }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rc); }
  .adv { position: absolute; top: 2px; right: 6px; font-size: 0.75rem; }

  /* Leaderboard */
  .board { margin-top: 0.75rem; }
  .medal { width: 1.8rem; text-align: center; font-size: 1.1rem; }
  .bfloor { font-weight: 700; min-width: 5.5rem; }
  .range { min-width: 3.5rem; }
  .minis { display: flex; gap: 2px; }
  .when { margin-left: auto; white-space: nowrap; }

  @media (max-width: 760px) {
    .stage { grid-template-columns: 1fr; }
    .tower { order: 2; flex-direction: row; overflow-x: auto; padding: 0.5rem; gap: 4px; }
    .roof, .base, .floor.ghost { display: none; }
    .floor { flex-direction: column; justify-content: center; min-width: 3.4rem; min-height: 3.6rem; padding: 0.2rem; gap: 0.1rem; }
    .tower { flex-direction: row-reverse; justify-content: flex-end; }
    .check, .squad { margin-left: 0; }
    .floor.best::after { top: -4px; bottom: -4px; left: auto; right: -4px; border-top: 0; border-right: 2px dashed var(--gold); }
    .rec { top: auto; bottom: -2px; right: 2px; }
    .field { grid-template-columns: 1fr; min-height: 0; justify-items: center; }
    .side.team { justify-content: center; }
    .unit { width: 4.6rem; }
    .vs { width: 56px; height: 56px; }
    .ring { width: 56px; height: 56px; }
    .field { gap: 0.2rem; padding: 0.4rem 0; }
    .enemy-stats { justify-content: center; }
    .sockets { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.3rem; }
    .socket { min-height: 5.4rem; }
    .socket.filled :global(svg) { width: 40px; height: 40px; }
    .auto { margin-left: 0; }
  }
</style>
