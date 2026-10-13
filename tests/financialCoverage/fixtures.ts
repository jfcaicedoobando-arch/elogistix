import type { CoverageInput, ObservationBatch, QueryId } from '../../src/features/dashboardEjecutivo/domain/financialCoverage/contract';

/** Synthetic shapes only. No live tenant, account, document IDs, amounts or exported rows. */
export const request = { organizationId: 'test-organization-a', currency: 'USD', asOf: '2040-10-10', selectedMonth: '2040-09' };
export function batch(queryId: QueryId, rows: readonly unknown[]): ObservationBatch {
  return { queryId, organizationId: request.organizationId, observedAt: '2040-10-10T09:00:00.000Z',
    businessDate: request.asOf, outcome: 'ok', partialResponse: false, rows };
}
export const bankRow = () => ({ account_id: 'synthetic-account', currency: 'USD', active: true, deleted: false,
  fecha_saldo_inicial: '2040-10-01', earliest_movement: '2040-10-02', latest_movement: '2040-10-04', movements: 4,
  alive_movements: 4, reconciled_rows: 4, pending_rows: 0, ignored_rows: 0, rows_with_statement_balance: 4 });
export const creditRow = () => ({ side: 'ar', state: 'Pagada', documents: 3, ppd: 3, pue: 0,
  explicit_positive_credit_days: 0, zero_days_but_later_due: 0, with_retentions: 0,
  header_arithmetic_mismatch: 0, without_live_lines: 0 });
export const paymentRow = () => ({ side: 'ap', cash_currency: 'MXN', document_currency: 'USD', method: 'Transferencia',
  payments: 4, no_account: 2, bank_linked: 2, noncash_adjustments: 1, advance_applications: 1 });
export const historyRow = (side = 'ar') => ({ side, pre_october_documents: 4, prior_documents_updated_october: 1,
  prior_documents_recorded_october: 1, prior_drafts: side === 'ar' ? 4 : null, issue_snapshots: side === 'ar' ? 2 : null,
  nondrafts_without_snapshot: side === 'ar' ? 0 : null, nondrafts_sandbox: side === 'ar' ? 2 : null,
  nondrafts_zero_credit_days: side === 'ar' ? 2 : null });
export const noteRow = () => ({ note_currency: 'MXN', invoice_currency: 'USD', state: 'Aplicada',
  notes: 3, missing_net_base: 2, missing_own_fx: 0, cross_currency_missing_canonical_fx: 0, same_currency_invoice_fx_present: 0 });
export const scheduleRow = () => ({ currency: 'USD', state: 'Vigente', approval: 'pendiente', documents: 4,
  outstanding_documents: 3, scheduled_outstanding: 1, future_scheduled_outstanding: 0,
  unknown_due_outstanding: 1, unscheduled_outstanding: 2, earliest_schedule: '2040-10-03', latest_schedule: '2040-10-03' });
export function input(): CoverageInput {
  return { request: { ...request }, batches: [
    batch('02-coverage', [{ source: 'facturas', rows_all: 4, rows_alive: 4, earliest_date: '2040-09-01', latest_date: '2040-10-09' },
      { source: 'cobranza_seguimiento', rows_all: 0, rows_alive: 0, earliest_date: null, latest_date: null }]),
    batch('04-close-history', [{ close_config: null, database_date: request.asOf }]),
    batch('05-bank-coverage', [bankRow()]), batch('06-tax-credit-readiness', [creditRow()]),
    batch('10-payment-currency-safe', [paymentRow()]), batch('14-historical-date-quality', [historyRow(), historyRow('ap')]),
    batch('15-nc-scope-fx', [noteRow()]), batch('17-ap-current-balance', [scheduleRow()]),
  ] };
}
export function replace(queryId: QueryId, rows: readonly unknown[]): CoverageInput {
  const fixture = input();
  return { ...fixture, batches: fixture.batches.map((item) => item.queryId === queryId ? batch(queryId, rows) : item) };
}
