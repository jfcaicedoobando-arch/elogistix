#!/usr/bin/env node
// Prepared offline archive utility. No builds, browsers, subprocesses or tests.
// Run deliberately with Node after the QA run is complete. Existing different
// destination bytes are rejected; no source files are edited or deleted.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaults = {
  input: 'reports/tailwind-integration/ui-full-20261017',
  output: 'docs/qa/tailwind-integration-20261017/evidence/visual-qa',
};
let repository;
let sourceRelative;
let archiveRelative;
let sourceRoot;
let archiveRoot;
const arms = ['postcss', 'vite'];
const suiteNames = ['audit119-126', 'audit136-137', 'virtualization', 'shared-ui'];
const expectedBySuite = { 'audit119-126': 20, 'audit136-137': 8, virtualization: 8, 'shared-ui': 16 };
const plan = [];
const plannedDestinations = new Set();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const portable = (value) => value.split(path.sep).join('/');

function parseOptions(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--help') return { help: true };
    assert.ok(['--input', '--output'].includes(option), `Unknown argument: ${option}`);
    const key = option.slice(2);
    assert.ok(!result[key], `Duplicate argument: ${option}`);
    const value = argv[++index];
    assert.ok(value && !value.startsWith('--'), `Missing value for ${option}`);
    result[key] = value;
  }
  return { ...defaults, ...result };
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function requiredFile(relative) {
  const absolute = path.resolve(sourceRoot, relative);
  assert.ok(inside(sourceRoot, absolute), `Source escaped allowed root: ${relative}`);
  const stat = await lstat(absolute); // Missing inputs fail before any copies.
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Expected ordinary file: ${absolute}`);
  assert.ok(inside(await realpath(sourceRoot), await realpath(absolute)), `Source symlink ancestor escaped root: ${absolute}`);
  return { absolute, bytes: await readFile(absolute) };
}

async function addFile(original, archived = original, role = 'evidence') {
  const input = await requiredFile(original);
  const destination = path.resolve(archiveRoot, archived);
  assert.ok(inside(archiveRoot, destination), `Archive escaped destination root: ${archived}`);
  assert.ok(!plannedDestinations.has(destination), `Duplicate archive target: ${archived}`);
  plannedDestinations.add(destination);
  const entry = {
    originalPath: portable(path.relative(repository, input.absolute)),
    archivedPath: portable(path.relative(repository, destination)),
    role,
    sha256: sha256(input.bytes),
    bytes: input.bytes.length,
  };
  plan.push({ ...entry, sourceAbsolute: input.absolute, destinationAbsolute: destination });
  return input.bytes;
}

async function addJson(original, archived = original, role = 'evidence') {
  return JSON.parse((await addFile(original, archived, role)).toString('utf8'));
}

function reportTests(report) {
  const result = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) result.push({ spec, test });
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return result;
}

function verifyExecutedReport(report, summarySuite) {
  const tests = reportTests(report);
  assert.equal(tests.length, summarySuite.stats.expected, `${summarySuite.variant}/${summarySuite.suite}: executed report count`);
  for (const key of ['expected', 'skipped', 'unexpected', 'flaky']) {
    assert.equal(report.stats[key], summarySuite.stats[key], `Report/summary stats mismatch: ${key}`);
  }
  assert.deepEqual(report.errors ?? [], [], 'Playwright report must not hide runner errors');
  for (const { test } of tests) {
    assert.equal(test.status, 'expected', 'Executed test must retain its expected status');
    assert.equal(test.results.length, 1, 'No retries may be converted into first-pass evidence');
    assert.equal(test.results[0].status, 'passed', 'Only actually passed executed cases count as passed');
    assert.equal(test.results[0].retry ?? 0, 0, 'No retried execution accepted as a first pass');
  }
  return tests.length;
}

function blockedKey({ title, file, line, projectName }) {
  return JSON.stringify([projectName, path.basename(file), line, title]);
}

async function prepare() {
  const summary = await addJson('summary.json', 'summary.json', 'original-summary-unchanged');
  const firefox = await addJson('firefox-preflight.json', 'firefox-preflight.json', 'blocked-browser-preflight');
  await addFile('firefox-preflight.log', 'execution/firefox-preflight.txt', 'original-log-renamed-byte-exact');
  assert.equal(summary.inventoryOnly, false);
  assert.equal(summary.suites.length, 8, 'Exactly four suites for each integration');
  assert.equal(summary.passed, false, 'Preserve the incomplete full-QA state');
  assert.equal(firefox.available, false, 'This archive describes the recorded Firefox launch blocker');
  assert.equal(firefox.attempts, 1, 'Preserve the single Firefox launch attempt');
  assert.deepEqual(summary.firefox, firefox, 'Firefox preflight bytes must describe the summary blocker');
  const observedSuiteKeys = summary.suites.map((suite) => `${suite.variant}/${suite.suite}`).sort();
  assert.deepEqual(observedSuiteKeys, arms.flatMap((arm) => suiteNames.map((suite) => `${arm}/${suite}`)).sort());
  const counts = {};
  const capturesByArm = {};
  const nonApplicable = [];
  for (const arm of arms) {
    counts[arm] = { expected: 0, passed: 0, blocked: 0, skipped: 0, unexpected: 0, flaky: 0, fullQaPassed: false };
    for (const suiteName of suiteNames) {
      const suite = summary.suites.find((value) => value.variant === arm && value.suite === suiteName);
      const base = `${arm}/${suiteName}`;
      assert.equal(suite.expected, expectedBySuite[suiteName]);
      assert.equal(suite.inventoryOnly, false);
      assert.equal(suite.executionPassed, true);
      assert.equal(suite.status.code, 0);
      for (const key of ['skipped', 'unexpected', 'flaky']) assert.equal(suite.stats[key], 0);
      const report = await addJson(`${base}/results.json`, `${base}/results.json`, 'original-playwright-results');
      const executedCount = verifyExecutedReport(report, suite);
      await addFile(`${base}/playwright.config.mjs`, `${base}/playwright.config.mjs`, 'original-generated-config-wrapper');
      const profile = await addJson(`${base}/server-profile.json`, `${base}/server-profile.json`, 'original-server-profile');
      await addFile(`${base}/playwright.log`, `${base}/execution/playwright.txt`, 'original-log-renamed-byte-exact');
      assert.equal(profile.variant, arm);
      assert.equal(profile.suite, suiteName);
      if (suiteName !== 'shared-ui') {
        assert.equal(profile.freshBuildBeforePreview, true);
        await addFile(`${base}/fixture-assets.json`, `${base}/fixture-assets.json`, 'original-built-asset-inventory-no-bundles');
      } else {
        assert.equal(profile.mode, 'development');
        assert.equal(profile.freshBuildBeforePreview, false);
        nonApplicable.push({ arm, suite: suiteName, omitted: 'fixture-assets.json', reason: 'Original shared suite preserves development mode; no compiled fixture asset inventory was produced.' });
      }
      if (suiteName === 'virtualization') {
        assert.equal(suite.passed, false, 'Virtualization remains incomplete');
        assert.equal(suite.firefoxBlocked, true);
        assert.equal(suite.blocked.length, 4);
        assert.equal(executedCount, 4);
        const inventory = await addJson(`${base}/inventory.json`, `${base}/inventory.json`, 'full-original-project-inventory');
        await addFile(`${base}/playwright.inventory.config.mjs`, `${base}/playwright.inventory.config.mjs`, 'original-generated-inventory-wrapper');
        await addFile(`${base}/inventory.log`, `${base}/execution/inventory.txt`, 'original-log-renamed-byte-exact');
        const inventoryCases = reportTests(inventory);
        assert.equal(inventoryCases.length, 8, 'Retain all Chromium and Firefox cases in the inventory');
        const firefoxCases = inventoryCases.filter(({ test }) => (test.projectName ?? test.projectId) === 'firefox').map(({ spec, test }) => blockedKey({ title: spec.title, file: spec.file, line: spec.line, projectName: test.projectName ?? test.projectId })).sort();
        assert.equal(firefoxCases.length, 4);
        for (const blocked of suite.blocked) {
          assert.equal(blocked.status, 'BLOCKED/NOT_RUN');
          assert.equal(blocked.projectName, 'firefox');
        }
        assert.deepEqual(suite.blocked.map(blockedKey).sort(), firefoxCases, 'Blocked cases must remain identifiable in the original inventory');
      } else {
        assert.equal(suite.passed, true);
        assert.equal(suite.firefoxBlocked, false);
        assert.deepEqual(suite.blocked, []);
        assert.equal(executedCount, suite.expected);
      }
      counts[arm].expected += suite.expected;
      counts[arm].passed += executedCount;
      counts[arm].blocked += suite.blocked.length;
      if (suiteName === 'shared-ui') {
        assert.equal(suite.supplementaryCapture.code, 0);
        const captureBase = `${base}/supplementary-captures`;
        assert.equal(path.resolve(suite.supplementaryCapture.manifest), path.resolve(sourceRoot, captureBase, 'captures.json'), 'Capture manifest path must match the recorded run');
        const captures = await addJson(`${captureBase}/captures.json`, `${captureBase}/captures.json`, 'original-supplementary-capture-manifest');
        await addFile(`${base}/captures.log`, `${base}/execution/captures.txt`, 'original-log-renamed-byte-exact');
        await addFile(`${captureBase}/server/server-profile.json`, `${captureBase}/server/server-profile.json`, 'original-capture-server-profile-no-cache');
        assert.equal(captures.variant, arm);
        assert.equal(captures.passed, true);
        assert.deepEqual(captures.blocked, []);
        assert.deepEqual(captures.errors, []);
        assert.equal(captures.captures.length, 8);
        const captureKeys = new Set();
        capturesByArm[arm] = new Map();
        for (const capture of captures.captures) {
          assert.ok(['hd-light', 'hd-dark', 'compact-light', 'compact-dark'].includes(capture.project));
          assert.ok(['shell-table.png', 'form-dialog.png'].includes(capture.name));
          const key = `${capture.project}/${capture.name}`;
          assert.ok(!captureKeys.has(key), `Duplicate screenshot: ${arm}/${key}`);
          captureKeys.add(key);
          const bytes = await addFile(`${captureBase}/${key}`, `${captureBase}/${key}`, 'original-supplementary-png');
          assert.equal(bytes.length, capture.bytes, `PNG byte count mismatch: ${key}`);
          assert.equal(sha256(bytes), capture.sha256, `PNG SHA mismatch: ${key}`);
          assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Not a PNG: ${key}`);
          assert.equal(bytes.readUInt32BE(16), capture.width);
          assert.equal(bytes.readUInt32BE(20), capture.height);
          capturesByArm[arm].set(key, capture);
        }
      }
    }
    assert.equal(counts[arm].expected, 52);
    assert.equal(counts[arm].passed, 48);
    assert.equal(counts[arm].blocked, 4);
    assert.equal(counts[arm].passed + counts[arm].blocked, counts[arm].expected);
  }
  assert.equal(summary.sharedScreenshotComparison.length, 8);
  const comparisonKeys = new Set();
  for (const comparison of summary.sharedScreenshotComparison) {
    const key = `${comparison.project}/${comparison.name}`;
    assert.ok(!comparisonKeys.has(key), `Duplicate summary comparison: ${key}`);
    comparisonKeys.add(key);
    assert.equal(comparison.byteIdentical, true);
    assert.equal(comparison.postcssSha256, capturesByArm.postcss.get(key)?.sha256);
    assert.equal(comparison.viteSha256, capturesByArm.vite.get(key)?.sha256);
    assert.equal(comparison.postcssSha256, comparison.viteSha256, `Capture arms differ: ${key}`);
  }
  assert.equal(plan.length, 69, 'Expected compact allowlist: 69 original files, excluding the new manifest');
  return {
    schemaVersion: 1,
    sourceRoot: sourceRelative,
    archiveRoot: archiveRelative,
    sourceSha: summary.sha,
    sourceLockSha256: summary.lockSha256,
    sourceStarted: summary.started,
    sourceFinished: summary.finished,
    originalSummaryPassed: summary.passed,
    qaStatus: 'INCOMPLETE: 48 passed plus 4 Firefox BLOCKED/NOT_RUN per arm; this is not full GUI approval.',
    counts,
    screenshotComparisons: { expected: 8, observed: summary.sharedScreenshotComparison.length, allByteIdentical: true },
    nonApplicable,
    exclusions: ['compiled-fixture bundles', 'vite-cache', 'HTML reports', 'test-results trees and traces', 'source tests and canonical snapshots (unchanged, not archived here)'],
    fileCount: plan.length,
    totalBytes: plan.reduce((sum, file) => sum + file.bytes, 0),
    archiver: { pathRelativeToRepository: portable(path.relative(repository, scriptPath)), sha256: sha256(await readFile(scriptPath)) },
    manifestNotSelfHashed: true,
    files: plan.map(({ sourceAbsolute: _source, destinationAbsolute: _destination, ...entry }) => entry).sort((a, b) => a.archivedPath.localeCompare(b.archivedPath)),
  };
}

