<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { dexKey } from '@core/state';
  import { dexCount } from '@core/queries';
  import { familyTree, perfectionSummary, speciesHabitats, tierProgress, TIER_NAMES, type TreeNode } from '@core/features/dex';
  import { viewState } from '../viewState.svelte';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  // Kept in viewState so the chosen view survives tab switches.
  const dex = viewState.dex;

  /** Species shown in the detail card. */
  let open = $state<string | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const tree = familyTree(game);
    return {
      dex: { ...game.state.dex },
      count: dexCount(game),
      tree: tree.map((g) => ({ ...g, progress: tierProgress(game, g.tier) })),
      perfection: perfectionSummary(game),
    };
  });

  const detail = $derived.by(() => {
    view.slowFrame;
    if (!open) return null;
    const node = data.tree.flatMap((g) => g.nodes).find((n) => n.species.id === open);
    if (!node) return null;
    const known = node.discovered || node.species.tier === 'base';
    return {
      node,
      known,
      habitats: speciesHabitats(game, node.species.id),
      owned: game.state.creatures.filter((c) => c.speciesId === node.species.id).length,
      best: [...content.rarities.list].reverse().find((r) => data.dex[dexKey(node.species.id, r.id)]) ?? null,
    };
  });

  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };
  const name = (n: TreeNode) => (n.discovered || n.species.tier === 'base' ? n.species.name : '???');
  const statMax = Math.max(...content.species.list.flatMap((s) => Object.values(s.baseStats)));
  const RING = 2 * Math.PI * 22;
</script>

