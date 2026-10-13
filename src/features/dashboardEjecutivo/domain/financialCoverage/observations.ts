import { METRICS, QUERY_IDS, type CoverageCause, type CoverageRequest, type Observation,
  type QueryId, type SourceObservation } from './contract';
import { count, dateValue, project, record, utcTimestamp, type Row } from './parsing';
import { QUERY_SPECS, scheduleDatesMatchBusinessDate, type QuerySpec } from './schemas';

export interface ParsedInventory {
  observations: Observation[];
  sources: SourceObservation[];
  causes: CoverageCause[];
  observedAt: string[];
}
function cause(code: CoverageCause['code'], detail: string, queryId?: QueryId): CoverageCause {
  return { code, detail, basis: 'invalid-input', affects: METRICS, ...(queryId ? { queryId } : {}) };
}
interface ParsedBatch { observations: Observation[]; source: SourceObservation; causes: CoverageCause[]; observedAt?: string }
function rejected(queryId: QueryId, status: SourceObservation['status'], issue: CoverageCause): ParsedBatch {
  return { observations: [], source: { queryId, status, rowCount: null }, causes: [issue] };
}
function envelopeIssue(batch: Row, request: CoverageRequest, queryId: QueryId): ParsedBatch | null {
  if (batch.organizationId !== request.organizationId) return rejected(queryId, 'scope-mismatch',
    cause('TENANT_SCOPE_MISMATCH', 'Se descartó la fuente por organización discordante o ausente.', queryId));
  if (!utcTimestamp(batch.observedAt) || !dateValue(batch.businessDate) || typeof batch.partialResponse !== 'boolean') {
    return rejected(queryId, 'invalid', cause('INVALID_OBSERVATION', 'Falta fecha de negocio o metadata válida de lectura.', queryId));
  }
  if (batch.outcome === 'error') return rejected(queryId, 'error',
    cause('SOURCE_READ_ERROR', 'La lectura falló; no se sustituye por una población vacía.', queryId));
  if (batch.outcome !== 'ok' || !Array.isArray(batch.rows)) return rejected(queryId, 'invalid',
    cause('INVALID_OBSERVATION', 'Respuesta de lectura inválida.', queryId));
  return null;
}
function validRows(rows: readonly unknown[], spec: QuerySpec, organizationId: string): Row[] | null {
  if (rows.length > spec.limit || (spec.fixedRows !== undefined && rows.length !== spec.fixedRows)) return null;
  const parsed: Row[] = []; const keys = new Set<string>();
  for (const row of rows) {
    if (record(row) && row.organization_id !== undefined && row.organization_id !== organizationId) return null;
    const value = project(row, spec.shape);
    if (value === null || !spec.validate(value)) return null;
    const key = JSON.stringify(spec.key.map((field) => value[field]));
    if (keys.has(key)) return null;
    keys.add(key); parsed.push(value);
  }
  return parsed;
}
function selectCounts(row: Row, keys: readonly string[]): Record<string, number> {
  const output: Record<string, number> = {};
  for (const key of keys) { const value = count(row[key]); if (value !== null) output[key] = value; }
  return output;
}
function selectDates(row: Row, keys: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(keys.map((key) => [key, row[key] as string | null]));
}
function toObservation(row: Row, rowIndex: number, queryId: QueryId, batch: Row, request: CoverageRequest): Observation {
  const spec = QUERY_SPECS[queryId];
  const currency = spec.currency ? row[spec.currency] as string : null;
  const relatedCurrency = spec.relatedCurrency ? row[spec.relatedCurrency] as string : null;
  const counts = selectCounts(row, spec.counts); const dates = selectDates(row, spec.dates);
  if (queryId === '04-close-history') {
    const config = row.close_config as readonly { value: string }[] | null;
    counts.close_config_rows = config?.length ?? 0;
    dates.configured_close_through = config?.length === 1 ? config[0].value : null;
  }
  return { queryId, rowIndex, observedAt: batch.observedAt as string, businessDate: batch.businessDate as string,
    scope: relatedCurrency ? 'currency-pair' : currency ? 'currency' : 'organization-context', currency, relatedCurrency,
    relevance: currency === null ? 'organization-context' : currency === request.currency ? 'requested-currency' : 'other-currency',
    counts, dates, labels: Object.fromEntries(spec.labels.map((key) => [key, row[key] as string | boolean | null])) };
}
function parseBatch(batch: Row, request: CoverageRequest, queryId: QueryId): ParsedBatch {
  const invalid = envelopeIssue(batch, request, queryId);
  if (invalid) return invalid;
  const spec = QUERY_SPECS[queryId];
  const rows = validRows(batch.rows as unknown[], spec, request.organizationId);
  if (rows === null) return rejected(queryId, 'invalid',
    cause('INVALID_OBSERVATION', 'Filas inválidas, duplicadas, fuera de límite o con organización discordante.', queryId));
  if (queryId === '04-close-history' && rows[0].database_date !== batch.businessDate) return rejected(queryId, 'invalid',
    cause('INVALID_OBSERVATION', 'La fecha de la consulta no coincide con el sobre de observación.', queryId));
  if (queryId === '17-ap-current-balance' && !rows.every((row) => scheduleDatesMatchBusinessDate(row, batch.businessDate as string))) {
    return rejected(queryId, 'invalid', cause('INVALID_OBSERVATION', 'Los conteos de programación contradicen sus fechas y fecha de negocio.', queryId));
  }
  const partial = batch.partialResponse === true || (spec.fixedRows === undefined && rows.length === spec.limit);
  const causes: CoverageCause[] = [];
  if (partial) causes.push(cause('OBSERVATION_MAY_BE_TRUNCATED', 'La entrega es parcial o alcanzó LIMIT; no acredita toda la población.', queryId));
  if (batch.businessDate !== request.asOf) causes.push(cause('OBSERVATION_CUT_MISMATCH',
    'La observación pertenece a otra fecha de negocio; no reconstruye el corte solicitado.', queryId));
  return { observations: rows.map((row, index) => toObservation(row, index, queryId, batch, request)),
    source: { queryId, status: partial ? 'possibly-truncated' : rows.length ? 'observed' : 'empty-response', rowCount: rows.length },
    causes, observedAt: batch.observedAt as string };
}
function selectQuery(batches: readonly unknown[], queryId: QueryId, request: CoverageRequest): ParsedBatch {
  const matches = batches.filter((batch): batch is Row => record(batch) && batch.queryId === queryId);
  if (matches.length === 0) return rejected(queryId, 'missing', cause('SOURCE_UNOBSERVED', 'No se recibió esta fuente.', queryId));
  if (matches.length > 1) return rejected(queryId, 'duplicate', cause('DUPLICATE_QUERY', 'Se descartaron entregas repetidas de la misma consulta.', queryId));
  return parseBatch(matches[0], request, queryId);
}
export function parseObservations(batches: unknown, request: CoverageRequest): ParsedInventory {
  const result: ParsedInventory = { observations: [], sources: [], causes: [], observedAt: [] };
  if (!Array.isArray(batches) || batches.length > 64) {
    result.causes.push(cause('INVALID_OBSERVATION', 'Lista de observaciones inválida o fuera de límite.'));
    batches = [];
  }
  const input = batches as unknown[];
  if (input.some((batch) => !record(batch) || !QUERY_IDS.includes(batch.queryId as QueryId))) {
    result.causes.push(cause('INVALID_OBSERVATION', 'Se descartó una consulta no reconocida.'));
  }
  for (const queryId of QUERY_IDS) {
    const parsed = selectQuery(input, queryId, request);
    result.observations.push(...parsed.observations); result.sources.push(parsed.source); result.causes.push(...parsed.causes);
    if (parsed.observedAt) result.observedAt.push(parsed.observedAt);
  }
  return result;
}
