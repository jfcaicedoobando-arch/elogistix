/** Pure SYNTHETIC contract tests. Passing never proves identity, ACL, provenance or restoration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mapDeclaredVerifiedSnapshots, validateBinding} from './contract.mjs';
import {syntheticSnapshots, syntheticIssuance, renewArtifact, renewContext, id} from './synthetic-fixtures.mjs';

test('strict mapper supplies the real issuer with the exact natural key and full immutable binding', async () => {
  const input = syntheticSnapshots(), copy = structuredClone(input);
  const mapped = mapDeclaredVerifiedSnapshots(input);
  assert.deepEqual(Object.keys(mapped), ['tenant', 'manifestIdentity', 'schedulerJob', 'authorizedOccurrence', 'contextId', 'binding']);
  const {envelope} = await syntheticIssuance(input);
  assert.deepEqual(JSON.parse(envelope.canonical), [1, input.deployment, mapped.tenant,
    mapped.manifestIdentity, mapped.schedulerJob, mapped.authorizedOccurrence]);
  assert.deepEqual(JSON.parse(envelope.parameters[7]), mapped.binding);
  assert.deepEqual(input, copy);
  assert.ok(Object.isFrozen(mapped) && Object.isFrozen(mapped.binding.preparationAdmission.schedulerSnapshot));
  input.schedulerApproval.jobId = 'SYNTHETIC_MUTATION';
  assert.equal(mapped.binding.schedulerApproval.jobId, 'SYNTHETIC_JOB');
});

function objects(value, path = []) {
  return [[path, value], ...Object.entries(value).flatMap(([key, item]) =>
    item && typeof item === 'object' && !Array.isArray(item) ? objects(item, [...path, key]) : [])];
}
const at = (value, path) => path.reduce((object, key) => object[key], value);

test('every required input field is rejected when absent and every nested object rejects extras', () => {
  const baseline = syntheticSnapshots();
  let removed = 0, extras = 0;
  for (const [path, object] of objects(baseline)) {
    for (const key of Object.keys(object)) {
      const changed = structuredClone(baseline); delete at(changed, path)[key];
      assert.throws(() => mapDeclaredVerifiedSnapshots(changed), /HOLD_SCHEMA/, [...path, key].join('.')); removed++;
    }
    const changed = structuredClone(baseline); at(changed, path).callerOverride = true;
    assert.throws(() => mapDeclaredVerifiedSnapshots(changed), /HOLD_SCHEMA/); extras++;
  }
  assert.equal(removed, objects(baseline).reduce((count, [, object]) => count + Object.keys(object).length, 0));
  assert.equal(extras, objects(baseline).length);
});

test('every binding field and nesting is strict, with canonical JSON key order', () => {
  const baseline = mapDeclaredVerifiedSnapshots(syntheticSnapshots()).binding;
  for (const [path, object] of objects(baseline)) {
    for (const key of Object.keys(object)) {
      const changed = structuredClone(baseline); delete at(changed, path)[key];
      assert.throws(() => validateBinding(changed), /HOLD_SCHEMA/);
    }
    const changed = structuredClone(baseline); at(changed, path).extra = 'SYNTHETIC';
    assert.throws(() => validateBinding(changed), /HOLD_SCHEMA/);
  }
  const reverse = value => value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)])) : value;
  assert.equal(JSON.stringify(validateBinding(reverse(baseline))), JSON.stringify(baseline));
});

test('plain JSON boundary rejects getters, symbols, hidden properties and custom prototypes without invoking them', () => {
  for (const mutate of [
    e => Object.defineProperty(e.protectedAuthority, 'skipMs', {get() {throw Error('GETTER_MUST_NOT_RUN');}, enumerable: true}),
    e => { e[Symbol('SYNTHETIC')] = true; },
    e => Object.defineProperty(e, 'hidden', {value: true}),
    e => Object.setPrototypeOf(e.protectedAuthority, {inherited: 'SYNTHETIC'}),
  ]) {
    const e = syntheticSnapshots(); mutate(e);
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA/);
  }
});

for (const value of [-1, -0, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '0', null, 1n]) {
  test(`governed skip rejects ${String(value)} (${typeof value})`, () => {
    const e = syntheticSnapshots(); e.protectedAuthority.skipMs = value;
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA:snapshots.protectedAuthority.skipMs/);
  });
}
test('governed skip accepts zero and safe maximum, never from a request override', () => {
  for (const skipMs of [0, 1, Number.MAX_SAFE_INTEGER]) {
    const e = syntheticSnapshots(); e.protectedAuthority.skipMs = skipMs;
    assert.equal(mapDeclaredVerifiedSnapshots(e).binding.skipMs, skipMs);
  }
  assert.throws(() => mapDeclaredVerifiedSnapshots(syntheticSnapshots(), {skipMs: 5}), /HOLD_CALLER_OVERRIDE/);
});

const crossed = [
  ['tenant', e => { e.receipt.tenant = id(50); }, 'HOLD_TENANT_CHAIN'],
  ['scheduler approval', e => { e.preparationRun.schedulerApprovalId = id(50); }, 'HOLD_SCHEDULER_CHAIN'],
  ['transport', e => { e.serverAdmission.transportId = id(50); }, 'HOLD_TRANSPORT_CHAIN'],
  ['policy snapshot', e => { e.preparationAdmission.schedulerSnapshot.sponsorUserId = id(50); }, 'HOLD_POLICY_SNAPSHOT_CHAIN'],
  ['transport snapshot', e => { e.serverAdmission.transportSnapshot.loginRoleOid++; }, 'HOLD_POLICY_SNAPSHOT_CHAIN'],
  ['owner', e => { e.preparationRun.producedByOwner++; }, 'HOLD_OWNER_CHAIN'],
  ['job', e => { e.preparationRun.initiatorJobId = 'SYNTHETIC_OTHER_JOB'; }, 'HOLD_JOB_CHAIN'],
  ['preparation', e => { e.preparationRun.admissionId = id(50); }, 'HOLD_PREPARATION_CHAIN'],
  ['receipt', e => { e.serverContext.identityReceiptId = id(50); }, 'HOLD_RECEIPT_CHAIN'],
  ['source run', e => { e.receipt.sourceRunId = id(50); }, 'HOLD_SOURCE_RUN_CHAIN'],
  ['manifest bytes', e => { e.receipt.manifestSha256 = 'f'.repeat(64); }, 'HOLD_MANIFEST_ARTIFACT_CHAIN'],
  ['manifest version', e => { e.receipt.manifestVersion = 'SYNTHETIC_OTHER'; }, 'HOLD_MANIFEST_ARTIFACT_CHAIN'],
  ['receipt bytes', e => { e.serverContext.identitySha256 = 'f'.repeat(64); }, 'HOLD_RECEIPT_CONTENT_CHAIN'],
  ['client bindings', e => { e.receipt.clientBindingsSha256 = 'f'.repeat(64); }, 'HOLD_RECEIPT_CONTENT_CHAIN'],
  ['context', e => { e.serverContext.contextId = id(50); }, 'HOLD_CONTEXT_CHAIN'],
  ['run', e => { e.serverContext.runId = id(50); }, 'HOLD_CONTEXT_CHAIN'],
  ['lineage', e => { e.serverContext.lineageId = id(50); }, 'HOLD_CONTEXT_CHAIN'],
  ['deployment', e => { e.protectedAuthority.deployment = 'SYNTHETIC_OTHER'; }, 'HOLD_DEPLOYMENT_CHAIN'],
];
for (const [name, mutate, code] of crossed) test(`crossed ${name} fails with its exact correspondence classification`, () => {
  const e = syntheticSnapshots(); mutate(e);
  assert.throws(() => mapDeclaredVerifiedSnapshots(e), new RegExp('^Error: ' + code + '$'));
});

test('missing occurrence or semantic identity cannot be recovered from UUID, hash, TTL or caller fields', () => {
  for (const key of ['authorizedOccurrence', 'manifestIdentity', 'skipMs', 'generation', 'restoreFence']) {
    const e = syntheticSnapshots(); delete e.protectedAuthority[key];
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA/);
  }
  for (const key of ['authorizedOccurrence', 'manifestIdentity', 'workId', 'skipMs', 'generation']) {
    const e = syntheticSnapshots(); e[key] = 'SYNTHETIC_CALLER_INVENTION';
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA/);
  }
  assert.throws(() => mapDeclaredVerifiedSnapshots(syntheticSnapshots(), {authorizedOccurrence: 'SYNTHETIC_CALLER'}), /HOLD_CALLER_OVERRIDE/);
});

test('scheduler sponsor is never promoted to the authenticated human', () => {
  const e = syntheticSnapshots();
  assert.equal(mapDeclaredVerifiedSnapshots(e).binding.serverContext.initiatorUserId, null);
  e.serverContext.initiatorUserId = e.schedulerApproval.sponsorUserId;
  assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA/);
  const human = syntheticSnapshots(); human.serverContext.initiatorKind = 'human';
  assert.throws(() => mapDeclaredVerifiedSnapshots(human), /HOLD_SCHEMA/);
});

test('declared revocation is a model rejection only, including unchanged historical binding', () => {
  for (const key of ['schedulerApproval', 'transportApproval', 'protectedAuthority']) {
    const e = syntheticSnapshots();
    const field = key === 'protectedAuthority' ? 'revokedAt' : 'disabledAt';
    e[key][field] = '2030-01-01T00:00:05.000Z';
    if (key !== 'protectedAuthority') for (const parent of [e.preparationAdmission, e.serverAdmission]) {
      parent[key === 'schedulerApproval' ? 'schedulerSnapshot' : 'transportSnapshot'][field] = e[key][field];
    }
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /^Error: HOLD_DECLARED_REVOCATION$/);
  }
});

test('restore generation and fence are independently required and never establish restore durability', () => {
  for (const mutate of [e => e.restoreState.generation++, e => { e.restoreState.fence = 'SYNTHETIC_STALE'; },
    e => { e.restoreState.deployment = 'SYNTHETIC_OTHER'; }]) {
    const e = syntheticSnapshots(); mutate(e);
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /^Error: HOLD_RESTORE_FENCE$/);
  }
  for (const generation of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const e = syntheticSnapshots(); e.protectedAuthority.generation = generation;
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /HOLD_SCHEMA/);
  }
});

test('declared validity is explicit and half-open, without trusting the local clock', () => {
  for (const observedAt of ['2029-12-31T23:59:59.999Z', '2030-01-01T00:02:00.000Z']) {
    const e = syntheticSnapshots(); e.observedAt = observedAt;
    assert.throws(() => mapDeclaredVerifiedSnapshots(e), /^Error: HOLD_DECLARED_VALIDITY$/);
  }
  const e = syntheticSnapshots(); e.observedAt = e.serverContext.notBefore;
  assert.doesNotThrow(() => mapDeclaredVerifiedSnapshots(e));
  e.serverAdmission.expiresAt = e.serverContext.expiresAt = e.serverContext.notBefore;
  assert.throws(() => mapDeclaredVerifiedSnapshots(e), /^Error: HOLD_VALIDITY_CHAIN$/);
  for (const bad of ['2030-02-30T00:00:00.000Z', '2030-01-01', '2030-01-01T01:00:00.000+01:00']) {
    const invalid = syntheticSnapshots(); invalid.observedAt = bad;
    assert.throws(() => mapDeclaredVerifiedSnapshots(invalid), /HOLD_SCHEMA/);
  }
  const excessive = syntheticSnapshots();
  excessive.serverAdmission.expiresAt = excessive.serverContext.expiresAt = '2030-01-01T00:05:00.001Z';
  assert.throws(() => mapDeclaredVerifiedSnapshots(excessive), /^Error: HOLD_VALIDITY_CHAIN$/);
});

for (const [name, change] of [
  ['context/run/lineage UUIDs', renewContext], ['manifest artifact snapshot', renewArtifact],
  ['TTL', e => { e.serverAdmission.expiresAt = e.serverContext.expiresAt = '2030-01-01T00:03:00.000Z'; }],
  ['governed skip', e => { e.protectedAuthority.skipMs = 1000; }],
  ['generation and fence', e => { e.protectedAuthority.generation = e.restoreState.generation = 2;
    e.protectedAuthority.restoreFence = e.restoreState.fence = 'SYNTHETIC_FENCE_B'; }],
]) test(`real issuer: ${name} changes binding, never the obligation`, async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots(); change(e);
  const revised = await syntheticIssuance(e);
  assert.equal(revised.envelope.obligationId, original.envelope.obligationId);
  assert.equal(revised.envelope.canonical, original.envelope.canonical);
  assert.notDeepEqual(revised.row.binding, original.row.binding);
});
