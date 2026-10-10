#!/usr/bin/env node
/** Complete file census; no fixed counts, dependency installation, backend or secrets. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const hash = value => createHash('sha256').update(value).digest('hex');
const normal = /\.(?:test|spec)\.tsx?$/;
const perf = /\.perf(?:\.test)?\.tsx?$/;
const candidate = /(?:\.(?:test|spec)\.[cm]?[jt]sx?|_test\.[cm]?[jt]sx?|\.perf\.tsx?)$/;

export function assertExactPaths(expected, actual, label) {
  if (!expected.length || !actual.length) throw new Error(`${label}: empty selection`);
  for (const [name, values] of [['expected', expected], ['actual', actual]]) {
    if (new Set(values).size !== values.length) throw new Error(`${label}: duplicate ${name} path`);
  }
  const missing = expected.filter(item => !actual.includes(item));
  const extra = actual.filter(item => !expected.includes(item));
  if (missing.length || extra.length) {
    throw new Error(`${label}: missing [${missing.join(', ')}]; unexpected [${extra.join(', ')}]`);
  }
}

export function classifyFiles(files, guards, sqlSupport) {
  const present = new Set(files);
  if (!guards.length || new Set(guards).size !== guards.length) throw new Error('SQL guards manifest is empty or duplicated');
  for (const file of [...guards, ...Object.keys(sqlSupport)]) {
    if (!present.has(file)) throw new Error(`Stale SQL manifest entry: ${file}`);
  }
  const entries = [];
  for (const file of files) {
    let lane;
    let mode = 'automatic';
    let reason;
    if (file.startsWith('supabase/tests/') && file.endsWith('.sql')) {
      const matches = [guards.includes(file), /^supabase\/tests\/rls\/test_rls_[^/]+\.sql$/.test(file), Object.hasOwn(sqlSupport, file)];
      if (matches.filter(Boolean).length !== 1) throw new Error(`Unclassified or multiply classified SQL: ${file}`);
      lane = matches[0] ? 'sql-guards' : matches[1] ? 'sql-rls' : 'sql-support';
      if (matches[2]) {
        mode = 'support'; reason = sqlSupport[file];
        if (typeof reason !== 'string' || !reason.trim()) throw new Error(`Missing SQL support rationale: ${file}`);
      }
    } else if (candidate.test(file)) {
      // Exact npm-test target; unrelated/new CJS tests must still fail closed.
      if (file === 'scripts/ci/selector148/tests/profile.test.cjs') lane = 'node-selector148';
      else if (/^(src|scripts)\//.test(file) && normal.test(file) && !perf.test(file)) lane = 'vitest-normal';
      else if (file.startsWith('src/') && perf.test(file)) { lane = 'vitest-perf'; mode = 'manual'; }
      else if (/^tests\/pdf\/.+\.test\.tsx$/.test(file)) {
        lane = 'pdf-real'; mode = file === 'tests/pdf/carteraPagination.test.tsx' ? 'automatic' : 'manual';
      } else if (/^supabase\/functions\/.+_test\.ts$/.test(file)) {
        lane = file.endsWith('/smoke_test.ts') ? 'deno-smoke' : 'deno';
        if (lane === 'deno-smoke') mode = 'manual';
      } else if (/^e2e\/specs\/.+\.spec\.ts$/.test(file)) { lane = 'playwright-staging'; mode = 'manual'; }
      else if (/^e2e\/visual\/audit(?:119-126|136-137)\/specs\/[^/]+\.spec\.ts$/.test(file)) lane = 'playwright-isolated';
      else if (file === 'e2e/visual/specs/shared-ui.spec.ts') { lane = 'playwright-visual'; mode = 'manual'; }
      else throw new Error(`Test has no execution lane: ${file}`);
    }
    if (lane) entries.push({ path: file, lane, mode, ...(reason ? { reason } : {}) });
  }
  for (const lane of ['vitest-normal', 'vitest-perf', 'sql-guards', 'sql-rls', 'sql-support', 'deno', 'deno-smoke', 'pdf-real', 'playwright-staging', 'playwright-isolated', 'playwright-visual']) {
    if (!entries.some(entry => entry.lane === lane)) throw new Error(`Empty execution lane: ${lane}`);
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function buildCatalog(root = process.cwd()) {
  // Include untracked source tests locally, but never ignored reports/node_modules.
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(file => fs.existsSync(path.join(root, file))).sort();
  const guards = fs.readFileSync(path.join(root, 'supabase/tests/_guards_manifest.txt'), 'utf8')
    .split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const support = JSON.parse(fs.readFileSync(path.join(root, 'scripts/ci/test-catalog/sql-support.json'), 'utf8'));
  const entries = classifyFiles(files, guards, support).map(entry => ({ ...entry, sha256: hash(fs.readFileSync(path.join(root, entry.path))) }));
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sha) throw new Error('GITHUB_SHA differs from checked-out HEAD');
  return {
    schemaVersion: 1, sha,
    treeDigest: hash(JSON.stringify(entries)),
    entries,
    counts: Object.fromEntries([...new Set(entries.map(entry => entry.lane))].map(lane => [lane, entries.filter(entry => entry.lane === lane).length])),
  };
}

export function validateRlsEvidence(catalog, tsv) {
  const [header, ...lines] = tsv.trimEnd().split('\n');
  if (header !== 'path\tstatus\tdurationMs') throw new Error('Invalid RLS evidence header');
  const rows = lines.map(line => line.split('\t'));
  for (const row of rows) {
    if (row.length !== 3 || row[1] !== 'passed' || !/^\d+$/.test(row[2])) throw new Error('Failed/incomplete RLS execution evidence');
  }
  assertExactPaths(catalog.entries.filter(entry => entry.lane === 'sql-rls').map(entry => entry.path), rows.map(row => row[0]), 'Complete RLS execution');
  return { sha: catalog.sha, files: rows.length, durationMs: rows.reduce((sum, row) => sum + Number(row[2]), 0) };
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const catalog = buildCatalog();
    if (process.argv[2] === '--output' && process.argv.length === 4) {
      writeJson(process.argv[3], catalog);
      console.log(JSON.stringify({ sha: catalog.sha, treeDigest: catalog.treeDigest, counts: catalog.counts }));
    } else if (process.argv[2] === '--verify-rls' && process.argv.length === 4) {
      console.log(JSON.stringify(validateRlsEvidence(catalog, fs.readFileSync(process.argv[3], 'utf8'))));
    } else if (process.argv[2] === '--list' && process.argv.length === 4) {
      const entries = catalog.entries.filter(entry => entry.lane === process.argv[3]);
      if (!entries.length) throw new Error(`Unknown/empty lane: ${process.argv[3]}`);
      console.log(entries.map(entry => entry.path).join('\n'));
    } else throw new Error('Usage: node scripts/ci/test-catalog.mjs --output FILE | --list LANE | --verify-rls FILE');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
