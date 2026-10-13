/** Pure calculation boundary for a future verified reader. Inputs are NOT certificates.
 * Production currently has no such reader and cannot enable these numbers from JSON/flags. */
import { unavailable, type Result } from './contract';
import { closedThreeMonths, epochDay, type Period } from './calendar';
import { calculateEfficiency, type EfficiencyInput, type EfficiencyValue } from './efficiency';
import { calculateCashRunway, type ActualCashEvent, type RunwayValue } from './runway';
import type { CashScope, ReconciledCash } from './cashContract';
import { FINANCIAL_CRITERIA_APPROVAL as policy } from './approvedCriteria';

export function calculateApprovedEfficiency(input: EfficiencyInput): Result<EfficiencyValue> {
  for (const scope of [input.balances.scope, input.activity.scope]) {
    if (scope.populationPolicyId !== policy.population || scope.taxAllocationPolicyId !== policy.tax ||
        scope.fxPolicyId !== policy.currency) {
      return unavailable('APPROVED_BASIS_REQUIRED', 'Se requiere crédito propio documentado, netos documentales y una sola moneda sin consolidación.');
    }
  }
  return calculateEfficiency(input);
}

export type CashClassification = 'own-operating' | 'investment' | 'financing' | 'third-party' | 'internal-transfer';
export interface DocumentedCashEvent extends Omit<ActualCashEvent, 'inclusion'> {
  organizationId: string;
  currency: string;
  classification: CashClassification | null;
}
export interface ApprovedRunwayInput {
  scope: CashScope;
  cash: ReconciledCash;
  selectedMonth: string;
  businessToday: string;
  accountingClosedThrough: string | null;
  /** Actual covered interval supplied by the reader, never derived from a policy ID. */
  observedPeriod: Period;
  events: readonly DocumentedCashEvent[];
}

export function calculateApprovedRunway(input: ApprovedRunwayInput): Result<RunwayValue> {
  const months = closedThreeMonths(input);
  if (months.status === 'unavailable') return months;
  const period = {start: months.value[0].start, end: months.value[2].end};
  if (input.observedPeriod.start !== period.start || input.observedPeriod.end !== period.end) {
    return unavailable('THREE_CLOSED_MONTHS_REQUIRED', 'La cobertura observada debe abarcar exactamente los tres meses calendario completos cerrados.');
  }
  const cashCut = epochDay(input.cash.asOf);
  if (cashCut === null || cashCut < epochDay(period.end)! || cashCut > epochDay(input.businessToday)!) {
    return unavailable('CASH_CUT_MISMATCH', 'El corte explícito de caja debe ser válido, no anterior al fin observado ni posterior a la fecha de negocio.');
  }
  if (input.scope.fxPolicyId !== policy.currency || input.scope.cashClassificationPolicyId !== policy.consumption ||
      input.scope.availabilityPolicyId !== policy.availability) {
    return unavailable('APPROVED_CASH_BASIS_REQUIRED', 'Consumo operativo y caja disponible documentados, por moneda y sin consolidación.');
  }
  const classifications: readonly CashClassification[] = ['own-operating', 'investment', 'financing', 'third-party', 'internal-transfer'];
  const events: ActualCashEvent[] = [];
  for (const event of input.events) {
    if (event.currency !== input.scope.currency || event.organizationId !== input.scope.organizationId) {
      return unavailable('CASH_SCOPE_MISMATCH', 'Cada movimiento debe pertenecer a la organización y moneda del cálculo.');
    }
    if (event.classification === null || !classifications.includes(event.classification)) {
      return unavailable('UNCLASSIFIED_CASH_EVENT', 'Falta clasificación documental propia/terceros y operación/inversión/financiación.');
    }
    events.push({...event, inclusion: event.classification === 'own-operating' ? 'include' : 'exclude'});
  }
  return calculateCashRunway({scope: input.scope, cash: input.cash, period,
    observationPolicyId: policy.consumption, events});
}
