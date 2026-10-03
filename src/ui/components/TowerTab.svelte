<script lang="ts">
  import { formatNumber, formatDuration, formatPercent } from '@core/format';
  import { describeModifier } from '@core/queries';
  import { towerView } from '@core/features/towerView';
  import { game, view } from '../store.svelte';
  import Meter from './Meter.svelte';
  import WeeklyBossPanel from './WeeklyBossPanel.svelte';
  import RelicPanel from './RelicPanel.svelte';
  import TowerArena from './TowerArena.svelte';
  import TowerFloors from './TowerFloors.svelte';
  import TowerBoard from './TowerBoard.svelte';
  import TowerTeam from './TowerTeam.svelte';
  import CellarView from './CellarView.svelte';
  import DarkRelicPanel from './DarkRelicPanel.svelte';
  import { viewState, type TowerArea } from '../viewState.svelte';
  import { prefs } from '../prefs.svelte';
  import { play } from '../sound';

  /**
   * Genom-Turm: header figures, the floor column, the arena (replay of the
   * last fight and preview of the next floor), the team, relics and the
   * leaderboard. The parts live in their own components.
   */

  // Team, floors and the next enemy: the slow tick is enough (a fight takes seconds).
  const data = $derived.by(() => {
    view.slowFrame;
    return towerView(game);
  });

  /** Tower or Genom-Keller: the switch only appears once the cellar is open. */
  const cellarOpen = $derived.by(() => {
    view.slowFrame;
    return !!game.state.features['cellar'];
  });
  const area = $derived(cellarOpen ? viewState.tower.area : 'tower');

  /**
   * The ride between tower and cellar: a lift through the floor. The view
   * switches behind the cover halfway; reduced motion switches at once.
   */
  let lift = $state<'down' | 'up' | null>(null);
  function go(target: TowerArea) {
    if (target === area || lift) return;
    play('cellarLift', target === 'cellar' ? 0 : 1);
    if (prefs.reduceMotion) return void (viewState.tower.area = target);
    lift = target === 'cellar' ? 'down' : 'up';
    setTimeout(() => (viewState.tower.area = target), 650);
    setTimeout(() => (lift = null), 1500);
  }

  /** „+15 % Turm-Schaden, +10 % Nahrung-Ertrag …“ – straight from the balance numbers. */
  const MILESTONE_BONUS = game.balance.tower.milestoneModifiers.map((m) => describeModifier(game, m)).join(', ');
</script>


