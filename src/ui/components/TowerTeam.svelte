<script lang="ts">
  import { content } from '@content/index';
  import { creaturePower, effectiveStats } from '@core/creatures';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { ROLE_INFO, elementMultiplier, roleOf, setRow, setTeam, techniqueFor, type Role, type Row, type Synergy } from '@core/features/tower';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { viewState, type TowerSort } from '../viewState.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CreatureTile from './CreatureTile.svelte';
  import SortToggle from './SortToggle.svelte';

  /** Tower team: the sockets with row and role, synergies, and the candidates to pick from. */
  let { team, size, running, synergies, roles, rows, enemyElement }: {
    team: Creature[];
    size: number;
    running: boolean;
    synergies: Synergy[];
    roles: Record<number, ReturnType<typeof roleOf>>;
    rows: Record<number, Row>;
    enemyElement: string;
  } = $props();

  const MAX_SLOTS = 5;
  let search = $state('');
  const el = (id: string) => content.elements.get(id);
  const SORT_LABELS: Record<TowerSort, string> = {
    power: 'Stärke', matchup: 'Vorteil vs.', speed: 'Tempo', hp: 'KP', atk: 'Angriff', def: 'Verteidigung', role: 'Rolle', rarity: 'Seltenheit',
  };
  const ROLE_ORDER: Record<Role, number> = { tank: 2, attacker: 1, fast: 0 };
  /** The number under a candidate: the sorted stat, otherwise the total power. */
  const STAT_SHORT: Partial<Record<TowerSort, string>> = { speed: '💨', hp: 'KP', atk: 'ANG', def: 'VER' };
  /** „Vorteil vs.“ against the chosen element, or the next enemy's. */
  const vsElement = $derived(content.elements.has(viewState.tower.vsElement) ? viewState.tower.vsElement : enemyElement);

  const candidates = $derived.by(() => {
    view.slowFrame;
    const inTeam = game.state.tower.team;
    const { sort, invert } = viewState.tower;
    const q = search.trim().toLowerCase();
    return [...game.state.creatures]
      .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
      .filter((c) => !q || c.name.toLowerCase().includes(q) || content.species.get(c.speciesId).name.toLowerCase().includes(q))
      .map((c) => {
        const element = content.species.get(c.speciesId).element;
        const stats = effectiveStats(game, c);
        const role = roleOf(game, stats);
        const dealt = elementMultiplier(game, element, vsElement);
        const taken = elementMultiplier(game, vsElement, element);
        const key =
          sort === 'matchup' ? dealt / taken
          : sort === 'speed' ? (stats.spd ?? 0)
          : sort === 'hp' || sort === 'atk' || sort === 'def' ? (stats[sort] ?? 0)
          : sort === 'role' ? ROLE_ORDER[role]
          : sort === 'rarity' ? content.rarities.get(c.rarity).order
          : 0;
        const short = STAT_SHORT[sort];
        const info = short ? `${short} ${formatNumber(stats[sort === 'speed' ? 'spd' : sort] ?? 0)}` : `Σ ${formatNumber(creaturePower(game, c))}`;
        return { c, power: creaturePower(game, c), info, role, key, inTeam: inTeam.includes(c.id), dealt };
      })
      .sort((a, b) => (invert ? -1 : 1) * (b.key - a.key || b.power - a.power))
      .slice(0, 40);
  });

  function toggle(id: number) {
    const current = game.state.tower.team;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    act(setTeam(game, next));
  }
</script>

