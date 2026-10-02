import { describe, expect, it } from 'vitest';
import { ALLELE_SAMPLES, closeRpgAftermath, giveUpRpgRun, buyMeta, maxTorches, metaCost, salvageItem, salvageValue, equipItem, rollItem, rpgCandidates, chooseEventOption, lootChance, weeklyRoom, chooseUpgrade, dungeonUnlocked, gainXp, xpToNext, enterRoom, finishRpgRun, leaveRpgRun, roomLevel, roomLoot, nextTorchAt, refreshTorches, rpgHero, rpgMaxHp, rpgSkills, secureLoot, startRpgBattle, startRpgRun, torches, useRpgSkill } from '@core/features/rpg';
import { canConsume, sell } from '@core/features/stable';
import { effectiveCooldown, heroPerks, itemValues, foeIntent, heroActsFirst, heroStats, rpgLevel, speciesProfile, upgradePerks, xpForLevel, makeFoe, newBattle, playRound, rpgSkillsFor, statusOf, techniqueSkill, thirdSkill } from '@core/features/rpgCombat';
import type { RpgCombatant } from '@core/state';
import { createCreature } from '@core/creatures';
import { performPrestige } from '@core/prestige';
import { deserialize, serialize } from '@core/save';
import { checkUnlocks, unlockFeature } from '@core/systems/unlocks';
import { claimDaily, dailyReward } from '@core/features/daily';
import { D } from '@core/num';
import { startSequencing } from '@core/features/sequencing';
import { NOW, balance, makeGame } from './helpers';
import { makeHero, pickSkill } from './rpgBot';
import { guardianRoom } from '@core/features/rpg';

const HOUR = 3_600_000;

/** Tests of the room flow need a hero far above every dungeon: huge growth per level, at the top level. */
function strongGame(seed = 42) {
  return makeGame(seed, { rpg: { ...balance.rpg, statsPerLevel: 100 } });
}
function toLevel(g: ReturnType<typeof makeGame>, id: number, level: number) {
  g.state.rpg.ranks[String(id)] = xpForLevel(g, level);
}

function rpgGame() {
  const g = makeGame();
  unlockFeature(g, 'rpg');
  refreshTorches(g, NOW);
  return g;
}

describe('GenLab RPG – Fackeln', () => {
  it('is locked (no Fackeln) before its tower floor', () => {
    const g = makeGame();
    refreshTorches(g, NOW);
    expect(torches(g)).toBe(0);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('fills the stock once on unlock', () => {
    const g = rpgGame();
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('refills one Fackel per interval up to the limit, also across long breaks', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(0);
    refreshTorches(g, NOW);
    expect(nextTorchAt(g)).toBe(NOW + balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR - 1);
    expect(torches(g)).toBe(0);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR);
    expect(torches(g)).toBe(1);
    // The next one counts from the planned time, not from the late check.
    expect(nextTorchAt(g)).toBe(NOW + 2 * balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('keeps extra Fackeln from rewards above the limit', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(balance.rpg.maxTorches + 2);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches + 2);
  });

  it('old saves get the new state with defaults', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state, NOW));
    delete raw.state.rpg;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.rpg.torchAt).toBe(-1);
  });
});

describe('GenLab RPG – Lauf', () => {
  it('needs the feature and a Fackel', () => {
    const g = makeGame();
    const id = g.state.creatures[0]!.id;
    expect(startRpgRun(g, id, 'rootMaze').ok).toBe(false);
    unlockFeature(g, 'rpg');
    expect(startRpgRun(g, id, 'rootMaze').ok).toBe(false); // stock not filled yet
    refreshTorches(g, NOW);
    expect(startRpgRun(g, id, 'rootMaze').ok).toBe(true);
    expect(torches(g)).toBe(balance.rpg.maxTorches - 1);
    expect(g.state.rpg.runs).toBe(1);
    expect(startRpgRun(g, id, 'rootMaze').ok).toBe(false); // one run at a time
  });

  it('starts at level 1 with full HP; the monster is busy and protected', () => {
    const g = rpgGame();
    const c = g.state.creatures[0]!;
    createCreature(g, { speciesId: 'sproutle', rarity: 'common', source: 'other' });
    expect(startRpgRun(g, c.id, 'rootMaze').ok).toBe(true);
    const run = g.state.rpg.run!;
    expect(run.startLevel).toBe(1);
    expect(run.depth).toBe(0);
    expect(run.hp).toBe(rpgMaxHp(g, c));
    expect(rpgHero(g)).toBe(c);
    expect(c.job).toEqual({ kind: 'rpg', target: 'run' });
    expect(canConsume(g, c)).toBe(false);
    expect(sell(g, [c.id]).ok).toBe(false);
  });

  it('refilling starts as soon as a Fackel is spent', () => {
    const g = rpgGame();
    expect(startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze').ok).toBe(true);
    expect(nextTorchAt(g)).toBe(g.state.lastTickAt + balance.rpg.torchHours * HOUR);
  });

  it('leaving brings the carried loot home and frees the monster', () => {
    const g = rpgGame();
    const c = g.state.creatures[0]!;
    startRpgRun(g, c.id, 'rootMaze');
    g.state.rpg.run!.loot = { towerTokens: 10 };
    expect(leaveRpgRun(g).ok).toBe(true);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10);
    expect(c.job).toBeNull();
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.rpg.lastResult).toMatchObject({ win: true, loot: { towerTokens: 10 } });
    expect(leaveRpgRun(g).ok).toBe(false);
  });

  it('giving up: between rooms like leaving, in a fight a defeat', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(5);
    const c = g.state.creatures[0]!;
    expect(giveUpRpgRun(g).ok).toBe(false);
    startRpgRun(g, c.id, 'rootMaze');
    g.state.rpg.run!.loot = { towerTokens: 10 };
    expect(giveUpRpgRun(g).ok).toBe(true);
    expect(g.state.rpg.lastResult).toMatchObject({ win: true, loot: { towerTokens: 10 } });
    startRpgRun(g, c.id, 'rootMaze');
    g.state.rpg.run!.loot = { towerTokens: 10 };
    startRpgBattle(g, 'brawler', 'sproutle', 1);
    expect(giveUpRpgRun(g).ok).toBe(true);
    expect(g.state.rpg.lastResult).toMatchObject({ win: false, loot: { towerTokens: Math.floor(10 * balance.rpg.defeatKeep) } });
    expect(c.job).toBeNull();
  });

  it('a defeat keeps secured loot and only a share of the carried loot', () => {
    const g = rpgGame();
    startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze');
    const run = g.state.rpg.run!;
    run.loot = { towerTokens: 10 };
    secureLoot(g);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10);
    run.loot = { towerTokens: 10 };
    finishRpgRun(g, false);
    const kept = Math.floor(10 * balance.rpg.defeatKeep);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10 + kept);
    expect(g.state.rpg.lastResult).toMatchObject({ win: false, loot: { towerTokens: 10 + kept } });
  });

  it('survives save and load; a prestige ends the run', () => {
    const g = rpgGame();
    startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze');
    g.state.rpg.run!.loot = { towerTokens: 5 };
    const { state } = deserialize(serialize(g.state, NOW));
    expect(state.rpg.run).toEqual(g.state.rpg.run);
    unlockFeature(g, 'inheritance');
    g.state.earned['gold'] = D(1e9);
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(5);
  });
});

