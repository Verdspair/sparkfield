import type { RngState } from './types.js';
export function createRng(seed: number | string = 1): RngState {
  if (typeof seed === 'number') return { state: seed >>> 0 };
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619) >>> 0;
  return { state };
}
export function nextRandom(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randomInt(rng: RngState, max: number): number {
  if (!Number.isInteger(max) || max < 1) throw new RangeError('randomInt max must be positive');
  return Math.floor(nextRandom(rng) * max);
}
export function shuffle<T>(values: readonly T[], rng: RngState): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(rng, i + 1); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
export function cloneState<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
export function canonicalState(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonicalState).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return '{' + Object.keys(obj).filter(k => obj[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonicalState(obj[k])).join(',') + '}';
}
export function hashState(value: unknown): string {
  const text = canonicalState(value); let a = 2166136261; let b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b ^ c, 2246822519) >>> 0; }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
