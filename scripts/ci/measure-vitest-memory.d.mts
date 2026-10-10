/** Method 4 reads RSS once per TGID, optionally from an identity-verified live task. */
export interface MemoryMethod { metric: string; version: number; source: string; intervalMs: number; maxGapMs: number; maxSampleMs: number; maxProcesses: number; maxTasks: number; exitVerificationMs: number; exitPollMs: number; exitMaxChecks: number; scope: string }
export const MEMORY_METHOD: Readonly<MemoryMethod>;
export function parseIdentity(stat: string): { parent: number; start: string; state: string };
/** Both values stay unknown until task enumeration and identity rechecks finish. */
export type TaskGroupDiagnostic = { nonTerminalTasks: null; stableTasks: null } | { nonTerminalTasks: number; stableTasks: boolean };
export type ExitVerificationPoint = TaskGroupDiagnostic & { atMs: number; state: string; exitFlag: boolean };
export interface ExitVerification { outcome: string; elapsedMs: number; checks: number; trace: ExitVerificationPoint[] }
export interface MemorySamplerSample { rssBytes: number; processCount: number; taskCount: number; exitRaces: number; durationMs: number; exitVerificationCount: number; exitVerificationWallMs: number; lastExitVerification: ExitVerification | null }
export function createTreeSampler(rootPid: number, options?: { read?: (path: string, encoding: string) => string; list?: (path: string) => string[]; now?: () => number; pause?: (ms: number) => void }): () => MemorySamplerSample;
export function measureCommand(command: string[], options?: { env?: NodeJS.ProcessEnv; platform?: NodeJS.Platform; samplerFactory?: typeof createTreeSampler; write?: (file: string, value: unknown) => void; now?: () => number }): Promise<{ code: number | null; signal: NodeJS.Signals | null; report: Record<string, unknown> }>;
