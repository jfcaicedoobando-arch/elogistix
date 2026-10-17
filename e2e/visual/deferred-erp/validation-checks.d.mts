export interface ValidationExecutionResult {
  status?: number | null;
  signal?: NodeJS.Signals | null;
  error?: Error;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
}
export interface ValidationExecutionOptions {
  cwd: string;
  encoding: "utf8";
  shell: false;
  timeout: number;
  maxBuffer: number;
  env: NodeJS.ProcessEnv;
}
export type ValidationExecutor = (command: string, args: string[], options: ValidationExecutionOptions) => ValidationExecutionResult | undefined;
export interface SourceFingerprint { algorithm: "sha256"; digest: string; fileCount: number }
export interface ValidationError { name: string; message: string; code: string | null }
export interface ValidationCommandResult {
  name: string;
  executable: string;
  args: string[];
  cwd: ".";
  shell: false;
  timeoutMs: number;
  maxBufferBytes: number;
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  spawnError: ValidationError | null;
  log: { path: string; sha256: string; bytes: number; evidencePath?: string };
}
export interface ValidationProof {
  schemaVersion: 1;
  runId: string;
  status: "running" | "passed" | "failed";
  startedAt: string;
  completedAt: string | null;
  sourceBefore: SourceFingerprint | null;
  sourceAfter: SourceFingerprint | null;
  commands: ValidationCommandResult[];
  failure?: ValidationError;
}
export const validationCommands: { name: string; args: string[] }[];
export function fingerprintSources(root: string): Promise<SourceFingerprint>;
export function assertSuccessfulValidation(record?: Pick<ValidationCommandResult, "name" | "exitCode" | "signal" | "spawnError"> | null): void;
export function runValidation(options: { root: string; runId?: string; execute?: ValidationExecutor }): Promise<ValidationProof>;
