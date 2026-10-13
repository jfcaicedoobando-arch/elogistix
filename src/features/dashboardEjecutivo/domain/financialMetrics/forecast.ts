import { dateFromDay, epochDay } from './calendar';
import { ready, unavailable, isMoney, sumMoney, type Result } from './contract';
import { validateCashContext, type CashScope, type Direction, type ReconciledCash } from './cashContract';
export interface ExpectedCashEvent {
  /** Canonical economic settlement identity, shared across invoice/lot/bank views. */
  cashEventKey: string;
  obligationKey: string;
  expectedDate: string | null;
  dateEvidence: 'promise' | 'payment-schedule' | 'contractual-scenario' | 'explicit-estimate';
  sourceId: string;
  direction: Direction;
  amountMinor: number;
}
export interface CashObligation { obligationKey: string; direction: Direction; remainingCashMinor: number }
export interface ForecastWeek { start: string; end: string; inMinor: number; outMinor: number; endCashMinor: number }
export interface ForecastValue {
  weeks: readonly ForecastWeek[]; openingCashMinor: number; finalCashMinor: number;
  outsideHorizonKeys: readonly string[]; firstNegativeClosingWeekStart: string | null;
  firstNegativeDailyClose: string | null; openingCashIsNegative: boolean;
  dateAssumptions: readonly { cashEventKey: string; dateEvidence: ExpectedCashEvent['dateEvidence'] }[];
}
interface ForecastInput {
  scope: CashScope; opening: ReconciledCash; start: string;
  events: readonly ExpectedCashEvent[]; obligations: readonly CashObligation[];
  settledCashEventKeys: readonly string[];
}
interface DatedEvent { event: ExpectedCashEvent; date: number }
interface PlanContext {
  seen: Set<string>; settled: Set<string>;
  obligations: ReadonlyMap<string, CashObligation>; planned: Map<string, number>;
}
function obligationMap(rows: readonly CashObligation[]): Result<Map<string, CashObligation>> {
  const result = new Map<string, CashObligation>();
  for (const row of rows) {
    if (!row.obligationKey.trim() || result.has(row.obligationKey) || !isMoney(row.remainingCashMinor) || row.remainingCashMinor < 0)
      return unavailable('INVALID_OBLIGATION', 'Obligación repetida o saldo monetario inválido.');
    result.set(row.obligationKey, row);
  }
  return ready(result);
}
function validateEvent(event: ExpectedCashEvent, context: PlanContext): Result<void> {
  if (!event.cashEventKey.trim() || context.seen.has(event.cashEventKey)) return unavailable('DUPLICATE_CASH_EVENT', 'Un flujo económico aparece más de una vez.');
  context.seen.add(event.cashEventKey);
  if (context.settled.has(event.cashEventKey)) return unavailable('ALREADY_SETTLED', 'Un flujo ya realizado no puede proyectarse otra vez.');
  if (!event.sourceId.trim() || !isMoney(event.amountMinor) || event.amountMinor <= 0)
    return unavailable('INVALID_AMOUNT', 'El flujo debe tener fuente e importe monetario positivo.');
  const obligation = context.obligations.get(event.obligationKey);
  if (!obligation || event.direction !== obligation.direction) return unavailable('UNMATCHED_OBLIGATION', 'Flujo sin obligación monetaria compatible.');
  const amount = sumMoney([context.planned.get(event.obligationKey) ?? 0, event.amountMinor]);
  if (amount === null || amount > obligation.remainingCashMinor) return unavailable('OVERPLANNED_OBLIGATION', 'Los flujos exceden el saldo monetario pendiente.');
  context.planned.set(event.obligationKey, amount);
  return ready(undefined);
}
function preparePlan(input: ForecastInput, start: number): Result<DatedEvent[]> {
  const obligations = obligationMap(input.obligations);
  if (obligations.status === 'unavailable') return obligations;
  const context: PlanContext = { obligations: obligations.value, planned: new Map(), seen: new Set(), settled: new Set(input.settledCashEventKeys) };
  const result: DatedEvent[] = [];
  for (const event of input.events) {
    const checked = validateEvent(event, context);
    if (checked.status === 'unavailable') return checked;
    const date = event.expectedDate === null ? null : epochDay(event.expectedDate);
    if (date === null) return unavailable('MISSING_EXPECTED_DATE', 'Falta fecha prevista válida de cobro/pago.');
    if (date < start) return unavailable('STALE_EXPECTED_DATE', 'Obligación vencida sin nueva fecha prevista; no se mueve automáticamente a esta semana.');
    result.push({ event, date });
  }
  if (input.obligations.some((o) => (context.planned.get(o.obligationKey) ?? 0) !== o.remainingCashMinor))
    return unavailable('UNSCHEDULED_REMAINDER', 'Hay saldo monetario pendiente sin fecha prevista.');
  return ready(result);
}
function fillWeeklyBalances(weeks: ForecastWeek[], opening: number): Result<number> {
  let cash = opening;
  for (const week of weeks) {
    const next = sumMoney([cash, week.inMinor, -week.outMinor]);
    if (next === null) return unavailable('AMOUNT_OVERFLOW', 'Flujo fuera del rango exacto.');
    cash = next; week.endCashMinor = cash;
  }
  return ready(cash);
}
function firstDailyDeficit(start: number, opening: number, events: ReadonlyMap<number, number[]>): Result<string | null> {
  let cash = opening; let first: string | null = null;
  for (let day = start; day < start + 91; day++) {
    const next = sumMoney([cash, ...(events.get(day) ?? [])]);
    if (next === null) return unavailable('AMOUNT_OVERFLOW', 'Saldo diario fuera del rango exacto.');
    cash = next;
    if (cash < 0 && first === null) first = dateFromDay(day);
  }
  return ready(first);
}
function aggregatePlan(start: number, opening: number, plan: readonly DatedEvent[]): Result<ForecastValue> {
  const weeks: ForecastWeek[] = Array.from({ length: 13 }, (_, i) => ({
    start: dateFromDay(start + 7 * i), end: dateFromDay(start + 7 * i + 6), inMinor: 0, outMinor: 0, endCashMinor: 0,
  }));
  const outsideHorizonKeys: string[] = []; const dailyEvents = new Map<number, number[]>();
  for (const { event, date } of plan) {
    if (date >= start + 91) { outsideHorizonKeys.push(event.cashEventKey); continue; }
    const daily = dailyEvents.get(date) ?? [];
    daily.push(event.direction === 'in' ? event.amountMinor : -event.amountMinor);
    dailyEvents.set(date, daily);
    const week = weeks[Math.floor((date - start) / 7)];
    if (event.direction === 'in') week.inMinor += event.amountMinor;
    else week.outMinor += event.amountMinor;
  }
  const finalCash = fillWeeklyBalances(weeks, opening);
  if (finalCash.status === 'unavailable') return finalCash;
  const firstDaily = firstDailyDeficit(start, opening, dailyEvents);
  if (firstDaily.status === 'unavailable') return firstDaily;
  return ready({ weeks, openingCashMinor: opening, finalCashMinor: finalCash.value,
    firstNegativeDailyClose: firstDaily.value, openingCashIsNegative: opening < 0,
    firstNegativeClosingWeekStart: weeks.find((w) => w.endCashMinor < 0)?.start ?? null,
    outsideHorizonKeys, dateAssumptions: plan.map(({ event: { cashEventKey, dateEvidence } }) => ({ cashEventKey, dateEvidence })) });
}
export function calculateForecast13Weeks(input: ForecastInput): Result<ForecastValue> {
  const start = epochDay(input.start); const cut = epochDay(input.opening.asOf);
  if (start === null || cut === null || start !== cut + 1) return unavailable('INVALID_CASH_CUTOFF', 'La proyección debe comenzar al día siguiente del corte de caja.');
  if (start + 90 > epochDay('9999-12-31')!) return unavailable('DATE_OUT_OF_RANGE', 'La proyección excede el rango de fechas soportado.');
  const context = validateCashContext(input.scope, input.opening);
  if (context.status === 'unavailable') return context;
  const plan = preparePlan(input, start);
  if (plan.status === 'unavailable') return plan;
  return aggregatePlan(start, input.opening.availableMinor, plan.value);
}
