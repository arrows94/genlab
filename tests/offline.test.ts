import { describe, expect, it } from 'vitest';
import { checkCondition, dexCounts } from '@core/conditions';
import { createCreature } from '@core/creatures';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

const HOUR = 3_600_000;

describe('dex conditions', () => {
  it('count by species, rarity, both and in total', () => {
    const g = makeGame();
    g.state.dex = { 'emberpup:common': true, 'emberpup:rare': true, 'steamling:rare': true };
    const check = (c: { species?: string; rarity?: string; count?: number }) => checkCondition(g.state, { type: 'dex', ...c });
    expect(check({ species: 'emberpup', count: 2 })).toBe(true);
    expect(check({ species: 'emberpup', count: 3 })).toBe(false);
    expect(check({ rarity: 'rare', count: 2 })).toBe(true);
    expect(check({ species: 'steamling', rarity: 'common' })).toBe(false);
    expect(check({ species: 'steamling', rarity: 'rare' })).toBe(true);
    expect(check({ count: 3 })).toBe(true);
    expect(check({ count: 4 })).toBe(false);
    expect(checkCondition(g.state, { type: 'all', of: [{ type: 'dex', species: 'emberpup' }, { type: 'dex', species: 'pebblit' }] })).toBe(false);
    expect(checkCondition(g.state, { type: 'any', of: [{ type: 'dex', species: 'pebblit' }, { type: 'dex', species: 'steamling' }] })).toBe(true);
  });

  it('keeps the counts until the dex gains an entry or is replaced', () => {
    const g = makeGame();
    const first = dexCounts(g.state.dex);
    expect(dexCounts(g.state.dex)).toBe(first);
    g.state.dex['pebblit:epic'] = true;
    expect(dexCounts(g.state.dex).get('pebblit:')).toBe(1);
    g.state.dex = {};
    expect(dexCounts(g.state.dex).get(':')).toBeUndefined();
  });
});

describe('offline catch-up', () => {
  // Guards against per-step work that grows with the save (it once took seconds on a phone).
  it('catches up a day of a big save quickly', () => {
    const g = makeGame(5);
    for (const f of ['farm', 'research', 'breeding', 'mine', 'expedition', 'biolab', 'sequencing', 'market', 'inheritance', 'tower', 'weekly']) unlockFeature(g, f);
    for (const s of content.species.list) for (const r of content.rarities.list) g.state.dex[`${s.id}:${r.id}`] = true;
    for (const s of content.species.list.slice(0, 20)) createCreature(g, { speciesId: s.id, rarity: 'rare', source: 'other' });
    g.invalidate();
    const start = performance.now();
    const report = g.update(g.state.lastTickAt + 24 * HOUR)!;
    const ms = performance.now() - start;
    expect(report.simulatedMs).toBe(report.capMs);
    expect(ms).toBeLessThan(3000);
  });
});
