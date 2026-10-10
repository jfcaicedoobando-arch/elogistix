// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createShardPlan, planFromEnvironment, assessCapacity } from '../../../scripts/ci/vitest-shard-plan.mjs';
import { summarizeActionsRun, summarizeSample, compareSamples, jobsFromPayload, peakConcurrentJobs, percentile } from '../../../scripts/ci/benchmark-ci-shards.mjs';

import { MEMORY_METHOD } from '../../../scripts/ci/measure-vitest-memory.mjs';
import type { RecoveryDiagnostic } from '../../../scripts/ci/measure-vitest-memory.mjs';

const sha = 'a'.repeat(40);
const stamp = (seconds: number) => new Date(Date.UTC(2026, 9, 10, 12, 0, seconds)).toISOString();
function makeRun(count: number, id = count, duration = 100) {
  const run = { id, head_sha: sha, head_branch: 'benchmark', run_attempt: 1, status: 'completed', conclusion: 'success', name: 'CI', event: 'workflow_dispatch', created_at: stamp(0) };
  const jobs = Array.from({ length: count }, (_, index) => ({
    id: id * 100 + index, run_id: id, run_attempt: 1, head_sha: sha, status: 'completed', conclusion: 'success',
    name: `Vitest shard ${index + 1}/${count}`, labels: ['ubuntu-24.04'], created_at: stamp(1), started_at: stamp(3), completed_at: stamp(duration),
  }));
  return { run, jobs: { total_count: jobs.length, jobs } };
}
function makeSample(count: number, id = count) {
  const files = Array.from({ length: 40 }, (_, index) => ({ path: `src/a${index}.test.ts`, project: 'node', state: 'passed', cases: { total: 2, passed: 2, failed: 0, skipped: 0, pending: 0 }, retries: 0, flaky: 0 }));
  const environment = { node: '22.22.0', bun: '1.4.0', vitest: '5.0.3', platform: 'linux', arch: 'x64', runnerOS: 'Linux', runnerArch: 'X64', imageOS: 'ubuntu24', imageVersion: '20261001', lockDigest: 'b'.repeat(64), maxWorkers: 2, pool: 'forks', isolate: true };
  const primary = makeRun(count, id);
  primary.jobs.jobs.push({ ...primary.jobs.jobs[0], id: id * 100 + count, name: 'CI Success (aggregator)', started_at: stamp(100), completed_at: stamp(102) });
  primary.jobs.total_count++;
  const measurementId = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return {
    memoryReports: Array.from({ length: count }, (_, index) => ({ schemaVersion: 1, sha, measurementId: measurementId(index), run: { id: String(id), attempt: '1', event: 'workflow_dispatch' }, shard: { index: index + 1, total: count, maxParallel: count }, method: { ...MEMORY_METHOD }, status: 'complete', errors: [] as string[], commandExit: { code: 0, signal: null }, cancelledSignal: null, cleanupRequired: false, sampleCount: 361, peakRssBytes: 500_000_000, peakProcessCount: 4, elapsedMs: 91_000, samplingWallMs: 300, maxSampleDurationMs: 3, maxObservedGapMs: 260, sensorCpuMicros: 200_000, sensorMaxRssBytes: 40_000_000, exitRaces: 0, recoveryCount: 0, recoveryWallMs: 0, lastRecovery: null as RecoveryDiagnostic | null, exitVerificationCount: 0, exitVerificationWallMs: 0, lastExitVerification: null as null | { outcome: string; elapsedMs: number; checks: number; trace: unknown[] } })),
    label: `sample-${id}`, shardCount: count, maxParallel: count, loadClass: 'isolated', expectedWorkflows: ['CI'], runs: [primary],
    reports: Array.from({ length: count }, (_, index) => ({ schemaVersion: 1, sha, memoryMeasurementId: measurementId(index), treeDigest: 'catalog', status: 'passed', unhandledErrors: 0, run: { id: String(id), attempt: '1', event: 'workflow_dispatch' }, shard: { index: index + 1, total: count, maxParallel: count }, environment, cacheHit: true, wallTimeMs: 90_000, discovered: files.map(({ path, project }) => ({ path, project })), selected: files.filter((_, i) => i % count === index).map(({ path, project }) => ({ path, project })), files: files.filter((_, i) => i % count === index) })),
  };
}

