/** Composition tests only: real owner/driver/SQL, scripted transport and in-memory history.
 * No PostgreSQL parser, physical socket, identity provider or database ACL is exercised.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwner } from '../../../docs/review/demo-durable-owner-adapter-20261015/owner.mjs';
import { SQL } from '../../../docs/review/demo-durable-owner-adapter-20261015/store.mjs';

const CONTEXT = '10000000-0000-4000-8000-000000000001';
const OBLIGATION = '10000000-0000-4000-8000-000000000002';
const CONFIG = Object.freeze({ deployment: 'SYNTHETIC_AUTHORITY_COMPOSITION', database: 'synthetic',
  sessionUser: 'synthetic', durabilityEvidence: 'SYNTHETIC_ONLY', driverEvidence: 'SCRIPTED_ONLY' });
const serverClaim = () => ({ context_id: CONTEXT, obligation_id: OBLIGATION,
  binding: { skipMs: 37, tenant: 'SYNTHETIC_TENANT', provenance: { receipt: 'SYNTHETIC_SERVER_RECEIPT' } } });
const reply = (command, rows = []) => ({ command, rows, rowCount: rows.length });
const step = (sql, params, before, after, result, apply, failure) =>
  ({ sql, params, before, after, result, apply, failure });

// A reply script is intentionally smaller than a store implementation: it does not
// evaluate SQL predicates, unique constraints, authentication, ACLs or commit durability.
function scriptedTransport(planForOpen) {
  const stats = { opens: 0, closes: 0, queries: [], replies: [], events: [], violations: [] };
  const openWire = async () => {
    const ordinal = ++stats.opens, plan = planForOpen();
    let ready = 'I', closed = false;
    stats.events.push('open');
    const metadata = { socketEpoch: 'SYNTHETIC_EPOCH_' + ordinal, backendPid: 'SYNTHETIC_PID_' + ordinal,
      backendStart: 'SYNTHETIC_START', database: CONFIG.database, sessionUser: CONFIG.sessionUser,
      exclusive: true, noReconnect: true, noReplay: true };
    return {
      metadata: () => ({ ...metadata, ready }),
      async query(sql, params) {
        stats.queries.push({ sql, params: structuredClone(params) });
        const expected = plan.shift();
        try {
          assert.ok(!closed && expected, 'unexpected access to scripted transport');
          assert.equal(sql, expected.sql);
          assert.deepEqual(params, expected.params);
          assert.equal(ready, expected.before);
        } catch (cause) {
          // createOwner intentionally catches errors. Preserve harness violations so
          // an expected quarantine cannot accidentally hide a broken test oracle.
          stats.violations.push(cause.message);
          throw cause;
        }
        expected.apply?.();
        ready = expected.after;
        if (expected.failure) throw Error(expected.failure);
        const result = structuredClone(expected.result);
        stats.replies.push({ sql, command: result.command, rowCount: result.rowCount });
        return result;
      },
      async close() {
        if (!closed) { stats.closes++; stats.events.push('close'); }
        closed = true; ready = 'closed';
      },
    };
  };
  return { stats, openWire };
}

function businessPlan(row, effects, events) {
  return [
    step(SQL.begin, [], 'I', 'T', reply('BEGIN')),
    step(SQL.business, [row.context_id, row.binding.skipMs], 'T', 'T',
      reply('SELECT', [{ result: { scope: 'SYNTHETIC_EFFECT' } }])),
    step(SQL.commit, [], 'T', 'I', reply('COMMIT'), () => {
      effects.push({ contextId: row.context_id, skipMs: row.binding.skipMs });
      events.push('business-commit');
    }),
  ];
}

function composition({ selection = 'new', initiallyConsumed = false, claimError = false,
  uncertainClaimAck = false, authenticated = true, guard = () => true } = {}) {
  const row = serverClaim(), history = initiallyConsumed ? [structuredClone(row)] : [], effects = [];
  const hooks = { auth: 0, guard: 0, seenGuard: null };
  let transport;
  transport = scriptedTransport(() => {
    const inserted = selection === 'new' && history.length === 0 ? structuredClone(row) : null;
    return [
      step(SQL.begin, [], 'I', 'T', reply('BEGIN')),
      step(SQL.durable, [], 'T', 'T', reply('SET')),
      step(SQL.ingress, [CONFIG.deployment, CONTEXT], 'T', 'T', reply('INSERT', inserted ? [inserted] : []),
        undefined, claimError ? 'SYNTHETIC_INSERT_FAILURE' : undefined),
      step(SQL.commit, [], 'T', 'I', reply('COMMIT'), () => {
        if (inserted) history.push(structuredClone(inserted));
        transport.stats.events.push('claim-commit-applied');
      }, uncertainClaimAck && inserted ? 'SYNTHETIC_CLAIM_ACK_UNCERTAIN' : undefined),
      ...businessPlan(row, effects, transport.stats.events),
    ];
  });
  const makeOwner = (config = CONFIG) => createOwner({ config, openWire: transport.openWire,
    authenticate: async contextId => {
      hooks.auth++; assert.equal(contextId, CONTEXT); transport.stats.events.push('authenticate');
      return authenticated;
    },
    businessGuard: async claim => {
      hooks.guard++; hooks.seenGuard = claim; transport.stats.events.push('business-guard');
      assert.equal(history.length, 1, 'guard must follow the separately applied claim commit');
      return guard(claim);
    },
  });
  return { ...transport, history, effects, hooks, makeOwner,
    readHistoricalClaim: () => structuredClone(history[0]),
    businessCalls: () => transport.stats.queries.filter(x => x.sql === SQL.business),
    verifyDouble() { assert.deepEqual(transport.stats.violations, []); assert.equal(transport.stats.closes, transport.stats.opens); },
  };
}

test('empty configuration reaches neither auth, wire, guard nor stored history', async () => {
  const h = composition();
  assert.equal((await h.makeOwner({}).execute({ contextId: CONTEXT })).outcome, 'quarantine');
  assert.deepEqual([h.hooks.auth, h.stats.opens, h.hooks.guard, h.stats.queries.length, h.history.length], [0, 0, 0, 0, 0]);
  h.verifyDouble();
});

test('authentication denial precedes wire acquisition and any claim attempt', async () => {
  const h = composition({ authenticated: false });
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'quarantine');
  assert.deepEqual([h.hooks.auth, h.stats.opens, h.stats.queries.length, h.history.length], [1, 0, 0, 0]);
  h.verifyDouble();
});

test('caller authority/binding overrides fail preflight without poisoning a later valid invocation', async () => {
  const h = composition(), owner = h.makeOwner();
  for (const extra of [{ authorizedOccurrence: 'caller-occurrence' }, { binding: { skipMs: 0 } }]) {
    assert.equal((await owner.execute({ contextId: CONTEXT, ...extra })).outcome, 'quarantine');
  }
  assert.deepEqual([h.hooks.auth, h.stats.opens, h.history.length], [0, 0, 0]);
  assert.equal((await owner.execute({ contextId: CONTEXT })).outcome, 'business_commit_acknowledged');
  assert.equal(h.effects.length, 1);
  h.verifyDouble();
});

test('a scripted zero-row consume is sealed for absent issuance or dispatch, without business', async () => {
  // These labels describe injected DB outcomes, not evaluation of the real SQL WHERE.
  for (const selection of ['absent-issuance', 'absent-dispatch']) {
    const h = composition({ selection });
    assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'sealed');
    assert.deepEqual([h.history.length, h.businessCalls().length, h.hooks.guard], [0, 0, 0]);
    assert.deepEqual(h.stats.queries.map(x => x.sql), [SQL.begin, SQL.durable, SQL.ingress, SQL.commit]);
    h.verifyDouble();
  }
});

test('claim insert error quarantines before commit and starts no business transaction', async () => {
  const h = composition({ claimError: true });
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'quarantine');
  assert.deepEqual([h.history.length, h.businessCalls().length, h.hooks.guard], [0, 0, 0]);
  assert.deepEqual(h.stats.queries.map(x => x.sql), [SQL.begin, SQL.durable, SQL.ingress]);
  h.verifyDouble();
});

test('applied claim with uncertain ACK permits neither business nor a reconstructed owner retry', async () => {
  const h = composition({ uncertainClaimAck: true });
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'quarantine');
  assert.equal(h.history.length, 1, 'the test models a committed claim whose ACK was not delivered');
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'sealed');
  assert.deepEqual([h.businessCalls().length, h.hooks.guard, h.effects.length], [0, 0, 0]);
  h.verifyDouble();
});

test('revocation at businessGuard retains the confirmed claim and burns retry permission', async () => {
  const h = composition({ guard: () => false });
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'quarantine');
  assert.equal(h.history.length, 1);
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'sealed');
  assert.deepEqual([h.businessCalls().length, h.hooks.guard, h.effects.length], [0, 1, 0]);
  h.verifyDouble();
});

test('confirmed live claim allows one business TX with server binding despite mutation of the guard copy', async () => {
  const h = composition({ guard: claim => {
    assert.equal(Object.isFrozen(claim), true);
    assert.equal(claim.binding.provenance.receipt, 'SYNTHETIC_SERVER_RECEIPT');
    claim.binding.skipMs = 999; // Only the cloned guard input changes.
    return true;
  } });
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'business_commit_acknowledged');
  assert.deepEqual(h.businessCalls().map(x => x.params), [[CONTEXT, 37]]);
  assert.deepEqual(h.effects, [{ contextId: CONTEXT, skipMs: 37 }]);
  assert.equal(h.history[0].binding.skipMs, 37);
  assert.deepEqual(h.stats.queries.map(x => x.sql),
    [SQL.begin, SQL.durable, SQL.ingress, SQL.commit, SQL.begin, SQL.business, SQL.commit]);
  assert.ok(h.stats.events.indexOf('claim-commit-applied') < h.stats.events.indexOf('business-guard'));
  assert.ok(h.stats.events.indexOf('business-guard') < h.stats.events.indexOf('business-commit'));
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'sealed');
  assert.equal(h.businessCalls().length, 1);
  h.verifyDouble();
});

test('reading a historical claim grants no right when this invocation INSERT returns zero', async () => {
  const h = composition({ initiallyConsumed: true });
  assert.equal(h.readHistoricalClaim().obligation_id, OBLIGATION);
  assert.equal((await h.makeOwner().execute({ contextId: CONTEXT })).outcome, 'sealed');
  assert.equal(h.stats.replies.find(x => x.sql === SQL.ingress).rowCount, 0);
  assert.deepEqual([h.businessCalls().length, h.hooks.guard, h.history.length], [0, 0, 1]);
  h.verifyDouble();
});

test('negative control: fixture auth and a stable UUID do not stop effects when the owner/ledger is bypassed', async () => {
  // Deliberately permissive scripted sink, NOT the real SQL wrapper, database ACL
  // or an operational adapter. This demonstrates why composition needs a no-bypass gate.
  const effects = [], row = serverClaim();
  let transport;
  transport = scriptedTransport(() => [
    ...businessPlan(row, effects, transport.stats.events),
    ...businessPlan(row, effects, transport.stats.events),
  ]);
  const wire = await transport.openWire(), fixtureAuthenticate = async () => true;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal(await fixtureAuthenticate(CONTEXT), true);
      await wire.query(SQL.begin, []);
      await wire.query(SQL.business, [CONTEXT, row.binding.skipMs]);
      await wire.query(SQL.commit, []);
    }
  } finally { await wire.close(); }
  assert.equal(effects.length, 2);
  assert.equal(transport.stats.queries.some(x => x.sql === SQL.ingress), false);
  assert.deepEqual(transport.stats.violations, []);
  assert.equal(transport.stats.closes, transport.stats.opens);
});
