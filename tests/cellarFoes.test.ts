import { describe, expect, it } from 'vitest';
import { createCreature } from '@core/creatures';
import { Rng } from '@core/rng';
import { unlockFeature } from '@core/systems/unlocks';
import { enemiesFor, enemyFor, simulateFight, type Fighter } from '@core/features/tower';
import { cellarCourse, courseEnemy, courseTraits, towerCourse } from '@core/features/floors';
import {
  cellarEnemies, cellarFighter, dynastySpecies, eatsLight, fightNextCellarLevel, refreshCellarAttempts, setCellarTeam, shadowModel, startCellarRun,
} from '@core/features/cellar';
import type { Creature } from '@core/state';
import { balance, content, makeGame } from './helpers';

function cellarGame(seed = 5) {
  const g = makeGame(seed);
  for (const f of ['farm', 'breeding', 'tower', 'cellar']) unlockFeature(g, f);
  refreshCellarAttempts(g);
  return g;
}
type G = ReturnType<typeof cellarGame>;

function make(g: G, species: string, power = 300, generation = 1): Creature {
  const c = createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
  c.generation = generation;
  return c;
}

const DARK = content.bossTraits.list.filter((t) => t.courses?.includes('cellar') && !t.courses.includes('tower')).map((t) => t.id);
const bossLevels = (n: number) => Array.from({ length: n }, (_, i) => (i + 1) * balance.cellar.bossEvery);

describe('verworfene Linien', () => {
  it('Keller foes carry a prefix and a tint, tower foes stay as they were', () => {
    const g = cellarGame();
    const prefixes = cellarCourse(g).def.foePrefixes!;
    for (let level = 1; level <= 40; level++) {
      for (const f of cellarEnemies(g, level)) {
        if (f.shadow) continue;
        const name = f.name.replace(/^(Boss|Wächter): /, '');
        expect(prefixes.some((p) => name.startsWith(`${p}-`)), name).toBe(true);
        expect(f.tint).toBe(cellarCourse(g).def.foeTint);
      }
    }
    for (let floor = 1; floor <= 60; floor++) for (const f of enemiesFor(g, floor)) {
      expect(f.tint).toBeUndefined();
      expect(prefixes.some((p) => f.name.includes(`${p}-`))).toBe(false);
    }
  });

  it('the arena gets the tint with the fight', () => {
    const g = cellarGame();
    const team = [make(g, 'emberpup', 2000)];
    const r = simulateFight(g, team.map((c) => cellarFighter(g, c)), cellarEnemies(g, 3), Rng.fromSeed(1));
    expect(r.fighters.filter((f) => !f.team).every((f) => f.tint === cellarCourse(g).def.foeTint)).toBe(true);
    expect(r.fighters.filter((f) => f.team).every((f) => f.tint === undefined)).toBe(true);
  });
});

describe('dark boss traits', () => {
  it('only Keller bosses have them; the tower picks from the old four as before', () => {
    const g = cellarGame();
    expect(DARK.length).toBeGreaterThanOrEqual(3);
    expect(courseTraits(g, towerCourse(g)).some((t) => DARK.includes(t.id))).toBe(false);
    for (let floor = 30; floor <= 3000; floor += 30) {
      const boss = enemiesFor(g, floor).find((f) => f.boss)!;
      expect(DARK.includes(boss.trait ?? '')).toBe(false);
      expect(DARK.includes(boss.phaseTrait ?? '')).toBe(false);
    }
    const seen = new Set(bossLevels(60).flatMap((l) => cellarEnemies(g, l).filter((f) => f.boss).flatMap((f) => [f.trait, f.phaseTrait])));
    expect(DARK.some((id) => seen.has(id))).toBe(true);
  });

  const darkBoss = (g: G, trait: string): Fighter => ({ ...enemyFor(g, 60, { plain: true }), boss: true, trait, hp: 1e7, maxHp: 1e7 });

  it('Lebensraub heals the boss by a share of what it deals', () => {
    const g = cellarGame();
    const team = [cellarFighter(g, make(g, 'emberpup', 400))];
    const plainR = simulateFight(g, team.map((f) => ({ ...f })), { ...darkBoss(g, 'lifeDrain'), trait: undefined }, Rng.fromSeed(3), { limitSec: 20 });
    const drainR = simulateFight(g, team.map((f) => ({ ...f })), darkBoss(g, 'lifeDrain'), Rng.fromSeed(3), { limitSec: 20 });
    expect(plainR.stats.healed[1]).toBe(0);
    expect(drainR.stats.healed[1]!).toBeGreaterThan(0);
  });

  it('Schrecken makes the team miss more while the boss stands', () => {
    const g = cellarGame();
    const team = [cellarFighter(g, make(g, 'emberpup', 400))];
    const calm = simulateFight(g, team.map((f) => ({ ...f })), darkBoss(g, 'elementShield'), Rng.fromSeed(4), { limitSec: 60 });
    const scared = simulateFight(g, team.map((f) => ({ ...f })), darkBoss(g, 'terror'), Rng.fromSeed(4), { limitSec: 60 });
    expect(scared.stats.missed[0]!).toBeGreaterThan(calm.stats.missed[0]!);
  });

  it('Lichtfresser puts out the torch for its fight only', () => {
    const g = cellarGame();
    const level = bossLevels(200).find((l) => eatsLight(g, cellarEnemies(g, l)));
    expect(level).toBeDefined();
    const ids = ['emberpup', 'pebblit', 'steamling'].map((s) => make(g, s, 1e7).id);
    setCellarTeam(g, ids);
    startCellarRun(g);
    const run = g.state.cellar.run!;
    run.level = level! - 1;
    run.light = 0.85;
    fightNextCellarLevel(g);
    expect(run.level).toBe(level);
    // The boss level is a rest vault too: the torch is lit anew afterwards.
    expect(run.light).toBe(level! % balance.cellar.restEvery === 0 ? 1 : 0.85 - balance.cellar.lightPerLevel);
  });
});

