import type { QueryId } from './contract';
import { booleanValue, count, countValue, countsBounded, currencyValue, dateValue, exclusiveCountsBounded, member,
  nullableCount, nullableDate, observedDate, orderedDates, record, type Row, type Validator } from './parsing';

const creditCounts = ['documents', 'ppd', 'pue', 'explicit_positive_credit_days', 'zero_days_but_later_due',
  'with_retentions', 'header_arithmetic_mismatch', 'without_live_lines'];
const historyCounts = ['pre_october_documents', 'prior_documents_updated_october', 'prior_documents_recorded_october',
  'prior_drafts', 'issue_snapshots', 'nondrafts_without_snapshot', 'nondrafts_sandbox', 'nondrafts_zero_credit_days'];
const bankCounts = ['movements', 'alive_movements', 'reconciled_rows', 'pending_rows', 'ignored_rows', 'rows_with_statement_balance'];
const paymentCounts = ['payments', 'no_account', 'bank_linked', 'noncash_adjustments', 'advance_applications'];
const noteCounts = ['notes', 'missing_net_base', 'missing_own_fx', 'cross_currency_missing_canonical_fx', 'same_currency_invoice_fx_present'];
const scheduleCounts = ['documents', 'outstanding_documents', 'scheduled_outstanding', 'future_scheduled_outstanding',
  'unknown_due_outstanding', 'unscheduled_outstanding'];
