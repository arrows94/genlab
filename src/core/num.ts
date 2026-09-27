import Decimal from 'break_infinity.js';

export { Decimal };
export type Num = Decimal;
export type NumLike = Decimal | number | string;

export const ZERO = new Decimal(0);

export function D(value: NumLike): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function isDecimal(value: unknown): value is Decimal {
  return value instanceof Decimal;
}
