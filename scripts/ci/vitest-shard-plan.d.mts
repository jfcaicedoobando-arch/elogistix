export interface ShardOptions { count?: number | string; maxParallel?: number | string }
export interface ShardPlan { count: number; maxParallel: number; matrix: { shard: number[] } }
export const DEFAULT_SHARD_COUNT: number;
export const ALLOWED_SHARD_COUNTS: readonly number[];
export const ACCOUNT_JOB_BUDGET: number;
export function createShardPlan(options?: ShardOptions): ShardPlan;
export function planFromEnvironment(env: Record<string, string | undefined>): ShardPlan;
export function assessCapacity(options: { plans: ShardOptions[]; otherJobs: number }): {
  matrixJobs: number; otherJobs: number; total: number; budget: number; headroom: number; fits: boolean;
};