<article class="panel team-panel">
  <div class="team-head">
    <h3>Team <span class="muted num">{team.length}/{size}</span></h3>
    <span class="small muted">{running ? 'Während eines Laufs gesperrt.' : 'Teammitglieder können während eines Laufs nicht arbeiten oder brüten.'}</span>
  </div>
  {#if synergies.length}
    <div class="synergies">
      {#each synergies as syn, k (k)}
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
      {@const c = team[i]}
      {#if i >= size}
        <div class="socket locked" title="Weitere Plätze über Äon-Talente">🔒</div>
      {:else if c}
        {@const sp = content.species.get(c.speciesId)}
        {@const role = ROLE_INFO[roles[c.id] ?? 'tank']}
        {@const row = rows[c.id] ?? 'front'}
        {@const tech = techniqueFor(game, sp.element)}
        <div class="socket filled" class:back={row === 'back'} style="--el: {el(sp.element).color}">
          <span class="role" title="{role.name}: {role.hint}">{role.icon}</span>
          <CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={52} shiny={c.shiny} />
          <span class="sname">{c.name}</span>
          <span class="small num muted">Σ {formatNumber(creaturePower(game, c))}</span>
          {#if tech}<span class="stech" title="{tech.name}: {tech.description} (jede {game.balance.tower.techniqueEvery}. Aktion)">{tech.icon} {tech.name}</span>{/if}
          <span class="rowseg" role="group" aria-label="Reihe">
            <button class:on={row === 'front'} disabled={!!running} title="Vordere Reihe: steckt die meisten Treffer ein" onclick={() => act(setRow(game, c.id, 'front'))}>Vorne</button>
            <button class:on={row === 'back'} disabled={!!running} title="Hintere Reihe: wird seltener angegriffen" onclick={() => act(setRow(game, c.id, 'back'))}>Hinten</button>
          </span>
          {#if !running}<button class="x" title="Aus dem Team nehmen" onclick={() => toggle(c.id)}>×</button>{/if}
        </div>
      {:else}
        <div class="socket empty-slot">+</div>
      {/if}
    {/each}
  </div>

  {#if !running}
    <div class="team-head">
      <h3>Kandidaten</h3>
      <div class="sorting">
        <input type="search" placeholder="Name oder Art …" bind:value={search} />
        <select bind:value={viewState.tower.sort} title="Sortierung">
          {#each Object.entries(SORT_LABELS) as [id, label] (id)}<option value={id}>{label}</option>{/each}
        </select>
        {#if viewState.tower.sort === 'matchup'}
          <select bind:value={viewState.tower.vsElement} title="Vorteil gegen welches Element?">
            <option value="">{el(enemyElement).name} (nächster Gegner)</option>
            {#each content.elements.list as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
          </select>
        {/if}
        <SortToggle bind:inverted={viewState.tower.invert} />
      </div>
    </div>
    <div class="tiles">
      {#each candidates as t (t.c.id)}
        {@const sp = content.species.get(t.c.speciesId)}
        <CreatureTile
          creature={t.c}
          info={t.info}
          selected={t.inTeam}
          disabled={!t.inTeam && team.length >= size}
          title="{t.c.name} · {el(sp.element).name} · {content.rarities.get(t.c.rarity).name}"
          onclick={() => toggle(t.c.id)}
        >
          {#snippet corner()}
            <span title={ROLE_INFO[t.role].name}>{ROLE_INFO[t.role].icon}</span>
            {#if t.dealt > 1}<span class="good" title="Elementvorteil gegen {el(vsElement).name}">▲</span>{:else if t.dealt < 1}<span class="bad" title="Elementnachteil gegen {el(vsElement).name}">▼</span>{/if}
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



  /* Tower column */

  /* Arena */
  /* Arena floor in perspective behind the fighters. */






  /* Foes stand out even when they share species and element with the team. */


  /* Team */
  .team-panel { margin-top: 0.75rem; }
  .team-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; margin: 0.3rem 0 0.5rem; }
  .team-head h3 { margin: 0; }
  .sorting { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: stretch; }
  .sorting input[type='search'] { flex: 1 1 9rem; max-width: 14rem; }
  .sorting select { max-width: 11rem; }
  .sockets { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; }
  .socket {
    position: relative; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1rem;
    min-height: 6.6rem; border-radius: 12px; border: 2px dashed var(--line); background: var(--bg-2); color: var(--muted); font-size: 1.4rem; padding: 0.3rem;
  }
  .socket.filled { border: 2px solid var(--el); background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 18%, transparent), var(--bg-2) 70%); color: var(--text); font-size: 0.8rem; }
  .socket.locked { opacity: 0.45; font-size: 1.1rem; }
  /* Long names wrap to a second line (with hyphenation) instead of being cut. */
  .sname {
    max-width: 100%; font-weight: 600; line-height: 1.2; text-align: center; hyphens: auto; overflow-wrap: break-word;
    display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
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
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 22rem; overflow-y: auto; padding: 2px; }

  /* Leaderboard */

  /* Phone: three places per row (five were too narrow for name and Vorne/Hinten); locked places only cost space. */
  @media (max-width: 760px) {
    .sockets { grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; }
    .socket { min-height: 5.4rem; }
    .socket.locked { display: none; }
    .socket.filled :global(svg) { width: 40px; height: 40px; }
  }
</style>

