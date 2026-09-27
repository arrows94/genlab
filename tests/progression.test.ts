import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { playBot } from './bot';

// Run with GENLAB_TIMELINE=1 to print the bot's timeline (for balancing).
const showTimeline = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GENLAB_TIMELINE;

/**
 * Pacing check for the slow idle start: within the first hour every early
 * system unlocks in order and something new happens regularly.
 */
describe('early game pacing (bot)', () => {
  const g = makeGame(2024);
  const timeline = playBot(g, 60);
  const pacingMinutes = 60;
  if (showTimeline) console.log(Object.entries(g.state.earned).map(([k, v]) => `${k}: ${v.toFixed(0)}`).join(', '), g.state.creatures.length);
  if (showTimeline) console.log(timeline.map((t) => `${t.min.toFixed(1).padStart(5)} min  ${t.what}`).join('\n'));

  const unlockedAt = (f: string) => timeline.find((t) => t.what === `Freigeschaltet: ${f}`)?.min;

  it('unlocks systems in the intended order within the first hour', () => {
    const order = ['farm', 'research', 'breeding', 'mine', 'expedition', 'biolab', 'infusion', 'sequencing', 'market', 'recycler', 'hybrids'];
    const times = order.map(unlockedAt);
    times.forEach((t, i) => expect(t, order[i]).toBeDefined());
    for (let i = 1; i < times.length; i++) expect(times[i]!, `${order[i]} nach ${order[i - 1]}`).toBeGreaterThanOrEqual(times[i - 1]!);
    expect(times.at(-1)!).toBeLessThanOrEqual(60);
  });

  it('does not unlock everything in the first minutes', () => {
    expect(unlockedAt('breeding')!).toBeGreaterThanOrEqual(1.5);
    expect(unlockedAt('market')!).toBeGreaterThan(15);
  });

  it('something new happens at least every 8 minutes', () => {
    const times = [0, ...timeline.map((t) => t.min), 60];
    let maxGap = 0;
    for (let i = 1; i < times.length; i++) maxGap = Math.max(maxGap, times[i]! - times[i - 1]!);
    expect(maxGap).toBeLessThanOrEqual(8);
  });

  it('keeps growing the creature pool', () => {
    expect(g.state.creatures.length).toBeGreaterThanOrEqual(6);
  });
});

describe('offline performance', () => {
  it('simulates 12 h offline with a mid-game state quickly', () => {
    const g = makeGame(5);
    playBot(g, 30);
    const t0 = performance.now();
    const report = g.simulateOffline(12 * 3_600_000);
    const ms = performance.now() - t0;
    expect(report.simulatedMs).toBe(12 * 3_600_000);
    expect(ms).toBeLessThan(3000);
  });
});

describe('mid game pacing (bot with inheritance)', () => {
  it('reaches the first inheritance within ~1.5 h and production keeps growing', () => {
    const g = makeGame(2024);
    const early = (() => {
      playBot(g, 30);
      return g.productionRates().food!.toNumber();
    })();
    const timeline = playBot(g, 90, { prestigeAt: 2 });
    const first = timeline.find((t) => t.what.startsWith('Prestige'));
    expect(first, 'erste Vererbung').toBeDefined();
    expect(first!.min).toBeLessThanOrEqual(100);
    expect(g.state.resources.heritage!.toNumber()).toBeGreaterThanOrEqual(2);
    expect(early).toBeGreaterThan(10);
  }, 60_000);
});
