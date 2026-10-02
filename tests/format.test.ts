import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber, formatNumberParts } from '@core/format';
import { D } from '@core/num';

describe('German number formatting', () => {
  it('formats small numbers with German separators', () => {
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatNumber(12.39)).toBe('12,3');
    expect(formatNumber(1234)).toBe('1.234');
    expect(formatNumber(0)).toBe('0');
  });

  it('abbreviates large numbers', () => {
    expect(formatNumber(12_345)).toBe('12,3 Tsd.');
    expect(formatNumber(4_560_000)).toBe('4,56 Mio.');
    expect(formatNumber(7e9)).toBe('7 Mrd.');
  });

  it('falls back to scientific notation', () => {
    expect(formatNumber(D('1.234e100'))).toBe('1,23e100');
  });

  it('splits value and unit for tight layouts', () => {
    expect(formatNumberParts(561_703_469_944)).toEqual(['561', 'Mrd.']);
    expect(formatNumberParts(1234)).toEqual(['1.234', '']);
    expect(formatNumberParts(-12_345)).toEqual(['-12,3', 'Tsd.']);
    expect(formatNumberParts(D('1.234e100'))).toEqual(['1,23', 'e100']);
  });

  it('formats durations', () => {
    expect(formatDuration(5_000)).toBe('5 s');
    expect(formatDuration(125_000)).toBe('2 min 5 s');
    expect(formatDuration(3_720_000)).toBe('1 h 2 min');
    expect(formatDuration(30 * 3_600_000)).toBe('30 h 0 min');
    expect(formatDuration(86 * 3_600_000 + 23 * 60_000)).toBe('3 d 14 h');
  });
});

describe('scientific notation preference', () => {
  it('switches large numbers to scientific notation', async () => {
    const { setNotation } = await import('@core/format');
    expect(formatNumber(4_560_000, { notation: 'scientific' })).toBe('4,56e6');
    setNotation('scientific');
    expect(formatNumber(12_345)).toBe('1,23e4');
    expect(formatNumber(1234)).toBe('1.234');
    setNotation('short');
    expect(formatNumber(12_345)).toBe('12,3 Tsd.');
  });
});

describe('fixed decimals for live counters', () => {
  it('keeps trailing zeros so the width stays stable', () => {
    expect(formatNumber(12, { fixed: true })).toBe('12,0');
    expect(formatNumber(12.34, { fixed: true })).toBe('12,3');
    expect(formatNumber(4_500_000, { fixed: true })).toBe('4,50 Mio.');
    expect(formatNumber(4_500_000)).toBe('4,5 Mio.');
    expect(formatNumber(250, { decimals: 0, fixed: true })).toBe('250');
  });
});

describe('formatModifier', () => {
  it('writes every kind of bonus the same way', async () => {
    const { formatModifier } = await import('@core/format');
    expect(formatModifier('pct', 0.25)).toBe('+25 %');
    expect(formatModifier('pct', -0.1)).toBe('−10 %');
    expect(formatModifier('mult', 1.25)).toBe('×1,25');
    expect(formatModifier('mult', 0.73, { reductionPercent: true })).toBe('−27 %');
    expect(formatModifier('add', 2)).toBe('+2');
    expect(formatModifier('add', 0.05, { percentAdd: true })).toBe('+5 %');
  });
});
