#!/usr/bin/env node
/** Read-only analysis of saved Actions JSON and PR1 evidence; never dispatches. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createShardPlan } from './vitest-shard-plan.mjs';
import { MEMORY_METHOD } from './measure-vitest-memory.mjs';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const time = (value, label) => {
  invariant(typeof value === 'string' && Number.isFinite(Date.parse(value)), `Missing/invalid ${label}`);
  return Date.parse(value);
};
const seconds = (start, end, label) => {
  invariant(end >= start, `Reversed ${label} timestamps`);
  return (end - start) / 1000;
};

export function percentile(values, p) {
  invariant(values.length > 0 && values.every(Number.isFinite), 'Nonempty finite measurements required');
  invariant(Number.isFinite(p) && p > 0 && p <= 1, 'Percentile must be in (0, 1]');
  const sorted = [...values].sort((a, b) => a - b);
  if (p === 0.5) {
    const i = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
  }
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
}

/** Half-open runner intervals: completion at t does not overlap a start at t. */
export function peakConcurrentJobs(jobs) {
  const events = jobs.flatMap((job) => {
    if (job.conclusion === 'skipped') return [];
    const start = time(job.started_at, 'job started_at');
    const end = time(job.completed_at, 'job completed_at');
    seconds(start, end, 'job interval');
    return start === end ? [] : [[start, 1], [end, -1]];
  }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = 0;
  for (const [, delta] of events) { current += delta; peak = Math.max(peak, current); }
  return peak;
}

export function jobsFromPayload(payload) {
  const pages = Array.isArray(payload) ? payload : [payload];
  invariant(pages.length > 0, 'Missing Actions jobs pages');
  const expected = pages[0]?.total_count;
  invariant(Number.isSafeInteger(expected) && expected > 0, 'Missing Actions total_count');
  invariant(pages.every((page) => page.total_count === expected && Array.isArray(page.jobs)), 'Inconsistent Actions jobs pages');
  const jobs = pages.flatMap((page) => page.jobs);
  invariant(jobs.length === expected, `Incomplete jobs pagination: ${jobs.length}/${expected}`);
  invariant(new Set(jobs.map((job) => job.id)).size === jobs.length, 'Duplicate Actions job IDs');
  return jobs;
}

export function summarizeActionsRun(run, jobsPayload) {
  invariant(Number.isSafeInteger(run.id) && run.id > 0, 'Missing Actions run ID');
  invariant(run.status === 'completed' && run.conclusion === 'success', 'Actions run did not complete successfully');
  invariant(typeof run.head_branch === 'string' && run.head_branch.length > 0, 'Missing Actions ref');
  invariant(run.run_attempt === 1, 'Reruns are reliability evidence, not first-attempt benchmark samples');
  invariant(/^[0-9a-f]{40}$/.test(run.head_sha), 'Missing full Actions head SHA');
  const jobs = jobsFromPayload(jobsPayload);
  const createdAt = time(run.created_at, 'run created_at');
  let completedAt = createdAt;
  let runnerSeconds = 0;
  const jobTimings = jobs.map((job) => {
    invariant(Number.isSafeInteger(job.id) && job.id > 0, 'Missing Actions job ID');
    invariant(job.run_id === run.id && job.run_attempt === run.run_attempt, 'Mixed run or attempt in jobs');
    invariant(job.head_sha === run.head_sha, 'Mixed SHA in jobs');
    invariant(job.status === 'completed' && ['success', 'skipped'].includes(job.conclusion), `Unsuccessful job: ${job.name}`);
    if (job.conclusion === 'skipped') return { id: job.id, name: job.name, skipped: true, runnerSeconds: 0 };
    const created = time(job.created_at, 'job created_at');
    const started = time(job.started_at, 'job started_at');
    const completed = time(job.completed_at, 'job completed_at');
    invariant(created >= createdAt, 'Job predates run');
    const duration = seconds(started, completed, 'job');
    runnerSeconds += duration;
    completedAt = Math.max(completedAt, completed);
    return {
      id: job.id, name: job.name, skipped: false, runnerSeconds: duration,
      // This includes matrix admission/dependency scheduling; not pure provider queue.
      createdToStartSeconds: seconds(created, started, 'job wait'),
    };
  });
  const waits = jobTimings.filter((job) => !job.skipped).map((job) => job.createdToStartSeconds);
  invariant(waits.length > 0, 'Run contains no executed jobs');
  return {
    runId: run.id, name: run.name, sha: run.head_sha, event: run.event, ref: run.head_branch,
    createdAt, completedAt, latencySeconds: seconds(createdAt, completedAt, 'workflow'),
    runnerSeconds, runnerMinutes: runnerSeconds / 60,
    createdToStartP95Seconds: percentile(waits, 0.95),
    peakObservedJobs: peakConcurrentJobs(jobs), jobs: jobTimings,
  };
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

/** Call only after PR1's complete/disjoint/inventory gate succeeds. */
export function summarizeSample({ label, shardCount, maxParallel, loadClass, expectedWorkflows, runs, reports, memoryReports }) {
  invariant(typeof label === 'string' && label.length > 0, 'Missing sample label');
  const plan = createShardPlan({ count: shardCount, maxParallel });
  invariant(['isolated', 'shared-load'].includes(loadClass), 'loadClass must be isolated or shared-load');
  invariant(Array.isArray(expectedWorkflows) && expectedWorkflows.includes('CI'), 'Declare expected workflows, including CI');
  invariant(new Set(expectedWorkflows).size === expectedWorkflows.length, 'Duplicate expected workflow');
  invariant(Array.isArray(runs) && runs.length === expectedWorkflows.length, 'Missing or extra workflow run');
  const workflows = runs.map(({ run, jobs }) => summarizeActionsRun(run, jobs));
  invariant(new Set(workflows.map((run) => run.name)).size === workflows.length, 'Duplicate workflow run');
  invariant(workflows.every((run) => expectedWorkflows.includes(run.name)), 'Unexpected workflow run');
  const ci = workflows.find((run) => run.name === 'CI');
  invariant(ci && workflows.every((run) => run.sha === ci.sha && run.ref === ci.ref), 'Workflow check set mixes SHAs or refs');
  // PR workflows can checkout a merge SHA differing from API head_sha. This
  // controlled experiment deliberately uses dispatch on an immutable SHA/ref.
  invariant(workflows.every((run) => run.event === 'workflow_dispatch'), 'Comparable benchmark requires workflow_dispatch for every selected workflow');
  invariant(Array.isArray(reports) && reports.length === plan.count, 'Missing shard reports');
  const indexes = new Set();
  const files = new Map();
  const environment = stable(reports[0]?.environment);
  invariant(environment && typeof environment === 'object', 'Missing runner/runtime environment');
  for (const field of ['node', 'bun', 'vitest', 'platform', 'arch', 'runnerOS', 'runnerArch', 'imageOS', 'imageVersion', 'lockDigest']) {
    invariant(typeof environment[field] === 'string' && environment[field].length > 0, `Missing environment.${field}`);
  }
  invariant(environment.maxWorkers === 2 && environment.pool === 'forks' && environment.isolate === true, 'Benchmark must retain two workers, forks and isolation');
  const digest = reports[0]?.treeDigest;
  invariant(typeof digest === 'string' && digest.length > 0, 'Missing inventory digest');
  const cacheStates = new Set();
  const shardTimings = [];
  for (const report of reports) {
    invariant(report.schemaVersion === 1 && report.sha === ci.sha && report.treeDigest === digest, 'Shard SHA/schema/inventory mismatch');
    invariant(String(report.run?.id) === String(ci.runId) && String(report.run?.attempt) === '1' && report.run?.event === 'workflow_dispatch', 'Shard evidence belongs to another run/attempt/event');
    invariant(report.status === 'passed' && report.unhandledErrors === 0, 'Shard did not pass cleanly');
    invariant(report.shard?.total === plan.count && Number.isSafeInteger(report.shard.index) && report.shard.index >= 1 && report.shard.index <= plan.count, 'Invalid shard coordinates');
    invariant(report.shard.maxParallel === plan.maxParallel, 'Declared max parallel differs from shard execution metadata');
    invariant(!indexes.has(report.shard.index), 'Duplicate shard report');
    indexes.add(report.shard.index);
    invariant(JSON.stringify(stable(report.environment)) === JSON.stringify(environment), 'Mixed runner/runtime environments');
    invariant(report.cacheHit === true || report.cacheHit === false, 'Unknown cache-hit evidence');
    cacheStates.add(report.cacheHit);
    invariant(Number.isFinite(report.wallTimeMs) && report.wallTimeMs > 0, 'Missing shard wall time');
    shardTimings.push(report.wallTimeMs / 1000);
    invariant(Array.isArray(report.files) && report.files.length > 0, 'Empty executed files');
    for (const file of report.files) {
      const key = `${file.project}:${file.path}`;
      invariant(!files.has(key), `Duplicate file: ${key}`);
      invariant(file.retries === 0 && file.flaky === 0, `Retry/flaky sample: ${key}`);
      invariant(file.cases && ['total', 'passed', 'failed', 'skipped', 'pending'].every((field) => Number.isSafeInteger(file.cases[field]) && file.cases[field] >= 0), `Invalid cases: ${key}`);
      invariant(file.cases.failed === 0 && file.cases.total === file.cases.passed + file.cases.skipped + file.cases.pending, `Failed/inconsistent cases: ${key}`);
      files.set(key, { key, cases: stable(file.cases) });
    }
  }
  invariant(cacheStates.size === 1, 'Mixed cache hits/misses; analyze separately');
  // Memory is a separate observational sidecar. It never weakens PR1's gate
  // or changes the functional CI result, but missing/incomplete data cannot
  // become a valid promotion sample. UUID joins also reject stale artifacts
  // from a failed write or a second execution within the same run/attempt.
  invariant(Array.isArray(memoryReports) && memoryReports.length === reports.length, 'Missing/extra memory reports');
  const memoryIndexes = new Set();
  for (const memory of memoryReports) {
    const report = reports.find((candidate) => candidate.shard.index === memory.shard?.index);
    invariant(report && !memoryIndexes.has(memory.shard.index), 'Duplicate/unmatched memory shard');
    memoryIndexes.add(memory.shard.index);
    invariant(memory.schemaVersion === 1 && memory.sha === report.sha && JSON.stringify(stable(memory.run)) === JSON.stringify(stable(report.run)) && JSON.stringify(stable(memory.shard)) === JSON.stringify(stable(report.shard)), 'Memory SHA/run/attempt/shard mismatch');
    invariant(typeof report.memoryMeasurementId === 'string' && /^[0-9a-f-]{36}$/.test(report.memoryMeasurementId) && memory.measurementId === report.memoryMeasurementId, 'Memory measurement ID mismatch');
    invariant(JSON.stringify(stable(memory.method)) === JSON.stringify(stable(MEMORY_METHOD)), 'Unknown/mixed memory measurement method');
    invariant(memory.status === 'complete' && Array.isArray(memory.errors) && memory.errors.length === 0, 'Memory sensor incomplete/unavailable');
    invariant(memory.commandExit?.code === 0 && memory.commandExit.signal === null && memory.cancelledSignal === null && memory.cleanupRequired === false, 'Memory command failed/cancelled or leaked descendants');
    invariant(Number.isSafeInteger(memory.sampleCount) && memory.sampleCount >= 2 && Number.isSafeInteger(memory.peakRssBytes) && memory.peakRssBytes > 0 && Number.isSafeInteger(memory.peakProcessCount) && memory.peakProcessCount > 1, 'Missing/invalid memory samples or parent-only observation');
    for (const field of ['elapsedMs', 'samplingWallMs', 'maxSampleDurationMs', 'maxObservedGapMs', 'sensorCpuMicros', 'sensorMaxRssBytes', 'exitRaces']) invariant(Number.isFinite(memory[field]) && memory[field] >= 0, `Invalid memory ${field}`);
    invariant(memory.maxObservedGapMs <= MEMORY_METHOD.maxGapMs && memory.maxSampleDurationMs <= MEMORY_METHOD.maxSampleMs, 'Memory sampling budget/gap exceeded');
    invariant(memory.elapsedMs >= report.wallTimeMs && memory.elapsedMs > 0 && memory.samplingWallMs <= memory.elapsedMs, 'Memory observation window incomplete');
  }
  const memory = {
    method: MEMORY_METHOD,
    // Each shard has its own runner. This maximum is not a simultaneous
    // aggregate across runners, VM memory usage, or the account's peak.
    shardPeakRssMaxBytes: Math.max(...memoryReports.map((item) => item.peakRssBytes)),
    shards: memoryReports.map((item) => ({ index: item.shard.index, peakRssBytes: item.peakRssBytes, sampleCount: item.sampleCount, peakProcessCount: item.peakProcessCount, samplingWallMs: item.samplingWallMs, sensorCpuMicros: item.sensorCpuMicros, sensorMaxRssBytes: item.sensorMaxRssBytes, maxObservedGapMs: item.maxObservedGapMs, exitRaces: item.exitRaces })).sort((a, b) => a.index - b.index),
  };
  const aggregators = ci.jobs.filter((job) => job.name === 'CI Success (aggregator)');
  invariant(aggregators.length === 1 && !aggregators[0].skipped, 'Missing/skipped CI Success (aggregator)');
  const shardJobs = ci.jobs.filter((job) => /^Vitest shard \d+\/\d+$/.test(job.name));
  invariant(shardJobs.length === plan.count && shardJobs.every((job) => !job.skipped), 'Missing/skipped Actions shard jobs');
  for (let i = 1; i <= plan.count; i += 1) invariant(shardJobs.some((job) => job.name === `Vitest shard ${i}/${plan.count}`), `Missing Actions shard ${i}/${plan.count}`);
  const rawShardJobs = jobsFromPayload(runs.find(({ run }) => run.name === 'CI').jobs).filter((job) => /^Vitest shard \d+\/\d+$/.test(job.name));
  const runnerLabels = rawShardJobs.map((job) => {
    invariant(Array.isArray(job.labels) && job.labels.length > 0 && job.labels.every((label) => typeof label === 'string'), 'Missing runner labels');
    return [...job.labels].sort();
  });
  invariant(runnerLabels.every((labels) => JSON.stringify(labels) === JSON.stringify(runnerLabels[0])), 'Mixed runner labels');
  const coverageFingerprint = hash([...files.values()].sort((a, b) => a.key.localeCompare(b.key)));
  const cacheClass = [...cacheStates][0] ? 'node-modules-exact-hit' : 'node-modules-miss';
  const comparisonContext = {
    sha: ci.sha, treeDigest: digest, environment, runnerLabels: runnerLabels[0], cacheClass, cacheRef: ci.ref, loadClass,
    parallelism: plan.maxParallel === plan.count ? 'full-matrix' : `capped-${plan.maxParallel}`,
    expectedWorkflows: [...expectedWorkflows].sort(), coverageFingerprint, memoryMethod: MEMORY_METHOD,
  };
  const created = Math.min(...workflows.map((run) => run.createdAt));
  const completed = Math.max(...workflows.map((run) => run.completedAt));
  const dispatchSpreadSeconds = (Math.max(...workflows.map((run) => run.createdAt)) - created) / 1000;
  invariant(dispatchSpreadSeconds <= 60, 'Declared check set was not dispatched within the same 60-second observation window');
  return {
    label, shardCount: plan.count, maxParallel: plan.maxParallel, comparisonKey: hash(comparisonContext), comparisonContext,
    runIds: workflows.map((run) => run.runId), fileCount: files.size,
    cases: [...files.values()].reduce((sum, file) => sum + file.cases.total, 0),
    ciLatencySeconds: ci.latencySeconds,
    checkSetLatencySeconds: seconds(created, completed, 'check set'), dispatchSpreadSeconds,
    runnerSeconds: workflows.reduce((sum, run) => sum + run.runnerSeconds, 0),
    createdToStartP95Seconds: Math.max(...workflows.map((run) => run.createdToStartP95Seconds)),
    shardWallMaxSeconds: Math.max(...shardTimings),
    peakObservedCheckSetJobs: peakConcurrentJobs(runs.flatMap(({ jobs }) => jobsFromPayload(jobs))),
    memory, shardPeakRssMaxBytes: memory.shardPeakRssMaxBytes, workflows,
  };
}

export function compareSamples(samples) {
  invariant(samples.length > 0, 'No valid samples');
  const labels = new Set();
  const runIds = new Set();
  for (const sample of samples) {
    invariant(!labels.has(sample.label), 'Duplicate sample label'); labels.add(sample.label);
    for (const id of sample.runIds) { invariant(!runIds.has(id), `Run reused as independent sample: ${id}`); runIds.add(id); }
  }
  const groups = Map.groupBy(samples, (sample) => sample.comparisonKey);
  return [...groups.values()].map((group) => {
    const configurations = {};
    for (const count of [5, 8]) {
      const selected = group.filter((sample) => sample.shardCount === count);
      if (!selected.length) continue;
      const stats = { n: selected.length };
      for (const metric of ['ciLatencySeconds', 'checkSetLatencySeconds', 'runnerSeconds', 'createdToStartP95Seconds', 'shardPeakRssMaxBytes']) {
        stats[metric] = { p50: percentile(selected.map((sample) => sample[metric]), 0.5), p95: percentile(selected.map((sample) => sample[metric]), 0.95) };
      }
      configurations[count] = stats;
    }
    const five = configurations[5]; const eight = configurations[8];
    const thresholds = five && eight ? {
      minimumTenPerConfiguration: five.n >= 10 && eight.n >= 10,
      ciP50Improves15Percent: eight.ciLatencySeconds.p50 <= five.ciLatencySeconds.p50 * 0.85,
      checkSetP95Within5Percent: eight.checkSetLatencySeconds.p95 <= five.checkSetLatencySeconds.p95 * 1.05,
      runnerSecondsP50Within10Percent: eight.runnerSeconds.p50 <= five.runnerSeconds.p50 * 1.1,
      jobCreatedToStartP95Within10Seconds: eight.createdToStartP95Seconds.p95 <= five.createdToStartP95Seconds.p95 + 10,
    } : null;
    return {
      context: group[0].comparisonContext, configurations, thresholds,
      preliminaryThresholdsMet: thresholds !== null && Object.values(thresholds).every(Boolean),
      // Measurement never changes the CI default, approves more consumption, or
      // establishes account-wide capacity/coverage of undeclared workflows.
      automaticPromotion: false,
      scope: group[0].comparisonContext.expectedWorkflows.length === 1 ? 'CI-only' : 'declared-check-set',
    };
  });
}

async function main(manifestPath) {
  invariant(manifestPath, 'Usage: node scripts/ci/benchmark-ci-shards.mjs MANIFEST.json');
  const base = dirname(resolve(manifestPath));
  const read = (file) => JSON.parse(readFileSync(resolve(base, file), 'utf8'));
  const manifest = read(manifestPath.startsWith('/') ? manifestPath : resolve(manifestPath));
  invariant(manifest.schemaVersion === 1 && Array.isArray(manifest.samples), 'Invalid benchmark manifest');
  const { validateEvidence } = await import('./verify-test-evidence.mjs');
  const results = []; const rejected = [];
  for (const sample of manifest.samples) {
    try {
      const evidenceDir = resolve(base, sample.evidenceDir);
      const catalog = JSON.parse(readFileSync(resolve(evidenceDir, 'inventory.json'), 'utf8'));
      const reports = readdirSync(evidenceDir).filter((name) => /^vitest-shard-\d+-of-\d+\.json$/.test(name)).map((name) => JSON.parse(readFileSync(resolve(evidenceDir, name), 'utf8')));
      const memoryReports = readdirSync(evidenceDir).filter((name) => /^vitest-memory-\d+-of-\d+\.json$/.test(name)).map((name) => JSON.parse(readFileSync(resolve(evidenceDir, name), 'utf8')));
      validateEvidence(catalog, reports, sample.shardCount);
      results.push(summarizeSample({ ...sample, reports, memoryReports, runs: sample.runs.map((entry) => ({ run: read(entry.run), jobs: read(entry.jobs) })) }));
    } catch (error) { rejected.push({ label: sample.label, reason: error.message }); }
  }
  console.log(JSON.stringify({ schemaVersion: 1, source: 'GitHub Actions evidence', samples: results, rejected, comparisons: results.length ? compareSamples(results) : [], caveats: [
    'created_to_start includes scheduling and matrix admission; it is not pure runner queue.',
    'Runner seconds are measured occupancy, not billed minutes or money.',
    'A node_modules miss does not prove a cold Bun download cache.',
    'loadClass is an operator observation; account-wide headroom needs separate verification.',
    'Runtime/cache/runner comparability is enforced only for Vitest shards. CI non-shard jobs and companion workflows require separate environment/cache confirmation; CI/check-set comparisons remain observational until then.',
    'No automatic promotion; validate reliability, memory, shared load and applicable checks before changing defaults.',
    'Memory is sampled RSS summed over discovered command descendants, excluding the sensor. Shared pages can be counted repeatedly; short-lived processes and brief peaks can be missed. Per-shard maxima are not a simultaneous account/VM peak.',
  ] }, null, 2));
  if (rejected.length || !results.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
