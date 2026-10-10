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
  metric: 'discovered-process-tree-rss-sum-sampled', version: 5,
  source: 'linux-proc-status-VmRSS', intervalMs: 250,
  maxGapMs: 1000, maxSampleMs: 50, maxProcesses: 512, maxTasks: 4096,
  exitVerificationMs: 25, exitPollMs: 1, exitMaxChecks: 26,
  scope: 'command-and-discovered-descendants-excluding-sensor',
});
const gone = (error) => ['ENOENT', 'ESRCH'].includes(error.code);
const sensorError = (code) => Object.assign(new Error(code), { code });
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const terminal = (state) => state === 'Z' || state === 'X';
const pauseWord = new Int32Array(new SharedArrayBuffer(4));
// Only diagnostics built here can cross into evidence, never arbitrary error
// fields/messages from an injected reader. No PIDs, names, paths or env values.
const exitDiagnostics = new WeakMap();
const recoveryDiagnostics = new WeakMap();

// Parse only identity fields, never retain the executable name or command line.
export function parseIdentity(stat) {
  const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
  const identity = { parent: Number(fields[1]), start: fields[19], state: fields[0] };
  if (!Number.isSafeInteger(identity.parent) || !/^\d+$/.test(identity.start ?? '') || !/^[RSDTtZXIP]$/.test(identity.state)) throw sensorError('INVALID_PROC_STAT');
  return identity;
}

/** Only visit descendants discovered through the command's task/children files.
 * Known descendants stay tracked after reparenting; start ticks prevent PID reuse.
 * Kernel counters and tree discovery are non-atomic and may miss short-lived forks.
 */