describe('GenLab RPG – Fähigkeiten', () => {
  it('derives four skills from the monster: basic, element technique, third, special', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!; // Glutwelpe (fire)
    const skills = rpgSkillsFor(g, c);
    expect(skills.map((k) => k.slot)).toEqual(['basic', 'technique', 'third', 'special']);
    expect(skills[1]!.id).toBe('blaze');
    // 3 tower seconds of burn → 2 rounds, the per-second share doubles per round.
    expect(skills[1]!.status).toEqual({ id: 'burn', rounds: 2, value: 0.5 });
    expect(skills[1]!.cooldown).toBe(balance.rpg.techniqueCooldown);
  });

  it('third skill: revealed Erbanlage before ability before role', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!;
    c.abilities = [];
    c.latent = null;
    expect(thirdSkill(g, c).from?.role).toBeDefined();
    c.abilities = ['diligent', 'tough'];
    expect(thirdSkill(g, c).id).toBe('mend');
    c.latent = 'hunter';
    c.deepSequenced = false;
    expect(thirdSkill(g, c).id).toBe('mend'); // hidden Erbanlage does not count
    c.deepSequenced = true;
    expect(thirdSkill(g, c).id).toBe('hunt');
  });
});

describe('GenLab RPG – Rundenkampf', () => {
  function fight(seed = 42) {
    const g = makeGame(seed);
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    const c = g.state.creatures[0]!;
    c.abilities = [];
    c.latent = null;
    startRpgRun(g, c.id, 'rootMaze');
    return { g, c };
  }
  const hero = (over: Partial<RpgCombatant> = {}): RpgCombatant => ({ name: 'Held', speciesId: 'emberpup', element: 'fire', hp: 100, maxHp: 100, atk: 20, def: 5, spd: 10, statuses: [], ...over });

  it('foes follow their level and their kind', () => {
    const g = makeGame();
    const low = makeFoe(g, 'brawler', 'sproutle', 0);
    const high = makeFoe(g, 'brawler', 'sproutle', 30);
    const boss = makeFoe(g, 'warden', 'sproutle', 30);
    expect(high.maxHp).toBeGreaterThan(low.maxHp);
    expect(boss.maxHp).toBeGreaterThan(high.maxHp);
    expect(low.element).toBe('nature');
    expect(low.name).toContain('Sprössling');
  });

  it('shows the next move from the pattern, and the pattern advances every round', () => {
    const g = makeGame();
    const b = newBattle(hero({ atk: 1 }), makeFoe(g, 'brawler', 'sproutle', 0));
    const seen: string[] = [];
    const basic = g.content.rpgSkills.get('strike');
    for (let i = 0; i < 4; i++) {
      seen.push(foeIntent(g, b.foe));
      b.hero.hp = 1e6;
      playRound(g, b, basic);
    }
    expect(seen).toEqual(g.content.rpgEnemies.get('brawler').pattern);
  });

  it('speed decides who acts first; a slowed side acts last', () => {
    const g = makeGame();
    const b = newBattle(hero({ spd: 5 }), makeFoe(g, 'brawler', 'sproutle', 0));
    b.foe.spd = 10;
    expect(heroActsFirst(b)).toBe(false);
    b.foe.statuses.push({ id: 'slow', rounds: 2, value: 0.5 });
    expect(heroActsFirst(b)).toBe(true);
  });

  it('a guarding foe shields itself before the hero strikes', () => {
    const g = makeGame();
    const b = newBattle(hero({ spd: 100, atk: 1 }), makeFoe(g, 'guardian', 'sproutle', 0));
    expect(foeIntent(g, b.foe)).toBe('guard');
    playRound(g, b, g.content.rpgSkills.get('strike'));
    // A weak hit is swallowed completely by the shield.
    expect(b.foe.hp).toBe(b.foe.maxHp);
  });

  it('cooldowns block a skill for its rounds; the special needs a full charge', () => {
    const { g } = fight();
    const skills = rpgSkills(g);
    const tech = skills.find((k) => k.slot === 'technique')!;
    const special = skills.find((k) => k.slot === 'special')!;
    startRpgBattle(g, 'warden', 'sproutle', 0);
    const battle = g.state.rpg.run!.battle!;
    battle.hero.hp = battle.hero.maxHp = 1e6;
    battle.foe.hp = battle.foe.maxHp = 1e6;
    expect(useRpgSkill(g, special.id).ok).toBe(false);
    expect(useRpgSkill(g, tech.id).ok).toBe(true);
    for (let i = 0; i < tech.cooldown; i++) {
      expect(useRpgSkill(g, tech.id).ok).toBe(false);
      expect(useRpgSkill(g, 'strike').ok).toBe(true);
    }
    expect(useRpgSkill(g, tech.id).ok).toBe(true);
    battle.charge = 1;
    expect(useRpgSkill(g, special.id).ok).toBe(true);
    expect(battle.charge).toBeLessThan(1);
  });

  it('burn ticks every round and runs out', () => {
    const g = makeGame();
    const b = newBattle(hero({ spd: 100 }), makeFoe(g, 'brawler', 'sproutle', 0));
    b.foe.hp = b.foe.maxHp = 1e6;
    b.hero.hp = b.hero.maxHp = 1e6;
    const blaze = techniqueSkill(g, g.content.techniques.get('blaze'));
    playRound(g, b, blaze);
    const burn = statusOf(b.foe, 'burn');
    expect(burn?.value).toBe(Math.round(b.hero.atk * blaze.status!.value));
    const skip = { ...g.content.rpgSkills.get('strike'), hit: 0 };
    for (let i = 0; i < 3; i++) playRound(g, b, skip);
    expect(statusOf(b.foe, 'burn')).toBeUndefined();
  });

  it('a won fight keeps the HP for the next room; a lost one ends the run', () => {
    const { g, c } = fight();
    startRpgBattle(g, 'brawler', 'sproutle', 0);
    g.state.rpg.run!.battle!.foe.hp = 1;
    expect(useRpgSkill(g, 'strike').ok).toBe(true);
    expect(g.state.rpg.run!.battle).toBeNull();
    startRpgBattle(g, 'warden', 'sproutle', 60);
    for (let i = 0; i < 200 && g.state.rpg.run; i++) useRpgSkill(g, 'strike');
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.rpg.lastResult?.win).toBe(false);
    expect(c.job).toBeNull();
  });

  it('a won fight stays on screen with its XP and loot until the player goes on', () => {
    const { g, c } = fight();
    const run = g.state.rpg.run!;
    run.room = 'fight';
    startRpgBattle(g, 'brawler', 'sproutle', 1);
    run.battle!.foe.hp = 1;
    const level = rpgLevel(g, c.id).level;
    useRpgSkill(g, 'strike');
    const after = run.aftermath!;
    expect(after.win).toBe(true);
    expect(after.battle.foe.hp).toBe(0);
    expect(after.xp).toBeGreaterThan(0);
    expect(after.levelFrom).toBe(level);
    expect(after.levelTo).toBe(rpgLevel(g, c.id).level);
    for (const [res, n] of Object.entries(after.loot)) expect(run.loot[res]).toBeGreaterThanOrEqual(n);
    expect(run.choices.length).toBeGreaterThan(0); // the ways are already open
    expect(closeRpgAftermath(g).ok).toBe(true);
    expect(run.aftermath).toBeNull();
    expect(closeRpgAftermath(g).ok).toBe(false);
    // Going on through a door clears it too.
    run.aftermath = after;
    enterRoom(g, 0);
    expect(run.aftermath).toBeNull();
  });

  it('a lost fight ends the run with the last round and what was lost', () => {
    const { g } = fight();
    const run = g.state.rpg.run!;
    run.loot = { towerTokens: 10 };
    const item = rollItem(g, 'rootMaze');
    run.gear = [item];
    startRpgBattle(g, 'warden', 'sproutle', 60);
    for (let i = 0; i < 200 && g.state.rpg.run; i++) useRpgSkill(g, 'strike');
    const res = g.state.rpg.lastResult!;
    expect(res.win).toBe(false);
    expect(res.fight?.win).toBe(false);
    expect(res.fight?.battle.hero.hp).toBe(0);
    expect(res.fight?.battle.foe.name).toBeTruthy();
    expect(res.lost).toEqual({ towerTokens: 10 - Math.floor(10 * balance.rpg.defeatKeep) });
    expect(res.lostGear?.map((x) => x.id)).toEqual([item.id]);
  });

  it('is deterministic with the game RNG', () => {
    const play = () => {
      const { g } = fight(7);
      startRpgBattle(g, 'champion', 'voltmouse', 3);
      const log: number[] = [];
      for (let i = 0; i < 30 && g.state.rpg.run?.battle; i++) {
        useRpgSkill(g, 'strike');
        log.push(g.state.rpg.run?.hp ?? -1);
      }
      return log;
    };
    expect(play()).toEqual(play());
  });
});

