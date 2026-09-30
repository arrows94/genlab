import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { createCreature } from '@core/creatures';
import { elementMultiplier, enemyFor, fightNextFloor, setTeam, simulateFight, startRun, type Fighter, type FightResult } from '@core/features/tower';
import { analyzeDefeat, currentDefeat, fightProtocol } from '@core/features/towerReport';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, content, makeGame } from './helpers';

function towerGame() {
  const g = makeGame(5);
  for (const f of ['farm', 'breeding', 'tower']) unlockFeature(g, f);
  g.state.resources.towerTokens = D(1e6);
  return g;
}

const unit = (over: Partial<Fighter> = {}): Fighter => ({
  name: 'x', speciesId: 'emberpup', element: 'fire', hp: 1e4, maxHp: 1e4, atk: 100, def: 0, spd: 10, power: 1, elementPower: 1, team: true, ...over,
});
const foe = (over: Partial<Fighter> = {}) => unit({ name: 'foe', team: false, element: 'metal', ...over });
const report = (g: ReturnType<typeof towerGame>, floor: number, r: FightResult) => analyzeDefeat(g, { floor, fighters: r.fighters, stats: r.stats });

describe('fight stats', () => {
  it('add up to the damage of the fight', () => {
    const g = towerGame();
    const team = [unit({ technique: 'blaze' }), unit({ name: 'y', element: 'water', thorns: 0.3, row: 'back' })];
    const r = simulateFight(g, team, [foe({ hp: 5e4, maxHp: 5e4, atk: 300, technique: 'venom' }), foe({ name: 'f2', hp: 5e4, maxHp: 5e4, atk: 300 })], Rng.fromSeed(3));
    const s = r.stats;
    const teamDealt = s.dealt[0]! + s.dealt[1]!;
    expect(teamDealt).toBe(r.dealt);
    expect(s.taken[2]! + s.taken[3]!).toBe(r.dealt);
    expect(s.dealt[2]! + s.dealt[3]!).toBe(s.taken[0]! + s.taken[1]!);
    expect(s.seconds).toBe(r.seconds);
    // Whoever is down has a time, whoever stands has HP left.
    s.hpLeft.forEach((hp, i) => expect(hp <= 0).toBe(s.downAt[i]! >= 0));
  });

  it('do not change the fight itself (same RNG use)', () => {
    const g = towerGame();
    const run = () => simulateFight(g, [unit({ technique: 'shock', element: 'electric' })], foe({ hp: 3e4, maxHp: 3e4, atk: 400 }), Rng.fromSeed(11));
    const a = run();
    const b = run();
    expect(a.events).toEqual(b.events);
    expect(a.stats).toEqual(b.stats);
  });
});

