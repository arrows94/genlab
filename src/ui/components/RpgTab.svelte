<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import {
    buyMeta, dungeonLevels, maxTorches, metaCost, salvageItem, salvageValue, dungeonUnlocked, equipItem, nextTorchAt,
    rpgCandidates, startRpgRun, torches,
  } from '@core/features/rpg';
  import { heroStats, rpgLevel, thirdSkill } from '@core/features/rpgCombat';
  import type { RpgGearSlot } from '@core/content/types';
  import { game, view, act, portalDone, startPortal } from '../store.svelte';
  import { gearOf, itemText, lootList, rarityOf } from '../rpgView';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * GenLab RPG in the lab: pick a dungeon and a monster, equipment and Runen-Wissen. The run itself happens in
   * the other world (RpgWorld). All rules live in core/features/rpg.ts; this view only shows state and calls actions.
   */
  const SLOTS: { id: RpgGearSlot; name: string }[] = [{ id: 'weapon', name: 'Waffe' }, { id: 'armor', name: 'Panzer' }, { id: 'charm', name: 'Talisman' }];

  let pickedId: number | null = $state(null);
  let gearSlot: RpgGearSlot | null = $state(null);
  let pickedDungeon: string | null = $state(null);

  const data = $derived.by(() => {
    view.frame;
    const r = game.state.rpg;
    const run = r.run;
    const dungeons = content.rpgDungeons.list.map((d) => ({ d, levels: dungeonLevels(game, d.id), open: dungeonUnlocked(game, d.id), cleared: r.cleared[d.id] ?? 0, best: r.best[d.id] ?? 0 }));
    const next = nextTorchAt(game);
    // Game state is mutated in place: hand the view copies, so every change reaches the template.
    return {
      lastResult: r.lastResult ? structuredClone(r.lastResult) : null,
      run: run ? structuredClone(run) : null,
      torches: torches(game),
      maxTorches: maxTorches(game),
      runes: Math.floor((game.state.resources['runes']?.toNumber() ?? 0)),
      meta: content.rpgMeta.list.map((m) => ({ m, level: r.meta[m.id] ?? 0, cost: metaCost(game, m.id) })),
      nextIn: next === null ? null : Math.max(0, next - Date.now()),
      dungeons,
      candidates: run ? [] : rpgCandidates(game).slice(0, 40),
      items: [...r.items],
      equipped: { ...r.equipped },
    };
  });

  const dungeonId = $derived(pickedDungeon ?? [...data.dungeons].reverse().find((x) => x.open)?.d.id ?? 'rootMaze');
  const picked = $derived(data.candidates.find((c) => c.id === pickedId) ?? data.candidates[0] ?? null);

  function start() {
    if (!picked) return;
    // The portal must be open before the run starts, or the other world would show at once.
    const id = picked.id;
    startPortal('in', id);
    if (!act(startRpgRun(game, id, dungeonId))) portalDone();
  }
</script>

