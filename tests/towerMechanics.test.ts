import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { createCreature } from '@core/creatures';
import {
  actionIntervals, teamSynergies, buyRelic, damage, elementMultiplier, evadeChance, pickTarget, roleOf, rowOf, setRow, targetingOf, enemyFor, equipRelic, fightNextFloor, fighterFor, floorRewardInfo, relicCost, setTeam, simulateFight, startRun, towerMilestones,
} from '@core/features/tower';
import { unlockFeature } from '@core/systems/unlocks';
import type { Fighter } from '@core/features/tower';
import { balance, content, makeGame } from './helpers';

function towerGame() {
  const g = makeGame(5);
  for (const f of ['farm', 'breeding', 'tower']) unlockFeature(g, f);
  g.state.resources.towerTokens = D(1e6);
  return g;
}

function champion(g: ReturnType<typeof towerGame>, power: number, species = 'emberpup') {
  return createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
}

/** An element the given attacker element has no advantage against. */
function neutralFor(g: ReturnType<typeof towerGame>, attacker: string): string {
  return content.elements.list.find((e) => elementMultiplier(g, attacker, e.id) === 1)!.id;
}

describe('boss traits', () => {
  it('bosses get a fixed trait from the configured floor on', () => {
    const g = towerGame();
    const from = balance.tower.bossTraitFromFloor;
    expect(enemyFor(g, from - balance.tower.bossEvery).trait).toBeUndefined();
    expect(enemyFor(g, from + 1).trait).toBeUndefined(); // not a boss floor
    const boss = enemyFor(g, from);
    expect(content.bossTraits.has(boss.trait!)).toBe(true);
    expect(enemyFor(g, from).trait).toBe(boss.trait); // deterministic per floor
  });

  const fight = (g: ReturnType<typeof towerGame>, trait: string | undefined, team: Fighter[]) => {
    const enemy = { ...enemyFor(g, 40), trait, hp: 1e9, maxHp: 1e9 };
    enemy.element = neutralFor(g, team[0]!.element);
    return { enemy, result: simulateFight(g, team.map((f) => ({ ...f })), enemy, Rng.fromSeed(7)) };
  };

  it('Element-Schild lets only a quarter through without element advantage', () => {
    const g = towerGame();
    const team = [fighterFor(g, champion(g, 5000))];
    const plain = fight(g, undefined, team).result.events.find((e) => e.a === 0 && !e.kind)!.dmg;
    const shielded = fight(g, 'elementShield', team).result.events.find((e) => e.a === 0 && !e.kind)!.dmg;
    expect(shielded).toBe(Math.max(1, Math.round(plain * 0.25)));
  });

  it('Wandler changes its element every round, Regeneration heals', () => {
    const g = towerGame();
    const team = [fighterFor(g, champion(g, 5000))];
    const shift = fight(g, 'shifter', team);
    expect(shift.result.log.some((l) => l.includes('wechselt zu'))).toBe(true);
    const regen = fight(g, 'regenerator', team);
    expect(regen.result.log.some((l) => l.includes('heilt'))).toBe(true);
  });

  it('Regeneration heals a share of the damage taken in the last second', () => {
    const g = towerGame();
    const team = [fighterFor(g, champion(g, 5000))];
    const { result } = fight(g, 'regenerator', team);
    const heal = result.events.find((e) => e.kind === 'heal')!;
    // Everything that hurt the boss (index 1) in the second before: hits, techniques, burn, thorns.
    const hurts = (e: (typeof result.events)[number]) => e.t === 1 && (!e.kind || e.kind === 'tech' || e.kind === 'dot' || e.kind === 'reflect');
    const taken = result.events.filter((e) => hurts(e) && e.at <= heal.at && e.at > heal.at - 1).reduce((n, e) => n + e.dmg, 0);
    expect(heal.dmg).toBe(Math.round(taken * content.bossTraits.get('regenerator').value));
  });

  it('a regenerating boss is no wall: twice the power of its plain version is enough', () => {
    const g = towerGame();
    const boss = enemyFor(g, 40);
    expect(boss.trait).toBe('regenerator');
    const wins = (power: number, trait: string | undefined) => {
      const team = ['emberpup', 'bubbloon', 'voltmouse'].map((s) => fighterFor(g, champion(g, power, s)));
      let w = 0;
      for (let seed = 1; seed <= 10; seed++) if (simulateFight(g, team.map((f) => ({ ...f })), { ...boss, trait }, Rng.fromSeed(seed)).win) w++;
      return w;
    };
    let power = 50;
    while (wins(power, undefined) < 8) power *= 1.25;
    expect(wins(power * 2, 'regenerator')).toBeGreaterThanOrEqual(8);
  });
});

