/** Synthetic protocol double only. This proves no PostgreSQL, ACL or durability property. */
import {syntheticSnapshots, id, syntheticIssuance} from '../demo-authority-bridge-review/synthetic-fixtures.mjs';
import {SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/store.mjs';
import {ISSUE_SQL} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {READ_AUTHORITY_SQL} from '../../../docs/review/demo-authority-provider-entry-20261016/authority-provider.mjs';
import {READ_ISSUANCE_SQL, AUTHORITY_ISOLATION_SQL} from '../../../docs/review/demo-authority-provider-entry-20261016/issuer-entry.mjs';

export {syntheticSnapshots, id, syntheticIssuance};
export const config = Object.freeze({deployment: 'SYNTHETIC_DEPLOYMENT', database: 'SYNTHETIC_DATABASE',
  sessionUser: 'SYNTHETIC_SQL_OWNER', durabilityEvidence: 'SYNTHETIC_NOT_CERTIFIED', driverEvidence: 'SYNTHETIC_NOT_CERTIFIED'});
export const request = () => ({contextId: id(8)});

export function syntheticWire(options = {}) {
  let ready = 'I', closed = false, issued;
  const calls = [], events = [], metadata = {
    socketEpoch: 'SYNTHETIC_SOCKET', backendPid: 111, backendStart: 'SYNTHETIC_START',
    database: config.database, sessionUser: config.sessionUser,
    exclusive: true, noReconnect: true, noReplay: true,
  };
  return {
    calls, events, metadataState: metadata,
    get closed() { return closed; },
    metadata() { return {...metadata, ready: closed ? 'closed' : ready}; },
    async query(sql, parameters) {
      calls.push({sql, parameters: structuredClone(parameters)}); events.push(sql);
      if (options.beforeQuery) await options.beforeQuery(sql, parameters, metadata);
      if (options.rejectSQL === sql) throw Error('SYNTHETIC_PROTOCOL_FAILURE');
      let result;
      if (sql === SQL.begin) { ready = 'T'; result = {command: 'BEGIN', rowCount: 0, rows: []}; }
      else if (sql === SQL.durable || sql === AUTHORITY_ISOLATION_SQL) result = {command: 'SET', rowCount: 0, rows: []};
      else if (sql === READ_AUTHORITY_SQL) {
        result = {command: 'SELECT', rowCount: 1, rows: [{authority: structuredClone(options.snapshots ?? syntheticSnapshots())}]};
      } else if (sql === ISSUE_SQL) {
        const p = parameters;
        issued = {canonicalVersion: 1, deployment: p[0], obligationId: p[1], tenant: p[2],
          manifestIdentity: p[3], schedulerJob: p[4], authorizedOccurrence: p[5], contextId: p[6], binding: JSON.parse(p[7])};
        const rows = options.existing ? [] : [{obligation_id: p[1]}];
        result = {command: 'INSERT', rowCount: rows.length, rows};
      } else if (sql === READ_ISSUANCE_SQL) {
        const rows = structuredClone(options.history ?? [issued]);
        if (options.mutateHistory) options.mutateHistory(rows);
        result = {command: 'SELECT', rowCount: rows.length, rows};
      } else if (sql === SQL.commit) {
        ready = 'I'; result = {command: 'COMMIT', rowCount: 0, rows: []};
      } else throw Error('SYNTHETIC_UNEXPECTED_SQL');
      if (options.mutateResult) options.mutateResult(sql, result, metadata);
      return result;
    },
    async close() { closed = true; events.push('CLOSE'); if (options.closeError) throw Error('SYNTHETIC_CLOSE_FAILURE'); },
  };
}
