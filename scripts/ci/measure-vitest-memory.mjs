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
  metric: 'discovered-process-tree-rss-sum-sampled', version: 4,
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
    let rssBytes = 0; let processCount = 0; let taskCount = 0; let exitRaces = 0;
    let exitVerificationCount = 0; let exitVerificationWallMs = 0; let lastExitVerification = null;
    const checkBudget = () => {
      if (now() - started > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
    };
    const readIdentity = (file, expectedPid) => {
      checkBudget();
      const raw = read(file, 'utf8');
      const pid = raw.slice(0, raw.indexOf('(')).trim();
      if (!/^\d+$/.test(pid) || !positive(Number(pid)) || Number(pid) !== expectedPid) throw sensorError('INVALID_PROC_STAT');
      return { raw, identity: parseIdentity(raw) };
    };
    const readGroupIdentity = (pid, expectedStart) => {
      const { identity } = readIdentity(`/proc/${pid}/stat`, pid);
      if (identity.start !== expectedStart) throw sensorError('PID_REUSED');
      return identity;
    };
    const statusRss = (status, pid, tid = pid) => {
      const lines = status.split('\n');
      for (const [field, expected] of [['Tgid', pid], ['Pid', tid]]) {
        const values = lines.filter((line) => line.startsWith(`${field}:`));
        const match = values.length === 1 && new RegExp(`^${field}:[ \\t]+(\\d+)[ \\t]*$`).exec(values[0]);
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
      const tids = list(`/proc/${pid}/task`).filter((tid) => /^\d+$/.test(tid));
      taskCount += tids.length;
      if (taskCount > MEMORY_METHOD.maxTasks) throw sensorError('TASK_BUDGET_EXCEEDED');
      return tids;
    };
    const confirmExit = (pid, expectedStart) => {
      const begin = now();
      const trace = [];
      const result = (outcome) => {
        const elapsedMs = now() - begin;
        if (outcome === 'terminal' || outcome === 'gone') {
          checkBudget();
          if (elapsedMs > MEMORY_METHOD.exitVerificationMs) throw sensorError('MISSING_RSS');
        }
        return { outcome, elapsedMs, checks: trace.length, trace };
      };
      let outcome = 'read-error';
      try {
        for (let check = 0; check < MEMORY_METHOD.exitMaxChecks; check++) {
          checkBudget();
          if (now() - begin > MEMORY_METHOD.exitVerificationMs) { outcome = 'unconfirmed'; throw sensorError('MISSING_RSS'); }
          let raw; let identity;
          try { ({ raw, identity } = readIdentity(`/proc/${pid}/stat`, pid)); }
          catch (error) { if (gone(error)) return result('gone'); throw error; }
          // Without a previously observed generation an earlier missing stat
          // cannot be reconciled with a process that has appeared meanwhile.
          if (expectedStart == null) { outcome = 'unconfirmed'; throw sensorError('MISSING_RSS'); }
          if (identity.start !== expectedStart) { outcome = 'pid-reused'; throw sensorError('PID_REUSED'); }
          const flags = Number(raw.slice(raw.lastIndexOf(')') + 2).trim().split(/\s+/)[6]);
          if (!Number.isSafeInteger(flags) || flags < 0) throw sensorError('INVALID_PROC_STAT');
          const point = { atMs: now() - begin, state: identity.state, exitFlag: Boolean(flags & 4), nonTerminalTasks: null, stableTasks: null };
          trace.push(point);
          if (terminal(identity.state)) {
            // A zombie leader can have live threads. Verify the entire TGID,
            // re-enumerate it, then recheck every remaining task and TGID identity.
            const identities = new Map(); const liveTasks = new Set();
            let first = []; let second = []; let enumerated = true;
            try {
              first = tasks(pid);
              // An empty/partially vanished task directory does not establish
              // that a zombie leader's whole group has finished.
              if (!first.length) enumerated = false;
              for (const tid of first) {
                const task = Number(tid) === pid ? identity : readIdentity(`/proc/${pid}/task/${tid}/stat`, Number(tid)).identity;
                identities.set(tid, task.start);
                if (!terminal(task.state)) liveTasks.add(tid);
              }
              second = tasks(pid);
              if (!second.length) enumerated = false;
              for (const tid of second) {
                const task = readIdentity(Number(tid) === pid ? `/proc/${pid}/stat` : `/proc/${pid}/task/${tid}/stat`, Number(tid)).identity;
                if (identities.has(tid) && task.start !== identities.get(tid)) { outcome = 'pid-reused'; throw sensorError('PID_REUSED'); }
                if (!terminal(task.state)) liveTasks.add(tid);
              }
            } catch (error) { if (!gone(error)) throw error; enumerated = false; }
            let finalIdentity;
            try { finalIdentity = readGroupIdentity(pid, expectedStart); }
            catch (error) { if (gone(error)) return result('gone'); throw error; }
            if (enumerated) {
              // Publish both counters only after the entire enumeration and
              // identity recheck completed; unknown must remain null.
              point.nonTerminalTasks = liveTasks.size;
              point.stableTasks = first.length === second.length && second.every((tid) => identities.has(tid));
            }
            checkBudget();
            if (now() - begin <= MEMORY_METHOD.exitVerificationMs && terminal(finalIdentity.state) && point.nonTerminalTasks === 0 && point.stableTasks === true) return result('terminal');
          }
          const remaining = Math.min(MEMORY_METHOD.exitVerificationMs - (now() - begin), MEMORY_METHOD.maxSampleMs - (now() - started));
          if (remaining <= 0) break;
          pause(Math.min(MEMORY_METHOD.exitPollMs, remaining));
        }
        outcome = 'unconfirmed';
        throw sensorError('MISSING_RSS');
      } catch (error) {
        // Missing task paths alone never prove TGID exit: recheck its identity.
        if (gone(error)) {
          try {
            if (readIdentity(`/proc/${pid}/stat`, pid).identity.start !== expectedStart) { outcome = 'pid-reused'; error = sensorError('PID_REUSED'); }
            else error = sensorError('MISSING_RSS');
          } catch (again) { if (gone(again)) return result('gone'); error = again; }
        }
        if (error.code === 'MISSING_RSS') outcome = 'unconfirmed';
        if (error.code === 'PID_REUSED') outcome = 'pid-reused';
        exitDiagnostics.set(error, result(outcome));
        throw error;
      }
    };
    const removeVerifiedExit = (pid, expectedStart) => {
      const diagnostic = confirmExit(pid, expectedStart);
      known.delete(pid); exitRaces++; exitVerificationCount++;
      exitVerificationWallMs += diagnostic.elapsedMs; lastExitVerification = diagnostic;
    };
    for (let cursor = 0; cursor < queue.length; cursor++) {
      if (now() - started > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
      const pid = queue[cursor];
      if (seen.has(pid)) continue;
      seen.add(pid);
      if (seen.size > MEMORY_METHOD.maxProcesses) throw sensorError('PROCESS_BUDGET_EXCEEDED');
      let identity;
      try {
        ({ identity } = readIdentity(`/proc/${pid}/stat`, pid));
        const previous = known.get(pid);
        if (pid === rootPid && previous === null && identity.parent !== process.pid) throw sensorError('UNVERIFIED_ROOT');
        if (previous !== undefined && previous !== null && previous !== identity.start) throw sensorError('PID_REUSED');
        // Newly discovered PIDs must still belong to the observed tree.
        if (previous === undefined && !known.has(identity.parent)) throw sensorError('UNVERIFIED_DESCENDANT');
        known.set(pid, identity.start);
        const status = read(`/proc/${pid}/status`, 'utf8');
        let rss = statusRss(status, pid);
        // Read all threads' children: a worker spawned by a non-main thread
        // would be missed by reading only /proc/PID/task/PID/children.
        let tids = tasks(pid);
        if (!tids.length) { removeVerifiedExit(pid, identity.start); continue; }
        const taskGenerations = new Map();
        const discoverChildren = (current, verifyTasks) => {
          const descendantGenerations = new Map(); const newDescendants = new Set();
          if (verifyTasks) readGroupIdentity(pid, identity.start);
          for (const tid of current) {
            checkBudget();
            const file = `/proc/${pid}/task/${tid}`;
            let before;
            if (verifyTasks) {
              before = readIdentity(`${file}/stat`, Number(tid)).identity;
              if ((Number(tid) === pid && before.start !== identity.start)
                || (taskGenerations.has(tid) && before.start !== taskGenerations.get(tid))) throw sensorError('PID_REUSED');
            }
            let children;
            try { children = read(`${file}/children`, 'utf8').trim(); }
            catch (error) {
              if (!gone(error)) throw error;
              // A surviving task makes discovery unavailable. A vanished
              // task with uncaptured children cannot authorize partial RSS.
              try { readIdentity(`${file}/stat`, Number(tid)); }
              catch (taskError) { if (!gone(taskError)) throw taskError; throw error; }
              throw sensorError('CHILD_DISCOVERY_UNAVAILABLE');
            }
            const observedChildren = children ? children.split(/\s+/).map((token) => {
              const child = Number(token);
              if (!positive(child)) throw sensorError('INVALID_CHILD_PID');
              return child;
            }) : [];
            // Preserve tokens immediately, before any later identity guard
            // can fail. Otherwise a partial read could silently erase a child.
            for (const child of observedChildren) if (!seen.has(child)) queue.push(child);
            if (verifyTasks) {
              const after = readIdentity(`${file}/stat`, Number(tid)).identity;
              if (after.start !== before.start) throw sensorError('PID_REUSED');
              taskGenerations.set(tid, before.start);
            }
            for (const child of observedChildren) {
              if (verifyTasks) {
                // Capture the generation now, but authorize it only once the
                // parent's final generation check completes below.
                const descendant = readIdentity(`/proc/${child}/stat`, child).identity;
                const previousChild = descendantGenerations.get(child) ?? known.get(child);
                if (previousChild != null && previousChild !== descendant.start) throw sensorError('PID_REUSED');
                // Only this TGID is protected by the current before/after
                // generation checks. Another known parent may be pending or
                // already reused; it cannot authorize a first child identity.
                if (previousChild === undefined && descendant.parent !== pid) throw sensorError('UNVERIFIED_DESCENDANT');
                if (!known.has(child) && !newDescendants.has(child)) {
                  if (known.size + newDescendants.size >= MEMORY_METHOD.maxProcesses) throw sensorError('PROCESS_BUDGET_EXCEEDED');
                  newDescendants.add(child);
                }
                descendantGenerations.set(child, descendant.start);
              }
            }
          }
          if (verifyTasks) {
            try { readGroupIdentity(pid, identity.start); }
            catch (error) {
              if (gone(error) && newDescendants.size) throw sensorError('UNVERIFIED_DESCENDANT');
              throw error;
            }
            for (const [child, start] of descendantGenerations) known.set(child, start);
          }
        };
        if (rss === null || terminal(identity.state)) {
          rss = null;
          // Capture every enumerated task's descendants before a memory
          // representative can disappear, and guard those reads against reuse.
          discoverChildren(tids, true);
          const verifyTaskGone = (tid) => {
            readGroupIdentity(pid, identity.start);
            const requireAbsent = () => {
              let current;
              try { current = readIdentity(`/proc/${pid}/task/${tid}/stat`, Number(tid)).identity; }
              catch (error) { if (gone(error)) return; throw error; }
              if (current.start !== taskGenerations.get(tid)) throw sensorError('PID_REUSED');
              throw sensorError('MISSING_RSS');
            };
            requireAbsent();
            const current = tasks(pid);
            if (current.includes(tid)) throw sensorError('MISSING_RSS');
            // Reject a task that reappears after the enumeration too.
            requireAbsent();
            readGroupIdentity(pid, identity.start);
            // Revisit every survivor/new task: exited threads can transfer
            // children to another task, and a new task may have descendants.
            discoverChildren(current, true);
            exitRaces++;
            return current;
          };
          // A leader may have exited and relinquished its mm while another
          // task keeps the shared address space alive. Its status provides
          // process RSS once, never a per-thread value to add repeatedly.
          for (let taskCursor = 0; taskCursor < tids.length; taskCursor++) {
            const tid = tids[taskCursor];
            const file = `/proc/${pid}/task/${tid}`;
            readGroupIdentity(pid, identity.start);
            let candidate = null; let after;
            try {
              const before = readIdentity(`${file}/stat`, Number(tid)).identity;
              if (before.start !== taskGenerations.get(tid)) throw sensorError('PID_REUSED');
              if (!terminal(before.state)) {
                candidate = statusRss(read(`${file}/status`, 'utf8'), pid, Number(tid));
                after = readIdentity(`${file}/stat`, Number(tid)).identity;
                if (after.start !== before.start) throw sensorError('PID_REUSED');
              }
            } catch (error) {
              if (!gone(error)) throw error;
              tids = verifyTaskGone(tid);
              taskCursor = -1;
              continue;
            }
            readGroupIdentity(pid, identity.start);
            if (candidate !== null && after && !terminal(after.state)) { rss = candidate; break; }
          }
          if (rss === null) { removeVerifiedExit(pid, identity.start); continue; }
        } else discoverChildren(tids, false);
        // Recheck identity before counting: do not merge two generations of PID.
        readGroupIdentity(pid, identity.start);
        const totalRss = rssBytes + rss;
        if (!Number.isSafeInteger(totalRss)) throw sensorError('INVALID_RSS');
        rssBytes = totalRss; processCount++;
      } catch (error) {
        if (!gone(error)) throw error;
        // status/task/children disappearance alone never authorizes a partial
        // tree sum. Revalidate the TGID generation and whole-group exit first.
        removeVerifiedExit(pid, identity?.start ?? known.get(pid));
      }
    }
    const durationMs = now() - started;
    if (durationMs > MEMORY_METHOD.maxSampleMs) throw sensorError('SAMPLE_BUDGET_EXCEEDED');
    return { rssBytes, processCount, taskCount, exitRaces, durationMs, exitVerificationCount, exitVerificationWallMs, lastExitVerification };
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