describe('Aktionsleiste', () => {
  const unit = (spd: number, over: Partial<Fighter> = {}): Fighter => ({
    name: 'x', speciesId: 'emberpup', element: 'fire', hp: 1e6, maxHp: 1e6, atk: 10, def: 0, spd, power: 1, elementPower: 1, team: true, ...over,
  });

  it('faster fighters act more often, relative to the others', () => {
    const g = towerGame();
    const [slow, fast] = actionIntervals(g, [unit(10), unit(20)]);
    expect(fast).toBeLessThan(slow!);
    expect(slow! / fast!).toBeCloseTo(Math.pow(2, balance.tower.speedExponent), 2);
    // Only ratios count: ten times the stats give the same time line.
    expect(actionIntervals(g, [unit(100), unit(200)])).toEqual(actionIntervals(g, [unit(10), unit(20)]));
    const r = simulateFight(g, [unit(20), unit(10)], unit(15, { team: false, element: 'water' }), Rng.fromSeed(1));
    const acts = (i: number) => r.events.filter((e) => e.a === i).length;
    expect(acts(0)).toBeGreaterThan(acts(1));
  });

  it('a faster defender dodges sometimes, capped', () => {
    const g = towerGame();
    expect(evadeChance(g, unit(10), unit(10))).toBe(0);
    expect(evadeChance(g, unit(20), unit(10))).toBe(0);
    expect(evadeChance(g, unit(10), unit(20))).toBeCloseTo(balance.tower.evadePerSpeedLead);
    expect(evadeChance(g, unit(1), unit(1000))).toBe(balance.tower.maxEvade);
    const r = simulateFight(g, [unit(5)], unit(50, { team: false }), Rng.fromSeed(2));
    expect(r.events.some((e) => e.kind === 'miss' && e.dmg === 0)).toBe(true);
  });

  it('ends at the time limit with a defeat and keeps events in time order', () => {
    const g = towerGame();
    const r = simulateFight(g, [unit(10, { atk: 1 })], unit(10, { team: false, atk: 1 }), Rng.fromSeed(3));
    expect(r.win).toBe(false);
    expect(r.seconds).toBe(balance.tower.maxFightSec);
    expect(r.log.at(-1)).toBe('Zeit abgelaufen');
    for (let i = 1; i < r.events.length; i++) expect(r.events[i]!.at).toBeGreaterThanOrEqual(r.events[i - 1]!.at);
    expect(r.fighters.every((f) => f.interval > 0)).toBe(true);
  });

  it('speed wins fights: +50 % Tempo helps about as much as +50 % Angriff', () => {
    const g = towerGame();
    const enemy = enemyFor(g, 25);
    const team = (boost: Partial<Record<'atk' | 'spd', number>>) =>
      ['fire', 'water', 'earth'].map((e) => unit(Math.round(16 * (boost.spd ?? 1)), { element: e, hp: 200, maxHp: 200, atk: Math.round(70 * (boost.atk ?? 1)), def: 33 }));
    const wins = (boost: Partial<Record<'atk' | 'spd', number>>) => {
      let w = 0;
      for (let seed = 1; seed <= 40; seed++) if (simulateFight(g, team(boost), { ...enemy }, Rng.fromSeed(seed)).win) w++;
      return w;
    };
    const base = wins({});
    expect(base).toBeLessThan(35);
    expect(wins({ spd: 1.5 })).toBeGreaterThanOrEqual(38);
    expect(wins({ atk: 1.5 })).toBeGreaterThanOrEqual(38);
  });
});

