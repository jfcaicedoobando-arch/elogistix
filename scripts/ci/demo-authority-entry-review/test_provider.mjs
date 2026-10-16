import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthorityProvider, READ_AUTHORITY_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/authority-provider.mjs';
import {createIssuerEntry} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer-entry.mjs';
import {ISSUE_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {config, request, syntheticSnapshots, id, syntheticWire} from './fixtures.mjs';

const run = async options => {
  const wire = syntheticWire(options);
  const result = await createIssuerEntry({config, openWire: async () => wire}).issue(request());
  return {wire, result};
};

test('provider uses only the fixed context reference query and same active transaction', async () => {
  const calls = [];
  const provider = createAuthorityProvider({query: async (...args) => {
    calls.push(args); return {rowCount: 1, rows: [{authority: syntheticSnapshots()}]};
  }}, config.deployment);
  const mapped = await provider(id(8));
  assert.deepEqual(calls, [[READ_AUTHORITY_SQL, [id(8)], 'T', 'T', 'SELECT']]);
  assert.equal(mapped.contextId, id(8));
  assert.equal(mapped.authorizedOccurrence, syntheticSnapshots().protectedAuthority.authorizedOccurrence);
  assert.equal(Object.isFrozen(mapped.binding), true);
});

test('unbound provider and non-reference calls fail without SQL', async () => {
  assert.throws(() => createAuthorityProvider(), /HOLD_AUTHORITY_PROVIDER_UNBOUND/);
  let calls = 0;
  const provider = createAuthorityProvider({query: () => { calls++; }}, config.deployment);
  for (const bad of [undefined, null, {}, {contextId: id(8)}, 'not-uuid', 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA', []]) {
    await assert.rejects(provider(bad), /HOLD_AUTHORITY_REFERENCE/);
  }
  await assert.rejects(provider(id(8), {skipMs: 1}), /HOLD_AUTHORITY_REFERENCE/);
  assert.equal(calls, 0);
});

test('missing, duplicate and malformed SQL reader rows never reach issuance', async () => {
  for (const mutate of [
    r => { r.rows = []; r.rowCount = 0; },
    r => { r.rows.push(r.rows[0]); r.rowCount = 2; },
    r => { r.rowCount = 0; }, r => { r.rows = [null]; },
    r => { r.rows[0].injected = true; }, r => { r.rows[0].authority = null; },
    r => { Object.defineProperty(r.rows[0], 'authority', {get() { throw Error('GETTER'); }}); },
  ]) {
    const {wire, result} = await run({mutateResult: (sql, r) => { if (sql === READ_AUTHORITY_SQL) mutate(r); }});
    assert.equal(result.outcome, 'quarantine');
    assert.equal(wire.calls.some(c => c.sql === ISSUE_SQL), false);
    assert.equal(wire.closed, true);
  }
});

test('scope, restore fence, stale policy and chain mismatches fail closed before INSERT', async () => {
  for (const mutate of [
    s => { s.deployment = s.protectedAuthority.deployment = s.restoreState.deployment = 'OTHER_DEPLOYMENT'; },
    s => { s.serverContext.contextId = s.serverAdmission.contextId = id(88); },
    s => { s.restoreState.generation++; }, s => { s.restoreState.fence = 'RESTORED_FENCE'; },
    s => { s.protectedAuthority.revokedAt = s.observedAt; },
    s => { s.schedulerApproval.disabledAt = s.observedAt; },
    s => { s.transportApproval.disabledAt = s.observedAt; },
    s => { s.preparationRun.receiptId = id(77); },
    s => { s.observedAt = s.serverContext.expiresAt; },
    s => { s.serverContext.initiatorUserId = id(4); },
    s => { s.protectedAuthority.skipMs = -1; },
    s => { s.callerVerified = true; },
  ]) {
    const snapshots = syntheticSnapshots(); mutate(snapshots);
    const {wire, result} = await run({snapshots});
    assert.equal(result.outcome, 'quarantine');
    assert.equal(wire.calls.some(c => c.sql === ISSUE_SQL), false);
  }
});

test('sub-millisecond evidence is rejected, never rounded through JavaScript Dates', async () => {
  for (const path of [
    ['observedAt'], ['schedulerApproval', 'validUntil'], ['transportApproval', 'validUntil'],
    ['preparationAdmission', 'validUntil'], ['serverAdmission', 'issuedAt'],
    ['serverAdmission', 'notBefore'], ['serverAdmission', 'expiresAt'],
    ['serverContext', 'notBefore'], ['serverContext', 'expiresAt'],
    ['protectedAuthority', 'notBefore'], ['protectedAuthority', 'expiresAt'],
  ]) {
    const snapshots = syntheticSnapshots();
    let owner = snapshots; for (const part of path.slice(0, -1)) owner = owner[part];
    const key = path.at(-1); owner[key] = owner[key].replace('.000Z', '.000001Z');
    const {wire, result} = await run({snapshots});
    assert.equal(result.outcome, 'quarantine', path.join('.'));
    assert.equal(wire.calls.some(c => c.sql === ISSUE_SQL), false);
  }
});

test('a coherent invented snapshot is still only a synthetic test input, not authentication', async () => {
  const {result} = await run({snapshots: syntheticSnapshots()});
  assert.equal(result.outcome, 'issuance_commit_acknowledged');
  assert.equal(result.executionPermission, false);
  assert.equal(result.admission, 'NOT_ADMITTED');
  // This counterexample documents the trust boundary: a malicious wire factory
  // can invent all evidence. Offline doubles cannot certify SQL18's provenance.
});
