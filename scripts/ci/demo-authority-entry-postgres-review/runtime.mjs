/** Authentic entry/provider/issuer and SQL17/18 in a disposable synthetic catalog only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createLabWire, LAB_CONFIG} from './lab_wire.mjs';
import {createIssuerEntry, READ_ISSUANCE_SQL, AUTHORITY_ISOLATION_SQL} from './repo/docs/review/demo-durable-owner-adapter-20261015/issuer-entry.mjs';
import {createAuthorityProvider, READ_AUTHORITY_SQL} from './repo/docs/review/demo-durable-owner-adapter-20261015/authority-provider.mjs';
import {createIssuer, ISSUE_SQL} from './repo/docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {dedicatedDriver} from './repo/docs/review/demo-durable-owner-adapter-20261015/driver.mjs';
import {SQL} from './repo/docs/review/demo-durable-owner-adapter-20261015/store.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.version, 'v24.19.0');
assert.equal(process.platform, 'linux');
assert.equal(process.arch, 'x64');
const cases = [], timeline = [], identities = [], wires = new Set();
const hash = text => createHash('sha256').update(text).digest('hex');
const trace = event => timeline.push(event);
const events = label => timeline.filter(e => e.label === label);
const writes = label => events(label).filter(e => e.event === 'socket-write').length;
let currentCase = 'open_observer', observer, opened = 0;
async function open(label, fault) {
  const wire = await createLabWire({config: LAB_CONFIG, label, trace, fault});
  opened++; wires.add(wire); identities.push({label, ...wire.metadata()}); return wire;
}
async function check(name, action) {
  currentCase = name;
  cases.push({case: name, status: 'PASS', evidence: await action()});
}
const q = (text, parameters = []) => observer.query(text, parameters);
async function seed(label, ttl = 60000) {
  return (await q('SELECT * FROM authority_entry_fixture.new_context($1,$2)', [label, ttl])).rows[0];
}
async function counts(contextId) {
  return (await q(`SELECT
   (SELECT count(*)::int FROM demo_owner_review.issuer_obligations WHERE context_id=$1::uuid) AS issuance,
   (SELECT count(*)::int FROM demo_owner_review.claims WHERE context_id=$1::uuid) AS claims,
   (SELECT count(*)::int FROM authority_entry_fixture.insert_observations WHERE context_id=$1::uuid) AS observations`, [contextId])).rows[0];
}
function entry(label, {fault, afterQuery} = {}) {
  let opens = 0, wire;
  const api = createIssuerEntry({config: LAB_CONFIG, openWire: async () => {
    opens++; wire = await open(label, fault);
    if (!afterQuery) return wire;
    // Observation only: original SQL/parameters/results are passed through unchanged.
    return Object.freeze({metadata: () => wire.metadata(), close: () => wire.close(),
      async query(text, parameters) {
        const result = await wire.query(text, parameters);
        await afterQuery(text, result, wire);
        return result;
      }});
  }});
  return {api, get opens() { return opens; }, get wire() { return wire; }};
}
function outcome(result, expected) {
  assert.deepEqual(result, {outcome: expected, executionPermission: false, admission: 'NOT_ADMITTED'});
}
async function terminal(instance, contextId, label) {
  const before = writes(label), opens = instance.opens;
  outcome(await instance.api.issue({contextId}), 'quarantine');
  outcome(await instance.api.issue({contextId: '99999999-0000-4000-8000-000000000001'}), 'quarantine');
  assert.equal(instance.opens, opens); assert.equal(opens, 1); assert.equal(writes(label), before);
  assert.ok(events(label).some(e => e.event === 'close-confirmed'));
  return {opens, subsequentSocketWrites: 0, subsequentRequests: 'terminal_quarantine'};
}
function sequence(label, sqls, statuses) {
  const e = events(label);
  assert.deepEqual(e.filter(e => e.event === 'query-admitted' && !e.internal).map(e => e.queryHash), sqls.map(hash));
  assert.deepEqual(e.filter(e => e.event === 'protocol-ready' && e.queryOrdinal > 0).map(e => e.status), statuses);
  assert.equal(new Set(e.map(e => e.epoch)).size, 1);
  assert.equal(e.filter(e => e.event === 'socket-connect-attempt').length, 1);
  assert.ok(e.some(e => e.event === 'close-confirmed'));
}
async function derive(contextId, label) {
  const wire = await open(label), driver = dedicatedDriver(wire, LAB_CONFIG);
  try {
    await driver.query(SQL.begin, [], 'I', 'T', 'BEGIN');
    await driver.query(AUTHORITY_ISOLATION_SQL, [], 'T', 'T', 'SET');
    return await createIssuer(createAuthorityProvider(driver, LAB_CONFIG.deployment), LAB_CONFIG.deployment).derive(contextId);
  } finally { await driver.close(); }
}
async function waitFor(predicate) {
  const deadline = Date.now() + 10000;
  do {
    const result = await predicate();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 20));
  } while (Date.now() < deadline);
  throw Object.assign(Error(), {code: 'FIXTURE_WAIT_TIMEOUT'});
}
async function backend(pid) {
  return (await q(`SELECT pid, backend_xid::text AS transaction_id, state, wait_event_type,
    pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1`, [Number(pid)])).rows[0];
}

try {
  observer = await open('observer');
  const context = (await q(`SELECT current_setting('server_version_num') AS version,
    current_setting('listen_addresses') AS listen, inet_server_addr() AS address,
    current_user AS role, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb,
    to_regprocedure('demo_owner_review.unbound_business_entrypoint(uuid,bigint)') IS NULL AS business_absent
    FROM pg_roles WHERE rolname=current_user`)).rows[0];
  assert.deepEqual(context, {version: '170006', listen: '', address: null, role: 'postgres',
    rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false, business_absent: true});
  await check('empty_configuration_zero_transport', async () => {
    const before = opened;
    outcome(await createIssuerEntry({openWire: async () => open('must-never-open')})
      .issue({contextId: '99999999-0000-4000-8000-000000000001'}), 'quarantine');
    assert.equal(opened, before); return {transportsOpened: 0};
  });
  let happy;
  await check('authentic_issuance_commit_same_socket_transaction', async () => {
    happy = await seed('happy'); let readTransaction;
    const instance = entry('happy', {afterQuery: async (text, result, wire) => {
      if (text === READ_AUTHORITY_SQL) {
        readTransaction = await backend(wire.metadata().backendPid);
        assert.equal(readTransaction.state, 'idle in transaction');
        assert.match(readTransaction.transaction_id, /^[1-9][0-9]*$/);
        assert.equal(result.rows[0].authority.protectedAuthority.recordId, happy.authority_id);
      }
      if (text === ISSUE_SQL) assert.deepEqual(await counts(happy.context_id), {issuance: 0, claims: 0, observations: 0});
    }});
    outcome(await instance.api.issue({contextId: happy.context_id}), 'issuance_commit_acknowledged');
    assert.equal(instance.opens, 1);
    assert.deepEqual(await counts(happy.context_id), {issuance: 1, claims: 0, observations: 1});
    const audit = (await q('SELECT * FROM authority_entry_fixture.insert_observations WHERE context_id=$1::uuid', [happy.context_id])).rows[0];
    assert.equal(String(audit.backend_pid), instance.wire.metadata().backendPid);
    assert.equal(audit.transaction_id, readTransaction.transaction_id);
    assert.equal(audit.isolation, 'read committed'); assert.equal(audit.synchronous_commit, 'on');
    sequence('happy', [SQL.begin, AUTHORITY_ISOLATION_SQL, SQL.durable, READ_AUTHORITY_SQL, ISSUE_SQL, READ_ISSUANCE_SQL, SQL.commit], ['T', 'T', 'T', 'T', 'T', 'T', 'I']);
    return {authorityReadBackendPid: readTransaction.pid, authorityReadTransaction: readTransaction.transaction_id,
      insertObservation: audit, uncommittedRowInvisibleToIndependentBackend: true, executionPermission: false};
  });
  await check('identical_committed_record_only_no_execution', async () => {
    const before = (await q('SELECT binding FROM demo_owner_review.issuer_obligations WHERE context_id=$1::uuid', [happy.context_id])).rows[0];
    const instance = entry('identical');
    outcome(await instance.api.issue({contextId: happy.context_id}), 'identical_record_only');
    assert.deepEqual(await counts(happy.context_id), {issuance: 1, claims: 0, observations: 1});
    assert.deepEqual((await q('SELECT binding FROM demo_owner_review.issuer_obligations WHERE context_id=$1::uuid', [happy.context_id])).rows[0], before);
    assert.ok(events('identical').some(e => e.event === 'protocol-command' && e.tag === 'INSERT 0 0'));
    return {immutableRowUnchanged: true, insertReturnedRows: 0, executionPermission: false};
  });
  for (const mode of ['binding', 'obligation_id']) {
    await check('conflict_' + mode + '_mismatch_no_commit', async () => {
      const value = await seed('conflict-' + mode);
      const expected = await derive(value.context_id, 'derive-' + mode);
      const parameters = [...expected.parameters];
      if (mode === 'binding') {
        const binding = JSON.parse(parameters[7]); binding.skipMs = binding.protectedAuthority.skipMs = 1;
        parameters[7] = JSON.stringify(binding);
      } else parameters[1] = '99999999-0000-4000-8000-000000000002';
      assert.equal((await q(ISSUE_SQL, parameters)).rowCount, 1); // Explicit hostile fixture ledger, original INSERT.
      const label = 'conflict-' + mode, instance = entry(label);
      outcome(await instance.api.issue({contextId: value.context_id}), 'conflict');
      assert.equal(events(label).some(e => e.event === 'protocol-command' && e.command === 'COMMIT'), false);
      assert.deepEqual(await counts(value.context_id), {issuance: 1, claims: 0, observations: 1});
      assert.equal((await q('SELECT obligation_id::text FROM demo_owner_review.issuer_obligations WHERE context_id=$1::uuid', [value.context_id])).rows[0].obligation_id, parameters[1]);
      return {fixtureMismatch: mode, commitSent: false, existingRowRetained: true, executionPermission: false};
    });
  }
  await check('revoked_authority_terminal_quarantine', async () => {
    const value = await seed('revoked');
    await q('SELECT demo_flow_writer.revoke_occurrence($1::uuid,$2)', [value.authority_id, 'ENTRY FIXTURE ONLY']);
    const instance = entry('revoked');
    outcome(await instance.api.issue({contextId: value.context_id}), 'quarantine');
    assert.ok(events('revoked').some(e => e.event === 'protocol-error' && e.sqlstate === '42501'));
    assert.deepEqual(await counts(value.context_id), {issuance: 0, claims: 0, observations: 0});
    return await terminal(instance, value.context_id, 'revoked');
  });
  await check('expired_authority_terminal_quarantine', async () => {
    const value = await seed('expired', 1500);
    await q('SELECT pg_sleep(1.7)');
    const instance = entry('expired');
    outcome(await instance.api.issue({contextId: value.context_id}), 'quarantine');
    assert.ok(events('expired').some(e => e.event === 'protocol-error' && e.sqlstate === '42501'));
    assert.deepEqual(await counts(value.context_id), {issuance: 0, claims: 0, observations: 0});
    return await terminal(instance, value.context_id, 'expired');
  });
  await check('insert_rollback_after_transport_close', async () => {
    const value = await seed('rollback'), instance = entry('rollback', {fault: {beforeQuery: 6}});
    outcome(await instance.api.issue({contextId: value.context_id}), 'quarantine');
    assert.ok(events('rollback').some(e => e.event === 'protocol-command' && e.tag === 'INSERT 0 1'));
    assert.equal(events('rollback').some(e => e.event === 'protocol-command' && e.command === 'COMMIT'), false);
    assert.deepEqual(await counts(value.context_id), {issuance: 0, claims: 0, observations: 0});
    return {...await terminal(instance, value.context_id, 'rollback'), rolledBackIssuanceAndAudit: true};
  });
  await check('uncertain_commit_ack_terminal_no_second_wire', async () => {
    const value = await seed('uncertain'), instance = entry('uncertain', {fault: {closeAfterCommitCommand: 1}});
    outcome(await instance.api.issue({contextId: value.context_id}), 'quarantine');
    const commit = events('uncertain').find(e => e.event === 'protocol-command' && e.command === 'COMMIT');
    assert.ok(commit); assert.equal(commit.queryOrdinal, 7);
    assert.equal(events('uncertain').some(e => e.n > commit.n && ['socket-write', 'protocol-ready'].includes(e.event)), false);
    assert.deepEqual(await counts(value.context_id), {issuance: 1, claims: 0, observations: 1});
    return {...await terminal(instance, value.context_id, 'uncertain'), committedRowObservedOnlyByTestObserver: true,
      injection: 'destroy after COMMIT CommandComplete before accepting ReadyForQuery', recoveryByEntry: false};
  });
  await check('cancelled_native_read_terminal_no_second_wire', async () => {
    const value = await seed('cancelled'), blocker = await open('cancel-blocker');
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM demo_flow_writer.protected_occurrences WHERE id=$1::uuid FOR UPDATE', [value.authority_id]);
    const instance = entry('cancelled'); const pending = instance.api.issue({contextId: value.context_id});
    try {
      const waiting = await waitFor(async () => {
        if (!instance.wire) return false;
        const state = await backend(instance.wire.metadata().backendPid);
        return state?.wait_event_type === 'Lock' && state.blockers.includes(Number(blocker.metadata().backendPid)) ? state : false;
      });
      assert.equal((await q('SELECT pg_cancel_backend($1) AS cancelled', [waiting.pid])).rows[0].cancelled, true);
      outcome(await pending, 'quarantine');
      assert.ok(events('cancelled').some(e => e.event === 'protocol-error' && e.sqlstate === '57014'));
      assert.deepEqual(await counts(value.context_id), {issuance: 0, claims: 0, observations: 0});
      return {...await terminal(instance, value.context_id, 'cancelled'), nativeSqlstate: '57014', observedLockWait: true};
    } finally { await blocker.close(); await pending; }
  });
  await check('revocation_serializes_until_entry_commit', async () => {
    const value = await seed('serialized');
    let release, reached;
    const held = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { reached = resolve; });
    const instance = entry('serialized', {afterQuery: async text => {
      if (text === READ_AUTHORITY_SQL) { reached(); await held; }
    }});
    const issuance = instance.api.issue({contextId: value.context_id});
    const revoker = await open('concurrent-revoker'); let revocation;
    try {
      await Promise.race([entered, issuance.then(() => { throw Object.assign(Error(), {code: 'ENTRY_DID_NOT_REACH_READER'}); })]);
      revocation = revoker.query('SELECT demo_flow_writer.revoke_occurrence($1::uuid,$2)', [value.authority_id, 'CONCURRENT ENTRY FIXTURE ONLY']);
      const waiting = await waitFor(async () => {
        const state = await backend(revoker.metadata().backendPid);
        return state?.wait_event_type === 'Lock' && state.blockers.includes(Number(instance.wire.metadata().backendPid)) ? state : false;
      });
      release(); outcome(await issuance, 'issuance_commit_acknowledged'); await revocation;
      const later = entry('after-revocation'); outcome(await later.api.issue({contextId: value.context_id}), 'quarantine');
      assert.deepEqual(await counts(value.context_id), {issuance: 1, claims: 0, observations: 1});
      return {revokerBackendPid: waiting.pid, blockedByEntryBackend: waiting.blockers,
        revocationWaitedUntilCommit: true, laterAuthorityRead: 'rejected', ...await terminal(later, value.context_id, 'after-revocation')};
    } finally { release(); await revoker.close(); await Promise.allSettled([issuance, revocation]); }
  });
  currentCase = 'verify_no_business_and_close';
  assert.equal((await q('SELECT count(*)::int AS count FROM demo_owner_review.claims')).rows[0].count, 0);
  assert.equal((await q("SELECT to_regprocedure('demo_owner_review.unbound_business_entrypoint(uuid,bigint)') IS NULL AS absent")).rows[0].absent, true);
  for (const forbidden of [SQL.dispatch, SQL.ingress, SQL.business]) {
    assert.equal(timeline.some(e => e.event === 'query-admitted' && e.queryHash === hash(forbidden)), false);
  }
  const cleanup = await Promise.allSettled([...wires].map(wire => wire.close()));
  assert.ok(cleanup.every(result => result.status === 'fulfilled'));
  assert.ok(identities.every(identity => events(identity.label).some(e => e.event === 'close-confirmed')));
  process.stdout.write(JSON.stringify({status: 'PASS_ISOLATED_INTEGRATION_ONLY', admission: 'NOT_ADMITTED', endpoint: 'DISABLED',
    cases, timeline, physicalWire: {driver: 'pg', version: '8.23.1', nodeVersion: process.version, identities,
      allOwnedTransportsCloseConfirmed: true, noReconnect: true, noReplay: true},
    originalQueries: {authority: hash(READ_AUTHORITY_SQL), issuance: hash(ISSUE_SQL), history: hash(READ_ISSUANCE_SQL)},
    business: 'NOT_RUN', rpcAuthentication: 'NOT_RUN', operationalAcl: 'NOT_ESTABLISHED',
    restoreDurability: 'NOT_ESTABLISHED', crossProcessQuarantine: 'NOT_ESTABLISHED', claims: 0}) + '\n');
} catch (cause) {
  const code = typeof cause?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(cause.code) ? cause.code : 'UNCLASSIFIED_FAILURE';
  process.stdout.write(JSON.stringify({status: 'FAIL', admission: 'NOT_ADMITTED', endpoint: 'DISABLED', cases, timeline,
    physicalWire: {driver: 'pg', version: '8.23.1', identities}, failure: {case: currentCase, code, sourceLine: Number(/authority-runtime\.mjs:(\d+)/.exec(cause?.stack ?? '')?.[1] ?? 0)}}) + '\n');
  process.exitCode = 1;
} finally { await Promise.allSettled([...wires].map(wire => wire.close())); }
