import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { isolatedEnvironment } from './integration.mjs';
import { reportPath, repository, suites } from './ui-suites.mjs';

const experiment = resolve(repository, 'docs/qa/tailwind-integration-20261017');
const playwright = resolve(repository, 'node_modules/@playwright/test/cli.js');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function freePort(preferred = 0) {
  // The strict existing test guards encode audit fixture ports. Never reuse an
  // existing process; an occupied canonical port fails before launching tests.
  const server = createServer();
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: preferred, exclusive: true }, done);
  });
  const port = server.address().port;
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  return port;
}

function quotedCommand(args) {
  // All arguments are controlled paths/identifiers. Reject shell metacharacters
  // instead of interpreting a user-provided command, on both cmd.exe and sh.
  return args.map(value => {
    assert.ok(!/["\r\n%`$&|<>!^]/.test(value), 'Unsafe command argument');
    return `"${value}"`;
  }).join(' ');
}

async function wrapper({ variant, name, directory, port, inventory = false }) {
  const definition = suites[name];
  const baseURL = `http://127.0.0.1:${port}`;
  const command = quotedCommand([process.execPath, resolve(experiment, 'ui-server.mjs'),
    '--variant', variant, '--suite', name, '--port', String(port), '--output', directory]);
  const content = `import assert from 'node:assert/strict';
import original from ${JSON.stringify(pathToFileURL(resolve(repository, definition.config)).href)};
assert.equal(original.workers, 1);
assert.equal(original.retries, 0);
assert.ok(!original.use?.channel && !(original.projects ?? []).some(project => project.use?.channel), 'Only managed Playwright browsers');
export default {
  ...original,
  testDir: ${JSON.stringify(resolve(repository, definition.testDir))},
  outputDir: ${JSON.stringify(resolve(directory, 'test-results'))},
  reporter: [['list'], ['json', { outputFile: ${JSON.stringify(resolve(directory, inventory ? 'inventory.json' : 'results.json'))} }], ['html', { outputFolder: ${JSON.stringify(resolve(directory, inventory ? 'inventory-html' : 'html'))}, open: 'never' }]],
  webServer: {
    ...(Array.isArray(original.webServer) ? {} : original.webServer),
    command: ${JSON.stringify(command)}, cwd: ${JSON.stringify(repository)},
    url: ${JSON.stringify(baseURL + (definition.readyPath ?? '/'))},
    reuseExistingServer: false, timeout: 180000, stdout: 'pipe', stderr: 'pipe',
  },
  use: { ...original.use, baseURL: ${JSON.stringify(baseURL)}, serviceWorkers: 'block', acceptDownloads: false },
};
`;
  const path = resolve(directory, inventory ? 'playwright.inventory.config.mjs' : 'playwright.config.mjs');
  await writeFile(path, content);
  return path;
}

function run(args, environment, logPath) {
  return new Promise((done, reject) => {
    const output = createWriteStream(logPath, { flags: 'wx' });
    const child = spawn(process.execPath, args, { cwd: repository, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { process.stdout.write(chunk); output.write(chunk); });
    child.once('error', error => { output.end(); reject(error); });
    child.once('close', (code, signal) => output.end(() => done({ code, signal })));
  });
}

function flattenedTests(report) {
  const collect = suite => [...(suite.specs ?? []).flatMap(spec => (spec.tests ?? []).map(test => ({ ...test, title: spec.title, file: spec.file, line: spec.line }))), ...(suite.suites ?? []).flatMap(collect)];
  return (report.suites ?? []).flatMap(collect);
}

async function execute({ variant, name, directory, list, firefox }) {
  await mkdir(directory, { recursive: true });
  const port = await freePort(suites[name].port);
  const config = await wrapper({ variant, name, directory, port });
  let blocked = [];
  if (!list && name === 'virtualization' && !firefox.available) {
    const inventory = await wrapper({ variant, name, directory, port, inventory: true });
    const result = await run([playwright, 'test', '--config', inventory, '--list'], isolatedEnvironment(), resolve(directory, 'inventory.log'));
    assert.equal(result.code, 0, 'Full original virtualization inventory must succeed');
    const report = JSON.parse(await readFile(resolve(directory, 'inventory.json'), 'utf8'));
    const all = flattenedTests(report);
    assert.equal(all.length, suites[name].expected, 'Original virtualization inventory changed');
    blocked = all.filter(test => test.projectName === 'firefox').map(test => ({
      title: test.title, file: test.file, line: test.line, projectName: test.projectName,
      status: 'BLOCKED/NOT_RUN', reason: 'Single managed Firefox launch preflight failed; see firefox-preflight.json',
    }));
    assert.equal(blocked.length, 4, 'Exactly four original Firefox cases must be accounted for');
  }
  const args = [playwright, 'test', '--config', config, ...(list ? ['--list'] : []), ...(blocked.length ? ['--project=chromium'] : [])];
  const started = new Date().toISOString();
  const status = await run(args, isolatedEnvironment(suites[name].development ? 'development' : 'production'), resolve(directory, 'playwright.log'));
  let report;
  try { report = JSON.parse(await readFile(resolve(directory, 'results.json'), 'utf8')); }
  catch (error) { return { variant, suite: name, port, started, status, passed: false, error: `Missing/invalid Playwright JSON: ${error.message}` }; }
  const tests = flattenedTests(report);
  const stats = report.stats ?? {};
  const expectedExecuted = suites[name].expected - blocked.length;
  const executionPassed = status.code === 0 && tests.length === expectedExecuted
    && (list || (stats.expected === expectedExecuted && stats.unexpected === 0 && stats.skipped === 0 && stats.flaky === 0));
  const passed = executionPassed && blocked.length === 0;
  return { variant, suite: name, port, started, finished: new Date().toISOString(),
    command: [process.execPath, ...args], status, expected: suites[name].expected,
    listed: tests.length, stats, inventoryOnly: list, passed, executionPassed,
    firefoxBlocked: blocked.length > 0, blocked,
    projects: [...new Set(tests.map(test => test.projectName))],
  };
}

async function main() {
  const { values } = parseArgs({ options: {
    variant: { type: 'string', default: 'both' }, suite: { type: 'string', default: 'all' },
    'run-id': { type: 'string', default: `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}` },
    list: { type: 'boolean', default: false },
    'capture-shared': { type: 'boolean', default: false },
  } });
  assert.ok(['both', 'postcss', 'vite'].includes(values.variant), 'Use --variant both|postcss|vite');
  assert.ok(values.suite === 'all' || Object.hasOwn(suites, values.suite), 'Unknown --suite');
  assert.match(values['run-id'], /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/, 'Invalid --run-id');
  const destination = reportPath(`reports/tailwind-integration/${values['run-id']}`);
  try { await access(destination); throw new Error('Run directory already exists; use a fresh --run-id'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(destination, { recursive: true });
  const summary = {
    started: new Date().toISOString(), inventoryOnly: values.list,
    sha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    lockSha256: sha256(await readFile(resolve(repository, 'bun.lock'))), node: process.version,
    repository, suites: [],
    notes: ['No source tests, snapshots, root Vite/PostCSS, CSS or tokens modified.',
      'Canonical fixture ports checked free before each run; strictPort and reuseExistingServer=false.',
      'All original projects/specs retained; virtualization is 8 (including keyboard-sorting), total is 52 per arm.',
      'Audit and virtualization build fresh into per-run outputs before preview; shared-ui preserves development mode.',
      'Only managed Playwright browsers; no user browser channel or persistent profile.'],
  };
  if (!values.list && (values.suite === 'all' || values.suite === 'virtualization')) {
    await run([resolve(experiment, 'probe-firefox.mjs'), destination], isolatedEnvironment(), resolve(destination, 'firefox-preflight.log'));
    summary.firefox = JSON.parse(await readFile(resolve(destination, 'firefox-preflight.json'), 'utf8'));
  }
  for (const variant of values.variant === 'both' ? ['postcss', 'vite'] : [values.variant]) {
    for (const name of values.suite === 'all' ? Object.keys(suites) : [values.suite]) {
      const directory = resolve(destination, variant, name);
      let result;
      try { result = await execute({ variant, name, directory, list: values.list, firefox: summary.firefox }); }
      catch (error) { result = { variant, suite: name, passed: false, error: error.message }; }
      if (values['capture-shared'] && !values.list && name === 'shared-ui' && result.passed) {
        const captures = resolve(directory, 'supplementary-captures');
        const args = [resolve(experiment, 'capture-shared-ui.mjs'), '--variant', variant,
          '--port', String(await freePort()), '--output', captures];
        result.supplementaryCapture = await run(args, isolatedEnvironment('development'), resolve(directory, 'captures.log'));
        result.supplementaryCapture.manifest = resolve(captures, 'captures.json');
        if (result.supplementaryCapture.code !== 0) result.passed = false;
      }
      summary.suites.push(result);
      await writeFile(resolve(destination, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    }
  }
  const shared = summary.suites.filter(suite => suite.supplementaryCapture?.code === 0);
  if (shared.length === 2) {
    const arms = await Promise.all(shared.map(async suite => ({ variant: suite.variant,
      evidence: JSON.parse(await readFile(suite.supplementaryCapture.manifest, 'utf8')) })));
    const baseline = arms.find(arm => arm.variant === 'postcss');
    const candidate = arms.find(arm => arm.variant === 'vite');
    summary.sharedScreenshotComparison = baseline.evidence.captures.map(image => {
      const other = candidate.evidence.captures.find(capture => capture.project === image.project && capture.name === image.name);
      return { project: image.project, name: image.name, postcssSha256: image.sha256,
        viteSha256: other?.sha256, byteIdentical: image.sha256 === other?.sha256 };
    });
  }
  summary.finished = new Date().toISOString();
  summary.passed = summary.suites.every(suite => suite.passed);
  await writeFile(resolve(destination, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Visual ${values.list ? 'inventory' : 'QA'}: ${summary.passed ? 'PASS' : 'INCOMPLETE/FAIL'}; ${resolve(destination, 'summary.json')}`);
  if (!summary.passed) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
