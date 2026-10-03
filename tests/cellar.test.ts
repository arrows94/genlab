import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { deserialize, serialize } from '@core/save';
import { resetLayer } from '@core/prestige';
import { unlockFeature } from '@core/systems/unlocks';
import { debugReset } from '@core/debug';
import { contractDay } from '@core/features/contracts';
import { enemyFor, setTeam } from '@core/features/tower';
import { cellarCourse, courseEnemies, courseEnemy, floorLabel, towerCourse } from '@core/features/floors';
import {
  cellarCheckpoint, cellarLevelLabel, fightNextCellarLevel, refreshCellarAttempts, setCellarAuto, setCellarRow, setCellarTeam, startCellarRun, stopCellarRun,
} from '@core/features/cellar';
import { NOW, balance, content, makeGame } from './helpers';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function cellarGame(seed = 5) {
  const g = makeGame(seed);
  for (const f of ['farm', 'breeding', 'tower', 'cellar']) unlockFeature(g, f);
  refreshCellarAttempts(g);
  return g;
}

function fighter(g: ReturnType<typeof cellarGame>, power: number, species = 'emberpup') {
  return createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
}

/** A cellar team of three of the given power. */
function team(g: ReturnType<typeof cellarGame>, power: number) {
  const ids = [fighter(g, power).id, fighter(g, power, 'pebblit').id, fighter(g, power, 'steamling').id];
  expect(setCellarTeam(g, ids).ok).toBe(true);
  return ids;
}

describe('Genom-Keller: course', () => {
  it('is its own course: other foes than the tower, counted downwards', () => {
    const g = cellarGame();
    const cellar = cellarCourse(g);
    expect(cellar.def.direction).toBe('down');
    expect(cellarLevelLabel(g, 12)).toBe('Ebene −12');
    expect(floorLabel(towerCourse(g), 12)).toBe('Etage 12');
    // Same level, other dice: the two courses do not mirror each other.
    const levels = Array.from({ length: 10 }, (_, i) => i + 1);
    const same = levels.filter((f) => courseEnemy(g, cellar, f).speciesId === courseEnemy(g, towerCourse(g), f).speciesId);
    expect(same.length).toBeLessThan(levels.length);
    // Deterministic per level.
    expect(courseEnemies(g, cellar, 7)).toEqual(courseEnemies(g, cellar, 7));
  });

  it('starts about as strong as tower floor 90 and grows steeper than the tower', () => {
    const g = cellarGame();
    const first = courseEnemy(g, cellarCourse(g), 1, { plain: true });
    const tower90 = enemyFor(g, 90, { plain: true });
    expect(first.maxHp / tower90.maxHp).toBeGreaterThan(0.9);
    expect(first.maxHp / tower90.maxHp).toBeLessThan(1.1);
    const growth = (course: ReturnType<typeof cellarCourse>, f: number) => courseEnemy(g, course, f + 1, { plain: true }).maxHp / courseEnemy(g, course, f, { plain: true }).maxHp;
    expect(growth(cellarCourse(g), 20)).toBeGreaterThan(growth(towerCourse(g), 150));
  });
});

describe('Genom-Keller: unlock and team', () => {
  it('opens at tower floor 150', () => {
    const g = makeGame(3);
    unlockFeature(g, 'tower');
    g.state.tower.best = 149;
    g.step(100);
    expect(g.state.features['cellar']).toBeFalsy();
    g.state.tower.best = 150;
    g.step(100);
    expect(g.state.features['cellar']).toBe(true);
  });

  it('a creature never stands in the tower and the cellar team at once', () => {
    const g = cellarGame();
    const a = fighter(g, 100);
    const b = fighter(g, 100);
    expect(setTeam(g, [a.id]).ok).toBe(true);
    const r = setCellarTeam(g, [a.id, b.id]);
    expect(r.ok).toBe(false);
    expect(setCellarTeam(g, [b.id]).ok).toBe(true);
    expect(setTeam(g, [a.id, b.id]).ok).toBe(false);
    expect(setCellarRow(g, b.id, 'back').ok).toBe(true);
    expect(g.state.cellar.back).toEqual([b.id]);
  });

  it('a busy creature cannot go down', () => {
    const g = cellarGame();
    const [id] = team(g, 1000);
    g.state.creatures.find((c) => c.id === id)!.job = { kind: 'nest', target: 'x' };
    expect(startCellarRun(g).ok).toBe(false);
    expect(g.state.cellar.attempts).toBe(balance.cellar.attemptsPerDay);
  });
});

describe('Genom-Keller: attempts', () => {
  it('refill per day, are saved up to the limit and cost one per descent', () => {
    const g = cellarGame();
    const cfg = balance.cellar;
    expect(g.state.cellar.attempts).toBe(cfg.attemptsPerDay);
    team(g, 1);
    for (let i = 0; i < cfg.attemptsPerDay; i++) {
      expect(startCellarRun(g).ok).toBe(true);
      stopCellarRun(g);
    }
    expect(g.state.cellar.attempts).toBe(0);
    const r = startCellarRun(g);
    expect(r.ok).toBe(false);
    // Next day: a new batch; a long absence fills up to the limit, not beyond.
    refreshCellarAttempts(g, g.state.lastTickAt + DAY);
    expect(g.state.cellar.attempts).toBe(cfg.attemptsPerDay);
    refreshCellarAttempts(g, g.state.lastTickAt + 10 * DAY);
    expect(g.state.cellar.attempts).toBe(cfg.maxAttempts);
    expect(g.state.cellar.day).toBe(contractDay(g, g.state.lastTickAt + 10 * DAY));
  });
});

