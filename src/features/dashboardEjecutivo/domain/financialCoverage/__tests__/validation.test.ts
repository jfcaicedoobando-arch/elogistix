import { describe, expect, it } from 'vitest';
import { diagnoseFinancialCoverage as diagnose } from '@/features/dashboardEjecutivo/domain/financialCoverage/diagnostics';
import { QUERY_IDS, type QueryId } from '@/features/dashboardEjecutivo/domain/financialCoverage/contract';
import { count, observedDate } from '@/features/dashboardEjecutivo/domain/financialCoverage/parsing';
import { bankRow, batch, input, noteRow, replace, request, scheduleRow } from './fixtures';

const source = (value: unknown, id: QueryId = '15-nc-scope-fx') => diagnose(value).sources.find((item) => item.queryId === id);
describe('untrusted observation validation', () => {
  it.each([null, undefined, {}, [], '', { request: null }])('rejects invalid request %j without throwing', (value) => {
    const result = diagnose(value); expect(result.request).toBeNull(); expect(result.observations).toEqual([]);
    expect(result.causes.some((cause) => cause.code === 'INVALID_REQUEST')).toBe(true);
  });
  it.each([{ organizationId: '' }, { organizationId: 'unsafe<id>' }, { currency: 'usd' }, { currency: '' },
    { asOf: '2040-02-30' }, { asOf: '0000-01-01' }, { asOf: '2040-10-10T00:00:00Z' },
    { selectedMonth: '0001-02' }, { selectedMonth: '2040-13' }, { selectedMonth: '2040-9' }])('rejects request fields %j', (change) => {
    expect(diagnose({ ...input(), request: { ...request, ...change } }).request).toBeNull();
  });
  it('retains safe diagnostics with a missing batch list', () => {
    expect(diagnose({ request }).sources.every((item) => item.status === 'missing')).toBe(true);
  });
  it('drops an unknown query including obsolete mixed-currency query 08', () => {
    const result = diagnose({ request, batches: [{ ...batch('15-nc-scope-fx', []), queryId: '08-payment-coverage', rows: [{ secret: 'do-not-copy' }] }] });
    expect(result.observations).toEqual([]); expect(JSON.stringify(result)).not.toContain('do-not-copy');
  });
  it('rejects an oversized batch list instead of iterating it', () => {
    expect(diagnose({ request, batches: Array.from({ length: 65 }, () => batch('15-nc-scope-fx', [])) }).observations).toEqual([]);
  });
  it('rejects a foreign-organization envelope without exposing its counts or identifiers', () => {
    const result = diagnose({ request, batches: [{ ...batch('15-nc-scope-fx', [{ ...noteRow(), notes: 876543 }]), organizationId: 'foreign-organization' }] });
    expect(result.sources.find((item) => item.queryId === '15-nc-scope-fx')?.status).toBe('scope-mismatch');
    expect(JSON.stringify(result)).not.toMatch(/foreign-organization|876543/);
  });
  it('rejects foreign row organization even when its envelope matches', () => {
    expect(source(replace('15-nc-scope-fx', [{ ...noteRow(), organization_id: 'foreign' }]))?.status).toBe('invalid');
  });
  it('keeps valid same-organization batches when a different batch is foreign', () => {
    const fixture = input(); const batches = fixture.batches.map((item) => item.queryId === '15-nc-scope-fx' ? { ...item, organizationId: 'foreign' } : item);
    expect(diagnose({ ...fixture, batches }).observations.some((row) => row.queryId === '05-bank-coverage')).toBe(true);
    expect(diagnose({ ...fixture, batches }).observations.some((row) => row.queryId === '15-nc-scope-fx')).toBe(false);
  });
  it('rejects duplicate query deliveries rather than summing them', () => {
    const fixture = input(); expect(source({ ...fixture, batches: [...fixture.batches, batch('15-nc-scope-fx', [noteRow()])] })?.status).toBe('duplicate');
  });
  it('rejects duplicate grouped rows', () => {
    expect(source(replace('15-nc-scope-fx', [noteRow(), noteRow()]))?.status).toBe('invalid');
  });
  it('rejects duplicate accounts without emitting account identifiers', () => {
    expect(source(replace('05-bank-coverage', [bankRow(), bankRow()]), '05-bank-coverage')?.status).toBe('invalid');
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, undefined, '', ' ', '2foo', '1.5', '01', '1e2', '9007199254740992'])(
    'rejects malformed count %s', (value) => expect(source(replace('15-nc-scope-fx', [{ ...noteRow(), notes: value }]))?.status).toBe('invalid'));
  it.each([0, 1, Number.MAX_SAFE_INTEGER, '0', '3', '9007199254740991'])('parses an exact supported count %s', (value) => expect(count(value)).toBe(Number(value)));
  it('rejects a component count above its population', () => {
    expect(source(replace('15-nc-scope-fx', [{ ...noteRow(), missing_net_base: 4 }]))?.status).toBe('invalid');
  });
  it('rejects reversed effective date coverage', () => {
    expect(source(replace('02-coverage', [{ source: 'facturas', rows_all: 1, rows_alive: 1,
      earliest_date: '2040-10-10', latest_date: '2040-09-10' }]), '02-coverage')?.status).toBe('invalid');
  });
  it('rejects non-null coverage dates for an empty source', () => {
    expect(source(replace('02-coverage', [{ source: 'facturas', rows_all: 0, rows_alive: 0,
      earliest_date: '2040-10-10', latest_date: '2040-10-10' }]), '02-coverage')?.status).toBe('invalid');
  });
  it.each(['2040-10-10 24:00:00+00', '2040-02-30 01:00:00+00', '2040-10-10 00:60:00+00', 'arbitrary'])(
    'rejects malformed coverage timestamp %s', (value) => expect(observedDate(value)).toBe(false));
  it('accepts a PostgreSQL timestamp with an explicit offset as observed context', () => {
    expect(observedDate('2040-10-10 12:34:56.123456+00')).toBe(true);
  });
  it('rejects contradictory schedule counts', () => {
    expect(source(replace('17-ap-current-balance', [{ ...scheduleRow(), scheduled_outstanding: 2 }]), '17-ap-current-balance')?.status).toBe('invalid');
  });
  it.each([{ observedAt: '2040-02-30T09:00:00.000Z' }, { observedAt: '2040-10-10T09:00:00Z' },
    { businessDate: 'bad' }, { partialResponse: undefined }, { outcome: undefined }])('rejects invalid envelope %j', (change) => {
    expect(source({ request, batches: [{ ...batch('15-nc-scope-fx', [noteRow()]), ...change }] })?.status).toBe('invalid');
  });
  it('distinguishes failed, absent, empty and partial responses', () => {
    const failed = { ...batch('15-nc-scope-fx', []), outcome: 'error' };
    expect(source({ request, batches: [failed] })?.status).toBe('error');
    expect(source({ request, batches: [] })?.status).toBe('missing');
    expect(source({ request, batches: [batch('15-nc-scope-fx', [])] })?.status).toBe('empty-response');
    expect(source({ request, batches: [{ ...batch('15-nc-scope-fx', []), partialResponse: true }] })?.status).toBe('possibly-truncated');
  });
  it('rejects missing rows on a successful response rather than treating as empty', () => {
    expect(source({ request, batches: [{ ...batch('15-nc-scope-fx', []), rows: undefined }] })?.status).toBe('invalid');
  });
  it('flags an exact variable query LIMIT without inferring complete population', () => {
    const rows = Array.from({ length: 100 }, (_,index) => ({ ...bankRow(), account_id: `account-${index}` }));
    expect(source(replace('05-bank-coverage', rows), '05-bank-coverage')?.status).toBe('possibly-truncated');
  });
  it('rejects rows over the known SQL LIMIT', () => {
    const rows = Array.from({ length: 101 }, (_,index) => ({ ...bankRow(), account_id: `account-${index}` }));
    expect(source(replace('05-bank-coverage', rows), '05-bank-coverage')?.status).toBe('invalid');
  });
  it('does not call fixed UNION aggregate row counts truncated', () => {
    expect(source(input(), '14-historical-date-quality')?.status).toBe('observed');
  });
  it('rejects empty singleton aggregate instead of claiming no closing configuration', () => {
    const result = diagnose(replace('04-close-history', []));
    expect(result.causes.some((cause) => cause.code === 'CLOSE_NOT_CONFIGURED')).toBe(false);
    expect(source(replace('04-close-history', []), '04-close-history')?.status).toBe('invalid');
  });
  it('rejects a missing fixed UNION aggregate row', () => {
    expect(source(replace('14-historical-date-quality', []), '14-historical-date-quality')?.status).toBe('invalid');
  });
  it('does not choose the greatest of conflicting close configurations', () => {
    const result = diagnose(replace('04-close-history', [{ database_date: request.asOf,
      close_config: [{ value: '2040-08-31' }, { value: '2040-09-30' }] }]));
    expect(result.observations.find((row) => row.queryId === '04-close-history')?.dates.configured_close_through).toBeNull();
    expect(result.causes.some((cause) => cause.code === 'CLOSE_NOT_VERIFIED')).toBe(true);
  });
  it('rejects disagreement between close-query and envelope date', () => {
    expect(source(replace('04-close-history', [{ close_config: null, database_date: '2040-10-09' }]), '04-close-history')?.status).toBe('invalid');
  });
  it('includes an empty successful response in the reading interval', () => {
    const fixture = input(); const batches = fixture.batches.map((item) => item.queryId === '15-nc-scope-fx'
      ? { ...item, rows: [], observedAt: '2040-10-10T10:00:00.000Z' } : item);
    expect(diagnose({ ...fixture, batches }).readingWindow?.last).toBe('2040-10-10T10:00:00.000Z');
  });
  it('preserves unverified prerequisites under malformed individual sources', () => {
    for (const queryId of QUERY_IDS) {
      const result = diagnose(replace(queryId, [null]));
      expect(result.metrics.dso.causeCodes).toContain('METRIC_EVIDENCE_NOT_CERTIFIED');
      expect(result.numericEligible).toBe(false);
    }
  });
});