export function createTreeSampler(rootPid, { read = fs.readFileSync, list = fs.readdirSync, now = () => performance.now(), pause = (ms) => Atomics.wait(pauseWord, 0, 0, ms) } = {}) {
  const known = new Map([[rootPid, null]]);
  return () => {
    const started = now();
    const queue = [...known.keys()];
    const seen = new Set();
    const observedDescendantGenerations = new Map();
    const provisionalDescendants = new Set();
    let rssBytes = 0; let processCount = 0; let taskCount = 0; let exitRaces = 0;
    let exitVerificationCount = 0; let exitVerificationWallMs = 0; let lastExitVerification = null;
    let recoveryCount = 0; let recoveryWallMs = 0; let lastRecovery = null;
    let verificationBegin = null;
    const checkBudget = () => {
      const at = now();
      if (at - started > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
      if (verificationBegin !== null && at - verificationBegin > MEMORY_METHOD.exitVerificationMs) throw sensorError('MISSING_RSS');
    };
    const readIdentity = (file, expectedPid) => {
      checkBudget();
      const raw = read(file, 'utf8');
      const pid = raw.slice(0, raw.indexOf('(')).trim();
      if (!/^\d+$/.test(pid) || !positive(Number(pid)) || Number(pid) !== expectedPid) throw sensorError('INVALID_PROC_STAT');
      return { raw, identity: parseIdentity(raw) };
    };
    const readGroupIdentity = (pid, expectedStart) => {
      const { identity } = readIdentity('/proc/' + pid + '/stat', pid);
      if (identity.start !== expectedStart) throw sensorError('PID_REUSED');
      return identity;
    };
    const statusRss = (status, pid, tid = pid) => {
      const lines = status.split('\n');
      for (const [field, expected] of [['Tgid', pid], ['Pid', tid]]) {
        const values = lines.filter((line) => line.startsWith(field + ':'));
        const match = values.length === 1 && new RegExp('^' + field + ':[ \\t]+(\\d+)[ \\t]*$').exec(values[0]);
        if (!match || !positive(Number(match[1])) || Number(match[1]) !== expected) throw sensorError('INVALID_PROC_STATUS');
      }
      const values = lines.filter((line) => line.startsWith('VmRSS:'));
      if (!values.length) return null;
      const match = values.length === 1 && /^VmRSS:[ \t]+(\d+) kB[ \t]*$/.exec(values[0]);
      if (!match) throw sensorError('INVALID_RSS');
      const rss = Number(match[1]) * 1024;
      if (!Number.isSafeInteger(rss) || rss < 0) throw sensorError('INVALID_RSS');
      return rss;
    };
    const tasks = (pid) => {
      checkBudget();
      const tids = list('/proc/' + pid + '/task').filter((tid) => /^\d+$/.test(tid));
      taskCount += tids.length;
      if (taskCount > MEMORY_METHOD.maxTasks) throw sensorError('TASK_BUDGET_EXCEEDED');
      return tids;
    };
    const ambiguous = (error) => gone(error) || ['MISSING_RSS', 'EMPTY_TASK_LIST'].includes(error.code);
    // One window resolves a failed observation. Re-observation and exit checks
    // share its deadline and the original sample's process/task/time budgets.
    const resolveObservation = (pid, expectedStart, observe, initial, canRetire, capturedTask, missingCode) => {
      const begin = verificationBegin;
      const trace = []; let rssAttempts = 1;
      const result = (outcome, value) => {
        const elapsedMs = now() - begin;
        if (['rss-recovered', 'terminal', 'gone'].includes(outcome)) {
          checkBudget();
          if (elapsedMs > MEMORY_METHOD.exitVerificationMs) throw sensorError('MISSING_RSS');
        }
        return { outcome, elapsedMs, checks: trace.length, trace, ...initial, rssAttempts, ...(value === undefined ? {} : { value }) };
      };
      let outcome = 'read-error';
      try {
        for (let check = 0; check < MEMORY_METHOD.exitMaxChecks; check++) {
          checkBudget();
          let raw; let identity;
          try { ({ raw, identity } = readIdentity('/proc/' + pid + '/stat', pid)); }
          catch (error) { if (gone(error)) return result('gone'); throw error; }
          if (expectedStart() == null) { outcome = 'unconfirmed'; throw sensorError('MISSING_RSS'); }
          if (identity.start !== expectedStart()) { outcome = 'pid-reused'; throw sensorError('PID_REUSED'); }
          const flags = Number(raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/)[6]);
          if (!Number.isSafeInteger(flags) || flags < 0) throw sensorError('INVALID_PROC_STAT');
          const point = { atMs: now() - begin, state: identity.state, exitFlag: Boolean(flags & 4), nonTerminalTasks: null, stableTasks: null };
          trace.push(point);
          // A live TGID is not an exit. Retry actual RSS and complete discovery
          // before considering a whole-group terminal certificate.
          rssAttempts++;
          try { return result('rss-recovered', observe(true)); }
          catch (error) { if (!ambiguous(error)) throw error; }
          if (terminal(identity.state)) {
            const identities = new Map(); const liveTasks = new Set();
            let first = []; let second = []; let enumerated = true; let captured = true;
            try {
              first = tasks(pid);
              if (!first.length) enumerated = false;
              for (const tid of first) {
                capturedTask(tid);
                const task = Number(tid) === pid ? identity : readIdentity('/proc/' + pid + '/task/' + tid + '/stat', Number(tid)).identity;
                if (!capturedTask(tid, task)) captured = false;
                identities.set(tid, task.start);
                if (!terminal(task.state)) liveTasks.add(tid);
              }
              second = tasks(pid);
              if (!second.length) enumerated = false;
              for (const tid of second) {
                capturedTask(tid);
                const task = readIdentity(Number(tid) === pid ? '/proc/' + pid + '/stat' : '/proc/' + pid + '/task/' + tid + '/stat', Number(tid)).identity;
                if (!capturedTask(tid, task)) captured = false;
                if (identities.has(tid) && task.start !== identities.get(tid)) { outcome = 'pid-reused'; throw sensorError('PID_REUSED'); }
                if (!terminal(task.state)) liveTasks.add(tid);
              }
            } catch (error) { if (!gone(error)) throw error; enumerated = false; }
            let finalIdentity;
            try { finalIdentity = readGroupIdentity(pid, expectedStart()); }
            catch (error) { if (gone(error)) return result('gone'); throw error; }
            if (enumerated) {
              point.nonTerminalTasks = liveTasks.size;
              point.stableTasks = first.length === second.length && second.every((tid) => identities.has(tid));
            }
            checkBudget();
            if (captured && canRetire() && terminal(finalIdentity.state) && point.nonTerminalTasks === 0 && point.stableTasks === true) return result('terminal');
          }
          const remaining = Math.min(MEMORY_METHOD.exitVerificationMs - (now() - begin), MEMORY_METHOD.maxSampleMs - (now() - started));
          if (remaining <= 0) break;
          pause(Math.min(MEMORY_METHOD.exitPollMs, remaining));
        }
        outcome = 'unconfirmed';
        throw sensorError('MISSING_RSS');
      } catch (error) {
        if (error.code === 'MISSING_RSS') {
          outcome = 'unconfirmed';
          if (missingCode() !== 'MISSING_RSS') error = sensorError(missingCode());
        }
        if (error.code === 'PID_REUSED') outcome = 'pid-reused';
        const diagnostic = result(outcome);
        exitDiagnostics.set(error, diagnostic);
        recoveryDiagnostics.set(error, { count: recoveryCount + 1, wallMs: recoveryWallMs + diagnostic.elapsedMs, last: diagnostic });
        throw error;
      }
    };
    try {
    for (let cursor = 0; cursor < queue.length; cursor++) {
      checkBudget();
      const pid = queue[cursor];
      if (seen.has(pid)) continue;
      seen.add(pid);
      if (seen.size > MEMORY_METHOD.maxProcesses) throw sensorError('PROCESS_BUDGET_EXCEEDED');
      let expectedStart = known.get(pid); let identity; let phase = 'group-stat';
      let initialFailure = null;
      const startResolution = (error) => {
        if (initialFailure !== null) return;
        verificationBegin = now();
        initialFailure = { initialPhase: phase, initialCause: gone(error) ? error.code : error.code === 'EMPTY_TASK_LIST' ? 'EMPTY_TASK_LIST' : 'RSS_ABSENT' };
      };
      const taskGenerations = new Map();
      const uncapturedTasks = new Map();
      const unreadChildren = new Set();
      const pendingRepresentatives = new Map();
      const terminalTaskGenerations = new Map();
      const rememberTerminal = (tid, task) => { if (terminal(task.state)) terminalTaskGenerations.set(tid, task.start); };
      const capturedTask = (tid, task) => {
        const capturedStart = taskGenerations.get(tid);
        // An exit enumeration is not child discovery. Retain every new token
        // before its stat read, even when that read disappears immediately.
        if (capturedStart === undefined && !uncapturedTasks.has(tid)) uncapturedTasks.set(tid, null);
        if (task === undefined) return false;
        const expectedTask = capturedStart ?? uncapturedTasks.get(tid);
        if (expectedTask != null && expectedTask !== task.start) throw sensorError('PID_REUSED');
        rememberTerminal(tid, task);
        if (capturedStart === undefined) {
          uncapturedTasks.set(tid, task.start);
          return false;
        }
        return !uncapturedTasks.has(tid) && !unreadChildren.has(tid);
      };
      const observe = (retry) => {
        phase = 'group-stat';
        ({ identity } = readIdentity('/proc/' + pid + '/stat', pid));
        const previous = known.get(pid);
        if (pid === rootPid && previous === null && identity.parent !== process.pid) throw sensorError('UNVERIFIED_ROOT');
        if (expectedStart != null && expectedStart !== identity.start) throw sensorError('PID_REUSED');
        if (previous !== undefined && previous !== null && previous !== identity.start) throw sensorError('PID_REUSED');
        if (observedDescendantGenerations.has(pid) && observedDescendantGenerations.get(pid) !== identity.start) throw sensorError('PID_REUSED');
        if (previous === undefined && !known.has(identity.parent)) throw sensorError('UNVERIFIED_DESCENDANT');
        expectedStart = identity.start; known.set(pid, identity.start); provisionalDescendants.delete(pid);
        rememberTerminal(String(pid), identity);
        phase = 'group-status'; checkBudget();
        let rss = statusRss(read('/proc/' + pid + '/status', 'utf8'), pid);
        if (terminalTaskGenerations.get(String(pid)) === identity.start) rss = null;
        phase = 'task-list'; let tids = tasks(pid);
        if (!tids.length) throw sensorError('EMPTY_TASK_LIST');
        const discoverChildren = (current, verifyTasks) => {
          const descendantGenerations = new Map(); const newDescendants = new Set();
          const captured = new Map();
          if (verifyTasks) { phase = 'group-recheck'; readGroupIdentity(pid, identity.start); }
          // Preserve every enumerated task's capture obligation, including a
          // task whose first stat read has not yet provided a generation.
          for (const tid of current) if (!uncapturedTasks.has(tid)) {
            uncapturedTasks.set(tid, taskGenerations.get(tid) ?? (Number(tid) === pid ? identity.start : null));
          }
          for (const tid of current) {
            checkBudget();
            const file = '/proc/' + pid + '/task/' + tid;
            let before;
            if (verifyTasks) {
              phase = 'task-stat-before';
              before = readIdentity(file + '/stat', Number(tid)).identity;
              const expectedTask = uncapturedTasks.get(tid) ?? taskGenerations.get(tid);
              if ((Number(tid) === pid && before.start !== identity.start)
                || (expectedTask != null && before.start !== expectedTask)) throw sensorError('PID_REUSED');
              uncapturedTasks.set(tid, before.start);
              rememberTerminal(tid, before);
            }
            phase = 'task-children'; checkBudget();
            let children;
            try { children = read(file + '/children', 'utf8').trim(); }
            catch (error) {
              if (!gone(error)) throw error;
              unreadChildren.add(tid);
              // Missing children can be retried for this same task, but its
              // obligation survives if a later task list omits it.
              throw error;
            }
            const observedChildren = children ? children.split(/\s+/).map((token) => {
              const child = Number(token);
              if (!positive(child)) throw sensorError('INVALID_CHILD_PID');
              return child;
            }) : [];
            for (const child of observedChildren) if (!seen.has(child)) queue.push(child);
            if (verifyTasks) {
              phase = 'task-stat-after';
              const after = readIdentity(file + '/stat', Number(tid)).identity;
              if (after.start !== before.start) throw sensorError('PID_REUSED');
              rememberTerminal(tid, after);
              captured.set(tid, before.start);
            } else captured.set(tid, null);
            for (const child of observedChildren) {
              if (verifyTasks) {
                phase = 'child-stat';
                let descendant;
                try { descendant = readIdentity('/proc/' + child + '/stat', child).identity; }
                catch (error) {
                  if (!gone(error) || !retry) throw error;
                  // Verify the missing subject, never infer parent exit from a
                  // child's disappearance. Its token remains in the queue.
                  try { descendant = readIdentity('/proc/' + child + '/stat', child).identity; }
                  catch (again) { if (gone(again)) continue; throw again; }
                }
                const previousChild = observedDescendantGenerations.get(child) ?? known.get(child);
                if (previousChild != null && previousChild !== descendant.start) throw sensorError('PID_REUSED');
                // Only this TGID is protected by the current generation bracket.
                // A provisional generation from an incomplete earlier bracket
                // prevents reuse, but cannot authorize reparented ancestry.
                if (!known.has(child) && !descendantGenerations.has(child) && descendant.parent !== pid) throw sensorError('UNVERIFIED_DESCENDANT');
                if (!known.has(child) && !provisionalDescendants.has(child)) {
                  if (known.size + provisionalDescendants.size >= MEMORY_METHOD.maxProcesses) throw sensorError('PROCESS_BUDGET_EXCEEDED');
                  provisionalDescendants.add(child);
                }
                if (!known.has(child)) newDescendants.add(child);
                observedDescendantGenerations.set(child, descendant.start);
                descendantGenerations.set(child, descendant.start);
              }
            }
          }
          if (verifyTasks) {
            phase = 'group-recheck';
            try { readGroupIdentity(pid, identity.start); }
            catch (error) {
              if (gone(error) && newDescendants.size) throw sensorError('UNVERIFIED_DESCENDANT');
              throw error;
            }
            for (const [child, start] of descendantGenerations) {
              known.set(child, start); provisionalDescendants.delete(child);
            }
          }
          for (const [tid, start] of captured) {
            if (start !== null) taskGenerations.set(tid, start);
            uncapturedTasks.delete(tid); unreadChildren.delete(tid);
          }
        };
        if (rss === null || terminal(identity.state)) {
          rss = null;
          discoverChildren(tids, true);
          if (uncapturedTasks.size) { phase = 'rss-result'; throw sensorError('MISSING_RSS'); }
          const verifyTaskGone = (tid) => {
            phase = 'group-recheck'; readGroupIdentity(pid, identity.start);
            const requireAbsent = () => {
              let current;
              phase = 'representative-stat-after';
              try { current = readIdentity('/proc/' + pid + '/task/' + tid + '/stat', Number(tid)).identity; }
              catch (error) { if (gone(error)) return; throw error; }
              if (current.start !== (pendingRepresentatives.get(tid) ?? taskGenerations.get(tid))) throw sensorError('PID_REUSED');
              throw sensorError('MISSING_RSS');
            };
            requireAbsent();
            phase = 'task-list'; const current = tasks(pid);
            if (current.includes(tid)) throw sensorError('MISSING_RSS');
            requireAbsent();
            phase = 'group-recheck'; readGroupIdentity(pid, identity.start);
            discoverChildren(current, true);
            pendingRepresentatives.delete(tid);
            exitRaces++;
            return current;
          };
          // A retry must complete an earlier disappearance certificate; a
          // fresh task list cannot erase a representative that remains live.
          for (const tid of pendingRepresentatives.keys()) tids = verifyTaskGone(tid);
          for (let taskCursor = 0; taskCursor < tids.length; taskCursor++) {
            const tid = tids[taskCursor];
            const file = '/proc/' + pid + '/task/' + tid;
            phase = 'group-recheck'; readGroupIdentity(pid, identity.start);
            let candidate = null; let after;
            try {
              phase = 'representative-stat-before';
              const before = readIdentity(file + '/stat', Number(tid)).identity;
              if (before.start !== taskGenerations.get(tid)) throw sensorError('PID_REUSED');
              rememberTerminal(tid, before);
              if (!terminal(before.state) && terminalTaskGenerations.get(tid) !== before.start) {
                phase = 'representative-status'; checkBudget();
                candidate = statusRss(read(file + '/status', 'utf8'), pid, Number(tid));
                phase = 'representative-stat-after';
                after = readIdentity(file + '/stat', Number(tid)).identity;
                if (after.start !== before.start) throw sensorError('PID_REUSED');
                rememberTerminal(tid, after);
              }
            } catch (error) {
              if (!gone(error)) throw error;
              startResolution(error);
              pendingRepresentatives.set(tid, taskGenerations.get(tid));
              tids = verifyTaskGone(tid);
              taskCursor = -1;
              continue;
            }
            phase = 'group-recheck'; readGroupIdentity(pid, identity.start);
            if (candidate !== null && after && !terminal(after.state)) { rss = candidate; break; }
          }
        } else discoverChildren(tids, retry);
        phase = 'rss-result';
        if (rss === null || uncapturedTasks.size || pendingRepresentatives.size) throw sensorError('MISSING_RSS');
        phase = 'group-recheck'; readGroupIdentity(pid, identity.start);
        checkBudget();
        return rss;
      };
      let rss;
      try {
        rss = observe(false);
        if (initialFailure !== null) {
          checkBudget();
          const elapsedMs = now() - verificationBegin;
          if (elapsedMs > MEMORY_METHOD.exitVerificationMs) throw sensorError('MISSING_RSS');
          const diagnostic = { outcome: 'rss-recovered', elapsedMs, checks: 0, trace: [], ...initialFailure, rssAttempts: 1 };
          recoveryCount++; recoveryWallMs += diagnostic.elapsedMs; lastRecovery = diagnostic;
        }
      }
      catch (error) {
        if (!ambiguous(error)) {
          if (initialFailure !== null) {
            const diagnostic = { outcome: error.code === 'PID_REUSED' ? 'pid-reused' : 'read-error', elapsedMs: now() - verificationBegin, checks: 0, trace: [], ...initialFailure, rssAttempts: 1 };
            exitDiagnostics.set(error, diagnostic);
            recoveryDiagnostics.set(error, { count: recoveryCount + 1, wallMs: recoveryWallMs + diagnostic.elapsedMs, last: diagnostic });
          }
          throw error;
        }
        startResolution(error);
        const diagnostic = resolveObservation(pid, () => expectedStart, observe, initialFailure,
          () => uncapturedTasks.size === 0 && pendingRepresentatives.size === 0,
          capturedTask,
          () => unreadChildren.size ? 'CHILD_DISCOVERY_UNAVAILABLE' : 'MISSING_RSS');
        const { value, ...evidence } = diagnostic;
        recoveryCount++; recoveryWallMs += diagnostic.elapsedMs; lastRecovery = evidence;
        if (diagnostic.outcome === 'rss-recovered') {
          rss = value;
        } else {
          known.delete(pid); exitRaces++; exitVerificationCount++;
          exitVerificationWallMs += diagnostic.elapsedMs; lastExitVerification = evidence;
          continue;
        }
      } finally { verificationBegin = null; }
      const totalRss = rssBytes + rss;
      if (!Number.isSafeInteger(totalRss)) throw sensorError('INVALID_RSS');
      rssBytes = totalRss; processCount++;
    }
    const durationMs = now() - started;
    if (durationMs > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
    return { rssBytes, processCount, taskCount, exitRaces, durationMs, exitVerificationCount, exitVerificationWallMs, lastExitVerification, recoveryCount, recoveryWallMs, lastRecovery };
    } catch (error) {
      // Preserve completed windows if a later process or aggregate check fails.
      // A failed sample still never contributes its partial RSS to the report.
      if (lastRecovery && !recoveryDiagnostics.has(error)) {
        recoveryDiagnostics.set(error, { count: recoveryCount, wallMs: recoveryWallMs, last: lastRecovery });
      }
      throw error;
    }
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
    exitVerificationCount: 0, exitVerificationWallMs: 0, lastExitVerification: null,
    recoveryCount: 0, recoveryWallMs: 0, lastRecovery: null,
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
    // A sensor failure already invalidates the sample. Time after disabling
    // it is unobserved, not a new scheduling gap in an active sampler.
    if (!sampler) return;
    const at = now();
    report.maxObservedGapMs = Math.max(report.maxObservedGapMs, at - lastSampleAt);
    if (at - lastSampleAt > MEMORY_METHOD.maxGapMs) fail('SAMPLING_GAP_EXCEEDED');
    lastSampleAt = at;
    const sensingStarted = performance.now();
    try {
      const value = sampler();
      report.samplingWallMs += value.durationMs;
      report.maxSampleDurationMs = Math.max(report.maxSampleDurationMs, value.durationMs);
      report.exitRaces += value.exitRaces;
      report.exitVerificationCount += value.exitVerificationCount;
      report.exitVerificationWallMs += value.exitVerificationWallMs;
      if (value.lastExitVerification) report.lastExitVerification = value.lastExitVerification;
      report.recoveryCount += value.recoveryCount ?? 0;
      report.recoveryWallMs += value.recoveryWallMs ?? 0;
      if (value.lastRecovery) report.lastRecovery = value.lastRecovery;
      if (value.processCount > 0) {
        report.sampleCount++;
        report.peakProcessCount = Math.max(report.peakProcessCount, value.processCount);
        report.peakRssBytes = Math.max(report.peakRssBytes ?? 0, value.rssBytes);
      }
      return value;
    } catch (error) {
      const failedDuration = performance.now() - sensingStarted;
      report.samplingWallMs += failedDuration;
      report.maxSampleDurationMs = Math.max(report.maxSampleDurationMs, failedDuration);
      // No paths/messages: only a bounded, allowlisted sensor failure category.
      const allowed = ['SAMPLE_BUDGET_EXCEEDED', 'PROCESS_BUDGET_EXCEEDED', 'TASK_BUDGET_EXCEEDED', 'PID_REUSED', 'UNVERIFIED_ROOT', 'UNVERIFIED_DESCENDANT', 'EMPTY_TASK_LIST', 'CHILD_DISCOVERY_UNAVAILABLE', 'MISSING_RSS', 'INVALID_RSS', 'INVALID_PROC_STAT', 'INVALID_PROC_STATUS', 'INVALID_CHILD_PID'];
      fail(allowed.includes(error.code) ? error.code : 'PROC_READ_FAILED');
      const diagnostic = exitDiagnostics.get(error);
      if (diagnostic) {
        report.exitVerificationCount++;
        report.exitVerificationWallMs += diagnostic.elapsedMs;
        report.lastExitVerification = diagnostic;
      }
      const recovery = recoveryDiagnostics.get(error);
      if (recovery) {
        report.recoveryCount += recovery.count;
        report.recoveryWallMs += recovery.wallMs;
        report.lastRecovery = recovery.last;
      }
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