describe('GenLab RPG – Dungeon', () => {
  function run(seed = 42) {
    const g = strongGame(seed);
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    const c = g.state.creatures[0]!;
    // A hero far above the first dungeon: the room flow is tested here, not the balance.
    toLevel(g, c.id, balance.rpg.maxLevel);
    expect(startRpgRun(g, c.id, 'rootMaze').ok).toBe(true);
    return { g, c };
  }
  /** Wins the running fight with basic attacks. */
  function winFight(g: ReturnType<typeof makeGame>) {
    for (let i = 0; i < 100 && g.state.rpg.run?.battle; i++) expect(useRpgSkill(g, 'strike').ok).toBe(true);
  }

  it('only the first dungeon is open; a clear opens the next', () => {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    expect(dungeonUnlocked(g, 'rootMaze')).toBe(true);
    expect(dungeonUnlocked(g, 'emberCaves')).toBe(false);
    expect(startRpgRun(g, g.state.creatures[0]!.id, 'emberCaves').ok).toBe(false);
    g.state.rpg.cleared['rootMaze'] = 1;
    expect(dungeonUnlocked(g, 'emberCaves')).toBe(true);
  });

  it('offers 2–3 different ways after each room', () => {
    const { g } = run();
    const choices = g.state.rpg.run!.choices;
    expect(choices.length).toBeGreaterThanOrEqual(balance.rpg.choices[0]);
    expect(choices.length).toBeLessThanOrEqual(balance.rpg.choices[1]);
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices).not.toContain('boss');
  });

  it('a fight room starts a fight whose strength grows with the depth', () => {
    const { g } = run();
    const r = g.state.rpg.run!;
    r.choices = ['fight'];
    expect(enterRoom(g, 0).ok).toBe(true);
    expect(r.battle).not.toBeNull();
    expect(r.depth).toBe(1);
    expect(r.path).toEqual(['fight']);
    expect(enterRoom(g, 0).ok).toBe(false); // finish the room first
    expect(leaveRpgRun(g).ok).toBe(false); // no fleeing mid-fight
    expect(g.content.rpgDungeons.get('rootMaze').elements).toContain(r.battle!.foe.element);
    winFight(g);
    expect(r.loot).toMatchObject(roomLoot(g, r, 'fight'));
    expect(r.choices.length).toBeGreaterThan(0);
    r.depth = 5;
    expect(roomLevel(g, r)).toBeGreaterThan(roomLevel(g, { ...r, depth: 1 }));
  });

  it('a rest heals and secures the loot; a treasure adds loot', () => {
    const { g, c } = run();
    const r = g.state.rpg.run!;
    r.choices = ['treasure'];
    enterRoom(g, 0);
    expect(r.loot).toMatchObject(roomLoot(g, r, 'treasure'));
    const carried = { ...r.loot };
    r.hp = 1;
    r.choices = ['rest'];
    enterRoom(g, 0);
    expect(r.hp).toBe(1 + Math.round(rpgMaxHp(g, c) * balance.rpg.restHeal));
    expect(r.loot).toEqual({});
    expect(r.secured).toEqual(carried);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(carried['towerTokens']);
  });

  it('an event waits for a choice, then its outcome happens and the ways open', () => {
    const { g, c } = run();
    const r = g.state.rpg.run!;
    r.choices = ['event'];
    expect(enterRoom(g, 0).ok).toBe(true);
    expect(r.event).not.toBeNull();
    expect(r.choices).toEqual([]);
    expect(enterRoom(g, 0).ok).toBe(false);
    r.event = 'shrine';
    r.hp = 1;
    expect(chooseEventOption(g, 2).ok).toBe(false);
    expect(chooseEventOption(g, 0).ok).toBe(true);
    expect(r.hp).toBe(1 + Math.round(rpgMaxHp(g, c) * 0.3));
    expect(r.eventResult).toBe(g.content.rpgEvents.get('shrine').options[0].result);
    expect(r.event).toBeNull();
    expect(r.choices.length).toBeGreaterThan(0);
    expect(chooseEventOption(g, 0).ok).toBe(false);
  });

  it('event damage never kills; a risky choice can fail', () => {
    const { g } = run(3);
    const r = g.state.rpg.run!;
    const outcomes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      r.choices = ['event'];
      enterRoom(g, 0);
      r.event = 'chest';
      r.hp = 1;
      chooseEventOption(g, 0);
      expect(r.hp).toBeGreaterThanOrEqual(1);
      outcomes.add(r.eventResult!);
    }
    expect(outcomes.size).toBe(2);
  });

  it('after the last room only the boss waits; beating it clears the dungeon', () => {
    const { g, c } = run();
    const rooms = g.content.rpgDungeons.get('rootMaze').rooms;
    for (let i = 0; i < rooms; i++) {
      const r = g.state.rpg.run!;
      expect(r.choices).not.toContain('boss');
      enterRoom(g, 0);
      winFight(g);
      if (r.event) chooseEventOption(g, 1);
      while (r.offer.length > 0) chooseUpgrade(g, 0);
    }
    expect(g.state.rpg.run!.choices).toEqual(['boss']);
    enterRoom(g, 0);
    expect(g.state.rpg.run!.battle!.foe.kind).toBe('boss');
    winFight(g);
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.rpg.cleared['rootMaze']).toBe(1);
    expect(g.state.rpg.best['rootMaze']).toBe(rooms + 1);
    expect(g.state.rpg.lastResult).toMatchObject({ win: true, cleared: true, dungeon: 'rootMaze' });
    expect(g.state.rpg.lastResult!.fight).toMatchObject({ win: true, battle: { foe: { kind: 'boss', hp: 0 } } });
    expect(g.state.rpg.lastResult!.lost).toBeUndefined();
    expect(c.job).toBeNull();
    expect(dungeonUnlocked(g, 'emberCaves')).toBe(true);
  });
});

