import { D, type NumLike } from './num';

const SUFFIXES = ['', 'Tsd.', 'Mio.', 'Mrd.', 'Bio.', 'Brd.', 'Trio.', 'Trd.', 'Quadr.', 'Quadrd.', 'Quint.', 'Quintd.'];

const de = (value: number, maxFraction: number, minFraction = 0) =>
  value.toLocaleString('de-DE', { maximumFractionDigits: maxFraction, minimumFractionDigits: minFraction });

export type Notation = 'short' | 'scientific';

let defaultNotation: Notation = 'short';

/** Player preference: German short scale (Tsd., Mio. …) or scientific from 10.000 on. */
export function setNotation(n: Notation): void {
  defaultNotation = n;
}

/**
 * German number formatting: `1.234,5`, `12,3 Tsd.`, `4,56 Mio.` …, and
 * scientific (`1,23e45`) beyond the suffix list or when chosen.
 */
export function formatNumber(value: NumLike, opts: { fullBelow?: number; decimals?: number; notation?: Notation; fixed?: boolean } = {}): string {
  // `fixed` keeps trailing zeros ("12,0", "4,50 Mio.") so live counters don't change width.
  const min = (decimals: number) => (opts.fixed ? decimals : 0);
  const d = D(value);
  const fullBelow = opts.fullBelow ?? 1e4;
  const sign = d.lt(0) ? '-' : '';
  const abs = d.abs();
  if (abs.lt(fullBelow)) {
    const decimals = opts.decimals ?? 1;
    return sign + de(floorTo(abs.toNumber(), decimals), decimals, min(decimals));
  }
  const exponent = Math.floor(abs.log10());
  const tier = Math.floor(exponent / 3);
  if ((opts.notation ?? defaultNotation) === 'short' && tier < SUFFIXES.length) {
    const scaled = abs.div(D(10).pow(tier * 3)).toNumber();
    const decimals = scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
    return `${sign}${de(floorTo(scaled, decimals), decimals, min(decimals))} ${SUFFIXES[tier]}`;
  }
  return `${sign}${de(floorTo(abs.mantissa, 2), 2, 2)}e${abs.exponent}`;
}

/**
 * `formatNumber` split into value and unit (`["561", "Mrd."]`, `["1,23", "e45"]`,
 * `["1.234", ""]`) for tight layouts that put the unit on its own line.
 */
export function formatNumberParts(value: NumLike, opts: Parameters<typeof formatNumber>[1] = {}): [string, string] {
  const text = formatNumber(value, opts);
  const space = text.lastIndexOf(' ');
  if (space > 0) return [text.slice(0, space), text.slice(space + 1)];
  const e = text.indexOf('e');
  return e > 0 ? [text.slice(0, e), text.slice(e)] : [text, ''];
}

/** Rounds down (never show more than the player has); epsilon absorbs float noise. */
function floorTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.floor(value * f + 1e-7) / f;
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${de(fraction * 100, decimals)} %`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // From two days on, days read better than "151 h" (week-long voyages).
  if (h >= 48) return `${Math.floor(h / 24)} d ${h % 24} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}
