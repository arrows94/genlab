<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import {
    ALLELE_SAMPLES, INTENT_INFO, ROOM_INFO, buyMeta, maxTorches, metaCost, salvageItem, salvageValue, chooseEventOption, chooseUpgrade, dungeonUnlocked, enterRoom, equipItem, leaveRpgRun, nextTorchAt,
    rpgCandidates, rpgHero, rpgSkills, startRpgRun, torches, useRpgSkill,
  } from '@core/features/rpg';
  import { foeIntent, heroPerks, heroStats, itemValues, rpgLevel, skillBlocker, thirdSkill, effectiveCooldown } from '@core/features/rpgCombat';
  import type { RpgGearSlot } from '@core/content/types';
  import type { RpgCombatant, RpgItem, RpgStatus } from '@core/state';
  import { game, view, act, ask, toast } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * GenLab RPG: pick a dungeon and a monster, then play room by room.
   * All rules live in core/features/rpg.ts; this view only shows state and calls actions.
   */
  const STATUS_ICON: Record<RpgStatus['id'], string> = {
    burn: '🔥', poison: '☠️', stun: '💫', slow: '🐌', shield: '🛡️', evade: '🌬️', regen: '🌿', armor: '🪨', reflect: '💎',
  };
  const STATUS_NAME: Record<RpgStatus['id'], string> = {
    burn: 'Brand', poison: 'Gift', stun: 'Betäubt', slow: 'Verlangsamt', shield: 'Schild', evade: 'Ausweichen', regen: 'Regeneration', armor: 'Panzerung', reflect: 'Rückstrahlung',
  };

  const SLOTS: { id: RpgGearSlot; name: string }[] = [{ id: 'weapon', name: 'Waffe' }, { id: 'armor', name: 'Panzer' }, { id: 'charm', name: 'Talisman' }];
  const VALUE_NAME: Record<string, string> = {
    hp: 'KP', atk: 'ANG', def: 'VER', spd: 'TMP', specialPower: 'Spezialangriff', chargePerRound: 'Aufladen je Runde', lifesteal: 'Lebensraub', crit: 'Krit-Chance', regen: 'KP je Runde',
  };
  /** „+12 % ANG · 4 % Krit-Chance“ */
  function itemText(item: RpgItem): string {
    const v = itemValues(game, item);
    return [
      ...Object.entries(v.stats).map(([k, x]) => `+${formatPercent(x ?? 0, 0)} ${VALUE_NAME[k]}`),
      ...Object.entries(v.perks).map(([k, x]) => `${k === 'specialPower' ? '+' : ''}${formatPercent(x ?? 0, 1)} ${VALUE_NAME[k]}`),
    ].join(' · ');
  }
  const rarityOf = (item: RpgItem) => content.rarities.get(item.rarity);
  const gearOf = (item: RpgItem) => content.rpgGear.get(item.gear);

  let pickedId: number | null = $state(null);
  let gearSlot: RpgGearSlot | null = $state(null);
  let pickedDungeon: string | null = $state(null);

  const data = $derived.by(() => {
    view.frame;
    const r = game.state.rpg;
    const run = r.run;
    const hero = rpgHero(game);
    const dungeons = content.rpgDungeons.list.map((d) => ({ d, open: dungeonUnlocked(game, d.id), cleared: r.cleared[d.id] ?? 0, best: r.best[d.id] ?? 0 }));
    const next = nextTorchAt(game);
    // Game state is mutated in place: hand the view copies, so every change reaches the template.
    return {
      lastResult: r.lastResult ? structuredClone(r.lastResult) : null,
      run: run ? structuredClone(run) : null,
      hero,
      torches: torches(game),
      maxTorches: maxTorches(game),
      runes: Math.floor((game.state.resources['runes']?.toNumber() ?? 0)),
      meta: content.rpgMeta.list.map((m) => ({ m, level: r.meta[m.id] ?? 0, cost: metaCost(game, m.id) })),
      nextIn: next === null ? null : Math.max(0, next - Date.now()),
      dungeons,
      candidates: run ? [] : rpgCandidates(game).slice(0, 40),
      skills: run ? rpgSkills(game) : [],
      perks: run ? heroPerks(game, run.upgrades) : null,
      maxHp: run && hero ? heroStats(game, hero, run.upgrades).hp : 1,
      heroLevel: hero ? rpgLevel(game, hero.id) : null,
      items: [...r.items],
      equipped: { ...r.equipped },
    };
  });

  const dungeonId = $derived(pickedDungeon ?? [...data.dungeons].reverse().find((x) => x.open)?.d.id ?? 'rootMaze');
  const picked = $derived(data.candidates.find((c) => c.id === pickedId) ?? data.candidates[0] ?? null);

  function start() {
    if (!picked) return;
    act(startRpgRun(game, picked.id, dungeonId));
  }
  async function leave() {
    const run = data.run;
    if (!run) return;
    const carried = Object.keys(run.loot).length > 0;
    if (await ask(carried ? 'Den Dungeon verlassen? Du nimmst alle Beute mit, der Lauf ist dann vorbei.' : 'Den Dungeon verlassen? Der Lauf ist dann vorbei.', { ok: 'Verlassen' })) {
      act(leaveRpgRun(game));
    }
  }
  function useSkill(id: string) {
    const before = game.state.rpg.run;
    if (!act(useRpgSkill(game, id))) return;
    const after = game.state.rpg.run;
    const res = game.state.rpg.lastResult;
    if (before && !after && res) toast(res.cleared ? `👑 ${content.rpgDungeons.get(res.dungeon).name} geschafft!` : res.win ? 'Lauf beendet.' : `💀 ${before.battle?.hero.name ?? 'Dein Monster'} ist gefallen.`, res.cleared ? 'rare' : res.win ? 'info' : 'error');
  }

  function lootList(loot: Record<string, number>): { icon: string; name: string; amount: number }[] {
    return Object.entries(loot).map(([res, amount]) =>
      res === ALLELE_SAMPLES ? { icon: '🧬', name: 'Genprobe', amount } : { icon: content.resources.get(res).icon, name: content.resources.get(res).name, amount },
    );
  }
  const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;
  function speciesLook(c: RpgCombatant) {
    const sp = content.species.get(c.speciesId);
    return { appearance: { hue: sp.hue, pattern: 'none', eyes: 'sharp', horn: 'none' }, shape: sp.shape, tier: sp.tier };
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
        {#each res.gear as item (item.id)}<span class="chip" style="border-color: {rarityOf(item).color}" title={itemText(item)}>{gearOf(item).icon} {gearOf(item).name} ({rarityOf(item).name})</span>{/each}
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
            <span class="small">{itemText(worn)}</span>
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
              <span class="small muted">{rarityOf(item).name} · {itemText(item)}</span>
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
{:else if data.hero}
  {@const run = data.run}
  {@const d = content.rpgDungeons.get(run.dungeon)}
  {@const sp = content.species.get(data.hero.speciesId)}
  <div class="run">
    <article class="panel hero-bar">
      <CreatureSvg appearance={expressedAppearance(game, data.hero)} shape={sp.shape} tier={sp.tier} size={56} shiny={data.hero.shiny} />
      <div class="hb-body">
        <div class="hb-title"><b>{data.hero.name}</b> <span class="small muted">Stufe {data.heroLevel?.level ?? 1} · {d.icon} {d.name} · Raum {run.depth}/{d.rooms + 1}</span></div>
        <div class="bar hp" title="KP"><div style="width: {pct(run.hp, data.maxHp)}"></div><span class="num">{formatNumber(run.hp)} / {formatNumber(data.maxHp)} KP</span></div>
        <div class="bar xp" title="Erfahrung bis zur nächsten Stufe"><div style="width: {data.heroLevel && data.heroLevel.need > 0 ? pct(data.heroLevel.into, data.heroLevel.need) : '100%'}"></div></div>
        {#if run.upgrades.length > 0}
          <div class="ups">{#each run.upgrades as u, i (i)}<span title="{content.rpgUpgrades.get(u).name}: {content.rpgUpgrades.get(u).description}">{content.rpgUpgrades.get(u).icon}</span>{/each}</div>
        {/if}
        <div class="loot small">
          {#each lootList(run.loot) as l (l.name)}<span class="chip carried" title="Getragen – bei einer Niederlage geht ein Teil verloren">{l.icon} {formatNumber(l.amount)}</span>{/each}
          {#each lootList(run.secured) as l (l.name)}<span class="chip safe" title="Gesichert">🔒 {l.icon} {formatNumber(l.amount)}</span>{/each}
          {#each run.gear as item (item.id)}<span class="chip carried" style="border-color: {rarityOf(item).color}" title="Getragen – bei einer Niederlage verloren · {itemText(item)}">{gearOf(item).icon} {gearOf(item).name}</span>{/each}
          {#each run.securedGear as item (item.id)}<span class="chip safe" title="Gesichert · {itemText(item)}">🔒 {gearOf(item).icon} {gearOf(item).name}</span>{/each}
        </div>
      </div>
    </article>

    {#if run.battle}
      {@const b = run.battle}
      {@const intent = INTENT_INFO[foeIntent(game, b.foe)]}
      {@const fl = speciesLook(b.foe)}
      {@const heroHits = (b.last ?? []).filter((e) => e.by === 'foe' && e.kind === 'hit')}
      {@const foeHits = (b.last ?? []).filter((e) => e.by === 'hero' && e.kind === 'hit')}
      <article class="panel arena" style="--foe: {content.elements.get(b.foe.element).color}; --hero: {content.elements.get(b.hero.element).color}">
        <div class="fighter">
          {#key b.round}
            <div class="fx" class:hurt={heroHits.length > 0}>
              <CreatureSvg appearance={expressedAppearance(game, data.hero)} shape={sp.shape} tier={sp.tier} size={84} shiny={data.hero.shiny} />
              {#each heroHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">−{formatNumber(h.dmg ?? 0)}</span>{/each}
            </div>
          {/key}
          <div class="bar hp small-bar"><div style="width: {pct(b.hero.hp, b.hero.maxHp)}"></div><span class="num">{formatNumber(b.hero.hp)}</span></div>
          <div class="statuses">{#each b.hero.statuses as st (st.id)}<span title="{STATUS_NAME[st.id]} ({st.rounds} Runden)">{STATUS_ICON[st.id]}{st.rounds}</span>{/each}</div>
        </div>
        <div class="round small muted">Runde {b.round}</div>
        <div class="fighter foe" class:boss={b.foe.kind === 'boss'} class:elite={b.foe.kind === 'elite'}>
          <span class="intent" title={intent.hint}>{intent.icon} {intent.name}</span>
          {#key b.round}
            <div class="fx" class:hurt={foeHits.length > 0}>
              <CreatureSvg appearance={fl.appearance} shape={fl.shape} tier={fl.tier} size={b.foe.kind === 'normal' ? 84 : 100} />
              {#each foeHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">−{formatNumber(h.dmg ?? 0)}</span>{/each}
            </div>
          {/key}
          <span class="small f-name">{b.foe.kind === 'boss' ? '👑 ' : b.foe.kind === 'elite' ? '💀 ' : ''}{b.foe.name}</span>
          <div class="bar hp foe-hp small-bar"><div style="width: {pct(b.foe.hp, b.foe.maxHp)}"></div><span class="num">{formatNumber(b.foe.hp)}</span></div>
          <div class="statuses">{#each b.foe.statuses as st (st.id)}<span title="{STATUS_NAME[st.id]} ({st.rounds} Runden)">{STATUS_ICON[st.id]}{st.rounds}</span>{/each}</div>
        </div>
      </article>
      <ul class="log small">{#each b.log as line, i (i)}<li>{line}</li>{/each}</ul>
      <div class="skills">
        {#each data.skills as k (k.id)}
          {@const blocked = skillBlocker(b, k)}
          {@const cd = b.cooldowns[k.id] ?? 0}
          <button class="skill" class:special={k.slot === 'special'} disabled={!!blocked} title="{k.description}{effectiveCooldown(k, data.perks ?? {}) > 0 ? ` Abklingzeit: ${effectiveCooldown(k, data.perks ?? {})} Runden.` : ''}" onclick={() => useSkill(k.id)}>
            <span class="k-icon">{k.icon}</span>
            <span class="k-name">{k.name}</span>
            {#if k.slot === 'special'}
              <span class="charge"><span style="width: {pct(b.charge, 1)}"></span></span>
            {:else if cd > 0}
              <span class="cd num">{cd}</span>
            {/if}
          </button>
        {/each}
      </div>
    {:else if run.offer.length > 0}
      <article class="panel">
        <h3>⬆️ Wähle eine Verbesserung für diesen Lauf{run.pendingLevels > 0 ? ` (noch ${run.pendingLevels} weitere)` : ''}</h3>
        <div class="choices">
          {#each run.offer as id, i (id)}
            {@const u = content.rpgUpgrades.get(id)}
            <button class="choice" onclick={() => act(chooseUpgrade(game, i))}>
              <span class="c-icon">{u.icon}</span><b>{u.name}</b><span class="small muted">{u.description}</span>
            </button>
          {/each}
        </div>
      </article>
    {:else if run.event}
      {@const ev = content.rpgEvents.get(run.event)}
      <article class="panel event">
        <h3>{ev.icon} {ev.name}</h3>
        <p>{ev.text}</p>
        <div class="choices">
          {#each ev.options as o, i (i)}
            <button class="choice" onclick={() => act(chooseEventOption(game, i))}>
              <b>{o.label}</b>{#if o.chance !== undefined && o.chance < 1}<span class="small muted">Chance {Math.round(o.chance * 100)} %</span>{/if}
            </button>
          {/each}
        </div>
      </article>
    {:else}
      {#if run.eventResult}<p class="panel small event-result">{run.eventResult}</p>{/if}
      <article class="panel">
        <h3>Wohin als Nächstes?</h3>
        <div class="choices">
          {#each run.choices as kind, i (kind)}
            {@const info = ROOM_INFO[kind]}
            <button class="choice room" class:boss={kind === 'boss'} onclick={() => act(enterRoom(game, i))}>
              <span class="c-icon">{info.icon}</span><b>{info.name}</b><span class="small muted">{info.hint}</span>
            </button>
          {/each}
        </div>
      </article>
      <div class="start-bar"><button onclick={leave}>🚪 Dungeon verlassen (Beute mitnehmen)</button></div>
    {/if}
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
  .chip.safe { border-color: var(--teal); }
  .dungeons { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.4rem; margin-bottom: 0.5rem; }
  .dungeon { display: grid; justify-items: center; gap: 0.15rem; text-align: center; }
  .dungeon.active, .pick.active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--panel-2)); }
  .d-icon { font-size: 1.6rem; }
  .d-name { font-weight: 600; }
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

  .hero-bar { display: flex; gap: 0.7rem; align-items: center; }
  .hb-body { flex: 1; display: grid; gap: 0.3rem; min-width: 0; }
  .bar { position: relative; height: 14px; border-radius: 99px; background: var(--bg-2); border: 1px solid var(--line); overflow: hidden; }
  .bar > div { height: 100%; transition: width 0.3s; }
  .bar span { position: absolute; inset: 0; font-size: 0.7rem; line-height: 12px; text-align: center; }
  .bar.hp > div { background: linear-gradient(90deg, #2e9d5b, #8fd16a); }
  .bar.foe-hp > div { background: linear-gradient(90deg, #b3372f, #ff8a50); }
  .bar.xp { height: 6px; }
  .bar.xp > div { background: var(--violet); }
  .ups { display: flex; flex-wrap: wrap; gap: 0.15rem; }

  .arena { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 0.5rem; background: linear-gradient(90deg, color-mix(in srgb, var(--hero) 12%, var(--panel)), var(--panel), color-mix(in srgb, var(--foe) 14%, var(--panel))); }
  .fighter { display: grid; justify-items: center; gap: 0.25rem; min-width: 0; }
  .fighter.foe :global(svg) { transform: scaleX(-1); }
  .fighter.elite :global(svg) { filter: drop-shadow(0 0 6px var(--danger)); }
  .fighter.boss :global(svg) { filter: drop-shadow(0 0 10px var(--gold)); }
  .small-bar { width: 100%; max-width: 160px; }
  .fx { position: relative; display: grid; justify-items: center; }
  .fx.hurt { animation: hurt 0.35s ease-out; }
  @keyframes hurt {
    0%, 100% { transform: translateX(0); filter: none; }
    20% { transform: translateX(-6px); filter: brightness(1.8) saturate(0.4); }
    45% { transform: translateX(5px); }
    70% { transform: translateX(-3px); }
  }
  .dmg-float { position: absolute; top: 10%; left: 50%; transform: translateX(-50%); font-weight: 800; color: #ffb4a8; text-shadow: 0 1px 2px #000; pointer-events: none;
    animation: float-up 0.9s ease-out forwards; animation-delay: calc(var(--i) * 0.12s); }
  .dmg-float.crit { color: var(--gold); font-size: 1.15rem; }
  @keyframes float-up { from { opacity: 1; translate: 0 0; } to { opacity: 0; translate: 0 -28px; } }
  .f-name { text-align: center; }
  .round { align-self: center; }
  .intent { padding: 0.15rem 0.5rem; border-radius: 99px; border: 1px solid var(--foe); background: var(--bg-2); font-size: 0.8rem; white-space: nowrap; }
  .statuses { display: flex; gap: 0.25rem; min-height: 1.1rem; font-size: 0.8rem; }
  .log { list-style: none; margin: 0 0 0.6rem; padding: 0.4rem 0.6rem; border-radius: var(--radius); background: var(--bg-2); border: 1px solid var(--line); min-height: 5.5rem; }
  .log li { opacity: 0.6; }
  .log li:nth-last-child(-n + 3) { opacity: 1; }

  /* Skill buttons at the bottom, in thumb reach on phones. */
  .skills { position: sticky; bottom: 0.4rem; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.4rem; z-index: 2; padding: 0.3rem; border-radius: var(--radius); background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(4px); }
  .skill { position: relative; display: grid; justify-items: center; gap: 0.1rem; padding: 0.5rem 0.2rem; min-height: 64px; }
  .skill.special:not(:disabled) { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 16%, var(--panel-2)); }
  .k-icon { font-size: 1.4rem; }
  .k-name { font-size: 0.75rem; line-height: 1.1; text-align: center; }
  .cd { position: absolute; top: 0.2rem; right: 0.35rem; font-size: 0.75rem; color: var(--gold); }
  .charge { width: 80%; height: 4px; border-radius: 99px; background: var(--bg-2); overflow: hidden; }
  .charge span { display: block; height: 100%; background: var(--gold); }

  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
  .choice { display: grid; justify-items: center; gap: 0.2rem; text-align: center; padding: 0.8rem 0.5rem; }
  .choice.boss { border-color: var(--gold); }
  .c-icon { font-size: 1.8rem; }
  .event-result { font-style: italic; }

  @media (max-width: 640px) {
    .skills, .start-bar { bottom: calc(var(--dock-h, 5rem) + 0.3rem); z-index: 5; }
  }
  @media (max-width: 520px) {
    .arena { grid-template-columns: 1fr 1fr; }
    .round { display: none; }
  }
</style>
