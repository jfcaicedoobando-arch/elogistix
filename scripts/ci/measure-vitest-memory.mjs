#!/usr/bin/env node
/** Linux-only, bounded, sampled RSS of this command's discovered process tree.
 * No ps/name matching, environment/cmdline reads, dependencies or privileges.
 * This is NOT a continuous peak, unique physical memory, cgroup or VM usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { constants } from 'node:os';

export const MEMORY_METHOD = Object.freeze({
  metric: 'discovered-process-tree-rss-sum-sampled', version: 1,
  source: 'linux-proc-status-VmRSS', intervalMs: 250,
  maxGapMs: 1000, maxSampleMs: 50, maxProcesses: 512, maxTasks: 4096,
  scope: 'command-and-discovered-descendants-excluding-sensor',
});
const gone = (error) => ['ENOENT', 'ESRCH'].includes(error.code);
const sensorError = (code) => Object.assign(new Error(code), { code });
const positive = (value) => Number.isSafeInteger(value) && value > 0;

// Parse only identity fields, never retain the executable name or command line.
export function parseIdentity(stat) {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
  const identity = { parent: Number(fields[1]), start: fields[19], state: fields[0] };
  if (!Number.isSafeInteger(identity.parent) || !/^\d+$/.test(identity.start ?? '')) throw sensorError('INVALID_PROC_STAT');
  return identity;
}

/** Only visit descendants discovered through the command's task/children files.
 * Known descendants stay tracked after reparenting; start ticks prevent PID reuse.
 * Kernel counters and tree discovery are non-atomic and may miss short-lived forks.
 */
