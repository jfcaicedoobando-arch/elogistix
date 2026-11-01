/** Actions laboratory only. This module is not a deployable wire adapter. */
import { Socket } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

export const LAB_CONFIG = Object.freeze({
  deployment: 'SYNTHETIC_WIRE_LAB', database: 'crm_acl_fixture_persistence', sessionUser: 'postgres',
  durabilityEvidence: 'SYNTHETIC_COMMITTED_VISIBILITY_ONLY', driverEvidence: 'SYNTHETIC_PHYSICAL_WIRE_LAB',
  scope: 'actions-physical-wire-lab', host: '/tmp/crm/socket', port: 5432,
});
const IDENTITY_SQL = `SELECT pg_backend_pid()::text AS backend_pid, backend_start::text AS backend_start,
 current_database() AS database, session_user::text AS session_user
 FROM pg_stat_activity WHERE pid=pg_backend_pid()`;
const error = reason => Object.assign(new Error('HOLD_LAB_' + reason), { code: 'HOLD_LAB_' + reason });
const demand = (ok, reason) => { if (!ok) throw error(reason); };
const digest = text => createHash('sha256').update(text).digest('hex');

function plainValues(value, allowed, reason) {
  demand(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, reason);
  const fields = Object.getOwnPropertyDescriptors(value);
  demand(Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key)
    && Object.hasOwn(fields[key], 'value')), reason);
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]));
}

function inputs({ config, label, trace, fault }, env) {
  demand(env.GITHUB_ACTIONS === 'true', 'ACTIONS_ONLY');
  // Inspect names only; never consume ambient connection credentials or pgpass settings.
  demand(!Object.keys(env).some(key => /^PG/.test(key) || key === 'NODE_PG_FORCE_NATIVE'), 'AMBIENT_PG_ENV');
  const measured = plainValues(config, Object.keys(LAB_CONFIG), 'FIXTURE_CONFIG');
  demand(Object.keys(measured).length === Object.keys(LAB_CONFIG).length
    && Object.entries(LAB_CONFIG).every(([key, value]) => measured[key] === value), 'FIXTURE_CONFIG');
  demand(typeof label === 'string' && /^[a-z][a-z0-9_-]{0,47}$/.test(label), 'LABEL');
  demand(typeof trace === 'function', 'TRACE');
  const faults = fault === undefined ? {} : plainValues(fault, ['closeAfterCommitCommand', 'beforeQuery'], 'FAULT');
  if (Object.hasOwn(faults, 'closeAfterCommitCommand')) demand([1, 2].includes(faults.closeAfterCommitCommand), 'FAULT');
  if (Object.hasOwn(faults, 'beforeQuery')) demand(Number.isSafeInteger(faults.beforeQuery) && faults.beforeQuery > 0, 'FAULT');
  return Object.freeze(faults);
}

function parameters(values) {
  demand(Array.isArray(values), 'PARAMETERS');
  const fields = Object.getOwnPropertyDescriptors(values);
  demand(Reflect.ownKeys(values).length === values.length + 1, 'PARAMETERS');
  const copied = [];
  for (let index = 0; index < values.length; index++) {
    const field = fields[index];
    demand(field && Object.hasOwn(field, 'value'), 'PARAMETERS');
    const value = field.value;
    demand(value === null || typeof value === 'string' || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isSafeInteger(value)), 'PARAMETERS');
    copied.push(value);
  }
  return copied;
}

function commandTag(tag) {
  demand(typeof tag === 'string', 'COMMAND_TAG');
  // Only these counter-less protocol grammars justify rowCount=0.
  if (/^(BEGIN|SET|COMMIT|ROLLBACK)$/.test(tag)) return { command: tag, rowCount: 0, counter: false };
  const match = /^(INSERT) [0-9]+ ([0-9]+)$/.exec(tag)
    || /^(SELECT|UPDATE|DELETE|MERGE|MOVE|FETCH|COPY) ([0-9]+)$/.exec(tag);
  demand(match, 'COMMAND_TAG');
  const rowCount = Number(match[2]);
  demand(Number.isSafeInteger(rowCount) && rowCount >= 0, 'COMMAND_TAG');
  return { command: match[1], rowCount, counter: true };
}

