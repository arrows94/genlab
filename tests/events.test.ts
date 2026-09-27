import { describe, expect, it } from 'vitest';
import { EventBus } from '@core/events';
import { collect } from '@core/actions';
import { createCreature } from '@core/creatures';
import { makeGame } from './helpers';

describe('EventBus', () => {
  it('delivers typed payloads and unsubscribes', () => {
    const bus = new EventBus<{ ping: { n: number } }>();
    const got: number[] = [];
    const off = bus.on('ping', (e) => got.push(e.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(got).toEqual([1]);
  });

  it('supports wildcard listeners', () => {
    const bus = new EventBus<{ a: number; b: string }>();
    const seen: string[] = [];
    bus.onAny((type) => seen.push(String(type)));
    bus.emit('a', 1);
    bus.emit('b', 'x');
    expect(seen).toEqual(['a', 'b']);
  });
});

describe('unlocks, statistics and achievements via events', () => {
  it('unlocks features step by step and emits once', () => {
    const g = makeGame();
    const unlocked: string[] = [];
    g.bus.on('featureUnlocked', (e) => unlocked.push(e.feature));
    for (let i = 0; i < 40; i++) collect(g);
    expect(unlocked).toEqual(['farm', 'stats', 'research']);
    for (let i = 0; i < 5; i++) collect(g);
    expect(unlocked.filter((f) => f === 'farm')).toHaveLength(1);
  });

  it('counts statistics from events', () => {
    const g = makeGame();
    for (let i = 0; i < 3; i++) collect(g);
    createCreature(g, { speciesId: 'sproutle', rarity: 'rare', source: 'wild' });
    expect(g.state.statistics.clicks).toBe(3);
    expect(g.state.statistics.creaturesObtained).toBe(2);
    expect(g.state.statistics['creatures.wild']).toBe(1);
  });

  it('grants achievements with their bonus', () => {
    const g = makeGame();
    const perClickBefore = g.mods().apply('collect.food', 1);
    for (let i = 0; i < 50; i++) collect(g);
    expect(g.state.achievements.firstSteps).toBe(true);
    expect(g.mods().apply('collect.food', 1)).toBeCloseTo(perClickBefore * 1.1);
  });

  it('registers new dex entries and grants dex bonuses', () => {
    const g = makeGame();
    const found: string[] = [];
    g.bus.on('dexDiscovered', (e) => found.push(`${e.species}:${e.rarity}`));
    createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    expect(found).toEqual(['pebblit:common']);
    expect(g.mods().apply('production.food', 1)).toBeCloseTo(1 + 2 * 0.02);
  });
});
