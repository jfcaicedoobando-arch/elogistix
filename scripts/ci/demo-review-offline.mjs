#!/usr/bin/env node
/** Automatic review-only lane. No SQL, Docker, database, deployment or credentials. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertExactPaths, hash } from './test-catalog.mjs';

export const REVIEW_TESTS = Object.freeze([
  'docs/review/demo-flow-20261015/rpc/rpc-attempt.test.mjs',
  'scripts/ci/demo-review-offline.test.mjs',
]);
export function validateReviewLane(catalog, root = process.cwd()) {
  assert.equal(catalog.schemaVersion, 1, 'Expected complete test catalog schema');
  const entries = catalog.entries.filter(entry => entry.lane === 'node-demo-review');
  assertExactPaths(REVIEW_TESTS, entries.map(entry => entry.path), 'Demo review offline lane');
  for (const entry of entries) {
    assert.equal(entry.mode, 'automatic', 'Review lane must execute automatically');
    assert.equal(entry.sha256, hash(fs.readFileSync(path.join(root, entry.path))), `Review source drift: ${entry.path}`);
  }
  return entries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Usage: node scripts/ci/demo-review-offline.mjs CATALOG.json');
  const root = process.cwd();
  validateReviewLane(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), root);
  const commands = [
    // This contract test is explicitly catalogued, not hidden in a helper.
    [process.execPath, ['--test', 'scripts/ci/demo-review-offline.test.mjs']],
    // Immutable review runner verifies manifest and runs Python contracts + 98 RPC cases.
    ['python3', ['-I', 'docs/review/demo-flow-20261015/run_offline.py']],
  ];
  for (const [program, args] of commands) {
    const result = spawnSync(program, args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log('node-demo-review PASS (offline contracts only); SQL/HTTP runtime acceptance remains HOLD.');
}
