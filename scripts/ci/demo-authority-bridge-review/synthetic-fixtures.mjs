/** ALL VALUES AND VERIFICATION CLAIMS HERE ARE SYNTHETIC. No real principal or authority. */
import {createIssuer} from '../../../docs/review/demo-durable-owner-adapter-20261015/issuer.mjs';
import {mapDeclaredVerifiedSnapshots} from './contract.mjs';

export const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export function syntheticSnapshots() {
  const schedulerApproval = {
    id: id(2), transportId: id(3), jobId: 'SYNTHETIC_JOB', sponsorUserId: id(4), tenant: id(1),
    manifestVersion: 'SYNTHETIC_ARTIFACT_V1', manifestSha256: 'a'.repeat(64), approvedByOwner: 41001,
    validUntil: '2030-01-01T00:10:00.000Z', disabledAt: null,
  };
  const transportApproval = {
    id: id(3), ownerOid: 41001, loginRoleOid: 41002, technicalRoleOid: 41003, tenant: id(1),
    approvedByOwner: 41001, validUntil: '2030-01-01T00:10:00.000Z', disabledAt: null,
  };
  const snapshots = {
    schemaVersion: 1, declaration: 'PREVERIFIED_PROJECTIONS_NOT_AUTHENTICATION',
    deployment: 'SYNTHETIC_DEPLOYMENT', observedAt: '2030-01-01T00:00:10.000Z',
    restoreState: {deployment: 'SYNTHETIC_DEPLOYMENT', generation: 1, fence: 'SYNTHETIC_FENCE_A'},
    schedulerApproval, transportApproval,
    preparationAdmission: {
      id: id(5), schedulerApprovalId: id(2), schedulerSnapshot: structuredClone(schedulerApproval),
      transportSnapshot: structuredClone(transportApproval), admittedByOwner: 41001,
      reviewReference: 'SYNTHETIC_REVIEW_ONLY', originKind: 'owner_reviewed_existing_fixture_ids',
      validUntil: '2030-01-01T00:10:00.000Z',
    },
    preparationRun: {
      id: id(6), admissionId: id(5), receiptId: id(7), schedulerApprovalId: id(2), producedByOwner: 41001,
      initiatorKind: 'scheduler', initiatorJobId: 'SYNTHETIC_JOB', tenant: id(1),
      manifestVersion: schedulerApproval.manifestVersion, manifestSha256: schedulerApproval.manifestSha256,
      sourceVersion: 'SYNTHETIC_SOURCE_V1', sourceSha256: 'b'.repeat(64), clientBindingsSha256: 'c'.repeat(64),
    },
    receipt: {
      id: id(7), sourceRunId: id(6), tenant: id(1),
      manifestVersion: schedulerApproval.manifestVersion, manifestSha256: schedulerApproval.manifestSha256,
      sourceVersion: 'SYNTHETIC_SOURCE_V1', sourceSha256: 'b'.repeat(64), clientBindingsSha256: 'c'.repeat(64),
    },
    serverAdmission: {
      contextId: id(8), schedulerApprovalId: id(2), transportId: id(3), runId: id(9), lineageId: id(10),
      schedulerSnapshot: structuredClone(schedulerApproval), transportSnapshot: structuredClone(transportApproval),
      identityReceiptId: id(7), identityVersion: 'SYNTHETIC_SOURCE_V1', identitySha256: 'b'.repeat(64),
      issuedByOwner: 41001, issuedAt: '2030-01-01T00:00:00.000Z', notBefore: '2030-01-01T00:00:00.000Z',
      expiresAt: '2030-01-01T00:02:00.000Z',
    },
    serverContext: {
      contextId: id(8), runId: id(9), lineageId: id(10), tenant: id(1), purpose: 'initial',
      manifestVersion: schedulerApproval.manifestVersion, manifestSha256: schedulerApproval.manifestSha256,
      identityReceiptId: id(7), identityVersion: 'SYNTHETIC_SOURCE_V1', identitySha256: 'b'.repeat(64),
      sessionPrincipal: 'SYNTHETIC_LOGIN_NOT_AUTHENTICATED', initiatorKind: 'scheduler',
      initiatorJobId: 'SYNTHETIC_JOB', initiatorUserId: null,
      notBefore: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-01T00:02:00.000Z',
    },
    protectedAuthority: {
      recordId: 'SYNTHETIC_MISSING_PROTECTED_RECORD', deployment: 'SYNTHETIC_DEPLOYMENT', tenant: id(1),
      manifestIdentity: 'SYNTHETIC_SEMANTIC_FAMILY', schedulerApprovalId: id(2), schedulerJob: 'SYNTHETIC_JOB',
      authorizedOccurrence: 'SYNTHETIC_SEPARATELY_APPROVED_OCCURRENCE', preparationAdmissionId: id(5), receiptId: id(7),
      skipMs: 0, generation: 1, restoreFence: 'SYNTHETIC_FENCE_A',
      notBefore: '2030-01-01T00:00:00.000Z', expiresAt: '2030-01-01T00:10:00.000Z', revokedAt: null,
    },
  };
  return snapshots;
}

/** A test-only resolver feeding the unchanged real issuer; no provider is exported by contract.mjs. */
export async function syntheticIssuance(snapshots = syntheticSnapshots()) {
  const mapped = mapDeclaredVerifiedSnapshots(snapshots);
  const issuer = createIssuer(async ticket => {
    if (ticket !== 'SYNTHETIC_OPAQUE_TICKET') throw Error('SYNTHETIC_TICKET_MISMATCH');
    return mapped;
  }, snapshots.deployment);
  const envelope = await issuer.derive('SYNTHETIC_OPAQUE_TICKET');
  return {envelope, row: {
    canonicalVersion: 1, deployment: envelope.parameters[0], obligationId: envelope.obligationId,
    tenant: envelope.parameters[2], manifestIdentity: envelope.parameters[3], schedulerJob: envelope.parameters[4],
    authorizedOccurrence: envelope.parameters[5], contextId: envelope.parameters[6], binding: JSON.parse(envelope.parameters[7]),
  }};
}

export function renewContext(e) {
  e.serverAdmission.contextId = e.serverContext.contextId = id(80);
  e.serverAdmission.runId = e.serverContext.runId = id(90);
  e.serverAdmission.lineageId = e.serverContext.lineageId = id(100);
}

export function renewArtifact(e) {
  for (const v of [e.schedulerApproval, e.preparationAdmission.schedulerSnapshot,
    e.serverAdmission.schedulerSnapshot, e.preparationRun, e.receipt, e.serverContext]) {
    v.manifestVersion = 'SYNTHETIC_ARTIFACT_V2';
    v.manifestSha256 = 'd'.repeat(64);
  }
}