describe('GenLab RPG – Stufe in der anderen Welt', () => {
  function run() {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    g.state.resources['torches'] = D(50);
    const c = g.state.creatures[0]!;
    startRpgRun(g, c.id, 'rootMaze');
    return { g, c, r: g.state.rpg.run! };
  }

  it('starts over at level 1 with the base stats of its species – breeding does not count there', () => {
    const g = makeGame();
    const c = createCreature(g, { speciesId: 'magmole', rarity: 'mythic', source: 'other' });
    c.stats = { hp: 9999, atk: 9999, def: 9999, spd: 9999 };
    c.boosts = { atk: 5 };
    c.infusion = { level: 10, ep: 0 };
    expect(rpgLevel(g, c.id)).toMatchObject({ level: 1, into: 0 });
    const plain = createCreature(g, { speciesId: 'magmole', rarity: 'common', source: 'other' });
    expect(heroStats(g, c)).toEqual(heroStats(g, plain));
    const profile = speciesProfile(g, 'magmole');
    expect(heroStats(g, c)).toEqual({ hp: Math.round(profile.hp), atk: Math.round(profile.atk), def: Math.round(profile.def), spd: Math.round(profile.spd) });
  });

  it('species shape a monster on a common yardstick; hybrids are a bit stronger', () => {
    const g = makeGame();
    const power = (id: string) => { const p = speciesProfile(g, id); return p.hp / 20 + p.atk / 6 + p.def / 5; };
    // A tough species keeps more KP and VER, a quick one more TMP …
    expect(speciesProfile(g, 'pebblit').def).toBeGreaterThan(speciesProfile(g, 'zephyrix').def);
    expect(speciesProfile(g, 'zephyrix').spd).toBeGreaterThan(speciesProfile(g, 'pebblit').spd);
    // … but base species are about equally strong, a hybrid by its tier bonus more.
    expect(power('magmole') / power('emberpup')).toBeGreaterThan(1.05);
    expect(power('magmole') / power('emberpup')).toBeLessThan(1.35);
  });

  it('grows with every level and keeps its level between runs', () => {
    const { g, c, r } = run();
    const base = g.content.species.get(c.speciesId).baseStats;
    gainXp(g, r, xpToNext(g, 1));
    expect(rpgLevel(g, c.id).level).toBe(2);
    expect(heroStats(g, c).atk).toBe(Math.round(base['atk']! * (1 + balance.rpg.statsPerLevel)));
    leaveRpgRun(g);
    expect(g.state.rpg.lastResult).toMatchObject({ startLevel: 1, level: 2 });
    startRpgRun(g, c.id, 'rootMaze');
    expect(g.state.rpg.run!.startLevel).toBe(2);
    expect(g.state.rpg.run!.hp).toBe(heroStats(g, c).hp);
  });

  it('XP need grows per level up to the top level', () => {
    const g = makeGame();
    expect(xpToNext(g, 1)).toBe(balance.rpg.xpBase);
    expect(xpToNext(g, 3)).toBeGreaterThan(xpToNext(g, 2));
    const c = g.state.creatures[0]!;
    g.state.rpg.ranks[String(c.id)] = 1e15;
    expect(rpgLevel(g, c.id)).toEqual({ level: balance.rpg.maxLevel, into: 0, need: 0 });
  });

  it('a level-up offers three different upgrades for this run and blocks the way until one is chosen', () => {
    const { g, r } = run();
    gainXp(g, r, xpToNext(g, 1));
    expect(r.offer).toHaveLength(balance.rpg.upgradeChoices);
    expect(new Set(r.offer).size).toBe(r.offer.length);
    expect(enterRoom(g, 0).ok).toBe(false);
    expect(chooseUpgrade(g, 5).ok).toBe(false);
    const pick = r.offer[0]!;
    expect(chooseUpgrade(g, 0).ok).toBe(true);
    expect(r.upgrades).toEqual([pick]);
    expect(r.offer).toEqual([]);
    expect(enterRoom(g, 0).ok).toBe(true);
  });

  it('several level-ups at once queue their offers; upgrades do not outlast the run', () => {
    const { g, c, r } = run();
    gainXp(g, r, xpToNext(g, 1) + xpToNext(g, 2) + xpToNext(g, 3));
    expect(rpgLevel(g, c.id).level).toBe(4);
    expect(r.pendingLevels).toBe(2);
    chooseUpgrade(g, 0);
    chooseUpgrade(g, 0);
    expect(r.offer).toHaveLength(balance.rpg.upgradeChoices);
    chooseUpgrade(g, 0);
    expect(r.upgrades).toHaveLength(3);
    expect(r.offer).toEqual([]);
    leaveRpgRun(g);
    startRpgRun(g, c.id, 'rootMaze');
    expect(g.state.rpg.run!.upgrades).toEqual([]);
  });

  it('upgrades raise stats (more KP also now), respect their limit and add perks', () => {
    const { g, c, r } = run();
    const before = heroStats(g, c).hp;
    r.hp = before;
    r.offer = ['vigor'];
    chooseUpgrade(g, 0);
    const after = heroStats(g, c, r.upgrades).hp;
    expect(Math.abs(after - before * 1.15)).toBeLessThanOrEqual(1);
    expect(r.hp).toBe(after);
    r.upgrades.push('drill');
    for (let i = 0; i < 30; i++) {
      gainXp(g, r, xpToNext(g, rpgLevel(g, c.id).level));
      expect(r.offer).not.toContain('drill');
      while (r.offer.length > 0) chooseUpgrade(g, 0);
    }
    const perks = upgradePerks(g, ['keen', 'keen', 'drill']);
    expect(perks.crit).toBeCloseTo(0.2);
    expect(effectiveCooldown(g.content.rpgSkills.get('heavyBlow'), perks)).toBe(2);
    expect(effectiveCooldown(g.content.rpgSkills.get('strike'), perks)).toBe(0);
  });

  it('won fights give XP to the monster; a won elite fight offers upgrades too', () => {
    const g = strongGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    const c = g.state.creatures[0]!;
    toLevel(g, c.id, balance.rpg.maxLevel - 1);
    startRpgRun(g, c.id, 'rootMaze');
    const r = g.state.rpg.run!;
    const xp = g.state.rpg.ranks[String(c.id)]!;
    r.choices = ['fight'];
    enterRoom(g, 0);
    for (let i = 0; i < 100 && r.battle; i++) useRpgSkill(g, 'strike');
    expect(g.state.rpg.ranks[String(c.id)]).toBe(xp + balance.rpg.xp.fight);
    expect(r.offer).toEqual([]);
    r.choices = ['elite'];
    enterRoom(g, 0);
    for (let i = 0; i < 100 && r.battle; i++) useRpgSkill(g, 'strike');
    expect(r.offer).toHaveLength(balance.rpg.upgradeChoices);
  });

  it('the level goes with the creature', () => {
    const { g, c } = run();
    g.state.rpg.ranks['999999'] = 500;
    leaveRpgRun(g);
    expect(g.state.rpg.ranks['999999']).toBeUndefined();
    expect(g.state.rpg.ranks[String(c.id)]).toBeUndefined(); // nothing earned yet
  });
});

