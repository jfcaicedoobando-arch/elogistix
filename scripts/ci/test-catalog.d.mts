export interface CatalogEntry {
  path: string;
  lane: string;
  mode?: string;
  reason?: string;
  sha256?: string;
}
export interface TestCatalog {
  schemaVersion: number;
  sha: string;
  treeDigest: string;
  entries: CatalogEntry[];
  counts?: Record<string, number>;
}
export function hash(value: string | Uint8Array): string;
export function assertExactPaths(expected: string[], actual: string[], label: string): void;
export function classifyFiles(files: string[], guards: string[], sqlSupport: Record<string, string | undefined>): CatalogEntry[];
export function buildCatalog(root?: string): TestCatalog;
export function validateRlsEvidence(catalog: Pick<TestCatalog, 'sha' | 'entries'>, tsv: string): { sha: string; files: number; durationMs: number };
export function writeJson(file: string, data: unknown): void;
