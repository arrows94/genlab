import { describe, expect, it } from 'vitest';
import { ModifierSet, isValidTarget } from '@core/modifiers';

describe('ModifierSet', () => {
  it('applies (base + add) × (1 + Σpct) × Πmult', () => {
    const m = new ModifierSet();
    m.addAll('a', [{ target: 'production.gold', op: 'add', value: 5 }]);
    m.addAll('b', [{ target: 'production.gold', op: 'pct', value: 0.5 }]);
    m.addAll('c', [{ target: 'production.gold', op: 'pct', value: 0.5 }]);
    m.addAll('d', [{ target: 'production.gold', op: 'mult', value: 2 }]);
    m.addAll('e', [{ target: 'production.gold', op: 'mult', value: 1.5 }]);
    expect(m.apply('production.gold', 5)).toBeCloseTo((5 + 5) * 2 * 3);
    expect(m.applyD('production.gold', 5).toNumber()).toBeCloseTo(60);
  });

  it('returns base unchanged for unknown targets', () => {
    expect(new ModifierSet().apply('production.food', 7)).toBe(7);
  });

  it('scales add/pct linearly and compounds mult per level', () => {
    const m = new ModifierSet();
    m.addAll('lvl', [
      { target: 'production.food', op: 'pct', value: 0.1 },
      { target: 'breeding.time', op: 'mult', value: 0.9 },
    ], 3);
    expect(m.apply('production.food', 1)).toBeCloseTo(1.3);
    expect(m.apply('breeding.time', 100)).toBeCloseTo(100 * 0.9 ** 3);
  });

  it('keeps a per-source breakdown', () => {
    const m = new ModifierSet();
    m.addAll('upgrade:x', [{ target: 'stat.atk', op: 'pct', value: 0.1 }]);
    m.addAll('dex:y', [{ target: 'stat.atk', op: 'pct', value: 0.2 }]);
    expect(m.breakdown('stat.atk').map((x) => x.source)).toEqual(['upgrade:x', 'dex:y']);
  });

  it('validates targets', () => {
    expect(isValidTarget('production.gold')).toBe(true);
    expect(isValidTarget('rarity.weight.mythic')).toBe(true);
    expect(isValidTarget('foo.bar')).toBe(false);
    expect(isValidTarget('production..gold')).toBe(false);
  });
});
