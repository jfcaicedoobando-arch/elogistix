/** SYNTHETIC immutable-history observations, never INSERT or claim/execute permission. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyDeclaredIssuance, mapDeclaredVerifiedSnapshots, validateBinding} from './contract.mjs';
import {syntheticSnapshots, syntheticIssuance, renewArtifact, renewContext, id} from './synthetic-fixtures.mjs';

const expected = (classification, conflicts = []) => ({classification, conflicts, executionPermission: false});
const conflict = (...codes) => expected('CONFLICT', codes.sort());

test('no observed conflict and an identical record are distinct, neither permits execution', async () => {
  const {row} = await syntheticIssuance();
  assert.deepEqual(classifyDeclaredIssuance(row, []), expected('NO_CONFLICT_IN_DECLARED_SNAPSHOT'));
  assert.deepEqual(classifyDeclaredIssuance(row, [structuredClone(row)]), expected('IDENTICAL_RECORD_ONLY'));
});

for (const [name, modify] of [
  ['skip policy', e => { e.protectedAuthority.skipMs = 1; }],
  ['semantic-family artifact revision', renewArtifact],
  ['context TTL', e => { e.serverAdmission.expiresAt = e.serverContext.expiresAt = '2030-01-01T00:03:00.000Z'; }],
  ['restore generation and fence', e => { e.protectedAuthority.generation = e.restoreState.generation = 2;
    e.protectedAuthority.restoreFence = e.restoreState.fence = 'SYNTHETIC_RESTORE_FENCE_B'; }],
  ['receipt and preparation', e => { e.preparationRun.id = e.receipt.sourceRunId = id(60);
    e.preparationRun.receiptId = e.receipt.id = e.serverAdmission.identityReceiptId
      = e.serverContext.identityReceiptId = e.protectedAuthority.receiptId = id(70); }],
]) test(`same obligation with changed ${name} is an exact binding conflict, never reissuance`, async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots(); modify(e);
  const revised = await syntheticIssuance(e);
  assert.equal(original.row.obligationId, revised.row.obligationId);
  assert.deepEqual(classifyDeclaredIssuance(revised.row, [original.row]), conflict('NATURAL_KEY_BINDING_CONFLICT'));
});

test('same natural obligation with a renewed context reports both context and binding conflicts', async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots(); renewContext(e);
  const renewed = await syntheticIssuance(e);
  assert.deepEqual(classifyDeclaredIssuance(renewed.row, [original.row]),
    conflict('NATURAL_KEY_BINDING_CONFLICT', 'NATURAL_KEY_CONTEXT_CONFLICT'));
});

test('separately declared occurrence has a new real issuer key, but cannot reuse the old context', async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots();
  e.protectedAuthority.authorizedOccurrence = 'SYNTHETIC_SEPARATELY_APPROVED_OCCURRENCE_B';
  const next = await syntheticIssuance(e);
  assert.notEqual(next.row.obligationId, original.row.obligationId);
  assert.deepEqual(classifyDeclaredIssuance(next.row, [original.row]), conflict('CONTEXT_REUSE_CONFLICT'));
  renewContext(e);
  assert.deepEqual(classifyDeclaredIssuance((await syntheticIssuance(e)).row, [original.row]), expected('NO_CONFLICT_IN_DECLARED_SNAPSHOT'));
});

test('natural-key ID mismatch is not repaired by trusting the digest-shaped UUID', async () => {
  const {row} = await syntheticIssuance(), forged = structuredClone(row);
  forged.obligationId = id(999);
  assert.deepEqual(classifyDeclaredIssuance(forged, [row]), conflict('NATURAL_KEY_ID_MISMATCH'));
});

test('digest-shaped ID collision is classified separately from natural-key identity', async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots();
  e.protectedAuthority.authorizedOccurrence = 'SYNTHETIC_OTHER_OCCURRENCE'; renewContext(e);
  const next = await syntheticIssuance(e);
  next.row.obligationId = original.row.obligationId; // Deliberate impossible-to-trust history, not a parallel hash.
  assert.deepEqual(classifyDeclaredIssuance(next.row, [original.row]), conflict('OBLIGATION_ID_COLLISION'));
});

test('simultaneous natural and context conflicts preserve every cause independent of history order', async () => {
  const original = await syntheticIssuance(), other = syntheticSnapshots();
  other.protectedAuthority.authorizedOccurrence = 'SYNTHETIC_OTHER_OCCURRENCE'; renewContext(other);
  const existingOther = await syntheticIssuance(other), proposal = syntheticSnapshots(); renewContext(proposal);
  const proposed = await syntheticIssuance(proposal);
  const answer = conflict('CONTEXT_REUSE_CONFLICT', 'NATURAL_KEY_BINDING_CONFLICT', 'NATURAL_KEY_CONTEXT_CONFLICT');
  assert.deepEqual(classifyDeclaredIssuance(proposed.row, [original.row, existingOther.row]), answer);
  assert.deepEqual(classifyDeclaredIssuance(proposed.row, [existingOther.row, original.row]), answer);
});

test('history uniqueness violations are held instead of choosing an arbitrary previous row', async () => {
  const {row} = await syntheticIssuance();
  assert.throws(() => classifyDeclaredIssuance(row, [row, structuredClone(row)]), /^Error: HOLD_HISTORY_AMBIGUOUS$/);
  const e = syntheticSnapshots(); e.protectedAuthority.skipMs = 100;
  const changed = await syntheticIssuance(e);
  assert.throws(() => classifyDeclaredIssuance(row, [row, changed.row]), /^Error: HOLD_HISTORY_AMBIGUOUS$/);
});

test('deployment is a partition, not a free caller override', async () => {
  const original = await syntheticIssuance(), e = syntheticSnapshots();
  e.deployment = e.restoreState.deployment = e.protectedAuthority.deployment = 'SYNTHETIC_OTHER_DEPLOYMENT';
  const other = await syntheticIssuance(e);
  assert.notEqual(original.row.obligationId, other.row.obligationId);
  assert.deepEqual(classifyDeclaredIssuance(other.row, [original.row]), expected('NO_CONFLICT_IN_DECLARED_SNAPSHOT'));
});

test('ledger row is strict and cannot disagree with its full binding', async () => {
  const {row} = await syntheticIssuance();
  for (const key of Object.keys(row)) {
    const changed = structuredClone(row); delete changed[key];
    assert.throws(() => classifyDeclaredIssuance(changed, []), /HOLD_SCHEMA/);
  }
  for (const [key, value] of [['tenant', id(99)], ['contextId', id(99)], ['authorizedOccurrence', 'SYNTHETIC_FORGED'],
    ['deployment', 'SYNTHETIC_FORGED'], ['manifestIdentity', 'SYNTHETIC_FORGED'], ['schedulerJob', 'SYNTHETIC_FORGED']]) {
    const changed = structuredClone(row); changed[key] = value;
    assert.throws(() => classifyDeclaredIssuance(changed, []), new RegExp('^Error: HOLD_ISSUANCE_BINDING:' + key + '$'));
  }
  assert.throws(() => classifyDeclaredIssuance({...row, retry: true}, []), /HOLD_SCHEMA/);
  assert.throws(() => classifyDeclaredIssuance(row, null), /HOLD_HISTORY_SCHEMA/);
});

test('historical binding validity is not live authorization after model revocation', async () => {
  const original = await syntheticIssuance(), current = syntheticSnapshots();
  current.protectedAuthority.revokedAt = '2030-01-01T00:00:05.000Z';
  assert.doesNotThrow(() => validateBinding(original.row.binding));
  assert.deepEqual(classifyDeclaredIssuance(original.row, [original.row]), expected('IDENTICAL_RECORD_ONLY'));
  assert.throws(() => mapDeclaredVerifiedSnapshots(current), /^Error: HOLD_DECLARED_REVOCATION$/);
});

test('observation time is not binding identity, TTL renewal still is', async () => {
  const original = await syntheticIssuance(), next = syntheticSnapshots();
  next.observedAt = '2030-01-01T00:01:00.000Z';
  assert.deepEqual(classifyDeclaredIssuance((await syntheticIssuance(next)).row, [original.row]), expected('IDENTICAL_RECORD_ONLY'));
});
