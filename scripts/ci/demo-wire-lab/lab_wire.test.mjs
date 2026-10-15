/** Offline state-machine checks: synthetic protocol messages; no connection, SQL or pg import. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Socket } from 'node:net';
import { spawnSync } from 'node:child_process';
import { LAB_CONFIG, _labTest } from './lab_wire.mjs';
const { ProtocolState, commandTag, guardedWrite, inputs, parameters } = _labTest;
const socketPath = LAB_CONFIG.host + '/.s.PGSQL.' + LAB_CONFIG.port;

function fixture(t, options = {}) {
  const socket = new Socket();
  let current = socket, writes = 0;
  const trace = [];
  const state = new ProtocolState({ socket, currentSocket: () => current, label: 'synthetic',
    trace: event => trace.push(event), onTerminal: () => socket.destroy(), ...options });
  t.after(() => socket.destroy());
  return { socket, state, trace, count: () => writes,
    replace() { const replacement = new Socket(); current = replacement; t.after(() => replacement.destroy()); },
    restore() { current = socket; },
    write(type) { return guardedWrite(state, socket, Buffer.from([type.charCodeAt(0), 0, 0, 0, 4]), () => { writes++; return true; }); },
    frames() { for (const type of ['P', 'B', 'D', 'E', 'S']) assert.equal(this.write(type), true); },
  };
}
function ready(f) {
  f.state.connect(socketPath); f.state.connected();
  f.state.message({ name: 'readyForQuery', status: 'I' });
}
function complete(f, text, tag, status, result, internal = false) {
  const pending = f.state.begin(text, internal);
  f.frames();
  f.state.message({ name: 'commandComplete', text: tag });
  f.state.message({ name: 'readyForQuery', status });
  return f.state.finish(pending, result);
}

test('factory fails before loading pg outside Actions', () => {
  const script = `import {createLabWire,LAB_CONFIG} from ${JSON.stringify(new URL('./lab_wire.mjs', import.meta.url).href)};
    try {await createLabWire({config:LAB_CONFIG,label:'synthetic'});process.exitCode=1;}
    catch(error) {if(error.code!=='HOLD_LAB_ACTIONS_ONLY')throw error;console.log(error.code);}`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { GITHUB_ACTIONS: 'false' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'HOLD_LAB_ACTIONS_ONLY');
});

test('scope, socket, database and role cannot be redirected', () => {
  for (const change of [{ scope: 'production' }, { host: 'localhost' }, { port: 6543 },
    { database: 'postgres' }, { sessionUser: 'supabase_admin' }, { deployment: 'another' }]) {
    assert.throws(() => inputs({ config: { ...LAB_CONFIG, ...change }, label: 'synthetic', trace() {} },
      { GITHUB_ACTIONS: 'true' }), /FIXTURE_CONFIG/);
  }
  assert.throws(() => inputs({ config: { ...LAB_CONFIG, connectionString: 'synthetic' }, label: 'synthetic', trace() {} },
    { GITHUB_ACTIONS: 'true' }), /FIXTURE_CONFIG/);
});

test('ambient PG configuration is rejected by name without reading its value', () => {
  let reads = 0;
  const env = { GITHUB_ACTIONS: 'true' };
  Object.defineProperty(env, 'PGPASSWORD', { enumerable: true, get() { reads++; throw Error('must not read'); } });
  assert.throws(() => inputs({ config: LAB_CONFIG, label: 'synthetic', trace() {} }, env), /AMBIENT_PG_ENV/);
  assert.equal(reads, 0);
});

test('config accessors and unrecognized fault hooks fail before a transport exists', () => {
  let reads = 0;
  const config = { ...LAB_CONFIG, get host() { reads++; return LAB_CONFIG.host; } };
  assert.throws(() => inputs({ config, label: 'synthetic', trace() {} }, { GITHUB_ACTIONS: 'true' }), /FIXTURE_CONFIG/);
  assert.equal(reads, 0);
  for (const fault of [{ reconnect: true }, { closeAfterCommitCommand: 0 }, { closeAfterCommitCommand: 3 },
    { beforeQuery: -1 }, { beforeQuery() {} }]) {
    assert.throws(() => inputs({ config: LAB_CONFIG, label: 'synthetic', trace() {}, fault },
      { GITHUB_ACTIONS: 'true' }), /FAULT/);
  }
});

test('only known counter-less CommandComplete tags produce rowCount zero', () => {
  for (const command of ['BEGIN', 'SET', 'COMMIT', 'ROLLBACK']) {
    assert.deepEqual(commandTag(command), { command, rowCount: 0, counter: false });
  }
  assert.deepEqual(commandTag('INSERT 0 2'), { command: 'INSERT', rowCount: 2, counter: true });
  assert.deepEqual(commandTag('SELECT 1'), { command: 'SELECT', rowCount: 1, counter: true });
  for (const tag of ['SHOW', 'CREATE TABLE', 'COMMIT 1', 'COMMIT ', 'SELECT -1', 'SELECT 9007199254740992', '', null]) {
    assert.throws(() => commandTag(tag), /COMMAND_TAG/);
  }
});

test('parameter validation does not coerce objects, getters or sparse arrays', () => {
  let reads = 0;
  const object = { toPostgres() { reads++; return 'synthetic'; } };
  const getter = []; Object.defineProperty(getter, 0, { get() { reads++; return 'synthetic'; } });
  for (const values of [[object], getter, new Array(1), [Infinity], [1.5], [1n]]) {
    assert.throws(() => parameters(values), /PARAMETERS/);
  }
  assert.equal(reads, 0);
  assert.deepEqual(parameters(['synthetic', 0, null, false]), ['synthetic', 0, null, false]);
});

test('no readiness is manufactured before the initial ReadyForQuery', t => {
  const f = fixture(t);
  f.state.connect(socketPath); f.state.connected();
  assert.equal(f.state.ready, 'closed');
  assert.throws(() => f.state.begin('BEGIN'), /TERMINAL/);
  f.state.message({ name: 'readyForQuery', status: 'I' });
  assert.equal(f.state.ready, 'closed');
  assert.equal(f.write('P'), false);
  assert.equal(f.count(), 0);
});

test('a second connect attempt permanently closes the socket epoch', t => {
  const f = fixture(t); ready(f);
  assert.throws(() => f.state.connect(socketPath), /RECONNECT/);
  assert.equal(f.state.connects, 2);
  assert.equal(f.state.ready, 'closed');
  assert.equal(f.write('P'), false);
});

test('matching CommandComplete plus ReadyForQuery preserves decoded rows', t => {
  const f = fixture(t); ready(f);
  const rows = [{ result: { synthetic: true } }];
  const response = complete(f, 'SELECT $1', 'SELECT 1', 'I', { command: 'SELECT', rowCount: 1, rows });
  assert.equal(response.rows, rows);
  assert.equal(response.rowCount, 1);
  assert.equal(f.count(), 5);
  assert.deepEqual(f.trace.filter(e => e.event === 'protocol-ready').map(e => e.status), ['I', 'I']);
});

test('BEGIN and COMMIT normalize only the raw null count from pg', t => {
  const f = fixture(t); ready(f);
  assert.equal(complete(f, 'BEGIN', 'BEGIN', 'T', { command: 'BEGIN', rowCount: null, rows: [] }).rowCount, 0);
  assert.equal(complete(f, 'COMMIT', 'COMMIT', 'I', { command: 'COMMIT', rowCount: null, rows: [] }).rowCount, 0);
  const pending = f.state.begin('BEGIN'); f.frames();
  f.state.message({ name: 'commandComplete', text: 'BEGIN' }); f.state.message({ name: 'readyForQuery', status: 'T' });
  assert.throws(() => f.state.finish(pending, { command: 'BEGIN', rowCount: 0, rows: [] }), /RESULT/);
});

test('CommandComplete without ReadyForQuery cannot acknowledge a query', t => {
  const f = fixture(t); ready(f);
  const pending = f.state.begin('COMMIT'); f.frames();
  f.state.message({ name: 'commandComplete', text: 'COMMIT' });
  assert.throws(() => f.state.finish(pending, { command: 'COMMIT', rowCount: null, rows: [] }), /RESULT/);
  f.state.message({ name: 'readyForQuery', status: 'I' });
  assert.equal(f.state.ready, 'closed');
});

test('unexpected ReadyForQuery, repeated CommandComplete and missing write frames are terminal', t => {
  for (const fault of ['ready-first', 'duplicate-command', 'missing-frames']) {
    const f = fixture(t); ready(f); const pending = f.state.begin('SELECT 1');
    if (fault !== 'missing-frames') f.frames();
    if (fault !== 'ready-first') f.state.message({ name: 'commandComplete', text: 'SELECT 1' });
    if (fault === 'duplicate-command') f.state.message({ name: 'commandComplete', text: 'SELECT 1' });
    f.state.message({ name: 'readyForQuery', status: 'I' });
    assert.throws(() => f.state.finish(pending, { command: 'SELECT', rowCount: 1, rows: [{}] }), /RESULT/);
    const before = f.count(); assert.equal(f.write('E'), false); assert.equal(f.count(), before);
  }
});

test('a repeated Execute frame is rejected before the synthetic writer', t => {
  const f = fixture(t); ready(f); f.state.begin('SELECT 1');
  assert.equal(f.write('E'), true); assert.equal(f.write('E'), false);
  assert.equal(f.count(), 1); assert.equal(f.state.ready, 'closed');
});

test('concurrent calls poison the admitted attempt and cannot leave a queued query', async t => {
  const f = fixture(t); ready(f); const pending = f.state.begin('SELECT 1');
  assert.throws(() => f.state.begin('SELECT 2'), /CONCURRENT_QUERY/);
  await assert.rejects(pending.failure, /CONCURRENT_QUERY/);
  assert.equal(f.write('P'), false); assert.equal(f.count(), 0);
});

test('socket replacement is terminal even if the original stream identity later returns', t => {
  const f = fixture(t); ready(f); f.state.begin('SELECT 1'); f.replace();
  assert.equal(f.write('P'), false); assert.equal(f.state.ready, 'closed');
  f.restore(); assert.equal(f.write('P'), false); assert.equal(f.state.ready, 'closed');
  assert.equal(f.count(), 0);
});

test('SQL error records only SQLSTATE and ignored ReadyForQuery E cannot revive it', async t => {
  const f = fixture(t); ready(f); const pending = f.state.begin('SELECT synthetic'); f.frames();
  f.state.message({ name: 'error', code: '23514', message: 'must not enter trace', detail: 'synthetic private detail' });
  f.state.message({ name: 'readyForQuery', status: 'E' });
  await assert.rejects(pending.failure, /PROTOCOL_ERROR/);
  assert.equal(f.state.ready, 'closed');
  assert.equal(f.trace.find(e => e.event === 'protocol-error').sqlstate, '23514');
  assert.equal(f.trace.find(e => e.event === 'protocol-ready-ignored').status, 'E');
  assert.doesNotMatch(JSON.stringify(f.trace), /must not enter trace|private detail/);
  const before = f.count(); assert.equal(f.write('E'), false); assert.equal(f.count(), before);
});

test('deterministic COMMIT boundary faults reject before a same-chunk ReadyForQuery', async t => {
  for (const ordinal of [1, 2]) {
    const f = fixture(t, { fault: { closeAfterCommitCommand: ordinal } }); ready(f);
    if (ordinal === 2) complete(f, 'COMMIT', 'COMMIT', 'I', { command: 'COMMIT', rowCount: null, rows: [] });
    const pending = f.state.begin('COMMIT'); f.frames();
    f.state.message({ name: 'commandComplete', text: 'COMMIT' });
    f.state.message({ name: 'readyForQuery', status: 'I' });
    await assert.rejects(pending.failure, /INJECTED_COMMIT_BOUNDARY/);
    assert.equal(pending.readySeen, false); assert.equal(f.state.ready, 'closed');
    assert.equal(f.trace.filter(e => e.event === 'protocol-command' && e.tag === 'COMMIT').length, ordinal);
    assert.equal(f.trace.at(-1).event, 'protocol-ready-ignored');
    const before = f.count(); assert.equal(f.write('P'), false); assert.equal(f.count(), before);
  }
});

test('beforeQuery injection excludes the identity probe and admits zero owner writes', t => {
  const f = fixture(t, { fault: { beforeQuery: 1 } }); ready(f);
  complete(f, 'SELECT identity', 'SELECT 1', 'I', { command: 'SELECT', rowCount: 1, rows: [{}] }, true);
  const before = f.count();
  assert.throws(() => f.state.begin('BEGIN'), /INJECTED_BEFORE_QUERY/);
  assert.equal(f.count(), before);
  assert.equal(f.trace.filter(e => e.event === 'query-admitted').length, 1);
});

test('trace failure closes the attempt before a write can reach its sink', t => {
  const f = fixture(t); ready(f); f.state.begin('SELECT 1');
  f.state.trace = () => { throw Error('synthetic trace failure'); };
  assert.equal(f.write('P'), false); assert.equal(f.count(), 0);
  assert.equal(f.state.ready, 'closed');
});