{#if cellarOpen}
  <div class="area-switch" role="group" aria-label="Turm oder Keller">
    <button class:on={area === 'tower'} onclick={() => go('tower')}>▲ Turm</button>
    <button class:on={area === 'cellar'} onclick={() => go('cellar')}>▼ Keller{#if game.state.cellar.run}<span class="live-dot" title="Ein Abstieg läuft"></span>{/if}</button>
  </div>
{/if}

{#if lift}
  <div class="lift {lift}" aria-hidden="true">
    <div class="slabs"></div>
    <span class="cable"></span>
    <div class="cabin"><span class="lamp"></span></div>
  </div>
{/if}

{#if area === 'cellar'}
  <CellarView />
{:else}
<header class="tab-head">
  <h2>🗼 Genom-Turm</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">{data.tw.best}</b><small>Rekord</small></span>
    <span class="kpi"><b class="num">🚩 {data.cp}</b><small>Checkpoint</small></span>
    <span class="kpi" class:live={!!data.tw.run}><b class="num">{data.tw.run ? data.tw.run.floor : '–'}</b><small>{data.tw.run ? 'Aktueller Lauf' : 'Kein Lauf'}</small></span>
    <span class="kpi"><b class="num">🗼 {formatNumber(game.state.resources['towerTokens'] ?? 0)}</b><small>Turm-Marken</small></span>
    <span class="kpi veteran" title="Kampferfahrung: Jede gewonnene Etage bringt Erfahrung – je höher, desto mehr, ein Boss {game.balance.tower.xpBossMult}-mal so viel. Sie bleibt bei jeder Vererbung und jedem Äon. Je Rang +{formatPercent(game.balance.tower.xpRankBonus, 0)} KP und Schaden im Turm und gegen den Wochen-Boss – jetzt +{formatPercent(data.veteran.bonus, 0)}. Noch {formatNumber(Math.ceil(data.veteran.need - data.veteran.into))} bis Rang {data.veteran.rank + 1}.">
      <b class="num">🎖 {data.veteran.rank}</b><small>Rang · +{formatPercent(data.veteran.bonus, 0)}</small>
      <Meter size="sm" tone="gold" value={data.veteran.into / data.veteran.need} title="Kampferfahrung bis zum nächsten Rang" />
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

  <TowerArena {data} />
</div>

<TowerTeam team={data.team} size={data.size} running={!!data.tw.run} synergies={data.synergies} roles={data.roles} rows={data.rows} enemyElement={data.enemy.element} />

<RelicPanel />

{#if cellarOpen}<DarkRelicPanel course="tower" />{/if}

<TowerBoard />
{/if}

<style>


  .stage { display: grid; grid-template-columns: 11rem 1fr; gap: 0.75rem; align-items: start; }
  .area-switch { display: inline-flex; margin-bottom: 0.6rem; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .area-switch button { border: 0; border-radius: 0; padding: 0.3rem 0.9rem; background: var(--bg-2); position: relative; }
  .area-switch button.on { background: var(--petrol); color: #fff; }
  /* The lift: stone layers rush past (up when going down), the cabin jerks, the lamp flickers. */
  .lift { position: fixed; inset: 0; z-index: 60; pointer-events: none; background: #040806; animation: lift-cover 1.5s ease-in-out forwards; overflow: hidden; }
  .lift::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, transparent 18%, #000d 70%); }
  @keyframes lift-cover { 0% { opacity: 0; } 25%, 70% { opacity: 1; } 100% { opacity: 0; } }
  .slabs {
    position: absolute; left: 0; right: 0; top: -100%; height: 300%;
    background:
      repeating-linear-gradient(0deg, #0e1611 0 70px, #1c2a1f 70px 76px, #0a100c 76px 150px, #2a1d14 150px 154px),
      radial-gradient(ellipse at 50% 50%, transparent 30%, #000 80%);
    animation: slabs-down 1.5s cubic-bezier(0.5, 0, 0.5, 1) forwards;
  }
  .lift.up .slabs { animation-name: slabs-up; }
  @keyframes slabs-down { from { transform: translateY(0); } to { transform: translateY(-40%); } }
  @keyframes slabs-up { from { transform: translateY(-40%); } to { transform: translateY(0); } }
  .cable { position: absolute; top: 0; left: 50%; width: 2px; height: 38%; background: linear-gradient(#000, #6b6355); transform: translateX(-50%); }
  .cabin {
    position: absolute; top: 38%; left: 50%; width: 9rem; height: 6rem; transform: translateX(-50%);
    border: 3px solid #3a3226; border-top-width: 6px; background: repeating-linear-gradient(90deg, #0c120e 0 12px, #1a2119 12px 14px);
    box-shadow: 0 0 40px #000; animation: jerk 1.5s steps(1) forwards;
  }
  @keyframes jerk { 0% { transform: translate(-50%, 0); } 30% { transform: translate(-50%, 3px); } 32% { transform: translate(-50%, -2px); } 34% { transform: translate(-50%, 0); } 62% { transform: translate(-50%, 2px); } 64% { transform: translate(-50%, 0); } }
  .lamp { position: absolute; top: 0.3rem; left: 50%; width: 10px; height: 10px; border-radius: 50%; transform: translateX(-50%); background: #ffb062; box-shadow: 0 0 30px 12px #ff9a3c66; animation: lamp 1.5s steps(1) forwards; }
  @keyframes lamp { 0%, 100% { opacity: 1; } 20% { opacity: 0.2; } 23% { opacity: 1; } 48% { opacity: 0.1; } 52% { opacity: 1; } 55% { opacity: 0.3; } 58% { opacity: 1; } }
  .live-dot { display: inline-block; width: 7px; height: 7px; margin-left: 0.35rem; border-radius: 50%; background: var(--teal); vertical-align: middle; }

  /* Tower column */
  .veteran { gap: 0.1rem; }

  /* Arena */
  /* Arena floor in perspective behind the fighters. */






  /* Foes stand out even when they share species and element with the team. */


  /* Team */

  /* Leaderboard */

  @media (max-width: 760px) {
    .stage { grid-template-columns: 1fr; }
  }
</style>
