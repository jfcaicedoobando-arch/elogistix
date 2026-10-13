import { daysInclusive, epochDay, type Period } from './calendar';
import { ready, unavailable, isMoney, sumMoney, type Result } from './contract';
import { validateCashContext, type CashScope, type Direction, type ReconciledCash } from './cashContract';
export interface ActualCashEvent {
  cashEventKey: string; settledDate: string; direction: Direction; amountMinor: number;
  inclusion: 'include' | 'exclude'; classificationEvidenceId: string;
}
export interface RunwayValue {
  state: 'cash-negative' | 'no-cash' | 'no-net-burn' | 'positive-burn';
  runwayDays: number | null; availableMinor: number; netConsumptionMinor: number;
  observationDays: number; period: Period; excludedEventKeys: readonly string[];
}
interface RunwayInput {
  scope: CashScope; cash: ReconciledCash; period: Period;
  observationPolicyId: string; events: readonly ActualCashEvent[];
}
function validatePeriod(input: RunwayInput): Result<number> {
  const days = daysInclusive(input.period); const cut = epochDay(input.cash.asOf);
  if (days === null || cut === null || epochDay(input.period.end)! > cut)
    return unavailable('INVALID_PERIOD', 'El consumo debe ser observado antes o hasta el corte de caja.');
  if (!input.observationPolicyId.trim()) return unavailable('INCOMPLETE_DATA', 'Falta política del horizonte observado.');
  return ready(days);
}
function netConsumption(events: readonly ActualCashEvent[], period: Period): Result<{ net: number; excluded: string[] }> {
  const seen = new Set<string>(); const signed: number[] = []; const excluded: string[] = [];
  for (const event of events) {
    if (!event.cashEventKey.trim() || seen.has(event.cashEventKey)) return unavailable('DUPLICATE_CASH_EVENT', 'Un movimiento monetario aparece más de una vez.');
    seen.add(event.cashEventKey);
    const date = epochDay(event.settledDate);
    if (date === null || event.settledDate < period.start || event.settledDate > period.end)
      return unavailable('EVENT_OUTSIDE_PERIOD', 'El movimiento no corresponde al horizonte observado.');
    if (!event.classificationEvidenceId.trim()) return unavailable('UNCLASSIFIED_CASH_EVENT', 'Falta clasificación del movimiento monetario.');
    if (!isMoney(event.amountMinor) || event.amountMinor <= 0) return unavailable('INVALID_AMOUNT', 'El movimiento monetario debe ser positivo.');
    if (event.inclusion === 'exclude') { excluded.push(event.cashEventKey); continue; }
    signed.push(event.direction === 'out' ? event.amountMinor : -event.amountMinor);
  }
  const net = sumMoney(signed);
  return net === null ? unavailable('AMOUNT_OVERFLOW', 'Consumo fuera del rango exacto.') : ready({ net, excluded });
}
function runwayState(cash: number, net: number): RunwayValue['state'] {
  return cash < 0 ? 'cash-negative' : cash === 0 ? 'no-cash' : net <= 0 ? 'no-net-burn' : 'positive-burn';
}
export function calculateCashRunway(input: RunwayInput): Result<RunwayValue> {
  const period = validatePeriod(input);
  if (period.status === 'unavailable') return period;
  const context = validateCashContext(input.scope, input.cash);
  if (context.status === 'unavailable') return context;
  const consumption = netConsumption(input.events, input.period);
  if (consumption.status === 'unavailable') return consumption;
  const { net, excluded } = consumption.value;
  const days = period.value;
  return ready({ state: runwayState(input.cash.availableMinor, net),
    runwayDays: input.cash.availableMinor <= 0 ? 0 : net <= 0 ? null : input.cash.availableMinor / net * days,
    availableMinor: input.cash.availableMinor, netConsumptionMinor: net, observationDays: days,
    period: input.period, excludedEventKeys: excluded });
}
