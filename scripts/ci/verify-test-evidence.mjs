#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertExactPaths, buildCatalog, hash, writeJson } from './test-catalog.mjs';

const fail = message => { throw new Error(message); };
const nonnegative = (value, label) => {
  if (!Number.isFinite(value) || value < 0) fail(`Invalid ${label}`);
};
const integer = (value, label) => {
  nonnegative(value, label);
  if (!Number.isSafeInteger(value)) fail(`Invalid integer ${label}`);
};
const key = entry => `${entry.project}:${entry.path}`;

export function validateEvidence(catalog, reports, total) {
  if (!Number.isSafeInteger(total) || total < 1) fail('Invalid expected shard count');
  if (catalog.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(catalog.sha) || catalog.treeDigest !== hash(JSON.stringify(catalog.entries))) fail('Invalid catalog identity');
  if (reports.length !== total) fail(`Expected ${total} reports, found ${reports.length}`);
  const expected = catalog.entries.filter(entry => entry.lane === 'vitest-normal').map(entry => entry.path);
  const runIds = new Set(reports.map(report => report.run?.id ?? null));
  const events = new Set(reports.map(report => report.run?.event ?? null));
  if (runIds.size !== 1 || events.size !== 1) fail('Mixed workflow run/event identities');
  const indices = new Set();
  const allFiles = [];
  const cases = { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 };
  for (const report of reports) {
    if (report.schemaVersion !== 1 || report.sha !== catalog.sha || report.treeDigest !== catalog.treeDigest) fail('Report/catalog identity mismatch');
    const { index, total: count } = report.shard ?? {};
    if (!Number.isSafeInteger(index) || index < 1 || index > total || count !== total || indices.has(index)) fail('Invalid or duplicate shard');
    indices.add(index);
    if (report.status !== 'passed' || report.unhandledErrors !== 0) fail(`Shard ${index} did not pass cleanly`);
    if (![true, false, null].includes(report.cacheHit)) fail('Invalid cacheHit');
    nonnegative(report.wallTimeMs, 'wallTimeMs');
    if (!report.environment || !Number.isSafeInteger(report.environment.maxWorkers) || report.environment.maxWorkers < 1) fail('Missing runtime environment');
    if (!/^[a-f0-9]{64}$/.test(report.environment.lockDigest)) fail('Missing lockfile identity');
    assertExactPaths(expected, report.discovered.map(item => item.path), `Shard ${index}: complete discovery`);
    assertExactPaths(report.selected.map(key), report.files.map(key), `Shard ${index}: selected/executed`);
    for (const file of report.files) {
      if (!['node', 'jsdom'].includes(file.project) || file.state !== 'passed') fail(`File did not execute successfully: ${file.path}`);
      for (const field of Object.keys(cases)) integer(file.cases?.[field], `${file.path} cases.${field}`);
      if (!file.cases.total || file.cases.total !== file.cases.passed + file.cases.failed + file.cases.skipped + file.cases.pending) fail(`Empty/inconsistent case counts: ${file.path}`);
      if (file.cases.failed || file.cases.skipped || file.cases.pending) fail(`Failed/skipped/pending cases: ${file.path}`);
      integer(file.retries, 'retries'); integer(file.flaky, 'flaky');
      if (file.retries || file.flaky) fail(`Retried/flaky cases: ${file.path}`);
      nonnegative(file.durationMs, 'durationMs');
      for (const phase of ['environment', 'prepare', 'collect', 'setup']) nonnegative(file.phasesMs?.[phase], `phasesMs.${phase}`);
      allFiles.push(file.path);
      for (const field of Object.keys(cases)) cases[field] += file.cases[field];
    }
  }
  // File-level equality (not just count) catches missing files and cross-project duplicates.
  assertExactPaths(expected, allFiles, 'Complete Vitest execution');
  return {
    schemaVersion: 1, sha: catalog.sha, treeDigest: catalog.treeDigest,
    shards: total, files: allFiles.length, cases,
    wallTimeMsByShard: reports.sort((a, b) => a.shard.index - b.shard.index).map(report => report.wallTimeMs),
    cacheHitByShard: reports.map(report => report.cacheHit),
    attemptByShard: reports.map(report => report.run?.attempt ?? null),
  };
}

// A failed-jobs re-run retains earlier successful jobs. Keep each attempt in a
// separate artifact, then use the latest report for each shard, even if it failed.
export function selectLatestReports(reports, expectedRun = {}) {
  const latest = new Map();
  const seen = new Set();
  for (const report of reports) {
    const id = report.run?.id ?? null;
    const attemptValue = report.run?.attempt ?? null;
    const attempt = attemptValue === null ? 0 : Number(attemptValue);
    if ((id === null) !== (attemptValue === null)) fail('Incomplete workflow provenance');
    if (id !== null && (!/^\d+$/.test(id) || !/^\d+$/.test(attemptValue) || !Number.isSafeInteger(attempt) || attempt < 1)) fail('Invalid workflow provenance');
    if (expectedRun.id && !/^\d+$/.test(expectedRun.attempt ?? '')) fail('Missing expected run attempt');
    if (expectedRun.id && (id !== expectedRun.id || attempt > Number(expectedRun.attempt))) fail('Evidence belongs to another run/future attempt');
    if (expectedRun.event && report.run?.event !== expectedRun.event) fail('Evidence belongs to another event');
    const key = `${report.shard?.index}/${report.shard?.total}`;
    const version = `${key}/${id}/${attempt}`;
    if (seen.has(version)) fail('Duplicate shard/attempt evidence');
    seen.add(version);
    const previous = latest.get(key);
    if (!previous || attempt > Number(previous.run?.attempt ?? 0)) latest.set(key, report);
  }
  if (new Set(reports.map(report => report.run?.id ?? null)).size !== 1 || new Set(reports.map(report => report.run?.event ?? null)).size !== 1) fail('Mixed workflow run/event identities');
  return [...latest.values()];
}

export function verifyEvidence(directory, total) {
  const catalog = buildCatalog();
  const files = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  walk(directory);
  const inventories = files.filter(file => path.basename(file) === 'inventory.json');
  if (!inventories.length) fail('Missing downloaded catalog');
  for (const file of inventories) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (JSON.stringify(saved) !== JSON.stringify(catalog)) fail('Downloaded catalog differs from the current checkout');
  }
  const reports = files.filter(file => /^vitest-shard-.*\.json$/.test(path.basename(file)))
    .map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  for (const report of reports) {
    if (report.sha !== catalog.sha || report.treeDigest !== catalog.treeDigest) fail('Archived report/catalog identity mismatch');
  }
  const selected = selectLatestReports(reports, {
    id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT, event: process.env.GITHUB_EVENT_NAME,
  });
  return validateEvidence(catalog, selected, total);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) fail('Usage: node scripts/ci/verify-test-evidence.mjs DIRECTORY TOTAL');
    const summary = verifyEvidence(process.argv[2], Number(process.argv[3]));
    writeJson(path.join(process.argv[2], 'summary.json'), summary);
    console.log(JSON.stringify(summary));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n### Vitest execution evidence\n\n${summary.files} files, ${summary.cases.passed} cases; ${summary.shards} complete shards. No skips, retries or missing files.\n\nSHA: ${summary.sha}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
