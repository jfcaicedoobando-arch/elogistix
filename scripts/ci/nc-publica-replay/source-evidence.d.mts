export interface ByteIdentity { bytes: number; sha256: string; gitBlobSha1: string }
export interface ArchiveAnchor extends ByteIdentity {
  originalPath: string;
  archivePath: string;
  relatedPullRequest: number;
}
export interface SnapshotProfile { manifestPath: string; wrappers: readonly Readonly<ArchiveAnchor>[] }
export interface ArchiveManifest {
  format: number;
  repository: string;
  observedAtCommit: string;
  wrappers: ArchiveAnchor[];
}
export interface CheckoutBinding { kind: 'checkout'; path: string }
export interface HistoricalBinding {
  kind: 'historical-archive'; path: string; observedAtCommit: string; gitBlobSha1: string; bytes: number;
}
export interface SourceEvidence {
  sources: Record<string, string>;
  sourceBindings: Record<string, CheckoutBinding | HistoricalBinding>;
}
export const REPOSITORY: string;
export const OLD_SNAPSHOT: '43a453641a933e2f3f2be3fd766322307c8b9f3b';
export const PIN_UPDATE_SNAPSHOT: '2efa854223d0b7e7b38cb4cf743fc48b9b86a052';
export const NC_PATH: string;
export const ACCEPTANCE_PATH: string;
export const HELPER_PATH: string;
export const RUNNER_PATH: string;
export function snapshotProfile(snapshot: unknown): Readonly<SnapshotProfile>;
export function legacySourcePaths(mode: unknown): string[];
export function sourcePaths(mode: unknown, snapshot: unknown): string[];
export function byteIdentity(bytes: Buffer): ByteIdentity;
export function readRegular(root: string, relative: string): Buffer;
export function collectSourceEvidence(root: string, mode: unknown, snapshot: unknown): SourceEvidence;
export function verifyArchivePackage(root: string, snapshot: unknown): Array<ByteIdentity & { originalPath: string }>;
