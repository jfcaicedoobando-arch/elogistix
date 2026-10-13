import { describe, expect, it } from 'vitest';
import { buildFinancialAnalysis } from '../../../services/financialAnalysis';
import { calculateApprovedEfficiency, calculateApprovedRunway, type ApprovedRunwayInput } from '../approvedCalculations';
import { FINANCIAL_CRITERIA_APPROVAL as policy } from '../approvedCriteria';
import { dateFromDay, daysInclusive, epochDay, type Period } from '../calendar';
import type { ComparableScope, Result } from '../contract';
import type { EfficiencyInput } from '../efficiency';

/** All values below are invented test scenarios. These inputs are NOT certificates,
 * persisted company records, evidence of historical closes, or a production reader. */
const organizationId = 'synthetic-source-contract-only';
const businessToday = '2026-10-13';
const periods: readonly Period[] = [
  { start: '2026-07-01', end: '2026-07-31' },
  { start: '2026-08-01', end: '2026-08-31' },
  { start: '2026-09-01', end: '2026-09-30' },
];
const scenarios = [
  { currency: 'MXN', averageMinor: 500_000, activityMinor: 1_000_000, expectedRatio: 0.5,
    cashMinor: 150_000, monthlyOutMinor: 60_000, monthlyInMinor: 10_000, runwayDays: 92 },
  { currency: 'USD', averageMinor: 50_000, activityMinor: 200_000, expectedRatio: 0.25,
    cashMinor: 60_000, monthlyOutMinor: 15_000, monthlyInMinor: 5_000, runwayDays: 184 },
] as const;

function value<T>(result: Result<T>): T {
  expect(result.status).toBe('ready');
  if (result.status !== 'ready') throw new Error(JSON.stringify(result.causes));
  return result.value;
}
function cause<T>(result: Result<T>): string {
  expect(result.status).toBe('unavailable');
  if (result.status !== 'unavailable') throw new Error('Expected N/D');
  return result.causes[0].code;
}
function scope(currency: string): ComparableScope {
  return { organizationId, currency, evidenceId: 'synthetic-only-not-a-certificate', complete: true,
    basis: 'net-commercial', populationPolicyId: policy.population, taxAllocationPolicyId: policy.tax,
    fxPolicyId: policy.currency, recognitionPolicyId: 'synthetic-document-recognition-v1' };
}
function efficiency(scenario: typeof scenarios[number], period: Period, metric: 'DSO' | 'DPO'): EfficiencyInput {
  return { metric, period, businessToday, accountingClosedThrough: '2026-09-30',
    balances: { side: metric === 'DSO' ? 'receivables' : 'payables', scope: scope(scenario.currency), period,
      series: { method: 'daily-eod', points: Array.from({ length: daysInclusive(period)! }, (_, index) =>
        ({ date: dateFromDay(epochDay(period.start)! + index), amountMinor: scenario.averageMinor })) } },
    activity: { kind: metric === 'DSO' ? 'credit-sales' : 'credit-purchases-services',
      scope: scope(scenario.currency), period, netCreditActivityMinor: scenario.activityMinor } };
}
function runway(scenario: typeof scenarios[number]): ApprovedRunwayInput {
  return { scope: { ...scope(scenario.currency), availabilityPolicyId: policy.availability,
      cashClassificationPolicyId: policy.consumption },
    cash: { asOf: '2026-09-30', reconciledThrough: '2026-09-30', availableMinor: scenario.cashMinor,
      reconciliationEvidenceId: 'synthetic-only-statement', availabilityEvidenceId: 'synthetic-only-restrictions' },
    selectedMonth: '2026-09', businessToday, accountingClosedThrough: '2026-09-30',
    observedPeriod: { start: periods[0].start, end: periods[2].end },
    events: periods.flatMap((period, index) => ([
      { organizationId, currency: scenario.currency, cashEventKey: `synthetic-out-${index}`, settledDate: period.end,
        direction: 'out' as const, amountMinor: scenario.monthlyOutMinor,
        classification: 'own-operating' as const, classificationEvidenceId: 'synthetic-only-operating' },
      { organizationId, currency: scenario.currency, cashEventKey: `synthetic-in-${index}`, settledDate: period.end,
        direction: 'in' as const, amountMinor: scenario.monthlyInMinor,
        classification: 'own-operating' as const, classificationEvidenceId: 'synthetic-only-operating' },
    ])) };
}