describe('rows, roles and defence', () => {
  const unit = (over: Partial<Fighter> = {}): Fighter => ({
    name: 'x', speciesId: 'emberpup', element: 'fire', hp: 1e6, maxHp: 1e6, atk: 100, def: 0, spd: 10, power: 1, elementPower: 1, team: true, ...over,
  });

  it('defence blocks a percentage and then a share that grows with VER against ANG', () => {
    const g = towerGame();
    const t = balance.tower;
    const hit = (def: number) => damage(g, unit({ atk: 100 }), unit({ def }), Rng.fromSeed(1));
    // The same seed rolls the same ±10 % spread.
    const rawNoDef = 100 * Rng.fromSeed(1).range(0.9, 1.1);
    const expected = (def: number) => Math.max(1, Math.round(rawNoDef * (t.defScale / (t.defScale + def)) * (1 - t.defRatio * (def / (def + 100)))));
    expect(hit(50)).toBe(expected(50));
    expect(hit(50)).toBeLessThan(Math.round(rawNoDef * (t.defScale / (t.defScale + 50))));
    // Twice the defence of the attack blocks 2/3 of defRatio in the second step.
    expect(hit(200)).toBe(expected(200));
    expect(hit(1e9)).toBe(1);
  });

  it('enemies mostly hit the front row, back-row hunters and the weakest-hunter differ', () => {
    const g = towerGame();
    const front = unit({ name: 'front', row: 'front' });
    const back = unit({ name: 'back', row: 'back', hp: 10 });
    const count = (mode: 'rows' | 'back' | 'weakest') => {
      let f = 0;
      const rng = Rng.fromSeed(4);
      for (let i = 0; i < 400; i++) if (pickTarget(g, mode, [front, back], rng) === front) f++;
      return f / 400;
    };
    expect(count('rows')).toBeGreaterThan(balance.tower.frontShare - 0.08);
    expect(count('rows')).toBeLessThan(balance.tower.frontShare + 0.08);
    expect(count('back')).toBeLessThan(1 - balance.tower.frontShare + 0.08);
    expect(count('weakest')).toBe(0);
    // Only one row occupied: everyone is fair game.
    const r = Rng.fromSeed(5);
    const hits = new Set(Array.from({ length: 50 }, () => pickTarget(g, 'rows', [unit({ name: 'a' }), unit({ name: 'b' })], r).name));
    expect(hits.size).toBe(2);
  });

  it('rows belong to the team and are locked during a run', () => {
    const g = towerGame();
    const a = champion(g, 100);
    const b = champion(g, 100, 'bubbloon');
    expect(setRow(g, a.id, 'back').ok).toBe(false); // not in the team
    setTeam(g, [a.id, b.id]);
    expect(setRow(g, b.id, 'back').ok).toBe(true);
    expect(rowOf(g, b.id)).toBe('back');
    expect(fighterFor(g, b).row).toBe('back');
    expect(fighterFor(g, a).row).toBe('front');
    setTeam(g, [a.id]);
    expect(g.state.tower.back).toEqual([]);
    setTeam(g, [a.id, b.id]);
    setRow(g, b.id, 'back');
    startRun(g);
    expect(setRow(g, b.id, 'front').ok).toBe(false);
  });

  it('derives a role from the stat profile', () => {
    const g = towerGame();
    const base = balance.tower.enemyBase;
    expect(roleOf(g, { hp: base.hp! * 3, atk: base.atk!, def: base.def! * 3, spd: base.spd! })).toBe('tank');
    expect(roleOf(g, { hp: base.hp!, atk: base.atk! * 3, def: base.def!, spd: base.spd! })).toBe('attacker');
    expect(roleOf(g, { hp: base.hp!, atk: base.atk!, def: base.def!, spd: base.spd! * 3 })).toBe('fast');
  });

  it('boss traits bring their own targeting', () => {
    const g = towerGame();
    for (const t of content.bossTraits.list) expect(targetingOf(g, { ...unit({ team: false }), trait: t.id })).toBe(t.targeting ?? 'rows');
    expect(targetingOf(g, unit({ team: false }))).toBe('rows');
  });
});