describe('defeat analysis', () => {
  it('a time-out says the team did too little damage', () => {
    const g = towerGame();
    const r = simulateFight(g, [unit({ hp: 1e9, maxHp: 1e9 })], foe({ hp: 1e9, maxHp: 1e9, atk: 1 }), Rng.fromSeed(1), { limitSec: 5 });
    expect(r.win).toBe(false);
    expect(r.stats.timeout).toBe(true);
    const rep = report(g, 5, r);
    expect(rep.timeout).toBe(true);
    expect(rep.reasons[0]!.id).toBe('timeout');
    expect(rep.foeHpLeft).toBeGreaterThan(0.99);
  });

  it('names an element disadvantage with the elements that would help', () => {
    const g = towerGame();
    const pair = content.elements.list.flatMap((a) => content.elements.list.map((b) => [a.id, b.id] as const)).find(([att, def]) => elementMultiplier(g, att, def) > 1 && elementMultiplier(g, def, att) < 1)!;
    const [foeEl, teamEl] = pair;
    const r = simulateFight(g, [unit({ element: teamEl })], foe({ element: foeEl, atk: 800, hp: 2e4, maxHp: 2e4 }), Rng.fromSeed(2));
    expect(r.win).toBe(false);
    const rep = report(g, 5, r);
    const reason = rep.reasons.find((x) => x.id === 'element')!;
    expect(reason).toBeDefined();
    const counters = content.elements.list.filter((e) => e.strongAgainst.includes(foeEl));
    for (const e of counters) expect(reason.tip).toContain(e.name);
  });

  it('explains the Element-Schild of a boss floor', () => {
    const g = towerGame();
    let floor = balance.tower.bossTraitFromFloor;
    while (enemyFor(g, floor).trait !== 'elementShield') floor += balance.tower.bossEvery;
    const boss = enemyFor(g, floor);
    const neutral = content.elements.list.find((e) => elementMultiplier(g, e.id, boss.element) <= 1)!.id;
    const r = simulateFight(g, [unit({ element: neutral, hp: 1e15, maxHp: 1e15, atk: boss.maxHp / 200 })], boss, Rng.fromSeed(4), { limitSec: 10 });
    expect(r.stats.shielded).toBeGreaterThan(0);
    expect(report(g, floor, r).reasons.map((x) => x.id)).toContain('shield');
  });

  it('points at a team member that fell early', () => {
    const g = towerGame();
    const team = [unit({ name: 'Zart', hp: 50, maxHp: 50 }), unit({ name: 'Zäh', hp: 1e5, maxHp: 1e5, atk: 1 })];
    const r = simulateFight(g, team, foe({ hp: 1e6, maxHp: 1e6, atk: 200 }), Rng.fromSeed(5), { limitSec: 20 });
    const rep = report(g, 5, r);
    expect(rep.members.map((m) => m.name)).toEqual(['Zart', 'Zäh']);
    expect(rep.members[0]!.downAt).toBeGreaterThanOrEqual(0);
    expect(rep.reasons.some((x) => x.id === 'fragile' && x.title.includes('Zart'))).toBe(true);
    expect(rep.reasons.length).toBeLessThanOrEqual(3);
  });

  it('is kept after a lost run until a later run climbs past that floor', () => {
    const g = towerGame();
    const c = createCreature(g, { speciesId: 'emberpup', rarity: 'common', abilities: [], stats: { hp: 20, atk: 5, def: 2, spd: 2 }, exactStats: true });
    expect(setTeam(g, [c.id]).ok).toBe(true);
    expect(startRun(g, false).ok).toBe(true);
    while (g.state.tower.run) fightNextFloor(g);
    const d = g.state.tower.lastDefeat!;
    expect(d).not.toBeNull();
    expect(d.floor).toBe(g.state.tower.lastResult!.floor);
    expect(currentDefeat(g)?.floor).toBe(d.floor);
    expect(startRun(g, false).ok).toBe(true);
    expect(currentDefeat(g)).not.toBeNull();
    g.state.tower.run!.floor = d.floor;
    expect(currentDefeat(g)).toBeNull();
  });
});

describe('icon protocol', () => {
  it('lists every moment and ends with the result', () => {
    const g = towerGame();
    const r = simulateFight(g, [unit({ technique: 'blaze', atk: 500 })], foe({ hp: 8000, maxHp: 8000 }), Rng.fromSeed(6));
    expect(r.win).toBe(true);
    const lr = { floor: 3, win: r.win, log: r.log, fighters: r.fighters, events: r.events, stats: r.stats };
    const all = fightProtocol(g, lr);
    expect(all.at(-1)).toEqual(expect.objectContaining({ icon: '🏆', important: true, tone: 'good' }));
    // Hits on the foe are good for the team, the knock-out is marked.
    const hits = all.filter((p) => p.icon === '⚔️');
    expect(hits.some((p) => p.a === 0)).toBe(true);
    expect(hits.every((p) => p.tone === (p.a === 0 ? 'good' : 'bad'))).toBe(true);
    expect(all.some((p) => p.icon === '💀' && p.t === 1 && p.important)).toBe(true);
    expect(all.some((p) => p.text.startsWith('Brand') && p.important)).toBe(true);
    const important = all.filter((p) => p.important);
    expect(important.length).toBeLessThan(all.length);
  });

  it('works for old results without stats', () => {
    const g = towerGame();
    const r = simulateFight(g, [unit({ hp: 10, maxHp: 10 })], foe({ atk: 1e4 }), Rng.fromSeed(7));
    const all = fightProtocol(g, { floor: 1, win: false, log: r.log, fighters: r.fighters, events: r.events });
    expect(all.at(-1)!.text).toContain('Team besiegt');
  });
});