describe('native shard plan', () => {
  it('retains five by default and generates all eight without duplicates', () => {
    expect(createShardPlan()).toEqual({ count: 5, maxParallel: 5, matrix: { shard: [1, 2, 3, 4, 5] } });
    expect(createShardPlan({ count: '8' }).matrix.shard).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it.each(['0', '-1', '6', '10', '12', '8; echo unsafe', ' 8', '08', '8.0', 'NaN'])('rejects unreviewed/invalid count %s', (count) => {
    expect(() => createShardPlan({ count })).toThrow();
  });
  it.each(['0', '-1', '9', '3.5', ' 3'])('rejects invalid max-parallel %s', (maxParallel) => {
    expect(() => createShardPlan({ count: 8, maxParallel })).toThrow();
  });
  it('dispatch can cap the matrix but PR/push overrides cannot promote eight', () => {
    expect(planFromEnvironment({ GITHUB_EVENT_NAME: 'workflow_dispatch', VITEST_SHARD_COUNT: '8', VITEST_MAX_PARALLEL: '3' }).maxParallel).toBe(3);
    expect(planFromEnvironment({ GITHUB_EVENT_NAME: 'pull_request', VITEST_SHARD_COUNT: '8' }).count).toBe(5);
  });
  it('accounts for other runs/workflows explicitly and never claims a global max-parallel', () => {
    expect(assessCapacity({ plans: [{ count: 8 }, { count: 8 }], otherJobs: 6 })).toMatchObject({ total: 22, budget: 20, fits: false });
    expect(assessCapacity({ plans: [{ count: 8, maxParallel: 3 }, { count: 8, maxParallel: 3 }], otherJobs: 14 })).toMatchObject({ total: 20, fits: true, headroom: 0 });
    expect(() => assessCapacity({ plans: [{ count: 8 }], otherJobs: -1 })).toThrow();
  });
});

describe('Actions measurement, separate from local diagnostics', () => {
  it('uses job completion, not mutable run.updated_at, and reports runner occupancy/wait separately', () => {
    const { run, jobs } = makeRun(5);
    const result = summarizeActionsRun({ ...run, updated_at: stamp(900) }, jobs);
    expect(result.latencySeconds).toBe(100);
    expect(result.runnerSeconds).toBe(485);
    expect(result.createdToStartP95Seconds).toBe(2);
    expect(result.peakObservedJobs).toBe(5);
  });
  it('does not double-count adjacent runner intervals', () => {
    expect(peakConcurrentJobs([{ started_at: stamp(1), completed_at: stamp(3) }, { started_at: stamp(3), completed_at: stamp(4) }])).toBe(1);
  });
  it('uses an interpolated median and nearest-rank p95 with explicit small-sample limitations', () => {
    expect(percentile([100, 10, 30, 20], 0.5)).toBe(25);
    expect(percentile([100, 10, 30, 20], 0.95)).toBe(100);
  });
  it('fails closed on partial or duplicated pagination', () => {
    const { jobs } = makeRun(5);
    expect(() => jobsFromPayload({ ...jobs, jobs: jobs.jobs.slice(0, 4) })).toThrow(/pagination/);
    expect(() => jobsFromPayload({ ...jobs, jobs: [jobs.jobs[0], ...jobs.jobs.slice(0, 4)] })).toThrow(/Duplicate/);
  });
  it('accepts complete paginated jobs exactly once', () => {
    const { jobs } = makeRun(5);
    expect(jobsFromPayload([{ total_count: 5, jobs: jobs.jobs.slice(0, 2) }, { total_count: 5, jobs: jobs.jobs.slice(2) }])).toHaveLength(5);
  });
  it.each(['failure', 'cancelled', 'timed_out', 'skipped'])('rejects %s workflow samples', (conclusion) => {
    const { run, jobs } = makeRun(5);
    expect(() => summarizeActionsRun({ ...run, conclusion }, jobs)).toThrow(/successfully/);
  });
  it('rejects reruns, mixed attempts/SHAs, pending jobs and missing timestamps', () => {
    const { run, jobs } = makeRun(5);
    expect(() => summarizeActionsRun({ ...run, run_attempt: 2 }, jobs)).toThrow(/Reruns/);
    for (const change of [{ run_attempt: 2 }, { head_sha: 'b'.repeat(40) }, { status: 'in_progress' }, { completed_at: null }]) {
      const altered = structuredClone(jobs);
      Object.assign(altered.jobs[0], change);
      expect(() => summarizeActionsRun(run, altered)).toThrow();
    }
  });
});

describe('comparable 5/8 evidence', () => {
  it('matches the complete per-file case contract across native partitions', () => {
    const five = summarizeSample(makeSample(5));
    const eight = summarizeSample(makeSample(8));
    expect(five.fileCount).toBe(40);
    expect(five.cases).toBe(80);
    expect(five.comparisonKey).toBe(eight.comparisonKey);
    const [result] = compareSamples([five, eight]);
    expect(result.configurations[5].n).toBe(1);
    expect(result.thresholds?.minimumTenPerConfiguration).toBe(false);
    expect(result.automaticPromotion).toBe(false);
    expect(result.scope).toBe('CI-only');
  });
  it('does not pool different SHAs, cache classes, load classes, runner images or bounded-parallelism experiments', () => {
    const baseline = summarizeSample(makeSample(5));
    for (const change of ['sha', 'cache', 'ref', 'runner-label', 'load', 'image', 'parallel', 'cases']) {
      const sample = makeSample(8);
      if (change === 'sha') {
        sample.runs[0].run.head_sha = 'b'.repeat(40);
        for (const job of sample.runs[0].jobs.jobs) job.head_sha = 'b'.repeat(40);
        for (const report of sample.reports) report.sha = 'b'.repeat(40);
        for (const report of sample.memoryReports) report.sha = 'b'.repeat(40);
      }
      if (change === 'ref') sample.runs[0].run.head_branch = 'other-ref';
      if (change === 'runner-label') for (const job of sample.runs[0].jobs.jobs) job.labels = ['other-runner'];
      if (change === 'cache') for (const report of sample.reports) report.cacheHit = false;
      if (change === 'load') sample.loadClass = 'shared-load';
      if (change === 'image') for (const report of sample.reports) report.environment.imageVersion = 'different';
      if (change === 'parallel') { sample.maxParallel = 3; for (const report of [...sample.reports, ...sample.memoryReports]) report.shard.maxParallel = 3; }
      if (change === 'cases') { sample.reports[0].files[0].cases.passed--; sample.reports[0].files[0].cases.skipped++; }
      expect(compareSamples([baseline, summarizeSample(sample)])).toHaveLength(2);
    }
  });
  it('rejects missing/duplicate coordinates, duplicate files and skipped/missing Actions shards', () => {
    for (const change of ['missing-report', 'duplicate-report', 'duplicate-file', 'missing-job', 'skipped-job']) {
      const sample = makeSample(5);
      if (change === 'missing-report') sample.reports.pop();
      if (change === 'duplicate-report') sample.reports[0] = sample.reports[1];
      if (change === 'duplicate-file') sample.reports[0].files.push(sample.reports[1].files[0]);
      if (change === 'missing-job') sample.runs[0].jobs.jobs[0].name = 'something else';
      if (change === 'skipped-job') sample.runs[0].jobs.jobs[0].conclusion = 'skipped';
      expect(() => summarizeSample(sample)).toThrow();
    }
  });
  it('does not bless cache uncertainty, retries, failures or altered worker/isolation settings', () => {
    for (const change of ['cache', 'retry', 'failure', 'workers', 'runtime', 'run', 'parallel']) {
      const sample = makeSample(5);
      if (change === 'cache') sample.reports[0].cacheHit = false;
      if (change === 'retry') sample.reports[0].files[0].retries = 1;
      if (change === 'failure') sample.reports[0].files[0].cases.failed = 1;
      if (change === 'run') sample.reports[0].run.id = 'other-run';
      if (change === 'parallel') sample.reports[0].shard.maxParallel = 3;
      if (change === 'workers') for (const report of sample.reports) report.environment.maxWorkers = 4;
      if (change === 'runtime') for (const report of sample.reports) report.environment.node = '';
      expect(() => summarizeSample(sample)).toThrow();
    }
  });
  it('requires the declared workflow set and does not call CI-only a full check set', () => {
    const sample = makeSample(5);
    sample.expectedWorkflows.push('rls-tests');
    expect(() => summarizeSample(sample)).toThrow(/Missing/);
    const companion = makeRun(1, 100, 150);
    companion.run.name = 'rls-tests';
    companion.jobs.jobs[0].name = 'RLS tests result';
    sample.runs.push(companion);
    const result = summarizeSample(sample);
    expect(result.ciLatencySeconds).toBe(102);
    expect(result.checkSetLatencySeconds).toBe(150);
    expect(compareSamples([result])[0].scope).toBe('declared-check-set');
  });
  it('does not count duplicated runs or labels as repeated experiments', () => {
    const sample = summarizeSample(makeSample(5));
    expect(() => compareSamples([sample, sample])).toThrow(/Duplicate sample/);
    expect(() => compareSamples([sample, { ...sample, label: 'different' }])).toThrow(/Run reused/);
  });
});


describe('memory evidence required for promotion samples, independent from functional CI', () => {
  it('requires the bounded complete observation recovery method 5', () => {
    expect(MEMORY_METHOD.version).toBe(5);
    expect(MEMORY_METHOD.exitVerificationMs).toBe(25);
    expect(MEMORY_METHOD.maxSampleMs).toBe(50);
    expect(summarizeSample(makeSample(5)).memory.method).toEqual(MEMORY_METHOD);
  });
  it.each([1, 2, 3, 4])('rejects preceding memory method version %i for promotion', (version) => {
    const sample = makeSample(5);
    sample.memoryReports[0].method.version = version;
    expect(() => summarizeSample(sample)).toThrow(/Unknown\/mixed memory measurement method/);
  });
  it('accepts RSS recovery from a live thread without declaring a process exit', () => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    memory.recoveryCount = 1; memory.recoveryWallMs = 2;
    memory.lastRecovery = { outcome: 'rss-recovered', elapsedMs: 2, checks: 1, initialPhase: 'task-list', initialCause: 'EMPTY_TASK_LIST', rssAttempts: 2, trace: [{ atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: 1, stableTasks: true }] };
    const result = summarizeSample(sample);
    expect(result.memory.shards[0]).toMatchObject({ recoveryCount: 1, recoveryWallMs: 2, exitVerificationCount: 0, exitRaces: 0 });
  });
  it.each(['missing-count', 'negative-time', 'unexpected', 'unknown', 'late', 'underreported-time', 'phase', 'cause', 'identifiers', 'zero-attempts', 'negative-attempts', 'too-many-attempts', 'unaccounted-attempts', 'too-many-checks', 'live-terminal', 'gone-without-verification', 'partial-tasks'])('rejects %s recovery evidence for promotion', (change) => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    memory.recoveryCount = 1; memory.recoveryWallMs = 2;
    memory.lastRecovery = { outcome: 'rss-recovered', elapsedMs: 2, checks: 1, initialPhase: 'group-status', initialCause: 'ENOENT', rssAttempts: 1, trace: [{ atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: 1, stableTasks: true }] };
    const recovery = memory.lastRecovery;
    if (change === 'missing-count') memory.recoveryCount = undefined as unknown as number;
    if (change === 'negative-time') memory.recoveryWallMs = -1;
    if (change === 'unexpected') memory.recoveryCount = 0;
    if (change === 'unknown') recovery.outcome = 'unconfirmed';
    if (change === 'late') recovery.elapsedMs = 26;
    if (change === 'underreported-time') memory.recoveryWallMs = 1;
    if (change === 'phase') recovery.initialPhase = '/proc/100/status' as RecoveryDiagnostic['initialPhase'];
    if (change === 'cause') recovery.initialCause = 'arbitrary secret' as RecoveryDiagnostic['initialCause'];
    if (change === 'identifiers') Object.assign(recovery, { pid: 100 });
    if (change === 'zero-attempts') recovery.rssAttempts = 0;
    if (change === 'negative-attempts') recovery.rssAttempts = -1;
    if (change === 'too-many-attempts') recovery.rssAttempts = MEMORY_METHOD.exitMaxChecks + 2;
    if (change === 'unaccounted-attempts') recovery.rssAttempts = recovery.checks + 2;
    if (change === 'too-many-checks') { recovery.trace = Array(27).fill(recovery.trace[0]); recovery.checks = 27; }
    if (change === 'live-terminal') recovery.outcome = 'terminal';
    if (change === 'gone-without-verification') recovery.outcome = 'gone';
    if (change === 'partial-tasks') recovery.trace[0] = { atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: null, stableTasks: true } as unknown as RecoveryDiagnostic['trace'][number];
    expect(() => summarizeSample(sample)).toThrow(/[Mm]emory/);
  });
  it.each(['live-thread', 'live-leader', 'unstable', 'unknown-group', 'unknown-count', 'unknown-stability', 'empty', 'late', 'bad-state', 'underreported-time'])('rejects contradictory %s exit diagnostics', (change) => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    const point = { atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: 0 as number | null, stableTasks: true as boolean | null };
    memory.exitVerificationCount = 1; memory.exitVerificationWallMs = 2;
    memory.lastExitVerification = { outcome: 'terminal', elapsedMs: 2, checks: 1, trace: [point] };
    if (change === 'live-thread') point.nonTerminalTasks = 1;
    if (change === 'live-leader') point.state = 'R';
    if (change === 'unstable') point.stableTasks = false;
    if (change === 'unknown-group') { point.nonTerminalTasks = null; point.stableTasks = null; }
    if (change === 'unknown-count') point.nonTerminalTasks = null;
    if (change === 'unknown-stability') point.stableTasks = null;
    if (change === 'empty') { memory.lastExitVerification.trace = []; memory.lastExitVerification.checks = 0; }
    if (change === 'late') point.atMs = 3;
    if (change === 'bad-state') point.state = 'invalid';
    if (change === 'underreported-time') memory.exitVerificationWallMs = 0;
    expect(() => summarizeSample(sample)).toThrow(/[Mm]emory/);
  });
  it.each(['terminal', 'gone'])('accepts consistent %s confirmation diagnostics', (outcome) => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    memory.exitVerificationCount = 1; memory.exitVerificationWallMs = 2;
    memory.lastExitVerification = { outcome, elapsedMs: 2, checks: outcome === 'terminal' ? 1 : 0, trace: outcome === 'terminal' ? [{ atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: 0, stableTasks: true }] : [] };
    expect(summarizeSample(sample).memory.shards).toHaveLength(5);
  });
  it('preserves unknown task diagnostics before independently verified TGID disappearance', () => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    memory.exitVerificationCount = 1; memory.exitVerificationWallMs = 2;
    memory.lastExitVerification = { outcome: 'gone', elapsedMs: 2, checks: 1, trace: [{ atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: null, stableTasks: null }] };
    expect(summarizeSample(sample).memory.shards).toHaveLength(5);
  });
  it.each(['count', 'stability'])('rejects partially known %s diagnostics even when TGID later disappears', (unknown) => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    const point = { atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: unknown === 'count' ? null : 0, stableTasks: unknown === 'stability' ? null : true };
    memory.exitVerificationCount = 1; memory.exitVerificationWallMs = 2;
    memory.lastExitVerification = { outcome: 'gone', elapsedMs: 2, checks: 1, trace: [point] };
    expect(() => summarizeSample(sample)).toThrow(/Invalid memory task-group diagnostic/);
  });
  it('accepts initially unknown tasks when a later complete enumeration verifies terminal exit', () => {
    const sample = makeSample(5); const memory = sample.memoryReports[0];
    memory.exitVerificationCount = 1; memory.exitVerificationWallMs = 2;
    memory.lastExitVerification = { outcome: 'terminal', elapsedMs: 2, checks: 2, trace: [
      { atMs: 0, state: 'R', exitFlag: true, nonTerminalTasks: null, stableTasks: null },
      { atMs: 1, state: 'Z', exitFlag: true, nonTerminalTasks: 0, stableTasks: true },
    ] };
    expect(summarizeSample(sample).memory.shards).toHaveLength(5);
  });
  it.each(['peakRssBytes', 'peakProcessCount'])('rejects complete memory evidence with unknown %s', (field) => {
    const sample = makeSample(5);
    const memoryReports = sample.memoryReports.map((memory, index) => index === 0 ? { ...memory, [field]: null } : memory);
    expect(() => summarizeSample({ ...sample, memoryReports })).toThrow(/Missing\/invalid memory samples/);
  });
  it('summarizes the maximum observed shard RSS, never a sum of runner peaks', () => {
    const sample = makeSample(5);
    sample.memoryReports[2].peakRssBytes = 800_000_000;
    const result = summarizeSample(sample);
    expect(result.shardPeakRssMaxBytes).toBe(800_000_000);
    expect(result.memory.shards).toHaveLength(5);
    expect(compareSamples([result])[0].configurations[5].shardPeakRssMaxBytes).toEqual({ p50: 800_000_000, p95: 800_000_000 });
  });
  it.each(['missing', 'duplicate', 'unavailable', 'incomplete', 'running', 'errors', 'sha', 'attempt', 'run', 'shard', 'id', 'method', 'zero', 'parent-only', 'gap', 'duration', 'window', 'cancelled', 'leaked', 'pending-exit'])('rejects %s memory evidence', (change) => {
    const sample = makeSample(5);
    const memory = sample.memoryReports[0];
    if (change === 'missing') sample.memoryReports.pop();
    if (change === 'duplicate') sample.memoryReports[1] = memory;
    if (['unavailable', 'incomplete', 'running'].includes(change)) memory.status = change;
    if (change === 'errors') memory.errors.push('PROC_READ_FAILED');
    if (change === 'sha') memory.sha = 'b'.repeat(40);
    if (change === 'attempt') memory.run.attempt = '2';
    if (change === 'run') memory.run.id = 'other';
    if (change === 'shard') memory.shard.maxParallel = 3;
    if (change === 'id') memory.measurementId = 'different';
    if (change === 'method') memory.method.intervalMs = 500;
    if (change === 'zero') memory.sampleCount = 0;
    if (change === 'parent-only') memory.peakProcessCount = 1;
    if (change === 'gap') memory.maxObservedGapMs = 2000;
    if (change === 'duration') memory.maxSampleDurationMs = 100;
    if (change === 'window') memory.elapsedMs = 200;
    if (change === 'cancelled') memory.commandExit.code = 130;
    if (change === 'leaked') memory.cleanupRequired = true;
    if (change === 'pending-exit') { memory.exitVerificationCount = 1; memory.lastExitVerification = { outcome: 'unconfirmed', elapsedMs: 25, checks: 0, trace: [] }; }
    expect(() => summarizeSample(sample)).toThrow(/Memory|memory/);
  });
});
