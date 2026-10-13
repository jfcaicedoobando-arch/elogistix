import { describe, expect, it } from 'vitest';
import { diagnoseFinancialCoverage as diagnose } from '@/features/dashboardEjecutivo/domain/financialCoverage/diagnostics';
import { bankRow, batch, creditRow, input, replace, request, scheduleRow } from './fixtures';

describe('independent coverage review regressions', () => {
  it('rejects mutually exclusive bank statuses exceeding the population', () => {
    expect(diagnose(replace('05-bank-coverage', [{ ...bankRow(), reconciled_rows: 4, pending_rows: 4 }])).sources
      .find((row) => row.queryId === '05-bank-coverage')?.status).toBe('invalid');
  });
  it('rejects PPD plus PUE exceeding documents', () => {
    expect(diagnose(replace('06-tax-credit-readiness', [{ ...creditRow(), ppd: 3, pue: 3 }])).sources
      .find((row) => row.queryId === '06-tax-credit-readiness')?.status).toBe('invalid');
  });
  it('rejects scheduled outstanding rows with missing schedule range', () => {
    expect(diagnose(replace('17-ap-current-balance', [{ ...scheduleRow(), earliest_schedule: null, latest_schedule: null }])).sources
      .find((row) => row.queryId === '17-ap-current-balance')?.status).toBe('invalid');
  });
  it('rejects claimed future schedules when the maximum date is past', () => {
    expect(diagnose(replace('17-ap-current-balance', [{ ...scheduleRow(), future_scheduled_outstanding: 1 }])).sources
      .find((row) => row.queryId === '17-ap-current-balance')?.status).toBe('invalid');
  });
  it('rejects past schedule counts when the minimum date is future', () => {
    expect(diagnose(replace('17-ap-current-balance', [{ ...scheduleRow(), earliest_schedule: '2040-10-20', latest_schedule: '2040-10-20' }])).sources
      .find((row) => row.queryId === '17-ap-current-balance')?.status).toBe('invalid');
  });
  it('does not claim the requested month is unclosed from a stale closing configuration', () => {
    const old = { ...batch('04-close-history', [{ close_config: [{ value: '2040-08-31' }], database_date: '2040-09-10' }]),
      observedAt: '2040-09-10T09:00:00.000Z', businessDate: '2040-09-10' };
    const result = diagnose({ request, batches: [old] });
    expect(result.causes.map((cause) => cause.code)).not.toContain('PERIOD_NOT_CLOSED');
    expect(result.causes.map((cause) => cause.code)).toContain('OBSERVATION_CUT_MISMATCH');
    expect(result.causes.map((cause) => cause.code)).toContain('CLOSE_NOT_VERIFIED');
  });
  it('does not emit per-cut NC, due-date or schedule gaps from a different observation date', () => {
    const fixture = input();
    const result = diagnose({ ...fixture, request: { ...request, asOf: '2040-10-20' } });
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.causes.some((cause) => cause.basis === 'observed-gap' && cause.queryId)).toBe(false);
    expect(result.metrics.dpo.causeCodes).toContain('CREDIT_NOTE_BASE_COVERAGE_UNVERIFIED');
    expect(result.metrics.forecast13Weeks.causeCodes).toContain('EXPECTED_CASH_DATES_MISSING');
  });
});