describe('Schatten deiner Dynastie', () => {
  it('takes the most bred species, for old saves the deepest dynasty or the stable', () => {
    const g = cellarGame();
    make(g, 'pebblit');
    make(g, 'pebblit');
    const stableFavourite = dynastySpecies(g);
    expect(['pebblit', balance.start.species]).toContain(stableFavourite);
    g.state.dynasties = { steamling: 7 };
    expect(dynastySpecies(g)).toBe('steamling');
    g.state.statistics['bred.emberpup'] = 12;
    g.state.statistics['bred.steamling'] = 3;
    expect(dynastySpecies(g)).toBe('emberpup');
  });

  it('counts hatched eggs per species', () => {
    const g = cellarGame();
    const c = make(g, 'steamling');
    g.bus.emit('eggHatched', { creatureId: c.id, parents: [c.id, c.id] });
    g.bus.emit('eggHatched', { creatureId: c.id, parents: [c.id, c.id] });
    expect(g.state.statistics['bred.steamling']).toBe(2);
  });

  it('is a dark copy of the most advanced creature of that line, with its genes', () => {
    const g = cellarGame();
    g.state.statistics['bred.emberpup'] = 50;
    const young = make(g, 'emberpup', 300, 2);
    const elder = make(g, 'emberpup', 300, 9);
    elder.name = 'Kiko';
    elder.genome['strength'] = ['k', 'k'];
    expect(shadowModel(g, 'emberpup')).toBe(elder);
    const level = balance.cellar.bossEvery;
    const weak = cellarEnemies(g, level).find((f) => f.boss)!;
    expect(weak.shadow).toBe(true);
    expect(weak.speciesId).toBe('emberpup');
    expect(weak.element).toBe(content.species.get('emberpup').element);
    expect(weak.name).toBe('Boss: Schatten von Kiko');
    // Titanenkraft in the line makes the shadow hit harder and crit.
    elder.genome['strength'] = ['Kt', 'Kt'];
    const strong = cellarEnemies(g, level).find((f) => f.boss)!;
    expect(strong.atk).toBeGreaterThan(weak.atk);
    expect(strong.crit ?? 0).toBeGreaterThan(0);
    // Plain foes and the tower's boss stay as they were.
    expect(cellarEnemies(g, level).filter((f) => !f.boss).every((f) => !f.shadow)).toBe(true);
    expect(enemiesFor(g, 30).find((f) => f.boss)!.shadow).toBeUndefined();
    void young;
  });

  it('without a creature of the line it is the line itself', () => {
    const g = cellarGame();
    g.state.statistics['bred.steamling'] = 5;
    g.state.creatures = g.state.creatures.filter((c) => c.speciesId !== 'steamling');
    const boss = cellarEnemies(g, balance.cellar.bossEvery).find((f) => f.boss)!;
    expect(boss.name).toBe(`Boss: Schatten deiner ${content.species.get('steamling').name}-Linie`);
    // Same strength as the course's boss without genes.
    const plain = courseEnemy(g, cellarCourse(g), balance.cellar.bossEvery);
    expect(boss.maxHp).toBe(plain.maxHp);
    expect(boss.atk).toBe(plain.atk);
  });
});
