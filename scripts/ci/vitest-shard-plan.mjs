#!/usr/bin/env node
/** Native Vitest partitioning only. This is not an account-wide scheduler. */
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_SHARD_COUNT = 5;
export const ALLOWED_SHARD_COUNTS = Object.freeze([5, 8]);
export const ACCOUNT_JOB_BUDGET = 20;

function integer(value, name, fallback) {
  const candidate = value === undefined || value === '' ? String(fallback) : String(value);
  if (!/^[1-9]\d*$/.test(candidate)) throw new Error(`${name} must be a positive integer`);
  return Number(candidate);
}

export function createShardPlan({ count, maxParallel } = {}) {
  const total = integer(count, 'shard count', DEFAULT_SHARD_COUNT);
  if (!ALLOWED_SHARD_COUNTS.includes(total)) throw new Error('Supported shard counts: 5, 8');
  const parallel = integer(maxParallel, 'max parallel', total);
  if (parallel > total) throw new Error('max parallel must not exceed shard count');
  return {
    count: total,
    maxParallel: parallel,
    matrix: { shard: Array.from({ length: total }, (_, index) => index + 1) },
  };
}

/** Capacity estimate with explicit assumptions; never a reservation or mutex. */
export function assessCapacity({ plans, otherJobs }) {
  if (!Array.isArray(plans) || plans.length === 0) throw new Error('At least one run plan is required');
  if (!Number.isSafeInteger(otherJobs) || otherJobs < 0) throw new Error('otherJobs must be a nonnegative integer');
  const matrixJobs = plans.reduce((sum, plan) => sum + createShardPlan(plan).maxParallel, 0);
  const total = matrixJobs + otherJobs;
  return { matrixJobs, otherJobs, total, budget: ACCOUNT_JOB_BUDGET, headroom: ACCOUNT_JOB_BUDGET - total, fits: total <= ACCOUNT_JOB_BUDGET };
}

export function planFromEnvironment(env) {
  // Only workflow_dispatch may override the ordinary PR/push defaults.
  return env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    ? createShardPlan({ count: env.VITEST_SHARD_COUNT, maxParallel: env.VITEST_MAX_PARALLEL })
    : createShardPlan();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const plan = planFromEnvironment(process.env);
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `shard_count=${plan.count}\nshard_max_parallel=${plan.maxParallel}\nshard_matrix=${JSON.stringify(plan.matrix)}\n`);
    }
    console.log(JSON.stringify(plan));
  } catch (error) {
    console.error(`Invalid shard plan: ${error.message}`);
    process.exitCode = 1;
  }
}
