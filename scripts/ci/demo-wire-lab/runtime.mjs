/** Disposable Actions-only physical wire experiment. Every issuer/guard/business fact is SYNTHETIC. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createLabWire, LAB_CONFIG } from './lab_wire.mjs';
import { createOwner } from './source/owner.mjs';
import { createIssuer, ISSUE_SQL } from './source/issuer.mjs';
import { SQL } from './source/store.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Actions laboratory gate');
const cases = [], timeline = [], identities = [];
const trace = event => timeline.push(event);
const hash = value => createHash('sha256').update(value).digest('hex');
let opened = 0, fixture = 0, currentCase = 'open_synthetic_observer';
const wires = new Set();
async function open(label, fault) {
  const wire = await createLabWire({ config: LAB_CONFIG, label, trace, fault });
  opened++;
  identities.push({ label, ...wire.metadata() });
  wires.add(wire);
  return wire;
}
async function check(name, action) {
  currentCase = name;
  const evidence = await action();
  cases.push({ case: name, status: 'PASS', ...(evidence ? { evidence } : {}) });
}
let observer;
const q = (text, params = []) => observer.query(text, params);
async function counts(contextId) {
  const r = await q(`SELECT
    (SELECT count(*)::int FROM demo_owner_review.claims WHERE context_id=$1::uuid AND stage='ingress') AS claims,
    (SELECT count(*)::int FROM demo_wire_synthetic.business_events WHERE context_id=$1::uuid) AS effects`, [contextId]);
  return r.rows[0];
}
async function seed({ dispatch = true, fail = false } = {}) {
  fixture++;
  const contextId = `10000000-0000-0000-0000-${String(fixture).padStart(12, '0')}`;
  const issuer = createIssuer(async () => ({ tenant: 'SYNTHETIC_TENANT', manifestIdentity: 'SYNTHETIC_FAMILY',
    schedulerJob: 'SYNTHETIC_JOB', authorizedOccurrence: `SYNTHETIC_OCCURRENCE_${fixture}`,
    contextId, binding: { skipMs: fail ? 999 : 0, scope: 'SYNTHETIC' } }), LAB_CONFIG.deployment);
  const issuance = await issuer.derive('SYNTHETIC_TICKET');
  const r = await q(ISSUE_SQL, issuance.parameters);
  assert.equal(r.rowCount, 1);
  if (dispatch) {
    const d = await q(SQL.dispatch, [LAB_CONFIG.deployment, contextId]);
    assert.equal(d.rowCount, 1);
  }
  return contextId;
}
function owner(label, { fault, guard } = {}) {
  let wire;
  return createOwner({ config: LAB_CONFIG, authenticate: async () => true,
    openWire: async () => (wire = await open(label, fault)),
    businessGuard: async claim => {
      // Independent backend observes the committed claim before any business BEGIN.
      assert.deepEqual(await counts(claim.context_id), { claims: 1, effects: 0 });
      if (guard) await guard(wire);
      return true;
    } });
}
function labelEvents(label) { return timeline.filter(event => event.label === label); }
function writes(label) { return labelEvents(label).filter(event => event.event === 'socket-write').length; }
function commitBoundary(label, ordinal) {
  const events = labelEvents(label);
  const commit = events.find(event => event.event === 'protocol-command' && event.command === 'COMMIT' && event.queryOrdinal === ordinal);
  assert.ok(commit, 'actual COMMIT CommandComplete observed');
  assert.equal(events.some(event => event.n > commit.n && event.event === 'protocol-ready' && event.queryOrdinal === ordinal), false);
  assert.equal(events.some(event => event.n > commit.n && event.event === 'socket-write'), false);
  assert.equal(events.filter(event => event.event === 'socket-connect-attempt').length, 1);
}

try {
  assert.equal(process.version, 'v26.13.0');
  assert.equal(process.platform, 'linux');
  assert.equal(process.arch, 'x64');
  observer = await open('synthetic-observer');
  await check('empty_config_zero_transport', async () => {
    const before = opened;
    const result = await createOwner({ openWire: async () => open('must-never-open'),
      authenticate: async () => true, businessGuard: async () => true }).execute({ contextId: '10000000-0000-0000-0000-000000000000' });
    assert.equal(result.outcome, 'quarantine'); assert.equal(opened, before);
    return { transportsOpened: 0 };
  });
  let happy;
  await check('claim_commit_then_business_same_socket', async () => {
    happy = await seed();
    const result = await owner('happy').execute({ contextId: happy });
    assert.equal(result.outcome, 'business_commit_acknowledged');
    assert.deepEqual(await counts(happy), { claims: 1, effects: 1 });
    const epochs = new Set(labelEvents('happy').map(event => event.epoch).filter(Boolean));
    assert.equal(epochs.size, 1);
    assert.deepEqual(labelEvents('happy').filter(event => event.event === 'protocol-command' && event.queryOrdinal > 0).map(event => event.command),
      ['BEGIN', 'SET', 'INSERT', 'COMMIT', 'BEGIN', 'SELECT', 'COMMIT']);
    assert.deepEqual(labelEvents('happy').filter(event => event.event === 'protocol-ready' && event.queryOrdinal > 0).map(event => event.status),
      ['T', 'T', 'T', 'I', 'T', 'T', 'I']);
    assert.equal(labelEvents('happy').filter(event => event.event === 'socket-connect-attempt').length, 1);
    assert.notEqual(identities.find(item => item.label === 'happy').backendPid, identities[0].backendPid);
    return { claimObservedByIndependentBackendBeforeBusiness: true, socketEpochs: epochs.size,
      outcome: result.outcome, ...await counts(happy) };
  });
  await check('duplicate_sealed', async () => {
    assert.equal((await owner('duplicate').execute({ contextId: happy })).outcome, 'sealed');
    assert.deepEqual(await counts(happy), { claims: 1, effects: 1 });
    return { ...await counts(happy), additionalEffects: 0 };
  });
  await check('missing_dispatch_sealed', async () => {
    const id = await seed({ dispatch: false });
    assert.equal((await owner('no-dispatch').execute({ contextId: id })).outcome, 'sealed');
    assert.deepEqual(await counts(id), { claims: 0, effects: 0 });
    return await counts(id);
  });
  await check('business_sql_error_claim_retained', async () => {
    const id = await seed({ fail: true });
    assert.equal((await owner('business-error').execute({ contextId: id })).outcome, 'quarantine');
    assert.ok(labelEvents('business-error').some(event => event.event === 'protocol-error' && event.sqlstate === 'P0001'));
    assert.deepEqual(await counts(id), { claims: 1, effects: 0 });
    assert.equal((await owner('business-error-duplicate').execute({ contextId: id })).outcome, 'sealed');
    assert.deepEqual(await counts(id), { claims: 1, effects: 0 });
    return { ...await counts(id), duplicate: 'sealed', rollback: 'observed after transport close' };
  });
  await check('claim_commit_ack_uncertain', async () => {
    const id = await seed();
    assert.equal((await owner('claim-ack-loss', { fault: { closeAfterCommitCommand: 1 } }).execute({ contextId: id })).outcome, 'quarantine');
    assert.deepEqual(await counts(id), { claims: 1, effects: 0 });
    commitBoundary('claim-ack-loss', 4);
    assert.equal((await owner('claim-ack-duplicate').execute({ contextId: id })).outcome, 'sealed');
    return { ...await counts(id), injection: 'close at first COMMIT CommandComplete before accepting ReadyForQuery', duplicate: 'sealed' };
  });
  await check('business_commit_ack_uncertain', async () => {
    const id = await seed();
    assert.equal((await owner('business-ack-loss', { fault: { closeAfterCommitCommand: 2 } }).execute({ contextId: id })).outcome, 'quarantine');
    assert.deepEqual(await counts(id), { claims: 1, effects: 1 });
    commitBoundary('business-ack-loss', 7);
    assert.equal((await owner('business-ack-duplicate').execute({ contextId: id })).outcome, 'sealed');
    assert.deepEqual(await counts(id), { claims: 1, effects: 1 });
    return { ...await counts(id), injection: 'close at second COMMIT CommandComplete before accepting ReadyForQuery', duplicate: 'sealed', additionalEffects: 0 };
  });
  await check('close_after_claim_no_business', async () => {
    const id = await seed(); let before;
    assert.equal((await owner('closed-after-claim', { guard: async wire => { await wire.close(); before = writes('closed-after-claim'); } }).execute({ contextId: id })).outcome, 'quarantine');
    assert.equal(writes('closed-after-claim'), before);
    assert.deepEqual(await counts(id), { claims: 1, effects: 0 });
    return { ...await counts(id), socketWritesAfterClose: 0 };
  });
  await check('sql_error_terminal_no_replay', async () => {
    const wire = await open('sql-error-terminal');
    await wire.query('BEGIN');
    await assert.rejects(wire.query('SELECT 1/0'));
    assert.ok(labelEvents('sql-error-terminal').some(event => event.event === 'protocol-error' && event.sqlstate === '22012'));
    const before = writes('sql-error-terminal');
    await assert.rejects(wire.query('SELECT 1'));
    assert.equal(writes('sql-error-terminal'), before);
    await wire.close();
    return { subsequentSocketWrites: 0, retry: 'rejected before write' };
  });
  currentCase = 'all_owned_transport_cleanup';
  await observer.close();
  const closed = await Promise.allSettled([...wires].map(wire => wire.close()));
  assert.ok(closed.every(result => result.status === 'fulfilled'), 'all owned transports must confirm close before PASS');
  assert.ok(identities.every(identity => labelEvents(identity.label).some(event => event.event === 'close-confirmed')));
  process.stdout.write(`${JSON.stringify({ status: 'PASS_SYNTHETIC_ONLY', scope: 'SYNTHETIC', cases, timeline,
    physicalWire: { driver: 'node-postgres', version: '8.23.1', nodeVersion: process.version, transport: 'exclusive Unix net.Socket per Client; no Pool',
      identities, allOwnedTransportsCloseConfirmed: true, noReconnect: true, noReplay: true, businessSqlSha256: hash(SQL.business),
      readyForQuery: 'observed protocol messages; see timeline', commandComplete: 'observed protocol messages; see timeline' },
    operationalWire: 'UNBOUND', limitations: ['Synthetic issuer, authentication, guard and business fixture only',
      'No pooler, failover, TLS, credentials, production identity or engine certification',
      'Deterministic COMMIT acknowledgment injection; not arbitrary network-loss coverage',
      'fsync off on disposable tmpfs; crash recovery and durable storage NOT_RUN'] })}\n`);
} catch (cause) {
  const safeCode = typeof cause?.code === 'string' && /^(?:HOLD_LAB_[A-Z_]+|ERR_ASSERTION)$/.test(cause.code)
    ? cause.code : 'UNCLASSIFIED_FAILURE';
  process.stdout.write(`${JSON.stringify({ status: 'FAIL_SYNTHETIC_ONLY', scope: 'SYNTHETIC', cases, timeline,
    physicalWire: { driver: 'node-postgres', version: '8.23.1', identities }, operationalWire: 'UNBOUND',
    failure: { case: currentCase, code: safeCode } })}\n`);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...wires].map(wire => wire.close()));
}
