import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { createCreature } from '@core/creatures';
import {
  buyRelic, elementMultiplier, enemyFor, equipRelic, fightNextFloor, fighterFor, floorRewardInfo, relicCost, setTeam, simulateFight, startRun, towerMilestones,
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
    const plain = fight(g, undefined, team).result.events.find((e) => e.a === 0)!.dmg;
    const shielded = fight(g, 'elementShield', team).result.events.find((e) => e.a === 0)!.dmg;
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

  it('Regeneration heals a share of the damage taken in the round', () => {
    const g = towerGame();
    const team = [fighterFor(g, champion(g, 5000))];
    const { result } = fight(g, 'regenerator', team);
    const firstHit = result.events.find((e) => e.a === 0)!.dmg;
    const heal = Number(result.log.find((l) => l.includes('heilt'))!.match(/heilt (\d+)/)![1]);
    expect(heal).toBe(Math.round(firstHit * content.bossTraits.get('regenerator').value));
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
