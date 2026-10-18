#!/usr/bin/env node
// Four paired sessions per integration; never edits a product file.
import assert from 'node:assert/strict';
import { fork, execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { isolatedEnvironment } from './integration.mjs';
import { repo, relative, contained, order, warmups, measured, targetFor, probeCss, fixtureHtml, sourceSnapshot, statistics, installedVersions, sha256, evidence, redactText } from './hmr-common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arguments_ = process.argv.slice(2);
if (arguments_.includes('--help')) {
  console.log('Usage: node docs/qa/tailwind-integration-20261017/run-hmr.mjs --output reports/tailwind-integration/hmr-series');
  process.exit(0);
}
assert(arguments_.length === 2 && arguments_[0] === '--output', 'Provide --output <new empty reports directory>');
const output = path.resolve(repo, arguments_[1]);
assert(contained(path.join(repo, 'reports'), output), 'Output must be a subdirectory of ignored reports/');
assert.equal(execFileSync('git', ['check-ignore', '--no-index', relative(output)], { cwd: repo, encoding: 'utf8' }).trim(), relative(output), 'Output must be gitignored');
await mkdir(output, { recursive: true });
assert.equal((await readdir(output)).length, 0, 'Output must be empty: preserve prior runs and use a new output directory');

function bounded(promise, milliseconds, description) {
  let timeout;
  return Promise.race([promise, new Promise((_resolve, reject) => { timeout = setTimeout(() => reject(new Error(`Timeout: ${description}`)), milliseconds); })]).finally(() => clearTimeout(timeout));
}

function channel(child) {
  const history = [];
  const waiting = new Set();
  let fatal;
  let exited;
  const exitPromise = new Promise(resolve => {
    child.once('exit', (code, signal) => { exited = { code, signal }; resolve(exited); check(); });
  });
  const closePromise = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  function check() {
    for (const pending of waiting) {
      const found = history.find(pending.predicate);
      if (found) { waiting.delete(pending); pending.resolve(found); }
      else if ((!pending.allowFatal && fatal) || exited) {
        waiting.delete(pending);
        pending.reject(new Error(fatal ?? `Session process exited before requested message (${exited?.code}/${exited?.signal})`));
      }
    }
  }
  child.on('message', message => {
    history.push({ ...message, parentReceiptPerformanceMs: performance.now() });
    if (message.type === 'fatal') fatal = message.error;
    check();
  });
  child.on('error', error => { fatal = error.message; check(); });
  return {
    history, exitPromise, closePromise,
    waitFor(type, id, milliseconds = 30_000, allowFatal = false) {
      const result = bounded(new Promise((resolve, reject) => {
        const pending = { predicate: message => message.type === type && (id === undefined || message.id === id), resolve, reject, allowFatal };
        waiting.add(pending);
        check();
      }), milliseconds, `${type}${id ? ` ${id}` : ''}`);
      // A fatal IPC message may arrive during an awaited file write; keep the
      // promise handled until the caller observes its rejection below.
      void result.catch(() => {});
      return result;
    },
  };
}

async function harnessHashes() {
  const names = ['run-hmr.mjs', 'hmr-common.mjs', 'hmr-client.mjs', 'hmr-session.mjs', 'integration.mjs'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, sha256(await readFile(path.join(here, name)))])));
}

