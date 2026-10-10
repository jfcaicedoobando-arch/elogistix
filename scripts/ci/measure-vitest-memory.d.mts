/** Method 5 retries complete guarded observations within the original recovery deadline. */
export interface MemoryMethod { metric: string; version: number; source: string; intervalMs: number; maxGapMs: number; maxSampleMs: number; maxProcesses: number; maxTasks: number; exitVerificationMs: number; exitPollMs: number; exitMaxChecks: number; scope: string }
export const MEMORY_METHOD: Readonly<MemoryMethod>;
export const MEMORY_DIAGNOSTIC_VERSION: 2;
export function parseIdentity(stat: string): { parent: number; start: string; state: string };
/** Both values stay unknown until task enumeration and identity rechecks finish. */
export type TaskGroupDiagnostic = { nonTerminalTasks: null; stableTasks: null } | { nonTerminalTasks: number; stableTasks: boolean };
export type ObservationReason = 'NONE' | 'RSS_ABSENT' | 'UNCAPTURED_TASKS' | 'PENDING_REPRESENTATIVE' | 'UNREAD_CHILDREN' | 'TERMINAL_HISTORY' | 'RSS_UNUSABLE' | 'OBSERVATION_INCOMPLETE';
/** Attempts precede reads; reads count returned text, missing requires validated status. */
export interface StatusReads { groupAttempts: number; groupReads: number; groupWithoutVmRss: number; groupDiscarded: number; representativeAttempts: number; representativeReads: number; representativeWithoutVmRss: number; representativeDiscarded: number }
/** Known internal map sizes; zero does not certify that task enumeration finished. */
export interface PendingObligations { uncapturedTasks: number; unreadChildren: number; pendingRepresentatives: number }
export interface ObservationDiagnostic { reason: ObservationReason; statusReads: StatusReads; pendingObligations: PendingObligations }
/** stableTasks compares the two lists in this check, not the whole recovery window. */
export type ExitVerificationPoint = TaskGroupDiagnostic & { atMs: number; state: string; exitFlag: boolean; observation: ObservationDiagnostic | null };
export type RecoveryOutcome = 'rss-recovered' | 'gone' | 'terminal' | 'unconfirmed' | 'pid-reused' | 'read-error';
export type RecoveryPhase = 'group-stat' | 'group-status' | 'task-list' | 'task-stat-before' | 'task-children' | 'task-stat-after' | 'child-stat' | 'representative-stat-before' | 'representative-status' | 'representative-stat-after' | 'group-recheck' | 'rss-result';
export type RecoveryCause = 'ENOENT' | 'ESRCH' | 'RSS_ABSENT' | 'EMPTY_TASK_LIST';
/** Contains only internally constructed categories and counters, never process identifiers. */
export interface RecoveryDiagnostic { outcome: RecoveryOutcome; elapsedMs: number; checks: number; trace: ExitVerificationPoint[]; initialPhase: RecoveryPhase; initialCause: RecoveryCause; observationAttempts: number; finalReason: ObservationReason; statusReads: StatusReads; pendingObligations: PendingObligations }
export type ExitVerification = Omit<RecoveryDiagnostic, 'outcome'> & { outcome: Exclude<RecoveryOutcome, 'rss-recovered'> };
export interface MemorySamplerSample { rssBytes: number; processCount: number; taskCount: number; exitRaces: number; durationMs: number; exitVerificationCount: number; exitVerificationWallMs: number; lastExitVerification: ExitVerification | null; recoveryCount: number; recoveryWallMs: number; lastRecovery: RecoveryDiagnostic | null }
export function createTreeSampler(rootPid: number, options?: { read?: (path: string, encoding: string) => string; list?: (path: string) => string[]; now?: () => number; pause?: (ms: number) => void }): () => MemorySamplerSample;
export function measureCommand(command: string[], options?: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; samplerFactory?: typeof createTreeSampler; write?: (file: string, value: unknown) => void; now?: () => number }): Promise<{ code: number | null; signal: NodeJS.Signals | null; report: Record<string, unknown> }>;