const fields = (keys: readonly string[], validator: Validator): Record<string, Validator> => Object.fromEntries(keys.map((key) => [key, validator]));
const identifier: Validator = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
// Source enums describe observations only, never operational or numeric eligibility.
const arState = member(['Borrador', 'Por timbrar', 'Emitida', 'Pagada', 'Vencida', 'Cancelada', 'Parcialmente pagada', 'Sustituida']);
const apStates = ['Borrador', 'Vigente', 'Pagada', 'Cancelada'];
const apApprovals = ['pendiente', 'aprobada', 'rechazada'];
const apState = member(apStates);
const apApproval = member(apApprovals);
const apCreditState = member(apStates.flatMap(state => apApprovals.map(approval => `${state}/${approval}`)));
const supplierNoteState = member(['Borrador', 'Aprobada', 'Aplicada', 'Cancelada']);
function closeConfig(value: unknown): boolean {
  if (value === null) return true;
  return Array.isArray(value) && value.length <= 2 && value.every((item: unknown) => record(item) && dateValue(item.value));
}
export interface QuerySpec {
  limit: number;
  fixedRows?: number;
  shape: Record<string, Validator>;
  counts: readonly string[];
  dates: readonly string[];
  labels: readonly string[];
  key: readonly string[];
  currency?: string;
  relatedCurrency?: string;
  validate: (row: Row) => boolean;
}
export const QUERY_SPECS: Record<QueryId, QuerySpec> = {
  '02-coverage': {
    limit: 20,
    shape: { source: member(['facturas', 'pagos_factura', 'factura_notas_credito', 'proveedor_facturas',
      'pagos_proveedor', 'proveedor_notas_credito', 'bbva_movimientos', 'anticipos_proveedor', 'anticipos_aplicaciones',
      'traspasos_bancarios', 'cobranza_seguimiento', 'liquidaciones_comision']), rows_all: countValue, rows_alive: countValue,
    earliest_date: observedDate, latest_date: observedDate },
    counts: ['rows_all', 'rows_alive'], dates: ['earliest_date', 'latest_date'], labels: ['source'], key: ['source'],
    validate: (row) => countsBounded(row, 'rows_all', ['rows_alive']) && orderedDates(row, 'earliest_date', 'latest_date') &&
      (count(row.rows_all) !== 0 || row.earliest_date === null),
  },
  '04-close-history': {
    limit: 1, fixedRows: 1, shape: { close_config: closeConfig, database_date: dateValue },
    counts: [], dates: ['database_date'], labels: [], key: [], validate: () => true,
  },
  '05-bank-coverage': {
    limit: 100, shape: { account_id: identifier, currency: currencyValue, active: booleanValue, deleted: booleanValue,
      fecha_saldo_inicial: nullableDate, earliest_movement: nullableDate, latest_movement: nullableDate, ...fields(bankCounts, countValue) },
    counts: bankCounts, dates: ['fecha_saldo_inicial', 'earliest_movement', 'latest_movement'], labels: ['active', 'deleted'],
    key: ['account_id'], currency: 'currency',
    validate: (row) => countsBounded(row, 'movements', ['alive_movements']) && countsBounded(row, 'alive_movements', bankCounts.slice(2)) &&
      exclusiveCountsBounded(row, 'alive_movements', ['reconciled_rows', 'pending_rows', 'ignored_rows']) &&
      orderedDates(row, 'earliest_movement', 'latest_movement'),
  },
  '06-tax-credit-readiness': {
    limit: 30, shape: { side: member(['ar', 'ap']), state: (value) => arState(value) || apCreditState(value),
      ...fields(creditCounts, countValue), ppd: nullableCount, pue: nullableCount },
    counts: creditCounts, dates: [], labels: ['side', 'state'], key: ['side', 'state'],
    validate: (row) => (row.side === 'ar' ? arState(row.state) : apCreditState(row.state)) &&
      countsBounded(row, 'documents', creditCounts.slice(1)) && exclusiveCountsBounded(row, 'documents', ['ppd', 'pue']),
  },
  '10-payment-currency-safe': {
    limit: 80, shape: { side: member(['ar', 'ap']), cash_currency: currencyValue, document_currency: currencyValue,
      method: (value) => value === null || (typeof value === 'string' && /^[A-Za-z0-9 _-]{1,60}$/.test(value)),
      ...fields(paymentCounts, countValue), noncash_adjustments: nullableCount, advance_applications: nullableCount },
    counts: paymentCounts, dates: [], labels: ['side'], key: ['side', 'cash_currency', 'document_currency', 'method'],
    currency: 'cash_currency', relatedCurrency: 'document_currency',
    validate: (row) => countsBounded(row, 'payments', paymentCounts.slice(1)),
  },
  '14-historical-date-quality': {
    limit: 2, fixedRows: 2, shape: { side: member(['ar', 'ap']), ...fields(historyCounts, nullableCount) },
    counts: historyCounts, dates: [], labels: ['side'], key: ['side'],
    validate: (row) => countsBounded(row, 'pre_october_documents', historyCounts.slice(1, 4)),
  },
  '15-nc-scope-fx': {
    limit: 30, shape: { note_currency: currencyValue, invoice_currency: currencyValue, state: supplierNoteState, ...fields(noteCounts, countValue) },
    counts: noteCounts, dates: [], labels: ['state'], key: ['note_currency', 'invoice_currency', 'state'],
    currency: 'invoice_currency', relatedCurrency: 'note_currency', validate: (row) => countsBounded(row, 'notes', noteCounts.slice(1)),
  },
  '17-ap-current-balance': {
    limit: 30, shape: { currency: currencyValue, state: apState, approval: apApproval,
      earliest_schedule: nullableDate, latest_schedule: nullableDate, ...fields(scheduleCounts, countValue) },
    counts: scheduleCounts, dates: ['earliest_schedule', 'latest_schedule'], labels: ['state', 'approval'],
    key: ['currency', 'state', 'approval'], currency: 'currency', validate: validSchedule,
  },
};
function validSchedule(row: Row): boolean {
  if (!countsBounded(row, 'documents', ['outstanding_documents']) ||
    !countsBounded(row, 'outstanding_documents', scheduleCounts.slice(2))) return false;
  return (count(row.scheduled_outstanding) === 0 || row.earliest_schedule !== null) &&
    count(row.scheduled_outstanding)! + count(row.unscheduled_outstanding)! === count(row.outstanding_documents) &&
    count(row.future_scheduled_outstanding)! <= count(row.scheduled_outstanding)! && orderedDates(row, 'earliest_schedule', 'latest_schedule');
}
export function scheduleDatesMatchBusinessDate(row: Row, businessDate: string): boolean {
  if (typeof row.latest_schedule === 'string' && row.latest_schedule < businessDate && count(row.future_scheduled_outstanding)! > 0) return false;
  return !(typeof row.earliest_schedule === 'string' && row.earliest_schedule >= businessDate &&
    count(row.future_scheduled_outstanding) !== count(row.scheduled_outstanding));
}
