import { ready, unavailable, type Result } from './contract';
const DAY = 86_400_000;
export interface Period { start: string; end: string }
/** Business-date strings only. No browser zone, Date.now(), or implied 30-day month. */
export function epochDay(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || iso < '0001-01-01') return null;
  const time = Date.parse(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== iso) return null;
  return time / DAY;
}
export function dateFromDay(day: number): string { return new Date(day * DAY).toISOString().slice(0, 10); }
export function daysInclusive(period: Period): number | null {
  const start = epochDay(period.start); const end = epochDay(period.end);
  return start === null || end === null || end < start ? null : end - start + 1;
}
export function isCalendarMonth(period: Period): boolean {
  const days = daysInclusive(period);
  if (days === null || !period.start.endsWith('-01')) return false;
  const next = new Date(`${period.start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return epochDay(period.end) === next.getTime() / DAY - 1;
}
export function closedThreeMonths(args: {
  selectedMonth: string; businessToday: string; accountingClosedThrough: string | null;
}): Result<readonly Period[]> {
  const today = epochDay(args.businessToday);
  if (!/^\d{4}-\d{2}$/.test(args.selectedMonth) || today === null ||
    epochDay(`${args.selectedMonth}-01`) === null) return unavailable('INVALID_PERIOD', 'Mes o fecha de negocio inválidos.');
  const start = `${args.selectedMonth}-01`;
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const end = dateFromDay(date.getTime() / DAY - 1);
  if (epochDay(end)! >= today) return unavailable('OPEN_CALENDAR_MONTH', 'El mes seleccionado aún no terminó.');
  const closed = args.accountingClosedThrough === null ? null : epochDay(args.accountingClosedThrough);
  if (closed === null || closed < epochDay(end)!) return unavailable('UNVERIFIED_CLOSE', 'Falta cierre contable que cubra el mes.');
  const periods: Period[] = [];
  let cursor = epochDay(end)!;
  for (let i = 0; i < 3; i++) {
    if (cursor < epochDay('0001-01-01')!) return unavailable('DATE_OUT_OF_RANGE', 'La comparación excede el rango de fechas soportado.');
    const monthEnd = dateFromDay(cursor);
    const monthStart = `${monthEnd.slice(0, 7)}-01`;
    periods.unshift({ start: monthStart, end: monthEnd });
    cursor = epochDay(monthStart)! - 1;
  }
  return ready(periods);
}
