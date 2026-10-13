import { describe, expect, it } from 'vitest';
import { diagnoseFinancialCoverage as diagnose } from '@/features/dashboardEjecutivo/domain/financialCoverage/diagnostics';
import { METRICS, POLICY_KEYS, type CoverageDiagnostic } from '@/features/dashboardEjecutivo/domain/financialCoverage/contract';
import { bankRow, batch, creditRow, input, noteRow, paymentRow, replace, request, scheduleRow } from './fixtures';

const codes = (result: CoverageDiagnostic) => result.causes.map((cause) => cause.code);
const dpoCodes = (result: CoverageDiagnostic) => result.metrics.dpo.causeCodes;
describe('diagnostic authority boundary', () => {
  it('accumulates independent causes without enabling numbers', () => {
    const result = diagnose(input());
    expect(result.status).toBe('unavailable'); expect(result.numericEligible).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining(['CLOSE_NOT_CONFIGURED', 'HISTORY_INCOMPLETE',
      'COMMERCIAL_CLASSIFICATION_MISSING', 'NET_CREDIT_NOTE_BASE_MISSING', 'CASH_NOT_RECONCILED', 'CASH_FLOW_COVERAGE_INCOMPLETE']));
    for (const metric of METRICS) expect(result.metrics[metric].status).toBe('unavailable');
  });
  it('never constructs evidence, complete population, data certification or normalized amounts', () => {
    const result = diagnose({ ...input(), evidenceId: 'client-invented', complete: true,
      policies: Object.fromEntries(POLICY_KEYS.map((key) => [key, 'approved'])), certification: 'certified' });
    expect(result.policies.every((policy) => policy.status === 'approved')).toBe(true);
    const text = JSON.stringify(result);
    for (const forbidden of ['evidenceId', 'client-invented', 'complete', 'amountMinor', 'current_balance']) expect(text).not.toContain(`"${forbidden}"`);
    expect(result.certification).toBe('not-evaluated');
  });
  it('does not certify all reconciled flags or non-null balances', () => {
    const result = diagnose(replace('05-bank-coverage', [{ ...bankRow(), saldo_inicial: '99999.123456', credits_since_opening: '33.44' }]));
    expect(codes(result)).toContain('CASH_NOT_RECONCILED'); expect(codes(result)).toContain('CASH_AVAILABILITY_UNVERIFIED');
    expect(JSON.stringify(result)).not.toContain('99999.123456');
  });
  it('does not infer commercial credit from PPD, days or current paid state', () => {
    for (const row of [creditRow(), { ...creditRow(), ppd: 0, pue: 3, explicit_positive_credit_days: 3 }]) {
      expect(codes(diagnose(replace('06-tax-credit-readiness', [row])))).toContain('COMMERCIAL_CLASSIFICATION_MISSING');
    }
  });
  it('does not treat configured closure or issue snapshots as reconstruction', () => {
    const result = diagnose(replace('04-close-history', [{ close_config: [{ value: '2040-09-30' }], database_date: request.asOf }]));
    expect(codes(result)).not.toContain('CLOSE_NOT_CONFIGURED');
    expect(codes(result)).toEqual(expect.arrayContaining(['CLOSE_NOT_VERIFIED', 'HISTORY_INCOMPLETE', 'SNAPSHOT_NOT_CERTIFIED']));
  });
  it('keeps data requirements despite approved policies and no observed gap', () => {
    const result = diagnose(replace('15-nc-scope-fx', [{ ...noteRow(), missing_net_base: 0 }]));
    expect(dpoCodes(result)).not.toContain('NET_CREDIT_NOTE_BASE_MISSING');
    expect(dpoCodes(result)).toEqual(expect.arrayContaining(['CLOSE_NOT_CONFIGURED', 'TAX_COMPONENTS_UNVERIFIED', 'CURRENCY_LINEAGE_UNVERIFIED']));
  });
  it('never turns missing cash promises into a zero projection', () => {
    const result = diagnose(input());
    expect(result.observations.find((row) => row.labels.source === 'cobranza_seguimiento')?.counts.rows_all).toBe(0);
    expect(result.metrics.forecast13Weeks.causeCodes).toContain('CASH_FLOW_COVERAGE_INCOMPLETE');
    expect(result).not.toHaveProperty('forecast');
  });
});
describe('currency, period and flow semantics', () => {
  it.each([
    ['0001-03', ['0001-01-31', '0001-02-28', '0001-03-31']],
    ['0004-03', ['0004-01-31', '0004-02-29', '0004-03-31']],
    ['0100-01', ['0099-11-30', '0099-12-31', '0100-01-31']],
    ['1900-03', ['1900-01-31', '1900-02-28', '1900-03-31']],
    ['2000-03', ['2000-01-31', '2000-02-29', '2000-03-31']],
    ['2100-03', ['2100-01-31', '2100-02-28', '2100-03-31']],
    ['2400-03', ['2400-01-31', '2400-02-29', '2400-03-31']],
    ['2024-03', ['2024-01-31', '2024-02-29', '2024-03-31']],
    ['2024-10', ['2024-08-31', '2024-09-30', '2024-10-31']],
    ['2024-11', ['2024-09-30', '2024-10-31', '2024-11-30']],
    ['2011-12', ['2011-10-31', '2011-11-30', '2011-12-31']],
    ['9999-12', ['9999-10-31', '9999-11-30', '9999-12-31']],
  ] as const)('preserves three civil months independently of zone and DST: %s', (selectedMonth, ends) => {
    const result = diagnose({ request: { ...request, asOf: '9999-12-31', selectedMonth }, batches: [] });
    expect(result.comparisonPeriods).toEqual(ends.map((end) => ({ start: `${end.slice(0, 7)}-01`, end })));
    expect(result.numericEligible).toBe(false);
  });
  it('attributes a cross-currency missing NC base to invoice currency', () => {
    const usd = diagnose(input());
    expect(dpoCodes(usd)).toContain('NET_CREDIT_NOTE_BASE_MISSING');
    expect(usd.observations.find((row) => row.queryId === '15-nc-scope-fx')).toMatchObject({ currency: 'USD', relatedCurrency: 'MXN', relevance: 'requested-currency' });
    expect(dpoCodes(diagnose({ ...input(), request: { ...request, currency: 'MXN' } }))).not.toContain('NET_CREDIT_NOTE_BASE_MISSING');
  });
  it('keeps payment cash and document axes without summing noncash or advances', () => {
    const result = diagnose(input()); const row = result.observations.find((item) => item.queryId === '10-payment-currency-safe');
    expect(row).toMatchObject({ currency: 'MXN', relatedCurrency: 'USD', relevance: 'other-currency', counts: { noncash_adjustments: 1, advance_applications: 1 } });
    expect(result.metrics.runway.causeCodes).toContain('CASH_LINEAGE_UNVERIFIED');
  });
  it('ignores monetary aggregates, bank identifiers and arbitrary source text', () => {
    const result = diagnose(replace('10-payment-currency-safe', [{ ...paymentRow(), amount_cash_currency: '12345.6789',
      applied_document_currency: '7654.321', account_name: 'PRIVATE_TEXT' }]));
    expect(JSON.stringify(result)).not.toMatch(/12345|7654|PRIVATE_TEXT|synthetic-account/);
  });
  it('does not reallocate organization-only counts to the requested currency', () => {
    const result = diagnose(input());
    expect(result.observations.filter((row) => ['02-coverage', '06-tax-credit-readiness', '14-historical-date-quality'].includes(row.queryId))
      .every((row) => row.currency === null && row.relevance === 'organization-context')).toBe(true);
  });
  it('keeps draft NC missing bases separate from applied-note blockers', () => {
    expect(dpoCodes(diagnose(replace('15-nc-scope-fx', [{ ...noteRow(), state: 'Borrador' }])))).not.toContain('NET_CREDIT_NOTE_BASE_MISSING');
  });
  it('separates contractual unknown due dates from cash scheduling', () => {
    const result = diagnose(input());
    expect(result.metrics.aging.causeCodes).toContain('CONTRACTUAL_DUE_DATES_MISSING');
    expect(result.metrics.forecast13Weeks.causeCodes).toContain('EXPECTED_CASH_DATES_MISSING');
    expect(result.metrics.dpo.causeCodes).not.toContain('EXPECTED_CASH_DATES_MISSING');
  });
  it('does not move past schedules to the first forecast week', () => {
    const result = diagnose(replace('17-ap-current-balance', [{ ...scheduleRow(), unknown_due_outstanding: 0, unscheduled_outstanding: 0,
      scheduled_outstanding: 3, future_scheduled_outstanding: 0 }]));
    expect(result.causes.some((cause) => cause.code === 'EXPECTED_CASH_DATES_MISSING' && cause.basis === 'observed-gap')).toBe(true);
    expect(result).not.toHaveProperty('weeks');
  });
  it('marks a historical request as different from current observations', () => {
    const result = diagnose({ ...input(), request: { ...request, asOf: '2040-09-30', selectedMonth: '2040-08' } });
    expect(codes(result)).toContain('OBSERVATION_CUT_MISMATCH'); expect(codes(result)).toContain('HISTORY_INCOMPLETE');
  });
  it('reports an unclosed calendar month even with a later configured close', () => {
    expect(codes(diagnose({ ...input(), request: { ...request, selectedMonth: '2040-10' } }))).toContain('PERIOD_NOT_CLOSED');
  });
  it('reports a configured close that does not cover the selected month', () => {
    expect(codes(diagnose(replace('04-close-history', [{ close_config: [{ value: '2040-08-31' }], database_date: request.asOf }])))).toContain('PERIOD_NOT_CLOSED');
  });
  it('computes three actual calendar periods, including a leap-year month', () => {
    const result = diagnose({ ...input(), request: { ...request, selectedMonth: '2040-03' } });
    expect(result.comparisonPeriods).toEqual([{ start: '2040-01-01', end: '2040-01-31' },
      { start: '2040-02-01', end: '2040-02-29' }, { start: '2040-03-01', end: '2040-03-31' }]);
  });
  it('marks even a single-time observation window as unverified', () => {
    expect(diagnose(input()).readingWindow).toMatchObject({ consistency: 'unverified' });
  });
  it('retains reading interval without inferring an atomic snapshot', () => {
    const fixture = input(); const batches = fixture.batches.map((item, index) => ({ ...item, observedAt: `2040-10-10T09:0${index}:00.000Z` }));
    expect(diagnose({ ...fixture, batches }).readingWindow).toEqual({ first: '2040-10-10T09:00:00.000Z', last: '2040-10-10T09:07:00.000Z', consistency: 'unverified' });
  });
  it('has stable query order and no duplicated cause code per metric', () => {
    const fixture = input(); const a = diagnose(fixture); const b = diagnose({ ...fixture, batches: [...fixture.batches].reverse() });
    expect(a).toEqual(b);
    for (const metric of METRICS) expect(new Set(a.metrics[metric].causeCodes).size).toBe(a.metrics[metric].causeCodes.length);
  });
  it('handles the upper date bound without a year-10000 output', () => {
    const result = diagnose({ request: { ...request, asOf: '9999-12-31', selectedMonth: '9999-12' }, batches: [] });
    expect(result.comparisonPeriods[2].end).toBe('9999-12-31');
  });
  it('does not mutate caller data', () => {
    const fixture = input(); const before = JSON.stringify(fixture); diagnose(fixture); expect(JSON.stringify(fixture)).toBe(before);
  });
  it('accepts null optional payment counts as unknown, not zero', () => {
    const result = diagnose(replace('10-payment-currency-safe', [{ ...paymentRow(), side: 'ar', noncash_adjustments: null, advance_applications: null }]));
    expect(result.observations.find((row) => row.queryId === '10-payment-currency-safe')?.counts).not.toHaveProperty('noncash_adjustments');
  });
  it('does not require no_account and bank_linked to partition payments', () => {
    const result = diagnose(replace('10-payment-currency-safe', [{ ...paymentRow(), no_account: 4, bank_linked: 4 }]));
    expect(result.sources.find((source) => source.queryId === '10-payment-currency-safe')?.status).toBe('observed');
  });
  it('accepts an empty variable-source response without proving no economic population', () => {
    const result = diagnose(replace('15-nc-scope-fx', []));
    expect(result.sources.find((source) => source.queryId === '15-nc-scope-fx')).toMatchObject({ status: 'empty-response', rowCount: 0 });
    expect(dpoCodes(result)).toContain('CREDIT_NOTE_BASE_COVERAGE_UNVERIFIED');
  });
  it('does not derive source completeness from a response below its SQL LIMIT', () => {
    const result = diagnose({ request, batches: [batch('02-coverage', [])] });
    expect(codes(result)).toContain('SOURCE_UNOBSERVED'); expect(codes(result)).toContain('SNAPSHOT_NOT_CERTIFIED');
  });
});
