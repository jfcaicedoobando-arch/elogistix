import type { Period } from '../financialMetrics/calendar';

/** Diagnostic-only boundary. This contract deliberately cannot construct a kernel Scope. */
export const QUERY_IDS = ['02-coverage', '04-close-history', '05-bank-coverage',
  '06-tax-credit-readiness', '10-payment-currency-safe', '14-historical-date-quality',
  '15-nc-scope-fx', '17-ap-current-balance'] as const;
export type QueryId = typeof QUERY_IDS[number];
export const METRICS = ['dso', 'dpo', 'aging', 'forecast13Weeks', 'runway'] as const;
export type Metric = typeof METRICS[number];
export const POLICY_KEYS = ['commercial-population', 'document-tax-allocation',
  'historical-fx', 'cash-consumption', 'available-cash'] as const;
export type PolicyKey = typeof POLICY_KEYS[number];
export interface CoverageRequest {
  organizationId: string;
  /** Organization business date, supplied explicitly; never inferred from the browser clock. */
  asOf: string;
  currency: string;
  selectedMonth: string;
}
/** A transport envelope is attribution, not proof of RLS, completeness, close or reconciliation. */
export interface ObservationBatch {
  queryId: QueryId;
  organizationId: string;
  /** Canonical UTC timestamp from the reader, not a client certification identifier. */
  observedAt: string;
  businessDate: string;
  outcome: 'ok' | 'error';
  /** Delivery metadata only; false does not certify population completeness. */
  partialResponse: boolean;
  rows?: readonly unknown[];
}
export interface CoverageInput { request: CoverageRequest; batches: readonly ObservationBatch[] }
export interface Observation {
  queryId: QueryId;
  rowIndex: number;
  observedAt: string;
  businessDate: string;
  scope: 'organization-context' | 'currency' | 'currency-pair';
  currency: string | null;
  relatedCurrency: string | null;
  /** Currency match does NOT make a current observation an as-of balance. */
  relevance: 'organization-context' | 'requested-currency' | 'other-currency';
  counts: Readonly<Record<string, number>>;
  dates: Readonly<Record<string, string | null>>;
  labels: Readonly<Record<string, string | boolean | null>>;
}
export type CauseCode = 'INVALID_REQUEST' | 'INVALID_OBSERVATION' | 'TENANT_SCOPE_MISMATCH' |
  'DUPLICATE_QUERY' | 'SOURCE_UNOBSERVED' | 'SOURCE_READ_ERROR' | 'OBSERVATION_MAY_BE_TRUNCATED' |
  'OBSERVATION_CUT_MISMATCH' | 'SNAPSHOT_NOT_CERTIFIED' | 'METRIC_EVIDENCE_NOT_CERTIFIED' |
  'PERIOD_NOT_CLOSED' | 'CLOSE_NOT_CONFIGURED' | 'CLOSE_NOT_VERIFIED' |
  'HISTORY_INCOMPLETE' | 'COMMERCIAL_CLASSIFICATION_MISSING' |
  'PRINCIPAL_AGENT_CLASSIFICATION_MISSING' | 'TAX_ALLOCATION_POLICY_UNVERIFIED' |
  'FX_POLICY_UNVERIFIED' | 'BURN_POLICY_UNVERIFIED' | 'AVAILABLE_CASH_POLICY_UNVERIFIED' |
  'NET_CREDIT_NOTE_BASE_MISSING' | 'CREDIT_NOTE_BASE_COVERAGE_UNVERIFIED' |
  'CASH_NOT_RECONCILED' | 'CASH_AVAILABILITY_UNVERIFIED' | 'CASH_FLOW_COVERAGE_INCOMPLETE' |
  'CASH_LINEAGE_UNVERIFIED' | 'EXPECTED_CASH_DATES_MISSING' | 'CONTRACTUAL_DUE_DATES_MISSING';
export interface CoverageCause {
  code: CauseCode;
  detail: string;
  basis: 'observed-gap' | 'unverified-prerequisite' | 'invalid-input';
  affects: readonly Metric[];
  queryId?: QueryId;
  /** Refers only to a row in this diagnostic, never to a certified source record. */
  rowIndex?: number;
}
export interface CoverageDiagnostic {
  version: 'coverage-observation-v1';
  status: 'unavailable';
  numericEligible: false;
  certification: 'not-evaluated';
  request: CoverageRequest | null;
  comparisonPeriods: readonly Period[];
  readingWindow: { first: string; last: string; consistency: 'unverified' } | null;
  observations: readonly Observation[];
  sources: readonly SourceObservation[];
  causes: readonly CoverageCause[];
  policies: readonly { key: PolicyKey; status: 'approval-unverified' }[];
  metrics: Readonly<Record<Metric, { status: 'unavailable'; causeCodes: readonly CauseCode[] }>>;
}
export interface SourceObservation {
  queryId: QueryId;
  status: 'observed' | 'empty-response' | 'error' | 'invalid' | 'missing' |
    'scope-mismatch' | 'duplicate' | 'possibly-truncated';
  rowCount: number | null;
}
