import type { TestCatalog } from './test-catalog.mjs';
export interface CaseCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
}
export interface TestFileEvidence {
  path: string;
  project: string;
  state: string;
  cases: CaseCounts;
  durationMs: number;
  phasesMs: { environment: number; prepare: number; collect: number; setup: number };
  retries: number;
  flaky: number;
}
export interface RunIdentity { id?: string | null; attempt?: string | null; event?: string | null }
export interface EvidenceReport {
  schemaVersion: number;
  sha: string;
  treeDigest: string;
  shard: { index: number; total: number; maxParallel?: number | null };
  status: string;
  unhandledErrors: number;
  wallTimeMs: number;
  cacheHit: boolean | null;
  environment: { maxWorkers: number; lockDigest: string; [key: string]: unknown };
  discovered: { path: string; project: string }[];
  selected: { path: string; project: string }[];
  files: TestFileEvidence[];
  run?: RunIdentity;
}
export interface EvidenceSummary {
  schemaVersion: number;
  sha: string;
  treeDigest: string;
  shards: number;
  files: number;
  cases: CaseCounts;
  wallTimeMsByShard: number[];
  cacheHitByShard: (boolean | null)[];
  attemptByShard: (string | null)[];
}
export function validateEvidence(catalog: TestCatalog, reports: EvidenceReport[], total: number): EvidenceSummary;
export function selectLatestReports<T extends EvidenceReport>(reports: T[], expectedRun?: RunIdentity): T[];
export function verifyEvidence(directory: string, total: number): EvidenceSummary;
