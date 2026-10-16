import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyFiles, hash } from './test-catalog.mjs';
import { REVIEW_TESTS, validateReviewLane } from './demo-review-offline.mjs';

const required = [
  'src/a.test.ts', 'src/a.perf.test.ts', 'supabase/tests/guard.sql',
  'supabase/tests/rls/test_rls_a.sql', 'supabase/tests/support.sql',
  'supabase/functions/a/unit_test.ts', 'supabase/functions/a/smoke_test.ts',
  'tests/pdf/a.test.tsx', 'e2e/specs/a.spec.ts',
  'e2e/visual/audit119-126/specs/a.spec.ts', 'e2e/visual/specs/shared-ui.spec.ts',
];
const classify = extra => classifyFiles([...required, ...extra], ['supabase/tests/guard.sql'], {'supabase/tests/support.sql':'Fixture support'});
test('exact RPC and lane regression tests are automatic executable entries', () => {
  const entries = classify(REVIEW_TESTS).filter(entry => entry.lane === 'node-demo-review');
  assert.deepEqual(entries.map(entry => entry.path).sort(), [...REVIEW_TESTS].sort());
  assert.ok(entries.every(entry => entry.mode === 'automatic'));
});
test('unrelated review tests still fail closed instead of disappearing', () => {
  assert.throws(() => classify([...REVIEW_TESTS, 'docs/review/demo-flow-20261015/rpc/unregistered.test.mjs']), /no execution lane/);
});
test('unrelated script tests still fail closed', () => {
  assert.throws(() => classify(['scripts/ci/unregistered.test.mjs']), /no execution lane/);
});
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-review-lane-'));
  t.after(() => fs.rmSync(root, {recursive:true, force:true}));
  for (const file of REVIEW_TESTS) { fs.mkdirSync(path.dirname(path.join(root,file)), {recursive:true}); fs.writeFileSync(path.join(root,file), 'synthetic source'); }
  const catalog = {schemaVersion:1, entries:REVIEW_TESTS.map(file => ({path:file,lane:'node-demo-review',mode:'automatic',sha256:hash('synthetic source')}))};
  return {root,catalog};
}
test('runner validates exact catalogued bytes before execution', t => {
  const {root,catalog}=fixture(t);assert.equal(validateReviewLane(catalog,root).length,2);
  fs.writeFileSync(path.join(root,REVIEW_TESTS[0]),'changed');assert.throws(()=>validateReviewLane(catalog,root),/source drift/);
});
test('missing, extra, duplicate and manual review entries fail before execution', t => {
  const {root,catalog}=fixture(t);
  for(const entries of [catalog.entries.slice(1), [...catalog.entries,{...catalog.entries[0],path:'other.test.mjs'}], [...catalog.entries,catalog.entries[0]], catalog.entries.map(e=>({...e,mode:'manual'}))])
    assert.throws(()=>validateReviewLane({...catalog,entries},root));
});
test('CI runs the review lane automatically after catalog generation', () => {
  const ci=fs.readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
  const section=ci.slice(ci.indexOf('      - name: Demo review offline lane'),ci.indexOf('      - name: Post-deploy smoke contract'));
  assert.match(section,/node scripts\/ci\/demo-review-offline\.mjs reports\/test-inventory\.json/);
  assert.doesNotMatch(section,/\bif:|continue-on-error/);
  assert.ok(ci.indexOf('test-catalog.mjs --output')<ci.indexOf('Demo review offline lane'));
  assert.match(ci,/node-version: '24\.19\.0'/);
});
