/**
 * OFFLINE / SYNTHETIC ONLY. The SUT is the published createIssuer, unchanged.
 * The resolver below is a trusted test stub, not authentication or SQL evidence.
 * It supplies the authoritative occurrence and semantic manifest identity. The
 * production resolver linking immutable producer/registry SQL evidence is absent;
 * these comparisons cannot establish that link, identity, permission or transport.
 * No parallel digest/obligation algorithm, network, database or credentials.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createIssuer} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';

const DEPLOYMENT = 'SYNTHETIC_DEPLOYMENT_ALPHA';
const CONTEXT_A = '00000000-0000-4000-8000-000000000001';
const CONTEXT_B = '00000000-0000-4000-8000-000000000002';
const TICKET_A = 'SYNTHETIC_OPAQUE_TICKET_ALPHA';
const TICKET_B = 'SYNTHETIC_OPAQUE_TICKET_BETA';
const UUID_SHAPE = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function evidence(overrides = {}) {
  return {
    tenant: 'SYNTHETIC_TENANT_ALPHA',
    manifestIdentity: 'SYNTHETIC_SEMANTIC_MANIFEST_ALPHA',
    schedulerJob: 'SYNTHETIC_JOB_ALPHA',
    authorizedOccurrence: 'SYNTHETIC_OWNER_APPROVED_OCCURRENCE_ALPHA',
    contextId: CONTEXT_A,
    binding: {scope: 'SYNTHETIC', receipt: 'SYNTHETIC_RECEIPT_ALPHA', skipMs: 0},
    ttlSeconds: 120,
    schedulerSnapshot: {scope: 'SYNTHETIC', revision: 1},
    transportSnapshot: {scope: 'SYNTHETIC', revision: 1},
    ...overrides,
  };
}

function resolved(authoritative, ticket = TICKET_A, deployment = DEPLOYMENT) {
  const calls = [];
  const issuer = createIssuer(async (receivedTicket) => {
    calls.push(receivedTicket);
    assert.strictEqual(receivedTicket, ticket, 'SYNTHETIC resolver receives the exact supplied ticket');
    return authoritative;
  }, deployment);
  return {issuer, calls};
}

function assertEnvelope(actual, authoritative, deployment = DEPLOYMENT) {
  // Verify the public parameter contract without recalculating its digest/key.
  assert.match(actual.obligationId, UUID_SHAPE);
  assert.deepEqual(JSON.parse(actual.canonical), [
    1, deployment, authoritative.tenant, authoritative.manifestIdentity,
    authoritative.schedulerJob, authoritative.authorizedOccurrence,
  ]);
  assert.deepEqual(actual.parameters, [
    deployment, actual.obligationId, authoritative.tenant, authoritative.manifestIdentity,
    authoritative.schedulerJob, authoritative.authorizedOccurrence,
    authoritative.contextId, JSON.stringify(authoritative.binding),
  ]);
}

async function derive(authoritative, ticket = TICKET_A, deployment = DEPLOYMENT) {
  const h = resolved(authoritative, ticket, deployment);
  const actual = await h.issuer.derive(ticket);
  assert.deepEqual(h.calls, [ticket], 'one resolver call per derivation');
  assertEnvelope(actual, authoritative, deployment);
  return actual;
}

test('canonical envelope: real issuer emits ordered SQL parameters from SYNTHETIC resolver evidence', async () => {
  await derive(evidence());
});

const renewals = [
  ['context UUID', {contextId: CONTEXT_B}, TICKET_A],
  ['TTL', {ttlSeconds: 600}, TICKET_A],
  ['scheduler and transport snapshots', {
    schedulerSnapshot: {scope: 'SYNTHETIC', revision: 2},
    transportSnapshot: {scope: 'SYNTHETIC', revision: 2},
  }, TICKET_A],
  ['binding and receipt snapshot', {
    binding: {scope: 'SYNTHETIC', receipt: 'SYNTHETIC_RECEIPT_BETA', skipMs: 90, snapshot: 2},
  }, TICKET_A],
  ['opaque ticket', {}, TICKET_B],
  ['context TTL snapshots binding and ticket together', {
    contextId: CONTEXT_B, ttlSeconds: 600,
    schedulerSnapshot: {scope: 'SYNTHETIC', revision: 2},
    transportSnapshot: {scope: 'SYNTHETIC', revision: 2},
    binding: {scope: 'SYNTHETIC', receipt: 'SYNTHETIC_RECEIPT_BETA', skipMs: 90},
  }, TICKET_B],
];
for (const [label, overrides, ticket] of renewals) {
  test(`stable obligation: renewed ${label} retains the same authoritative occurrence`, async () => {
    const before = await derive(evidence());
    const after = await derive(evidence(overrides), ticket);
    assert.equal(after.obligationId, before.obligationId);
    assert.equal(after.canonical, before.canonical);
  });
}

for (const [field, changed] of [
  ['tenant', 'SYNTHETIC_TENANT_BETA'],
  ['manifestIdentity', 'SYNTHETIC_SEMANTIC_MANIFEST_BETA'],
  ['schedulerJob', 'SYNTHETIC_JOB_BETA'],
  ['authorizedOccurrence', 'SYNTHETIC_SEPARATELY_OWNER_APPROVED_OCCURRENCE_BETA'],
]) {
  test(`different obligation: authoritative ${field} changes the key`, async () => {
    const before = await derive(evidence());
    const after = await derive(evidence({[field]: changed}));
    assert.notEqual(after.obligationId, before.obligationId);
    assert.notEqual(after.canonical, before.canonical);
  });
}

test('different obligation: deployment changes the key', async () => {
  const before = await derive(evidence());
  const after = await derive(evidence(), TICKET_A, 'SYNTHETIC_DEPLOYMENT_BETA');
  assert.notEqual(after.obligationId, before.obligationId);
  assert.notEqual(after.canonical, before.canonical);
});

for (const field of ['tenant', 'manifestIdentity', 'schedulerJob', 'authorizedOccurrence', 'contextId', 'binding']) {
  test(`missing authoritative ${field} fails closed`, async () => {
    const incomplete = evidence();
    delete incomplete[field];
    const h = resolved(incomplete);
    await assert.rejects(h.issuer.derive(TICKET_A), /^Error: HOLD_ISSUER_EVIDENCE$/);
    assert.deepEqual(h.calls, [TICKET_A]);
  });
}

test('malformed authoritative evidence fails closed without deriving an envelope', async () => {
  const malformed = [undefined, null];
  for (const field of ['tenant', 'manifestIdentity', 'schedulerJob', 'authorizedOccurrence']) {
    for (const value of ['', null, 42, {}]) malformed.push(evidence({[field]: value}));
  }
  malformed.push(evidence({contextId: 'SYNTHETIC_NOT_A_UUID'}));
  for (const binding of [undefined, null, [], 'SYNTHETIC_NOT_AN_OBJECT']) malformed.push(evidence({binding}));
  for (const authoritative of malformed) {
    const h = resolved(authoritative);
    await assert.rejects(h.issuer.derive(TICKET_A), /^Error: HOLD_ISSUER_EVIDENCE$/);
    assert.deepEqual(h.calls, [TICKET_A]);
  }
});

test('caller UUID TTL and occurrence fields do not replace trusted resolver evidence', async () => {
  const authoritative = evidence();
  const baseline = await derive(authoritative);
  const callerTickets = [
    {scope: 'SYNTHETIC_CALLER', contextId: CONTEXT_B},
    {scope: 'SYNTHETIC_CALLER', ttlSeconds: 600},
    {scope: 'SYNTHETIC_CALLER', contextId: CONTEXT_B, ttlSeconds: 600,
      authorizedOccurrence: 'SYNTHETIC_CALLER_INVENTED_OCCURRENCE', workId: CONTEXT_B,
      tenant: 'SYNTHETIC_CALLER_TENANT', manifestIdentity: 'SYNTHETIC_CALLER_MANIFEST',
      schedulerJob: 'SYNTHETIC_CALLER_JOB', binding: {scope: 'SYNTHETIC_CALLER_OVERRIDE'}},
  ];
  for (const ticket of callerTickets) {
    // Deliberately trusted STUB ignores caller-derived fields. createIssuer passes
    // tickets to the resolver; it does not authenticate or validate ticket shape.
    const actual = await derive(authoritative, ticket);
    assert.equal(actual.obligationId, baseline.obligationId);
    assert.deepEqual(actual.parameters, baseline.parameters);
  }
});

test('caller evidence cannot fill an occurrence missing from the authoritative resolver', async () => {
  const authoritative = evidence();
  delete authoritative.authorizedOccurrence;
  const callerTicket = {scope: 'SYNTHETIC_CALLER', ...evidence(), contextId: CONTEXT_B, ttlSeconds: 600};
  const h = resolved(authoritative, callerTicket);
  await assert.rejects(h.issuer.derive(callerTicket), /^Error: HOLD_ISSUER_EVIDENCE$/);
  assert.deepEqual(h.calls, [callerTicket]);
});

test('unbound resolver or empty deployment remains HOLD despite a complete caller envelope', async () => {
  const callerTicket = {scope: 'SYNTHETIC_CALLER', ...evidence()};
  await assert.rejects(createIssuer().derive(callerTicket), /^Error: HOLD_ISSUER_UNBOUND$/);
  await assert.rejects(createIssuer(undefined, DEPLOYMENT).derive(callerTicket), /^Error: HOLD_ISSUER_UNBOUND$/);
  const h = resolved(evidence(), callerTicket, '');
  await assert.rejects(h.issuer.derive(callerTicket), /^Error: HOLD_ISSUER_UNBOUND$/);
  assert.deepEqual(h.calls, [], 'unbound configuration must not resolve any ticket');
});
