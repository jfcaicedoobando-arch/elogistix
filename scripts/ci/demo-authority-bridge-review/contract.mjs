/**
 * OFFLINE REVIEW CONTRACT ONLY. No provider, authentication, SQL or registration.
 * Inputs are declared pre-verified projections, not proof of verification. An
 * attacker can construct an internally consistent input. Never expose this as a
 * resolver, businessGuard, endpoint or authorization boundary.
 */
const fail = code => { throw Error(code); };
const requireThat = (condition, code) => { if (!condition) fail(code); };
const literal = expected => value => value === expected;
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256
  && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
const job = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
const sha256 = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
const positive = value => integer(value) && value > 0;
const oid = value => positive(value) && value <= 4294967295;
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const optionalInstant = value => value === null || instant(value);

// JSON data only: no inherited fields, symbols, nonenumerables or getters. The
// normalized copy follows schema order, so JS insertion order cannot rebind JSONB.
function exact(value, schema, path) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'HOLD_SCHEMA:' + path);
  const keys = Reflect.ownKeys(value);
  requireThat(keys.length === Object.keys(schema).length
    && keys.every(key => typeof key === 'string' && Object.hasOwn(schema, key)), 'HOLD_SCHEMA:' + path);
  const result = {};
  for (const [key, rule] of Object.entries(schema)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireThat(descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'HOLD_SCHEMA:' + path + '.' + key);
    const item = descriptor.value;
    if (typeof rule === 'function') {
      requireThat(rule(item), 'HOLD_SCHEMA:' + path + '.' + key);
      result[key] = item;
    } else result[key] = exact(item, rule, path + '.' + key);
  }
  return Object.freeze(result);
}

