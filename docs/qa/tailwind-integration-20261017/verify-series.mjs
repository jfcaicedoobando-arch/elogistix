#!/usr/bin/env node
// Post-series verification only. No build, browser, recompression or raw-JS hash pass.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ownFile = fileURLToPath(import.meta.url);
const checkerFile = fileURLToPath(new URL('./compare-css.mjs', import.meta.url));
const checkerRelative = 'docs/qa/tailwind-integration-20261017/compare-css.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const relative = (value) => slash(path.relative(root, value));
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const natural = (value) => Number.isSafeInteger(value) && value >= 0;
const inside = (parent, candidate) => {
  const rel = path.relative(parent, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function options() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node docs/qa/tailwind-integration-20261017/verify-series.mjs --input reports/tailwind-integration/build-series --output reports/tailwind-integration/build-series-verification');
    console.log('Requires a complete 26-build series: 3 retained initial pairs +10 repeated pairs. Output must be new. Does not build, launch browsers or recompress assets.');
    return null;
  }
  const result = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    assert.ok(['--input', '--output'].includes(flag) && value && !value.startsWith('--'), `Invalid argument: ${flag}`);
    assert.ok(!result[flag.slice(2)], `Duplicate argument: ${flag}`);
    result[flag.slice(2)] = path.resolve(root, value);
  }
  assert.ok(result.input && result.output, '--input and --output are required');
  assert.ok(inside(path.join(root, 'reports'), result.input) && inside(path.join(root, 'reports'), result.output), 'Both paths must be below this checkout reports/');
  assert.ok(result.input !== result.output && !inside(result.input, result.output) && !inside(result.output, result.input), 'Input and output must be separate directory trees');
  return result;
}

async function ordinary(base, absolute, directory = false) {
  assert.ok(inside(base, absolute), 'Path escaped its expected tree');
  const parts = path.relative(base, absolute).split(path.sep);
  let current = base;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert.ok(!stat.isSymbolicLink(), `Symlink is prohibited: ${relative(current)}`);
    assert.ok(index < parts.length - 1 || directory ? stat.isDirectory() : stat.isFile(), `Unexpected file type: ${relative(current)}`);
  }
  assert.equal(path.relative(await realpath(absolute), absolute), '', 'Linked path ancestry is prohibited');
  return absolute;
}

async function freshOutput(directory) {
  let current = root;
  const parts = path.relative(root, directory).split(path.sep);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Output ancestry must consist of ordinary directories');
      assert.equal(path.relative(await realpath(current), current), '');
      assert.notEqual(index, parts.length - 1, '--output already exists; choose a new directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory);
}

async function save(filename, value) {
  await writeFile(`${filename}.tmp`, json(value));
  await rename(`${filename}.tmp`, filename);
}

function validateSeries(summary) {
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.status, 'complete');
  assert.equal(summary.measurements?.length, 26);
  assert.equal(summary.plan?.length, 26);
  assert.equal(summary.statistics?.initial?.pairs?.length, 3);
  assert.equal(summary.statistics?.repeated?.pairs?.length, 10);
  for (const kind of ['tracked', 'harness']) {
    assert.equal(summary.inputIntegrity?.[kind]?.unchanged, true, `${kind} guard failed`);
    assert.deepEqual(summary.inputIntegrity[kind].changedPaths, []);
  }
  for (const [index, run] of summary.measurements.entries()) {
    const pair = Math.floor(index / 2) + 1;
    const variant = (pair % 2 ? ['postcss', 'vite'] : ['vite', 'postcss'])[index % 2];
    const phase = pair <= 3 ? 'initial' : 'repeated';
    assert.equal(run.id, `${phase}-${String(pair).padStart(2, '0')}-${variant}`);
    assert.equal(run.pair, pair);
    assert.equal(run.phase, phase);
    assert.equal(run.variant, variant);
    assert.equal(run.discarded, false);
    assert.equal(run.exitCode, 0);
    assert.equal(run.signal, null);
    assert.equal(run.spawnError, null);
    for (const key of ['id', 'pair', 'phase', 'variant', 'discarded']) assert.deepEqual(run[key], summary.plan[index][key]);
  }
}

function canonicalAssetList(inventory) {
  assert.equal(inventory.analysisStatus, 'complete');
  assert.equal(inventory.emittedSourceMaps, 0);
  const seen = new Set();
  const list = inventory.files.map((file) => {
    assert.ok(typeof file.path === 'string' && !/[\\:\u0000-\u001f]/.test(file.path));
    assert.ok(file.path.split('/').every((part) => part && part !== '.' && part !== '..'));
    assert.ok(!seen.has(file.path));
    seen.add(file.path);
    assert.ok(['js', 'css'].includes(file.type));
    assert.equal(file.type, file.path.endsWith('.css') ? 'css' : 'js');
    assert.ok(/\.(?:[cm]?js|css)$/i.test(file.path));
    assert.ok(sha(file.sha256));
    for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes']) assert.ok(natural(file[key]));
    return Object.fromEntries(['path', 'type', 'rawBytes', 'sha256', 'gzipBytes', 'brotliBytes'].map((key) => [key, file[key]]));
  }).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.ok(list.some((file) => file.type === 'js') && list.some((file) => file.type === 'css'));
  return list;
}

