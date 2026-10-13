import { calendarMonthBoundsIso } from '@/lib/date/dateOnly';
import type { Period } from '../financialMetrics/calendar';
import { METRICS, POLICY_KEYS, type CoverageCause, type CoverageDiagnostic, type CoverageRequest,
  type Metric, type Observation } from './contract';
import { currencyValue, dateValue, record, type Row } from './parsing';
import { parseObservations, type ParsedInventory } from './observations';

const EFFICIENCY: readonly Metric[] = ['dso', 'dpo'];
const CASH: readonly Metric[] = ['forecast13Weeks', 'runway'];
function prerequisite(code: CoverageCause['code'], detail: string, affects: readonly Metric[]): CoverageCause {
  return { code, detail, affects, basis: 'unverified-prerequisite' };
}
function baseCauses(): CoverageCause[] {
  return [
    prerequisite('SNAPSHOT_NOT_CERTIFIED', 'Las lecturas observadas no acreditan un snapshot coherente, completo ni aislamiento integral.', METRICS),
    prerequisite('METRIC_EVIDENCE_NOT_CERTIFIED', 'Este adaptador sólo diagnostica; no verifica certificados ni habilita importes del núcleo.', METRICS),
    prerequisite('HISTORY_INCOMPLETE', 'No se ha verificado apertura, eventos completos y reconstrucción histórica para el período y las tres mensualidades comparables.', EFFICIENCY),
    prerequisite('HISTORY_INCOMPLETE', 'No está verificada la población completa de saldos y vencimientos contractuales al corte solicitado.', ['aging']),
    prerequisite('HISTORY_INCOMPLETE', 'No está verificada una serie completa de efectivo real para una ventana de consumo explícitamente aprobada.', ['runway']),
    prerequisite('COMMERCIAL_CLASSIFICATION_MISSING', 'Falta clasificación comercial y crédito de origen verificada; PPD, días de crédito y estado actual no la sustituyen.', EFFICIENCY),
    prerequisite('PRINCIPAL_AGENT_CLASSIFICATION_MISSING', 'No está verificada la separación entre fondos de terceros y operación propia.', METRICS),
    prerequisite('TAX_ALLOCATION_POLICY_UNVERIFIED', 'Falta política aprobada y aplicaciones por base, impuestos y retenciones documentales.', EFFICIENCY),
    prerequisite('FX_POLICY_UNVERIFIED', 'Política y linaje de moneda de las aplicaciones no verificados; no se infiere conversión ni consolidación.', EFFICIENCY),
    prerequisite('BURN_POLICY_UNVERIFIED', 'Ventana y clasificación del consumo neto efectivo pendientes de aprobación verificable.', ['runway']),
    prerequisite('AVAILABLE_CASH_POLICY_UNVERIFIED', 'Perímetro de caja disponible y restricciones pendientes de aprobación verificable.', CASH),
    prerequisite('CREDIT_NOTE_BASE_COVERAGE_UNVERIFIED', 'Los conteos observados no certifican bases y aplicaciones netas de todas las notas del período.', EFFICIENCY),
    prerequisite('CASH_NOT_RECONCILED', 'Faltan extractos, cobertura y conciliación verificadas al corte; la marca Conciliado y el campo saldo no son certificados.', CASH),
    prerequisite('CASH_AVAILABILITY_UNVERIFIED', 'No se han verificado saldos disponibles y restricciones al corte.', CASH),
    prerequisite('CASH_FLOW_COVERAGE_INCOMPLETE', 'Falta población completa de cobros y pagos reales y previstos, sin duplicidad ni omisión.', CASH),
    prerequisite('CASH_LINEAGE_UNVERIFIED', 'No se ha verificado el linaje de bancos, pagos, anticipos, ajustes, devoluciones y traspasos.', CASH),
    prerequisite('EXPECTED_CASH_DATES_MISSING', 'No existe cobertura verificada de fechas e importes esperados para todas las obligaciones y las trece semanas.', ['forecast13Weeks']),
  ];
}
function parseRequest(input: unknown): CoverageRequest | null {
  if (!record(input) || !record(input.request)) return null;
  const r = input.request;
  if (typeof r.organizationId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(r.organizationId)) return null;
  if (!dateValue(r.asOf) || !currencyValue(r.currency)) return null;
  if (typeof r.selectedMonth !== 'string' || !/^\d{4}-\d{2}$/.test(r.selectedMonth) ||
    !dateValue(`${r.selectedMonth}-01`) || r.selectedMonth < '0001-03') return null;
  return { organizationId: r.organizationId, asOf: r.asOf as string, currency: r.currency as string, selectedMonth: r.selectedMonth };
}
function comparisonPeriods(selectedMonth: string): Period[] {
  const date = new Date(`${selectedMonth}-01T00:00:00.000Z`);
  const periods: Period[] = [];
  for (let i = 0; i < 3; i++) {
    periods.unshift(calendarMonthBoundsIso(date.toISOString().slice(0, 7))!);
    date.setUTCMonth(date.getUTCMonth() - 1);
  }
  return periods;
}
function closingCauses(request: CoverageRequest, periods: readonly Period[], observations: readonly Observation[]): CoverageCause[] {
  const causes = [prerequisite('CLOSE_NOT_VERIFIED', 'Una configuración observada no acredita cierre aprobado e histórico de todos los períodos.', EFFICIENCY)];
  const lastEnd = periods[periods.length - 1].end;
  if (lastEnd >= request.asOf) causes.push({ code: 'PERIOD_NOT_CLOSED', detail: 'El mes seleccionado no ha terminado antes del corte.', basis: 'observed-gap', affects: EFFICIENCY });
  const close = observations.find((row) => row.queryId === '04-close-history' && row.businessDate === request.asOf);
  if (close?.counts.close_config_rows === 0) causes.push({ code: 'CLOSE_NOT_CONFIGURED', detail: 'No se observó configuración de cierre en esta lectura.',
    basis: 'observed-gap', affects: EFFICIENCY, queryId: close.queryId, rowIndex: close.rowIndex });
  const through = close?.dates.configured_close_through;
  if (through && through < lastEnd) causes.push({ code: 'PERIOD_NOT_CLOSED', detail: 'La configuración observada de cierre no cubre el mes solicitado.',
    basis: 'observed-gap', affects: EFFICIENCY, queryId: close.queryId, rowIndex: close.rowIndex });
  return causes;
}
function rowCause(row: Observation, code: CoverageCause['code'], detail: string, affects: readonly Metric[]): CoverageCause {
  return { code, detail, affects, basis: 'observed-gap', queryId: row.queryId, rowIndex: row.rowIndex };
}
function observedGaps(observations: readonly Observation[], asOf: string): CoverageCause[] {
  const causes: CoverageCause[] = [];
  for (const row of observations) {
    if (row.relevance !== 'requested-currency' || row.businessDate !== asOf) continue;
    if (row.queryId === '15-nc-scope-fx' && row.labels.state === 'Aplicada' && row.counts.missing_net_base > 0) {
      causes.push(rowCause(row, 'NET_CREDIT_NOTE_BASE_MISSING', 'Hay notas aplicadas sin base neta en la moneda de la factura; el agregado observado no delimita el período.', ['dpo']));
    }
    if (row.queryId === '17-ap-current-balance') causes.push(...scheduleGaps(row));
  }
  return causes;
}
function scheduleGaps(row: Observation): CoverageCause[] {
  const causes: CoverageCause[] = [];
  if (row.counts.unscheduled_outstanding > 0 || row.counts.scheduled_outstanding > row.counts.future_scheduled_outstanding) {
    causes.push(rowCause(row, 'EXPECTED_CASH_DATES_MISSING', 'La cartera actual observada contiene programación ausente o pasada; no se desplaza automáticamente al forecast.', ['forecast13Weeks']));
  }
  if (row.counts.unknown_due_outstanding > 0) causes.push(rowCause(row, 'CONTRACTUAL_DUE_DATES_MISSING',
    'Hay vencimientos contractuales desconocidos en la cartera actual observada; la programación no los sustituye.', ['aging']));
  return causes;
}
function readingWindow(observedAt: readonly string[]): CoverageDiagnostic['readingWindow'] {
  const times = [...observedAt].sort();
  return times.length ? { first: times[0], last: times[times.length - 1], consistency: 'unverified' } : null;
}
function metricStatus(metric: Metric, causes: readonly CoverageCause[]): CoverageDiagnostic['metrics'][Metric] {
  return { status: 'unavailable', causeCodes: [...new Set(causes.filter((cause) => cause.affects.includes(metric)).map((cause) => cause.code))] };
}
function output(request: CoverageRequest | null, periods: readonly Period[], inventory: ParsedInventory, causes: CoverageCause[]): CoverageDiagnostic {
  return { version: 'coverage-observation-v1', status: 'unavailable', numericEligible: false, certification: 'not-evaluated',
    request, comparisonPeriods: periods, readingWindow: readingWindow(inventory.observedAt), observations: inventory.observations,
    sources: inventory.sources, causes, policies: POLICY_KEYS.map((key) => ({ key, status: 'approval-unverified' })),
    metrics: { dso: metricStatus('dso', causes), dpo: metricStatus('dpo', causes), aging: metricStatus('aging', causes),
      forecast13Weeks: metricStatus('forecast13Weeks', causes), runway: metricStatus('runway', causes) } };
}
/** Pure, fail-closed diagnostic. All arguments are observations, never certification authority. */
export function diagnoseFinancialCoverage(input: unknown): CoverageDiagnostic {
  const request = parseRequest(input); const causes = baseCauses();
  if (!request) return output(null, [], { observations: [], sources: [], causes: [], observedAt: [] }, [...causes,
    { code: 'INVALID_REQUEST', detail: 'Organización, moneda, corte o mes inválidos; se requieren tres meses dentro del rango de fechas.', basis: 'invalid-input', affects: METRICS }]);
  const periods = comparisonPeriods(request.selectedMonth);
  const inventory = parseObservations((input as Row).batches, request);
  causes.push(...inventory.causes, ...closingCauses(request, periods, inventory.observations), ...observedGaps(inventory.observations, request.asOf));
  return output(request, periods, inventory, causes);
}
