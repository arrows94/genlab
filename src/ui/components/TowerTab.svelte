<script lang="ts">
  import { content } from '@content/index';
  import { creaturePower, findCreature } from '@core/creatures';
  import { formatNumber, formatDuration } from '@core/format';
  import { checkpoint, elementMultiplier, enemyFor, setTeam, setTowerAutoRestart, startRun, stopRun, teamSize } from '@core/features/tower';
  import { game, view, act } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    const tw = game.state.tower;
    const size = teamSize(game);
    const team = tw.team.map((id) => findCreature(game, id)).filter((c) => !!c);
    const nextFloor = (tw.run?.floor ?? checkpoint(game)) + 1;
    const enemy = enemyFor(game, nextFloor);
    return {
      tw,
      size,
      team,
      nextFloor,
      enemy,
      matchups: team.map((c) => ({ name: c!.name, mult: elementMultiplier(game, content.species.get(c!.speciesId).element, enemy.element) })),
      candidates: [...game.state.creatures]
        .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
        .sort((a, b) => creaturePower(game, b) - creaturePower(game, a))
        .slice(0, 40)
        .map((c) => ({ c, power: creaturePower(game, c), inTeam: tw.team.includes(c.id) })),
      checkpoint: checkpoint(game),
      nextFightIn: tw.run ? game.balance.tower.fightIntervalSec * 1000 - tw.run.elapsedMs : 0,
      auto: game.state.features['towerAuto'] === true,
    };
  });

  function toggle(id: number) {
    const current = game.state.tower.team;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    act(setTeam(game, next));
  }
  function stop() {
    if (confirm('Lauf beenden? Er wird in der Bestenliste eingetragen.')) act(stopRun(game));
  }
</script>

<h2>🗼 Genom-Turm <span class="muted num">Rekord: Etage {data.tw.best}</span></h2>

<div class="grid two">
  <article class="panel">
    {#if data.tw.run}
      <h3>Lauf aktiv · Etage <span class="num">{data.tw.run.floor}</span></h3>
      <p class="small muted">Gestartet ab Etage {data.tw.run.startFloor} · nächster Kampf in {formatDuration(data.nextFightIn)}</p>
      <div class="bar"><div style="width: {(1 - data.nextFightIn / (game.balance.tower.fightIntervalSec * 1000)) * 100}%"></div></div>
      <button class="danger" onclick={stop}>Lauf beenden</button>
    {:else}
      <h3>Team <span class="muted num">{data.team.length}/{data.size}</span></h3>
      <p class="small muted">Das Team kämpft automatisch alle {game.balance.tower.fightIntervalSec} s eine Etage. Teammitglieder können währenddessen nicht arbeiten oder brüten.</p>
      <div class="row">
        <button class="primary" disabled={data.team.length === 0} onclick={() => act(startRun(game, true))}>Start ab Etage {data.checkpoint + 1}</button>
        {#if data.checkpoint > 0}<button disabled={data.team.length === 0} onclick={() => act(startRun(game, false))}>Ab Etage 1</button>{/if}
      </div>
    {/if}
    {#if data.auto}
      <label class="small"><input type="checkbox" checked={data.tw.autoRestart} onchange={(e) => act(setTowerAutoRestart(game, e.currentTarget.checked))} /> nach Niederlage automatisch neu starten</label>
    {/if}

    <h3>Nächster Gegner · Etage {data.nextFloor}</h3>
    <div class="enemy" style="--el: {content.elements.get(data.enemy.element).color}">
      <b>{data.enemy.name}</b> <span class="el">{content.elements.get(data.enemy.element).name}</span>
      <span class="num small">KP {formatNumber(data.enemy.hp)} · ANG {formatNumber(data.enemy.atk)} · VER {formatNumber(data.enemy.def)} · TMP {formatNumber(data.enemy.spd)}</span>
      <span class="small">
        {#each data.matchups as m, i (i)}<span class:good={m.mult > 1} class:bad={m.mult < 1}>{m.name} ×{formatNumber(m.mult, { decimals: 2 })}</span>{/each}
      </span>
    </div>

    {#if data.tw.lastResult}
      <h3>Letzter Kampf · Etage {data.tw.lastResult.floor} {data.tw.lastResult.win ? '✅' : '❌'}</h3>
      <ul class="log">{#each data.tw.lastResult.log as line, i (i)}<li>{line}</li>{/each}</ul>
    {/if}
  </article>

  <article class="panel">
    <h3>Team wählen</h3>
    <ul class="pick">
      {#each data.candidates as { c, power, inTeam } (c.id)}
        {@const species = content.species.get(c.speciesId)}
        <li>
          <label class:disabled={!!data.tw.run}>
            <input type="checkbox" checked={inTeam} disabled={!!data.tw.run || (!inTeam && data.team.length >= data.size)} onchange={() => toggle(c.id)} />
            <span>{c.name}</span>
            <span class="small" style="color: {content.elements.get(species.element).color}">{content.elements.get(species.element).name}</span>
            <span class="small" style="color: {content.rarities.get(c.rarity).color}">{content.rarities.get(c.rarity).name}</span>
            <span class="num small muted">Σ {power}</span>
          </label>
        </li>
      {/each}
    </ul>
  </article>
</div>

<article class="panel board">
  <h3>🏆 Bestenliste</h3>
  {#if data.tw.leaderboard.length === 0}
    <p class="muted small">Noch keine Läufe.</p>
  {:else}
    <table>
      <tbody>
        {#each data.tw.leaderboard as e, i (i)}
          <tr><td class="num">{i + 1}.</td><td class="num">Etage {e.floor}</td><td class="small">{e.team.map((s) => (content.species.has(s) ? content.species.get(s).name : s)).join(', ')}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</article>

<style>
  .two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  h3 { margin-top: 0.75rem; }
  h3:first-child { margin-top: 0; }
  .small { font-size: 0.8rem; }
  .row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
  .bar { height: 8px; background: var(--bg-2); border-radius: 99px; overflow: hidden; margin: 0.4rem 0; }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--gold), var(--danger)); }
  .enemy { display: flex; flex-direction: column; gap: 0.2rem; border-left: 3px solid var(--el); padding-left: 0.5rem; }
  .enemy .el { color: var(--el); font-size: 0.8rem; }
  .enemy span span { margin-right: 0.5rem; }
  .good { color: var(--teal); }
  .bad { color: var(--danger); }
  .log { list-style: none; padding: 0; margin: 0; font-size: 0.78rem; font-family: var(--mono); color: var(--muted); }
  .pick { list-style: none; padding: 0; margin: 0; max-height: 26rem; overflow-y: auto; display: grid; gap: 0.2rem; }
  .pick label { display: flex; gap: 0.4rem; align-items: center; font-size: 0.88rem; }
  .pick label.disabled { opacity: 0.6; }
  .pick .num { margin-left: auto; }
  .board { margin-top: 0.75rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  td { padding: 0.2rem 0.4rem; border-bottom: 1px solid var(--line); }
</style>