function cssEvidence(description, inventory) {
  const expected = new Map(inventory.files.filter((file) => file.type === 'css').map((file) => [file.path, file]));
  assert.equal(description.css.length, expected.size, 'Checker/inventory CSS count mismatch');
  return description.css.map((file) => {
    const recorded = expected.get(file.fileName);
    assert.ok(recorded, `Uninventoried CSS: ${file.fileName}`);
    assert.equal(file.sha256, recorded.sha256, `Raw CSS changed: ${file.fileName}`);
    assert.equal(file.rawBytes, recorded.rawBytes);
    assert.equal(file.rules, recorded.rules);
    assert.ok(sha(file.canonicalSha256));
    expected.delete(file.fileName);
    return { fileName: file.fileName, sha256: file.sha256, canonicalSha256: file.canonicalSha256,
      rawBytes: file.rawBytes, rules: file.rules };
  });
}

async function main(option) {
  await ordinary(root, option.input, true);
  await freshOutput(option.output);
  const summaryFile = path.join(option.input, 'summary.json');
  const reportFile = path.join(option.output, 'summary.json');
  const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
    command: [process.execPath, ...process.argv.slice(1)], node: process.version,
    sourceSeries: relative(option.input), pairs: [], inventories: [],
    scope: 'All 13 production build pairs: exact CSS bytes, ordered CSS AST and existing static HTML/chunk/literal CSS association guards. No browser/runtime equivalence claim.',
    method: 'Inventory JSON is verified against the recorded SHA256. Canonical per-file path/type/rawBytes/SHA256/gzipBytes/BrotliBytes lists must match across all 26 runs. No recompression or extra raw-JS hash pass; compareCssBuilds reads JS as required for its existing association/literal guards. Raw bundle hashing is performed by the independent series archiver.',
  };
  let summaryBefore;
  let checkerBefore;
  let verifierBefore;
  try {
    await ordinary(option.input, summaryFile);
    summaryBefore = await readFile(summaryFile);
    checkerBefore = await readFile(checkerFile);
    verifierBefore = await readFile(ownFile);
    report.originalSummary = { path: relative(summaryFile), sha256: hash(summaryBefore), bytes: summaryBefore.length };
    report.checker = { path: checkerRelative, beforeSha256: hash(checkerBefore) };
    report.verifier = { path: relative(ownFile), beforeSha256: hash(verifierBefore), addedAfterMeasuredSeries: true };
    const summary = JSON.parse(summaryBefore.toString('utf8'));
    validateSeries(summary);
    assert.equal(summary.output, relative(option.input), 'Series output path does not match --input');
    report.baseHead = summary.base.head;
    report.guards = { complete: true, successfulBuilds: 26, retainedInitialPairs: 3, repeatedPairs: 10,
      trackedInputsUnchanged: true, measuredHarnessUnchanged: true };
    for (const when of ['before', 'after']) {
      const filename = path.join(option.input, 'sources', `harness-${when}.json`);
      await ordinary(option.input, filename);
      const snapshot = JSON.parse(await readFile(filename, 'utf8'));
      assert.equal(hash(JSON.stringify(snapshot.manifest)), snapshot.sha256);
      assert.equal(snapshot.sha256, summary.inputIntegrity.harness[`${when}Sha256`]);
      assert.equal(snapshot.manifest.find((file) => file.path === checkerRelative)?.sha256, hash(checkerBefore), 'Checker differs from the measured-series fingerprint');
    }
    report.checker.matchesMeasuredFingerprint = true;
    const { compareCssBuilds } = await import('./compare-css.mjs');
    const inventories = new Map();
    let referenceList;
    let referenceSha;
    for (const run of summary.measurements) {
      const expectedInventory = path.join(option.input, 'inventories', `${run.id}.json`);
      assert.equal(run.inventory.path, relative(expectedInventory));
      await ordinary(option.input, expectedInventory);
      const bytes = await readFile(expectedInventory);
      assert.equal(hash(bytes), run.inventory.sha256, `Inventory hash mismatch: ${run.id}`);
      const inventory = JSON.parse(bytes.toString('utf8'));
      assert.deepEqual(inventory.totals, run.totals);
      const list = canonicalAssetList(inventory);
      const listSha = hash(JSON.stringify(list));
      if (!referenceList) {
        referenceList = list;
        referenceSha = listSha;
        await save(path.join(option.output, 'asset-list.json'), list);
        report.assetReference = { run: run.id, contentListSha256: listSha, files: list.length,
          jsFiles: list.filter((file) => file.type === 'js').length, cssFiles: list.filter((file) => file.type === 'css').length,
          listFile: { path: relative(path.join(option.output, 'asset-list.json')), sha256: hash(await readFile(path.join(option.output, 'asset-list.json'))) } };
      }
      const identical = listSha === referenceSha;
      if (!identical) await save(path.join(option.output, `asset-list-${run.id}.json`), list);
      const outDir = path.join(option.input, 'outputs', run.id);
      assert.equal(run.outDir, relative(outDir));
      await ordinary(option.input, outDir, true);
      const metadataFile = path.join(outDir, '.qa-build-metadata.json');
      assert.equal(run.bundleReport, relative(metadataFile));
      await ordinary(option.input, metadataFile);
      const metadataBytes = await readFile(metadataFile);
      assert.equal(hash(metadataBytes), run.bundleSha256, `Bundle metadata hash mismatch: ${run.id}`);
      assert.equal(JSON.parse(metadataBytes.toString('utf8')).variant, run.variant);
      inventories.set(run.id, inventory);
      report.inventories.push({ run: run.id, inventorySha256: hash(bytes), bundleMetadataSha256: hash(metadataBytes),
        contentListSha256: listSha, identicalToReference: identical, files: list.length,
        jsContentListSha256: hash(JSON.stringify(list.filter((file) => file.type === 'js'))),
        cssContentListSha256: hash(JSON.stringify(list.filter((file) => file.type === 'css'))) });
    }
    report.all26AssetListsIdentical = report.inventories.every((run) => run.identicalToReference);
    await save(reportFile, report);
    for (let pair = 1; pair <= 13; pair++) {
      const baseline = summary.measurements.find((run) => run.pair === pair && run.variant === 'postcss');
      const candidate = summary.measurements.find((run) => run.pair === pair && run.variant === 'vite');
      console.log(`[verify-series] Comparing pair ${pair}/13 (${baseline.phase}) with unchanged compareCssBuilds`);
      const comparison = await compareCssBuilds(path.join(root, baseline.outDir), path.join(root, candidate.outDir));
      const item = { pair, phase: baseline.phase, baseline: baseline.id, candidate: candidate.id,
        ok: comparison.ok, byteEquivalent: comparison.byteEquivalent, cssEquivalent: comparison.cssEquivalent,
        astEquivalent: comparison.comparisons.length > 0 && comparison.comparisons.every((file) => file.astEquivalent),
        associationEquivalent: comparison.associationEquivalent,
        baselineAssociationGuard: comparison.baseline.associations.ok,
        candidateAssociationGuard: comparison.candidate.associations.ok,
        baselineAssociationGraphSha256: hash(JSON.stringify(comparison.baseline.associations.graph)),
        candidateAssociationGraphSha256: hash(JSON.stringify(comparison.candidate.associations.graph)),
        baselineCss: cssEvidence(comparison.baseline, inventories.get(baseline.id)),
        candidateCss: cssEvidence(comparison.candidate, inventories.get(candidate.id)),
        failures: comparison.failures };
      item.passed = ['ok', 'byteEquivalent', 'cssEquivalent', 'astEquivalent', 'associationEquivalent',
        'baselineAssociationGuard', 'candidateAssociationGuard'].every((flag) => item[flag] === true);
      if (pair === 1 || !item.passed) {
        const filename = path.join(option.output, pair === 1 ? 'first-pair-full.json' : `pair-${pair}-failed-full.json`);
        await save(filename, comparison);
        item.fullReport = { path: relative(filename), sha256: hash(await readFile(filename)) };
      }
      report.pairs.push(item);
      await save(reportFile, report);
    }
    assert.equal(report.pairs.length, 13);
    assert.equal(report.all26AssetListsIdentical, true, 'JS/CSS content/size lists differ across the series');
    assert.ok(report.pairs.every((pair) => pair.passed), 'A CSS byte/AST/association comparison failed');
    report.status = 'checked';
  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    for (const [key, filename, before] of [['originalSummary', summaryFile, summaryBefore],
      ['checker', checkerFile, checkerBefore], ['verifier', ownFile, verifierBefore]]) {
      try {
        const after = await readFile(filename);
        report[key] = { ...report[key], afterSha256: hash(after), unchanged: Boolean(before && hash(before) === hash(after)) };
        if (!report[key].unchanged) { report.status = 'failed'; process.exitCode = 1; }
      } catch (error) {
        report[key] = { ...report[key], unchanged: false, error: error.message };
        report.status = 'failed';
        process.exitCode = 1;
      }
    }
    if (report.status === 'checked') report.status = 'complete';
    report.endedAt = new Date().toISOString();
    await save(reportFile, report);
    console.log(JSON.stringify({ status: report.status, summary: relative(reportFile), pairs: report.pairs.length,
      passedPairs: report.pairs.filter((pair) => pair.passed).length,
      all26AssetListsIdentical: report.all26AssetListsIdentical ?? false,
      error: report.error?.message ?? null }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === ownFile) {
  try {
    const option = options();
    if (option) await main(option);
  } catch (error) {
    console.error(`[verify-series] ${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
