export interface DenoSource { path: string; sha256: string }
export interface DenoCounts { total: number; passed: number; failed: number; skipped: number }
export interface OriginalDenoSummary {
  status: "passed";
  runId: string;
  suite: string;
  runtime: string;
  counts: DenoCounts;
  proof: string;
  proofSha256: string;
  log: string;
  junit: string;
  typecheck: true;
  runtimePermissionGrants: [];
  loader: "cached-only";
  scope: string;
}
export function fingerprintDenoSources(root: string): Promise<DenoSource[]>;
export function verifyDenoEvidence(root: string): Promise<{ proof: Record<string, unknown>; proofBytes: Buffer; proofSha256: string; log: Buffer; junit: Buffer }>;
export function collectDenoEvidence(options: { root: string; output: string }): Promise<OriginalDenoSummary>;
