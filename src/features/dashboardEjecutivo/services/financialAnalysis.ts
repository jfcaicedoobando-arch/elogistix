import { diagnoseFinancialCoverage } from '../domain/financialCoverage/diagnostics';
import type { CoverageCause } from '../domain/financialCoverage/contract';
import type { Period } from '../domain/financialMetrics/calendar';
import { FINANCIAL_CRITERIA_APPROVAL } from '../domain/financialMetrics/approvedCriteria';

export const ANALYSIS_DATA_REQUIRED = 'Falta una fuente verificada de datos financieros para calcular los indicadores.';
export interface FinancialAnalysis {
  organizationId: string | null;
  selectedMonth: string;
  /** Reference of current-balance reader; NOT a certified historical cut/business clock. */
  currentBalanceReference: string;
  certification: 'not-evaluated';
  numericEligible: false;
  policyApprovedAt: typeof FINANCIAL_CRITERIA_APPROVAL.approvedAt;
  comparisonPeriods: readonly Period[];
  currencies: readonly {
    currency: string | null;
    metrics: Readonly<Record<'dso' | 'dpo' | 'runway', {status: 'unavailable'; causes: readonly CoverageCause[]}>>;
  }[];
}
/** Current rows only identify observed currencies. No amounts or fabricated audit batches.
 * Readers contain no verified historical/cash certificate. Empty != certified zero. */
export function buildFinancialAnalysis(input: {
  organizationId: string | null;
  selectedMonth: string;
  currentBalanceReference: string;
  currencyRows: readonly {moneda?: string | null}[];
}): FinancialAnalysis {
  const currencies = [...new Set(input.currencyRows.map(row =>
    typeof row.moneda === 'string' && /^[A-Z]{3}$/.test(row.moneda) ? row.moneda : null))]
    .sort((a, b) => (a ?? '').localeCompare(b ?? ''));
  if (!currencies.length) currencies.push(null);
  const rows = currencies.map(currency => {
    const diagnostic = diagnoseFinancialCoverage({request: {
      organizationId: input.organizationId, selectedMonth: input.selectedMonth,
      asOf: input.currentBalanceReference, currency,
    }, batches: []});
    return {currency, diagnostic};
  });
  // Unknown currency must not become MXN merely to construct periods.
  const comparisonPeriods = rows.find(row => row.diagnostic.request)?.diagnostic.comparisonPeriods ?? [];
  return {organizationId: input.organizationId, selectedMonth: input.selectedMonth,
    currentBalanceReference: input.currentBalanceReference, certification: 'not-evaluated', numericEligible: false,
    policyApprovedAt: FINANCIAL_CRITERIA_APPROVAL.approvedAt, comparisonPeriods,
    currencies: rows.map(({currency, diagnostic}) => ({currency, metrics: {
      dso: {status: 'unavailable', causes: diagnostic.causes.filter(cause => cause.affects.includes('dso'))},
      dpo: {status: 'unavailable', causes: diagnostic.causes.filter(cause => cause.affects.includes('dpo'))},
      runway: {status: 'unavailable', causes: diagnostic.causes.filter(cause => cause.affects.includes('runway'))},
    }}))};
}
