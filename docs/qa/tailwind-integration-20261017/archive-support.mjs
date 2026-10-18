#!/usr/bin/env node
// Standalone, allowlisted evidence archive. Never launches another process.
// Run deliberately from the repository root after measurements have finished.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaults = { input: 'reports/tailwind-integration', output: 'docs/qa/tailwind-integration-20261017/evidence' };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const portable = (value) => value.split(path.sep).join('/');
const plans = [];
const destinations = new Set();
let repository;
let inputRoot;
let outputRoot;

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function parseOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--help') return { help: true };
    assert.ok(['--input', '--output'].includes(argv[index]), `Unknown argument: ${argv[index]}`);
    const key = argv[index].slice(2);
    assert.ok(!options[key], `Duplicate argument: --${key}`);
    const value = argv[++index];
    assert.ok(value && !value.startsWith('--'), `Missing value for --${key}`);
    options[key] = value;
  }
  return { ...defaults, ...options };
}

function destination(relative) {
  const absolute = path.resolve(outputRoot, relative);
  assert.ok(inside(outputRoot, absolute), `Destination escaped archive: ${relative}`);
  assert.ok(!destinations.has(absolute), `Duplicate archive destination: ${relative}`);
  destinations.add(absolute);
  return absolute;
}

async function addFile(originalRelative, copiedRelative, role = 'original-byte-exact') {
  const originalAbsolute = path.resolve(inputRoot, originalRelative);
  assert.ok(inside(inputRoot, originalAbsolute), `Input escaped reports root: ${originalRelative}`);
  const stat = await lstat(originalAbsolute);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Missing or non-ordinary input: ${originalRelative}`);
  assert.ok(inside(await realpath(inputRoot), await realpath(originalAbsolute)), `Input ancestor escaped reports root: ${originalRelative}`);
  const bytes = await readFile(originalAbsolute);
  plans.push({
    originalPath: portable(path.relative(repository, originalAbsolute)),
    copiedPath: portable(path.relative(repository, path.resolve(outputRoot, copiedRelative))),
    originalAbsolute,
    copiedAbsolute: destination(copiedRelative),
    role,
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
  return bytes;
}

async function addJson(original, copied, role) {
  return JSON.parse((await addFile(original, copied, role)).toString('utf8'));
}

function addDerived(copiedRelative, value, provenance) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  plans.push({ originalPath: null, copiedPath: portable(path.relative(repository, path.resolve(outputRoot, copiedRelative))), copiedAbsolute: destination(copiedRelative), role: 'derived-interpretation-originals-unchanged', provenance, bytes: bytes.length, sha256: sha256(bytes), generatedBytes: bytes });
}

async function archiveContract(originalReport, copiedReport) {
  const report = await addJson(originalReport, copiedReport, 'original-contract-report-including-false-status');
  assert.equal(report.scenarios.length, 28, `Unexpected contract scenario count: ${originalReport}`);
  const unique = new Set();
  let images = 0;
  for (const scenario of report.scenarios) {
    for (const arm of ['baseline', 'candidate']) {
      const image = scenario.screenshots[arm];
      const relative = image.path.replaceAll('\\', '/');
      assert.ok(!path.posix.isAbsolute(relative) && !relative.split('/').includes('..') && relative.startsWith('contract-styles-images/'), `Unexpected screenshot path: ${relative}`);
      assert.ok(!unique.has(relative), `Repeated screenshot path: ${relative}`);
      unique.add(relative);
      const original = path.posix.join(path.posix.dirname(originalReport), relative);
      const copied = path.posix.join(path.posix.dirname(copiedReport), relative);
      const bytes = await addFile(original, copied, 'original-contract-png-path-preserved');
      assert.equal(sha256(bytes), image.sha256, `Screenshot SHA differs from scenario: ${original}`);
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `Invalid PNG: ${original}`);
      assert.equal(bytes.readUInt32BE(16), scenario.width);
      assert.equal(bytes.readUInt32BE(20), scenario.height);
      images += 1;
    }
  }
  assert.equal(images, 56);
  return { originalOk: report.ok, originalCssomEquivalent: report.cssomEquivalent, scenarios: report.scenarios.length, scenarioPasses: report.scenarios.filter((scenario) => scenario.ok).length, images };
}

async function archiveSessions(series, originalDirectory, failed = false) {
  for (const session of series.sessions) {
    assert.match(session.id, /^pair-\d{2}-[12]-(?:postcss|vite)$/);
    const source = `${originalDirectory}/${session.id}`;
    const copied = `hmr/${failed ? 'failed-sessions' : 'sessions'}/${session.id}`;
    const record = await addJson(`${source}/session.json`, `${copied}/session.json`, 'original-session-record');
    assert.equal(record.id, session.id);
    assert.equal(record.passed, session.passed);
    await addFile(`${source}/session-config.json`, `${copied}/session-config.json`, 'original-session-configuration');
    const logName = `${failed ? 'failed-' : ''}${session.id}`;
    for (const channel of ['stdout', 'stderr']) await addFile(`${source}/node.${channel}.log`, `hmr/execution/${logName}.${channel}.txt`, 'original-log-renamed-byte-exact');
  }
}

async function prepare() {
  for (const file of ['install-base.txt', 'add-plugin.txt', 'install-experiment.txt', 'dependency-diff.json', 'package.before.json', 'bun.before.lock']) await addFile(file, `setup/${file}`);
  const dependencyDiff = JSON.parse((await readFile(path.join(inputRoot, 'dependency-diff.json'))).toString('utf8'));
  assert.deepEqual(dependencyDiff.changedExisting, []);
  assert.deepEqual(dependencyDiff.added, ['@tailwindcss/vite']);
  assert.equal(dependencyDiff.plugin.version, '4.3.3');

  for (const file of ['summary.json', 'css-check.json', 'css-check.txt', 'css-check-initial-failure.json', 'css-check-initial-failure.txt', 'style-contract.txt']) await addFile(`preflight/${file}`, `preflight/${file}`);
  for (const arm of ['postcss', 'vite']) {
    for (const file of ['config.json', 'stdout.txt', 'stderr.txt']) await addFile(`preflight/${arm}/${file}`, `preflight/${arm}/${file}`);
  }
  const productionContract = await archiveContract('preflight/style-contract.json', 'preflight/style-contract.json');

  const successful = await addJson('hmr-series-local-permission/series.json', 'hmr/series.json', 'original-successful-hmr-series');
  const failed = await addJson('hmr-series/series.json', 'hmr/failed-series.json', 'original-failed-hmr-series-not-reclassified');
  assert.equal(successful.passed, true);
  assert.equal(successful.sessions.length, 8);
  assert.equal(failed.passed, false);
  assert.equal(failed.sessions.length, 1);
  assert.ok(successful.sessions.every((session) => session.passed));
  await archiveSessions(successful, 'hmr-series-local-permission');
  await archiveSessions(failed, 'hmr-series', true);
  for (const file of ['hmr-execution.txt', 'hmr-execution-local-permission.txt']) await addFile(file, `hmr/execution/${file}`);
  const originalSeries = plans.find((file) => file.originalPath === portable(path.relative(repository, path.join(inputRoot, 'hmr-series-local-permission/series.json'))));
  const statistics = successful.statistics;
  assert.equal(statistics.pairs.length, 4);
  for (const arm of ['postcss', 'vite']) {
    assert.equal(statistics.variants[arm].measuredUpdates, 20);
    assert.equal(statistics.variants[arm].independentSessions, 4);
  }
  const ratio = statistics.pairedMedianRatios.median;
  const difference = statistics.pairedMedianDifferencesMs.median;
  assert.ok(Math.abs(ratio - 0.9153599) < 0.0000001, 'Recorded HMR ratio changed; inspect new evidence');
  assert.ok(Math.abs(difference - (-118.9605)) < 0.000001, 'Recorded HMR difference changed; inspect new evidence');
  addDerived('hmr/interpretation.json', {
    schemaVersion: 1,
    originalSeries: { originalPath: originalSeries.originalPath, copiedPath: originalSeries.copiedPath, sha256: originalSeries.sha256, bytes: originalSeries.bytes },
    baseSha: successful.baseSha,
    originalPassed: successful.passed,
    pairedReplicationUnits: 4,
    measuredUpdatesPerArm: 20,
    pairedMedianRatio: ratio,
    pairedMedianRatioDisplayed: Number(ratio.toFixed(7)),
    pairedMedianDifferenceMs: difference,
    pairedMedianDifferenceMsDisplayed: Number(difference.toFixed(4)),
    signedDifferenceVariability: {
      sampleStandardDeviationMs: statistics.pairedMedianDifferencesMs.sampleStandardDeviation,
      coefficientOfVariationPercent: null,
      reason: 'N/A: paired differences are signed and lack the positive ratio-scale mean required for a meaningful CV. The negative CV in the raw original is preserved there, not interpreted as variability.',
      rawOriginalCoefficientOfVariationPercent: statistics.pairedMedianDifferencesMs.coefficientOfVariationPercent,
    },
    limitation: 'Descriptive pilot of an instrumented synthetic CSS edit; updates are clustered in four paired sessions. Does not establish statistical significance, stable tail latency, application HMR, new utility generation performance or universal development CSS equivalence.',
    developmentCssEvidence: '../development-css/audit.json',
  }, { originalPath: originalSeries.originalPath, sha256: originalSeries.sha256 });

  const audit = await addJson('dev-css-audit/audit.json', 'development-css/audit.json', 'original-development-audit-including-false-status');
  assert.equal(audit.passed, false, 'Retain the recorded incomplete development CSS comparison');
  for (const file of ['differences.json', 'explanation.md', 'style-contract.txt', 'cssom-review.json']) await addFile(`dev-css-audit/${file}`, `development-css/${file}`);
  await addFile('dev-css-audit-execution.txt', 'development-css/execution/dev-css-audit-execution.txt');
  for (const arm of ['postcss', 'vite']) {
    const capture = audit.captures.find((value) => value.variant === arm);
    assert.ok(capture, `Missing captured CSS inventory: ${arm}`);
    const bytes = await addFile(`dev-css-audit/${arm}.dev.css`, `development-css/${arm}.dev.css`, 'original-unmodified-development-css');
    assert.equal(bytes.length, capture.inventory.rawBytes);
    assert.equal(sha256(bytes), capture.inventory.sha256);
    for (const file of ['config.json', 'css-inventory.json', 'ordered-ast.json']) await addFile(`dev-css-audit/${arm}/${file}`, `development-css/${arm}/${file}`);
    for (const channel of ['stdout', 'stderr']) await addFile(`dev-css-audit/${arm}/node.${channel}.log`, `development-css/${arm}/execution/node.${channel}.txt`, 'original-log-renamed-byte-exact');
  }
  const developmentContract = await archiveContract('dev-css-audit/style-contract.json', 'development-css/style-contract.json');
  assert.equal(developmentContract.originalOk, false, 'Do not relabel CSSOM-failing report as a pass');
  for (const file of ['css-checker-tests.txt', 'css-checker-tests-final.txt', 'test-catalog-final.json', 'test-catalog-final.txt', 'harness-lint.txt', 'knip-initial.txt']) await addFile(file, `verification/${file}`, file === 'knip-initial.txt' ? 'original-initial-knip-failure-not-reclassified' : 'original-verification-output');
  return {
    schemaVersion: 1,
    inputRoot: portable(path.relative(repository, inputRoot)),
    outputRoot: portable(path.relative(repository, outputRoot)),
    scope: 'Allowlisted original setup, preflight, HMR and development CSS/contract evidence. No bundles, caches, application data, HTML reports, traces or build-series outputs.',
    preservedStates: { successfulHmrPassed: successful.passed, failedHmrPassed: failed.passed, developmentCssAuditPassed: audit.passed, productionContract, developmentContract, initialKnip: 'Initial unused dependency finding is retained without requiring or claiming a pass; final validation is added separately.' },
    pngCount: productionContract.images + developmentContract.images,
    archiver: { pathRelativeToRepository: portable(path.relative(repository, scriptPath)), sha256: sha256(await readFile(scriptPath)) },
    rawFilesModified: false,
    finalValidation: 'Not part of this archive; the root task will add final verification evidence separately.',
  };
}

async function safeDirectory(directory) {
  assert.ok(inside(outputRoot, directory));
  await mkdir(directory, { recursive: true });
  assert.ok(inside(await realpath(outputRoot), await realpath(directory)), 'Output ancestor escaped archive root');
}

async function exactWrite(destinationPath, bytes) {
  try { await writeFile(destinationPath, bytes, { flag: 'wx' }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = await lstat(destinationPath);
  assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'Archive destination must be an ordinary file');
  assert.deepEqual(await readFile(destinationPath), bytes, `Different existing destination will not be overwritten: ${destinationPath}`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`Usage: node archive-tailwind-support.mjs [--input <reports-root>] [--output <evidence-root>]\nRun from the repository root; paths resolve from process.cwd() and must remain inside it.\nDefaults: --input ${defaults.input} --output ${defaults.output}\nCopies evidence only. Does not run tests, browsers or builds.\n`);
    return;
  }
  repository = path.resolve(process.cwd());
  inputRoot = path.resolve(repository, options.input);
  outputRoot = path.resolve(repository, options.output);
  assert.ok(inside(repository, inputRoot) && inside(repository, outputRoot));
  assert.notEqual(inputRoot, outputRoot);
  const manifest = await prepare(); // Every required original is read first.
  assert.equal(manifest.pngCount, 112, 'Expected 56 original PNGs for production and 56 for development');
  await mkdir(outputRoot, { recursive: true });
  assert.ok(!(await lstat(outputRoot)).isSymbolicLink());
  assert.ok(inside(await realpath(repository), await realpath(outputRoot)));
  for (const file of plans) {
    await safeDirectory(path.dirname(file.copiedAbsolute));
    if (file.generatedBytes) await exactWrite(file.copiedAbsolute, file.generatedBytes);
    else {
      try { await copyFile(file.originalAbsolute, file.copiedAbsolute, constants.COPYFILE_EXCL); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const stat = await lstat(file.copiedAbsolute);
      assert.ok(stat.isFile() && !stat.isSymbolicLink());
      const copied = await readFile(file.copiedAbsolute);
      assert.equal(copied.length, file.bytes);
      assert.equal(sha256(copied), file.sha256, `Different existing bytes will not be overwritten: ${file.copiedPath}`);
      assert.equal(sha256(await readFile(file.originalAbsolute)), file.sha256, `Source changed during archive: ${file.originalPath}`);
    }
  }
  manifest.fileCount = plans.length;
  manifest.totalBytes = plans.reduce((sum, file) => sum + file.bytes, 0);
  manifest.manifestNotSelfHashed = true;
  manifest.files = plans.map(({ originalAbsolute: _original, copiedAbsolute: _copied, generatedBytes: _generated, ...file }) => file).sort((a, b) => a.copiedPath.localeCompare(b.copiedPath));
  const manifestPath = path.join(outputRoot, 'support-manifest.json');
  await exactWrite(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  process.stdout.write(`${JSON.stringify({ archived: true, files: manifest.fileCount, pngs: manifest.pngCount, bytes: manifest.totalBytes, manifest: portable(path.relative(repository, manifestPath)), developmentCssAuditPassed: manifest.preservedStates.developmentCssAuditPassed })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
