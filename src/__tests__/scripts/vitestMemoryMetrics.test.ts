// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createTreeSampler, measureCommand, MEMORY_METHOD, parseIdentity } from '../../../scripts/ci/measure-vitest-memory.mjs';

const directories: string[] = [];
const temporary = () => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-memory-')); directories.push(directory); return directory; };
const environment = (directory: string) => ({ ...process.env, CI_EVIDENCE_DIR: directory, CI_TEST_SHARD: '1/5', CI_TEST_MAX_PARALLEL: '5', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'workflow_dispatch' });
const reportFile = (directory: string) => path.join(directory, 'vitest-memory-1-of-5.json');
const readReport = (directory: string) => JSON.parse(fs.readFileSync(reportFile(directory), 'utf8'));
const command = (code: string) => [process.execPath, '-e', code];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

function stat(parent: number, start: string, state = 'S') {
  const fields = Array(22).fill('0'); fields[0] = state; fields[1] = String(parent); fields[19] = start;
  return `100 (fixture ) name) ${fields.join(' ')}`;
}
function fakeTree() {
  let clock = 0;
  const files: Record<string, string> = {
    '/proc/100/stat': stat(process.pid, '1000'), '/proc/100/status': 'VmRSS: 10 kB',
    '/proc/100/task/100/children': '', '/proc/100/task/102/children': '101',
    '/proc/101/stat': stat(100, '1001'), '/proc/101/status': 'VmRSS: 25 kB', '/proc/101/task/101/children': '',
  };
  const reads: string[] = [];
  const read = (file: string) => { reads.push(file); if (!(file in files)) throw Object.assign(new Error('gone'), { code: 'ENOENT' }); return files[file]; };
  const list = (file: string) => file === '/proc/100/task' ? ['100', '102'] : ['101'];
  return { files, reads, read, list, now: () => clock, pause: (ms: number) => { clock += ms; } };
}

