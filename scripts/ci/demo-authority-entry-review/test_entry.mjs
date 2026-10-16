import test from 'node:test';
import assert from 'node:assert/strict';
import {createIssuerEntry, READ_ISSUANCE_SQL, AUTHORITY_ISOLATION_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer-entry.mjs';
import {READ_AUTHORITY_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/authority-provider.mjs';
import {ISSUE_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/store.mjs';
import {config, request, syntheticSnapshots, syntheticIssuance, id, syntheticWire} from './fixtures.mjs';

const run = async options => {
  const wire = syntheticWire(options);
  let opened = 0;
  const entry = createIssuerEntry({config, openWire: async () => { opened++; return wire; }});
  const result = await entry.issue(request());
  return {wire, result, opened};
};

test('authentic issuer derivation, protected read, INSERT and commit all share one transaction', async () => {
  const {envelope} = await syntheticIssuance();
  const {wire, result, opened} = await run();
  assert.deepEqual(result, {outcome: 'issuance_commit_acknowledged', executionPermission: false, admission: 'NOT_ADMITTED'});
  assert.equal(opened, 1);
  assert.deepEqual(wire.events, [SQL.begin, AUTHORITY_ISOLATION_SQL, SQL.durable, READ_AUTHORITY_SQL, ISSUE_SQL, READ_ISSUANCE_SQL, SQL.commit, 'CLOSE']);
  assert.deepEqual(wire.calls[3].parameters, [id(8)]);
  assert.deepEqual(wire.calls[4].parameters, [...envelope.parameters]);
  assert.deepEqual(wire.calls[5].parameters, [...envelope.parameters.slice(0, 7)]);
  for (const forbidden of [SQL.dispatch, SQL.ingress, SQL.business]) {
    assert.equal(wire.calls.some(c => c.sql === forbidden), false);
  }
});

test('empty configuration fails closed without connection, even with an invented openWire', async () => {
  let opened = 0;
  const result = await createIssuerEntry({openWire: () => { opened++; }}).issue(request());
  assert.equal(result.outcome, 'quarantine'); assert.equal(opened, 0);
  assert.deepEqual(await createIssuerEntry().issue(request()), result);
});

test('only an exact context reference is accepted; no caller claims or accessors are read', async () => {
  let opened = 0, getters = 0;
  const entry = createIssuerEntry({config, openWire: () => { opened++; }});
  const getter = {}; Object.defineProperty(getter, 'contextId', {enumerable: true, get() { getters++; return id(8); }});
  const hidden = {}; Object.defineProperty(hidden, 'contextId', {value: id(8)});
  const symbol = {...request(), [Symbol('proof')]: true};
  const inherited = Object.assign(Object.create({trusted: true}), request());
  for (const value of [undefined, null, [], id(8), {}, {contextId: 1}, {contextId: 'bad'},
    {...request(), skipMs: 1}, {...request(), workId: id(4)}, {...request(), snapshots: syntheticSnapshots()},
    {...request(), authorizedOccurrence: 'ATTACK'}, {...request(), authenticated: true},
    {...request(), deployment: config.deployment}, getter, hidden, symbol, inherited]) {
    assert.equal((await entry.issue(value)).outcome, 'quarantine');
  }
  assert.equal((await entry.issue(request(), {})).outcome, 'quarantine');
  assert.equal(opened, 0); assert.equal(getters, 0);
});

test('identical immutable issuance remains record-only and conveys no execution permission', async () => {
  const {wire, result} = await run({existing: true});
  assert.deepEqual(result, {outcome: 'identical_record_only', executionPermission: false, admission: 'NOT_ADMITTED'});
  assert.equal(wire.calls.filter(c => c.sql === ISSUE_SQL).length, 1);
  assert.equal(wire.calls.filter(c => c.sql === SQL.commit).length, 1);
});

test('context renewal of the same obligation conflicts rather than rebinding immutable history', async () => {
  const oldSnapshots = syntheticSnapshots();
  oldSnapshots.serverContext.contextId = oldSnapshots.serverAdmission.contextId = id(88);
  const {row} = await syntheticIssuance(oldSnapshots);
  const {wire, result} = await run({existing: true, history: [row]});
  assert.equal(result.outcome, 'conflict'); assert.equal(result.executionPermission, false);
  assert.equal(wire.calls.some(c => c.sql === SQL.commit), false); assert.equal(wire.closed, true);
});

test('binding mutation for the same natural obligation conflicts, even when internally coherent', async () => {
  const oldSnapshots = syntheticSnapshots(); oldSnapshots.protectedAuthority.skipMs = 1;
  const {row} = await syntheticIssuance(oldSnapshots);
  const {wire, result} = await run({existing: true, history: [row]});
  assert.equal(result.outcome, 'conflict'); assert.equal(wire.calls.some(c => c.sql === SQL.commit), false);
});

test('same context across another natural key conflicts; a digest collision also conflicts', async () => {
  const other = syntheticSnapshots(); other.protectedAuthority.authorizedOccurrence = 'OTHER_SEPARATELY_AUTHORIZED_OCCURRENCE';
  const {row} = await syntheticIssuance(other);
  for (const collision of [false, true]) {
    const history = structuredClone([row]);
    if (collision) {
      history[0].obligationId = (await syntheticIssuance()).envelope.obligationId;
      history[0].contextId = history[0].binding.contextId = history[0].binding.serverAdmission.contextId
        = history[0].binding.serverContext.contextId = id(88);
    }
    const {wire, result} = await run({existing: true, history});
    assert.equal(result.outcome, 'conflict'); assert.equal(wire.calls.some(c => c.sql === SQL.commit), false);
  }
});

test('a conflict in any domain wins even when another row appears identical', async () => {
  const exact = (await syntheticIssuance()).row;
  const other = syntheticSnapshots(); other.protectedAuthority.authorizedOccurrence = 'OTHER_OCCURRENCE';
  const conflicting = (await syntheticIssuance(other)).row;
  // Such duplicate-context history violates the protected DB constraint. Its
  // synthetic appearance is ambiguous and must quarantine, never succeed.
  const {wire, result} = await run({existing: true, history: [exact, conflicting]});
  assert.equal(result.outcome, 'quarantine'); assert.equal(wire.calls.some(c => c.sql === SQL.commit), false);
});

test('empty, unknown, extra-column and malformed history cannot turn ON CONFLICT into success', async () => {
  const row = (await syntheticIssuance()).row;
  const unrelated = syntheticSnapshots();
  unrelated.protectedAuthority.authorizedOccurrence = 'UNRELATED_OCCURRENCE';
  unrelated.serverAdmission.contextId = unrelated.serverContext.contextId = id(88);
  const unrelatedRow = (await syntheticIssuance(unrelated)).row;
  for (const history of [[], [unrelatedRow], [{...row, authority: true}], [null], [row, row], [row, row, row, row]]) {
    const {wire, result} = await run({existing: true, history});
    assert.equal(result.outcome, 'quarantine'); assert.equal(wire.calls.some(c => c.sql === SQL.commit), false);
  }
});

test('bad INSERT or SELECT protocol shapes never reach COMMIT', async () => {
  for (const mutate of [
    (sql, r) => { if (sql === ISSUE_SQL) r.rowCount = 2; },
    (sql, r) => { if (sql === ISSUE_SQL) r.rows = [{obligation_id: id(99)}]; },
    (sql, r) => { if (sql === ISSUE_SQL) r.rows[0].injected = true; },
    (sql, r) => { if (sql === ISSUE_SQL) { r.rows.push(r.rows[0]); r.rowCount = 2; } },
    (sql, r) => { if (sql === READ_ISSUANCE_SQL) r.rowCount = 0; },
    (sql, r) => { if (sql === READ_ISSUANCE_SQL) r.command = 'UPDATE'; },
  ]) {
    const {wire, result} = await run({mutateResult: mutate});
    assert.equal(result.outcome, 'quarantine'); assert.equal(wire.calls.some(c => c.sql === SQL.commit), false);
  }
});

test('each lost ACK quarantines and destroys exactly one socket without retry or replay', async () => {
  for (const sql of [SQL.begin, AUTHORITY_ISOLATION_SQL, SQL.durable, READ_AUTHORITY_SQL, ISSUE_SQL, READ_ISSUANCE_SQL, SQL.commit]) {
    const {wire, result, opened} = await run({rejectSQL: sql});
    assert.equal(result.outcome, 'quarantine'); assert.equal(result.executionPermission, false);
    assert.equal(opened, 1); assert.equal(wire.calls.filter(c => c.sql === sql).length, 1);
    assert.equal(wire.events.at(-1), 'CLOSE'); assert.equal(wire.closed, true);
    if (sql === SQL.commit) assert.equal(wire.calls.at(-1).sql, SQL.commit, 'no read-after-unknown-commit recovery');
  }
});

test('COMMIT needs its exact command and ReadyForQuery acknowledgement', async () => {
  for (const mutate of [
    (sql, r) => { if (sql === SQL.commit) r.command = 'ROLLBACK'; },
    (sql, r) => { if (sql === SQL.commit) r.rowCount = NaN; },
    (sql, r) => { if (sql === SQL.commit) r.rowCount = 1; },
    (sql, r) => { if (sql === SQL.commit) r.rows = [{unexpected: true}]; },
    (sql, r, metadata) => { if (sql === SQL.commit) metadata.socketEpoch = 'SYNTHETIC_RECONNECT'; },
  ]) {
    const {wire, result} = await run({mutateResult: mutate});
    assert.equal(result.outcome, 'quarantine'); assert.equal(wire.calls.at(-1).sql, SQL.commit);
    assert.equal(wire.closed, true);
  }
});

test('physical identity changes or multiplexing flags quarantine before issuance', async () => {
  for (const change of [m => { m.backendPid++; }, m => { m.backendStart = 'CHANGED'; },
    m => { m.socketEpoch = 'CHANGED'; }, m => { m.database = 'OTHER'; },
    m => { m.sessionUser = 'OTHER'; }, m => { m.exclusive = false; },
    m => { m.noReconnect = false; }, m => { m.noReplay = false; }]) {
    const {wire, result} = await run({mutateResult: (sql, r, m) => { if (sql === READ_AUTHORITY_SQL) change(m); }});
    assert.equal(result.outcome, 'quarantine'); assert.equal(wire.calls.some(c => c.sql === ISSUE_SQL), false);
    assert.equal(wire.closed, true);
  }
});

test('invalid initial wire and uncertain close both quarantine and destroy the socket', async () => {
  const wire = syntheticWire(); wire.metadataState.exclusive = false;
  const invalid = await createIssuerEntry({config, openWire: async () => wire}).issue(request());
  assert.equal(invalid.outcome, 'quarantine'); assert.equal(wire.closed, true); assert.equal(wire.calls.length, 0);
  const {result} = await run({closeError: true});
  assert.deepEqual(result, {outcome: 'quarantine', executionPermission: false, admission: 'NOT_ADMITTED', cleanup: 'unconfirmed'});
});

test('concurrent calls on one entry cannot share, reopen or interleave its transaction', async () => {
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const wire = syntheticWire({beforeQuery: async sql => { if (sql === READ_AUTHORITY_SQL) { entered(); await blocked; } }});
  let opens = 0;
  const entry = createIssuerEntry({config, openWire: async () => { opens++; return wire; }});
  const first = entry.issue(request()); await started;
  assert.equal((await entry.issue(request())).outcome, 'quarantine'); assert.equal(opens, 1);
  release(); assert.equal((await first).outcome, 'issuance_commit_acknowledged');
});


test('uncertain ACK terminally quarantines the entry instead of reopening and rereading history', async () => {
  for (const failedSQL of [SQL.begin, AUTHORITY_ISOLATION_SQL, SQL.durable, READ_AUTHORITY_SQL,
    ISSUE_SQL, READ_ISSUANCE_SQL, SQL.commit]) {
    const firstWire = syntheticWire({rejectSQL: failedSQL});
    const recoveryWire = syntheticWire({existing: true});
    let opens = 0;
    const entry = createIssuerEntry({config, openWire: async () => ++opens === 1 ? firstWire : recoveryWire});
    assert.equal((await entry.issue(request())).outcome, 'quarantine');
    assert.equal((await entry.issue(request())).outcome, 'quarantine');
    assert.equal((await entry.issue({contextId: id(88)})).outcome, 'quarantine');
    assert.equal(opens, 1, failedSQL);
    assert.equal(recoveryWire.calls.length, 0);
    assert.equal(firstWire.closed, true);
  }
});

test('an unconfirmed close terminally quarantines even after a COMMIT acknowledgement', async () => {
  const wire = syntheticWire({closeError: true}); let opens = 0;
  const entry = createIssuerEntry({config, openWire: async () => { opens++; return wire; }});
  assert.equal((await entry.issue(request())).cleanup, 'unconfirmed');
  assert.equal((await entry.issue(request())).outcome, 'quarantine');
  assert.equal(opens, 1);
});


test('invalid input before opening the protocol does not poison a valid later request', async () => {
  const wire = syntheticWire(); let opens = 0;
  const entry = createIssuerEntry({config, openWire: async () => { opens++; return wire; }});
  assert.equal((await entry.issue({...request(), skipMs: 1})).outcome, 'quarantine');
  assert.equal(opens, 0);
  assert.equal((await entry.issue(request())).outcome, 'issuance_commit_acknowledged');
  assert.equal(opens, 1);
});

test('validated insertion status is captured before later asynchronous operations', async () => {
  for (const existing of [false, true]) {
    let inserted;
    const {result} = await run({existing, mutateResult: (sql, r) => {
      if (sql === ISSUE_SQL) inserted = r;
      if (sql === READ_ISSUANCE_SQL) {
        if (existing) inserted.rows.push({obligation_id: r.rows[0].obligationId});
        else inserted.rows.length = 0;
      }
    }});
    assert.equal(result.outcome, existing ? 'identical_record_only' : 'issuance_commit_acknowledged');
  }
});
