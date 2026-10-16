"""Additional prepared probes; consumes the original delivery without editing it.

Pure provider only. This file never connects, starts a process, or accepts a DSN.
Sequence observations are separate evidence and are never rollback assertions.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
LOCK = json.loads((HERE / "delivery-lock.json").read_text(encoding="utf-8"))


def verify_delivery():
    for name, pin in LOCK["original_files"].items():
        data = (HERE / name).read_bytes()
        if len(data) != pin["bytes"] or hashlib.sha256(data).hexdigest() != pin["sha256"]:
            raise ValueError("Original PR357 delivery changed: " + name)


def _load(name):
    spec = importlib.util.spec_from_file_location("retry_supplement_" + name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verify_delivery()
BASE = _load("suite")
SEQUENCES = _load("sequence_observation")
_adoption = _load("supplemental_adoption_cases")
_tenant = _load("supplemental_tenant_cases")
CASES = _adoption.CASES + _tenant.CASES
BLOCKED_CASES = _tenant.BLOCKED_CASES
SEQUENCE_CONTROL_ID = "sequence_nontransactional_control"
SEQUENCE_CONTROL_LABELS = ("probe_before", "baseline_after_prep", "after_positive",
                           "probe_after_advance", "probe_after_outer_rollback", "after_outer_rollback")


def get_case(case_id):
    matches = [case for case in CASES if case["id"] == case_id]
    if len(matches) != 1:
        raise ValueError("Unknown or ambiguous supplemental case")
    return matches[0]


def observation_labels(case_id):
    labels = ["baseline_after_prep"]
    if get_case(case_id)["phase"] == "materialized":
        labels.append("after_positive")
    return labels + ["before_denial", "after_denial", "after_outer_rollback"]


def expected_markers(case_id):
    stages = ["PREFLIGHT"]
    if get_case(case_id)["phase"] == "materialized":
        stages.append("POSITIVE_RETRY")
    stages += ["MUTATION_CONFIRMED", "REJECTION_OBSERVED", "TABLE_ROWS_PRESERVED", "ROLLBACK_COMPLETE"]
    return ["RETRY_SUPPLEMENT_" + stage + "_" + case_id for stage in stages]


def _marker(stage, case_id):
    return "\\echo RETRY_SUPPLEMENT_" + stage + "_" + case_id + "\n"


def negative_sql(case_id):
    """One fresh synthetic candidate, with read-only sequence observations."""
    case = get_case(case_id)
    verify_delivery()
    body = SEQUENCES.setup_sql() + SEQUENCES.capture_sql("baseline_after_prep")
    body += BASE.PREFLIGHT + _marker("PREFLIGHT", case_id)
    if case["phase"] == "materialized":
        body += BASE.POSITIVE + _marker("POSITIVE_RETRY", case_id)
        body += SEQUENCES.capture_sql("after_positive")
    body += "CREATE TEMP TABLE retry_negative_before_mutation AS SELECT pg_temp.financial_snapshot() body;\n"
    body += case["mutation_sql"] + "\n" + case["proof_sql"] + r"""
DO $supplement_mutation_required$ BEGIN
 IF pg_temp.financial_snapshot() IS NOT DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_before_mutation)
 THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_MUTATION_NOT_OBSERVED'; END IF;
END $supplement_mutation_required$;
""" + _marker("MUTATION_CONFIRMED", case_id)
    body += "CREATE TEMP TABLE retry_negative_before_denial AS SELECT pg_temp.financial_snapshot() body;\n"
    body += SEQUENCES.capture_sql("before_denial")
    body += BASE._denial(case) + _marker("REJECTION_OBSERVED", case_id)
    body += case["proof_sql"] + r"""
DO $supplement_rows_preserved$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_before_denial)
 THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_DENIAL_CHANGED_TABLE_ROWS'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $supplement_rows_preserved$;
""" + _marker("TABLE_ROWS_PRESERVED", case_id)
    body += SEQUENCES.capture_sql("after_denial")
    body += r"""
ROLLBACK;
DO $supplement_outer_rollback$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_outer_rows)
 THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_OUTER_ROLLBACK_CHANGED_TABLE_ROWS'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $supplement_outer_rollback$;