describe('GenLab RPG – Beute', () => {
  function run(dungeon = 'rootMaze') {
    const g = strongGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    for (const d of g.content.rpgDungeons.list) g.state.rpg.cleared[d.id] = 1;
    const c = g.state.creatures[0]!;
    toLevel(g, c.id, balance.rpg.maxLevel);
    startRpgRun(g, c.id, dungeon);
    return { g, r: g.state.rpg.run! };
  }

  it('deeper dungeons pay more and have better chances', () => {
    const a = run('rootMaze');
    const b = run('crystalCore');
    expect(roomLoot(b.g, b.r, 'boss')['towerTokens']!).toBeGreaterThan(roomLoot(a.g, a.r, 'boss')['towerTokens']!);
    expect(lootChance(b.g, b.r, 'boss', 'aeonShards')).toBeGreaterThan(lootChance(a.g, a.r, 'boss', 'aeonShards'));
    expect(lootChance(b.g, b.r, 'boss', 'timeCrystals')).toBe(1);
  });

  it('time crystals and Äon-Splitter stop at the weekly cap, a new week starts over', () => {
    const { g, r } = run('crystalCore');
    const cap = balance.rpg.weeklyCap['timeCrystals']!;
    // Plenty of rooms with a good chance: carried crystals never go beyond the cap.
    for (let i = 0; i < 60; i++) {
      r.choices = ['treasure'];
      enterRoom(g, 0);
      expect(r.loot['timeCrystals'] ?? 0).toBeLessThanOrEqual(cap);
    }
    expect(r.loot['timeCrystals']).toBe(cap);
    expect(weeklyRoom(g, 'timeCrystals')).toBe(0);
    leaveRpgRun(g);
    expect(g.state.resources['timeCrystals']!.toNumber()).toBe(cap);
    expect(weeklyRoom(g, 'timeCrystals')).toBe(0);
    expect(weeklyRoom(g, 'towerTokens')).toBe(Infinity);
    g.state.lastTickAt += 7 * 86_400_000;
    expect(weeklyRoom(g, 'timeCrystals')).toBe(cap);
  });

  it('gene samples catalogue missing alleles when paid out', () => {
    const { g, r } = run();
    const before = Object.keys(g.state.geneLibrary).length;
    r.loot[ALLELE_SAMPLES] = 2;
    leaveRpgRun(g);
    expect(Object.keys(g.state.geneLibrary).length).toBe(before + 2);
    expect(g.state.resources[ALLELE_SAMPLES]).toBeUndefined();
  });
});

