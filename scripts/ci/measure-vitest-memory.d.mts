/** Method 5 retries complete guarded observations within the original recovery deadline. */
export interface MemoryMethod { metric: string; version: number; source: string; intervalMs: number; maxGapMs: number; maxSampleMs: number; maxProcesses: number; maxTasks: number; exitVerificationMs: number; exitPollMs: number; exitMaxChecks: number; scope: string }
export const MEMORY_METHOD: Readonly<MemoryMethod>;
export function parseIdentity(stat: string): { parent: number; start: string; state: string };
/** Both values stay unknown until task enumeration and identity rechecks finish. */
export type TaskGroupDiagnostic = { nonTerminalTasks: null; stableTasks: null } | { nonTerminalTasks: number; stableTasks: boolean };
export type ExitVerificationPoint = TaskGroupDiagnostic & { atMs: number; state: string; exitFlag: boolean };
export interface ExitVerification { outcome: string; elapsedMs: number; checks: number; trace: ExitVerificationPoint[] }
export type RecoveryPhase = 'group-stat' | 'group-status' | 'task-list' | 'task-stat-before' | 'task-children' | 'task-stat-after' | 'child-stat' | 'representative-stat-before' | 'representative-status' | 'representative-stat-after' | 'group-recheck' | 'rss-result';
export type RecoveryCause = 'ENOENT' | 'ESRCH' | 'RSS_ABSENT' | 'EMPTY_TASK_LIST';
/** Contains only internally constructed categories and counters, never process identifiers. */
export interface RecoveryDiagnostic extends ExitVerification { initialPhase: RecoveryPhase; initialCause: RecoveryCause; rssAttempts: number }
export interface MemorySamplerSample { rssBytes: number; processCount: number; taskCount: number; exitRaces: number; durationMs: number; exitVerificationCount: number; exitVerificationWallMs: number; lastExitVerification: ExitVerification | null; recoveryCount: number; recoveryWallMs: number; lastRecovery: RecoveryDiagnostic | null }
export function createTreeSampler(rootPid: number, options?: { read?: (path: string, encoding: string) => string; list?: (path: string) => string[]; now?: () => number; pause?: (ms: number) => void }): () => MemorySamplerSample;
export function measureCommand(command: string[], options?: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; samplerFactory?: typeof createTreeSampler; write?: (file: string, value: unknown) => void; now?: () => number }): Promise<{ code: number | null; signal: NodeJS.Signals | null; report: Record<string, unknown> }>;
