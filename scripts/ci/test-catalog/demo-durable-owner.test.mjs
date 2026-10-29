import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyFiles, hash, validateDurableOwnerLane } from '../test-catalog.mjs';

const owner = 'docs/review/demo-durable-owner-adapter-20261015/owner.test.mjs';
const regression = 'scripts/ci/test-catalog/demo-durable-owner.test.mjs';
const expected = [owner, regression];
const root = fileURLToPath(new URL('../../../', import.meta.url));
const required = [
  'src/a.test.ts', 'src/a.perf.test.ts', 'supabase/tests/guard.sql',
  'supabase/tests/rls/test_rls_a.sql', 'supabase/tests/support.sql',
  'supabase/functions/a/unit_test.ts', 'supabase/functions/a/smoke_test.ts',
  'tests/pdf/a.test.tsx', 'e2e/specs/a.spec.ts',
  'e2e/visual/audit119-126/specs/a.spec.ts', 'e2e/visual/specs/shared-ui.spec.ts',
];
const classify = extra => classifyFiles([...required, ...extra], ['supabase/tests/guard.sql'], {
  'supabase/tests/support.sql': 'Synthetic fixture support',
});
const catalog = () => ({
  schemaVersion: 1,
  entries: expected.map(file => ({ path: file, lane: 'node-demo-durable-owner', mode: 'automatic',
    sha256: hash(fs.readFileSync(new URL(`../../../${file}`, import.meta.url))) })),
});

test('census routes the original owner path and its regression to one automatic lane', () => {
  const entries = classify(expected).filter(entry => entry.lane === 'node-demo-durable-owner');
  assert.deepEqual(entries, expected.map(path => ({ path, lane: 'node-demo-durable-owner', mode: 'automatic' })));
});

test('nearby or renamed tests remain unknown instead of broadening the owner lane', () => {
  for (const file of [
    'docs/review/demo-durable-owner-adapter-20261015/unregistered.test.mjs',
    'docs/review/demo-durable-owner-adapter-20261016/owner.test.mjs',
    'scripts/ci/test-catalog/unregistered.test.mjs',
  ]) assert.throws(() => classify([...expected, file]), /Test has no execution lane/);
});

test('runner accepts only the exact catalogued owner and regression bytes', () => {
  assert.equal(validateDurableOwnerLane(catalog(), root).length, 2);
  const drift = catalog();
  drift.entries[0].sha256 = '0'.repeat(64);
  assert.throws(() => validateDurableOwnerLane(drift, root), /source drift/);
});

test('missing, extra, duplicate and manual owner entries reject before execution', () => {
  const original = catalog();
  for (const entries of [
    original.entries.slice(1),
    [...original.entries, { ...original.entries[0], path: 'unregistered.test.mjs' }],
    [...original.entries, original.entries[0]],
    original.entries.map(entry => ({ ...entry, mode: 'manual' })),
    original.entries.map(entry => ({ ...entry, mode: 'support' })),
  ]) assert.throws(() => validateDurableOwnerLane({ ...original, entries }, root));
  assert.throws(() => validateDurableOwnerLane({ ...original, schemaVersion: 0 }, root), /catalog schema/);
});

test('CI executes the owner lane through the catalog after inventory and Node setup', () => {
  const ci = fs.readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const start = ci.indexOf('      - name: Demo durable owner offline lane');
  const end = ci.indexOf('      - name: Post-deploy smoke contract', start);
  assert.ok(start > ci.indexOf('test-catalog.mjs --output reports/test-inventory.json'));
  const nodeSetup = ci.indexOf("node-version: '24.22.1'");
  assert.ok(nodeSetup >= 0 && nodeSetup < start);
  assert.ok(end > start);
  const step = ci.slice(start, end);
  assert.match(step, /node scripts\/ci\/test-catalog\.mjs --run node-demo-durable-owner reports\/test-inventory\.json/);
  assert.doesNotMatch(step, /\bif:|continue-on-error/);
});
