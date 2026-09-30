import { describe, expect, it } from 'vitest';
import { makeGame } from './helpers';
import { walls, type TeamKind } from './towerCurve';

// GENLAB_CURVE=1 prints every boss wall for all kinds of teams (mixed, with and without element advantage).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/** Boss floors with trait and companions (the first boss at 30 has neither). */
const BOSSES = [60, 90, 120, 150, 180, 210, 240, 270];

describe('Boss-Mauer (in früheren Etagen, ×1,11 je Etage)', () => {
  it('a boss costs a mixed team about three former floors, none more than seven', () => {
    const w = walls(makeGame(1), BOSSES, 'mixed');
    const avg = w.reduce((n, x) => n + x.floors, 0) / w.length;
    expect(avg).toBeLessThanOrEqual(4);
    expect(Math.max(...w.map((x) => x.floors))).toBeLessThanOrEqual(7);
  }, 120_000);

  it('the Element-Schild wants element advantage: easy with it, clearly harder without', () => {
    const g = makeGame(1);
    const shield = BOSSES.filter((f) => walls(g, [f], 'mixed')[0]!.trait === 'elementShield');
    expect(shield.length).toBeGreaterThan(0);
    for (const x of walls(g, shield, 'advantage')) expect(x.floors).toBeLessThanOrEqual(4);
    for (const x of walls(g, shield, 'neutral')) {
      expect(x.floors).toBeGreaterThanOrEqual(5);
      expect(x.floors).toBeLessThanOrEqual(11);
    }
  }, 120_000);

  it.skipIf(!env.GENLAB_CURVE)('report', () => {
    const g = makeGame(1);
    const lines: string[] = [];
    for (const kind of ['mixed', 'advantage', 'neutral'] as TeamKind[]) {
      for (const w of walls(g, [30, ...BOSSES, 300], kind)) {
        lines.push(`${kind.padEnd(9)} Etage ${String(w.floor).padStart(3)}  ${w.trait.padEnd(13)} ${w.phase.padEnd(13)} ×${w.ratio.toFixed(2)} = ${w.floors.toFixed(1)} Etagen`);
      }
    }
    console.log(lines.join('\n'));
  }, 600_000);
});
