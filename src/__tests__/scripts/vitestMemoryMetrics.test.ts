// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createTreeSampler, measureCommand, MEMORY_METHOD, parseIdentity, type ExitVerification, type RecoveryDiagnostic } from '../../../scripts/ci/measure-vitest-memory.mjs';

const directories: string[] = [];
const temporary = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-memory-')); directories.push(directory); return directory; };
const environment = (directory: string) => ({ ...process.env, CI_EVIDENCE_DIR: directory, CI_TEST_SHARD: '1/5', CI_TEST_MAX_PARALLEL: '5', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' });
const reportFile = (directory: string) => path.join(directory, 'vitest-memory-1-of-5.json');
const readReport = (directory: string) => JSON.parse(fs.readFileSync(reportFile(directory), 'utf8'));
const command = (code: string) => [process.execPath, '-e', code];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

function stat(parent: number, start: string, state = 'S', pid = 100) {
  const fields = Array(22).fill('0'); fields[0] = state; fields[1] = String(parent); fields[19] = start;
  return `${pid} (fixture ) name) ${fields.join(' ')}`;
}
function procStatus(pid: number, rss?: number | string, state = 'S', tgid = pid) {
  return `Tgid:\t${tgid}\nPid:\t${pid}\nState:\t${state}\n${rss === undefined ? 'VmSize: 0 kB' : `VmRSS: ${rss} kB`}`;
}
const procError = (code: string) => Object.assign(new Error(code), { code });
function fakeTree() {
  let clock = 0;
  const files: Record<string, string> = {
    '/proc/100/stat': stat(process.pid, '1000'), '/proc/100/status': procStatus(100, 10),
    '/proc/100/task/100/stat': stat(process.pid, '1000'), '/proc/100/task/102/stat': stat(process.pid, '1002', 'S', 102),
    '/proc/100/task/100/status': procStatus(100, 10), '/proc/100/task/102/status': procStatus(102, 10, 'S', 100),
    '/proc/100/task/100/children': '', '/proc/100/task/102/children': '101',
    '/proc/101/stat': stat(100, '1001', 'S', 101), '/proc/101/status': procStatus(101, 25),
    '/proc/101/task/101/stat': stat(100, '1001', 'S', 101), '/proc/101/task/101/status': procStatus(101, 25),
    '/proc/101/task/101/children': '',
  };
  // Linux exposes a live leader's same status through both paths. Keep the
  // fixture aliases together so a missing counter cannot be rescued by stale
  // test data for that same task.
  for (const pid of [100, 101]) Object.defineProperty(files, `/proc/${pid}/task/${pid}/status`, {
    configurable: true, enumerable: true,
    get: () => files[`/proc/${pid}/status`], set: (value: string) => { files[`/proc/${pid}/status`] = value; },
  });
  const reads: string[] = [];
  const read = (file: string) => { reads.push(file); if (!(file in files)) throw Object.assign(new Error('gone'), { code: 'ENOENT' }); return files[file]; };
  const list = (file: string) => file === '/proc/100/task' ? ['100', '102'] : ['101'];
  return { files, reads, read, list, now: () => clock, pause: (ms: number) => { clock += ms; } };
}
function survivingTree() {
  const fake = fakeTree();
  fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
  fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
  fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
  fake.files['/proc/100/task/103/stat'] = stat(process.pid, '1003', 'S', 103);
  fake.files['/proc/100/task/103/status'] = procStatus(103, 48 * 1024, 'S', 100);
  fake.files['/proc/100/task/103/children'] = '';
  const list = (file: string) => file === '/proc/100/task' ? ['100', '102', '103'] : fake.list(file);
  return { ...fake, list };
}
function pendingParentTree() {
  const fake = fakeTree();
  fake.files['/proc/100/task/100/children'] = '200';
  fake.files['/proc/100/task/102/children'] = '';
  fake.files['/proc/200/stat'] = stat(100, '1200', 'S', 200);
  fake.files['/proc/200/status'] = procStatus(200, 25);
  fake.files['/proc/200/task/200/children'] = '';
  const list = (file: string) => file === '/proc/200/task' ? ['200'] : fake.list(file);
  return { ...fake, list };
}
function recoveryTree() {
  const fake = fakeTree();
  fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
  fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
  fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
  fake.files['/proc/100/task/102/status'] = procStatus(102, 48 * 1024, 'S', 100);
  fake.files['/proc/100/task/102/children'] = '';
  return fake;
}

describe('job-scoped process tree sampling', () => {
  it('parses identity without retaining process names, and finds children of non-main threads', () => {
    expect(parseIdentity(stat(100, '456'))).toEqual({ parent: 100, start: '456', state: 'S' });
    const fake = fakeTree();
    expect(createTreeSampler(100, fake)()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2, taskCount: 3 });
    expect(fake.reads.every((file) => /^\/proc\/(100|101)\/(stat|status|task\/\d+\/(stat|status|children))$/.test(file))).toBe(true);
  });
  it('keeps observed orphans and rejects reused PIDs before counting their memory', () => {
    const fake = fakeTree(); const sample = createTreeSampler(100, fake);
    sample(); fake.files['/proc/101/stat'] = stat(1, '1001', 'S', 101); fake.files['/proc/100/task/102/children'] = '';
    expect(sample().processCount).toBe(2);
    fake.files['/proc/101/stat'] = stat(1, '2000', 'S', 101);
    expect(sample).toThrow('PID_REUSED');
  });
  it('rejects a reused/unrelated root before any RSS read and an empty live task list', () => {
    const fake = fakeTree(); fake.files['/proc/100/stat'] = stat(1, '1000');
    expect(createTreeSampler(100, fake)).toThrow('UNVERIFIED_ROOT');
    expect(fake.reads).toEqual(['/proc/100/stat']);
    fake.files['/proc/100/stat'] = stat(process.pid, '1000');
    expect(createTreeSampler(100, { ...fake, list: () => [] })).toThrow('MISSING_RSS');
  });
  it('treats process-exit races as explicit sampling limits and never fabricates zero measurements', () => {
    const fake = fakeTree(); delete fake.files['/proc/101/stat'];
    expect(createTreeSampler(100, fake)()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
  });
  it.each(['Z', 'X'])('verifies the same generation became %s when VmRSS disappears between stat and status', (state) => {
    const fake = fakeTree(); let childStatReads = 0;
    fake.files['/proc/101/status'] = procStatus(101, undefined, state);
    const read = (file: string) => {
      if (file === '/proc/101/stat') return stat(100, '1001', ++childStatReads === 1 ? 'S' : state, 101);
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
    expect(childStatReads).toBeGreaterThanOrEqual(4);
  });
  it.each(['ENOENT', 'ESRCH'])('handles verified disappearance %s during the missing-RSS recheck', (code) => {
    const fake = fakeTree(); let childStatReads = 0;
    fake.files['/proc/101/status'] = procStatus(101);
    const read = (file: string) => {
      if (file === '/proc/101/stat' && ++childStatReads >= 2) throw Object.assign(new Error('exited'), { code });
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
  });
  it.each(['live', 'reused-zombie', 'permission', 'invalid-stat'])('does not excuse missing RSS after a %s recheck', (change) => {
    const fake = fakeTree(); let childStatReads = 0;
    // Even a status that says zombie does not suffice without identity/state
    // verification from stat; malformed/inconsistent reads remain restrictive.
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'Z');
    const read = (file: string) => {
      if (file === '/proc/101/stat' && ++childStatReads === 2) {
        if (change === 'reused-zombie') return stat(100, '2000', 'Z', 101);
        if (change === 'permission') throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
        if (change === 'invalid-stat') return 'malformed';
      }
      return fake.read(file);
    };
    const expected = { live: 'MISSING_RSS', 'reused-zombie': 'PID_REUSED', permission: 'permission denied', 'invalid-stat': 'INVALID_PROC_STAT' }[change];
    expect(createTreeSampler(100, { ...fake, read })).toThrow(expected);
  });
  it('waits a bounded time for verified whole-process exit without publishing partial RSS', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = procStatus(101, undefined, 'R');
    const read = (file: string) => file === '/proc/101/stat' ? stat(100, '1001', fake.now() >= 3 ? 'Z' : 'R', 101) : fake.read(file);
    const result = createTreeSampler(100, { ...fake, read })();
    expect(result).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1, exitVerificationCount: 1, exitVerificationWallMs: 3 });
    expect(result.lastExitVerification).toMatchObject({ outcome: 'terminal', elapsedMs: 3, checks: 4 });
    expect(result.lastExitVerification?.trace.map((point) => point.state)).toEqual(['R', 'R', 'R', 'Z']);
  });
  it.each(['S', 'Z'])('does not discard a zombie leader while another thread is %s unless the entire group is terminal', (state) => {
    const fake = fakeTree(); fake.files['/proc/101/stat'] = stat(100, '1001', 'Z', 101);
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'Z');
    fake.files['/proc/101/task/101/stat'] = stat(100, '1001', 'Z', 101);
    fake.files['/proc/101/task/103/stat'] = stat(100, '1003', state, 103);
    fake.files['/proc/101/task/103/status'] = procStatus(103, undefined, state, 101);
    fake.files['/proc/101/task/103/children'] = '';
    const sample = createTreeSampler(100, { ...fake, list: (file) => file === '/proc/101/task' ? ['101', '103'] : fake.list(file) });
    if (state === 'S') { expect(sample).toThrow('MISSING_RSS'); expect(fake.now()).toBe(25); }
    else expect(sample()).toMatchObject({ processCount: 1, exitVerificationCount: 1, lastExitVerification: { outcome: 'terminal' } });
  });
  it('does not miss a live thread added between task enumerations', () => {
    const fake = fakeTree(); let lists = 0;
    fake.files['/proc/101/stat'] = stat(100, '1001', 'Z', 101);
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'Z');
    fake.files['/proc/101/task/101/stat'] = stat(100, '1001', 'Z', 101);
    fake.files['/proc/101/task/103/stat'] = stat(100, '1003', 'S', 103);
    fake.files['/proc/101/task/103/status'] = procStatus(103, undefined, 'S', 101);
    fake.files['/proc/101/task/103/children'] = '';
    // Initial RSS and its replay each enumerate once. Exit verification must
    // see the new task only in its second enumeration of the terminal group.
    const list = (file: string) => file === '/proc/101/task' ? (++lists <= 3 ? ['101'] : ['101', '103']) : fake.list(file);
    expect(createTreeSampler(100, { ...fake, list })).toThrow('MISSING_RSS');
    expect(lists).toBeGreaterThanOrEqual(4);
  });
  it('rejects a terminal task generation that changes after guarded discovery and before the exit certificate', () => {
    const fake = recoveryTree(); let taskReads = 0;
    fake.files['/proc/100/task/102/stat'] = stat(process.pid, '1002', 'Z', 102);
    const read = (file: string) => {
      // Initial observation: before/after children and candidate reads 1–3.
      // Replay: reads 4–6. The terminal certificate first sees generation 9002.
      if (file === '/proc/100/task/102/stat' && ++taskReads >= 7) return stat(process.pid, '9002', 'Z', 102);
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PID_REUSED');
    expect(taskReads).toBeGreaterThanOrEqual(7);
  });
  it.each(['recaptured', 'omitted', 'reused'])('preserves a newly observed terminal task capture obligation and its live child: %s', (change) => {
    const fake = recoveryTree(); let enumerations = 0;
    fake.files['/proc/100/task/102/stat'] = stat(process.pid, '1002', 'Z', 102);
    fake.files['/proc/100/task/103/stat'] = stat(process.pid, '1003', 'Z', 103);
    fake.files['/proc/100/task/103/status'] = procStatus(103, undefined, 'Z', 100);
    fake.files['/proc/100/task/103/children'] = '101';
    const list = (file: string) => {
      if (file !== '/proc/100/task') return fake.list(file);
      enumerations++;
      // The task first appears in the terminal certificate, after both
      // initial and replayed complete observations have discovered children.
      return enumerations <= 2 || (change === 'omitted' && enumerations >= 5) ? ['100', '102'] : ['100', '102', '103'];
    };
    const read = (file: string) => {
      if (change === 'reused' && file === '/proc/100/task/103/stat' && enumerations >= 5) return stat(process.pid, '9003', 'Z', 103);
      return fake.read(file);
    };
    const sample = createTreeSampler(100, { ...fake, list, read });
    if (change === 'recaptured') {
      expect(sample()).toMatchObject({ rssBytes: 25 * 1024, processCount: 1, exitVerificationCount: 1 });
      expect(fake.reads).toContain('/proc/100/task/103/children');
      expect(fake.reads).toContain('/proc/101/status');
    } else {
      expect(sample).toThrow(change === 'reused' ? 'PID_REUSED' : 'MISSING_RSS');
      expect(fake.reads).not.toContain('/proc/101/status');
      if (change === 'omitted') expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs);
    }
    expect(enumerations).toBeGreaterThanOrEqual(5);
  });
  it('rechecks TGID generation after the terminal task group was re-enumerated', () => {
    const fake = fakeTree(); let reads = 0;
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'Z');
    const read = (file: string) => file === '/proc/101/stat' ? stat(100, ++reads === 4 ? '2000' : '1001', reads === 1 ? 'S' : 'Z', 101) : fake.read(file);
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PID_REUSED');
  });
  it('does not certify exit from PF_EXITING alone and bounds checks even if a test clock stalls', () => {
    const fake = fakeTree(); let reads = 0; let pauses = 0;
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'R');
    const read = (file: string) => {
      if (file === '/proc/101/stat') { reads++; const fields = stat(100, '1001', 'R', 101).split(') '); const tail = fields.pop()!.split(' '); tail[6] = '4'; return `${fields.join(') ')}) ${tail.join(' ')}`; }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read, pause: () => { pauses++; } })).toThrow('MISSING_RSS');
    expect(pauses).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks);
    // Each bounded check now retries RSS with its task/group identity guards.
    expect(reads).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks * 6 + 6);
  });
  it('keeps deferred classification inside the existing overall sample budget', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = procStatus(101);
    const read = (file: string) => { if (file === '/proc/100/status') fake.pause(40); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(fake.now()).toBeLessThanOrEqual(MEMORY_METHOD.maxSampleMs);
  });
  it('rejects malformed counters, unverified descendants and exceeded sampling budgets', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = procStatus(101);
    expect(createTreeSampler(100, fake)).toThrow('MISSING_RSS');
    fake.files['/proc/101/stat'] = stat(999, '1001', 'S', 101);
    expect(createTreeSampler(100, fake)).toThrow('UNVERIFIED_DESCENDANT');
    let now = 0;
    expect(createTreeSampler(100, { ...fake, now: () => (now += 100) })).toThrow('SAMPLE_BUDGET_EXCEEDED');
  });
  it('never calls parent-only RSS complete when the kernel omits task/children', () => {
    const fake = fakeTree(); delete fake.files['/proc/100/task/100/children'];
    fake.files['/proc/100/task/100/stat'] = stat(1, '1000');
    expect(createTreeSampler(100, fake)).toThrow('CHILD_DISCOVERY_UNAVAILABLE');
  });
  it('rejects an unreadable descendant rather than returning the measured parent as a complete tree', () => {
    const fake = fakeTree();
    const read = (file: string) => {
      if (file === '/proc/101/status') throw Object.assign(new Error('access denied'), { code: 'EACCES' });
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('access denied');
  });
  it('bounds both process and thread enumeration', () => {
    const read = (file: string) => {
      const pid = Number(file.split('/')[2]);
      if (file.endsWith('/stat')) return stat(pid === 100 ? process.pid : 100, String(pid), 'S', pid);
      if (file.endsWith('/status')) return procStatus(pid, 10);
      return pid === 100 ? Array.from({ length: 512 }, (_, index) => String(101 + index)).join(' ') : '';
    };
    expect(createTreeSampler(100, { read, list: (file) => [file.split('/')[2]], now: () => 0 })).toThrow('PROCESS_BUDGET_EXCEEDED');
    expect(createTreeSampler(100, { read, list: () => Array.from({ length: 4097 }, (_, index) => String(index + 100)), now: () => 0 })).toThrow('TASK_BUDGET_EXCEEDED');
  });
  it.each(['ENOENT', 'ESRCH'])('accepts an empty task list only after TGID disappearance is verified (%s)', (code) => {
    const fake = fakeTree(); let enumerated = false;
    const list = (file: string) => { if (file === '/proc/100/task') { enumerated = true; return []; } return fake.list(file); };
    const read = (file: string) => { if (file === '/proc/100/stat' && enumerated) throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, list, read })()).toMatchObject({ rssBytes: 0, processCount: 0, exitRaces: 1 });
    expect(fake.reads).toContain('/proc/100/stat');
  });
  it.each(['S', 'Z', 'X'])('does not certify an empty task list while the same TGID still exists in state %s', (state) => {
    const fake = fakeTree(); fake.files['/proc/100/stat'] = stat(process.pid, '1000', state);
    fake.files['/proc/100/status'] = procStatus(100, undefined, state);
    const list = (file: string) => file === '/proc/100/task' ? [] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, list })).toThrow('MISSING_RSS');
    expect(fake.now()).toBeLessThanOrEqual(MEMORY_METHOD.exitVerificationMs);
  });
  it('rejects a reused TGID after an empty task list instead of treating it as exit', () => {
    const fake = fakeTree(); let enumerated = false;
    const list = (file: string) => { if (file === '/proc/100/task') { enumerated = true; return []; } return fake.list(file); };
    const read = (file: string) => file === '/proc/100/stat' && enumerated ? stat(process.pid, '2000', 'Z') : fake.read(file);
    expect(createTreeSampler(100, { ...fake, list, read })).toThrow('PID_REUSED');
  });
  it.each(['ENOENT', 'ESRCH'])('never publishes partial RSS after %s from status, task enumeration or a disappeared child-discovery task', (code) => {
    for (const missing of ['status', 'task', 'children']) {
      const fake = fakeTree();
      const read = (file: string) => {
        if (missing === 'status' && ['/proc/101/status', '/proc/101/task/101/status'].includes(file)) throw procError(code);
        if (missing === 'children' && ['/proc/101/task/101/children', '/proc/101/task/101/stat'].includes(file)) throw procError(code);
        return fake.read(file);
      };
      const list = (file: string) => { if (missing === 'task' && file === '/proc/101/task') throw procError(code); return fake.list(file); };
      expect(createTreeSampler(100, { ...fake, read, list }), missing).toThrow(missing === 'children' ? 'CHILD_DISCOVERY_UNAVAILABLE' : 'MISSING_RSS');
      expect(fake.reads.filter((file) => file === '/proc/101/stat').length, missing).toBeGreaterThan(1);
    }
  });
  it.each(['ENOENT', 'ESRCH'])('accepts partial proc disappearance %s only after rechecking the same TGID', (code) => {
    for (const missing of ['status', 'task', 'children']) {
      const fake = fakeTree(); let partialGone = false; let verifiedGone = false;
      const read = (file: string) => {
        if (file === '/proc/101/stat' && partialGone) { verifiedGone = true; throw procError(code); }
        if (missing === 'status' && ['/proc/101/status', '/proc/101/task/101/status'].includes(file)) { partialGone = true; throw procError(code); }
        if (missing === 'children' && file === '/proc/101/task/101/children') { partialGone = true; throw procError(code); }
        if (missing === 'children' && file === '/proc/101/task/101/stat' && partialGone) throw procError(code);
        return fake.read(file);
      };
      const list = (file: string) => { if (missing === 'task' && file === '/proc/101/task') { partialGone = true; throw procError(code); } return fake.list(file); };
      expect(createTreeSampler(100, { ...fake, read, list })(), missing).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
      expect(verifiedGone, missing).toBe(true);
    }
  });
  it.each(['status', 'task', 'children'])('rejects TGID reuse after partial %s disappearance', (missing) => {
    const fake = fakeTree(); let partialGone = false;
    const read = (file: string) => {
      if (file === '/proc/101/stat' && partialGone) return stat(100, '2000', 'Z', 101);
      if (missing === 'status' && ['/proc/101/status', '/proc/101/task/101/status'].includes(file)) { partialGone = true; throw procError('ENOENT'); }
      if (missing === 'children' && file === '/proc/101/task/101/children') { partialGone = true; throw procError('ENOENT'); }
      if (missing === 'children' && file === '/proc/101/task/101/stat' && partialGone) throw procError('ENOENT');
      return fake.read(file);
    };
    const list = (file: string) => { if (missing === 'task' && file === '/proc/101/task') { partialGone = true; throw procError('ENOENT'); } return fake.list(file); };
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('PID_REUSED');
  });
  it('reads a surviving thread RSS for a zombie leader beyond the exit verification window', () => {
    const fake = fakeTree();
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const sample = createTreeSampler(100, fake);
    expect(sample()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2, exitRaces: 0, exitVerificationCount: 0 });
    fake.pause(MEMORY_METHOD.exitVerificationMs + 10);
    fake.files['/proc/100/task/102/status'] = procStatus(102, 20, 'S', 100);
    expect(sample()).toMatchObject({ rssBytes: 45 * 1024, processCount: 2, exitRaces: 0, exitVerificationCount: 0 });
    expect(fake.reads).toContain('/proc/100/task/102/status');
    expect(fake.reads).toContain('/proc/100/task/102/children');
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs + 10);
  });
  it('counts thread-group RSS once and discovers children of every surviving thread', () => {
    const fake = fakeTree();
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/102/status'] = procStatus(102, 10, 'S', 100);
    fake.files['/proc/100/task/102/children'] = '';
    fake.files['/proc/100/task/104/stat'] = stat(process.pid, '1004', 'S', 104);
    fake.files['/proc/100/task/104/status'] = procStatus(104, 10, 'S', 100);
    fake.files['/proc/100/task/104/children'] = '101';
    const list = (file: string) => file === '/proc/100/task' ? ['100', '102', '104'] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, list })()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2 });
    expect(fake.reads).toContain('/proc/100/task/102/children');
    expect(fake.reads).toContain('/proc/100/task/104/children');
  });
  it.each(['ENOENT', 'ESRCH'])('keeps RSS unknown when a representative disappears (%s) but its TGID stays alive', (code) => {
    const fake = fakeTree();
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => { if (file === '/proc/100/task/102/status') throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
  });
  it.each(['reused', 'wrong-tgid', 'wrong-pid', 'permission', 'malformed-rss', 'missing-rss'])('rejects an unverified surviving representative: %s', (change) => {
    const fake = fakeTree(); let representativeReads = 0;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => {
      if (file === '/proc/100/task/102/stat' && change === 'reused' && ++representativeReads > 1) return stat(process.pid, '2002', 'S', 102);
      if (file === '/proc/100/task/102/status') {
        if (change === 'wrong-tgid') return procStatus(102, 10, 'S', 999);
        if (change === 'wrong-pid') return procStatus(999, 10, 'S', 100);
        if (change === 'permission') throw procError('EACCES');
        if (change === 'malformed-rss') return procStatus(102, 'NaN', 'S', 100);
        if (change === 'missing-rss') return procStatus(102, undefined, 'S', 100);
      }
      return fake.read(file);
    };
    const expected = { reused: 'PID_REUSED', 'wrong-tgid': 'INVALID_PROC_STATUS', 'wrong-pid': 'INVALID_PROC_STATUS', permission: 'EACCES', 'malformed-rss': 'INVALID_RSS', 'missing-rss': 'MISSING_RSS' }[change];
    expect(createTreeSampler(100, { ...fake, read })).toThrow(expected);
  });
  it('rejects a reused TGID after reading representative memory', () => {
    const fake = fakeTree(); let statusRead = false;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') statusRead = true;
      if (file === '/proc/100/stat' && statusRead) return stat(process.pid, '2000', 'Z');
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PID_REUSED');
  });
  it.each(['ENOENT', 'ESRCH'])('does not accept a transient TGID stat absence (%s) when the generation reappears alive', (code) => {
    const fake = fakeTree(); let reads = 0; fake.files['/proc/101/status'] = procStatus(101);
    const read = (file: string) => { if (file === '/proc/101/stat' && ++reads === 2) throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(reads).toBeGreaterThan(2);
  });
  it.each(['ENOENT', 'ESRCH'])('removes a vanished group while retaining reparented children discovered before its RSS representative disappeared (%s)', (code) => {
    const fake = fakeTree(); let representativeGone = false; let verifiedGone = false;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { representativeGone = true; throw procError(code); }
      if (file === '/proc/100/stat' && representativeGone) {
        verifiedGone = true; fake.files['/proc/101/stat'] = stat(1, '1001', 'S', 101); throw procError(code);
      }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })()).toMatchObject({ rssBytes: 25 * 1024, processCount: 1, exitRaces: 1 });
    expect(verifiedGone).toBe(true);
    expect(fake.reads).toContain('/proc/101/status');
  });
  it('does not authorize an unknown descendant through a retired parent PID that was reused', () => {
    const fake = fakeTree(); let rootReads = 0; let reused = false;
    fake.files['/proc/100/task/100/children'] = '101';
    const read = (file: string) => {
      if (file === '/proc/100/stat' && ++rootReads >= 2 && !reused) throw procError('ENOENT');
      if (file === '/proc/101/stat') {
        reused = true; fake.files['/proc/100/stat'] = stat(process.pid, '2000');
        return stat(100, '2001', 'S', 101);
      }
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' ? ['100'] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('UNVERIFIED_DESCENDANT');
    expect(reused).toBe(true);
    expect(parseIdentity(fake.files['/proc/100/stat']).start).toBe('2000');
    expect(fake.reads).not.toContain('/proc/101/status');
  });
  it('does not authorize a new descendant of a known survivor through a retired parent PID', () => {
    const fake = fakeTree(); let orphaned = false;
    const read = (file: string) => {
      if (file === '/proc/104/stat') fake.files['/proc/100/stat'] = stat(process.pid, '2000');
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/101/task' && orphaned ? ['101', '103'] : file === '/proc/104/task' ? ['104'] : fake.list(file);
    const sample = createTreeSampler(100, { ...fake, read, list });
    expect(sample()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2 });
    orphaned = true;
    delete fake.files['/proc/100/stat'];
    fake.files['/proc/101/stat'] = stat(1, '1001', 'Z', 101);
    fake.files['/proc/101/status'] = procStatus(101, undefined, 'Z');
    fake.files['/proc/101/task/101/stat'] = stat(1, '1001', 'Z', 101);
    fake.files['/proc/101/task/103/stat'] = stat(1, '1003', 'S', 103);
    fake.files['/proc/101/task/103/status'] = procStatus(103, 25, 'S', 101);
    fake.files['/proc/101/task/103/children'] = '104';
    fake.files['/proc/104/stat'] = stat(100, '1004', 'S', 104);
    fake.files['/proc/104/status'] = procStatus(104, 8);
    fake.files['/proc/104/task/104/children'] = '';
    expect(sample).toThrow('UNVERIFIED_DESCENDANT');
    expect(parseIdentity(fake.files['/proc/100/stat']).start).toBe('2000');
    expect(fake.reads).not.toContain('/proc/104/status');
  });
  it.each(['reused', 'gone', 'valid'])('does not promote a fresh child through another pending known parent during guarded discovery: %s', (parentState) => {
    const fake = pendingParentTree(); let secondSample = false; let childCaptured = false;
    fake.files['/proc/101/status'] = procStatus(101, 8);
    const read = (file: string) => {
      if (secondSample && file === '/proc/200/stat') {
        if (parentState === 'gone' || (parentState === 'reused' && childCaptured)) throw procError('ENOENT');
        if (parentState === 'reused') return stat(1, '9200', 'S', 200);
      }
      if (secondSample && file === '/proc/101/stat') {
        const parent = childCaptured ? 1 : 200;
        childCaptured = true; return stat(parent, '9001', 'S', 101);
      }
      return fake.read(file);
    };
    const sample = createTreeSampler(100, { ...fake, read });
    expect(sample()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2 });
    secondSample = true;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/100/children'] = '';
    fake.files['/proc/100/task/102/children'] = '101';
    // In the reused case PID 200 would show generation 9200 before this
    // capture, then disappear before its queued visit. Merely remembering
    // its old generation 1200 must not authorize the new child generation.
    expect(sample).toThrow('UNVERIFIED_DESCENDANT');
    expect(childCaptured).toBe(true);
    expect(fake.reads).not.toContain('/proc/101/status');
  });
  it('retains a previously verified child after its pending known parent disappears and it reparents', () => {
    const fake = pendingParentTree(); let secondSample = false;
    fake.files['/proc/100/task/102/children'] = '101';
    fake.files['/proc/101/stat'] = stat(200, '1010', 'S', 101);
    fake.files['/proc/101/task/101/stat'] = stat(200, '1010', 'S', 101);
    fake.files['/proc/101/status'] = procStatus(101, 8);
    const read = (file: string) => {
      if (secondSample && file === '/proc/200/stat') throw procError('ENOENT');
      return fake.read(file);
    };
    const sample = createTreeSampler(100, { ...fake, read });
    expect(sample()).toMatchObject({ rssBytes: 43 * 1024, processCount: 3 });
    secondSample = true;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/100/children'] = '';
    fake.files['/proc/101/stat'] = stat(1, '1010', 'S', 101);
    fake.files['/proc/101/task/101/stat'] = stat(1, '1010', 'S', 101);
    expect(sample()).toMatchObject({ rssBytes: 18 * 1024, processCount: 2, exitRaces: 1 });
  });
  it.each(['ENOENT', 'ESRCH', 'reused'])('does not promote a fresh child before the final TGID discovery guard succeeds: %s', (change) => {
    const fake = fakeTree(); let childObserved = false;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => {
      if (file === '/proc/100/stat' && childObserved) {
        if (change === 'reused') return stat(process.pid, '2000', 'Z');
        throw procError(change);
      }
      if (file === '/proc/101/stat') {
        const parent = childObserved ? 1 : 100;
        childObserved = true; return stat(parent, '2001', 'S', 101);
      }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow(change === 'reused' ? 'PID_REUSED' : 'UNVERIFIED_DESCENDANT');
    expect(childObserved).toBe(true);
    expect(fake.reads).not.toContain('/proc/101/status');
  });
  it.each(['ENOENT', 'ESRCH'])('retains an already verified child when the final TGID discovery guard disappears: %s', (code) => {
    const fake = fakeTree(); let secondSample = false; let childObserved = false;
    const read = (file: string) => {
      if (file === '/proc/100/stat' && secondSample && childObserved) {
        fake.files['/proc/101/stat'] = stat(1, '1001', 'S', 101); throw procError(code);
      }
      if (file === '/proc/101/stat' && secondSample) childObserved = true;
      return fake.read(file);
    };
    const sample = createTreeSampler(100, { ...fake, read });
    expect(sample()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2 });
    secondSample = true;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    expect(sample()).toMatchObject({ rssBytes: 25 * 1024, processCount: 1, exitRaces: 1 });
    expect(parseIdentity(fake.files['/proc/101/stat'])).toMatchObject({ parent: 1, start: '1001' });
  });
  it.each(['task-stat-after', 'first-child-stat'])('preserves every observed child token across a failed %s and vanished TGID', (failure) => {
    const fake = fakeTree(); let childrenObserved = false; let groupGone = false;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/102/children'] = failure === 'first-child-stat' ? '104 101' : '101';
    const read = (file: string) => {
      if (file === '/proc/100/stat' && groupGone) throw procError('ENOENT');
      if (file === '/proc/100/task/102/children') {
        const value = fake.read(file); childrenObserved = true; return value;
      }
      if ((file === '/proc/100/task/102/stat' && childrenObserved && failure === 'task-stat-after') || file === '/proc/104/stat') {
        groupGone = true; throw procError('ENOENT');
      }
      if (file === '/proc/101/stat') return stat(groupGone ? 1 : 100, '1001', 'S', 101);
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('UNVERIFIED_DESCENDANT');
    expect(childrenObserved).toBe(true);
    expect(groupGone).toBe(true);
    expect(fake.reads).not.toContain('/proc/101/status');
  });
  it('does not publish partial RSS when one representative disappears even if another looks valid', () => {
    const fake = fakeTree();
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/104/stat'] = stat(process.pid, '1004', 'S', 104);
    fake.files['/proc/100/task/104/status'] = procStatus(104, 10, 'S', 100);
    fake.files['/proc/100/task/104/children'] = '';
    const read = (file: string) => { if (file === '/proc/100/task/102/status') throw procError('ENOENT'); return fake.read(file); };
    const list = (file: string) => file === '/proc/100/task' ? ['100', '102', '104'] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('MISSING_RSS');
  });
  it.each(['stat-before', 'status', 'stat-after'].flatMap((stage) => ['ENOENT', 'ESRCH'].map((code) => [stage, code])))('recovers a verified vanished RSS candidate at %s (%s) and preserves its discovered children', (stage, code) => {
    const fake = survivingTree(); let childrenCaptured = false; let postCaptureStats = 0; let vanished = false; let verifiedGone = 0; let freshLists = 0;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/children') {
        const value = fake.read(file); childrenCaptured = true; return value;
      }
      if (file === '/proc/100/task/102/stat') {
        if (vanished) { verifiedGone++; throw procError(code); }
        if (childrenCaptured) {
          postCaptureStats++;
          // The first stat after children is the discovery identity guard;
          // the following two bracket the candidate's RSS read.
          if ((stage === 'stat-before' && postCaptureStats === 2) || (stage === 'stat-after' && postCaptureStats === 3)) { vanished = true; throw procError(code); }
        }
      }
      if (file === '/proc/100/task/102/status' && stage === 'status') { vanished = true; throw procError(code); }
      return fake.read(file);
    };
    const list = (file: string) => {
      if (file === '/proc/100/task' && vanished) { freshLists++; return ['100', '103']; }
      return fake.list(file);
    };
    expect(createTreeSampler(100, { ...fake, read, list })()).toMatchObject({ rssBytes: 48 * 1024 * 1024 + 25 * 1024, processCount: 2 });
    expect(vanished).toBe(true);
    expect(verifiedGone).toBeGreaterThan(0);
    expect(freshLists).toBeGreaterThan(0);
    expect(fake.reads.indexOf('/proc/100/task/102/children')).toBeLessThan(fake.reads.indexOf('/proc/100/task/103/status'));
    expect(fake.reads).toContain('/proc/101/status');
  });
  it.each(['ENOENT', 'ESRCH'])('does not recover a missing candidate status (%s) while that task stat and enumeration remain live', (code) => {
    const fake = survivingTree();
    const read = (file: string) => { if (file === '/proc/100/task/102/status') throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it.each(['listed', 'reappeared', 'reused-tid', 'reused-tgid', 'wrong-survivor-tgid'])('rejects uncertain or changed identity during candidate recovery: %s', (change) => {
    const fake = survivingTree(); let vanished = false; let vanishedStatReads = 0;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { vanished = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && vanished) {
        vanishedStatReads++;
        if (change === 'reappeared' && vanishedStatReads >= 2) return stat(process.pid, '1002', 'S', 102);
        if (change === 'reused-tid' && vanishedStatReads >= 2) return stat(process.pid, '2002', 'S', 102);
        throw procError('ENOENT');
      }
      if (file === '/proc/100/stat' && vanished && change === 'reused-tgid') return stat(process.pid, '2000', 'Z');
      if (file === '/proc/100/task/103/status' && change === 'wrong-survivor-tgid') return procStatus(103, 48 * 1024, 'S', 999);
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' && vanished && change !== 'listed' ? ['100', '103'] : fake.list(file);
    const expected: Record<string, string> = { listed: 'MISSING_RSS', reappeared: 'MISSING_RSS', 'reused-tid': 'PID_REUSED', 'reused-tgid': 'PID_REUSED', 'wrong-survivor-tgid': 'INVALID_PROC_STATUS' };
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow(expected[change]);
  });
  it.each(['EACCES', 'EIO'])('does not recover candidate status errors %s by using another task', (code) => {
    const fake = survivingTree();
    const read = (file: string) => { if (file === '/proc/100/task/102/status') throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow(code);
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it.each(['ENOENT', 'ESRCH', 'EACCES', 'EIO'])('does not recover uncertain child discovery %s even if a surviving task has valid RSS', (code) => {
    const fake = survivingTree();
    const read = (file: string) => { if (file === '/proc/100/task/102/children') throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow(['ENOENT', 'ESRCH'].includes(code) ? 'CHILD_DISCOVERY_UNAVAILABLE' : code);
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it.each(['ENOENT', 'ESRCH'])('rejects a task stat disappearing before its children are captured (%s)', (code) => {
    const fake = survivingTree();
    const read = (file: string) => { if (file === '/proc/100/task/102/stat') throw procError(code); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(fake.reads).not.toContain('/proc/100/task/102/children');
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it.each(['complete', 'missing-children', 'reused-thread'])('discovers a new task and its child during RSS recovery with identity checks: %s', (change) => {
    const fake = survivingTree(); let vanished = false; let newTaskStats = 0;
    fake.files['/proc/100/task/104/stat'] = stat(process.pid, '1004', 'S', 104);
    fake.files['/proc/100/task/104/status'] = procStatus(104, 48 * 1024, 'S', 100);
    fake.files['/proc/100/task/104/children'] = '105';
    fake.files['/proc/105/stat'] = stat(100, '1005', 'S', 105);
    fake.files['/proc/105/status'] = procStatus(105, 7);
    fake.files['/proc/105/task/105/children'] = '';
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { vanished = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && vanished) throw procError('ENOENT');
      if (file === '/proc/100/task/104/children' && change === 'missing-children') throw procError('ENOENT');
      if (file === '/proc/100/task/104/stat' && ++newTaskStats === 2 && change === 'reused-thread') return stat(process.pid, '2004', 'S', 104);
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' && vanished ? ['100', '103', '104'] : file === '/proc/105/task' ? ['105'] : fake.list(file);
    const sample = createTreeSampler(100, { ...fake, read, list });
    if (change === 'complete') {
      expect(sample()).toMatchObject({ rssBytes: 48 * 1024 * 1024 + 32 * 1024, processCount: 3 });
      expect(fake.reads).toContain('/proc/100/task/104/children');
      expect(newTaskStats).toBeGreaterThanOrEqual(2);
    } else expect(sample).toThrow(change === 'missing-children' ? 'CHILD_DISCOVERY_UNAVAILABLE' : 'PID_REUSED');
  });
  it('does not reset the sample time budget when recovering an RSS candidate', () => {
    const fake = survivingTree(); let vanished = false;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { fake.pause(30); vanished = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && vanished) throw procError('ENOENT');
      if (file === '/proc/100/task/103/children' && vanished) fake.pause(21);
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' && vanished ? ['100', '103'] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('SAMPLE_BUDGET_EXCEEDED');
    expect(fake.now()).toBe(51);
  });
  it('keeps one cumulative task budget across the original and recovery enumerations', () => {
    const fake = survivingTree(); let vanished = false;
    const fresh = Array.from({ length: MEMORY_METHOD.maxTasks - 2 }, (_, index) => String(index === 0 ? 100 : 102 + index));
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { vanished = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && vanished) throw procError('ENOENT');
      const extraTask = /^\/proc\/100\/task\/(\d+)\/(stat|status|children)$/.exec(file);
      if (extraTask && Number(extraTask[1]) >= 104) {
        const tid = Number(extraTask[1]);
        if (extraTask[2] === 'stat') return stat(process.pid, String(1000 + tid), 'S', tid);
        if (extraTask[2] === 'status') return procStatus(tid, 48 * 1024, 'S', 100);
        return '';
      }
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' && vanished ? fresh : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('TASK_BUDGET_EXCEEDED');
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it('keeps the overall sample budget across multiple RSS candidates', () => {
    const fake = fakeTree();
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/104/stat'] = stat(process.pid, '1004', 'S', 104);
    fake.files['/proc/100/task/104/status'] = procStatus(104, 10, 'S', 100);
    fake.files['/proc/100/task/104/children'] = '';
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { fake.pause(30); return procStatus(102, undefined, 'S', 100); }
      if (file === '/proc/100/task/104/status') fake.pause(30);
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' ? ['100', '102', '104'] : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('SAMPLE_BUDGET_EXCEEDED');
  });
  it('rejects RSS from a representative that becomes terminal before its identity recheck', () => {
    const fake = fakeTree(); let memoryRead = false; let postMemoryStats = 0;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') memoryRead = true;
      if (file === '/proc/100/task/102/stat' && memoryRead && ++postMemoryStats === 1) return stat(process.pid, '1002', 'Z', 102);
      return fake.read(file);
    };
    // Subsequent enumeration still sees the task alive. Its stale RSS cannot
    // certify the group or become a complete sample.
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
  });
  it.each(['group-status', 'task-list', 'task-stat-before', 'child-stat'])('recaptures the same TGID after transient %s unavailability and counts its real RSS once', (route) => {
    const fake = recoveryTree(); let injected = false; let rssReads = 0;
    const read = (file: string) => {
      if (!injected && ((route === 'group-status' && file === '/proc/100/status') || (route === 'task-stat-before' && file === '/proc/100/task/102/stat'))) { injected = true; throw procError('ENOENT'); }
      if (route === 'child-stat' && file === '/proc/101/stat') { injected = true; throw procError('ENOENT'); }
      if (route === 'child-stat' && file === '/proc/100/task/102/children' && !injected) return '101';
      if (file === '/proc/100/task/102/status') rssReads++;
      return fake.read(file);
    };
    const list = (file: string) => {
      if (!injected && route === 'task-list' && file === '/proc/100/task') { injected = true; return []; }
      return fake.list(file);
    };
    const result = createTreeSampler(100, { ...fake, read, list })();
    expect(injected).toBe(true);
    expect(rssReads).toBeGreaterThan(0);
    expect(result).toMatchObject({ rssBytes: 48 * 1024 * 1024, processCount: 1, recoveryCount: route === 'child-stat' ? 2 : 1, exitVerificationCount: route === 'child-stat' ? 1 : 0 });
    expect(result.lastRecovery).toMatchObject({ outcome: route === 'child-stat' ? 'gone' : 'rss-recovered', initialPhase: route === 'child-stat' ? 'group-stat' : route, initialCause: route === 'task-list' ? 'EMPTY_TASK_LIST' : 'ENOENT' });
    expect(result.lastRecovery?.rssAttempts).toBeGreaterThanOrEqual(route === 'child-stat' ? 1 : 2);
    expect(fake.now()).toBeLessThanOrEqual(MEMORY_METHOD.exitVerificationMs);
  });
  it('keeps a stable live thread with persistently unknown RSS incomplete throughout recovery', () => {
    const fake = recoveryTree(); fake.files['/proc/100/task/102/status'] = procStatus(102, undefined, 'S', 100);
    expect(createTreeSampler(100, fake)).toThrow('MISSING_RSS');
    expect(fake.reads.filter((file) => file === '/proc/100/task/102/status').length).toBeGreaterThan(1);
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs);
  });
  it.each(['group', 'task'])('rejects a changed %s generation while recapturing RSS', (kind) => {
    const fake = recoveryTree(); let triggered = false;
    const read = (file: string) => {
      if (kind === 'group' && file === '/proc/100/status' && !triggered) { triggered = true; throw procError('ENOENT'); }
      if (kind === 'task' && file === '/proc/100/task/102/status' && !triggered) { triggered = true; return procStatus(102, undefined, 'S', 100); }
      if (triggered && kind === 'group' && file === '/proc/100/stat') return stat(process.pid, '2000', 'Z');
      if (triggered && kind === 'task' && file === '/proc/100/task/102/stat') return stat(process.pid, '2002', 'S', 102);
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PID_REUSED');
  });
  it('retains an observed child token whose unverified generation reparents during recovery', () => {
    const fake = recoveryTree(); let childReads = 0;
    fake.files['/proc/100/task/102/children'] = '101';
    const read = (file: string) => {
      if (file === '/proc/101/stat') { if (++childReads === 1) throw procError('ENOENT'); return stat(1, '1001', 'S', 101); }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('UNVERIFIED_DESCENDANT');
    expect(fake.reads).not.toContain('/proc/101/status');
  });
  it.each(['EACCES', 'EIO'])('does not turn a group status %s failure into an RSS recovery', (code) => {
    const fake = recoveryTree(); let statusAttempts = 0;
    const read = (file: string) => { if (file === '/proc/100/status') { statusAttempts++; throw procError(code); } return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow(code);
    expect(statusAttempts).toBe(1);
    expect(fake.reads).not.toContain('/proc/100/task/102/status');
  });
  it('cannot replace an uncaptured vanished task obligation with another live task RSS', () => {
    const fake = recoveryTree(); let vanished = false;
    fake.files['/proc/100/task/103/stat'] = stat(process.pid, '1003', 'S', 103);
    fake.files['/proc/100/task/103/status'] = procStatus(103, 48 * 1024, 'S', 100);
    fake.files['/proc/100/task/103/children'] = '';
    const read = (file: string) => { if (file === '/proc/100/task/102/stat') { vanished = true; throw procError('ENOENT'); } return fake.read(file); };
    const list = (file: string) => file === '/proc/100/task' ? (vanished ? ['100', '103'] : ['100', '102', '103']) : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('MISSING_RSS');
    expect(fake.now()).toBeLessThanOrEqual(MEMORY_METHOD.exitVerificationMs);
  });
  it('cannot bypass an unresolved representative by recovering the live leader RSS', () => {
    const fake = fakeTree(); let failed = false; let vanishedStatReads = 0; let recoveredLeaderReads = 0;
    fake.files['/proc/100/status'] = procStatus(100);
    fake.files['/proc/100/task/102/children'] = '';
    fake.files['/proc/100/task/103/stat'] = stat(process.pid, '1003', 'S', 103);
    fake.files['/proc/100/task/103/status'] = procStatus(103, 48 * 1024, 'S', 100);
    fake.files['/proc/100/task/103/children'] = '';
    const read = (file: string) => {
      if (file === '/proc/100/status' && failed) { recoveredLeaderReads++; return procStatus(100, 48 * 1024); }
      if (file === '/proc/100/task/102/status') { failed = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && failed && ++vanishedStatReads === 1) throw procError('ENOENT');
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' ? (failed ? ['100', '103'] : ['100', '102', '103']) : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('MISSING_RSS');
    expect(recoveredLeaderReads).toBeGreaterThan(0);
    expect(vanishedStatReads).toBeGreaterThanOrEqual(2);
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs);
  });
  it('does not recover RSS from a leader generation previously observed terminal', () => {
    const fake = recoveryTree(); let attempted = false; let recoveredLeaderReads = 0;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { attempted = true; return procStatus(102, undefined, 'S', 100); }
      if (file === '/proc/100/stat' && attempted) return stat(process.pid, '1000', 'S');
      if (file === '/proc/100/status' && attempted) { recoveredLeaderReads++; return procStatus(100, 48 * 1024); }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(recoveredLeaderReads).toBeGreaterThan(0);
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs);
  });
  it('does not restart the original recovery deadline after a different transient failure', () => {
    const fake = recoveryTree(); let secondFailure = false;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') {
        if (!secondFailure && fake.now() >= 20) { secondFailure = true; throw procError('ENOENT'); }
        return procStatus(102, undefined, 'S', 100);
      }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(secondFailure).toBe(true);
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs);
  });
  it('rejects real RSS obtained after the original recovery deadline', () => {
    const fake = recoveryTree(); let attempts = 0;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') {
        if (++attempts === 1) return procStatus(102, undefined, 'S', 100);
        fake.pause(MEMORY_METHOD.exitVerificationMs + 1);
      }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(attempts).toBe(2);
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs + 1);
  });
  it('starts the original recovery deadline before verifying a vanished RSS candidate', () => {
    const fake = survivingTree(); let vanished = false;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') { vanished = true; throw procError('ENOENT'); }
      if (file === '/proc/100/task/102/stat' && vanished) throw procError('ENOENT');
      return fake.read(file);
    };
    const list = (file: string) => {
      if (file === '/proc/100/task' && vanished) { fake.pause(MEMORY_METHOD.exitVerificationMs + 1); return ['100', '103']; }
      return fake.list(file);
    };
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('MISSING_RSS');
    expect(fake.now()).toBe(MEMORY_METHOD.exitVerificationMs + 1);
    expect(fake.reads).not.toContain('/proc/100/task/103/status');
  });
  it('keeps RSS recovery inside the sample time budget', () => {
    const fake = recoveryTree(); let attempts = 0;
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status') {
        if (++attempts === 1) { fake.pause(40); return procStatus(102, undefined, 'S', 100); }
        fake.pause(11);
      }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('SAMPLE_BUDGET_EXCEEDED');
    expect(fake.now()).toBe(51);
  });
  it('does not reset the cumulative task budget when replaying a whole TGID observation', () => {
    const fake = recoveryTree(); let rssAttempts = 0;
    const tids = ['100', '102', ...Array.from({ length: 2047 }, (_, index) => String(103 + index))];
    const read = (file: string) => {
      if (file === '/proc/100/task/102/status' && ++rssAttempts === 1) return procStatus(102, undefined, 'S', 100);
      const extra = /^\/proc\/100\/task\/(\d+)\/(stat|children)$/.exec(file);
      if (extra && Number(extra[1]) >= 103) return extra[2] === 'stat' ? stat(process.pid, String(1000 + Number(extra[1])), 'Z', Number(extra[1])) : '';
      return fake.read(file);
    };
    const list = (file: string) => file === '/proc/100/task' ? tids : fake.list(file);
    expect(createTreeSampler(100, { ...fake, read, list })).toThrow('TASK_BUDGET_EXCEEDED');
    expect(rssAttempts).toBe(1);
  });
  it('retains the process budget and previously discovered children across RSS replay', () => {
    const fake = recoveryTree(); let replay = false;
    const children = Array.from({ length: MEMORY_METHOD.maxProcesses - 2 }, (_, index) => String(200 + index));
    const read = (file: string) => {
      if (file === '/proc/100/task/102/children') return [...children, ...(replay ? ['710', '711'] : [])].join(' ');
      if (file === '/proc/100/task/102/status' && !replay) { replay = true; return procStatus(102, undefined, 'S', 100); }
      const descendant = /^\/proc\/(\d+)\/stat$/.exec(file);
      if (descendant && Number(descendant[1]) >= 200) return stat(100, String(1000 + Number(descendant[1])), 'S', Number(descendant[1]));
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PROCESS_BUDGET_EXCEEDED');
    expect(replay).toBe(true);
    expect(fake.reads).not.toContain('/proc/200/status');
  });
  it('rejects duplicate VmRSS even when the first counter is valid', () => {
    const fake = fakeTree(); fake.files['/proc/100/status'] = `${procStatus(100, 10)}\nVmRSS: 10 kB`;
    expect(createTreeSampler(100, fake)).toThrow('INVALID_RSS');
  });
  it('rejects an unsafe tree RSS sum even when each process counter is individually safe', () => {
    const fake = fakeTree(); const individuallySafeKiB = 8_796_093_022_207;
    expect(Number.isSafeInteger(individuallySafeKiB * 1024)).toBe(true);
    fake.files['/proc/100/status'] = procStatus(100, individuallySafeKiB);
    fake.files['/proc/101/status'] = procStatus(101, individuallySafeKiB);
    expect(createTreeSampler(100, fake)).toThrow('INVALID_RSS');
  });
  it.each(['-1', '1.5', 'NaN', 'Infinity', '1 MB', '9007199254740992'])('rejects malformed VmRSS %s instead of treating it as a missing counter', (rss) => {
    const fake = fakeTree(); fake.files['/proc/100/status'] = procStatus(100, rss);
    expect(createTreeSampler(100, fake)).toThrow('INVALID_RSS');
  });
  it.each(['missing-pid', 'missing-tgid', 'wrong-pid', 'wrong-tgid', 'malformed-pid', 'duplicate-tgid'])('rejects invalid leader status identity: %s', (change) => {
    const fake = fakeTree();
    const statuses: Record<string, string> = {
      'missing-pid': 'Tgid: 100\nVmRSS: 10 kB', 'missing-tgid': 'Pid: 100\nVmRSS: 10 kB',
      'wrong-pid': procStatus(102, 10, 'S', 100), 'wrong-tgid': procStatus(100, 10, 'S', 999),
      'malformed-pid': 'Tgid: 100\nPid: NaN\nVmRSS: 10 kB', 'duplicate-tgid': `${procStatus(100, 10)}\nTgid: 999`,
    };
    fake.files['/proc/100/status'] = statuses[change];
    expect(createTreeSampler(100, fake)).toThrow('INVALID_PROC_STATUS');
  });
  it.each([true, false])('serializes only internally constructed recovery categories and counters, recovered=%s', async (recovers) => {
    const fake = recoveryTree(); let injected = false; let samples = 0;
    if (!recovers) fake.files['/proc/100/task/102/status'] = procStatus(102, undefined, 'S', 100);
    const privateError = Object.assign(new Error('/proc/9999/status private-start-ticks'), {
      code: 'ENOENT', initialPhase: '/proc/9999/status', initialCause: 'private-start-ticks', rssAttempts: 9999, pid: 9999,
    });
    const read = (file: string) => { if (file === '/proc/100/status' && !injected) { injected = true; throw privateError; } return fake.read(file); };
    const sample = createTreeSampler(100, { ...fake, read });
    const serialized: string[] = [];
    const result = await measureCommand(command('process.exit(0)'), {
      env: environment(temporary()), platform: 'linux', write: (_file, value) => { serialized.push(JSON.stringify(value)); },
      samplerFactory: () => () => samples++ === 0 ? sample() : {
        rssBytes: 0, processCount: 0, taskCount: 0, exitRaces: 0, durationMs: 0,
        exitVerificationCount: 0, exitVerificationWallMs: 0, lastExitVerification: null,
        recoveryCount: 0, recoveryWallMs: 0, lastRecovery: null,
      },
    });
    expect(result.code).toBe(0);
    expect(result.report.status).toBe(recovers ? 'complete' : 'unavailable');
    expect(result.report.recoveryCount).toBe(1);
    const diagnostic = result.report.lastRecovery as RecoveryDiagnostic;
    expect(diagnostic).toMatchObject({ outcome: recovers ? 'rss-recovered' : 'unconfirmed', initialPhase: 'group-status', initialCause: 'ENOENT' });
    expect(Object.keys(diagnostic).sort()).toEqual(['outcome', 'elapsedMs', 'checks', 'trace', 'initialPhase', 'initialCause', 'rssAttempts'].sort());
    expect(diagnostic.rssAttempts).toBeGreaterThanOrEqual(2);
    expect(diagnostic.rssAttempts).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks + 1);
    expect(diagnostic.checks).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks);
    expect(diagnostic.trace).toHaveLength(diagnostic.checks);
    for (const point of diagnostic.trace) expect(Object.keys(point).sort()).toEqual(['atMs', 'state', 'exitFlag', 'nonTerminalTasks', 'stableTasks'].sort());
    expect(JSON.stringify(diagnostic)).not.toMatch(/pid|\/proc|9999|private-start-ticks|startTicks/i);
    expect(serialized.every((value) => !/private-start-ticks|\/proc\//.test(value))).toBe(true);
  });
  it.each([
    ['first-list', 'EACCES'], ['second-list', 'EACCES'],
    ...['first-task-stat', 'second-task-stat'].flatMap((failure) => ['EACCES', 'ENOENT', 'ESRCH'].map((code) => [failure, code])),
  ])('preserves unknown task counters as null after failed terminal verification: %s %s', async (failure, code) => {
    const fake = fakeTree(); let enumerations = 0;
    fake.files['/proc/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/status'] = procStatus(100, undefined, 'Z');
    fake.files['/proc/100/task/100/stat'] = stat(process.pid, '1000', 'Z');
    fake.files['/proc/100/task/102/stat'] = stat(process.pid, '1002', 'Z', 102);
    const list = (file: string) => {
      if (file !== '/proc/100/task') return fake.list(file);
      enumerations++;
      if ((failure === 'first-list' && enumerations === 2) || (failure === 'second-list' && enumerations === 3)) throw procError(code);
      return ['100', '102'];
    };
    const read = (file: string) => {
      if (file === '/proc/100/task/102/stat' && ((failure === 'first-task-stat' && enumerations >= 2) || (failure === 'second-task-stat' && enumerations >= 3))) throw procError(code);
      return fake.read(file);
    };
    const result = await measureCommand(command('process.exit(0)'), {
      env: environment(temporary()), platform: 'linux', samplerFactory: () => createTreeSampler(100, { ...fake, read, list }), write: () => {},
    });
    expect(result.code).toBe(0);
    expect(result.report.status).toBe('unavailable');
    expect(result.report.peakRssBytes).toBeNull();
    expect(result.report.errors).toEqual([code === 'EACCES' ? 'PROC_READ_FAILED' : 'MISSING_RSS', 'NO_MEMORY_SAMPLES']);
    expect(result.report.lastExitVerification).toMatchObject({ outcome: code === 'EACCES' ? 'read-error' : 'unconfirmed' });
    const diagnostic = result.report.lastExitVerification as ExitVerification;
    expect(diagnostic.checks).toBeGreaterThan(0);
    expect(diagnostic.checks).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks);
    expect(diagnostic.trace).toHaveLength(diagnostic.checks);
    expect(diagnostic.trace.every((point) => point.nonTerminalTasks === null && point.stableTasks === null)).toBe(true);
  });
});

describe.runIf(process.platform === 'linux')('transparent command wrapper', () => {
  it('measures touched child allocations or explicitly rejects an unsupported kernel', async () => {
    const directory = temporary();
    const worker = 'globalThis.memory=Buffer.alloc(48*1024*1024, 1);setTimeout(()=>{}, 1100)';
    const code = `const{spawn}=require('node:child_process');for(let i=0;i<2;i++)spawn(process.execPath,['-e',${JSON.stringify(worker)}],{stdio:'inherit'});`;
    const result = await measureCommand(command(code), { env: environment(directory) });
    expect(result).toMatchObject({ code: 0, signal: null });
    const report = readReport(directory);
    if (!fs.existsSync(`/proc/self/task/${process.pid}/children`)) {
      expect(report).toMatchObject({ status: 'unavailable', peakRssBytes: null, sampleCount: 0 });
      expect(report.errors).toContain('CHILD_DISCOVERY_UNAVAILABLE');
      return;
    }
    expect(report).toMatchObject({ status: 'complete', method: MEMORY_METHOD, errors: [], cleanupRequired: false });
    expect(report.sampleCount).toBeGreaterThanOrEqual(3);
    expect(report.peakProcessCount).toBe(3);
    expect(report.peakRssBytes).toBeGreaterThan(96 * 1024 * 1024);
    expect(report.sensorMaxRssBytes).toBeGreaterThan(0);
  });
  it.each([0, 23])('sensor failure retains functional exit %s and emits unavailable evidence', async (code) => {
    const directory = temporary();
    const result = await measureCommand(command(`process.exit(${code})`), { env: environment(directory), samplerFactory: () => () => { throw Object.assign(new Error('never serialize private details'), { code: 'EACCES' }); } });
    expect(result.code).toBe(code);
    expect(readReport(directory)).toMatchObject({ status: 'unavailable', errors: ['PROC_READ_FAILED', 'NO_MEMORY_SAMPLES'], peakRssBytes: null });
    expect(fs.readFileSync(reportFile(directory), 'utf8')).not.toContain('private details');
  });
  it('write failure and unsupported sensing cannot change command success', async () => {
    const before = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => process.listenerCount(signal));
    const result = await measureCommand(command('process.exit(0)'), { env: environment(temporary()), platform: 'darwin', write: () => { throw new Error('disk full'); } });
    expect(result.code).toBe(0);
    expect(result.report).toMatchObject({ status: 'unavailable', peakRssBytes: null });
    expect(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => process.listenerCount(signal))).toEqual(before);
  });
  it('retains the primary sensor failure without inventing a gap after sampling was disabled', async () => {
    let clockCalls = 0;
    const result = await measureCommand(command('process.exit(0)'), {
      env: environment(temporary()), now: () => [0, 10, 100_000][Math.min(clockCalls++, 2)],
      samplerFactory: () => () => { throw Object.assign(new Error('no RSS'), { code: 'MISSING_RSS' }); },
    });
    expect(result.code).toBe(0);
    expect(result.report).toMatchObject({ status: 'unavailable', errors: ['MISSING_RSS', 'NO_MEMORY_SAMPLES'], maxObservedGapMs: 10, elapsedMs: 100_000 });
  });
  it('records bounded non-sensitive state diagnostics when a live process never confirms exit', async () => {
    const result = await measureCommand(command('setTimeout(()=>{},150)'), {
      env: environment(temporary()),
      samplerFactory: (rootPid) => createTreeSampler(rootPid, { read: (file, encoding) => {
        const root = `/proc/${rootPid}/`;
        const relative = file.startsWith(root) ? file.slice(root.length) : '';
        // The fixture command has no descendants. Isolate its RSS failure
        // from sandbox kernels that omit the task/children interface.
        if (/^task\/\d+\/children$/.test(relative)) return '';
        const content = fs.readFileSync(file, encoding as BufferEncoding);
        // Preserve real Pid/Tgid fields while hiding RSS from every candidate,
        // including the leader alias and surviving non-main threads.
        return /^(?:status|task\/\d+\/status)$/.test(relative)
          ? content.replace(/^VmRSS:[^\n]*(?:\n|$)/gm, '') : content;
      } }),
    });
    expect(result.code).toBe(0);
    expect(result.report).toMatchObject({ status: 'unavailable', lastExitVerification: { outcome: 'unconfirmed' } });
    const diagnostic = result.report.lastExitVerification as { elapsedMs: number; checks: number; trace: object[] };
    expect(diagnostic.checks).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks);
    expect(diagnostic.trace.length).toBe(diagnostic.checks);
    expect(JSON.stringify(diagnostic)).not.toMatch(/pid|environ|cmdline|\/proc|startTicks/i);
    expect(Number(result.report.samplingWallMs)).toBeGreaterThanOrEqual(diagnostic.elapsedMs);
  });
  it('does not mistake spawn failure for functional success', async () => {
    const result = await measureCommand(['/nonexistent/ci-memory-command'], { env: environment(temporary()) });
    expect(result.code).toBe(127);
    expect(result.report.status).toBe('unavailable');
  });
  it.each([['USR1', 138], ['PIPE', 141]])('retains shell exit semantics for %s without triggering Node reserved signal behavior', async (signal, expected) => {
    const directory = temporary();
    const wrapper = spawn(process.execPath, ['scripts/ci/measure-vitest-memory.mjs', '--', '/bin/sh', '-c', `kill -${signal} $$`], { env: environment(directory), stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = ''; wrapper.stderr.on('data', (data) => { stderr += data; });
    const result = await new Promise((resolve) => wrapper.once('close', (code, signal) => resolve({ code, signal })));
    expect(result).toEqual({ code: expected, signal: null });
    expect(stderr).not.toContain('Debugger');
    expect(readReport(directory).commandExit.signal).toBe(`SIG${signal}`);
  });
  it('cleans leaked process-group descendants without changing command exit code', async () => {
    const directory = temporary();
    const pidFile = path.join(directory, 'child.pid');
    const code = `const{spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{}, 1000)'],{stdio:'inherit'});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();setTimeout(()=>process.exit(0),350);`;
    const result = await measureCommand(command(code), { env: environment(directory) });
    expect(result.code).toBe(0);
    expect(readReport(directory)).toMatchObject({ cleanupRequired: true });
    expect(readReport(directory).status).not.toBe('complete');
    expect(readReport(directory).errors).toContain('DESCENDANTS_AFTER_COMMAND_EXIT');
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    try { expect(['Z', 'X']).toContain(parseIdentity(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')).state); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  });
  it('invalidates a known detached survivor even after the original process group disappears', async () => {
    const directory = temporary(); const pidFile = path.join(directory, 'detached.pid');
    const code = `const{spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{stdio:'ignore',detached:true});require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();setTimeout(()=>process.exit(0),600);`;
    try {
      const result = await measureCommand(command(code), {
        env: environment(directory),
        // Local sandbox lacks task/children: emulate only child enumeration
        // for these two fixture-owned PIDs. Identity/RSS/task reads are real.
        samplerFactory: (rootPid) => createTreeSampler(rootPid, { read: (file, encoding) => {
          if (file.endsWith('/children')) {
            const parts = file.split('/');
            return Number(parts[2]) === rootPid && parts[2] === parts[4] && fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8') : '';
          }
          return fs.readFileSync(file, encoding as BufferEncoding);
        } }),
      });
      expect(result.code).toBe(0);
      expect(readReport(directory)).toMatchObject({ status: 'incomplete', cleanupRequired: true, peakProcessCount: 2 });
      expect(readReport(directory).errors).toContain('DESCENDANTS_AFTER_COMMAND_EXIT');
    } finally {
      if (fs.existsSync(pidFile)) { try { process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch { /* already exited */ } }
    }
  });
  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'] as const)('forwards and preserves %s, even when the command traps it and exits zero', async (signal) => {
    const directory = temporary();
    const code = `process.on('${signal}',()=>process.exit(0));console.log('READY');setInterval(()=>{},1000)`;
    const wrapper = spawn(process.execPath, ['scripts/ci/measure-vitest-memory.mjs', '--', ...command(code)], { env: environment(directory), stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise<{ code: number | null; signal: string | null }>((resolve) => wrapper.once('close', (code, signal) => resolve({ code, signal })));
    await new Promise<void>((resolve) => wrapper.stdout.once('data', () => resolve()));
    wrapper.kill(signal);
    expect(await closed).toEqual({ code: null, signal });
    expect(readReport(directory)).toMatchObject({ cancelledSignal: signal, commandExit: { code: 0, signal: null } });
    expect(readReport(directory).status).not.toBe('complete');
    expect(fs.readdirSync(directory).some((file) => file.endsWith('.tmp'))).toBe(false);
  });
  it('bounds cancellation cleanup when the command ignores TERM', async () => {
    const directory = temporary();
    const wrapper = spawn(process.execPath, ['scripts/ci/measure-vitest-memory.mjs', '--', ...command("process.on('SIGTERM',()=>{});console.log('READY');setInterval(()=>{},1000)")], { env: environment(directory), stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise<string | null>((resolve) => wrapper.once('close', (_code, signal) => resolve(signal)));
    await new Promise<void>((resolve) => wrapper.stdout.once('data', () => resolve()));
    wrapper.kill('SIGTERM');
    expect(await closed).toBe('SIGTERM');
    expect(readReport(directory)).toMatchObject({ cancelledSignal: 'SIGTERM', commandExit: { code: null, signal: 'SIGKILL' } });
    expect(readReport(directory).status).not.toBe('complete');
  });
  it('leaves explicit running evidence on abrupt SIGKILL instead of fabricating completion', async () => {
    const directory = temporary();
    const wrapper = spawn(process.execPath, ['scripts/ci/measure-vitest-memory.mjs', '--', ...command("console.log(process.pid);setInterval(()=>{},1000)")], { env: environment(directory), stdio: ['ignore', 'pipe', 'pipe'] });
    const closed = new Promise<string | null>((resolve) => wrapper.once('close', (_code, signal) => resolve(signal)));
    const childPid = await new Promise<number>((resolve) => wrapper.stdout.once('data', (data) => resolve(Number(String(data).trim()))));
    try {
      wrapper.kill('SIGKILL');
      // SIGKILL has no handler. Fixture owns cleanup of the process group.
      process.kill(-childPid, 'SIGKILL');
      expect(await closed).toBe('SIGKILL');
      expect(readReport(directory).status).toBe('running');
    } finally {
      try { process.kill(-childPid, 'SIGKILL'); } catch { /* already exited */ }
      wrapper.kill('SIGKILL');
    }
  });
});
