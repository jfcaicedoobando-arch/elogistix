export interface JobTiming { id: number; name: string; skipped: boolean; runnerSeconds: number; createdToStartSeconds?: number }
export interface RunSummary {
  runId: number; name: string; sha: string; event: string; ref: string;
  createdAt: number; completedAt: number; latencySeconds: number;
  runnerSeconds: number; runnerMinutes: number; createdToStartP95Seconds: number;
  peakObservedJobs: number; jobs: JobTiming[];
}
export interface SampleSummary {
  label: string; shardCount: number; maxParallel: number; comparisonKey: string;
  comparisonContext: Record<string, unknown>; runIds: number[]; fileCount: number; cases: number;
  ciLatencySeconds: number; checkSetLatencySeconds: number; dispatchSpreadSeconds: number; runnerSeconds: number;
  createdToStartP95Seconds: number; shardWallMaxSeconds: number; peakObservedCheckSetJobs: number; workflows: RunSummary[];
}
export interface BenchmarkComparison {
  context: Record<string, unknown>;
  configurations: Record<number, { n: number; [metric: string]: number | { p50: number; p95: number } }>;
  thresholds: null | Record<string, boolean>;
  preliminaryThresholdsMet: boolean; automaticPromotion: false; scope: string;
}
export function percentile(values: number[], p: number): number;
export function peakConcurrentJobs(jobs: unknown[]): number;
export function jobsFromPayload(payload: unknown): unknown[];
export function summarizeActionsRun(run: unknown, jobs: unknown): RunSummary;
export function summarizeSample(sample: unknown): SampleSummary;
export function compareSamples(samples: SampleSummary[]): BenchmarkComparison[];