describe('Element-Techniken, Zustände, Synergien', () => {
  const unit = (over: Partial<Fighter> = {}): Fighter => ({
    name: 'x', speciesId: 'emberpup', element: 'fire', hp: 1e6, maxHp: 1e6, atk: 100, def: 0, spd: 10, power: 1, elementPower: 1, team: true, ...over,
  });
  const foe = (over: Partial<Fighter> = {}) => unit({ name: 'foe', team: false, element: 'metal', hp: 1e7, maxHp: 1e7, atk: 1, ...over });
  const every = balance.tower.techniqueEvery;

  it('every n-th action is the technique of the element', () => {
    const g = towerGame();
    const r = simulateFight(g, [unit({ technique: 'blaze' })], foe(), Rng.fromSeed(1));
    const mine = r.events.filter((e) => e.a === 0 && (!e.kind || e.kind === 'tech'));
    expect(mine[every - 1]!.kind).toBe('tech');
    expect(mine[every - 1]!.tech).toBe('blaze');
    expect(mine.slice(0, every - 1).every((e) => !e.kind)).toBe(true);
    // Brand: burn ticks hurt the foe afterwards.
    expect(r.events.some((e) => e.kind === 'status' && e.status === 'burn' && e.t === 1)).toBe(true);
    expect(r.events.some((e) => e.kind === 'dot' && e.status === 'burn' && e.t === 1 && e.dmg > 0)).toBe(true);
  });

  it('support techniques heal, shield and cleanse the team', () => {
    const g = towerGame();
    const hurt = unit({ name: 'hurt', hp: 500, maxHp: 1000, element: 'earth' });
    const r = simulateFight(g, [unit({ technique: 'spring', element: 'water' }), hurt], foe(), Rng.fromSeed(2));
    expect(r.events.some((e) => e.kind === 'heal' && e.t === 1 && e.dmg === 250)).toBe(true);
    const s2 = simulateFight(g, [unit({ technique: 'bulwark', element: 'earth' })], foe({ atk: 1e4 }), Rng.fromSeed(3));
    expect(s2.events.some((e) => e.kind === 'status' && e.status === 'shield')).toBe(true);
    expect(s2.events.some((e) => (e.absorbed ?? 0) > 0)).toBe(true);
  });

  it('stun delays the next action, slow stretches it', () => {
    const g = towerGame();
    const acts = (tech: string) => {
      const r = simulateFight(g, [unit({ technique: tech, element: 'electric', spd: 10 })], foe({ spd: 10, atk: 1 }), Rng.fromSeed(4));
      return r.events.filter((e) => e.a === 1 && (!e.kind || e.kind === 'miss')).length;
    };
    const plain = simulateFight(g, [unit({ spd: 10 })], foe({ spd: 10, atk: 1 }), Rng.fromSeed(4)).events.filter((e) => e.a === 1 && (!e.kind || e.kind === 'miss')).length;
    expect(acts('shock')).toBeLessThan(plain);
    expect(acts('frost')).toBeLessThan(plain);
  });

  it('crit, thorns and first strike come from modifiers', () => {
    const g = towerGame();
    const c = champion(g, 100);
    c.latent = 'hunter';
    c.deepSequenced = true;
    g.invalidate();
    expect(fighterFor(g, c).crit).toBeCloseTo(0.15);
    c.latent = 'thornSkin';
    g.invalidate();
    expect(fighterFor(g, c).thorns).toBeGreaterThanOrEqual(0.3);
    const r = simulateFight(g, [unit({ thorns: 0.5 })], foe({ atk: 1000 }), Rng.fromSeed(5));
    expect(r.events.some((e) => e.kind === 'reflect' && e.t === 1 && e.dmg > 0)).toBe(true);
    const first = simulateFight(g, [unit({ spd: 1, firstStrike: true })], foe({ spd: 100 }), Rng.fromSeed(6));
    expect(first.events[0]!.a).toBe(0);
    const crit = simulateFight(g, [unit({ crit: 1 })], foe(), Rng.fromSeed(7));
    expect(crit.events.find((e) => e.a === 0 && !e.kind)!.crit).toBe(true);
  });

  it('synergies: pairs hit harder, a colourful team beats the Wandler', () => {
    const g = towerGame();
    expect(teamSynergies(g, ['fire', 'fire', 'water'])).toEqual([expect.objectContaining({ kind: 'pair', elements: ['fire'], active: true })]);
    const div = teamSynergies(g, ['fire', 'water', 'earth'], 'shifter');
    expect(div).toEqual([expect.objectContaining({ kind: 'diversity', active: true })]);
    expect(teamSynergies(g, ['fire', 'water', 'earth'])[0]!.active).toBe(false);
    const first = (els: string[]) => simulateFight(g, els.map((e) => unit({ element: e })), foe({ element: 'metal' }), Rng.fromSeed(8)).events.find((e) => e.a === 0 && !e.kind)!.dmg;
    expect(first(['water', 'water'])).toBeGreaterThan(first(['water', 'earth']));
  });

  it('every element has exactly one technique', () => {
    for (const e of content.elements.list) expect(content.techniques.list.filter((t) => t.element === e.id)).toHaveLength(1);
  });
});

