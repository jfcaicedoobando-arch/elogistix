/** Source/census tripwires only; zero database, auth service, provider or endpoint calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createIssuer} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {createOwner} from '../../../docs/review/demo-durable-owner-adapter-20261015/owner.mjs';
import {EMPTY_CONFIG} from '../../../docs/review/demo-durable-owner-adapter-20261015/driver.mjs';
import {SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/store.mjs';
import {AUTHORITY_BRIDGE_TESTS, classifyFiles, hash, validateAuthorityBridgeLane} from '../test-catalog.mjs';
import * as contract from './contract.mjs';
import {syntheticSnapshots} from './synthetic-fixtures.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => fs.readFileSync(root + path, 'utf8');
const pins = JSON.parse(read('scripts/ci/demo-authority-bridge-review/source-pins.json'));
const owner = 'docs/review/demo-durable-owner-adapter-20261015/';
const expectedSources = [
  ...['issuer.mjs', 'owner.mjs', 'driver.mjs', 'store.mjs', 'store.sql', 'config.example.json'].map(name => owner + name),
  'docs/review/demo-flow-20261015/issuer/15-rpc-boundary.sql',
  'docs/review/demo-flow-20261015/issuer/16-owner-registry.sql',
  'scripts/ci/demo-authentic-review/sql/producer.sql',
  'supabase/functions/demo-access/index.ts', 'supabase/functions/demo-access/handler.ts',
  'src/features/marketing/lib/demoAccessAvailability.ts',
];
function verifyPins(value) {
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.baseCommit, 'b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa');
  assert.deepEqual(value.sources.map(row => row.path).sort(), [...expectedSources].sort());
  for (const row of value.sources) {
    assert.ok(['CRLF_TO_LF_ALLOWED', 'EXACT'].includes(row.checkout_eol));
    const raw = fs.readFileSync(root + row.path);
    const bytes = row.checkout_eol === 'CRLF_TO_LF_ALLOWED' ? Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n')) : raw;
    assert.equal(bytes.length, row.bytes);
    assert.equal(hash(bytes), row.sha256, row.path);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex'), row.git_blob_sha1);
  }
}

test('source pins preserve unchanged issuer/owner/SQL/product inputs and reject evidence drift', () => {
  verifyPins(pins);
  for (const mutate of [p => p.sources.pop(), p => p.sources.push(p.sources[0]),
    p => { p.sources[0].sha256 = '0'.repeat(64); }, p => { p.baseCommit = ''; }]) {
    const changed = structuredClone(pins); mutate(changed);
    assert.throws(() => verifyPins(changed));
  }
});

test('operational gates remain explicitly unconfigured, without network or database factory exports', async () => {
  assert.deepEqual(Object.keys(contract).sort(), ['classifyDeclaredIssuance', 'mapDeclaredVerifiedSnapshots', 'validateBinding']);
  assert.deepEqual(EMPTY_CONFIG, {deployment: '', database: '', sessionUser: '', durabilityEvidence: '', driverEvidence: ''});
  assert.deepEqual(JSON.parse(read(owner + 'config.example.json')), EMPTY_CONFIG);
  await assert.rejects(createIssuer().derive(syntheticSnapshots()), /^Error: HOLD_ISSUER_UNBOUND$/);
  let calls = 0;
  assert.deepEqual(await createOwner({
    openWire: () => { calls++; throw Error('MUST_NOT_OPEN'); },
    authenticate: () => { calls++; throw Error('MUST_NOT_AUTHENTICATE'); },
    businessGuard: () => { calls++; throw Error('MUST_NOT_GUARD'); },
  }).execute({contextId: syntheticSnapshots().serverContext.contextId}), {outcome: 'quarantine'});
  assert.equal(calls, 0);
  assert.match(SQL.business, /unbound_business_entrypoint/);
  assert.deepEqual(Object.fromEntries(['evidenceProvider', 'authentication', 'businessGuard', 'businessSQL'].map(k => [k, pins[k]])),
    {evidenceProvider: 'UNBOUND', authentication: 'UNBOUND', businessGuard: 'UNBOUND', businessSQL: 'UNBOUND'});
  assert.equal(pins.runtimeACL, 'NOT_RUN'); assert.equal(pins.restoreDurability, 'NOT_RUN');
});

test('current owner pre-BEGIN guard retains the revocation race and cannot replace an in-businessTX check', () => {
  const source = read(owner + 'owner.mjs');
  const guard = source.indexOf('if(await businessGuard(');
  const begin = source.indexOf('await d.query(SQL.begin,', guard);
  const business = source.indexOf('await d.query(SQL.business,', begin);
  assert.ok(guard >= 0 && begin > guard && business > begin);
  assert.match(source, /SQL business entrypoint must ALSO enforce authoritative current guards in businessTX/);
  // This source assertion identifies a remaining race; it is NOT a concurrency/ACL test.
  assert.equal(pins.businessSQL, 'UNBOUND');
});

test('SQL15 still does not consume the durable ledger and must remain HOLD', () => {
  const wrapper = read('docs/review/demo-flow-20261015/issuer/15-rpc-boundary.sql');
  const start = wrapper.indexOf('CREATE FUNCTION demo_flow_writer.prepare_execute_checkpoint(');
  const body = wrapper.slice(start, wrapper.indexOf('$$;', start));
  assert.ok(start >= 0);
  assert.match(body, /prepare_authorized_run\(p_context_id\)/);
  assert.match(body, /execute_and_checkpoint\(/);
  assert.doesNotMatch(body, /demo_owner_review|issuer_obligations|\bclaims\b/);
  assert.doesNotMatch(SQL.business, /prepare_execute_checkpoint/);
});

test('actual producer chain exists but does not supply the proposed protected occurrence/fence record', () => {
  const producer = read('scripts/ci/demo-authentic-review/sql/producer.sql');
  const registry = read('docs/review/demo-flow-20261015/issuer/16-owner-registry.sql');
  for (const relation of ['preparation_admissions', 'preparation_runs', 'prepared_receipts']) assert.ok(producer.includes(relation));
  for (const relation of ['scheduler_approvals', 'server_admissions']) assert.ok(registry.includes(relation));
  assert.doesNotMatch(producer + registry, /authorizedOccurrence|authorized_occurrence|restoreFence|restore_fence/);
  assert.match(registry, /'initiator_user_id',NULL/);
  assert.match(read(owner + 'issuer.mjs'), /JSON\.stringify\(\[1,deployment,\.\.\.fields\.map\(k=>a\[k\]\)\]\)/);
  assert.doesNotMatch(read('scripts/ci/demo-authority-bridge-review/contract.mjs'), /createHash|node:crypto|crypto\.subtle/);
});

test('product endpoint stays closed before Auth and SQL and cannot import this review mapper', () => {
  const index = read('supabase/functions/demo-access/index.ts'), handler = read('supabase/functions/demo-access/handler.ts');
  assert.doesNotMatch(index, /^\s*(?:availabilityProvider|credentials)\s*:/m);
  assert.doesNotMatch(index + handler, /demo-authority-bridge-review|mapDeclaredVerifiedSnapshots|createOwner/);
  const gate = handler.indexOf('if (!await demoIsAvailable(dependencies.availabilityProvider))');
  const client = handler.indexOf('const admin = dependencies.createAdminClient()');
  assert.ok(gate >= 0 && client > gate);
  assert.match(handler.slice(gate, client), /demo_unavailable[\s\S]*503/);
  assert.match(read('src/features/marketing/lib/demoAccessAvailability.ts'), /status: "unavailable"/);
  assert.equal(pins.endpoint, 'CLOSED');
});

test('exact test census rejects missing, duplicate, extra, manual, drift and unregistered paths', () => {
  const actual = fs.readdirSync(root + 'scripts/ci/demo-authority-bridge-review')
    .filter(file => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file))
    .map(file => 'scripts/ci/demo-authority-bridge-review/' + file).sort();
  assert.deepEqual(actual, [...AUTHORITY_BRIDGE_TESTS].sort());
  // Minimal representative census tests classifyFiles, NOT a claim of a full local checkout census.
  const support = {'supabase/tests/support.sql': 'SYNTHETIC support declaration'};
  const guards = ['supabase/tests/guard.sql'];
  const paths = [...actual, ...guards, ...Object.keys(support), 'supabase/tests/rls/test_rls_synthetic.sql',
    'src/synthetic.test.ts', 'src/synthetic.perf.tsx', 'supabase/functions/synthetic/unit_test.ts',
    'supabase/functions/synthetic/smoke_test.ts', 'tests/pdf/synthetic.test.tsx',
    'e2e/specs/synthetic.spec.ts', 'e2e/visual/specs/shared-ui.spec.ts', 'e2e/visual/specs-unused.txt',
    'e2e/visual/virtualization/specs/virtualization.spec.ts'];
  const classified = classifyFiles(paths, guards, support).filter(entry => entry.lane === 'node-demo-authority-bridge');
  const catalog = {schemaVersion: 1, entries: classified.map(entry => ({...entry, sha256: hash(fs.readFileSync(root + entry.path))}))};
  assert.deepEqual(validateAuthorityBridgeLane(catalog, root).map(entry => entry.path).sort(), actual);
  for (const mutate of [
    c => c.entries.pop(), c => c.entries.push(c.entries[0]),
    c => { c.entries[0].mode = 'manual'; }, c => { c.entries[0].sha256 = '0'.repeat(64); },
    c => c.entries.push({path: 'scripts/ci/demo-authority-bridge-review/extra.test.mjs', lane: 'node-demo-authority-bridge', mode: 'automatic'}),
    c => { c.entries[0].lane = 'node-demo-authority-contract'; },
  ]) {
    const changed = structuredClone(catalog); mutate(changed);
    assert.throws(() => validateAuthorityBridgeLane(changed, root));
  }
  assert.throws(() => classifyFiles([...paths, 'scripts/ci/demo-authority-bridge-review/unregistered.test.mjs'], guards, support), /no execution lane/);
});

test('CI runs the exact bridge lane automatically after inventory with pinned Node, preserving previous lanes', () => {
  const ci = read('.github/workflows/ci.yml');
  const start = ci.indexOf('      - name: Demo authority bridge offline');
  const end = ci.indexOf('      - name: Post-deploy smoke contract', start);
  assert.ok(start > ci.indexOf('test-catalog.mjs --output reports/test-inventory.json'));
  assert.ok(start > ci.indexOf("node-version: '24.19.0'"));
  assert.ok(end > start);
  const step = ci.slice(start, end);
  assert.match(step, /--run node-demo-authority-bridge reports\/test-inventory.json/);
  assert.doesNotMatch(step, /\bif:|continue-on-error|secrets\.|--allow-net/);
  for (const lane of ['node-demo-durable-owner', 'node-demo-wire-lab', 'node-demo-authority-contract']) {
    assert.ok(ci.includes('--run ' + lane + ' reports/test-inventory.json'));
  }
});

test('internally coherent synthetic claims passing the mapper are explicitly not authentication', () => {
  // There is intentionally no cryptographic/provider check. This counterexample
  // prevents treating a declaration label or generated UUID as verified authority.
  const invented = syntheticSnapshots();
  assert.doesNotThrow(() => contract.mapDeclaredVerifiedSnapshots(invented));
  assert.equal(pins.scope, 'OFFLINE_DECLARED_SNAPSHOTS_ONLY');
  assert.equal(pins.evidenceProvider, 'UNBOUND');
});
