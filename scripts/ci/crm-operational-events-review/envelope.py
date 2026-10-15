"""Render an unconditionally fenced review proposal, never an application artifact.

This is NOT a complete operational renderer or admission implementation. It does
not compare operational commitments, validate an event-handler call graph or
execution profile, register a migration, prove transport semantics, or establish
a DDL/ACL window. Those remain separate design, evidence, test and review gates.
The existing canonical SQL and LAB-only renderer are not changed or imported.

The only accepted summary is the exact public protocol/admission marker below;
private capture data, credentials and application toggles are not accepted. The
renderer has no connection, CLI, file-writing or stdout API. Every generated SQL
proposal aborts before its unreachable payload demonstration can execute.
"""
import hashlib


CANONICAL_SHA256 = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
PROTOCOL = 'crm-operational-evidence-v1'
ADMISSION = 'NOT_ADMITTED'


def require(condition, code):
    """Fail closed with a constant diagnostic; never echo input or capture data."""
    if not condition:
        raise ValueError('CRM_OPERATIONAL_' + code)


def render_review_proposal(candidate: bytes, evidence_summary: dict) -> str:
    """Return one non-operative top-level DO with an unconditional first failure.

    Accept exactly {'kind': PROTOCOL, 'admission': 'NOT_ADMITTED'}. This marker is
    not evidence of a target, transport, role, event policy, ledger or window.
    No argument can admit the proposal. The canonical bytes are embedded only
    after the fence; no measured preimages, object IDs or ledger writes exist.
    """
    require(type(candidate) is bytes, 'CANONICAL_BYTES_REQUIRED')
    try:
        decoded = candidate.decode('utf8', errors='strict')
    except UnicodeDecodeError:
        raise ValueError('CRM_OPERATIONAL_CANONICAL_UTF8') from None
    require(decoded.encode('utf8') == candidate, 'CANONICAL_UTF8')
    require(hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256, 'CANONICAL_SHA256')
    require(type(evidence_summary) is dict, 'SUMMARY_PROTOCOL')
    require(set(evidence_summary) == {'kind', 'admission'}, 'SUMMARY_PROTOCOL')
    require(type(evidence_summary['kind']) is str and evidence_summary['kind'] == PROTOCOL
            and type(evidence_summary['admission']) is str
            and evidence_summary['admission'] == ADMISSION, 'SUMMARY_PROTOCOL')

    # Only verified public bytes enter SQL. Summary inputs are never serialized.
    return """-- REVIEW PROPOSAL ONLY. NOT_ADMITTED; no application mode exists.
-- Protocol marker: crm-operational-evidence-v1. This is not operational evidence.
DO $crm_operational_review$
DECLARE
  v_payload pg_catalog.bytea;
  v_sql pg_catalog.text;
BEGIN
  RAISE EXCEPTION 'CRM_OPERATIONAL_NOT_ADMITTED';

  -- Unreachable exact-byte demonstration. Do not remove the admission fence.
  v_payload := pg_catalog.decode('""" + candidate.hex() + """','hex');
  IF pg_catalog.encode(pg_catalog.sha256(v_payload),'hex') <> '""" + CANONICAL_SHA256 + """' THEN
    RAISE EXCEPTION 'CRM_OPERATIONAL_CANONICAL_SHA256';
  END IF;
  v_sql := pg_catalog.convert_from(v_payload,'UTF8');
  IF pg_catalog.convert_to(v_sql,'UTF8') IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'CRM_OPERATIONAL_CANONICAL_UTF8';
  END IF;
  EXECUTE v_sql;

  -- LEDGER PROTOCOL OMITTED: no preimages, IDs, registration or ledger DML.
  -- Missing: commitment comparator, closed event policy and execution profile,
  -- complete fresh ledger/sequence metadata, reviewed registration convention,
  -- verified transport/commit/reconciliation semantics and a new coordinated
  -- DDL/ACL window, followed by isolated tests and independent candidate review.
  -- This proposal is not an operational envelope and cannot establish admission.
END
$crm_operational_review$;
"""
