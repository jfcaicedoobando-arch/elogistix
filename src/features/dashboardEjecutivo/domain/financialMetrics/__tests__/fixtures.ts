/** All amounts are artificial minor units. These fixtures certify no live data. */
import type { ComparableScope, Result } from '@/features/dashboardEjecutivo/domain/financialMetrics/contract';
import type { EfficiencyInput } from '@/features/dashboardEjecutivo/domain/financialMetrics/efficiency';
import type { CashScope, ReconciledCash } from '@/features/dashboardEjecutivo/domain/financialMetrics/cashContract';
export const period = { start: '2026-09-01', end: '2026-09-30' };
export const scope: ComparableScope = { organizationId: 'fictional-org', currency: 'MXN', evidenceId: 'mock-only', complete: true,
  basis: 'net-commercial', populationPolicyId: 'mock-population', taxAllocationPolicyId: 'mock-explicit-net-components',
  fxPolicyId: 'mock-mxn', recognitionPolicyId: 'mock-recognition' };
export const cashScope: CashScope = { ...scope, availabilityPolicyId: 'mock-unrestricted', cashClassificationPolicyId: 'mock-operating-cash' };
export const cash: ReconciledCash = { asOf: '2026-09-30', availableMinor: 100_000,
  reconciledThrough: '2026-09-30', reconciliationEvidenceId: 'mock-bank-proof', availabilityEvidenceId: 'mock-no-restrictions' };
export function efficiency(): EfficiencyInput { return {
  metric: 'DSO', period: { ...period }, businessToday: '2026-10-13', accountingClosedThrough: '2026-09-30',
  balances: { side: 'receivables', scope: { ...scope }, period: { ...period }, series: { method: 'opening-closing', openingMinor: 100_000, closingMinor: 0 } },
  activity: { kind: 'credit-sales', scope: { ...scope }, period: { ...period }, netCreditActivityMinor: 100_000 },
}; }
export function value<T>(result: Result<T>): T { if (result.status !== 'ready') throw Error(JSON.stringify(result)); return result.value; }
export function code<T>(result: Result<T>): string { if (result.status !== 'unavailable') throw Error('Expected N/D'); return result.causes[0].code; }