describe('source activation contract · synthetic calculation is not production certification', () => {
  for (const scenario of scenarios) {
    for (const period of periods) {
      it.each(['DSO', 'DPO'] as const)(`${scenario.currency} ${period.start.slice(0, 7)} %s uses its own month and net basis`, metric => {
        const result = value(calculateApprovedEfficiency(efficiency(scenario, period, metric)));
        expect(result).toMatchObject({ days: daysInclusive(period)! * scenario.expectedRatio,
          period, method: 'daily-eod', averageBalanceMinor: scenario.averageMinor,
          netCreditActivityMinor: scenario.activityMinor });
      });
    }
    it(`${scenario.currency} runway covers exactly 92 days, with its own cash and actual net operating flows`, () => {
      expect(value(calculateApprovedRunway(runway(scenario)))).toMatchObject({ state: 'positive-burn',
        runwayDays: scenario.runwayDays, observationDays: 92, availableMinor: scenario.cashMinor,
        netConsumptionMinor: (scenario.monthlyOutMinor - scenario.monthlyInMinor) * 3 });
    });
  }

  it('keeps an opening/closing approximation explicitly labeled', () => {
    const input = efficiency(scenarios[0], periods[2], 'DSO');
    input.balances.series = { method: 'opening-closing', openingMinor: 600_000, closingMinor: 400_000 };
    expect(value(calculateApprovedEfficiency(input))).toMatchObject({ days: 15, method: 'opening-closing',
      methodLabel: 'Aproximación: (apertura + cierre) / 2' });
  });

  it('does not carry a daily balance across a missing day or synthesize an opening', () => {
    const input = efficiency(scenarios[0], periods[2], 'DSO');
    if (input.balances.series.method !== 'daily-eod') throw new Error('Fixture must be daily');
    input.balances.series.points = input.balances.series.points.slice(1);
    expect(cause(calculateApprovedEfficiency(input))).toBe('HISTORY_GAP');
  });

  it('distinguishes verified synthetic zero from missing history and nonpositive activity', () => {
    const input = efficiency(scenarios[0], periods[2], 'DPO');
    input.balances.series = { method: 'opening-closing', openingMinor: 0, closingMinor: 0 };
    expect(value(calculateApprovedEfficiency(input)).days).toBe(0);
    input.balances.scope.complete = false;
    expect(cause(calculateApprovedEfficiency(input))).toBe('INCOMPLETE_DATA');
    input.balances.scope.complete = true;
    input.activity.netCreditActivityMinor = 0;
    expect(cause(calculateApprovedEfficiency(input))).toBe('NONPOSITIVE_ACTIVITY');
  });

  it.each(['DSO', 'DPO'] as const)('%s does not mix synthetic currencies, organizations or snapshot revisions', metric => {
    for (const change of [{ currency: 'USD' }, { organizationId: 'other-synthetic-org' }, { evidenceId: 'other-revision' }]) {
      const input = efficiency(scenarios[0], periods[2], metric);
      Object.assign(input.activity.scope, change);
      expect(cause(calculateApprovedEfficiency(input))).toBe('BASIS_MISMATCH');
    }
  });

  it.each(['populationPolicyId', 'taxAllocationPolicyId'] as const)('rejects a substitute %s, even with complete=true', key => {
    const input = efficiency(scenarios[0], periods[2], 'DSO');
    input.activity.scope[key] = key === 'populationPolicyId' ? 'inferred-from-PPD' : 'gross-proportional-tax';
    expect(cause(calculateApprovedEfficiency(input))).toBe('APPROVED_BASIS_REQUIRED');
  });

  it.each([null, '2026-08-31'])('does not turn documents dated July–September into a close: %s', accountingClosedThrough => {
    expect(cause(calculateApprovedRunway({ ...runway(scenarios[0]), accountingClosedThrough }))).toBe('UNVERIFIED_CLOSE');
  });

  it.each(['reconciliationEvidenceId', 'availabilityEvidenceId'] as const)('requires synthetic cash evidence for %s separately', key => {
    const input = runway(scenarios[0]);
    input.cash[key] = '';
    expect(cause(calculateApprovedRunway(input))).toBe('UNRECONCILED_CASH');
  });

  it('rejects duplicate economic events rather than treating bank and payment as separate cash', () => {
    const input = runway(scenarios[0]);
    input.events = [...input.events, { ...input.events[0] }];
    expect(cause(calculateApprovedRunway(input))).toBe('DUPLICATE_CASH_EVENT');
  });

  it.each(['investment', 'financing', 'third-party', 'internal-transfer'] as const)('excludes %s without dropping an explicit operating fee', classification => {
    const input = runway(scenarios[0]);
    input.events = [...input.events,
      { ...input.events[0], cashEventKey: 'synthetic-excluded', amountMinor: 9_000_000, classification },
      { ...input.events[0], cashEventKey: 'synthetic-operating-fee', amountMinor: 100 }];
    const result = value(calculateApprovedRunway(input));
    expect(result.netConsumptionMinor).toBe(150_100);
    expect(result.excludedEventKeys).toEqual(['synthetic-excluded']);
  });

  it('fails closed in the production boundary even with all synthetic results and forged approvals', () => {
    const base = { organizationId, selectedMonth: '2026-09', currentBalanceReference: businessToday,
      currencyRows: scenarios.map(scenario => ({ moneda: scenario.currency })) };
    const syntheticPayload = { ...base, numericEligible: true, certification: 'certified', complete: true,
      evidenceId: 'synthetic-only-not-a-certificate', accountingClosedThrough: '2026-09-30',
      calculatedMetrics: scenarios.map(scenario => ({
        dso: calculateApprovedEfficiency(efficiency(scenario, periods[2], 'DSO')),
        dpo: calculateApprovedEfficiency(efficiency(scenario, periods[2], 'DPO')),
        runway: calculateApprovedRunway(runway(scenario)),
      })) };
    const result = buildFinancialAnalysis(syntheticPayload);
    expect(result).toEqual(buildFinancialAnalysis(base));
    expect(result).toMatchObject({ certification: 'not-evaluated', numericEligible: false });
    for (const currency of result.currencies) {
      for (const metric of Object.values(currency.metrics)) expect(metric.status).toBe('unavailable');
      expect(currency.metrics.dso.causes.map(entry => entry.code)).toContain('HISTORY_INCOMPLETE');
      expect(currency.metrics.runway.causes.map(entry => entry.code)).toContain('CASH_NOT_RECONCILED');
    }
    expect(JSON.stringify(result)).not.toContain('calculatedMetrics');
  });

  it('does not infer documentary credit or fiscal net from seeded current-row fields', () => {
    const input = { organizationId, selectedMonth: '2026-09', currentBalanceReference: businessToday,
      currencyRows: [{ moneda: 'MXN', fecha_emision: '2026-07-01', created_at: '2026-10-13T16:00:00Z',
        metodo_pago: 'PPD', dias_credito: 90, subtotal: 1_000, iva: 160, saldo: 580,
        estado: 'Pagada', estado_conciliacion: 'Conciliado' }] };
    const result = buildFinancialAnalysis(input);
    expect(result.numericEligible).toBe(false);
    const codes = result.currencies[0].metrics.dso.causes.map(entry => entry.code);
    expect(codes).toContain('COMMERCIAL_CLASSIFICATION_MISSING');
    expect(codes).toContain('TAX_COMPONENTS_UNVERIFIED');
    expect(codes).toContain('HISTORY_INCOMPLETE');
  });
});