describe('Genom-Keller: descent', () => {
  it('HP carries from level to level, a rest vault heals, the record sets the next start', () => {
    const g = cellarGame();
    // Strong enough for a few levels, weak enough to take damage on the first one.
    const ids = team(g, 200);
    expect(startCellarRun(g).ok).toBe(true);
    expect(g.state.creatures.filter((c) => ids.includes(c.id)).every((c) => c.job?.kind === 'cellar')).toBe(true);
    const run = g.state.cellar.run!;
    fightNextCellarLevel(g);
    expect(run.level).toBe(1);
    // Erschöpfung: someone took damage, and it stays.
    const afterFirst = [...run.hp];
    expect(afterFirst.some((s) => s < 1)).toBe(true);
    const tokens = g.state.resources['shadowMarks']!.toNumber();
    expect(tokens).toBeGreaterThan(0);
    // Down to the first rest vault: it heals by restHeal.
    while (g.state.cellar.run && g.state.cellar.run.level < balance.cellar.restEvery - 1) fightNextCellarLevel(g);
    expect(g.state.cellar.run).not.toBeNull();
    const before = [...g.state.cellar.run!.hp];
    fightNextCellarLevel(g);
    expect(g.state.cellar.run).not.toBeNull();
    const after = g.state.cellar.run!.hp;
    // Every share rose by about restHeal (minus what the fight cost) or is full.
    expect(after.every((s) => s > 0)).toBe(true);
    expect(after.reduce((a, b) => a + b, 0)).toBeGreaterThan(before.reduce((a, b) => a + b, 0));
    // Fight on until the team falls.
    let guard = 0;
    while (g.state.cellar.run && guard++ < 500) fightNextCellarLevel(g);
    expect(g.state.cellar.run).toBeNull();
    const best = g.state.cellar.best;
    expect(best).toBeGreaterThanOrEqual(balance.cellar.restEvery);
    expect(g.state.cellar.history[0]).toMatchObject({ level: best, startLevel: 1 });
    expect(g.state.creatures.filter((c) => ids.includes(c.id)).every((c) => c.job === null)).toBe(true);
    expect(g.state.statistics['record.cellarLevel']).toBe(best);
    // The next descent starts below the last checkpoint.
    expect(startCellarRun(g).ok).toBe(true);
    expect(g.state.cellar.run!.level).toBe(cellarCheckpoint(g));
    expect(cellarCheckpoint(g)).toBe(Math.floor(best / balance.cellar.checkpointEvery) * balance.cellar.checkpointEvery);
  });

  it('a fallen team member sits the rest of the descent out', () => {
    const g = cellarGame();
    team(g, 1500);
    startCellarRun(g);
    const run = g.state.cellar.run!;
    run.hp[0] = 0;
    fightNextCellarLevel(g);
    expect(g.state.cellar.lastResult!.fighters!.filter((f) => f.team)).toHaveLength(2);
    expect(run.hp[0]).toBe(0);
  });

  it('a weak team falls on the first level and earns nothing', () => {
    const g = cellarGame();
    team(g, 1);
    startCellarRun(g);
    fightNextCellarLevel(g);
    expect(g.state.cellar.run).toBeNull();
    expect(g.state.cellar.best).toBe(0);
    expect(g.state.cellar.history[0]).toMatchObject({ level: 0, startLevel: 1 });
    expect(g.state.resources['shadowMarks'] ?? D(0)).toEqual(D(0));
  });
});

describe('Genom-Keller: in the background', () => {
  it('runs its descents on its own and catches up offline the same in slices as in one go', () => {
    const make = () => {
      const g = cellarGame(11);
      team(g, 1500);
      setCellarAuto(g, true);
      return g;
    };
    const whole = make();
    const sliced = make();
    const now = whole.state.lastTickAt + 30 * HOUR;
    whole.update(now);
    let report = sliced.update(now, 0);
    let calls = 1;
    while (!report) report = sliced.update(now + calls++ * 1000, 0);
    expect(serialize(sliced.state, 0)).toBe(serialize(whole.state, 0));
    // Three attempts on the first day, three more after the day change – all used.
    expect(whole.state.cellar.history.length).toBeGreaterThanOrEqual(balance.cellar.attemptsPerDay);
    expect(whole.state.cellar.best).toBeGreaterThan(0);
  });
});

describe('Genom-Keller: resets and saves', () => {
  it('an inheritance ends the descent and clears the team, the record and attempts stay', () => {
    const g = cellarGame();
    team(g, 1500);
    startCellarRun(g);
    fightNextCellarLevel(g);
    const { best, attempts } = g.state.cellar;
    resetLayer(g, content.prestigeLayers.get('inheritance'));
    expect(g.state.cellar).toMatchObject({ run: null, team: [], back: [], best, attempts });
  });

  it('survives a save round trip, and an old save without a cellar loads with defaults', () => {
    const g = cellarGame();
    team(g, 1500);
    startCellarRun(g);
    fightNextCellarLevel(g);
    const loaded = deserialize(serialize(g.state, NOW)).state;
    expect(loaded.cellar).toEqual(JSON.parse(JSON.stringify(g.state.cellar)));
    const old = JSON.parse(serialize(g.state, NOW)) as { state: Record<string, unknown> };
    delete old.state['cellar'];
    expect(deserialize(JSON.stringify(old)).state.cellar).toMatchObject({ team: [], run: null, best: 0, attempts: 0, day: -1 });
  });

  it('debug resets fill the attempts and clear the progress', () => {
    const g = cellarGame();
    g.state.cellar.attempts = 0;
    g.state.cellar.best = 30;
    expect(debugReset(g, 'cellarAttempts').ok).toBe(true);
    expect(g.state.cellar.attempts).toBe(balance.cellar.maxAttempts);
    expect(debugReset(g, 'cellarProgress').ok).toBe(true);
    expect(g.state.cellar.best).toBe(0);
  });
});