async function runSession(pair, position, variant) {
  const id = `pair-${String(pair).padStart(2, '0')}-${position}-${variant}`;
  const directory = path.join(output, id);
  const fixture = path.join(directory, 'fixture');
  const probe = path.join(fixture, 'probe.css');
  const html = path.join(fixture, 'index.html');
  const cache = path.join(directory, 'cache/vite');
  await mkdir(fixture, { recursive: true });
  const initialCss = probeCss(probe, targetFor(0));
  await writeFile(probe, initialCss, { flag: 'wx' });
  await writeFile(html, fixtureHtml(), { flag: 'wx' });
  const clientBytes = await readFile(path.join(here, 'hmr-client.mjs'));
  await writeFile(path.join(fixture, 'probe.mjs'), clientBytes, { flag: 'wx' });
  const config = { id, variant, html, probe, cache, expectedEdits: warmups + measured };
  const configFile = path.join(directory, 'session-config.json');
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  const session = {
    id, pair, position, variant, startedAt: new Date().toISOString(), passed: false,
    fixture: { directory: relative(fixture), htmlSha256: sha256(fixtureHtml()), moduleSha256: sha256(clientBytes), initialProbeSha256: sha256(initialCss), sourceImport: relative(path.join(repo, 'src/index.css')) },
    updates: [], errors: [], sourceBefore: await sourceSnapshot(),
    process: { node: process.version, newProcess: true, freshVite: true, freshBrowser: true, freshContext: true, cacheDir: relative(cache), environment: 'isolatedEnvironment(development); no .env files', optimizerDisabledBothArms: true },
  };
  console.log(`[hmr] starting ${id}`);
  const child = fork(path.join(here, 'hmr-session.mjs'), [configFile], {
    cwd: repo, execPath: process.execPath, env: isolatedEnvironment('development'),
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  session.process.pid = child.pid;
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const messages = channel(child);
  try {
    const ready = await messages.waitFor('ready', undefined, 90_000);
    session.ready = { initial: ready.initial, config: ready.config, chromium: ready.chromium };
    for (let step = 1; step <= warmups + measured; step += 1) {
      const expected = { ...targetFor(step), id: `${id}:step-${step}` };
      const content = probeCss(probe, expected);
      const update = { step, stage: step <= warmups ? 'warmup-discarded' : 'measured', expected, probeSha256: sha256(content), probeBytes: Buffer.byteLength(content), passed: false };
      session.updates.push(update);
      const armed = messages.waitFor('armed', expected.id);
      child.send({ type: 'arm', expected });
      update.arm = (await armed).state;
      const acknowledgement = messages.waitFor('verified', expected.id);
      update.writeStartedAt = new Date().toISOString();
      // Primary timer begins immediately before the ONLY edited file write.
      // Both endpoints use this parent process monotonic clock, including IPC.
      const beforeWrite = performance.now();
      await writeFile(probe, content);
      const afterWrite = performance.now();
      const ack = await acknowledgement;
      update.primaryLatencyMs = ack.parentReceiptPerformanceMs - beforeWrite;
      update.writeDurationMs = afterWrite - beforeWrite;
      update.parentClock = { beforeWrite, afterWrite, acknowledgementReceived: ack.parentReceiptPerformanceMs };
      update.verification = ack.verification;
      update.watcherChanges = ack.watcherChanges;
      const persisted = await readFile(probe);
      assert.equal(sha256(persisted), update.probeSha256, 'Probe bytes changed unexpectedly');
      assert(update.primaryLatencyMs > 0 && ack.watcherChanges.length > 0);
      update.passed = true;
    }
  } catch (error) {
    session.errors.push(error.stack ?? error.message);
  } finally {
    try {
      const finished = messages.waitFor('finished', undefined, 25_000, true);
      if (child.connected) child.send({ type: 'stop' });
      session.child = (await finished).report;
    } catch (error) { session.errors.push(`Final report: ${error.message}`); }
    try { session.process.exit = await bounded(messages.exitPromise, 15_000, 'child process shutdown'); }
    catch (error) {
      session.errors.push(error.message);
      session.process.forcedKill = true;
      // Only the PID created immediately above and its descendants are targets.
      // A failed teardown aborts the series, never starts the next session.
      try {
        if (child.exitCode === null && child.signalCode === null) {
          if (process.platform === 'win32') {
            session.process.forcedTreeKillOutput = execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
          } else {
            // Child is a dedicated detached process group on POSIX (see fork).
            process.kill(-child.pid, 'SIGKILL');
          }
        }
        session.process.exit = await bounded(messages.exitPromise, 10_000, 'forced process shutdown');
      } catch (killError) { session.errors.push(`Forced teardown: ${killError.message}`); }
    }
    try { session.process.close = await bounded(messages.closePromise, 5_000, 'child stdio close'); }
    catch (error) { session.errors.push(error.message); }
    session.child ??= messages.history.find(message => message.type === 'finished')?.report;
    // Flush logs only after the server exits. No HTML/JS/JSON/log file other
    // than probe.css is written while the watcher is active.
    await writeFile(path.join(directory, 'node.stdout.log'), redactText(Buffer.concat(stdout).toString('utf8')), { flag: 'wx' });
    await writeFile(path.join(directory, 'node.stderr.log'), redactText(Buffer.concat(stderr).toString('utf8')), { flag: 'wx' });
    session.messages = messages.history;
    session.fixture.probeAfterEditsSha256 = sha256(await readFile(probe));
    // Child server/browser are stopped before restoration, avoiding an extra
    // unmeasured update. Product source has never been written by this tool.
    if (session.process.close && (session.child || session.process.forcedKill)) {
      await writeFile(probe, initialCss);
      session.fixture.restoredProbeSha256 = sha256(await readFile(probe));
      session.fixture.restored = session.fixture.restoredProbeSha256 === session.fixture.initialProbeSha256;
    } else {
      session.fixture.restored = false;
      session.fixture.restorationDeferred = 'Process/server shutdown not confirmed; product source was never edited';
    }
    session.sourceAfter = await sourceSnapshot();
    session.sourceUnchanged = session.sourceBefore.sha256 === session.sourceAfter.sha256;
    session.productFilesWritten = [];
    session.statisticsMs = statistics(session.updates.filter(update => update.stage === 'measured' && update.passed).map(update => update.primaryLatencyMs));
    session.passed = session.errors.length === 0 && session.child?.passed === true
      && !messages.history.some(message => message.type === 'fatal')
      && session.process.exit?.code === 0 && session.updates.length === warmups + measured
      && session.updates.every(update => update.passed) && session.fixture.restored && session.sourceUnchanged;
    session.finishedAt = new Date().toISOString();
    await writeFile(path.join(directory, 'session.json'), `${JSON.stringify(evidence(session), null, 2)}\n`, { flag: 'wx' });
    console.log(`[hmr] ${id}: ${session.passed ? 'PASS' : 'FAIL'}`);
  }
  return session;
}

function summarize(sessions) {
  const variants = {};
  for (const variant of ['postcss', 'vite']) {
    const group = sessions.filter(session => session.variant === variant);
    const updates = group.flatMap(session => session.updates.filter(update => update.stage === 'measured'));
    assert.equal(group.length, 4);
    assert.equal(updates.length, 20);
    assert(updates.every(update => update.passed));
    variants[variant] = {
      measuredUpdates: updates.length, independentSessions: group.length,
      pooledUpdateStatisticsMs: statistics(updates.map(update => update.primaryLatencyMs)),
      sessionMedianStatisticsMs: statistics(group.map(session => session.statisticsMs.median)),
      sessions: group.map(session => ({ id: session.id, pair: session.pair, position: session.position, statisticsMs: session.statisticsMs })),
    };
  }
  const pairs = order.map((_ordered, index) => {
    const pair = index + 1;
    const baseline = sessions.find(session => session.pair === pair && session.variant === 'postcss');
    const candidate = sessions.find(session => session.pair === pair && session.variant === 'vite');
    return { pair, order: order[index], postcssMedianMs: baseline.statisticsMs.median, viteMedianMs: candidate.statisticsMs.median,
      viteMinusPostcssMedianMs: candidate.statisticsMs.median - baseline.statisticsMs.median,
      viteToPostcssMedianRatio: candidate.statisticsMs.median / baseline.statisticsMs.median };
  });
  return { variants, pairs,
    pairedMedianDifferencesMs: statistics(pairs.map(pair => pair.viteMinusPostcssMedianMs)),
    pairedMedianRatios: statistics(pairs.map(pair => pair.viteToPostcssMedianRatio)),
    interpretation: 'Four paired sessions are the replication units; 20 updates per variant are clustered within them. Descriptive pilot only, no significance or stable tail-latency claim. Lower latency in this instrumented CSS fixture does not establish app HMR or new utility generation performance.' };
}

const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(), passed: false,
  command: [path.basename(process.execPath), relative(fileURLToPath(import.meta.url)), ...arguments_],
  baseSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  node: process.version, versions: await installedVersions(),
  design: { pairedOrder: order, warmupsDiscardedPerSession: warmups, measuredEditsPerSession: measured, expectedMeasuredEditsPerVariant: 20,
    metric: 'Parent Node performance.now immediately before writeFile(probe.css) through receipt of child IPC ACK after Playwright-verified computed style/geometry following two RAF. Includes file write, watcher, Tailwind/Vite processing, routed HTTP/WS, layout/frames, Playwright and IPC. No clock-domain subtraction.',
    cache: 'Fresh child Node/Vite/browser/context and unique Vite cacheDir every session. No OS filesystem cache, thermal, antivirus or machine-load reset. Two warmup edits discarded, fully retained in raw data.',
    scope: 'Synthetic unlayered ID rule appended to probe.css importing real src/index.css; no product writes and no new utility classes. No application JS/backend/auth. Dependency optimizer disabled in both arms. CSS dev source maps remain false.' },
  officialApis: [
    'https://vite.dev/guide/api-javascript#createserver',
    'https://vite.dev/guide/api-hmr#hot-on-event-cb',
    'https://vite.dev/guide/api-hmr#hot-send-event-data',
    'https://vite.dev/config/dep-optimization-options#optimizedeps-nodiscovery',
    'https://playwright.dev/docs/api/class-browsercontext#browser-context-route',
    'https://playwright.dev/docs/api/class-route#route-fetch',
    'https://playwright.dev/docs/api/class-websocketroute#web-socket-route-connect-to-server',
  ],
  sourceBefore: await sourceSnapshot(), harnessBefore: await harnessHashes(), sessions: [], errors: [],
};
try {
  for (let pair = 1; pair <= order.length; pair += 1) {
    for (let position = 1; position <= 2; position += 1) {
      const session = await runSession(pair, position, order[pair - 1][position - 1]);
      report.sessions.push(session);
      assert(session.passed, `Session failed: ${session.id}; raw results retained, series stops`);
      assert.equal(session.sourceBefore.sha256, report.sourceBefore.sha256, 'Product sources changed between sessions');
    }
  }
  report.statistics = summarize(report.sessions);
  report.passed = true;
} catch (error) { report.errors.push(error.stack ?? error.message); }
finally {
  report.sourceAfter = await sourceSnapshot();
  report.harnessAfter = await harnessHashes();
  report.sourceUnchanged = report.sourceBefore.sha256 === report.sourceAfter.sha256;
  report.harnessUnchanged = JSON.stringify(report.harnessBefore) === JSON.stringify(report.harnessAfter);
  report.passed = report.passed && report.sourceUnchanged && report.harnessUnchanged;
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(output, 'series.json'), `${JSON.stringify(evidence(report), null, 2)}\n`, { flag: 'wx' });
}
console.log(JSON.stringify({ passed: report.passed, sessions: report.sessions.length, output: relative(path.join(output, 'series.json')) }));
if (!report.passed) process.exitCode = 1;
