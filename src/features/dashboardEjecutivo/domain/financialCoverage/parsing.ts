import { epochDay } from '../financialMetrics/calendar';

export type Row = Record<string, unknown>;
export type Validator = (value: unknown) => boolean;
export function record(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function count(value: unknown): number | null {
  if (typeof value === 'string' && (value.length > 16 || !/^(0|[1-9]\d*)$/.test(value))) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const result = Number(value);
  return Number.isSafeInteger(result) && result >= 0 ? result : null;
}
export const countValue: Validator = (value) => count(value) !== null;
export const nullableCount: Validator = (value) => value === null || countValue(value);
export const dateValue: Validator = (value) => typeof value === 'string' && epochDay(value) !== null;
export const nullableDate: Validator = (value) => value === null || dateValue(value);
export const currencyValue: Validator = (value) => typeof value === 'string' && /^[A-Z]{3}$/.test(value);
export const booleanValue: Validator = (value) => typeof value === 'boolean';
export const member = (values: readonly unknown[]): Validator => (value) => values.includes(value);
export function utcTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  return dateValue(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
/** PostgreSQL timestamptz text is accepted only with an explicit offset and a valid civil date. */
export function observedDate(value: unknown): boolean {
  if (nullableDate(value)) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)$/.test(value)) return false;
  return dateValue(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 &&
    Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60 && Number.isFinite(Date.parse(value));
}
export function project(row: unknown, shape: Record<string, Validator>): Row | null {
  if (!record(row)) return null;
  const output: Row = {};
  for (const [key, validate] of Object.entries(shape)) {
    if (!validate(row[key])) return null;
    output[key] = row[key];
  }
  return output;
}
export function countsBounded(row: Row, totalKey: string, keys: readonly string[]): boolean {
  const total = count(row[totalKey]);
  return total !== null && keys.every((key) => row[key] === null || (count(row[key]) ?? Infinity) <= total);
}
/** Only for SQL categories known to be mutually exclusive; never for overlapping flags. */
export function exclusiveCountsBounded(row: Row, totalKey: string, keys: readonly string[]): boolean {
  const total = count(row[totalKey]);
  if (total === null) return false;
  const known = keys.map((key) => count(row[key])).filter((value): value is number => value !== null);
  return known.reduce((sum, value) => sum + BigInt(value), 0n) <= BigInt(total);
}
export function orderedDates(row: Row, firstKey: string, lastKey: string): boolean {
  const first = row[firstKey]; const last = row[lastKey];
  if (first === null || last === null) return first === last;
  return typeof first === 'string' && typeof last === 'string' && Date.parse(first) <= Date.parse(last);
}
