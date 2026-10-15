import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildCatalog, PHYSICAL_WIRE_TESTS, validatePhysicalWireLane } from '../test-catalog.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));

test('physical wire files have an automatic exact catalog lane and unchanged bytes', () => {
  const catalog = buildCatalog(root);
  assert.deepEqual(validatePhysicalWireLane(catalog, root).map(entry => entry.path).sort(), [...PHYSICAL_WIRE_TESTS].sort());
  for (const mutate of [
    c => { c.entries = c.entries.filter(e => e.path !== PHYSICAL_WIRE_TESTS[0]); },
    c => { c.entries.find(e => e.path === PHYSICAL_WIRE_TESTS[0]).mode = 'manual'; },
    c => { c.entries.find(e => e.path === PHYSICAL_WIRE_TESTS[0]).sha256 = '0'.repeat(64); },
  ]) { const changed = structuredClone(catalog); mutate(changed); assert.throws(() => validatePhysicalWireLane(changed, root)); }
});

test('general CI runs offline wire tests unconditionally after the complete inventory', () => {
  const ci = fs.readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const start = ci.indexOf('      - name: Demo physical wire state machine offline lane');
  const end = ci.indexOf('      - name: Post-deploy smoke contract', start);
  assert.ok(start > ci.indexOf('test-catalog.mjs --output reports/test-inventory.json'));
  assert.ok(start > ci.indexOf("node-version: '24.19.0'"));
  assert.ok(end > start);
  assert.match(ci.slice(start, end), /--run node-demo-wire-lab reports\/test-inventory.json/);
  assert.doesNotMatch(ci.slice(start, end), /\bif:|continue-on-error/);
  const lab = fs.readFileSync(new URL('../../../.github/workflows/demo-wire-lab.yml', import.meta.url), 'utf8');
  assert.match(lab, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(lab, /GITHUB_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
});