describe('relics', () => {
  it('are bought with Turm-Marken and grow in price', () => {
    const g = towerGame();
    const def = content.relics.get('towerBlade');
    expect(relicCost(g, def.id)!.toNumber()).toBe(def.cost);
    expect(buyRelic(g, def.id).ok).toBe(true);
    expect(g.state.resources.towerTokens!.toNumber()).toBe(1e6 - def.cost);
    expect(relicCost(g, def.id)!.toNumber()).toBe(Math.ceil(def.cost * def.costGrowth));
    g.state.relics[def.id] = def.maxLevel;
    expect(buyRelic(g, def.id).ok).toBe(false);
    g.state.resources.towerTokens = D(0);
    expect(buyRelic(g, 'lifeAmulet')).toEqual({ ok: false, reason: 'Nicht genug Turm-Marken.' });
  });

  it('boost whoever stands in their team place and move between places', () => {
    const g = towerGame();
    const a = champion(g, 100);
    const b = champion(g, 100, 'bubbloon');
    setTeam(g, [a.id, b.id]);
    const base = fighterFor(g, a).atk;
    expect(equipRelic(g, 0, 'towerBlade').ok).toBe(false); // not owned yet
    buyRelic(g, 'towerBlade');
    buyRelic(g, 'towerBlade');
    expect(equipRelic(g, 0, 'towerBlade').ok).toBe(true);
    expect(fighterFor(g, a).atk).toBe(Math.round(base * 1.2));
    // Moving it to the second place takes it away from the first.
    expect(equipRelic(g, 1, 'towerBlade').ok).toBe(true);
    expect(g.state.tower.relicSlots[0]).toBeNull();
    expect(fighterFor(g, a).atk).toBe(base);
    // Relics survive an inheritance (creatures do not).
    g.state.prestige.inheritance = { count: 0 };
    expect(startRun(g).ok).toBe(true);
    expect(equipRelic(g, 0, null).ok).toBe(false); // locked during a run
  });
});

describe('tower milestones', () => {
  it('every 50 floors: shards the first time and a permanent bonus', () => {
    const g = towerGame();
    const every = balance.tower.milestoneEvery;
    const team = [0, 1, 2].map(() => champion(g, 1e6));
    setTeam(g, team.map((c) => c.id));
    g.state.tower.best = every - 1;
    expect(startRun(g).ok).toBe(true);
    g.state.tower.run!.floor = every - 1;
    const before = g.state.resources.aeonShards?.toNumber() ?? 0;
    const damage = g.mods().totals('tower.damage').pct;
    expect(floorRewardInfo(g, every).milestone).toBe(true);
    fightNextFloor(g);
    expect(g.state.tower.best).toBe(every);
    expect(towerMilestones(g)).toBe(1);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(before + balance.tower.milestoneShards);
    expect(g.mods().totals('tower.damage').pct).toBeCloseTo(damage + 0.15);
    // A later run over the same floor pays nothing again.
    g.state.tower.run!.floor = every - 1;
    fightNextFloor(g);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(before + balance.tower.milestoneShards);
  });
});