describe('job-scoped process tree sampling', () => {
  it('parses identity without retaining process names, and finds children of non-main threads', () => {
    expect(parseIdentity(stat(100, '456'))).toEqual({ parent: 100, start: '456', state: 'S' });
    const fake = fakeTree();
    expect(createTreeSampler(100, fake)()).toMatchObject({ rssBytes: 35 * 1024, processCount: 2, taskCount: 3 });
    expect(fake.reads.every((file) => /^\/proc\/(100|101)\/(stat|status|task\/\d+\/children)$/.test(file))).toBe(true);
  });
  it('keeps observed orphans and rejects reused PIDs before counting their memory', () => {
    const fake = fakeTree(); const sample = createTreeSampler(100, fake);
    sample(); fake.files['/proc/101/stat'] = stat(1, '1001'); fake.files['/proc/100/task/102/children'] = '';
    expect(sample().processCount).toBe(2);
    fake.files['/proc/101/stat'] = stat(1, '2000');
    expect(sample).toThrow('PID_REUSED');
  });
  it('rejects a reused/unrelated root before any RSS read and an empty live task list', () => {
    const fake = fakeTree(); fake.files['/proc/100/stat'] = stat(1, '1000');
    expect(createTreeSampler(100, fake)).toThrow('UNVERIFIED_ROOT');
    expect(fake.reads).toEqual(['/proc/100/stat']);
    fake.files['/proc/100/stat'] = stat(process.pid, '1000');
    expect(createTreeSampler(100, { ...fake, list: () => [] })).toThrow('EMPTY_TASK_LIST');
  });
  it('treats process-exit races as explicit sampling limits and never fabricates zero measurements', () => {
    const fake = fakeTree(); delete fake.files['/proc/101/stat'];
    expect(createTreeSampler(100, fake)()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
  });
  it.each(['Z', 'X'])('verifies the same generation became %s when VmRSS disappears between stat and status', (state) => {
    const fake = fakeTree(); let childStatReads = 0;
    fake.files['/proc/101/status'] = `State: ${state}\nVmSize: 0 kB`;
    const read = (file: string) => {
      if (file === '/proc/101/stat') return stat(100, '1001', ++childStatReads === 1 ? 'S' : state);
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
    expect(childStatReads).toBe(4);
  });
  it.each(['ENOENT', 'ESRCH'])('handles verified disappearance %s during the missing-RSS recheck', (code) => {
    const fake = fakeTree(); let childStatReads = 0;
    fake.files['/proc/101/status'] = 'State: S\nVmSize: 0 kB';
    const read = (file: string) => {
      if (file === '/proc/101/stat' && ++childStatReads === 2) throw Object.assign(new Error('exited'), { code });
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read })()).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1 });
  });
  it.each(['live', 'reused-zombie', 'permission', 'invalid-stat'])('does not excuse missing RSS after a %s recheck', (change) => {
    const fake = fakeTree(); let childStatReads = 0;
    // Even a status that says zombie does not suffice without identity/state
    // verification from stat; malformed/inconsistent reads remain restrictive.
    fake.files['/proc/101/status'] = 'State: Z\nVmSize: 0 kB';
    const read = (file: string) => {
      if (file === '/proc/101/stat' && ++childStatReads === 2) {
        if (change === 'reused-zombie') return stat(100, '2000', 'Z');
        if (change === 'permission') throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
        if (change === 'invalid-stat') return 'malformed';
      }
      return fake.read(file);
    };
    const expected = { live: 'MISSING_RSS', 'reused-zombie': 'PID_REUSED', permission: 'permission denied', 'invalid-stat': 'INVALID_PROC_STAT' }[change];
    expect(createTreeSampler(100, { ...fake, read })).toThrow(expected);
  });
  it('waits a bounded time for verified whole-process exit without publishing partial RSS', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = 'State: R';
    const read = (file: string) => file === '/proc/101/stat' ? stat(100, '1001', fake.now() >= 3 ? 'Z' : 'R') : fake.read(file);
    const result = createTreeSampler(100, { ...fake, read })();
    expect(result).toMatchObject({ rssBytes: 10 * 1024, processCount: 1, exitRaces: 1, exitVerificationCount: 1, exitVerificationWallMs: 3 });
    expect(result.lastExitVerification).toMatchObject({ outcome: 'terminal', elapsedMs: 3, checks: 4 });
    expect(result.lastExitVerification?.trace.map((point) => point.state)).toEqual(['R', 'R', 'R', 'Z']);
  });
  it.each(['S', 'Z'])('does not discard a zombie leader while another thread is %s unless the entire group is terminal', (state) => {
    const fake = fakeTree(); fake.files['/proc/101/stat'] = stat(100, '1001', 'Z');
    fake.files['/proc/101/task/103/stat'] = stat(100, '1003', state);
    const sample = createTreeSampler(100, { ...fake, list: (file) => file === '/proc/101/task' ? ['101', '103'] : fake.list(file) });
    if (state === 'S') { expect(sample).toThrow('MISSING_RSS'); expect(fake.now()).toBe(25); }
    else expect(sample()).toMatchObject({ processCount: 1, exitVerificationCount: 1, lastExitVerification: { outcome: 'terminal' } });
  });
  it('does not miss a live thread added between task enumerations', () => {
    const fake = fakeTree(); let lists = 0;
    fake.files['/proc/101/stat'] = stat(100, '1001', 'Z');
    fake.files['/proc/101/task/103/stat'] = stat(100, '1003', 'S');
    const list = (file: string) => file === '/proc/101/task' ? (++lists === 1 ? ['101'] : ['101', '103']) : fake.list(file);
    expect(createTreeSampler(100, { ...fake, list })).toThrow('MISSING_RSS');
  });
  it('rechecks TGID generation after the terminal task group was re-enumerated', () => {
    const fake = fakeTree(); let reads = 0;
    fake.files['/proc/101/status'] = 'State: Z';
    const read = (file: string) => file === '/proc/101/stat' ? stat(100, ++reads === 4 ? '2000' : '1001', reads === 1 ? 'S' : 'Z') : fake.read(file);
    expect(createTreeSampler(100, { ...fake, read })).toThrow('PID_REUSED');
  });
  it('does not certify exit from PF_EXITING alone and bounds checks even if a test clock stalls', () => {
    const fake = fakeTree(); let reads = 0; let pauses = 0;
    fake.files['/proc/101/status'] = 'State: R';
    const read = (file: string) => {
      if (file === '/proc/101/stat') { reads++; const fields = stat(100, '1001', 'R').split(') '); const tail = fields.pop()!.split(' '); tail[6] = '4'; return `${fields.join(') ')}) ${tail.join(' ')}`; }
      return fake.read(file);
    };
    expect(createTreeSampler(100, { ...fake, read, pause: () => { pauses++; } })).toThrow('MISSING_RSS');
    expect(pauses).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks);
    expect(reads).toBeLessThanOrEqual(MEMORY_METHOD.exitMaxChecks + 1);
  });
  it('keeps deferred classification inside the existing overall sample budget', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = 'State: S';
    const read = (file: string) => { if (file === '/proc/100/status') fake.pause(40); return fake.read(file); };
    expect(createTreeSampler(100, { ...fake, read })).toThrow('MISSING_RSS');
    expect(fake.now()).toBeLessThanOrEqual(MEMORY_METHOD.maxSampleMs);
  });
  it('rejects malformed counters, unverified descendants and exceeded sampling budgets', () => {
    const fake = fakeTree(); fake.files['/proc/101/status'] = 'VmSize: 100 kB';
    expect(createTreeSampler(100, fake)).toThrow('MISSING_RSS');
    fake.files['/proc/101/stat'] = stat(999, '1001');
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
      if (file.endsWith('/stat')) return stat(pid === 100 ? process.pid : 100, String(pid));
      if (file.endsWith('/status')) return 'VmRSS: 10 kB';
      return pid === 100 ? Array.from({ length: 512 }, (_, index) => String(101 + index)).join(' ') : '';
    };
    expect(createTreeSampler(100, { read, list: (file) => [file.split('/')[2]], now: () => 0 })).toThrow('PROCESS_BUDGET_EXCEEDED');
    expect(createTreeSampler(100, { read, list: () => Array.from({ length: 4097 }, (_, index) => String(index + 100)), now: () => 0 })).toThrow('TASK_BUDGET_EXCEEDED');
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
      samplerFactory: (rootPid) => createTreeSampler(rootPid, { read: (file, encoding) => file === `/proc/${rootPid}/status` ? 'State: S' : fs.readFileSync(file, encoding as BufferEncoding) }),
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