<header class="tab-head">
  <h2>🔥 GenLab RPG</h2>
  <span class="torch-count" title="Jeder Lauf kostet eine Fackel. Alle {game.balance.rpg.torchHours} Stunden kommt eine neue dazu, bis {data.maxTorches} im Vorrat.">
    🔥 <b class="num">{data.torches}/{data.maxTorches}</b>
    {#if data.nextIn !== null}<span class="muted small">· nächste in {formatDuration(data.nextIn)}</span>{/if}
  </span>
</header>

{#if !data.run}
  {#if data.lastResult}
    {@const res = data.lastResult}
    <article class="panel result" class:won={res.cleared} class:lost={!res.win}>
      <h3>{res.cleared ? '👑 Dungeon geschafft!' : res.win ? '🚪 Lauf beendet' : '💀 Niederlage'}</h3>
      <p class="small">
        {content.rpgDungeons.get(res.dungeon).name} · Raum {res.depth} · Stufe {res.startLevel !== undefined && res.startLevel < res.level ? `${res.startLevel} → ${res.level}` : res.level}
        {#if !res.win}· Nur gesicherte Beute und {Math.round(game.balance.rpg.defeatKeep * 100)} % der getragenen bleiben.{/if}
      </p>
      <div class="loot">
        {#each lootList(res.loot) as l (l.name)}<span class="chip">{l.icon} {formatNumber(l.amount)} {l.name}</span>{:else}<span class="muted small">Keine Beute.</span>{/each}
        {#each res.gear as item (item.id)}<span class="chip" style="border-color: {rarityOf(item).color}" title={itemText(game, item)}>{gearOf(item).icon} {gearOf(item).name} ({rarityOf(item).name})</span>{/each}
      </div>
    </article>
  {/if}

  <article class="panel">
    <h3>Dungeon</h3>
    <div class="dungeons">
      {#each data.dungeons as x (x.d.id)}
        <button class="dungeon" class:active={dungeonId === x.d.id} disabled={!x.open} onclick={() => (pickedDungeon = x.d.id)}>
          <span class="d-icon">{x.open ? x.d.icon : '🔒'}</span>
          <span class="d-name">{x.d.name}</span>
          <span class="small d-level" title="Stufe der Gegner vom ersten Raum bis zum Boss">Stufe {x.levels.from}–{x.levels.boss}</span>
          <span class="small muted">{x.open ? (x.cleared > 0 ? `👑 ×${x.cleared}` : x.best > 0 ? `bis Raum ${x.best}` : `${x.d.rooms} Räume + Boss`) : 'Vorigen Dungeon besiegen'}</span>
        </button>
      {/each}
    </div>
    <p class="small muted">{content.rpgDungeons.get(dungeonId).description}
      Elemente: {content.rpgDungeons.get(dungeonId).elements.map((e) => content.elements.get(e).name).join(', ')}.</p>
  </article>

  <article class="panel">
    <h3>Monster</h3>
    {#if data.candidates.length === 0}
      <p class="muted small">Gerade ist kein Monster frei.</p>
    {:else}
      <div class="picker">
        {#each data.candidates as c (c.id)}
          {@const sp = content.species.get(c.speciesId)}
          {@const s = heroStats(game, c)}
          {@const lv = rpgLevel(game, c.id).level}
          <button class="pick" class:active={picked?.id === c.id} onclick={() => (pickedId = c.id)}>
            <CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={44} shiny={c.shiny} />
            <span class="p-body">
              <span class="p-name">{c.name} <span class="rank" title="Stufe in der anderen Welt – dort zählt nur, was dein Monster im Dungeon erlebt hat">Stufe {lv}</span></span>
              <span class="small muted num">KP {formatNumber(s.hp)} · ANG {formatNumber(s.atk)} · VER {formatNumber(s.def)} · TMP {formatNumber(s.spd)}</span>
              <span class="small">{content.elements.get(sp.element).name} · {thirdSkill(game, c).icon} {thirdSkill(game, c).name}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </article>

  <article class="panel">
    <h3>Ausrüstung <span class="small muted">{data.items.length}/{game.balance.rpg.maxItems} · passt jedem Monster, wirkt nur im Dungeon</span></h3>
    <div class="slots">
      {#each SLOTS as slot (slot.id)}
        {@const worn = data.items.find((i) => i.id === data.equipped[slot.id])}
        <button class="slot" class:active={gearSlot === slot.id} onclick={() => (gearSlot = gearSlot === slot.id ? null : slot.id)}>
          <span class="small muted">{slot.name}</span>
          {#if worn}
            <span class="g-name" style="color: {rarityOf(worn).color}">{gearOf(worn).icon} {gearOf(worn).name}</span>
            <span class="small">{itemText(game, worn)}</span>
          {:else}
            <span class="muted">– leer –</span>
          {/if}
        </button>
      {/each}
    </div>
    {#if gearSlot}
      {@const slot = gearSlot}
      {@const list = data.items.filter((i) => gearOf(i).slot === slot).sort((a, b) => rarityOf(b).order - rarityOf(a).order)}
      {#if data.equipped[slot] !== null}<button class="take-off small" onclick={() => act(equipItem(game, slot, null))}>Ablegen</button>{/if}
      <div class="gear-list">
        {#each list as item (item.id)}
          <div class="gear-row">
            <button class="gear" class:active={data.equipped[slot] === item.id} style="border-color: {rarityOf(item).color}" onclick={() => act(equipItem(game, slot, item.id))}>
              <span class="g-name" style="color: {rarityOf(item).color}">{gearOf(item).icon} {gearOf(item).name}</span>
              <span class="small muted">{rarityOf(item).name} · {itemText(game, item)}</span>
            </button>
            {#if data.equipped[slot] !== item.id}
              <button class="salvage" title="Zerlegen: +{salvageValue(game, item)} 🪬 Runen" onclick={() => act(salvageItem(game, item.id))}>🪬 {salvageValue(game, item)}</button>
            {/if}
          </div>
        {:else}
          <p class="small muted">Noch nichts gefunden – Bosse lassen immer etwas fallen, Elite-Gegner und Schätze manchmal.</p>
        {/each}
      </div>
    {/if}
  </article>

  <article class="panel">
    <h3>Runen-Wissen <span class="small muted">🪬 {formatNumber(data.runes)} Runen · bleibt für immer</span></h3>
    <div class="meta">
      {#each data.meta as x (x.m.id)}
        <button class="meta-item" disabled={x.cost === null || data.runes < x.cost} onclick={() => act(buyMeta(game, x.m.id))} title={x.m.description}>
          <span class="c-icon">{x.m.icon}</span>
          <b>{x.m.name} <span class="small muted">{x.level}/{x.m.maxLevel}</span></b>
          <span class="small muted">{x.m.description}</span>
          <span class="small">{x.cost === null ? '✔ Höchste Stufe' : `${formatNumber(x.cost)} 🪬`}</span>
        </button>
      {/each}
    </div>
  </article>

  <div class="start-bar">
    <button class="primary start" disabled={!picked || data.torches < 1} onclick={start}>
      {picked ? `${picked.name} schicken` : 'Monster wählen'} · 1 🔥
    </button>
  </div>
{/if}

<style>
  .torch-count { font-size: 0.95rem; }
  .small { font-size: 0.8rem; }
  h3 { margin: 0 0 0.5rem; }
  .panel { margin-bottom: 0.8rem; }
  .result.won { border-color: var(--gold); }
  .result.lost { border-color: var(--danger); }
  .loot { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip { padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid var(--line); background: var(--bg-2); white-space: nowrap; }
  .dungeons { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.4rem; margin-bottom: 0.5rem; }
  .dungeon { display: grid; justify-items: center; gap: 0.15rem; text-align: center; }
  .dungeon.active, .pick.active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel-2)); }
  .d-icon { font-size: 1.6rem; }
  .d-name { font-weight: 600; }
  .d-level { color: var(--gold); }
  .picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.4rem; max-height: 50vh; overflow-y: auto; }
  .pick { display: flex; gap: 0.5rem; align-items: center; text-align: left; padding: 0.35rem 0.5rem; }
  .p-body { display: grid; min-width: 0; }
  .p-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rank { color: var(--gold); font-size: 0.8rem; }
  .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.4rem; }
  .slot { display: grid; justify-items: center; gap: 0.1rem; text-align: center; padding: 0.5rem 0.3rem; }
  .slot.active, .gear.active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel-2)); }
  .g-name { font-weight: 600; }
  .gear-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem; margin-top: 0.5rem; }
  .gear-row { display: flex; gap: 0.3rem; }
  .take-off { margin-top: 0.5rem; padding: 0.3rem 0.7rem; }
  .gear { flex: 1; display: grid; text-align: left; gap: 0.1rem; padding: 0.4rem 0.6rem; }
  .salvage { flex: none; padding: 0.3rem 0.5rem; font-size: 0.8rem; }
  .meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.4rem; }
  .meta-item { display: grid; justify-items: center; gap: 0.15rem; text-align: center; padding: 0.6rem 0.4rem; }
  .start-bar { position: sticky; bottom: 0.5rem; display: flex; justify-content: center; padding: 0.4rem 0; z-index: 2; }
  .start { min-width: min(100%, 320px); font-size: 1.05rem; }

  @media (max-width: 640px) {
    .start-bar { bottom: calc(var(--dock-h, 5rem) + 0.3rem); z-index: 5; }
  }
</style>
