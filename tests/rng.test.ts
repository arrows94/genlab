import { describe, expect, it } from 'vitest';
import { Rng, hashSeed } from '@core/rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = Rng.fromSeed(123);
    const b = Rng.fromSeed(123);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBe(20);
  });

  it('continues from a persisted state', () => {
    const a = Rng.fromSeed('save');
    a.next();
    a.next();
    const copy = new Rng({ ...a.seedState });
    expect(copy.next()).toBe(a.next());
  });

  it('produces values in range', () => {
    const r = Rng.fromSeed(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
  });

  it('hashes string seeds (weekly mutation seeds)', () => {
    expect(hashSeed('2026-W39')).toBe(hashSeed('2026-W39'));
    expect(hashSeed('2026-W39')).not.toBe(hashSeed('2026-W40'));
  });
});
