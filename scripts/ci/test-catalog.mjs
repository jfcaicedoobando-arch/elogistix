#!/usr/bin/env node
/** Complete file census; no fixed counts, dependency installation, backend or secrets. */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const hash = value => createHash('sha256').update(value).digest('hex');
const normal = /\.(?:test|spec)\.tsx?$/;
const perf = /\.perf(?:\.test)?\.tsx?$/;
const candidate = /(?:\.(?:test|spec)\.[cm]?[jt]sx?|_test\.[cm]?[jt]sx?|\.perf\.tsx?)$/;

export const DURABLE_OWNER_TESTS = Object.freeze([
  'docs/review/demo-durable-owner-adapter-20261015/owner.test.mjs',
  'scripts/ci/test-catalog/demo-durable-owner.test.mjs',
]);
export const PHYSICAL_WIRE_TESTS = Object.freeze([
  'scripts/ci/demo-wire-lab/lab_wire.test.mjs',
  'scripts/ci/test-catalog/demo-wire-lab.test.mjs',
]);

export const DEMO_PREFREEZE_EVIDENCE = 'reports/demo-guard-prefreeze/actions-result.json';
const DEMO_PREFREEZE_MIGRATION = '20261015050000_disable_demo_reseed.sql';
// Literal a58228a suites remain executable history, before the disabled forward.
export const DEMO_PREFREEZE_SOURCES = Object.freeze({
  'supabase/tests/rls/history/demo-prefreeze/test_rls_demo_seed_core_compatibility.sql': 'e0668c846c41821483303ba5db78bc7c491557e7f294f1544055638f50ef191d',
  'supabase/tests/rls/history/demo-prefreeze/test_rls_demo_seed_tenant_guard.sql': '73f5772584bd7e28da732605217e5917b77661592e1dbf2a7ea0185e5b345e22',
  'supabase/tests/rls/history/demo-prefreeze/test_rls_demo_seed_guard_repeatable_read.sql': 'a27e9238b1689ff8cd47045681f933e03ac758d9b45a16b8b2cf92f2294cf860',
  'supabase/tests/rls/history/demo-prefreeze/test_rls_demo_seed_guard_serializable.sql': 'cd05fcb331c27b34db6554befbf63e783bacac9689d118ce46cf57546d9555d0',
});
const DEMO_PREFREEZE_CONCURRENCY = 'scripts/ci/demo-guard/concurrency.py';
const DEMO_PREFREEZE_CONCURRENCY_SHA256 = '01250f665e0bd3456c9272cc23616f94a296a0244fdf4a20aabc0af1660c87a0';

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
      else if (file === 'scripts/ci/post-deploy-smoke.test.mjs') lane = 'node-post-deploy-smoke';
      // Review-only protocol/source tests have an automatic offline CI runner.
      else if (file === 'docs/review/demo-flow-20261015/rpc/rpc-attempt.test.mjs'
        || file === 'scripts/ci/demo-review-offline.test.mjs') lane = 'node-demo-review';
      else if (DURABLE_OWNER_TESTS.includes(file)) lane = 'node-demo-durable-owner';
      else if (PHYSICAL_WIRE_TESTS.includes(file)) lane = 'node-demo-wire-lab';
      else if (/^(src|scripts)\//.test(file) && normal.test(file) && !perf.test(file)) lane = 'vitest-normal';
      else if (file.startsWith('src/') && perf.test(file)) { lane = 'vitest-perf'; mode = 'manual'; }
      else if (/^tests\/pdf\/.+\.test\.tsx$/.test(file)) {
        lane = 'pdf-real'; mode = file === 'tests/pdf/carteraPagination.test.tsx' ? 'automatic' : 'manual';
      } else if (/^supabase\/functions\/.+_test\.ts$/.test(file)) {
        lane = file.endsWith('/smoke_test.ts') ? 'deno-smoke' : 'deno';
        if (lane === 'deno-smoke') mode = 'manual';
      } else if (/^e2e\/specs\/.+\.spec\.ts$/.test(file)) { lane = 'playwright-staging'; mode = 'manual'; }
      else if (/^e2e\/visual\/audit(?:119-126|136-137)\/specs\/[^/]+\.spec\.ts$/.test(file)) lane = 'playwright-isolated';
      else if (file === 'e2e/visual/virtualization/specs/virtualization.spec.ts') lane = 'playwright-isolated';
      else if (file === 'e2e/visual/specs/shared-ui.spec.ts') { lane = 'playwright-visual'; mode = 'manual'; }
      else throw new Error(`Test has no execution lane: ${file}`);
    }
    if (lane) entries.push({ path: file, lane, mode, ...(reason ? { reason } : {}),
      ...(Object.hasOwn(DEMO_PREFREEZE_SOURCES, file) ? { verificationEvidence: DEMO_PREFREEZE_EVIDENCE } : {}) });
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