/** Shared state machine. Offline tests use a real, unconnected net.Socket and synthetic messages. */
class ProtocolState {
  constructor({ socket, currentSocket = () => socket, label, trace, fault = {}, onTerminal = () => {} }) {
    demand(socket instanceof Socket, 'SOCKET');
    this.socket = socket; this.currentSocket = currentSocket; this.label = label; this.trace = trace;
    this.fault = fault; this.onTerminal = onTerminal;
    this.epoch = randomUUID(); this.ready = 'closed'; this.phase = 'new'; this.terminal = null;
    this.connects = 0; this.ordinal = 0; this.commits = 0; this.sequence = 0; this.pending = null;
  }
  emit(event, fields = {}) {
    try { this.trace(Object.freeze({ n: ++this.sequence, event, label: this.label, epoch: this.epoch, ...fields })); }
    catch { this.seal('TRACE', false); }
  }
  seal(reason, notify = true) {
    if (this.terminal) return;
    this.terminal = reason; this.ready = 'closed'; this.phase = 'closed';
    this.pending?.reject(error(reason));
    if (notify) this.emit('terminal', { reason });
    this.onTerminal();
  }
  physical(socket = this.socket) {
    let current;
    try { current = this.currentSocket(); } catch { this.seal('SOCKET_IDENTITY'); return false; }
    if (this.terminal || socket !== this.socket || current !== this.socket || this.socket.destroyed) {
      this.seal('SOCKET_IDENTITY'); return false;
    }
    return true;
  }
  connect(path) {
    if (!this.physical() || ++this.connects !== 1 || this.phase !== 'new'
      || path !== LAB_CONFIG.host + '/.s.PGSQL.' + LAB_CONFIG.port) {
      this.seal('RECONNECT'); throw error('RECONNECT');
    }
    this.phase = 'connecting'; this.emit('socket-connect-attempt', { attempt: this.connects });
  }
  connected() {
    if (!this.physical() || this.phase !== 'connecting') { this.seal('CONNECT_EVENT'); return; }
    this.emit('socket-connect');
  }
  begin(text, internal = false) {
    if (!this.physical() || this.phase !== 'ready' || !['I', 'T'].includes(this.ready)) {
      this.seal('PREQUERY_STATE'); throw error('TERMINAL');
    }
    if (this.pending) { this.seal('CONCURRENT_QUERY'); throw error('CONCURRENT_QUERY'); }
    demand(typeof text === 'string' && text.length > 0 && Buffer.byteLength(text) <= 65536, 'QUERY_TEXT');
    const ordinal = internal ? 0 : ++this.ordinal;
    if (!internal && this.fault.beforeQuery === ordinal) {
      this.seal('INJECTED_BEFORE_QUERY'); throw error('INJECTED_BEFORE_QUERY');
    }
    const pending = { ordinal, internal, hash: digest(text), commands: 0, readySeen: false, frames: {} };
    pending.failure = new Promise((_, reject) => { pending.reject = reject; });
    pending.failure.catch(() => {});
    this.pending = pending;
    this.emit('query-admitted', { queryOrdinal: ordinal, queryHash: pending.hash, internal });
    demand(!this.terminal, 'TERMINAL');
    return pending;
  }
  beforeWrite(socket, buffer) {
    if (!this.physical(socket)) return false;
    const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const wireType = bytes[0] === 0 ? 'startup' : String.fromCharCode(bytes[0]);
    if (this.phase === 'connecting') {
      if (!['startup', 'p'].includes(wireType)) { this.seal('STARTUP_WRITE'); return false; }
    } else {
      const pending = this.pending;
      if (!pending || pending.readySeen || !['P', 'B', 'D', 'E', 'S', 'H', 'C'].includes(wireType)) {
        this.seal('UNADMITTED_WRITE'); return false;
      }
      pending.frames[wireType] = (pending.frames[wireType] || 0) + 1;
      if (pending.frames[wireType] > 1) { this.seal('REPEATED_PROTOCOL_WRITE'); return false; }
    }
    this.emit('socket-write', { queryOrdinal: this.pending?.ordinal ?? null, bytes: bytes.length, wireType });
    return !this.terminal;
  }
  message(message) {
    if (this.terminal) {
      // Evidence only: this does not admit a protocol cycle or restore readiness.
      if (message.name === 'readyForQuery' && ['I', 'T', 'E'].includes(message.status)) {
        this.emit('protocol-ready-ignored', { queryOrdinal: this.pending?.ordinal ?? null, status: message.status });
      }
      return;
    }
    if (!this.physical()) return;
    if (message.name === 'error') {
      this.emit('protocol-error', { queryOrdinal: this.pending?.ordinal ?? null,
        sqlstate: typeof message.code === 'string' && /^[0-9A-Z]{5}$/.test(message.code) ? message.code : null });
      this.seal('PROTOCOL_ERROR'); return;
    }
    if (['portalSuspended', 'copyInResponse', 'copyOutResponse', 'copyData', 'emptyQuery'].includes(message.name)) {
      this.seal('PROTOCOL_ERROR'); return;
    }
    if (message.name === 'commandComplete') {
      const pending = this.pending;
      if (!pending || ++pending.commands !== 1) { this.seal('COMMAND_SEQUENCE'); return; }
      try { pending.command = commandTag(message.text); } catch { this.seal('COMMAND_TAG'); return; }
      this.emit('protocol-command', { queryOrdinal: pending.ordinal, tag: message.text, ...pending.command });
      if (pending.command.command === 'COMMIT') {
        this.commits++;
        if (this.fault.closeAfterCommitCommand === this.commits) this.seal('INJECTED_COMMIT_BOUNDARY');
      }
    } else if (message.name === 'readyForQuery') {
      if (!['I', 'T', 'E'].includes(message.status)) { this.seal('READY_STATUS'); return; }
      if (message.status === 'E') { this.seal('READY_ERROR'); return; }
      if (this.phase === 'connecting' && !this.pending) {
        if (message.status !== 'I') { this.seal('INITIAL_READY'); return; }
        this.phase = 'ready'; this.ready = 'I'; this.emit('protocol-ready', { queryOrdinal: null, status: 'I' });
        return;
      }
      const pending = this.pending;
      if (!pending || pending.readySeen || pending.commands !== 1 || !pending.command) {
        this.seal('READY_SEQUENCE'); return;
      }
      pending.readySeen = true; this.ready = message.status;
      this.emit('protocol-ready', { queryOrdinal: pending.ordinal, status: message.status });
    }
  }
  finish(pending, result) {
    if (!this.physical() || this.pending !== pending || !pending.readySeen || pending.commands !== 1
      || ['P', 'B', 'D', 'E', 'S'].some(type => pending.frames[type] !== 1)
      || !result || Array.isArray(result) || !Array.isArray(result.rows)
      || result.command !== pending.command.command
      || (pending.command.counter ? result.rowCount !== pending.command.rowCount
        : result.rowCount !== null || result.rows.length !== 0)) {
      this.seal('RESULT'); throw error('RESULT');
    }
    this.pending = null;
    this.emit('query-complete', { queryOrdinal: pending.ordinal, command: pending.command.command,
      rowCount: pending.command.rowCount, status: this.ready });
    demand(!this.terminal, 'TERMINAL');
    return { command: pending.command.command, rowCount: pending.command.rowCount, rows: result.rows };
  }
}

