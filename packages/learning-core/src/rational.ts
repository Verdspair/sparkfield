export interface RationalScore { numerator: string; denominator: string }
export interface Rational { n: bigint; d: bigint }
export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}
export function rational(n: bigint, d = 1n): Rational {
  if (d === 0n) throw new RangeError('Zero denominator');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export const ZERO = rational(0n);
export const ONE = rational(1n);
export function decimal(value: string | number): Rational {
  const text = String(value).trim();
  if (text.length > 256) throw new RangeError('Numeric literal is too long');
  const m = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!m) throw new TypeError(`Invalid finite decimal: ${text}`);
  const frac = m[3] ?? m[4] ?? '';
  const exp = Number(m[5] ?? 0) - frac.length;
  if (!Number.isSafeInteger(exp) || Math.abs(exp) > 1000) throw new RangeError('Numeric exponent out of range');
  let n = BigInt((m[2] ?? '0') + frac);
  if (m[1] === '-') n = -n;
  return exp >= 0 ? rational(n * 10n ** BigInt(exp)) : rational(n, 10n ** BigInt(-exp));
}
export function add(a: Rational, b: Rational): Rational {
  const g = gcd(a.d, b.d);
  return rational(a.n * (b.d / g) + b.n * (a.d / g), a.d * (b.d / g));
}
export function multiply(a: Rational, b: Rational): Rational {
  const g1 = gcd(a.n, b.d); const g2 = gcd(b.n, a.d);
  return rational((a.n / g1) * (b.n / g2), (a.d / g2) * (b.d / g1));
}
export function divide(a: Rational, b: Rational): Rational { return multiply(a, rational(b.d, b.n)); }
export function compare(a: Rational, b: Rational): number {
  const diff = a.n * b.d - b.n * a.d;
  return diff < 0n ? -1 : diff > 0n ? 1 : 0;
}
export function serialize(a: Rational): RationalScore { return { numerator: a.n.toString(), denominator: a.d.toString() }; }
export function safeInteger(n: bigint): number {
  if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Exact integer exceeds the numeric wire contract; use exactScore instead');
  }
  return Number(n);
}
export function wireInteger(n: bigint): number | string {
  return n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER) ? n.toString() : Number(n);
}
export function integer(value: number, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): bigint {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${name} out of range`);
  return BigInt(value);
}