describe('GenLab RPG – Freischaltung und Tagesbelohnung', () => {
  it('opens at tower floor 20 and comes back at once after an Äon (the record stays)', () => {
    const g = makeGame();
    expect(g.content.features.get('rpg').condition).toEqual({ type: 'towerFloor', floor: 20 });
    unlockFeature(g, 'tower');
    g.state.tower.best = 19;
    checkUnlocks(g);
    expect(g.state.features['rpg']).toBeFalsy();
    g.state.tower.best = 20;
    checkUnlocks(g);
    expect(g.state.features['rpg']).toBe(true);
    refreshTorches(g, NOW);
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    // An Äon clears the features; the tower record ever brings the RPG back, the stock is not filled twice.
    startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze');
    leaveRpgRun(g);
    g.state.features = {};
    g.state.tower.best = 0;
    g.state.tower.bestEver = 20;
    checkUnlocks(g);
    refreshTorches(g, NOW);
    expect(g.state.features['rpg']).toBe(true);
    expect(torches(g)).toBe(balance.rpg.maxTorches - 1);
  });

  it('a guardian blocks the way halfway through every dungeon', () => {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    const hero = makeHero(g, 60);
    for (const d of g.content.rpgDungeons.list) {
      g.state.rpg.cleared[d.id] = 1;
      g.state.resources['torches'] = D(9);
      expect(startRpgRun(g, hero.id, d.id).ok).toBe(true);
      const at = guardianRoom(g, d.id);
      expect(at).toBe(Math.round(d.rooms * balance.rpg.guardianAt));
      // Play on (always the first way) until the ways after room `at` are offered.
      for (let step = 0; step < 2000; step++) {
        const run = g.state.rpg.run!;
        if (run.battle) useRpgSkill(g, pickSkill(g));
        else if (run.aftermath) closeRpgAftermath(g);
        else if (run.offer.length > 0) chooseUpgrade(g, 0);
        else if (run.event) chooseEventOption(g, 0);
        else if (run.depth === at) break;
        else enterRoom(g, 0);
      }
      expect(g.state.rpg.run!.choices).toEqual(['elite']);
      leaveRpgRun(g);
    }
  });

  it('candidates are the free monsters, strongest first', () => {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    expect(rpgCandidates(g).map((c) => c.id)).toEqual([g.state.creatures[0]!.id]);
    startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze');
    expect(rpgCandidates(g)).toEqual([]);
  });

  it('a monster being sequenced stays free for the dungeon and keeps its level', () => {
    const g = makeGame();
    unlockFeature(g, 'rpg');
    unlockFeature(g, 'sequencing');
    refreshTorches(g, NOW);
    g.state.resources['essence'] = D(1e6);
    const c = g.state.creatures[0]!;
    g.state.rpg.ranks[String(c.id)] = xpToNext(g, 1);
    expect(startSequencing(g, c.id).ok).toBe(true);
    expect(rpgCandidates(g).map((x) => x.id)).toEqual([c.id]);
    expect(startRpgRun(g, c.id, 'rootMaze').ok).toBe(true);
    expect(rpgLevel(g, c.id).level).toBe(2);
  });

  it('every Tagesbelohnung brings a Fackel once the RPG is open, the last calendar day more', () => {
    const g = makeGame();
    unlockFeature(g, 'daily');
    expect(dailyReward(g, 0).amounts['torches']).toBeUndefined();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    const last = balance.daily.rewards.length - 1;
    expect(dailyReward(g, 0).amounts['torches']!.toNumber()).toBe(balance.rpg.dailyTorches);
    expect(dailyReward(g, last).amounts['torches']!.toNumber()).toBe(balance.rpg.dailyTorchesLast);
    // Beyond the refill stock.
    expect(claimDaily(g, NOW).ok).toBe(true);
    expect(torches(g)).toBe(balance.rpg.maxTorches + balance.rpg.dailyTorches);
  });
});

