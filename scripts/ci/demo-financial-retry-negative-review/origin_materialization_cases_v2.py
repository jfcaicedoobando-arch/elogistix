"""Versioned alias correction for two original PR357 cases; native SQL NOT_RUN.

The nine original files and their evidence stay immutable.  This module checks
the versioned contract's original-file pins, imports the old case module, then
derives the same two cases by exact snapshot-expression replacements only.
The old native run's 42703 failure is retained as historical evidence, never
reinterpreted as an expected denial.  No supplemental delivery is required.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path


HERE = Path(__file__).resolve().parent
CONTRACT_PATH = HERE / "origin-v2-contract.json"
ORIGINAL_HEAD = "fd3a2fcb940dc122fda7be242afda05a053dd61d"
ORIGINAL_FILES = frozenset({
    "README.md", "adoption_cases.py", "authority_cases.py", "contract.json",
    "offline-evidence.json", "origin_materialization_cases.py", "suite.py",
    "test_origin_adoption_cases.py", "test_suite.py",
})
ORIGINAL_ORIGIN_PIN = {
    "bytes": 9919,
    "sha256": "6212828414faa1ea6a105881a7e314d3f51a8169b3c271f78763b51429535022",
}
CONTRACT = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def verify_original_delivery():
    """Fail closed before importing any mutable or unreviewed original source."""
    if CONTRACT.get("original_delivery_head") != ORIGINAL_HEAD:
        raise ValueError("Unreviewed original PR357 delivery HEAD")
    pins = CONTRACT.get("original_files", {})
    if set(pins) != ORIGINAL_FILES or pins["origin_materialization_cases.py"] != ORIGINAL_ORIGIN_PIN:
        raise ValueError("Exact original nine-file contract required")
    for name, pin in pins.items():
        path = HERE / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("Original PR357 source absent or linked: " + name)
        data = path.read_bytes()
        if len(data) != pin["bytes"] or hashlib.sha256(data).hexdigest() != pin["sha256"]:
            raise ValueError("Original PR357 delivery changed: " + name)


verify_original_delivery()
_spec = importlib.util.spec_from_file_location(
    "retry_origin_materialization_immutable_v1", HERE / "origin_materialization_cases.py"
)
ORIGINAL = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ORIGINAL)


def origin_snapshot(receipt_ref: str) -> str:
    """Read the same four rows/arrays with aliases that cannot capture a or v."""
    if receipt_ref not in ("a.identity_receipt_id", "v.receipt_id"):
        raise ValueError("Unreviewed origin receipt reference")
    return """jsonb_build_object(
 'prepared_receipt',(SELECT to_jsonb(origin_prepared_receipt)
   FROM demo_fixture_identity.prepared_receipts origin_prepared_receipt
   WHERE origin_prepared_receipt.receipt_id={receipt}),
 'preparation_run',(SELECT to_jsonb(origin_preparation_run)
   FROM demo_fixture_identity.preparation_runs origin_preparation_run
   WHERE origin_preparation_run.receipt_id={receipt}),
 'preparation_admission',(SELECT to_jsonb(origin_preparation_admission)
   FROM demo_fixture_identity.preparation_runs origin_preparation_run
   JOIN demo_fixture_identity.preparation_admissions origin_preparation_admission
     ON origin_preparation_admission.id=origin_preparation_run.admission_id
   WHERE origin_preparation_run.receipt_id={receipt}),
 'preparation_bindings',(SELECT jsonb_agg(to_jsonb(origin_preparation_binding)
     ORDER BY origin_preparation_binding.fixture_id)
   FROM demo_fixture_identity.preparation_runs origin_preparation_run
   JOIN demo_fixture_identity.preparation_bindings origin_preparation_binding
     ON origin_preparation_binding.admission_id=origin_preparation_run.admission_id
   WHERE origin_preparation_run.receipt_id={receipt}))""".format(receipt=receipt_ref)


_origin_snapshot = origin_snapshot


def _replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError("Original snapshot fragment cardinality changed")
    return text.replace(old, new, 1)


def _derive_cases():
    expected = ("mutable_supplier_origin_drift", "materialized_invoice_folio_drift")
    if tuple(case["id"] for case in ORIGINAL.CASES) != expected:
        raise ValueError("Original origin case identities changed")
    revised = []
    for original in ORIGINAL.CASES:
        case = dict(original)
        for reference in ("a.identity_receipt_id", "v.receipt_id"):
            case["mutation_sql"] = _replace_once(
                case["mutation_sql"], ORIGINAL._origin_snapshot(reference), origin_snapshot(reference)
            )
        if ORIGINAL._origin_snapshot("a.identity_receipt_id") in case["proof_sql"]:
            raise ValueError("Unexpected outer-admission reference in original proof")
        case["proof_sql"] = _replace_once(
            case["proof_sql"], ORIGINAL._origin_snapshot("v.receipt_id"), origin_snapshot("v.receipt_id")
        )
        revised.append(case)
    return tuple(revised)


CASES = _derive_cases()


def source_sql_probe() -> str:
    """Read-only schema/alias probe for the installed authentic prepared lab.

    Run after genuine materialization/positive retry and before either changed
    mutation.  It is also valid before materialization once the author fixture
    has prepared exactly one context.  It creates no table, takes no row locks,
    calls no writer or locking provenance verifier, and changes no setting.
    Errors propagate outside the expected-denial handler.  The owning wrapper
    is responsible for its success marker and transaction boundaries.
    """
    return """
