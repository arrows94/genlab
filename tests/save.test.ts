import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { SAVE_VERSION, SaveError, deserialize, exportSave, importSave, mergeDefaults, migrate, serialize, type Migration } from '@core/save';
import { renameCreature } from '@core/actions';
import { NOW, makeGame } from './helpers';

describe('save / load', () => {
  it('round-trips the full state including huge numbers', () => {
    const g = makeGame();
    g.state.resources.gold = D('1.2345e1234');
    g.advance(1000);
    const { state, savedAt } = deserialize(serialize(g.state, NOW));
    expect(savedAt).toBe(NOW);
    expect(state.resources.gold!.eq(D('1.2345e1234'))).toBe(true);
    expect(state.creatures).toEqual(g.state.creatures);
    expect(state.rng).toEqual(g.state.rng);
  });

  it('keeps the rng stream after loading', () => {
    const g = makeGame();
    const copy = makeGame();
    copy.setState(deserialize(serialize(g.state)).state);
    expect(copy.rng.next()).toBe(g.rng.next());
  });

  it('exports and imports a text backup (with umlauts)', () => {
    const g = makeGame();
    renameCreature(g, g.state.creatures[0]!.id, 'Glühwürmchen');
    const text = exportSave(g.state, NOW);
    expect(text.startsWith('GENLAB1:')).toBe(true);
    expect(importSave(text).state.creatures[0]!.name).toBe('Glühwürmchen');
  });

  it('rejects garbage', () => {
    expect(() => importSave('hello')).toThrow(SaveError);
    expect(() => importSave('GENLAB1:%%%')).toThrow(SaveError);
    expect(() => deserialize('{not json')).toThrow(SaveError);
  });

  it('fills fields added after the save was written', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state));
    delete raw.state.statistics;
    delete raw.state.buffs;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.statistics).toEqual({});
    expect(state.buffs).toEqual([]);
  });

  it('mergeDefaults keeps loaded values and nested defaults', () => {
    const merged = mergeDefaults({ a: 1, nested: { x: 1, y: 2 } }, { a: 5, nested: { x: 9 }, extra: true });
    expect(merged).toEqual({ a: 5, nested: { x: 9, y: 2 }, extra: true });
  });
});

describe('save migrations', () => {
  const migrations: Record<number, Migration> = {
    1: (s) => ({ ...s, gold: s.money, money: undefined }),
    2: (s) => ({ ...s, gold: (s.gold as number) * 10 }),
  };

  it('runs every migration step in order', () => {
    const result = migrate({ saveVersion: 1, savedAt: 0, state: { money: 5 } }, migrations, 3);
    expect(result.saveVersion).toBe(3);
    expect(result.state).toMatchObject({ gold: 50 });
  });

  it('only runs the missing steps', () => {
    expect(migrate({ saveVersion: 2, savedAt: 0, state: { gold: 5 } }, migrations, 3).state).toMatchObject({ gold: 50 });
  });

  it('fails clearly on gaps or saves from the future', () => {
    expect(() => migrate({ saveVersion: 0, savedAt: 0, state: {} }, migrations, 3)).toThrow(/Version 0 auf 1/);
    expect(() => migrate({ saveVersion: SAVE_VERSION + 1, savedAt: 0, state: {} })).toThrow(SaveError);
  });
});

describe('real migrations', () => {
  it('v1 → v2 adds potion boosts to creatures', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 1;
    for (const c of raw.state.creatures) {
      delete c.boosts;
      delete c.boostUses;
    }
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.creatures[0]!.boosts).toEqual({});
    expect(state.creatures[0]!.boostUses).toBe(0);
  });
});
