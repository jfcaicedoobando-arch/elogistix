/**
 * NOT_ADMITTED. Review-only issuance transaction, with no connection factory,
 * endpoint, credentials, grants, dispatch, ingress or business integration.
 * A successful result records issuance only and NEVER grants execution rights.
 */
import {dedicatedDriver, EMPTY_CONFIG} from '../demo-durable-owner-adapter-20261015/driver.mjs';
import {createIssuer, ISSUE_SQL} from '../demo-durable-owner-adapter-20261015/issuer.mjs';
import {SQL} from '../demo-durable-owner-adapter-20261015/store.mjs';
import {createAuthorityProvider} from './authority-provider.mjs';
import {classifyDeclaredIssuance} from '../../../scripts/ci/demo-authority-bridge-review/contract.mjs';

// Read only the three unique-key collision domains. Fixed SQL, derived parameters.
// FOR SHARE keeps the inspected records stable until this transaction completes.
export const READ_ISSUANCE_SQL = `SELECT canonical_version AS "canonicalVersion",
 deployment, obligation_id::text AS "obligationId", tenant_id AS tenant,
 manifest_identity AS "manifestIdentity", scheduler_job_identity AS "schedulerJob",
 authorized_occurrence AS "authorizedOccurrence", context_id::text AS "contextId", binding
 FROM demo_owner_review.issuer_obligations
 WHERE deployment=$1 AND (obligation_id=$2::uuid OR context_id=$7::uuid
 OR (tenant_id=$3 AND manifest_identity=$4 AND scheduler_job_identity=$5 AND authorized_occurrence=$6))
 FOR SHARE`;
export const AUTHORITY_ISOLATION_SQL = 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const fail = code => { throw Error(code); };
const answer = outcome => Object.freeze({outcome, executionPermission: false, admission: 'NOT_ADMITTED'});

function contextReference(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(request))
      || Reflect.ownKeys(request).length !== 1 || !Object.hasOwn(request, 'contextId')) fail('HOLD_REQUEST');
  const descriptor = Object.getOwnPropertyDescriptor(request, 'contextId');
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable
      || typeof descriptor.value !== 'string' || !uuid.test(descriptor.value)) fail('HOLD_REQUEST');
  return descriptor.value;
}

async function command(driver, sql, before, after, verb) {
  const result = await driver.query(sql, [], before, after, verb);
  if (result.rowCount !== 0 || result.rows.length !== 0) fail('HOLD_COMMAND_ACK');
}

function proposal(envelope) {
  const p = envelope.parameters;
  return {canonicalVersion: 1, deployment: p[0], obligationId: envelope.obligationId,
    tenant: p[2], manifestIdentity: p[3], schedulerJob: p[4], authorizedOccurrence: p[5],
    contextId: p[6], binding: JSON.parse(p[7])};
}

/** openWire and configuration are trusted, unimplemented deployment boundaries.
 * SQL18 authenticates the session and resolves protected evidence; no caller
 * claims, snapshots, flags or authentication boolean are accepted by issue().
 * On any uncertain ACK, destroy the socket and quarantine. Never reconnect,
 * replay, retry COMMIT, or recover success by reading the ledger elsewhere.
 * This in-memory latch does not provide durable quarantine across processes;
 * that independent admission prerequisite remains unimplemented.
 */
export function createIssuerEntry({config = EMPTY_CONFIG, openWire} = {}) {
  config = Object.freeze({...config});
  let active = false, quarantined = false;
  return Object.freeze({async issue(request) {
    if (active || quarantined) return answer('quarantine');
    active = true;
    let driver, wire, protocolAttempted = false, result = answer('quarantine');
    try {
      if (arguments.length !== 1) fail('HOLD_REQUEST');
      const contextId = contextReference(request);
      if (Object.keys(EMPTY_CONFIG).some(key => typeof config[key] !== 'string' || !config[key].trim())
          || typeof openWire !== 'function') fail('HOLD_CONFIGURATION');
      protocolAttempted = true;
      wire = await openWire();
      driver = dedicatedDriver(wire, config);
      await command(driver, SQL.begin, 'I', 'T', 'BEGIN');
      await command(driver, AUTHORITY_ISOLATION_SQL, 'T', 'T', 'SET');
      await command(driver, SQL.durable, 'T', 'T', 'SET');
      const resolver = createAuthorityProvider(driver, config.deployment);
      // Unchanged authentic algorithm: no alternate digest or caller overrides.
      const envelope = await createIssuer(resolver, config.deployment).derive(contextId);
      const inserted = await driver.query(ISSUE_SQL, envelope.parameters, 'T', 'T', 'INSERT');
      if (inserted.rowCount !== inserted.rows.length || inserted.rows.length > 1) fail('HOLD_ISSUANCE_RESULT');
      const didInsert = inserted.rows.length === 1;
      if (didInsert) {
        const row = inserted.rows[0];
        if (!row || Reflect.ownKeys(row).length !== 1 || !Object.hasOwn(row, 'obligation_id')
            || row.obligation_id !== envelope.obligationId) fail('HOLD_ISSUANCE_RESULT');
      }
      const history = await driver.query(READ_ISSUANCE_SQL, envelope.parameters.slice(0, 7), 'T', 'T', 'SELECT');
      if (history.rowCount !== history.rows.length || history.rows.length < 1 || history.rows.length > 3) {
        fail('HOLD_ISSUANCE_HISTORY');
      }
      const comparison = classifyDeclaredIssuance(proposal(envelope), history.rows);
      if (comparison.classification === 'CONFLICT') {
        // Closing this dedicated socket aborts the transaction; no COMMIT.
        result = answer('conflict');
      } else {
        if (comparison.classification !== 'IDENTICAL_RECORD_ONLY') fail('HOLD_ISSUANCE_HISTORY');
        await command(driver, SQL.commit, 'T', 'I', 'COMMIT');
        result = answer(didInsert ? 'issuance_commit_acknowledged' : 'identical_record_only');
      }
    } catch {
      // Terminal for this instance: no later invocation may open a new wire to
      // infer recovery from a ledger row after an uncertain operation.
      quarantined ||= protocolAttempted;
      result = answer('quarantine');
    } finally {
      try {
        if (driver) await driver.close();
        else if (wire) await wire.close();
      } catch {
        quarantined = true;
        result = Object.freeze({...answer('quarantine'), cleanup: 'unconfirmed'});
      }
      active = false;
    }
    return result;
  }});
}