const transport = {
  id: uuid, ownerOid: oid, loginRoleOid: oid, technicalRoleOid: oid,
  tenant: uuid, approvedByOwner: oid, validUntil: instant, disabledAt: optionalInstant,
};
const scheduler = {
  id: uuid, transportId: uuid, jobId: job, sponsorUserId: uuid, tenant: uuid,
  manifestVersion: text, manifestSha256: sha256, approvedByOwner: oid,
  validUntil: instant, disabledAt: optionalInstant,
};
const admission = {
  id: uuid, schedulerApprovalId: uuid, schedulerSnapshot: scheduler, transportSnapshot: transport,
  admittedByOwner: oid, reviewReference: text,
  originKind: literal('owner_reviewed_existing_fixture_ids'), validUntil: instant,
};
const preparation = {
  id: uuid, admissionId: uuid, receiptId: uuid, schedulerApprovalId: uuid,
  producedByOwner: oid, initiatorKind: literal('scheduler'), initiatorJobId: text,
  tenant: uuid, manifestVersion: text, manifestSha256: sha256,
  sourceVersion: text, sourceSha256: sha256, clientBindingsSha256: sha256,
};
const receipt = {
  id: uuid, sourceRunId: uuid, tenant: uuid, manifestVersion: text, manifestSha256: sha256,
  sourceVersion: text, sourceSha256: sha256, clientBindingsSha256: sha256,
};
const server = {
  contextId: uuid, schedulerApprovalId: uuid, transportId: uuid, runId: uuid, lineageId: uuid,
  schedulerSnapshot: scheduler, transportSnapshot: transport, identityReceiptId: uuid,
  identityVersion: text, identitySha256: sha256, issuedByOwner: oid,
  issuedAt: instant, notBefore: instant, expiresAt: instant,
};
const context = {
  contextId: uuid, runId: uuid, lineageId: uuid, tenant: uuid, purpose: literal('initial'),
  manifestVersion: text, manifestSha256: sha256, identityReceiptId: uuid,
  identityVersion: text, identitySha256: sha256, sessionPrincipal: text,
  initiatorKind: literal('scheduler'), initiatorJobId: text, initiatorUserId: literal(null),
  notBefore: instant, expiresAt: instant,
};
// This required protected record DOES NOT EXIST in the current registry. Its
// persistence, writer isolation, separate occurrence authorization and restore
// fence enforcement remain unimplemented, not supplied by these JS fields.
const authority = {
  recordId: text, deployment: text, tenant: uuid, manifestIdentity: text,
  schedulerApprovalId: uuid, schedulerJob: text, authorizedOccurrence: text,
  preparationAdmissionId: uuid, receiptId: uuid, skipMs: integer,
  generation: positive, restoreFence: text, notBefore: instant, expiresAt: instant,
  revokedAt: optionalInstant,
};
const restore = {deployment: text, generation: positive, fence: text};
const chain = {
  schedulerApproval: scheduler, transportApproval: transport,
  preparationAdmission: admission, preparationRun: preparation, receipt,
  serverAdmission: server, serverContext: context, protectedAuthority: authority,
};
const snapshots = {
  schemaVersion: literal(1), declaration: literal('PREVERIFIED_PROJECTIONS_NOT_AUTHENTICATION'),
  deployment: text, observedAt: instant, restoreState: restore, ...chain,
};
const bindingSchema = {
  schemaVersion: literal(1), contract: literal('OFFLINE_SCHEDULER_BINDING_REVIEW_V1'),
  deployment: text, tenant: uuid, manifestIdentity: text, schedulerJob: text,
  authorizedOccurrence: text, contextId: uuid, skipMs: integer,
  generation: positive, restoreFence: text, ...chain,
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const allEqual = (...values) => values.every(value => same(value, values[0]));

function correspondence(b) {
  const s = b.schedulerApproval, t = b.transportApproval, a = b.preparationAdmission;
  const p = b.preparationRun, r = b.receipt, c = b.serverAdmission, x = b.serverContext, u = b.protectedAuthority;
  requireThat(allEqual(b.deployment, u.deployment), 'HOLD_DEPLOYMENT_CHAIN');
  requireThat(allEqual(b.tenant, s.tenant, t.tenant, p.tenant, r.tenant, x.tenant, u.tenant), 'HOLD_TENANT_CHAIN');
  requireThat(allEqual(s.id, a.schedulerApprovalId, p.schedulerApprovalId, c.schedulerApprovalId, u.schedulerApprovalId), 'HOLD_SCHEDULER_CHAIN');
  requireThat(allEqual(t.id, s.transportId, c.transportId), 'HOLD_TRANSPORT_CHAIN');
  requireThat(allEqual(s, a.schedulerSnapshot, c.schedulerSnapshot)
    && allEqual(t, a.transportSnapshot, c.transportSnapshot), 'HOLD_POLICY_SNAPSHOT_CHAIN');
  requireThat(allEqual(t.ownerOid, t.approvedByOwner, s.approvedByOwner, a.admittedByOwner, p.producedByOwner, c.issuedByOwner), 'HOLD_OWNER_CHAIN');
  requireThat(allEqual(b.schedulerJob, s.jobId, p.initiatorJobId, x.initiatorJobId, u.schedulerJob), 'HOLD_JOB_CHAIN');
  requireThat(allEqual(a.id, p.admissionId, u.preparationAdmissionId), 'HOLD_PREPARATION_CHAIN');
  requireThat(allEqual(r.id, p.receiptId, c.identityReceiptId, x.identityReceiptId, u.receiptId), 'HOLD_RECEIPT_CHAIN');
  requireThat(p.id === r.sourceRunId, 'HOLD_SOURCE_RUN_CHAIN');
  requireThat(allEqual(s.manifestVersion, p.manifestVersion, r.manifestVersion, x.manifestVersion)
    && allEqual(s.manifestSha256, p.manifestSha256, r.manifestSha256, x.manifestSha256), 'HOLD_MANIFEST_ARTIFACT_CHAIN');
  requireThat(allEqual(p.sourceVersion, r.sourceVersion, c.identityVersion, x.identityVersion)
    && allEqual(p.sourceSha256, r.sourceSha256, c.identitySha256, x.identitySha256)
    && p.clientBindingsSha256 === r.clientBindingsSha256, 'HOLD_RECEIPT_CONTENT_CHAIN');
  requireThat(allEqual(b.contextId, c.contextId, x.contextId)
    && c.runId === x.runId && c.lineageId === x.lineageId
    && c.notBefore === x.notBefore && c.expiresAt === x.expiresAt, 'HOLD_CONTEXT_CHAIN');
  requireThat(b.manifestIdentity === u.manifestIdentity && b.authorizedOccurrence === u.authorizedOccurrence
    && b.skipMs === u.skipMs && b.generation === u.generation && b.restoreFence === u.restoreFence, 'HOLD_PROTECTED_BINDING');
  // Ordering is consistency only. No TTL, source UUID, digest or sponsor establishes authority.
  requireThat(c.issuedAt === c.notBefore && c.notBefore < c.expiresAt
    && Date.parse(c.expiresAt) - Date.parse(c.issuedAt) <= 300_000
    && u.notBefore < u.expiresAt && c.notBefore >= u.notBefore
    && c.expiresAt <= u.expiresAt && c.expiresAt <= s.validUntil
    && c.expiresAt <= t.validUntil && c.expiresAt <= a.validUntil, 'HOLD_VALIDITY_CHAIN');
}

export function validateBinding(value) {
  const result = exact(value, bindingSchema, 'binding');
  correspondence(result);
  return result;
}

/** Pure projection of declared verified snapshots. It grants NO capability. */
export function mapDeclaredVerifiedSnapshots(value) {
  requireThat(arguments.length === 1, 'HOLD_CALLER_OVERRIDE');
  const e = exact(value, snapshots, 'snapshots');
  const u = e.protectedAuthority, c = e.serverAdmission;
  const binding = validateBinding({
    schemaVersion: 1, contract: 'OFFLINE_SCHEDULER_BINDING_REVIEW_V1', deployment: e.deployment,
    tenant: u.tenant, manifestIdentity: u.manifestIdentity, schedulerJob: u.schedulerJob,
    authorizedOccurrence: u.authorizedOccurrence, contextId: c.contextId, skipMs: u.skipMs,
    generation: u.generation, restoreFence: u.restoreFence,
    ...Object.fromEntries(Object.keys(chain).map(key => [key, e[key]])),
  });
  requireThat(e.restoreState.deployment === e.deployment && e.restoreState.generation === u.generation
    && e.restoreState.fence === u.restoreFence, 'HOLD_RESTORE_FENCE');
  requireThat(e.schedulerApproval.disabledAt === null && e.transportApproval.disabledAt === null
    && u.revokedAt === null, 'HOLD_DECLARED_REVOCATION');
  requireThat(e.observedAt >= c.notBefore && e.observedAt < c.expiresAt, 'HOLD_DECLARED_VALIDITY');
  return Object.freeze({tenant: u.tenant, manifestIdentity: u.manifestIdentity,
    schedulerJob: u.schedulerJob, authorizedOccurrence: u.authorizedOccurrence,
    contextId: c.contextId, binding});
}

// Exact immutable ledger-row projection for review. Only createIssuer computes
// the obligation ID in tests; no second digest or collision-resolution algorithm.
const recordSchema = {
  canonicalVersion: literal(1), deployment: text, obligationId: uuid, tenant: uuid,
  manifestIdentity: text, schedulerJob: text, authorizedOccurrence: text,
  contextId: uuid, binding: bindingSchema,
};
const naturalKey = r => JSON.stringify([1, r.deployment, r.tenant, r.manifestIdentity, r.schedulerJob, r.authorizedOccurrence]);
function record(value) {
  const r = exact(value, recordSchema, 'issuance');
  correspondence(r.binding);
  for (const key of ['deployment', 'tenant', 'manifestIdentity', 'schedulerJob', 'authorizedOccurrence', 'contextId']) {
    requireThat(r[key] === r.binding[key], 'HOLD_ISSUANCE_BINDING:' + key);
  }
  return r;
}

/** Classifies a DECLARED history snapshot; absence/exact match never permits INSERT or business. */
export function classifyDeclaredIssuance(proposal, history) {
  const p = record(proposal);
  requireThat(Array.isArray(history), 'HOLD_HISTORY_SCHEMA');
  const rows = history.map(record);
  for (const key of [naturalKey, r => JSON.stringify([r.deployment, r.contextId]),
    r => JSON.stringify([r.deployment, r.obligationId])]) {
    requireThat(new Set(rows.map(key)).size === rows.length, 'HOLD_HISTORY_AMBIGUOUS');
  }
  const conflicts = new Set();
  let exactMatch = false;
  for (const r of rows.filter(row => row.deployment === p.deployment)) {
    const natural = naturalKey(r) === naturalKey(p);
    if (natural) {
      if (r.obligationId !== p.obligationId) conflicts.add('NATURAL_KEY_ID_MISMATCH');
      if (r.contextId !== p.contextId) conflicts.add('NATURAL_KEY_CONTEXT_CONFLICT');
      if (!same(r.binding, p.binding)) conflicts.add('NATURAL_KEY_BINDING_CONFLICT');
      if (same(r, p)) exactMatch = true;
    } else {
      if (r.contextId === p.contextId) conflicts.add('CONTEXT_REUSE_CONFLICT');
      if (r.obligationId === p.obligationId) conflicts.add('OBLIGATION_ID_COLLISION');
    }
  }
  return Object.freeze({
    classification: conflicts.size ? 'CONFLICT' : exactMatch ? 'IDENTICAL_RECORD_ONLY' : 'NO_CONFLICT_IN_DECLARED_SNAPSHOT',
    conflicts: Object.freeze([...conflicts].sort()), executionPermission: false,
  });
}