export function createTreeSampler(rootPid, { read = fs.readFileSync, list = fs.readdirSync, now = () => performance.now() } = {}) {
  const known = new Map([[rootPid, null]]);
  return () => {
    const started = now();
    const queue = [...known.keys()];
    const seen = new Set();
    let rssBytes = 0; let processCount = 0; let taskCount = 0; let exitRaces = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (now() - started > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
      const pid = queue[cursor];
      if (seen.has(pid)) continue;
      seen.add(pid);
      if (seen.size > MEMORY_METHOD.maxProcesses) throw sensorError('PROCESS_BUDGET_EXCEEDED');
      try {
        const identity = parseIdentity(read(`/proc/${pid}/stat`, 'utf8'));
        const previous = known.get(pid);
        if (pid === rootPid && previous === null && identity.parent !== process.pid) throw sensorError('UNVERIFIED_ROOT');
        if (previous !== undefined && previous !== null && previous !== identity.start) throw sensorError('PID_REUSED');
        // Newly discovered PIDs must still belong to the observed tree.
        if (previous === undefined && !known.has(identity.parent)) throw sensorError('UNVERIFIED_DESCENDANT');
        known.set(pid, identity.start);
        if (identity.state === 'Z' || identity.state === 'X') { known.delete(pid); continue; }
        const status = read(`/proc/${pid}/status`, 'utf8');
        const match = /^VmRSS:\s+(\d+) kB$/m.exec(status);
        if (!match) throw sensorError('MISSING_RSS');
        const rss = Number(match[1]) * 1024;
        if (!Number.isSafeInteger(rss) || rss < 0) throw sensorError('INVALID_RSS');
        // Read all threads' children: a worker spawned by a non-main thread
        // would be missed by reading only /proc/PID/task/PID/children.
        const tids = list(`/proc/${pid}/task`).filter((tid) => /^\d+$/.test(tid));
        if (!tids.length) throw sensorError('EMPTY_TASK_LIST');
        taskCount += tids.length;
        if (taskCount > MEMORY_METHOD.maxTasks) throw sensorError('TASK_BUDGET_EXCEEDED');
        for (const tid of tids) {
          if (now() - started > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
          try {
            const children = read(`/proc/${pid}/task/${tid}/children`, 'utf8').trim();
            if (children) for (const token of children.split(/\s+/)) {
              const child = Number(token);
              if (!positive(child)) throw sensorError('INVALID_CHILD_PID');
              if (!seen.has(child)) queue.push(child);
            }
          } catch (error) {
            if (!gone(error)) throw error;
            // Some container kernels omit task/children. ENOENT is an exit
            // race only if that task itself disappeared, otherwise discovery
            // is unavailable and counting just the parent would be dishonest.
            try { read(`/proc/${pid}/task/${tid}/stat`, 'utf8'); }
            catch (taskError) { if (!gone(taskError)) throw taskError; exitRaces++; continue; }
            throw sensorError('CHILD_DISCOVERY_UNAVAILABLE');
          }
        }
        // Recheck identity before counting: do not merge two generations of PID.
        if (parseIdentity(read(`/proc/${pid}/stat`, 'utf8')).start !== identity.start) throw sensorError('PID_REUSED');
        rssBytes += rss; processCount++;
      } catch (error) {
        if (!gone(error)) throw error;
        known.delete(pid); exitRaces++;
      }
    }
    const durationMs = now() - started;
    if (durationMs > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
    return { rssBytes, processCount, taskCount, exitRaces, durationMs };
  };
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
    fs.renameSync(temporary, file);
  } finally { try { fs.unlinkSync(temporary); } catch { /* already renamed/absent */ } }
}

/** Exported injection points are for tests; the CLI exposes no sensor overrides. */
export async function measureCommand(command, {
  env = process.env, platform = process.platform, samplerFactory = createTreeSampler,
  write = atomicWrite, now = () => performance.now(),
} = {}) {
  if (!Array.isArray(command) || !command.length || !command.every((part) => typeof part === 'string')) throw new Error('A command after -- is required');
  const [index, total] = (env.CI_TEST_SHARD ?? '').split('/').map(Number);
  const maxParallel = Number(env.CI_TEST_MAX_PARALLEL);
  const validShard = positive(index) && positive(total) && index <= total && positive(maxParallel) && maxParallel <= total;
  const measurementId = randomUUID();
  const output = validShard ? path.join(env.CI_EVIDENCE_DIR ?? 'reports/ci-evidence', `vitest-memory-${index}-of-${total}.json`) : null;
  const report = {
    schemaVersion: 1, measurementId, sha: env.GITHUB_SHA ?? null,
    run: { id: env.GITHUB_RUN_ID ?? null, attempt: env.GITHUB_RUN_ATTEMPT ?? null, event: env.GITHUB_EVENT_NAME ?? null },
    shard: { index, total, maxParallel }, method: MEMORY_METHOD,
    status: 'running', errors: [], sampleCount: 0, peakRssBytes: null,
    peakProcessCount: 0, exitRaces: 0, maxObservedGapMs: 0,
    samplingWallMs: 0, maxSampleDurationMs: 0, elapsedMs: 0,
    sensorCpuMicros: 0, sensorMaxRssBytes: null,
    commandExit: null, cancelledSignal: null, cleanupRequired: false,
    limits: ['Not a continuous peak; short-lived processes and between-sample peaks may be missed.',
      'RSS sums count shared pages more than once; proc RSS counters/tree reads are approximate and non-atomic.',
      'Excludes sensor, unrelated jobs, runner services and undiscovered/reparented descendants.'],
  };
  const fail = (code) => { if (!report.errors.includes(code)) report.errors.push(code); };
  const save = () => {
    if (!output) { fail('INVALID_SHARD_METADATA'); return; }
    try { write(output, report); } catch { fail('REPORT_WRITE_FAILED'); }
  };
  save(); // SIGKILL leaves running/missing evidence, never a fabricated complete.
  const started = now();
  const cpuStarted = process.cpuUsage();
  let timer; let cancellationTimer; let lastSampleAt = started; let sampler;
  let child; let launchError = null;
  const sample = () => {
    const at = now();
    report.maxObservedGapMs = Math.max(report.maxObservedGapMs, at - lastSampleAt);
    if (at - lastSampleAt > MEMORY_METHOD.maxGapMs) fail('SAMPLING_GAP_EXCEEDED');
    lastSampleAt = at;
    if (!sampler) return;
    try {
      const value = sampler();
      report.samplingWallMs += value.durationMs;
      report.maxSampleDurationMs = Math.max(report.maxSampleDurationMs, value.durationMs);
      report.exitRaces += value.exitRaces;
      if (value.processCount > 0) {
        report.sampleCount++;
        report.peakProcessCount = Math.max(report.peakProcessCount, value.processCount);
        report.peakRssBytes = Math.max(report.peakRssBytes ?? 0, value.rssBytes);
      }
      return value;
    } catch (error) {
      // No paths/messages: only a bounded, allowlisted sensor failure category.
      const allowed = ['SAMPLE_BUDGET_EXCEEDED', 'PROCESS_BUDGET_EXCEEDED', 'TASK_BUDGET_EXCEEDED', 'PID_REUSED', 'UNVERIFIED_ROOT', 'UNVERIFIED_DESCENDANT', 'EMPTY_TASK_LIST', 'CHILD_DISCOVERY_UNAVAILABLE', 'MISSING_RSS', 'INVALID_RSS', 'INVALID_PROC_STAT', 'INVALID_CHILD_PID'];
      fail(allowed.includes(error.code) ? error.code : 'PROC_READ_FAILED');
      sampler = null;
      clearInterval(timer);
    }
  };
  const forward = (signal) => {
    report.cancelledSignal ??= signal;
    try { if (child?.pid) process.kill(platform === 'linux' ? -child.pid : child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') fail('SIGNAL_FORWARD_FAILED'); }
    // A detached group must not outlive Actions' cancellation grace window.
    // Keep the received signal as the wrapper's final signal, even on escalation.
    if (!cancellationTimer) cancellationTimer = setTimeout(() => {
      try { if (child?.pid) process.kill(platform === 'linux' ? -child.pid : child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') fail('CLEANUP_FAILED'); }
    }, 1000);
  };
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [signal, () => forward(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  let exit;
  try {
    child = spawn(command[0], command.slice(1), { stdio: 'inherit', detached: platform === 'linux', env: { ...env, CI_MEMORY_MEASUREMENT_ID: measurementId } });
    if (report.cancelledSignal) forward(report.cancelledSignal);
    exit = await new Promise((resolve) => {
      child.once('error', (error) => { launchError = error.code === 'ENOENT' ? 127 : 126; });
      child.once('exit', (code, signal) => resolve({ code, signal }));
      child.once('close', (code, signal) => resolve({ code: launchError ?? code, signal }));
      if (child.pid && platform === 'linux') {
        try { sampler = samplerFactory(child.pid); } catch { fail('PROC_SETUP_FAILED'); }
        sample();
        if (sampler) timer = setInterval(sample, MEMORY_METHOD.intervalMs);
      } else fail(platform === 'linux' ? 'COMMAND_SPAWN_FAILED' : 'UNSUPPORTED_PLATFORM');
    });
    clearInterval(timer);
    clearTimeout(cancellationTimer);
    const finalSample = sample(); // includes previously observed/reparented descendants.
    if (finalSample?.processCount > 0) {
      // setsid/detached children can outlive their original process group.
      // The tree sampler still knows them; never certify a truncated window.
      report.cleanupRequired = true;
      fail('DESCENDANTS_AFTER_COMMAND_EXIT');
    }
    if (platform === 'linux' && child.pid) {
      try {
        process.kill(-child.pid, 0);
        report.cleanupRequired = true;
        fail('DESCENDANTS_AFTER_COMMAND_EXIT');
        process.kill(-child.pid, 'SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 250));
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') fail('CLEANUP_FAILED'); }
      } catch (error) { if (error.code !== 'ESRCH') fail('CLEANUP_FAILED'); }
    }
  } finally {
    clearInterval(timer);
    clearTimeout(cancellationTimer);
    for (const [signal, handler] of handlers) process.off(signal, handler);
  }
  report.elapsedMs = now() - started;
  const cpu = process.cpuUsage(cpuStarted);
  report.sensorCpuMicros = cpu.user + cpu.system;
  report.sensorMaxRssBytes = process.resourceUsage().maxRSS * 1024;
  report.commandExit = exit;
  if (!report.sampleCount || !(report.peakRssBytes > 0)) fail('NO_MEMORY_SAMPLES');
  report.status = report.errors.length || report.cancelledSignal || exit.signal || exit.code !== 0 ? (report.sampleCount ? 'incomplete' : 'unavailable') : 'complete';
  save();
  if (report.errors.length && report.status === 'complete') report.status = 'incomplete';
  if (report.errors.length) console.error(`Memory evidence ${report.status}: ${report.errors.join(', ')}`);
  return { ...exit, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] !== '--') { console.error('Usage: node scripts/ci/measure-vitest-memory.mjs -- COMMAND [ARGS...]'); process.exitCode = 2; }
  else measureCommand(process.argv.slice(3)).then(({ code, signal, report }) => {
    // Preserve cancellation even when a command traps a forwarded signal and exits 0.
    const terminalSignal = report.cancelledSignal ?? signal;
    if (['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGKILL'].includes(terminalSignal)) process.kill(process.pid, terminalSignal);
    // Node reserves/ignores some signals (notably USR1 starts the debugger).
    // For other child signals use the shell's 128+signal convention instead.
    else if (terminalSignal) process.exitCode = 128 + (constants.signals[terminalSignal] ?? 1);
    else process.exitCode = code ?? 1;
  }).catch(() => { console.error('Command wrapper failed'); process.exitCode = 1; });
}