function guardedWrite(state, socket, buffer, write) {
  if (!state.beforeWrite(socket, buffer)) return false;
  try { return write(); } catch { state.seal('WRITE'); return false; }
}

const nativeSocketWrite = Socket.prototype.write;
class LabSocket extends Socket {
  #state;
  #barrier;
  constructor(getState) {
    super({ allowHalfOpen: false });
    this.#state = getState;
  }
  connect(path, ...rest) {
    const state = this.#state();
    state.connect(path);
    // Node 26.13.0 net.connect() resets this.write to Socket.prototype.write.
    // Install the own-property barrier after that reset, before its asynchronous
    // connect event can let pg send StartupMessage. Never rely on a prototype override.
    const connected = super.connect(path, ...rest);
    const write = (buffer, ...args) => guardedWrite(state, this, buffer,
      () => Reflect.apply(nativeSocketWrite, this, [buffer, ...args]));
    const get = () => write;
    // Node also assigns writeAfterFIN on peer EOF. Seal without an uncaught
    // readonly-property exception; the guarded writer remains installed forever.
    const set = () => state.seal('WRITE_REPLACED');
    Object.defineProperty(this, 'write', { get, set, configurable: false, enumerable: false });
    this.#barrier = { write, get, set };
    if (!this.writeBarrierIntact()) { state.seal('WRITE_BARRIER'); throw error('WRITE_BARRIER'); }
    return connected;
  }
  writeBarrierIntact() {
    const field = Object.getOwnPropertyDescriptor(this, 'write');
    return !!this.#barrier && field?.configurable === false && field.enumerable === false
      && field.get === this.#barrier.get && field.set === this.#barrier.set
      && this.write === this.#barrier.write && Socket.prototype.write === nativeSocketWrite;
  }
}