{#snippet ring(share: number, label: string, sub: string, color: string)}
  <div class="ring" style="--c: {color}">
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <circle cx="27" cy="27" r="22" class="track" />
      <circle cx="27" cy="27" r="22" class="fill" stroke-dasharray="{(share * RING).toFixed(1)} {RING.toFixed(1)}" />
    </svg>
    <span class="pct num">{Math.floor(share * 100)}%</span>
    <b class="rlabel">{label}</b>
    <span class="rsub num muted">{sub}</span>
  </div>
{/snippet}

<header class="tab-head">
  <h2>📖 Monster-Dex <span class="muted num">{data.count.found}/{data.count.total}</span></h2>
  <div class="switch">
    <button class:active={dex.view === 'cards'} onclick={() => (dex.view = 'cards')}>Sammlung</button>
    <button class:active={dex.view === 'table'} onclick={() => (dex.view = 'table')}>Tabelle</button>
    <button class:active={dex.view === 'tree'} onclick={() => (dex.view = 'tree')}>Stammbaum</button>
  </div>
</header>

<section class="panel rings">
  {@render ring(data.count.found / data.count.total, 'Gesamt', `${data.count.found}/${data.count.total}`, 'var(--teal)')}
  {#each data.tree as g (g.tier)}
    {@render ring(g.progress.entries / Math.max(1, g.progress.entriesTotal), g.name, `${g.progress.species}/${g.progress.speciesTotal} Arten`, g.tier === 'mythic' ? '#ff5fa2' : g.tier === 'rareHybrid' ? 'var(--gold)' : g.tier === 'hybrid' ? 'var(--violet)' : 'var(--teal)')}
  {/each}
  <div class="perfection">
    <span title="Alle Loci reinerbig mit Top-Allelen (sequenziert)">✦ Perfekte Genome <b class="num">{data.perfection.perfect}/{data.perfection.species}</b></span>
    <span title="Seltene Farbmutation">🌈 Schillernd <b class="num">{data.perfection.shiny}/{data.perfection.species}</b></span>
    <span>👑 Mythische Endformen <b class="num">{data.perfection.mythic}/{data.perfection.mythicTotal}</b></span>
  </div>
</section>

{#if dex.view === 'cards'}
  {#each data.tree as g (g.tier)}
    <section class="tier">
      <h3>{g.name} <span class="muted num">{g.progress.species}/{g.progress.speciesTotal}</span></h3>
      <div class="cards">
        {#each g.nodes as n (n.species.id)}
          {@const el = content.elements.get(n.species.element)}
          <button class="card" class:unknown={!n.discovered} style="--el: {el.color}" onclick={() => (open = n.species.id)} title="{name(n)} – Details">
            <span class="art"><CreatureSvg appearance={{ ...neutral, hue: n.species.hue }} shape={n.species.shape} tier={n.species.tier} size={62} shiny={n.shiny} /></span>
            <b class="cname">{name(n)}</b>
            <span class="dots" aria-label="{n.rarities} von {content.rarities.list.length} Seltenheiten">
              {#each content.rarities.list as r (r.id)}<span class="dot" class:on={data.dex[dexKey(n.species.id, r.id)]} style="--c: {r.color}" title={r.name}></span>{/each}
            </span>
            {#if n.perfect || n.shiny}<span class="marks">{n.perfect ? '✦' : ''}{n.shiny ? '🌈' : ''}</span>{/if}
            {#if !n.discovered && n.origins.some((o) => o.hint)}<span class="hinted" title="Hinweis bekannt">📜</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  {/each}
{:else if dex.view === 'table'}
  <div class="scroll panel">
    <table>
      <thead>
        <tr>
          <th>Art</th>
          {#each content.rarities.list as r (r.id)}<th style="color: {r.color}">{r.name}</th>{/each}
          <th title="Perfektes Genom">✦</th>
          <th title="Schillernd">🌈</th>
        </tr>
      </thead>
      <tbody>
        {#each data.tree as group (group.tier)}
          <tr class="group"><td colspan={content.rarities.list.length + 3}>{group.name}</td></tr>
          {#each group.nodes as n (n.species.id)}
            <tr>
              <td class="species"><button class="link" style="color: {content.elements.get(n.species.element).color}" onclick={() => (open = n.species.id)}>{name(n)}</button></td>
              {#each content.rarities.list as r (r.id)}
                <td class="cell" class:found={data.dex[dexKey(n.species.id, r.id)]} style="--c: {r.color}">{data.dex[dexKey(n.species.id, r.id)] ? '●' : '·'}</td>
              {/each}
              <td class="cell" class:found={n.perfect} style="--c: var(--gold)">{n.perfect ? '✦' : '·'}</td>
              <td class="cell" class:found={n.shiny} style="--c: #ff7ad9">{n.shiny ? '🌈' : '·'}</td>
            </tr>
          {/each}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="tree">
    {#each data.tree as group (group.tier)}
      <section>
        <h3>{group.name} <span class="muted num">{group.nodes.filter((n) => n.discovered).length}/{group.nodes.length}</span></h3>
        <div class="nodes">
          {#each group.nodes as n (n.species.id)}
            {@const element = content.elements.get(n.species.element)}
            <button class="node panel" class:unknown={!n.discovered} style="--el: {element.color}" onclick={() => (open = n.species.id)}>
              <div class="art">
                <CreatureSvg appearance={{ ...neutral, hue: n.species.hue }} shape={n.species.shape} tier={n.species.tier} size={56} />
              </div>
              <div class="info">
                <b>{name(n)}</b>
                <span class="el">{element.name}{#if n.discovered} · {n.rarities}/{content.rarities.list.length}{/if}</span>
                {#each n.origins as o (o.id)}
                  <div class="origin">
                    {#if o.kind === 'recipe'}
                      <span class="num">{o.from.map((f) => f ?? '???').join(' × ')}</span>
                    {:else}
                      <span>✨ aus {o.from[0] ?? '???'}</span>
                    {/if}
                    {#if o.requirements.length}<span class="muted req">{o.requirements.join(' · ')}</span>{/if}
                    {#if o.hint && !o.revealed}<span class="hint">„{o.hint}“</span>{/if}
                  </div>
                {/each}
              </div>
            </button>
          {/each}
        </div>
      </section>
    {/each}
  </div>
{/if}

{#if detail}
  {@const n = detail.node}
  {@const el = content.elements.get(n.species.element)}
  <div class="backdrop" role="presentation" onclick={() => (open = null)} transition:fade={{ duration: 150 }}>
    <div
      class="modal panel"
      role="dialog"
      aria-modal="true"
      aria-label={name(n)}
      tabindex="-1"
      style="--el: {el.color}; --rc: {detail.best?.color ?? 'var(--line)'}"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && (open = null)}
      in:scale={{ duration: 200, start: 0.92 }}
    >
      <button class="close" aria-label="Schließen" onclick={() => (open = null)}>✕</button>
      <header class="dhead">
        <span class="big" class:unknown={!n.discovered}>
          <CreatureSvg appearance={{ ...neutral, hue: n.species.hue }} shape={n.species.shape} tier={n.species.tier} size={110} shiny={n.shiny} />
        </span>
        <div>
          <h2>{name(n)}</h2>
          <p class="chips">
            <span class="chip" style="--c: {el.color}">{el.name}</span>
            <span class="chip">{TIER_NAMES[n.species.tier]}</span>
            {#if detail.owned > 0}<span class="chip">🏠 {detail.owned} im Stall</span>{/if}
          </p>
          <p class="desc">{detail.known ? n.species.description : 'Noch nicht entdeckt. Vielleicht verrät ein Hinweis, wie sie entsteht.'}</p>
        </div>
      </header>

      <div class="cols">
        <section>
          <h4>Seltenheiten</h4>
          <div class="rars">
            {#each content.rarities.list as r (r.id)}
              {@const got = data.dex[dexKey(n.species.id, r.id)]}
              <span class="rar" class:got style="--c: {r.color}">{got ? '●' : '○'} {r.name}</span>
            {/each}
          </div>
          <p class="small perf">
            <span class:got={n.perfect}>{n.perfect ? '✦ Perfektes Genom gefunden' : '✦ Perfektes Genom: offen'}</span>
            <span class:got={n.shiny}>{n.shiny ? '🌈 Schillernd gefunden' : '🌈 Schillernd: offen'}</span>
          </p>
          {#if detail.known}
            <h4>Grundwerte</h4>
            <div class="stats">
              {#each content.stats.list as s (s.id)}
                <span class="sname small">{s.short}</span>
                <span class="sbar"><span style="width: {((n.species.baseStats[s.id] ?? 0) / statMax) * 100}%"></span></span>
                <span class="num small">{n.species.baseStats[s.id]}</span>
              {/each}
            </div>
          {/if}
        </section>

        <section>
          <h4>Herkunft</h4>
          {#if n.origins.length === 0 && detail.habitats.length === 0}
            <p class="small muted">Nur als Startkreatur oder aus Gen-Kapseln.</p>
          {/if}
          {#each n.origins as o (o.id)}
            <div class="from">
              {#if o.kind === 'recipe'}
                <b class="small">🧪 Hybrid-Rezept</b>
                <span class="num">{o.from.map((f) => f ?? '???').join(' × ')}</span>
              {:else}
                <b class="small">✨ Evolution</b>
                <span>aus {o.from[0] ?? '???'}</span>
              {/if}
              {#if o.requirements.length}<span class="muted small">{o.requirements.join(' · ')}</span>{/if}
              {#if o.hint && !o.revealed}<span class="hint small">„{o.hint}“</span>{/if}
              {#if !o.revealed && !o.hint}<span class="muted small">Noch unbekannt – Forschung und lange Erkundungen verraten Hinweise.</span>{/if}
            </div>
          {/each}
          {#if detail.habitats.length > 0}
            <div class="from">
              <b class="small">🧭 Lebt wild in</b>
              <span class="places">
                {#each detail.habitats as h (h.kind + h.id)}
                  <span class="place" class:unknown={!h.name}>{h.kind === 'voyage' ? '🗺️' : '📍'} {h.name ?? 'unbekannte Region'}</span>
                {/each}
              </span>
            </div>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .small { font-size: 0.8rem; }
  .switch { display: flex; gap: 0.3rem; }
  .switch button { font-size: 0.85rem; padding: 0.35rem 0.7rem; }
  .switch button.active { border-color: var(--teal); background: color-mix(in srgb, var(--petrol) 45%, var(--panel-2)); }

  .rings { display: flex; flex-wrap: wrap; gap: 0.9rem 1.4rem; align-items: flex-start; padding: 0.7rem 0.9rem; margin-bottom: 0.9rem; }
  .ring { position: relative; display: grid; justify-items: center; gap: 0.05rem; width: 6.2rem; }
  .ring svg { width: 58px; height: 58px; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--bg-2); stroke-width: 6; }
  .fill { fill: none; stroke: var(--c); stroke-width: 6; stroke-linecap: round; filter: drop-shadow(0 0 4px var(--c)); transition: stroke-dasharray 0.5s; }
  .pct { position: absolute; top: 19px; font-size: 0.78rem; font-weight: 700; }
  .rlabel { font-size: 0.75rem; text-align: center; }
  .rsub { font-size: 0.68rem; }
  .perfection { display: grid; gap: 0.2rem; font-size: 0.82rem; margin-left: auto; align-self: center; }

  .tier { margin-bottom: 1rem; }
  .tier h3 { margin: 0 0 0.45rem; }
  .cards { display: grid; gap: 0.45rem; grid-template-columns: repeat(auto-fill, minmax(7.2rem, 1fr)); }
  .card {
    position: relative; display: grid; justify-items: center; gap: 0.2rem; padding: 0.5rem 0.3rem 0.45rem; border-radius: 12px;
    border: 2px solid color-mix(in srgb, var(--el) 50%, var(--line));
    background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--el) 16%, transparent), var(--bg-2) 70%);
  }
  .card:hover { border-color: var(--el); transform: translateY(-2px); }
  .card.unknown { border-color: var(--line); background: var(--bg-2); }
  .card.unknown .art, .big.unknown, .node.unknown .art { filter: brightness(0) opacity(0.4); }
  .cname { font-size: 0.8rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .card.unknown .cname { color: var(--muted); }
  .dots { display: flex; gap: 3px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--c); opacity: 0.35; }
  .dot.on { background: var(--c); opacity: 1; box-shadow: 0 0 5px var(--c); }
  .marks { position: absolute; top: 4px; right: 6px; font-size: 0.75rem; color: var(--gold); }
  .hinted { position: absolute; top: 4px; left: 6px; font-size: 0.75rem; }

  .scroll { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
  th, td { padding: 0.35rem 0.5rem; text-align: center; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .group td { text-align: left; color: var(--violet); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; padding-top: 0.8rem; }
  .species { text-align: left; font-weight: 600; }
  .link { background: none; border: 0; padding: 0; font-weight: 600; }
  .link:hover { text-decoration: underline; }
  .cell { color: var(--line); }
  .cell.found { color: var(--c); text-shadow: 0 0 8px var(--c); }

  .tree section { margin-bottom: 1rem; }
  .nodes { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); }
  .node { display: flex; gap: 0.6rem; padding: 0.6rem; border-left: 3px solid var(--el); text-align: left; }
  .info { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.82rem; min-width: 0; }
  .el { color: var(--el); font-size: 0.75rem; }
  .origin { display: flex; flex-direction: column; margin-top: 0.2rem; }
  .req { font-size: 0.72rem; }
  .hint { font-style: italic; color: var(--gold); }

  .backdrop { position: fixed; inset: 0; background: #000b; z-index: 25; overflow-y: auto; padding: 1rem; display: flex; justify-content: center; align-items: flex-start; }
  .modal { width: min(760px, 100%); margin: 2rem 0 5rem; position: relative; border-color: var(--rc); box-shadow: 0 0 24px color-mix(in srgb, var(--rc) 35%, transparent); }
  .close { position: absolute; top: 0.6rem; right: 0.6rem; background: none; border: none; font-size: 1.2rem; }
  .dhead { display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 0.75rem; margin-bottom: 0.75rem; }
  .dhead h2 { margin: 0 0 0.3rem; }
  .big { flex: none; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--el) 25%, transparent), transparent 70%); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0 0 0.4rem; }
  .chip { font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid var(--c, var(--line)); color: var(--c, var(--text)); }
  .desc { margin: 0; color: var(--muted); }
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
  h4 { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .rars { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.4rem; }
  .rar { font-size: 0.78rem; padding: 0.1rem 0.45rem; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--c) 40%, transparent); color: color-mix(in srgb, var(--c) 45%, var(--muted)); }
  .rar.got { color: var(--c); border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
  .perf { display: grid; gap: 0.15rem; margin: 0 0 0.6rem; color: var(--muted); }
  .perf .got { color: var(--gold); }
  .stats { display: grid; grid-template-columns: 2.4rem 1fr 2rem; gap: 0.25rem 0.5rem; align-items: center; }
  .sbar { height: 7px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .sbar span { display: block; height: 100%; background: linear-gradient(90deg, var(--petrol), var(--el)); }
  .from { display: grid; gap: 0.15rem; padding: 0.45rem 0.55rem; border-radius: 10px; background: var(--bg-2); border: 1px solid var(--line); margin-bottom: 0.4rem; }
  .places { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .place { font-size: 0.78rem; padding: 0.1rem 0.45rem; border-radius: 6px; background: var(--panel-2); }
  .place.unknown { color: var(--muted); font-style: italic; }

  @media (max-width: 560px) {
    .perfection { margin-left: 0; }
    .ring { width: 5.2rem; }
    .dhead { flex-direction: column; text-align: center; }
    .chips { justify-content: center; }
  }
</style>