export function validateDurableOwnerLane(catalog, root = process.cwd()) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.entries)) throw new Error('Expected complete test catalog schema');
  const entries = catalog.entries.filter(entry => entry.lane === 'node-demo-durable-owner');
  assertExactPaths(DURABLE_OWNER_TESTS, entries.map(entry => entry.path), 'Demo durable owner offline lane');
  for (const entry of entries) {
    if (entry.mode !== 'automatic') throw new Error('Durable owner lane must execute automatically');
    if (entry.sha256 !== hash(fs.readFileSync(path.join(root, entry.path)))) throw new Error(`Durable owner source drift: ${entry.path}`);
  }
  return entries;
}

export function validatePhysicalWireLane(catalog, root = process.cwd()) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.entries)) throw new Error('Expected complete test catalog schema');
  const entries = catalog.entries.filter(entry => entry.lane === 'node-demo-wire-lab');
  assertExactPaths(PHYSICAL_WIRE_TESTS, entries.map(entry => entry.path), 'Physical wire offline lane');
  for (const entry of entries) {
    if (entry.mode !== 'automatic') throw new Error('Physical wire lane must execute automatically');
    if (entry.sha256 !== hash(fs.readFileSync(path.join(root, entry.path)))) throw new Error(`Physical wire source drift: ${entry.path}`);
  }
  return entries;
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