describe('GenLab RPG – Ausrüstung', () => {
  function game() {
    const g = strongGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    g.state.resources['torches'] = D(50);
    return g;
  }

  it('deeper dungeons give rarer pieces more often; rarity multiplies the values', () => {
    const g = game();
    const rare = (dungeon: string) => {
      let n = 0;
      for (let i = 0; i < 400; i++) if (g.content.rarities.get(rollItem(g, dungeon).rarity).order >= 2) n++;
      return n;
    };
    expect(rare('crystalCore')).toBeGreaterThan(rare('rootMaze'));
    const common = itemValues(g, { id: 1, gear: 'fang', rarity: 'common' }).stats.atk!;
    const epic = itemValues(g, { id: 2, gear: 'fang', rarity: 'epic' }).stats.atk!;
    expect(epic).toBeCloseTo(common * balance.rpg.gearRarityMult['epic']!);
  });

  it('worn equipment helps every monster in the dungeon, only one piece per slot', () => {
    const g = game();
    const c = g.state.creatures[0]!;
    toLevel(g, c.id, balance.rpg.maxLevel);
    const base = heroStats(g, c).atk;
    g.state.rpg.items.push({ id: 7, gear: 'fang', rarity: 'common' }, { id: 8, gear: 'claw', rarity: 'rare' }, { id: 9, gear: 'totem', rarity: 'common' });
    expect(equipItem(g, 'armor', 7).ok).toBe(false);
    expect(equipItem(g, 'weapon', 99).ok).toBe(false);
    expect(equipItem(g, 'weapon', 7).ok).toBe(true);
    expect(heroStats(g, c).atk).toBe(Math.round(base * 1.1));
    expect(equipItem(g, 'weapon', 8).ok).toBe(true);
    expect(heroPerks(g, []).crit).toBeCloseTo(0.04 * balance.rpg.gearRarityMult['rare']!);
    equipItem(g, 'charm', 9);
    expect(heroPerks(g, []).regen).toBeCloseTo(0.01);
    startRpgRun(g, c.id, 'rootMaze');
    expect(equipItem(g, 'weapon', null).ok).toBe(false);
  });

  it('found equipment is carried: safe at a rest or on the way out, lost on a defeat', () => {
    const g = game();
    const c = g.state.creatures[0]!;
    startRpgRun(g, c.id, 'rootMaze');
    const r = g.state.rpg.run!;
    r.gear.push({ id: 101, gear: 'fang', rarity: 'common' });
    secureLoot(g);
    expect(g.state.rpg.items.map((i) => i.id)).toEqual([101]);
    r.gear.push({ id: 102, gear: 'shell', rarity: 'rare' });
    finishRpgRun(g, false);
    expect(g.state.rpg.items.map((i) => i.id)).toEqual([101]);
    expect(g.state.rpg.lastResult!.gear.map((i) => i.id)).toEqual([101]);
    startRpgRun(g, c.id, 'rootMaze');
    g.state.rpg.run!.gear.push({ id: 103, gear: 'totem', rarity: 'epic' });
    leaveRpgRun(g);
    expect(g.state.rpg.items.map((i) => i.id)).toEqual([101, 103]);
  });

  it('bosses always drop a piece; equipment survives a prestige', () => {
    const g = game();
    const c = g.state.creatures[0]!;
    toLevel(g, c.id, balance.rpg.maxLevel);
    startRpgRun(g, c.id, 'rootMaze');
    const r = g.state.rpg.run!;
    r.depth = g.content.rpgDungeons.get('rootMaze').rooms;
    r.choices = ['boss'];
    enterRoom(g, 0);
    for (let i = 0; i < 100 && g.state.rpg.run?.battle; i++) useRpgSkill(g, 'strike');
    expect(g.state.rpg.items.length).toBe(1);
    equipItem(g, g.content.rpgGear.get(g.state.rpg.items[0]!.gear).slot, g.state.rpg.items[0]!.id);
    unlockFeature(g, 'inheritance');
    g.state.earned['gold'] = D(1e9);
    performPrestige(g, 'inheritance');
    expect(g.state.rpg.items.length).toBe(1);
    expect(equippedIds(g)).toEqual([g.state.rpg.items[0]!.id]);
  });
});