"""
    body += SEQUENCES.capture_sql("after_outer_rollback") + _marker("ROLLBACK_COMPLETE", case_id)
    return body.encode("utf-8")


def suite_sql(case_id, sources, *, author_fix_head):
    if author_fix_head != BASE.CONTRACT["author_fix_head"]:
        raise ValueError("Unreviewed author fix HEAD")
    BASE.verify_sources(sources)
    return b"\n".join(sources[name] for name in BASE.CONTRACT["external_sources"]) + b"\n" + negative_sql(case_id)


def inspect_result(case_id, *, stdout, stderr, returncode):
    """Markers and observer completeness; cleanup remains author-owned."""
    case = get_case(case_id)
    observed = [line.strip() for line in stdout.splitlines()
                if line.strip().startswith("RETRY_SUPPLEMENT_")]
    errors = returncode != 0 or re.search(r"\b(?:ERROR|FATAL|PANIC):", stdout + "\n" + stderr) is not None
    sequence_evidence = SEQUENCES.inspect_output(stdout, expected_labels=observation_labels(case_id))
    # Changed values are reported as observations, never hidden or reset.
    complete = sequence_evidence["status"] == "COMPLETE"
    return {
        "case_id": case_id,
        "status": "ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP"
                  if not errors and observed == expected_markers(case_id) and complete else "FAIL",
        "expected_sqlstate": case["expected_sqlstate"],
        "expected_message": case["expected_message"],
        "rejection_stage": "rpc",
        "markers": observed,
        "sequences": sequence_evidence,
        "sequence_rollback": "NOT_ASSERTED",
        "admission": "NOT_ADMITTED",
        "native_business_commit": "NOT_RUN",
        "original_delivery_head": LOCK["original_delivery_head"],
        "author_fix_head": BASE.CONTRACT["author_fix_head"],
    }


def sequence_control_sql(sources, *, author_fix_head):
    """Separate native calibration; two nextval calls on one new TEMP object.

    The probe exists before BEGIN, then the actual RPC and unchanged retry must
    succeed before any deliberate advance. The business rows are rolled back;
    parser evidence must show that the advanced TEMP sequence state remains.
    This supplies no evidence about fixture-sequence consumption or durability.
    """
    if author_fix_head != BASE.CONTRACT["author_fix_head"]:
        raise ValueError("Unreviewed author fix HEAD")
    verify_delivery()
    BASE.verify_sources(sources)
    prefix = b"\n".join(sources[name] for name in BASE.CONTRACT["external_sources"]) + b"\n"
    name = SEQUENCE_CONTROL_ID
    body = SEQUENCES.setup_sql() + SEQUENCES.probe_setup_sql()
    body += SEQUENCES.capture_sql("baseline_after_prep")
    body += BASE.PREFLIGHT + _marker("PREFLIGHT", name)
    body += BASE.POSITIVE + _marker("POSITIVE_RETRY", name)
    body += SEQUENCES.capture_sql("after_positive") + SEQUENCES.probe_advance_sql()
    body += _marker("PROBE_ADVANCED", name) + r"""
ROLLBACK;
DO $supplement_sequence_control_rollback$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_outer_rows)
 THEN RAISE EXCEPTION 'RETRY_SUPPLEMENT_SEQUENCE_CONTROL_CHANGED_TABLE_ROWS'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $supplement_sequence_control_rollback$;
"""
    body += SEQUENCES.probe_report_sql() + SEQUENCES.capture_sql("after_outer_rollback")
    body += _marker("ROLLBACK_COMPLETE", name)
    return prefix + body.encode("utf-8")


def inspect_sequence_control(*, stdout, stderr, returncode):
    """Read bounded native calibration; invented sample streams are not evidence."""
    expected = ["RETRY_SUPPLEMENT_" + stage + "_" + SEQUENCE_CONTROL_ID
                for stage in ("PREFLIGHT", "POSITIVE_RETRY", "PROBE_ADVANCED", "ROLLBACK_COMPLETE")]
    observed = [line.strip() for line in stdout.splitlines()
                if line.strip().startswith("RETRY_SUPPLEMENT_")]
    sequences = SEQUENCES.inspect_output(stdout, expected_labels=SEQUENCE_CONTROL_LABELS)
    probe = {"status": "INCOMPLETE", "calibration": "NOT_ESTABLISHED"}
    if sequences["status"] == "COMPLETE":
        # The full strict parser already validated every original JSON frame,
        # including duplicate keys, scope, labels, order and readability.
        probe_lines = []
        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith(SEQUENCES.PREFIX):
                frame = json.loads(line[len(SEQUENCES.PREFIX):])
                if frame["label"] in SEQUENCES.PROBE_LABELS:
                    probe_lines.append(line)
        probe = SEQUENCES.inspect_probe_output("\n".join(probe_lines))
    errors = returncode != 0 or re.search(r"\b(?:ERROR|FATAL|PANIC):", stdout + "\n" + stderr) is not None
    complete = not errors and observed == expected and sequences["status"] == "COMPLETE" and probe["status"] == "COMPLETE"
    return {
        "case_id": SEQUENCE_CONTROL_ID,
        "status": "ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP" if complete else "FAIL",
        "markers": observed,
        "sequences": sequences,
        "temp_probe": probe,
        "sequence_rollback": "NOT_ASSERTED",
        "admission": "NOT_ADMITTED",
        "native_business_commit": "NOT_RUN",
        "author_fix_head": BASE.CONTRACT["author_fix_head"],
    }