async function ensureSafeDirectory(directory) {
  assert.ok(inside(archiveRoot, directory), 'Directory escaped archive root');
  await mkdir(directory, { recursive: true });
  assert.ok(inside(await realpath(archiveRoot), await realpath(directory)), 'Archive symlink ancestor escaped root');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`Usage: node archive-tailwind-qa.mjs [--input <reports-dir>] [--output <archive-dir>]\nRun from the repository root. Paths resolve from process.cwd() and must stay inside that repository.\nDefaults:\n  --input ${defaults.input}\n  --output ${defaults.output}\nCopies recorded evidence only; never runs tests, builds or browsers.\n`);
    return;
  }
  repository = path.resolve(process.cwd());
  sourceRoot = path.resolve(repository, options.input);
  archiveRoot = path.resolve(repository, options.output);
  sourceRelative = portable(path.relative(repository, sourceRoot));
  archiveRelative = portable(path.relative(repository, archiveRoot));
  assert.ok(inside(repository, sourceRoot) && inside(repository, archiveRoot));
  assert.notEqual(sourceRoot, archiveRoot, 'Input and output directories must differ');
  const manifest = await prepare(); // Validate every file and count before writing.
  await mkdir(archiveRoot, { recursive: true });
  assert.ok(!(await lstat(archiveRoot)).isSymbolicLink(), 'Archive root cannot be a symlink');
  assert.ok(inside(await realpath(repository), await realpath(archiveRoot)), 'Archive root escaped repository');
  for (const file of plan) {
    await ensureSafeDirectory(path.dirname(file.destinationAbsolute));
    try { await copyFile(file.sourceAbsolute, file.destinationAbsolute, fsConstants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const archivedStat = await lstat(file.destinationAbsolute);
    assert.ok(archivedStat.isFile() && !archivedStat.isSymbolicLink(), `Archive target must be an ordinary file: ${file.archivedPath}`);
    const archived = await readFile(file.destinationAbsolute);
    assert.equal(archived.length, file.bytes, `Archived byte count mismatch: ${file.archivedPath}`);
    assert.equal(sha256(archived), file.sha256, `Archived bytes differ; existing different files are never overwritten: ${file.archivedPath}`);
    assert.equal(sha256(await readFile(file.sourceAbsolute)), file.sha256, `Source changed during archive: ${file.originalPath}`);
  }
  const manifestPath = path.join(archiveRoot, 'manifest.json');
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  try { await writeFile(manifestPath, manifestBytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.deepEqual(await readFile(manifestPath), manifestBytes, 'An existing different manifest will not be overwritten');
  }
  process.stdout.write(`${JSON.stringify({ archived: true, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, originalSummaryPassed: false, counts: manifest.counts, manifest: portable(path.relative(repository, manifestPath)) })}\n`);
}

// Importing this file also performs no actions. It is intentionally not invoked
// by repository QA or benchmarks; only a direct, deliberate Node run archives.
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
