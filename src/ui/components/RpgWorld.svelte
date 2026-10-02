<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatNumber, formatPercent } from '@core/format';
  import { INTENT_INFO, ROOM_INFO, chooseEventOption, guardianRoom, isGuardianNext, closeRpgAftermath, chooseUpgrade, drinkRpgFlask, enterRoom, giveUpRpgRun, leaveRpgRun, rpgDefense, rpgFlasks, rpgHero, rpgSkills, useRpgSkill } from '@core/features/rpg';
  import { foeIntent, heroPerks, heroStats, maxPoise, rpgLevel, skillBlocker, effectiveCooldown } from '@core/features/rpgCombat';
  import { game, view, act, ask, leaveWorld, startPortal } from '../store.svelte';
  import type { Creature, RpgAftermath, RpgBattle, RpgCombatant } from '@core/state';
  import { prefs, updatePrefs } from '../prefs.svelte';
  import { STATUS_ICON, STATUS_NAME, gearOf, itemText, lootList, pct, rarityOf, speciesLook } from '../rpgView';
  import CreatureSvg from './CreatureSvg.svelte';
  import Meter from './Meter.svelte';

  /**
   * The other world (Isekai): while a GenLab RPG run lasts, the app shows only this – no tabs, no resources,
   * no news from the lab. Its own look: dark stone, torchlight and parchment. After the run the result stays
   * until the player goes back to the lab. All rules live in core/features/rpg.ts; this view only shows state
   * and calls actions.
   */
  /** The boss door: a fog gate, like the last threshold before a lord of the dungeon. */
  const FOG_GATE = { name: 'Nebeltor', icon: '🌫️', hint: 'Dahinter wartet der Boss. Kein Zurück, bis einer fällt.' };
  let menuOpen = $state(false);
  const GUARDIAN_INFO = { icon: '🛡️', name: 'Wächter', hint: 'Ein starker Elite-Gegner bewacht die Mitte des Dungeons – an ihm führt kein Weg vorbei.' };

  const data = $derived.by(() => {
    view.frame;
    const r = game.state.rpg;
    const run = r.run;
    const hero = rpgHero(game);
    const dungeonId = run?.dungeon ?? r.lastResult?.dungeon ?? null;
    const dungeon = dungeonId && content.rpgDungeons.has(dungeonId) ? content.rpgDungeons.get(dungeonId) : null;
    // Game state is mutated in place: hand the view copies, so every change reaches the template.
    return {
      lastResult: r.lastResult ? structuredClone(r.lastResult) : null,
      run: run ? structuredClone(run) : null,
      hero,
      dungeon,
      /** The dungeon's colour lights the other world. */
      realm: dungeon ? content.elements.get(dungeon.elements[0]!).color : '#9b6bff',
      skills: run ? rpgSkills(game) : [],
      defense: run ? rpgDefense(game) : [],
      flasks: rpgFlasks(game),
      perks: run ? heroPerks(game, run.upgrades) : null,
      maxHp: run && hero ? heroStats(game, hero, run.upgrades).hp : 1,
      heroLevel: hero ? rpgLevel(game, hero.id) : null,
      /** The monster of the finished run (for its last fight). */
      resultHero: r.lastResult?.creatureId !== undefined ? (game.state.creatures.find((c) => c.id === r.lastResult!.creatureId) ?? null) : null,
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
      ? `Mitten im Kampf aufgeben? Das zählt als Niederlage: Nur gesicherte Beute und ${formatPercent(game.balance.rpg.defeatKeep, 0)} der getragenen bleiben.`
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

{#snippet arena(b: RpgBattle, heroC: Creature, ended?: 'win' | 'lose')}
  {@const sp = content.species.get(heroC.speciesId)}
  {@const intent = INTENT_INFO[foeIntent(game, b.foe)]}
  {@const fl = speciesLook(b.foe)}
  {@const heroHits = (b.last ?? []).filter((e) => e.by === 'foe' && e.kind === 'hit')}
  {@const foeHits = (b.last ?? []).filter((e) => e.by === 'hero' && e.kind === 'hit')}
  <section class="arena" class:ended={!!ended} class:phase2={b.foe.phase === 2} style="--foe: {content.elements.get(b.foe.element).color}; --hero: {content.elements.get(b.hero.element).color}">
    <span class="round">Runde {b.round}</span>
    <div class="fighter">
      {#key b.round}
        <div class="fx" class:hurt={heroHits.length > 0} class:ko={ended === 'lose'}>
          <CreatureSvg appearance={expressedAppearance(game, heroC)} shape={sp.shape} tier={sp.tier} size={88} shiny={heroC.shiny} />
          {#each heroHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">{h.dmg ? `−${formatNumber(h.dmg)}` : '🛡️'}</span>{/each}
        </div>
      {/key}
      <div class="bar blood small-bar"><div style="width: {pct(b.hero.hp, b.hero.maxHp)}"></div><span class="num">{formatNumber(b.hero.hp)}</span></div>
      {@render poise(b.hero)}
      {#if !ended}
        {@const stamina = b.stamina ?? game.balance.rpg.stamina.max}
        <div class="bar stamina small-bar" title="Ausdauer: jeder Zug kostet etwas, jede Runde kommt {game.balance.rpg.stamina.regen} zurück"><div style="width: {pct(stamina, game.balance.rpg.stamina.max)}"></div><span class="num">{formatNumber(stamina)}</span></div>
      {/if}
      <div class="statuses">{#each b.hero.statuses as st (st.id)}<span title="{STATUS_NAME[st.id]} ({st.rounds} Runden)">{STATUS_ICON[st.id]}{st.rounds}</span>{/each}</div>
    </div>
    <div class="fighter foe" class:boss={b.foe.kind === 'boss'} class:elite={b.foe.kind === 'elite'}>
      {#if !ended}<span class="intent" title={intent.hint}>{intent.icon} {intent.name}</span>{/if}
      {#key b.round}
        <div class="fx" class:hurt={foeHits.length > 0} class:ko={ended === 'win'}>
          <CreatureSvg appearance={fl.appearance} shape={fl.shape} tier={fl.tier} size={b.foe.kind === 'normal' ? 88 : 104} />
          {#each foeHits as h, i (i)}<span class="dmg-float" class:crit={h.crit || (h.m ?? 1) > 1} style="--i: {i}">{h.dmg ? `−${formatNumber(h.dmg)}` : '🛡️'}</span>{/each}
        </div>
      {/key}
      <span class="f-name">{b.foe.kind === 'boss' ? '👑 ' : b.foe.kind === 'elite' ? '💀 ' : ''}{b.foe.name}{b.foe.level ? ` · Stufe ${b.foe.level}` : ''}</span>
      {#if b.foe.kind !== 'boss'}<div class="bar blood foe-bar small-bar"><div style="width: {pct(b.foe.hp, b.foe.maxHp)}"></div><span class="num">{formatNumber(b.foe.hp)}</span></div>{/if}
      {@render poise(b.foe)}
      <div class="statuses">{#each b.foe.statuses as st (st.id)}<span title="{STATUS_NAME[st.id]} ({st.rounds} Runden)">{STATUS_ICON[st.id]}{st.rounds}</span>{/each}</div>
    </div>
  </section>
  {#if b.foe.kind === 'boss'}
    <!-- The lord of the dungeon: its name and a long bar across the bottom, like in the old dark tales. -->
    <div class="boss-bar" class:phase2={b.foe.phase === 2}>
      <span class="boss-name">{b.foe.name}{b.foe.phase === 2 ? ' · entfesselt' : ''}</span>
      <div class="bar blood boss-hp"><div style="width: {pct(b.foe.hp, b.foe.maxHp)}"></div><span class="num">{formatNumber(b.foe.hp)} / {formatNumber(b.foe.maxHp)}</span></div>
    </div>
  {/if}
{/snippet}

{#snippet poise(c: RpgCombatant)}
  <div class="bar poise small-bar" class:broken={c.exposed} title={c.exposed ? 'Taumelt – der nächste Treffer ist kritisch' : 'Gleichgewicht: voll = gerät ins Wanken'}><div style="width: {c.exposed ? '100%' : pct(c.poise ?? 0, maxPoise(game, c))}"></div>{#if c.exposed}<span>🎯 taumelt</span>{/if}</div>
{/snippet}

{#snippet gains(af: RpgAftermath)}
  <div class="pouch gains">
    {#if af.xp > 0}<span class="tag xp">✨ +{formatNumber(af.xp)} EP</span>{/if}
    {#if af.levelTo > af.levelFrom}<span class="tag up">⬆️ Stufe {af.levelFrom} → {af.levelTo}</span>{/if}
    {#each lootList(af.loot) as l (l.name)}<span class="tag">{l.icon} +{formatNumber(l.amount)} {l.name}</span>{/each}
    {#each af.gear as item (item.id)}<span class="tag" style="border-color: {rarityOf(item).color}" title={itemText(game, item)}>{gearOf(item).icon} {gearOf(item).name} ({rarityOf(item).name})</span>{/each}
  </div>
{/snippet}

<div class="world" style="--realm: {data.realm}">
  <div class="torch left" aria-hidden="true"></div>
  <div class="torch right" aria-hidden="true"></div>

  <header class="world-bar">
    <div class="realm">
      <span class="realm-sub">Die andere Welt</span>
      <span class="realm-name">{data.dungeon ? `${data.dungeon.icon} ${data.dungeon.name}` : '🌀'}</span>
    </div>
    <div class="menu">
      <button class="iron menu-btn" aria-label="Menü" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>☰</button>
      {#if menuOpen}
        <div class="menu-pop" role="menu">
          <button class="iron" role="menuitem" onclick={() => updatePrefs({ sound: !prefs.sound })}>{prefs.sound ? '🔊 Ton aus' : '🔈 Ton an'}</button>
          {#if data.run}<button class="iron danger" role="menuitem" onclick={giveUp}>🏳️ Aufgeben</button>{/if}
        </div>
      {/if}
    </div>
  </header>

{#if data.run && data.hero && data.dungeon}
  {@const run = data.run}
  {@const d = data.dungeon}
  {@const sp = content.species.get(data.hero.speciesId)}
  {@const path = run.path ?? []}
  <section class="parchment hero-plate">
    <div class="portrait"><CreatureSvg appearance={expressedAppearance(game, data.hero)} shape={sp.shape} tier={sp.tier} size={58} shiny={data.hero.shiny} /></div>
    <div class="hp-body">
      <div class="hero-title"><b>{data.hero.name}</b> <span class="lvl">Stufe {data.heroLevel?.level ?? 1}</span></div>
      <div class="bar blood" title="KP"><div style="width: {pct(run.hp, data.maxHp)}"></div><span class="num">{formatNumber(run.hp)} / {formatNumber(data.maxHp)} KP</span></div>
      <Meter size="sm" tone="gold" value={data.heroLevel && data.heroLevel.need > 0 ? data.heroLevel.into / data.heroLevel.need : 1} title="Erfahrung bis zur nächsten Stufe" />
      <div class="flasks">
        <span class="tag" title="Heiltränke: heilen {formatPercent(content.rpgSkills.get('flask').heal ?? 0, 0)} der KP, im Kampf kostet ein Schluck den Zug. Das Leuchtfeuer füllt sie auf.">🧪 {data.flasks} / {game.balance.rpg.flasks}</span>
        {#if !run.battle && data.flasks > 0 && run.hp < data.maxHp}<button class="iron sip" onclick={() => act(drinkRpgFlask(game))}>Trinken</button>{/if}
      </div>
      {#if run.upgrades.length > 0}
        <div class="ups" title="Verbesserungen dieses Laufs">{#each run.upgrades as u, i (i)}<span title="{content.rpgUpgrades.get(u).name}: {content.rpgUpgrades.get(u).description}">{content.rpgUpgrades.get(u).icon}</span>{/each}</div>
      {/if}
      <div class="pouch">
        {#each lootList(run.loot) as l (l.name)}<span class="tag" title="Getragen – bei einer Niederlage geht ein Teil verloren">{l.icon} {formatNumber(l.amount)}</span>{/each}
        {#each lootList(run.secured) as l (l.name)}<span class="tag safe" title="Gesichert">🔒 {l.icon} {formatNumber(l.amount)}</span>{/each}
        {#each run.gear as item (item.id)}<span class="tag" style="border-color: {rarityOf(item).color}" title="Getragen – bei einer Niederlage verloren · {itemText(game, item)}">{gearOf(item).icon} {gearOf(item).name}</span>{/each}
        {#each run.securedGear as item (item.id)}<span class="tag safe" title="Gesichert · {itemText(game, item)}">🔒 {gearOf(item).icon} {gearOf(item).name}</span>{/each}
      </div>
    </div>
  </section>

  <ol class="trail" aria-label="Weg durch den Dungeon: Raum {run.depth} von {d.rooms + 1}">
    {#each Array.from({ length: d.rooms + 1 }, (_, i) => i) as i (i)}
      {@const kind = path[i]}
      {@const here = i === run.depth - 1 && (!!run.battle || !!run.event)}
      {@const guard = i === guardianRoom(game, run.dungeon)}
      <li class:done={i < run.depth && !here} class:here class:boss={i === d.rooms} class:guard title={guard ? 'Wächter' : kind ? ROOM_INFO[kind].name : i === d.rooms ? 'Boss' : undefined}>
        {kind ? ROOM_INFO[kind].icon : i === d.rooms ? '👑' : guard ? '🛡️' : ''}
      </li>
    {/each}
  </ol>

  {#if run.battle}
    {@const b = run.battle}
    {@render arena(b, data.hero)}
    <ol class="parchment chronicle">{#each b.log as line, i (i)}<li>{line}</li>{/each}</ol>
    <div class="actions">
      <div class="skills">
        {#each data.skills as k (k.id)}
          {@const blocked = skillBlocker(b, k)}
          {@const cd = b.cooldowns[k.id] ?? 0}
          <button class="iron skill" class:special={k.slot === 'special'} disabled={!!blocked} title="{blocked ?? k.description}{effectiveCooldown(k, data.perks ?? {}) > 0 ? ` Abklingzeit: ${effectiveCooldown(k, data.perks ?? {})} Runden.` : ''}" onclick={() => useSkill(k.id)}>
            <span class="k-icon">{k.icon}</span>
            <span class="k-name">{k.name}</span>
            {#if k.slot === 'special'}
              <span class="charge"><Meter size="sm" tone="gold" value={b.charge} title="Aufladung" /></span>
            {:else if cd > 0}
              <span class="cd num">{cd}</span>
            {/if}
            {#if k.stamina}<span class="cost num" title="Ausdauer">{k.stamina}</span>{/if}
          </button>
        {/each}
      </div>
      <div class="skills defense">
        {#each data.defense as k (k.id)}
          {@const empty = k.slot === 'item' && data.flasks <= 0}
          {@const blocked = empty ? 'Keine Heiltränke mehr.' : skillBlocker(b, k)}
          <button class="iron skill guard-move" class:flask={k.slot === 'item'} disabled={!!blocked} title={blocked ?? k.description} onclick={() => useSkill(k.id)}>
            <span class="k-icon">{k.icon}</span>
            <span class="k-name">{k.name}{k.slot === 'item' ? ` ×${data.flasks}` : ''}</span>
            {#if k.stamina}<span class="cost num" title="Ausdauer">{k.stamina}</span>{/if}
          </button>
        {/each}
      </div>
    </div>
  {:else if run.aftermath}
    {@const af = run.aftermath}
    {@const foe = af.battle.foe}
    {@render arena(af.battle, data.hero, 'win')}
    <ol class="parchment chronicle">{#each af.battle.log.slice(-4) as line, i (i)}<li>{line}</li>{/each}</ol>
    <section class="parchment scroll verdict won">
      <h2>{foe.kind === 'elite' ? '💀 Elite besiegt!' : '⚔️ Sieg!'}</h2>
      <p class="tale">{foe.name}{foe.level ? ` (Stufe ${foe.level})` : ''} fällt in Runde {af.battle.round}. {data.hero.name} bleiben {formatNumber(af.battle.hero.hp)} von {formatNumber(af.battle.hero.maxHp)} KP.</p>
      {@render gains(af)}
      {#if run.offer.length > 0}<p class="c-text">Gleich wählst du {run.offer.length > 0 && run.pendingLevels > 0 ? `${run.pendingLevels + 1} Gaben` : 'eine Gabe'} für diesen Lauf.</p>{/if}
      <button class="iron go" onclick={() => act(closeRpgAftermath(game))}>Weiter ➜</button>
    </section>
  {:else if run.offer.length > 0}
    <section class="parchment scroll">
      <h2>⬆️ Eine Gabe für diesen Lauf{run.pendingLevels > 0 ? ` (noch ${run.pendingLevels} weitere)` : ''}</h2>
      <div class="choices">
        {#each run.offer as id, i (id)}
          {@const u = content.rpgUpgrades.get(id)}
          <button class="rune" onclick={() => act(chooseUpgrade(game, i))}>
            <span class="c-icon">{u.icon}</span><b>{u.name}</b><span class="c-text">{u.description}</span>
          </button>
        {/each}
      </div>
    </section>
  {:else if run.event}
    {@const ev = content.rpgEvents.get(run.event)}
    <section class="parchment scroll">
      <h2>{ev.icon} {ev.name}</h2>
      <p class="tale">{ev.text}</p>
      <div class="choices">
        {#each ev.options as o, i (i)}
          <button class="iron option" onclick={() => act(chooseEventOption(game, i))}>
            <b>{o.label}</b>{#if o.chance !== undefined && o.chance < 1}<span class="c-text">Chance {Math.round(o.chance * 100)} %</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  {:else}
    {#if run.eventResult}<p class="parchment tale told">{run.eventResult}</p>{/if}
    {@const guardian = isGuardianNext(game, run)}
    {@const fog = run.choices.includes('boss')}
    {@const bonfire = run.choices.includes('bonfire')}
    <h2 class="fork">{fog ? 'Ein Nebeltor versperrt den letzten Raum …' : guardian ? 'Ein Wächter versperrt den Weg …' : bonfire ? 'Ein Leuchtfeuer brennt in der Dunkelheit' : 'Der Weg teilt sich'}</h2>
    {#if fog}<p class="parchment tale told">Grauer Nebel wabert im Torbogen. Dahinter wartet der Herr dieses Dungeons – wer hindurchgeht, kommt erst zurück, wenn einer von beiden fällt. Noch kannst du mit deiner Beute umkehren.</p>{/if}
    <div class="doors">
      {#each run.choices as kind, i (kind)}
        {@const info = guardian ? GUARDIAN_INFO : kind === 'boss' ? FOG_GATE : ROOM_INFO[kind]}
        <button class="door" class:boss={kind === 'boss' || guardian} class:bonfire={kind === 'bonfire'} onclick={() => act(enterRoom(game, i))}>
          <span class="c-icon">{info.icon}</span><b>{info.name}</b><span class="c-text">{info.hint}</span>
        </button>
      {/each}
    </div>
    <div class="leave-bar"><button class="iron" onclick={leave}>🚪 {fog ? 'Umkehren' : 'Dungeon verlassen'} (Beute mitnehmen)</button></div>
  {/if}
{:else if data.lastResult}
  {@const res = data.lastResult}
  {@const fight = res.fight}
  {#if fight && data.resultHero}
    {@render arena(fight.battle, data.resultHero, fight.win ? 'win' : 'lose')}
    <ol class="parchment chronicle">{#each fight.battle.log.slice(-4) as line, i (i)}<li>{line}</li>{/each}</ol>
  {/if}
  <section class="parchment scroll result" class:won={res.cleared} class:lost={!res.win}>
    <h2>{res.cleared ? '👑 Dungeon geschafft!' : res.win ? '🚪 Lauf beendet' : '💀 Niederlage'}</h2>
    {#if fight}
      <p class="tale">
        {#if fight.win}{fight.battle.foe.name}{fight.battle.foe.level ? ` (Stufe ${fight.battle.foe.level})` : ''} fällt in Runde {fight.battle.round}.
        {:else}{fight.battle.foe.name}{fight.battle.foe.level ? ` (Stufe ${fight.battle.foe.level})` : ''} hat {fight.battle.hero.name} in Runde {fight.battle.round} besiegt – dein Monster wird durch das Portal zurückgeschleudert.{/if}
      </p>
      {#if fight.win}{@render gains(fight)}{/if}
    {/if}
    <p class="tale">
      {content.rpgDungeons.get(res.dungeon).name} · Raum {res.depth} · Stufe {res.startLevel !== undefined && res.startLevel < res.level ? `${res.startLevel} → ${res.level}` : res.level}
    </p>
    {#if !res.win}
      <div class="ledger">
        <span class="ledger-head">Verloren</span>
        <div class="pouch">
          {#each lootList(res.lost ?? {}) as l (l.name)}<span class="tag lost">{l.icon} −{formatNumber(l.amount)} {l.name}</span>{/each}
          {#each res.lostGear ?? [] as item (item.id)}<span class="tag lost" title={itemText(game, item)}>{gearOf(item).icon} {gearOf(item).name}</span>{/each}
          {#if lootList(res.lost ?? {}).length === 0 && !(res.lostGear ?? []).length}<span class="c-text">Nichts – du hattest nichts Ungesichertes dabei.</span>{/if}
        </div>
        <span class="c-text">Bei einer Niederlage bleiben gesicherte Beute und {Math.round(game.balance.rpg.defeatKeep * 100)} % der getragenen, getragene Ausrüstung geht verloren. Rastplätze sichern alles.</span>
      </div>
    {/if}
    <div class="ledger">
      <span class="ledger-head">{res.win ? 'Mitgebracht' : 'Behalten'}</span>
      <div class="pouch">
        {#each lootList(res.loot) as l (l.name)}<span class="tag">{l.icon} {formatNumber(l.amount)} {l.name}</span>{:else}<span class="c-text">Keine Beute.</span>{/each}
        {#each res.gear as item (item.id)}<span class="tag" style="border-color: {rarityOf(item).color}" title={itemText(game, item)}>{gearOf(item).icon} {gearOf(item).name} ({rarityOf(item).name})</span>{/each}
      </div>
    </div>
    <button class="iron back go" disabled={!!view.portal} onclick={() => goBack(res.creatureId)}>🧬 Zurück ins Labor</button>
  </section>
{:else}
  <section class="parchment scroll result">
    <p class="tale">Das Portal ist still.</p>
    <button class="iron back" onclick={leaveWorld}>🧬 Zurück ins Labor</button>
  </section>
{/if}
</div>

<style>
  /* The other world: dark stone, torchlight, parchment – far from the lab's glass and teal. */
  .world {
    --parch: #ecdcb8; --parch-2: #dcc394; --parch-edge: #b8955c; --ink: #2d1e10; --ink-soft: #6a5236;
    --ember: #ff9a3c; --blood: #a3262a; --iron: #2b2420; --iron-2: #43372e; --brass: #c4965a; --glow: #ffcf7a;
    position: relative; isolation: isolate; max-width: 860px; margin: 0 auto;
    padding: calc(0.6rem + env(safe-area-inset-top)) 1rem calc(1.5rem + env(safe-area-inset-bottom)); min-height: 100vh;
    font-family: Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, serif; color: var(--parch);
  }
  /* Stone walls and the dungeon's own light, fixed behind everything. */
  .world::before {
    content: ''; position: fixed; inset: 0; z-index: -2;
    background:
      radial-gradient(ellipse at 50% -10%, color-mix(in srgb, var(--realm) 22%, transparent), transparent 55%),
      radial-gradient(ellipse at 50% 120%, #000c, transparent 60%),
      repeating-linear-gradient(0deg, #ffffff05 0 2px, transparent 2px 46px),
      repeating-linear-gradient(90deg, #00000030 0 2px, transparent 2px 92px),
      #110c09;
  }
  .world::after { content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none; box-shadow: inset 0 0 18vmax #000e; }
  .torch { position: fixed; top: -10vh; width: 60vmin; height: 60vmin; z-index: -1; pointer-events: none; border-radius: 50%;
    background: radial-gradient(circle, #ff9a3c40, #ff6a0015 45%, transparent 70%); animation: flicker 3.2s ease-in-out infinite alternate; }
  .torch.left { left: -20vmin; }
  .torch.right { right: -20vmin; animation-delay: -1.3s; }
  @keyframes flicker { 0% { opacity: 0.75; scale: 1; } 30% { opacity: 1; scale: 1.04; } 55% { opacity: 0.8; } 80% { opacity: 0.95; scale: 0.98; } 100% { opacity: 0.85; } }

  h2 { margin: 0 0 0.6rem; font-size: 1.15rem; font-weight: 700; letter-spacing: 0.02em; }

  .world-bar { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.9rem; }
  .realm { display: grid; line-height: 1.15; }
  .realm-sub { font-size: 0.72rem; letter-spacing: 0.25em; text-transform: uppercase; color: var(--brass); }
  .realm-name { font-size: 1.25rem; font-weight: 700; color: var(--glow); text-shadow: 0 0 14px #ff9a3c66; }

  /* Iron and brass buttons (scoped: only this world). */
  .iron {
    font-family: inherit; color: var(--parch); border: 1px solid var(--brass); border-radius: 6px;
    background: linear-gradient(180deg, var(--iron-2), var(--iron)); box-shadow: inset 0 1px 0 #ffffff14, 0 2px 6px #000a;
  }
  .iron:hover:not(:disabled) { border-color: var(--glow); }
  .iron.danger { color: #ffb3a8; border-color: #b0453a; }
  .menu { position: relative; }
  .menu-btn { padding: 0.35rem 0.75rem; }
  .menu-pop { position: absolute; right: 0; top: calc(100% + 0.35rem); z-index: 20; display: grid; gap: 0.35rem; min-width: 11rem; padding: 0.45rem; border-radius: 8px; background: #1c1511; border: 1px solid var(--brass); box-shadow: 0 10px 24px #000c; }
  .menu-pop button { text-align: left; }

  /* Parchment: warm paper with dark ink and a burnt edge. */
  .parchment {
    color: var(--ink); border-radius: 6px; border: 1px solid var(--parch-edge);
    background: radial-gradient(ellipse at 50% 40%, #f4e7c9 0%, var(--parch) 45%, var(--parch-2) 85%, #c9a86f 100%);
    box-shadow: inset 0 0 26px #8a6a3a66, 0 8px 22px #000b;
  }
  .hero-plate { display: flex; gap: 0.8rem; align-items: center; padding: 0.7rem 0.9rem; margin-bottom: 0.7rem; }
  .portrait { flex: none; display: grid; place-items: center; width: 70px; height: 70px; border-radius: 50%; background: radial-gradient(circle, #fff6 0%, transparent 70%); border: 2px solid var(--parch-edge); }
  .hp-body { flex: 1; display: grid; gap: 0.3rem; min-width: 0; }
  .hero-title { font-size: 1.05rem; }
  .lvl { font-size: 0.85rem; color: var(--ink-soft); }
  .ups { display: flex; flex-wrap: wrap; gap: 0.15rem; }
  .pouch { display: flex; flex-wrap: wrap; gap: 0.3rem; font-size: 0.8rem; }
  .tag { padding: 0.05rem 0.45rem; border-radius: 4px; border: 1px solid var(--parch-edge); background: #fff5; white-space: nowrap; }
  .tag.safe { border-color: #3f7d54; }
  .c-text { font-size: 0.8rem; opacity: 0.85; }

  .bar { position: relative; height: 14px; border-radius: 3px; background: #2a1b12; border: 1px solid #5a3f25; overflow: hidden; }
  .bar > div { height: 100%; transition: width 0.3s; }
  .bar span { position: absolute; inset: 0; font-size: 0.68rem; line-height: 12px; text-align: center; color: #fff; text-shadow: 0 1px 1px #000; font-family: var(--mono); }
  .bar.blood > div { background: linear-gradient(180deg, #d0453d, var(--blood)); }
  .bar.foe-bar > div { background: linear-gradient(180deg, #8b5cc4, #4b2d7a); }

  /* The way through the dungeon: rooms behind, the room now, the boss at the end. */
  .trail { list-style: none; display: flex; align-items: center; gap: 0; margin: 0 0 0.8rem; padding: 0 0.2rem; overflow-x: auto; scrollbar-width: none; }
  .trail li { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; font-size: 0.8rem; border: 1px dashed #6a5236; color: var(--parch); opacity: 0.55; }
  .trail li + li { margin-left: 14px; position: relative; }
  .trail li + li::before { content: ''; position: absolute; right: 100%; top: 50%; width: 14px; border-top: 2px dotted #6a5236; }
  .trail li.done { border-style: solid; border-color: var(--brass); background: #3a2a1c; opacity: 1; }
  .trail li.here { border: 2px solid var(--glow); background: #5a3a1a; opacity: 1; box-shadow: 0 0 10px #ff9a3c99; }
  .trail li.boss { border-color: #b0453a; opacity: 0.9; }
  .trail li.guard { border-color: #c9a227; }

  /* The fight: two fighters on a torchlit stone floor. */
  .arena {
    position: relative; display: grid; grid-template-columns: 1fr 1fr; align-items: end; gap: 0.5rem; padding: 1.6rem 0.6rem 0.8rem; margin-bottom: 0.7rem;
    border-radius: 8px; border: 1px solid #4a3828;
    background:
      radial-gradient(ellipse at 22% 80%, color-mix(in srgb, var(--hero) 22%, transparent), transparent 45%),
      radial-gradient(ellipse at 78% 80%, color-mix(in srgb, var(--foe) 26%, transparent), transparent 45%),
      linear-gradient(180deg, #1a130e 0%, #1a130e 62%, #2a1f16 62%, #150f0b 100%);
    box-shadow: inset 0 0 40px #000c;
  }
  .round { position: absolute; top: 0.45rem; left: 50%; translate: -50% 0; font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--brass); }
  .fighter { display: grid; justify-items: center; gap: 0.25rem; min-width: 0; }
  .fighter.foe :global(svg) { transform: scaleX(-1); }
  .fighter.elite :global(svg) { filter: drop-shadow(0 0 8px #d9483b); }
  .fighter.boss :global(svg) { filter: drop-shadow(0 0 12px var(--glow)); }
  .fx { position: relative; display: grid; justify-items: center; }
  /* A shadow under each fighter, like standing in torchlight. */
  .fx::after { content: ''; width: 70%; height: 10px; margin-top: -6px; border-radius: 50%; background: radial-gradient(ellipse, #000a, transparent 70%); }
  .fx.hurt { animation: hurt 0.35s ease-out; }
  @keyframes hurt {
    0%, 100% { transform: translateX(0); filter: none; }
    20% { transform: translateX(-6px); filter: brightness(1.8) saturate(0.4); }
    45% { transform: translateX(5px); }
    70% { transform: translateX(-3px); }
  }
  .dmg-float { position: absolute; top: 18%; left: 50%; transform: translateX(-50%); font-weight: 800; color: #ffd0c4; text-shadow: 0 1px 3px #000, 0 0 6px #a3262a; pointer-events: none;
    animation: float-up 0.9s ease-out forwards; animation-delay: calc(var(--i) * 0.12s); }
  .dmg-float.crit { color: var(--glow); font-size: 1.2rem; }
  @keyframes float-up { from { opacity: 1; translate: 0 0; } to { opacity: 0; translate: 0 -30px; } }
  .small-bar { width: 100%; max-width: 170px; }
  .f-name { text-align: center; font-size: 0.85rem; color: var(--parch); }
  .intent { margin-bottom: 0.5rem; padding: 0.15rem 0.6rem; border-radius: 4px; font-size: 0.8rem; white-space: nowrap; color: var(--ink); border: 1px solid var(--parch-edge); background: linear-gradient(180deg, #f4e7c9, var(--parch-2)); box-shadow: 0 2px 6px #000a; }
  .statuses { display: flex; gap: 0.25rem; min-height: 1.1rem; font-size: 0.8rem; }

  .chronicle { list-style: none; margin: 0 0 0.7rem; padding: 0.5rem 0.8rem; min-height: 6rem; font-size: 0.82rem; font-style: italic; }
  .chronicle li { opacity: 0.55; }
  .chronicle li:nth-last-child(-n + 3) { opacity: 1; }

  /* Skill plates at the bottom, in thumb reach on phones. */
  .actions { position: sticky; bottom: calc(0.4rem + env(safe-area-inset-bottom)); z-index: 2; display: grid; gap: 0.35rem; padding: 0.35rem; border-radius: 8px; background: #0e0a08e6; border: 1px solid #3a2c20; }
  .skills { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.4rem; }
  .skills.defense .skill { min-height: 52px; padding: 0.35rem 0.2rem; }
  .guard-move { border-color: #6a8a9a; }
  .skill.flask:not(:disabled) { border-color: #b0453a; background: linear-gradient(180deg, #5a2622, #2f1513); }
  .cost { position: absolute; top: 0.15rem; left: 0.3rem; font-size: 0.65rem; color: #9fe0a0; opacity: 0.85; }
  .cost::before { content: '⚡'; font-size: 0.6rem; }
  .boss-bar { display: grid; gap: 0.2rem; margin: -0.3rem 0 0.7rem; padding: 0 0.3rem; }
  .boss-name { font-size: 0.95rem; letter-spacing: 0.06em; color: var(--parch); text-shadow: 0 1px 3px #000; }
  .boss-hp { height: 12px; border-color: #7a5a2a; }
  .boss-hp > div { background: linear-gradient(180deg, #c0392b, #6e1414); }
  .boss-bar.phase2 .boss-name { color: #ff9a8a; }
  .arena.phase2 { box-shadow: inset 0 0 50px #a3262a88, inset 0 0 40px #000c; }
  .bar.poise { height: 5px; border-color: #4a3a1a; }
  .bar.poise > div { background: linear-gradient(90deg, #b8860b, #ffcf7a); }
  .bar.poise.broken { height: 12px; }
  .bar.poise.broken > div { background: linear-gradient(90deg, #d9483b, #ffcf7a); animation: pulse 0.6s ease-in-out infinite alternate; }
  .bar.poise.broken span { font-size: 0.6rem; line-height: 10px; }
  @keyframes pulse { from { opacity: 0.6; } to { opacity: 1; } }
  .bar.stamina { height: 8px; }
  .bar.stamina > div { background: linear-gradient(180deg, #8fd19e, #3f7d54); }
  .bar.stamina span { font-size: 0.55rem; line-height: 7px; }
  .flasks { display: flex; gap: 0.35rem; align-items: center; font-size: 0.8rem; }
  .sip { padding: 0.1rem 0.6rem; font-size: 0.8rem; }
  .skill { position: relative; display: grid; justify-items: center; gap: 0.1rem; padding: 0.5rem 0.2rem; min-height: 66px; }
  .skill.special:not(:disabled) { border-color: var(--glow); background: linear-gradient(180deg, #6b4a1c, #3a2710); box-shadow: 0 0 12px #ff9a3c66, inset 0 1px 0 #ffffff22; }
  .k-icon { font-size: 1.4rem; }
  .k-name { font-size: 0.75rem; line-height: 1.1; text-align: center; }
  .cd { position: absolute; top: 0.2rem; right: 0.35rem; font-size: 0.75rem; color: var(--glow); }
  .charge { display: flex; width: 80%; }

  .scroll { padding: 0.9rem 1rem; margin-bottom: 0.8rem; }
  .tale { margin: 0 0 0.7rem; line-height: 1.45; }
  .tale.told { padding: 0.6rem 0.9rem; font-style: italic; margin-bottom: 0.8rem; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.5rem; }
  /* A gift of this run: a rune stone. */
  .rune { display: grid; justify-items: center; gap: 0.2rem; text-align: center; padding: 0.8rem 0.5rem; font-family: inherit; color: var(--parch); border-radius: 10px; border: 1px solid var(--brass); background: radial-gradient(circle at 50% 30%, #4b3a2c, #231a14); box-shadow: 0 4px 10px #0009; }
  .rune:hover { border-color: var(--glow); box-shadow: 0 0 14px #ff9a3c55; }
  .option { display: grid; justify-items: center; gap: 0.15rem; padding: 0.7rem 0.5rem; }
  .c-icon { font-size: 1.8rem; }

  /* The ways ahead: arched doors in the wall. */
  .fork { text-align: center; color: var(--glow); text-shadow: 0 0 12px #ff9a3c55; }
  .doors { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 220px)); justify-content: center; gap: 0.7rem; margin-bottom: 0.8rem; }
  .door {
    display: grid; justify-items: center; align-content: end; gap: 0.25rem; min-height: 170px; padding: 1.8rem 0.6rem 0.9rem; text-align: center; font-family: inherit; color: var(--parch);
    border-radius: 999px 999px 8px 8px; border: 2px solid #5a4330;
    background: radial-gradient(ellipse at 50% 30%, #0006, transparent 60%), repeating-linear-gradient(90deg, #3a2a1d 0 18px, #33251a 18px 20px), #2d2016;
    box-shadow: inset 0 0 24px #000c, 0 6px 14px #000b;
  }
  .door:hover { border-color: var(--brass); box-shadow: inset 0 0 24px #000c, 0 0 16px #ff9a3c44; }
  .door.bonfire { border-color: #c4965a; background: radial-gradient(ellipse at 50% 75%, #ff9a3c55, transparent 60%), repeating-linear-gradient(90deg, #3a2a1d 0 18px, #33251a 18px 20px), #2d2016; box-shadow: inset 0 0 24px #000c, 0 0 22px #ff9a3c66; }
  .door.boss { border-color: #9a3a30; box-shadow: inset 0 0 24px #000c, 0 0 18px #d9483b66; }
  .door b { font-size: 1.05rem; color: var(--glow); }
  .leave-bar { display: flex; justify-content: center; padding: 0.4rem 0; }
  .leave-bar button, .back { padding: 0.55rem 1rem; }

  .result { display: grid; gap: 0.6rem; justify-items: start; }
  /* After the last blow: the loser sinks into the dust, the fight's outcome is told below. */
  .arena.ended { box-shadow: inset 0 0 60px #000e; }
  .fx.ko { animation: ko 0.9s ease-in 0.35s forwards; }
  .fx.hurt.ko { animation: hurt 0.35s ease-out, ko 0.9s ease-in 0.35s forwards; }
  @keyframes ko {
    0% { transform: translateY(0) rotate(0); filter: none; opacity: 1; }
    25% { transform: translateY(-6px) rotate(-6deg); filter: brightness(1.8); }
    100% { transform: translateY(14px) rotate(14deg); filter: grayscale(1) brightness(0.45); opacity: 0.45; }
  }
  .verdict { display: grid; gap: 0.5rem; justify-items: start; }
  .verdict.won { border-color: #b8860b; }
  .verdict .tale, .result .tale { margin: 0; }
  .gains .tag.xp { border-color: #b8860b; background: #ffcf7a55; }
  .gains .tag.up { border-color: #3f7d54; background: #8fd19e55; font-weight: 700; }
  .ledger { display: grid; gap: 0.3rem; width: 100%; }
  .ledger-head { font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ink-soft); }
  .tag.lost { border-color: #8a2d26; background: #d9483b33; text-decoration: line-through; text-decoration-color: #8a2d2699; }
  /* The button to go on appears where the skills were: hold it back a moment, so a last tap on a skill does not skip the outcome. */
  .go { padding: 0.55rem 1.2rem; font-size: 1.05rem; animation: arm 0.8s steps(1, end); }
  @keyframes arm { 0% { pointer-events: none; opacity: 0.45; } }
  .result.won { border-color: #b8860b; box-shadow: inset 0 0 26px #8a6a3a66, 0 0 24px #ffcf7a55; }
  .result.lost { border-color: #8a2d26; }
  .back { font-size: 1.05rem; }

  @media (max-width: 520px) {
    .door { min-height: 140px; }
    .realm-name { font-size: 1.1rem; }
  }
</style>
