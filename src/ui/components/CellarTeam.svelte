<script lang="ts">
  import { content } from '@content/index';
  import { creaturePower } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber } from '@core/format';
  import { cellarCandidates, cellarFit, cellarRowOf, hasNightSight, setCellarRow, setCellarTeam } from '@core/features/cellar';
  import { teamSize } from '@core/features/tower';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CreatureTile from './CreatureTile.svelte';
  import Meter from './Meter.svelte';

  /**
   * Keller team: the places with row, HP share during a descent and how each
   * member fits the next level; below, the free creatures – best fitting first.
   */
  let { team, next }: { team: Creature[]; next: number } = $props();

  let search = $state('');
  const el = (id: string) => content.elements.get(id);

  const data = $derived.by(() => {
    view.slowFrame;
    const run = game.state.cellar.run;
    const size = teamSize(game);
    const q = search.trim().toLowerCase();
    const inTeam = game.state.cellar.team;
    const candidates = run
      ? []
      : cellarCandidates(game, next)
          .filter(({ creature: c }) => !q || c.name.toLowerCase().includes(q) || content.species.get(c.speciesId).name.toLowerCase().includes(q))
          .slice(0, 40)
          .map((x) => ({ ...x, inTeam: inTeam.includes(x.creature.id) }));
    const members = team.map((c) => {
      const i = run ? run.team.indexOf(c.id) : -1;
      return { c, hp: run && i >= 0 ? (run.hp[i] ?? 0) : 1, fit: cellarFit(game, c, next, team), row: cellarRowOf(game, c.id), night: hasNightSight(game, c) };
    });
    return { run: !!run, size, members, candidates };
  });

  function toggle(id: number) {
    const current = game.state.cellar.team;
    act(setCellarTeam(game, current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }
  const fitTitle = (good: string[], bad: string[]) => [...good.map((t) => `▲ ${t}`), ...bad.map((t) => `▼ ${t}`)].join('\n');
</script>

<article class="panel team-panel">
  <div class="team-head">
    <h3>Keller-Team <span class="muted num">{team.length}/{data.size}</span></h3>
    <span class="small muted">{data.run ? 'Während eines Abstiegs gesperrt.' : 'Eigenes Team – wer im Turm-Team steht, kann nicht in den Keller.'}</span>
  </div>
  <div class="sockets">
    {#each Array.from({ length: data.size }, (_, i) => i) as i (i)}
      {@const m = data.members[i]}
      {#if m}
        {@const sp = content.species.get(m.c.speciesId)}
        <div class="socket filled" class:back={m.row === 'back'} class:down={data.run && m.hp <= 0} style="--el: {el(sp.element).color}" title={fitTitle(m.fit.good, m.fit.bad)}>
          {#if m.night}<span class="night" title="Nachtsicht: sieht im Dunkeln">👁️</span>{/if}
          <span class="fit">
            {#if m.fit.good.length}<span class="good">▲{m.fit.good.length}</span>{/if}
            {#if m.fit.bad.length}<span class="bad">▼{m.fit.bad.length}</span>{/if}
          </span>
          <CreatureSvg appearance={expressedAppearance(game, m.c)} shape={sp.shape} tier={sp.tier} size={48} shiny={m.c.shiny} />
          <span class="sname">{m.c.name}</span>
          {#if data.run}
            <Meter size="sm" tone="teal" low={m.hp < 0.3} value={m.hp} title="{Math.round(m.hp * 100)} % KP" />
          {:else}
            <span class="small num muted">Σ {formatNumber(creaturePower(game, m.c))}</span>
          {/if}
          <span class="rowseg" role="group" aria-label="Reihe">
            <button class:on={m.row === 'front'} disabled={data.run} onclick={() => act(setCellarRow(game, m.c.id, 'front'))}>Vorne</button>
            <button class:on={m.row === 'back'} disabled={data.run} onclick={() => act(setCellarRow(game, m.c.id, 'back'))}>Hinten</button>
          </span>
          {#if !data.run}<button class="x" title="Aus dem Team nehmen" onclick={() => toggle(m.c.id)}>×</button>{/if}
        </div>
      {:else}
        <div class="socket empty-slot">+</div>
      {/if}
    {/each}
  </div>

  {#if !data.run}
    <div class="team-head">
      <h3>Kandidaten <span class="small muted">– passend zur nächsten Ebene zuerst</span></h3>
      <input type="search" placeholder="Name oder Art …" bind:value={search} />
    </div>
    <div class="tiles">
      {#each data.candidates as t (t.creature.id)}
        {@const sp = content.species.get(t.creature.speciesId)}
        <CreatureTile
          creature={t.creature}
          info="Σ {formatNumber(creaturePower(game, t.creature))}"
          selected={t.inTeam}
          disabled={!t.inTeam && team.length >= data.size}
          title="{t.creature.name} · {el(sp.element).name}{t.good.length || t.bad.length ? `\n${fitTitle(t.good, t.bad)}` : ''}"
          onclick={() => toggle(t.creature.id)}
        >
          {#snippet corner()}
            {#if t.good.length}<span class="good">▲{t.good.length}</span>{/if}
            {#if t.bad.length}<span class="bad">▼{t.bad.length}</span>{/if}
          {/snippet}
        </CreatureTile>
      {:else}
        <p class="muted small">Keine freien Kreaturen.</p>
      {/each}
    </div>
  {/if}
</article>

<style>
  .small { font-size: 0.8rem; }
  .good { color: var(--teal); }
  .bad { color: var(--danger); }
  .team-panel { margin-top: 0.75rem; }
  .team-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; margin: 0.3rem 0 0.5rem; }
  .team-head h3 { margin: 0; }
  .team-head input { flex: 1 1 9rem; max-width: 14rem; }
  .sockets { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.5rem; }
  .socket {
    position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem;
    min-height: 6.6rem; border-radius: 12px; border: 2px dashed var(--line); background: var(--bg-2); color: var(--muted); font-size: 1.4rem; padding: 0.3rem;
  }
  .socket.filled { border: 2px solid var(--el); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 14%, transparent), var(--bg-2) 70%); color: var(--text); font-size: 0.8rem; }
  .socket.back { border-style: dashed; }
  .socket.down { opacity: 0.45; filter: grayscale(0.8); }
  .socket :global(.meter) { width: 90%; }
  .sname { max-width: 100%; font-weight: 600; line-height: 1.2; text-align: center; overflow-wrap: break-word; }
  .night { position: absolute; top: 3px; left: 6px; font-size: 0.8rem; }
  .fit { position: absolute; top: 3px; right: 1.4rem; font-size: 0.72rem; display: flex; gap: 0.2rem; }
  .x { position: absolute; top: 2px; right: 3px; padding: 0 0.35rem; border: 0; background: none; color: var(--muted); font-size: 1rem; line-height: 1.2; }
  .x:hover { color: var(--danger); }
  .rowseg { display: inline-flex; margin-top: 0.15rem; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
  .rowseg button { border: 0; border-radius: 0; padding: 0.1rem 0.4rem; font-size: 0.68rem; background: var(--bg-2); }
  .rowseg button.on { background: var(--petrol); color: #fff; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 22rem; overflow-y: auto; padding: 2px; }
</style>
