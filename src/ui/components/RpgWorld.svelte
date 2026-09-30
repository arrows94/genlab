<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber } from '@core/format';
  import { INTENT_INFO, ROOM_INFO, chooseEventOption, chooseUpgrade, enterRoom, giveUpRpgRun, leaveRpgRun, rpgHero, rpgSkills, useRpgSkill } from '@core/features/rpg';
  import { foeIntent, heroPerks, heroStats, rpgLevel, skillBlocker, effectiveCooldown } from '@core/features/rpgCombat';
  import { game, view, act, ask, leaveWorld, startPortal } from '../store.svelte';
  import { prefs, updatePrefs } from '../prefs.svelte';
  import { STATUS_ICON, STATUS_NAME, gearOf, itemText, lootList, pct, rarityOf, speciesLook } from '../rpgView';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * The other world (Isekai): while a GenLab RPG run lasts, the app shows only this – no tabs, no resources,
   * no news from the lab. After the run the result stays until the player goes back to the lab.
   * All rules live in core/features/rpg.ts; this view only shows state and calls actions.
   */
  let menuOpen = $state(false);

  const data = $derived.by(() => {
    view.frame;
    const r = game.state.rpg;
    const run = r.run;
    const hero = rpgHero(game);
    // Game state is mutated in place: hand the view copies, so every change reaches the template.
    return {
      lastResult: r.lastResult ? structuredClone(r.lastResult) : null,
      run: run ? structuredClone(run) : null,
      hero,
      skills: run ? rpgSkills(game) : [],
      perks: run ? heroPerks(game, run.upgrades) : null,
      maxHp: run && hero ? heroStats(game, hero, run.upgrades).hp : 1,
      heroLevel: hero ? rpgLevel(game, hero.id) : null,
    };
  });

  async function leave() {
    const run = data.run;
    if (!run) return;
    const carried = Object.keys(run.loot).length > 0 || run.gear.length > 0;
    if (await ask(carried ? 'Den Dungeon verlassen? Du nimmst alle Beute mit, der Lauf ist dann vorbei.' : 'Den Dungeon verlassen? Der Lauf ist dann vorbei.', { ok: 'Verlassen' })) {
      act(leaveRpgRun(game));
    }
  }
  async function giveUp() {
    menuOpen = false;
    const fighting = !!data.run?.battle;
    const text = fighting
      ? `Mitten im Kampf aufgeben? Das zählt als Niederlage: Nur gesicherte Beute und ${Math.round(game.balance.rpg.defeatKeep * 100)} % der getragenen bleiben.`
      : 'Aufgeben und zurückkehren? Du nimmst alle Beute mit, der Lauf ist dann vorbei.';
    if (await ask(text, { ok: 'Aufgeben', danger: fighting })) act(giveUpRpgRun(game));
  }
  /** Back through the portal – the monster is thrown out into the lab (straight back if it is gone). */
  function goBack(creatureId: number | undefined) {
    if (creatureId !== undefined && game.state.creatures.some((c) => c.id === creatureId)) startPortal('out', creatureId);
    else leaveWorld();
  }
  function useSkill(id: string) {
    act(useRpgSkill(game, id));
  }
</script>

