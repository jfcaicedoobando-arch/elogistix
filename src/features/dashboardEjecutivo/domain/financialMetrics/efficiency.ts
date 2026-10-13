import { isMoney, ready, unavailable, validComparableScope, sameBasis, sumMoney, type ComparableScope, type Result } from './contract';
import { daysInclusive, epochDay, isCalendarMonth, type Period } from './calendar';
export type BalanceSeries =
  | { method: 'daily-eod'; points: readonly { date: string; amountMinor: number }[] }
  | { method: 'opening-closing'; openingMinor: number; closingMinor: number };
export interface EfficiencyInput {
  metric: 'DSO' | 'DPO';
  period: Period;
  businessToday: string;
  accountingClosedThrough: string | null;
  balances: { side: 'receivables' | 'payables'; scope: ComparableScope; period: Period; series: BalanceSeries };
  activity: { kind: 'credit-sales' | 'credit-purchases-services'; scope: ComparableScope; period: Period; netCreditActivityMinor: number };
}
export interface EfficiencyValue {
  metric: 'DSO' | 'DPO'; days: number; period: Period; calendarDays: number;
  averageBalanceMinor: number; netCreditActivityMinor: number;
  method: BalanceSeries['method']; methodLabel: string; evidenceId: string;
}
function samePeriod(a: Period, b: Period): boolean { return a.start === b.start && a.end === b.end; }
function average(series: BalanceSeries, period: Period): Result<number> {
  if (series.method === 'opening-closing') {
    if (![series.openingMinor, series.closingMinor].every((n) => isMoney(n) && n >= 0))
      return unavailable('INVALID_BALANCE', 'Apertura/cierre debe separar saldos a favor y deuda comercial.');
    // Avoid overflow from adding two otherwise valid amounts.
    return ready(series.openingMinor / 2 + series.closingMinor / 2);
  }
  const days = daysInclusive(period)!; const seen = new Set<string>();
  if (series.points.length !== days) return unavailable('HISTORY_GAP', 'Se requiere un saldo de cierre por cada día del mes.');
  for (const point of series.points) {
    if (epochDay(point.date) === null || point.date < period.start || point.date > period.end || seen.has(point.date))
      return unavailable('HISTORY_GAP', 'Serie diaria con fecha duplicada, ausente o fuera del periodo.');
    if (!isMoney(point.amountMinor) || point.amountMinor < 0) return unavailable('INVALID_BALANCE', 'Saldo diario neto comercial inválido.');
    seen.add(point.date);
  }
  const total = sumMoney(series.points.map((p) => p.amountMinor));
  return total === null ? unavailable('AMOUNT_OVERFLOW', 'Importe fuera del rango exacto del cálculo.') : ready(total / days);
}
function validatePeriod(input: EfficiencyInput): Result<number> {
  const days = daysInclusive(input.period); const today = epochDay(input.businessToday);
  if (!isCalendarMonth(input.period) || days === null || today === null)
    return unavailable('INVALID_PERIOD', 'Se requiere un mes calendario y fecha de negocio válidos.');
  if (epochDay(input.period.end)! >= today) return unavailable('OPEN_CALENDAR_MONTH', 'El mes seleccionado aún no terminó.');
  const closed = input.accountingClosedThrough === null ? null : epochDay(input.accountingClosedThrough);
  if (closed === null || closed < epochDay(input.period.end)!) return unavailable('UNVERIFIED_CLOSE', 'Mes sin cierre contable verificado.');
  return ready(days);
}
function validateBasis(input: EfficiencyInput): Result<void> {
  if (!samePeriod(input.period, input.balances.period) || !samePeriod(input.period, input.activity.period))
    return unavailable('PERIOD_MISMATCH', 'Saldo y actividad deben corresponder al mismo mes.');
  if (!validComparableScope(input.balances.scope) || !validComparableScope(input.activity.scope))
    return unavailable('INCOMPLETE_DATA', 'Falta cobertura completa o política financiera explícita.');
  if (!sameBasis(input.balances.scope, input.activity.scope))
    return unavailable('BASIS_MISMATCH', 'Organización, moneda, población o políticas no comparables.');
  if ((input.metric === 'DSO' && (input.balances.side !== 'receivables' || input.activity.kind !== 'credit-sales')) ||
    (input.metric === 'DPO' && (input.balances.side !== 'payables' || input.activity.kind !== 'credit-purchases-services')))
    return unavailable('POPULATION_MISMATCH', 'El indicador requiere la cartera y actividad comercial a crédito correspondientes.');
  return ready(undefined);
}
export function calculateEfficiency(input: EfficiencyInput): Result<EfficiencyValue> {
  const period = validatePeriod(input);
  if (period.status === 'unavailable') return period;
  const basis = validateBasis(input);
  if (basis.status === 'unavailable') return basis;
  const days = period.value;
  const activity = input.activity.netCreditActivityMinor;
  if (!isMoney(activity)) return unavailable('INVALID_AMOUNT', 'Actividad neta inválida.');
  if (activity <= 0) return unavailable('NONPOSITIVE_ACTIVITY', 'Actividad neta a crédito no positiva.');
  const balance = average(input.balances.series, input.period);
  if (balance.status === 'unavailable') return balance;
  return ready({ metric: input.metric, days: balance.value / activity * days,
    period: input.period, calendarDays: days, averageBalanceMinor: balance.value,
    netCreditActivityMinor: activity, method: input.balances.series.method,
    methodLabel: input.balances.series.method === 'daily-eod' ? 'Promedio diario de cierres' : 'Aproximación: (apertura + cierre) / 2',
    evidenceId: input.balances.scope.evidenceId });
}
