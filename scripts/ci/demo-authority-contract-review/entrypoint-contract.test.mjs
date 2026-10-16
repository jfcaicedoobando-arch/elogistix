/** Source tripwires and census tests only. No SQL, socket, external auth or ACL probe. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  AUTHORITY_CONTRACT_TESTS, buildCatalog, classifyFiles, validateAuthorityContractLane,
} from '../test-catalog.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => fs.readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const sourcePins = JSON.parse(fs.readFileSync(new URL('./source-pins.json', import.meta.url), 'utf8'));
const flow = 'docs/review/demo-flow-20261015/';
const owner = 'docs/review/demo-durable-owner-adapter-20261015/';
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const reviewedSources = [
  ...['issuer.mjs', 'owner.mjs', 'driver.mjs', 'store.mjs', 'store.sql'].map(name => owner + name),
  ...['01-private.sql', '04-engine.sql', '06-simulation-guards.sql'].map(name => flow + 'sql/' + name),
  ...['11-atomic-entry.sql', '12-approval-main.sql', '15-rpc-boundary.sql', '16-owner-registry.sql'].map(name => flow + 'issuer/' + name),
  ...['identity.sql', 'producer.sql', 'bridge.sql'].map(name => 'scripts/ci/demo-authentic-review/sql/' + name),
  ...['availability.ts', 'handler.ts', 'index.ts'].map(name => 'supabase/functions/demo-access/' + name),
  'src/features/marketing/lib/demoAccessAvailability.ts',
];

function verifyPins(pins) {
  assert.equal(pins.schema_version, 1);
  assert.equal(pins.base_commit, '025270cadcee0cedef64aab31be93eb0ff3f0288');
  assert.ok(pins.sources.length > 0);
  assert.equal(new Set(pins.sources.map(row => row.path)).size, pins.sources.length);
  assert.deepEqual(pins.sources.map(row => row.path).sort(), [...reviewedSources].sort());
  for (const row of pins.sources) {
    assert.match(row.path, /^(?:docs\/review|scripts\/ci\/demo-authentic-review|supabase\/functions\/demo-access|src\/features\/marketing\/lib)\/[a-zA-Z0-9_./-]+$/);
    assert.ok(!row.path.split('/').includes('..'));
    const checkedOut = fs.readFileSync(new URL('../../../' + row.path, import.meta.url));
    assert.ok(['EXACT', 'CRLF_TO_LF_ALLOWED'].includes(row.checkout_eol));
    // Git's Windows checkout may expand LF. Pin Git bytes; permit only this named
    // checkout transformation, never trim, reformat or regenerate an input.
    const bytes = row.checkout_eol === 'CRLF_TO_LF_ALLOWED'
      ? Buffer.from(checkedOut.toString('utf8').replaceAll('\r\n', '\n'), 'utf8') : checkedOut;
    assert.equal(bytes.length, row.bytes, row.path);
    assert.equal(digest('sha256', bytes), row.sha256, row.path);
    assert.equal(digest('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])), row.git_blob_sha1, row.path);
  }
}

function functionBody(source, name) {
  const start = source.indexOf('CREATE FUNCTION ' + name + '(');
  assert.ok(start >= 0, 'Missing reviewed function: ' + name);
  const bodyStart = source.indexOf('AS $$', start);
  assert.ok(bodyStart > start, 'Missing reviewed dollar body: ' + name);
  const end = source.indexOf('$$;', bodyStart + 5);
  assert.ok(end > bodyStart, 'Unclosed reviewed function: ' + name);
  return source.slice(bodyStart + 5, end);
}

test('source integrity: authority inputs equal the explicitly reviewed main bytes', () => {
  verifyPins(sourcePins);
});

test('source integrity rejects changed hash, missing source, duplicate and omitted base identity', () => {
  for (const mutate of [
    value => { value.sources[0].sha256 = '0'.repeat(64); },
    value => { value.sources.pop(); },
    value => { value.sources.push(value.sources[0]); },
    value => { delete value.base_commit; },
  ]) {
    const changed = structuredClone(sourcePins);
    mutate(changed);
    assert.throws(() => verifyPins(changed));
  }
});

test('evidence scope cannot promote offline composition to external identity or runtime ACL acceptance', () => {
  assert.deepEqual({
    scope: sourcePins.scope, wire: sourcePins.operational_wire,
    auth: sourcePins.external_authentication, acl: sourcePins.runtime_acl,
    durability: sourcePins.durability_and_restore, endpoint: sourcePins.endpoint,
  }, {
    scope: 'OFFLINE_SOURCE_AND_SYNTHETIC_COMPOSITION_ONLY', wire: 'UNBOUND',
    auth: 'NOT_RUN', acl: 'NOT_RUN', durability: 'NOT_RUN', endpoint: 'CLOSED',
  });
});

test('source tripwire: registry supplies no approval registration, role or grant', () => {
  const sql = read(flow + 'issuer/16-owner-registry.sql');
  assert.doesNotMatch(sql, /^\s*(?:GRANT|CREATE ROLE|ALTER ROLE)\b/im);
  assert.doesNotMatch(sql, /^\s*(?:INSERT INTO|UPDATE|DELETE FROM) demo_flow_writer\.(?:transport_approvals|scheduler_approvals)\b/im);
  assert.match(sql, /REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(sql, /current_user::regrole::oid<>owner_id OR session_user::regrole::oid<>owner_id/);
});

test('source tripwire: SQL scheduler sponsor is not reported as the authenticated human actor', () => {
  const registry = read(flow + 'issuer/16-owner-registry.sql');
  assert.match(registry, /'initiator_kind','scheduler','initiator_job_id',a\.job_id/);
  assert.match(registry, /'initiator_user_id',NULL/);
  const approval = read(flow + 'issuer/12-approval-main.sql');
  assert.match(functionBody(approval, 'demo_flow_writer.human_approval_main'), /v_uid uuid := auth\.uid\(\)/);
  assert.match(functionBody(approval, 'demo_flow_writer.demo_approval_main'), /v_uid uuid := NULL/);
});

test('known composition gap is retained as HOLD: RPC wrapper alone has no durable ingress consumption', () => {
  const sql = read(flow + 'issuer/15-rpc-boundary.sql');
  assert.match(sql, /prepare_execute_checkpoint\(p_context_id uuid,p_skip_ms bigint\)/);
  const body = functionBody(sql, 'demo_flow_writer.prepare_execute_checkpoint');
  assert.match(body, /assert_rpc_transport\(\)/);
  assert.match(body, /prepare_authorized_run\(p_context_id\)/);
  assert.match(body, /execute_and_checkpoint\(/);
  assert.doesNotMatch(body, /demo_owner_review|issuer_obligations|\bclaims\b/);
  // This PASS documents a missing fence; it must NEVER mean that bypass is safe.
  assert.equal(sourcePins.runtime_acl, 'NOT_RUN');
  const store = read(owner + 'store.mjs');
  assert.match(store, /unbound_business_entrypoint/);
  assert.doesNotMatch(store, /business:\s*['"`]SELECT demo_flow_writer\.prepare_execute_checkpoint/);
});

test('source tripwire: historical reconciliation requires independent access and cannot issue or execute', () => {
  const body = functionBody(read(flow + 'issuer/15-rpc-boundary.sql'), 'demo_flow_writer.reconcile_context');
  assert.match(body, /assert_context_read_access\(p_context_id\)/);
  assert.match(body, /transaction_read_only/);
  assert.match(body, /repeatable read/);
  assert.match(body, /'classification','unresolved'/);
  assert.doesNotMatch(body, /prepare_authorized_run\(|issue_scheduler_context\(|prepare_execute_checkpoint\(|execute_and_checkpoint\(/);
});

test('source tripwire: deferred guard is explicitly not an unconditional commit hook', () => {
  const sql = read(flow + 'sql/06-simulation-guards.sql');
  assert.match(sql, /SET CONSTRAINTS IMMEDIATE can drain it early/);
  assert.match(sql, /exclusive connection/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
});

test('source tripwire: public composition remains closed before clients, Auth and SQL', () => {
  const index = read('supabase/functions/demo-access/index.ts');
  assert.doesNotMatch(index, /^\s*(?:availabilityProvider|credentials)\s*:/m);
  assert.doesNotMatch(index, /createOwner|demo_flow_writer|demo_owner_review/);
  const handler = read('supabase/functions/demo-access/handler.ts');
  const gate = handler.indexOf('if (!await demoIsAvailable(dependencies.availabilityProvider))');
  const client = handler.indexOf('const admin = dependencies.createAdminClient()');
  assert.ok(gate >= 0 && client > gate);
  assert.match(handler.slice(gate, client), /demo_unavailable[\s\S]*503/);
  assert.match(read('src/features/marketing/lib/demoAccessAvailability.ts'), /status: "unavailable"/);
});

test('catalog: exactly these three tests execute automatically with the measured bytes', () => {
  const catalog = buildCatalog(root);
  assert.deepEqual(validateAuthorityContractLane(catalog, root).map(entry => entry.path).sort(), [...AUTHORITY_CONTRACT_TESTS].sort());
  for (const mutate of [
    value => { value.entries = value.entries.filter(entry => entry.path !== AUTHORITY_CONTRACT_TESTS[0]); },
    value => { value.entries.push({ ...value.entries.find(entry => entry.path === AUTHORITY_CONTRACT_TESTS[0]) }); },
    value => { value.entries.find(entry => entry.path === AUTHORITY_CONTRACT_TESTS[0]).mode = 'manual'; },
    value => { value.entries.find(entry => entry.path === AUTHORITY_CONTRACT_TESTS[0]).sha256 = '0'.repeat(64); },
    value => { value.entries.push({ path: 'scripts/ci/unreviewed.test.mjs', lane: 'node-demo-authority-contract', mode: 'automatic' }); },
  ]) {
    const changed = structuredClone(catalog);
    mutate(changed);
    assert.throws(() => validateAuthorityContractLane(changed, root));
  }
  const files = catalog.entries.map(entry => entry.path);
  const guards = catalog.entries.filter(entry => entry.lane === 'sql-guards').map(entry => entry.path);
  const support = Object.fromEntries(catalog.entries.filter(entry => entry.lane === 'sql-support').map(entry => [entry.path, entry.reason]));
  assert.throws(() => classifyFiles([...files, 'scripts/ci/demo-authority-contract-review/unregistered.test.mjs'], guards, support), /no execution lane/);
});

test('CI: authority contracts run unconditionally after the complete inventory and pinned Node', () => {
  const ci = read('.github/workflows/ci.yml');
  const start = ci.indexOf('      - name: Demo authority composition contracts offline');
  const end = ci.indexOf('      - name: Post-deploy smoke contract', start);
  assert.ok(start > ci.indexOf('test-catalog.mjs --output reports/test-inventory.json'));
  assert.ok(start > ci.indexOf("node-version: '24.19.0'"));
  assert.ok(end > start);
  const step = ci.slice(start, end);
  assert.match(step, /--run node-demo-authority-contract reports\/test-inventory.json/);
  assert.doesNotMatch(step, /\bif:|continue-on-error|secrets\.|--allow-net/);
});