DO $retry_origin_v2_source_probe$
DECLARE v record; record_snapshot jsonb; expected_snapshot jsonb; actual_bindings jsonb;
 actual_prepared demo_fixture_identity.prepared_receipts;
 actual_run demo_fixture_identity.preparation_runs;
 actual_admission demo_fixture_identity.preparation_admissions;
 admitted_mapping jsonb; prepared_mapping jsonb;
BEGIN
 IF (SELECT count(*) FROM pg_temp.financial_context)<>1 THEN
  RAISE EXCEPTION 'RETRY_ORIGIN_V2_SINGLE_PREPARED_CONTEXT_REQUIRED';
 END IF;
 SELECT a.identity_receipt_id receipt_id,a.scheduler_approval_id scheduler_approval_id,
   __OUTER_SNAPSHOT__ origin_snapshot
 INTO STRICT v
 FROM pg_temp.financial_context c
 JOIN demo_flow_writer.server_admissions a ON a.context_id=c.context_id;
 record_snapshot:=__RECORD_SNAPSHOT__;
 SELECT * INTO STRICT actual_prepared FROM demo_fixture_identity.prepared_receipts
   WHERE receipt_id=v.receipt_id;
 SELECT * INTO STRICT actual_run FROM demo_fixture_identity.preparation_runs
   WHERE receipt_id=v.receipt_id;
 SELECT * INTO STRICT actual_admission FROM demo_fixture_identity.preparation_admissions
   WHERE id=actual_run.admission_id;
 SELECT jsonb_agg(to_jsonb(probe_binding) ORDER BY probe_binding.fixture_id)
 INTO actual_bindings FROM demo_fixture_identity.preparation_bindings probe_binding
 WHERE probe_binding.admission_id=actual_admission.id;
 expected_snapshot:=jsonb_build_object('prepared_receipt',to_jsonb(actual_prepared),
   'preparation_run',to_jsonb(actual_run),'preparation_admission',to_jsonb(actual_admission),
   'preparation_bindings',actual_bindings);
 IF v.receipt_id IS NULL OR v.origin_snapshot IS DISTINCT FROM record_snapshot
 OR v.origin_snapshot IS DISTINCT FROM expected_snapshot
 OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(v.origin_snapshot) key)
   IS DISTINCT FROM ARRAY['preparation_admission','preparation_bindings','preparation_run','prepared_receipt']
 OR jsonb_typeof(v.origin_snapshot->'prepared_receipt') IS DISTINCT FROM 'object'
 OR jsonb_typeof(v.origin_snapshot->'preparation_run') IS DISTINCT FROM 'object'
 OR jsonb_typeof(v.origin_snapshot->'preparation_admission') IS DISTINCT FROM 'object'
 OR jsonb_typeof(actual_bindings) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'RETRY_ORIGIN_V2_COMPLETE_SNAPSHOT_REQUIRED';
 END IF;
 IF jsonb_array_length(actual_bindings) IS DISTINCT FROM 3
 OR (SELECT array_agg(binding->>'fixture_id' ORDER BY binding->>'fixture_id')
   FROM jsonb_array_elements(actual_bindings) binding)
   IS DISTINCT FROM ARRAY['aap-vencida','ofc-parcial','ttn-vigente']
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(actual_bindings) binding
   WHERE (binding->>'admission_id')::uuid IS DISTINCT FROM actual_admission.id)
 OR actual_prepared.receipt_id IS DISTINCT FROM v.receipt_id
 OR actual_run.receipt_id IS DISTINCT FROM v.receipt_id
 OR (actual_prepared.payload->>'receipt_id')::uuid IS DISTINCT FROM v.receipt_id
 OR (actual_prepared.payload->>'source_run_id')::uuid IS DISTINCT FROM actual_run.id
 OR actual_run.admission_id IS DISTINCT FROM actual_admission.id
 OR actual_run.scheduler_approval_id IS DISTINCT FROM actual_admission.scheduler_approval_id
 OR actual_run.scheduler_approval_id IS DISTINCT FROM v.scheduler_approval_id
 OR actual_prepared.client_bindings IS DISTINCT FROM actual_admission.client_bindings
 OR (actual_prepared.payload->>'category_id')::uuid IS DISTINCT FROM actual_admission.category_id
 OR actual_prepared.payload->'category_snapshot' IS DISTINCT FROM actual_admission.category_snapshot
 OR actual_prepared.payload->>'source_sha256' IS DISTINCT FROM actual_run.source_sha256
 OR actual_prepared.payload->>'source_version' IS DISTINCT FROM actual_run.source_version THEN
  RAISE EXCEPTION 'RETRY_ORIGIN_V2_RECEIPT_CHAIN_REQUIRED';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('fixture_id',binding->'fixture_id',
   'supplier_id',binding->'supplier_id','shipment_id',binding->'shipment_id',
   'supplier_snapshot',binding->'supplier_snapshot','shipment_snapshot',binding->'shipment_snapshot')
   ORDER BY binding->>'fixture_id') INTO admitted_mapping
 FROM jsonb_array_elements(actual_bindings) binding;
 SELECT jsonb_agg(binding-ARRAY['invoice_id','concept_ids','payment_id','fixture_sha256']
   ORDER BY binding->>'fixture_id') INTO prepared_mapping
 FROM jsonb_array_elements(actual_prepared.payload->'bindings') binding;
 IF prepared_mapping IS DISTINCT FROM admitted_mapping THEN
  RAISE EXCEPTION 'RETRY_ORIGIN_V2_PREPARED_BINDING_CHAIN_REQUIRED';
 END IF;
END $retry_origin_v2_source_probe$;
""".replace("__OUTER_SNAPSHOT__", origin_snapshot("a.identity_receipt_id")).replace(
        "__RECORD_SNAPSHOT__", origin_snapshot("v.receipt_id")
    )