export async function createLabWire({ config, label, trace = () => {}, fault } = {}) {
  const faults = inputs({ config, label, trace, fault }, process.env);
  const require = createRequire(import.meta.url);
  demand(require('./deps/node_modules/pg/package.json').version === '8.23.1', 'PG_VERSION');
  const { Client } = require('./deps/node_modules/pg/lib/index.js');
  let state, client, identity, started = false, socketClosed = false, clientEnded = false, closePromise;
  const socket = new LabSocket(() => state);
  state = new ProtocolState({ socket, currentSocket: () => client?.connection.stream ?? socket,
    label, trace, fault: faults, onTerminal: () => socket.destroy() });
  const socketDone = new Promise(resolve => socket.once('close', () => { socketClosed = true; state.seal('SOCKET_CLOSED'); state.emit('socket-close'); resolve(); }));
  socket.on('error', () => state.seal('SOCKET_ERROR'));
  socket.on('connect', () => {
    if (!socket.writeBarrierIntact()) { state.seal('WRITE_BARRIER'); return; }
    state.connected();
  });
  client = new Client({ host: LAB_CONFIG.host, port: LAB_CONFIG.port, database: LAB_CONFIG.database,
    user: LAB_CONFIG.sessionUser, password: 'SYNTHETIC_LAB_UNUSED', ssl: false, stream: socket,
    pipeline: false, application_name: 'synthetic_wire_' + label,
    connectionTimeoutMillis: 5000, statement_timeout: 20000, query_timeout: 0 });
  const clientDone = new Promise(resolve => client.once('end', () => { clientEnded = true; resolve(); }));
  client.on('error', () => state.seal('CLIENT_ERROR'));
  // Connection emits generic message BEFORE its specific client handler. Do not move to a late listener.
  client.connection.on('message', message => { try { state.message(message); } catch { state.seal('PROTOCOL'); } });

  function idleClient() {
    if (!state.physical() || !socket.writeBarrierIntact() || client.pipeline !== false || client.connection.stream !== socket
      || client._getActiveQuery() != null || client._queryQueue.length !== 0 || client._sentQueryQueue.length !== 0
      || client.getTransactionStatus() !== state.ready) {
      state.seal('CLIENT_STATE'); throw error('CLIENT_STATE');
    }
  }
  async function query(text, values = [], internal = false) {
    let pending, timer;
    try {
      demand(!state.terminal, 'TERMINAL');
      if (state.pending) { state.seal('CONCURRENT_QUERY'); throw error('CONCURRENT_QUERY'); }
      idleClient();
      const copied = parameters(values);
      pending = state.begin(text, internal);
      timer = setTimeout(() => state.seal('QUERY_TIMEOUT'), 20000);
      const result = await Promise.race([
        client.query({ text, values: copied, queryMode: 'extended' }), pending.failure,
      ]);
      const decoded = state.finish(pending, result);
      idleClient();
      return decoded;
    } catch (cause) {
      state.seal('QUERY_FAILED');
      throw error(cause?.code?.startsWith('HOLD_LAB_') ? cause.code.slice(9) : 'QUERY_FAILED');
    } finally { clearTimeout(timer); }
  }
  async function close() {
    if (!closePromise) closePromise = (async () => {
      state.seal('CLOSE'); socket.destroy();
      let timer;
      try {
        await Promise.race([
          Promise.all([socketDone, ...(started ? [clientDone] : [])]),
          new Promise((_, reject) => { timer = setTimeout(() => reject(error('CLEANUP_UNCONFIRMED')), 5000); }),
        ]);
        demand(socketClosed && (!started || clientEnded) && socket.destroyed, 'CLEANUP_UNCONFIRMED');
        state.emit('close-confirmed');
      } finally { clearTimeout(timer); }
    })();
    return closePromise;
  }
  try {
    demand(client.connection.stream === socket && client.pipeline === false, 'CLIENT_SHAPE');
    started = true;
    await client.connect();
    const response = await query(IDENTITY_SQL, [], true);
    demand(response.command === 'SELECT' && response.rowCount === 1 && response.rows.length === 1, 'IDENTITY');
    const row = response.rows[0];
    demand(typeof row.backend_pid === 'string' && /^[1-9][0-9]*$/.test(row.backend_pid)
      && row.backend_pid === String(client.processID) && typeof row.backend_start === 'string' && row.backend_start.length > 0
      && row.database === LAB_CONFIG.database && row.session_user === LAB_CONFIG.sessionUser, 'IDENTITY');
    identity = Object.freeze({ socketEpoch: state.epoch, backendPid: row.backend_pid, backendStart: row.backend_start,
      database: row.database, sessionUser: row.session_user });
    return Object.freeze({
      metadata() {
        state.physical();
        return Object.freeze({ ...identity, ready: state.ready, exclusive: true, noReconnect: true, noReplay: true });
      },
      query: (text, values) => query(text, values), close,
    });
  } catch (cause) {
    state.seal('OPEN_FAILED');
    try { await close(); } catch { throw error('OPEN_CLEANUP_UNCONFIRMED'); }
    throw error(cause?.code?.startsWith('HOLD_LAB_') ? cause.code.slice(9) : 'OPEN_FAILED');
  }
}

export const _labTest = Object.freeze({ ProtocolState, LabSocket, commandTag, guardedWrite, inputs, parameters });
