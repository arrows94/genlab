import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from '@core/format';
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

  it('formats durations', () => {
    expect(formatDuration(5_000)).toBe('5 s');
    expect(formatDuration(125_000)).toBe('2 min 5 s');
    expect(formatDuration(3_720_000)).toBe('1 h 2 min');
  });
});