<div class="world">
  <header class="world-bar">
    <span class="realm">🌀 Die andere Welt{data.run ? ` · ${content.rpgDungeons.get(data.run.dungeon).icon} ${content.rpgDungeons.get(data.run.dungeon).name}` : ''}</span>
    <div class="menu">
      <button class="menu-btn" aria-label="Menü" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>☰</button>
      {#if menuOpen}
        <div class="menu-pop" role="menu">
          <button role="menuitem" onclick={() => updatePrefs({ sound: !prefs.sound })}>{prefs.sound ? '🔊 Ton aus' : '🔈 Ton an'}</button>
          {#if data.run}<button role="menuitem" class="danger" onclick={giveUp}>🏳️ Aufgeben</button>{/if}
        </div>
      {/if}
    </div>
  </header>

{#if data.run && data.hero}
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
          {#each run.gear as item (item.id)}<span class="chip carried" style="border-color: {rarityOf(item).color}" title="Getragen – bei einer Niederlage verloren · {itemText(game, item)}">{gearOf(item).icon} {gearOf(item).name}</span>{/each}
          {#each run.securedGear as item (item.id)}<span class="chip safe" title="Gesichert · {itemText(game, item)}">🔒 {gearOf(item).icon} {gearOf(item).name}</span>{/each}
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
              {#each heroHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">{h.dmg ? `−${formatNumber(h.dmg)}` : '🛡️'}</span>{/each}
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
              {#each foeHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">{h.dmg ? `−${formatNumber(h.dmg)}` : '🛡️'}</span>{/each}
            </div>
          {/key}
          <span class="small f-name">{b.foe.kind === 'boss' ? '👑 ' : b.foe.kind === 'elite' ? '💀 ' : ''}{b.foe.name}{b.foe.level ? ` · Stufe ${b.foe.level}` : ''}</span>
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
      <div class="leave-bar"><button onclick={leave}>🚪 Dungeon verlassen (Beute mitnehmen)</button></div>
    {/if}
  </div>
{:else if data.lastResult}
  {@const res = data.lastResult}
  <article class="panel result" class:won={res.cleared} class:lost={!res.win}>
    <h2>{res.cleared ? '👑 Dungeon geschafft!' : res.win ? '🚪 Lauf beendet' : '💀 Niederlage'}</h2>
    <p class="small">
      {content.rpgDungeons.get(res.dungeon).name} · Raum {res.depth} · Stufe {res.startLevel !== undefined && res.startLevel < res.level ? `${res.startLevel} → ${res.level}` : res.level}
      {#if !res.win}· Nur gesicherte Beute und {Math.round(game.balance.rpg.defeatKeep * 100)} % der getragenen bleiben.{/if}
    </p>
    <div class="loot">
      {#each lootList(res.loot) as l (l.name)}<span class="chip">{l.icon} {formatNumber(l.amount)} {l.name}</span>{:else}<span class="muted small">Keine Beute.</span>{/each}
      {#each res.gear as item (item.id)}<span class="chip" style="border-color: {rarityOf(item).color}" title={itemText(game, item)}>{gearOf(item).icon} {gearOf(item).name} ({rarityOf(item).name})</span>{/each}
    </div>
    <button class="primary back" disabled={!!view.portal} onclick={() => goBack(res.creatureId)}>🧬 Zurück ins Labor</button>
  </article>
{:else}
  <article class="panel result">
    <p>Das Portal ist still.</p>
    <button class="primary back" onclick={leaveWorld}>🧬 Zurück ins Labor</button>
  </article>
{/if}
</div>

<style>
  /* The other world fills the screen; its own look follows in a later step. */
  .world { max-width: 900px; margin: 0 auto; padding: calc(0.6rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom)); min-height: 100vh; }
  .world-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.8rem; }
  .realm { font-weight: 700; letter-spacing: 0.03em; }
  .menu { position: relative; }
  .menu-btn { padding: 0.35rem 0.7rem; }
  .menu-pop { position: absolute; right: 0; top: calc(100% + 0.3rem); z-index: 20; display: grid; gap: 0.3rem; min-width: 11rem; padding: 0.4rem; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--line); box-shadow: 0 8px 20px #0008; }
  .menu-pop button { text-align: left; }
  .small { font-size: 0.8rem; }
  h2, h3 { margin: 0 0 0.5rem; }
  .panel { margin-bottom: 0.8rem; }
  .result { display: grid; gap: 0.6rem; justify-items: start; }
  .result.won { border-color: var(--gold); }
  .result.lost { border-color: var(--danger); }
  .back { font-size: 1.05rem; }
  .loot { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .chip { padding: 0.1rem 0.5rem; border-radius: 99px; border: 1px solid var(--line); background: var(--bg-2); white-space: nowrap; }
  .chip.safe { border-color: var(--teal); }
  .leave-bar { display: flex; justify-content: center; padding: 0.4rem 0; }
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
  .skills { position: sticky; bottom: calc(0.4rem + env(safe-area-inset-bottom)); display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.4rem; z-index: 2; padding: 0.3rem; border-radius: var(--radius); background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(4px); }
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

  @media (max-width: 520px) {
    .arena { grid-template-columns: 1fr 1fr; }
    .round { display: none; }
  }
</style>