function equippedIds(g: ReturnType<typeof makeGame>): number[] {
  return Object.values(g.state.rpg.equipped).filter((v): v is number => v !== null);
}

describe('GenLab RPG – Runen und Zerlegen', () => {
  function game() {
    const g = strongGame();
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    return g;
  }

  it('taking equipment apart gives Runen, not while it is worn', () => {
    const g = game();
    g.state.rpg.items.push({ id: 1, gear: 'fang', rarity: 'epic' }, { id: 2, gear: 'shell', rarity: 'common' });
    equipItem(g, 'weapon', 1);
    expect(salvageItem(g, 1).ok).toBe(false);
    expect(salvageItem(g, 2).ok).toBe(true);
    expect(g.state.resources['runes']!.toNumber()).toBe(balance.rpg.salvage['common']);
    expect(g.state.rpg.items.map((i) => i.id)).toEqual([1]);
  });

  it('pieces found while the collection is full are taken apart', () => {
    const g = game();
    for (let i = 0; i < balance.rpg.maxItems; i++) g.state.rpg.items.push({ id: 1000 + i, gear: 'fang', rarity: 'common' });
    startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze');
    const item = { id: 5, gear: 'totem', rarity: 'rare' };
    g.state.rpg.run!.gear.push(item);
    leaveRpgRun(g);
    expect(g.state.rpg.items).toHaveLength(balance.rpg.maxItems);
    expect(g.state.resources['runes']!.toNumber()).toBe(salvageValue(g, item));
  });

  it('Runen buy lasting progress with rising cost up to a limit', () => {
    const g = game();
    const c = g.state.creatures[0]!;
    toLevel(g, c.id, balance.rpg.maxLevel);
    const atk = heroStats(g, c).atk;
    expect(buyMeta(g, 'fighting').ok).toBe(false);
    g.state.resources['runes'] = D(10_000);
    const first = metaCost(g, 'fighting')!;
    expect(buyMeta(g, 'fighting').ok).toBe(true);
    expect(metaCost(g, 'fighting')!).toBeGreaterThan(first);
    expect(Math.abs(heroStats(g, c).atk - atk * 1.04)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 10; i++) buyMeta(g, 'fighting');
    expect(g.state.rpg.meta['fighting']).toBe(g.content.rpgMeta.get('fighting').maxLevel);
    expect(metaCost(g, 'fighting')).toBeNull();
  });

  it('Fackelhalter raises the stock, Vorbereitung charges the special, Vielseitig adds the role skill', () => {
    const g = game();
    g.state.resources['runes'] = D(10_000);
    buyMeta(g, 'torchBag');
    expect(maxTorches(g)).toBe(balance.rpg.maxTorches + 1);
    const c = g.state.creatures[0]!;
    c.abilities = ['tough'];
    c.latent = null;
    expect(rpgSkillsFor(g, c)).toHaveLength(4);
    buyMeta(g, 'versatile');
    const skills = rpgSkillsFor(g, c);
    expect(skills).toHaveLength(5);
    expect(skills[2]!.id).toBe('mend');
    expect(skills[3]!.from?.role).toBeDefined();
    buyMeta(g, 'prepared');
    startRpgRun(g, c.id, 'rootMaze');
    startRpgBattle(g, 'brawler', 'sproutle', 0);
    expect(g.state.rpg.run!.battle!.charge).toBeCloseTo(0.25);
  });
});
