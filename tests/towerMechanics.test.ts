import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { createCreature } from '@core/creatures';
import {
  actionIntervals, buyRelic, elementMultiplier, evadeChance, enemyFor, equipRelic, fightNextFloor, fighterFor, floorRewardInfo, relicCost, setTeam, simulateFight, startRun, towerMilestones,
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
    const taken = result.events.filter((e) => e.a === 0 && !e.kind && e.at <= heal.at && e.at > heal.at - 1).reduce((n, e) => n + e.dmg, 0);
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
      ['fire', 'water', 'earth'].map((e) => unit(Math.round(16 * (boost.spd ?? 1)), { element: e, hp: 200, maxHp: 200, atk: Math.round(66 * (boost.atk ?? 1)), def: 33 }));
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