export function validatePrefreezeEvidence(catalog, evidence, root = process.cwd()) {
  const require = (condition, message) => {
    if (!condition) throw new Error(`Demo prefreeze evidence: ${message}`);
  };
  const expected = Object.keys(DEMO_PREFREEZE_SOURCES);
  const historical = catalog.entries.filter(entry => Object.hasOwn(DEMO_PREFREEZE_SOURCES, entry.path));
  assertExactPaths(expected, historical.map(entry => entry.path), 'Demo prefreeze catalog');
  for (const entry of historical) {
    require(entry.lane === 'sql-support' && entry.mode === 'support'
      && entry.verificationEvidence === DEMO_PREFREEZE_EVIDENCE, 'historical suite lost its mandatory evidence binding');
    require(entry.sha256 === DEMO_PREFREEZE_SOURCES[entry.path], `historical source drift: ${entry.path}`);
  }
  require(evidence?.schemaVersion === 1 && evidence.sha === catalog.sha, 'source identity mismatch');
  require(evidence.phase === 'pre-forward' && evidence.beforeMigration === DEMO_PREFREEZE_MIGRATION,
    'execution must precede the exact disabled forward');
  require(evidence.status === 'passed' && evidence.sourcePreserved === true, 'execution/source preservation did not pass');
  const positiveOid = value => Number.isSafeInteger(value) && value > 0;
  const namedDatabase = (value, prefix) => typeof value === 'string' && value.length === prefix.length + 32
    && value.startsWith(prefix) && /^[a-f0-9]+$/.test(value.slice(prefix.length));
  const checkpoint = evidence.checkpoint;
  require(checkpoint?.executions === 1 && checkpoint.created === true && checkpoint.dropped === true
    && positiveOid(checkpoint.oid) && namedDatabase(checkpoint.database, 'demo_guard_checkpoint_'),
  'one created and removed pre-forward checkpoint is required');
  const clones = evidence.cloneRuns;
  require(Array.isArray(clones) && clones.length === 2, 'two fresh clone runs are required');
  for (const clone of clones) {
    require(clone?.status === 'passed' && clone.dropped === true && positiveOid(clone.oid)
      && namedDatabase(clone.database, 'demo_guard_race_'), 'clone execution/removal did not pass');
  }
  require(new Set(clones.map(clone => clone.database)).size === 2
    && new Set([checkpoint.oid, ...clones.map(clone => clone.oid)]).size === 3,
  'checkpoint and clones must have distinct identities');
  require(Array.isArray(evidence.files), 'historical execution list is absent');
  assertExactPaths(expected, evidence.files.map(file => file.path), 'Demo prefreeze execution');
  const verifyRun = (run, expectedPath, sha256) => {
    require(run?.path === expectedPath && run.sha256 === sha256, `execution source mismatch: ${expectedPath}`);
    require(run.status === 'passed' && run.exitCode === 0 && run.executions === 2
      && Number.isFinite(run.durationMs) && run.durationMs >= 0,
    `both positive executions are required: ${expectedPath}`);
  };
  for (const file of evidence.files) verifyRun(file, file.path, DEMO_PREFREEZE_SOURCES[file.path]);
  require(hash(fs.readFileSync(path.join(root, DEMO_PREFREEZE_CONCURRENCY))) === DEMO_PREFREEZE_CONCURRENCY_SHA256,
    'original concurrency source drift');
  verifyRun(evidence.concurrency, DEMO_PREFREEZE_CONCURRENCY, DEMO_PREFREEZE_CONCURRENCY_SHA256);
  return { sha: catalog.sha, files: expected.length, executions: expected.length * 2, concurrencyExecutions: 2, checkpoints: 1, clones: 2 };
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
      const rls = validateRlsEvidence(catalog, fs.readFileSync(process.argv[3], 'utf8'));
      const prefreeze = catalog.entries.some(entry => Object.hasOwn(DEMO_PREFREEZE_SOURCES, entry.path))
        ? { prefreeze: validatePrefreezeEvidence(catalog, JSON.parse(fs.readFileSync(DEMO_PREFREEZE_EVIDENCE, 'utf8'))) } : {};
      console.log(JSON.stringify({ ...rls, ...prefreeze }));
    } else if (process.argv[2] === '--verify-prefreeze' && process.argv.length === 4) {
      console.log(JSON.stringify(validatePrefreezeEvidence(catalog, JSON.parse(fs.readFileSync(process.argv[3], 'utf8')))));
    } else if (process.argv[2] === '--list' && process.argv.length === 4) {
      const entries = catalog.entries.filter(entry => entry.lane === process.argv[3]);
      if (!entries.length) throw new Error(`Unknown/empty lane: ${process.argv[3]}`);
      console.log(entries.map(entry => entry.path).join('\n'));
    } else if (process.argv[2] === '--run' && ['node-demo-durable-owner', 'node-demo-wire-lab'].includes(process.argv[3]) && process.argv.length === 5) {
      const recorded = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
      if (recorded.sha !== catalog.sha) throw new Error('Durable owner catalog HEAD mismatch');
      const entries = process.argv[3] === 'node-demo-wire-lab' ? validatePhysicalWireLane(recorded) : validateDurableOwnerLane(recorded);
      const result = spawnSync(process.execPath, ['--test', ...entries.map(entry => entry.path)], { stdio: 'inherit' });
      if (result.error) throw result.error;
      if (result.status !== 0) process.exitCode = result.status ?? 1;
      else console.log(`${process.argv[3]} PASS (offline fixtures only); wire remains UNBOUND.`);
    } else throw new Error('Usage: node scripts/ci/test-catalog.mjs --output FILE | --list LANE | --run {node-demo-durable-owner|node-demo-wire-lab} CATALOG.json | --verify-rls FILE | --verify-prefreeze FILE');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
