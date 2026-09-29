import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { SAVE_VERSION, SaveError, deserialize, exportSave, importSave, mergeDefaults, migrate, serialize, type Migration } from '@core/save';
import { renameCreature } from '@core/actions';
import { progressSummary } from '@core/queries';
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

  it('repairs references to creatures that no longer exist', () => {
    const g = makeGame();
    const id = g.state.creatures[0]!.id;
    g.state.tower.team = [id, 4242];
    const { state } = deserialize(serialize(g.state, NOW));
    expect(state.tower.team).toEqual([id]);
  });

  it('keeps the rng stream after loading', () => {
    const g = makeGame();
    const copy = makeGame();
    copy.setState(deserialize(serialize(g.state)).state);
    expect(copy.rng.next()).toBe(g.rng.next());
  });

  it('exports and imports a compressed text backup (with umlauts)', async () => {
    const g = makeGame();
    renameCreature(g, g.state.creatures[0]!.id, 'Glühwürmchen');
    const text = await exportSave(g.state, NOW);
    expect(text.startsWith('GENLAB2:')).toBe(true);
    expect(text.length).toBeLessThan(serialize(g.state, NOW).length);
    const { state, savedAt } = await importSave(text);
    expect(savedAt).toBe(NOW);
    expect(state.creatures[0]!.name).toBe('Glühwürmchen');
  });

  it('still imports the old uncompressed format', async () => {
    const g = makeGame();
    renameCreature(g, g.state.creatures[0]!.id, 'Glühwürmchen');
    const bytes = new TextEncoder().encode(serialize(g.state, NOW));
    const text = 'GENLAB1:' + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    expect((await importSave(text)).state.creatures[0]!.name).toBe('Glühwürmchen');
  });

  it('ignores line breaks and spaces added when the text was sent around', async () => {
    const g = makeGame();
    const text = await exportSave(g.state, NOW);
    const wrapped = `  ${text.match(/.{1,60}/g)!.join('\n')} \n`;
    expect((await importSave(wrapped)).state.creatures).toEqual(g.state.creatures);
  });

  it('rejects garbage', async () => {
    await expect(importSave('hello')).rejects.toThrow(SaveError);
    await expect(importSave('GENLAB1:%%%')).rejects.toThrow(SaveError);
    await expect(importSave('GENLAB2:%%%')).rejects.toThrow(SaveError);
    await expect(importSave('GENLAB2:' + btoa('not gzip at all'))).rejects.toThrow(SaveError);
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

describe('async save storage', () => {
  it('round-trips a save through the async storage contract', async () => {
    const { MemoryStorage } = await import('@core/save');
    const storage = new MemoryStorage();
    expect(await storage.load()).toBeNull();
    const g = makeGame();
    await storage.save(serialize(g.state, NOW));
    const loaded = deserialize((await storage.load())!);
    expect(loaded.state.creatures).toEqual(g.state.creatures);
    await storage.clear();
    expect(await storage.load()).toBeNull();
  });
});

describe('progressSummary', () => {
  it('shows only unlocked systems and counts progress of any state', async () => {
    const g = makeGame();
    const labels = (s: typeof g.state) => progressSummary(g.content, s).map((r) => r.label);
    expect(labels(g.state)).toEqual(['Spielzeit', 'Kreaturen', 'Erfolge']);

    g.state.features.inheritance = true;
    g.state.features.tower = true;
    g.state.prestige.inheritance = { count: 3 };
    g.state.tower.best = 12;
    const { state } = await importSave(await exportSave(g.state, NOW));
    const rows = Object.fromEntries(progressSummary(g.content, state).map((r) => [r.label, r.value]));
    expect(rows).toMatchObject({ Vererbung: 3, 'Turm-Rekord': 12, Kreaturen: g.state.creatures.length });
    expect(rows).not.toHaveProperty('Äon');
  });
});
