import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { campSlots, missionAvailable, missionDurationMs, rollMinRarity, startMission } from '@core/features/expedition';
import { stableFree } from '@core/features/stable';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

function expeditionGame(seed = 1) {
  const g = makeGame(seed);
  g.invalidate();
  unlockFeature(g, 'expedition');
  g.state.resources.food = D(1e5);
  return g;
}

describe('expeditions', () => {
  it('costs food, occupies the creature and returns rewards', () => {
    const g = expeditionGame();
    const c = g.state.creatures[0]!;
    expect(startMission(g, c.id, 'short').ok).toBe(true);
    expect(g.state.resources.food!.toNumber()).toBe(1e5 - 25);
    expect(c.job?.kind).toBe('mission');
    expect(startMission(g, c.id, 'short').ok).toBe(false);

    const results: unknown[] = [];
    g.bus.on('missionCompleted', (e) => results.push(e));
    g.advance(missionDurationMs(g, 'short') + 100);
    expect(results).toHaveLength(1);
    expect(c.job).toBeNull();
    expect(g.state.resources.gold!.gt(0)).toBe(true);
  });

  it('respects camp slots', () => {
    const g = expeditionGame();
    unlockFeature(g, 'breeding');
    const [a, b] = g.state.creatures;
    expect(campSlots(g)).toBe(1);
    expect(startMission(g, a!.id, 'short').ok).toBe(true);
    expect(startMission(g, b!.id, 'short')).toEqual({ ok: false, reason: 'Alle Camps sind belegt.' });
  });

  it('finds wild creatures at the mission wild chance', () => {
    const g = expeditionGame(3);
    g.state.upgrades.stableExpansion = 100; // room for every find
    g.state.resources.food = D(1e9);
    const c = g.state.creatures[0]!;
    let found = 0;
    const runs = 400;
    g.bus.on('missionCompleted', (e) => e.wildCreatureId !== null && found++);
    for (let i = 0; i < runs; i++) {
      startMission(g, c.id, 'long');
      g.step(missionDurationMs(g, 'long'));
    }
    expect(found / runs).toBeGreaterThan(0.5);
    expect(found / runs).toBeLessThan(0.7);
    expect(g.state.statistics.wildFound).toBe(found);
  });

  it('cartographer shortens missions', () => {
    const g = expeditionGame();
    g.state.upgrades.cartographer = 1;
    g.invalidate();
    expect(missionDurationMs(g, 'medium')).toBe(540_000);
  });
});

describe('Tagesreisen', () => {
  const H = 3_600_000;
  const order = (id: string) => content.rarities.get(id).order;

  function journeyGame(seed = 1) {
    const g = expeditionGame(seed);
    g.state.prestige.inheritance = { count: 1 };
    return g;
  }

  it('open only after the first inheritance and last half a day', () => {
    const g = expeditionGame();
    expect(missionAvailable(g, 'mistmoor')).toBe(false);
    expect(startMission(g, g.state.creatures[0]!.id, 'mistmoor').ok).toBe(false);
    g.state.prestige.inheritance = { count: 1 };
    expect(missionAvailable(g, 'mistmoor')).toBe(true);
    expect(missionAvailable(g, 'cloudridge')).toBe(false);
    expect(missionDurationMs(g, 'mistmoor')).toBe(12 * H);
  });

  it('never roll below the minimum rarity', () => {
    const g = journeyGame();
    for (let i = 0; i < 200; i++) expect(order(rollMinRarity(g, 'rare'))).toBeGreaterThanOrEqual(order('rare'));
    expect(rollMinRarity(g, 'mythic')).toBe('mythic');
  });

  it('bring back a rare creature by the real clock, even into a full stable', () => {
    const g = journeyGame();
    g.state.prestige.inheritance = { count: 2 };
    const c = g.state.creatures[0]!;
    expect(startMission(g, c.id, 'cloudridge').ok).toBe(true);
    // Fill the stable to the brim.
    g.state.upgrades = {};
    g.invalidate();
    while (stableFree(g) > 0) g.state.creatures.push({ ...structuredClone(c), id: g.state.nextId++, job: null });
    const before = g.state.creatures.length;
    const found: (number | null)[] = [];
    g.bus.on('missionCompleted', (e) => found.push(e.wildCreatureId));

    // Away for 30 h: the 24 h journey ends beyond the 12 h offline cap.
    g.simulateOffline(30 * H);
    expect(found).toHaveLength(1);
    const wild = g.state.creatures.find((x) => x.id === found[0]);
    expect(wild).toBeDefined();
    expect(order(wild!.rarity)).toBeGreaterThanOrEqual(order('epic'));
    expect(g.state.creatures.length).toBe(before + 1);
    expect(c.job).toBeNull();
  });
});
