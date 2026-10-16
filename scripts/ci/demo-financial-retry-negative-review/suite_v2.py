"""Versioned correction of two source-origin snapshot fragments; SQL NOT_RUN.

The original files/evidence are immutable. Seven rendered cases stay byte-identical.
The author owns the native runner and must explicitly pin/use this provider.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROVIDER_VERSION = 2


def _load(name):
    spec = importlib.util.spec_from_file_location("retry_origin_v2_" + name, HERE / (name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ORIGIN = _load("origin_materialization_cases_v2")
ORIGIN.verify_original_delivery()
BASE = _load("suite")
VERSION_CONTRACT = json.loads((HERE / "origin-v2-contract.json").read_text(encoding="utf-8"))
CONTRACT = BASE.CONTRACT
BLOCKED_CASES = BASE.BLOCKED_CASES
_corrected = {case["id"]: case for case in ORIGIN.CASES}
CASES = tuple(_corrected.get(case["id"], case) for case in BASE.CASES)


def get_case(case_id):
    matches = [case for case in CASES if case["id"] == case_id]
    if len(matches) != 1:
        raise ValueError("Unknown or ambiguous version2 case")
    return matches[0]


def source_probe_marker(case_id):
    get_case(case_id)
    return "RETRY_ORIGIN_V2_SOURCE_BOUND_" + case_id


def negative_sql(case_id):
    """Derive only affected SQL, with strict single/multiple fragment counts."""
    ORIGIN.verify_original_delivery()
    case = get_case(case_id)
    original = BASE.get_case(case_id)
    body = BASE.negative_sql(case_id)
    if case_id not in _corrected:
        return body
    for field, occurrences in (("mutation_sql", 1), ("proof_sql", 2)):
        old = original[field].encode("utf-8")
        new = case[field].encode("utf-8")
        if old == new or body.count(old) != occurrences:
            raise ValueError("Original SQL fragment contract drift: " + field)
        if field == "mutation_sql":
            probe = ORIGIN.source_sql_probe() + "\n\\echo " + source_probe_marker(case_id) + "\n"
            new = probe.encode("utf-8") + new
        body = body.replace(old, new)
    return body


def suite_sql(case_id, sources, *, author_fix_head):
    if author_fix_head != VERSION_CONTRACT["author_fix_head"]:
        raise ValueError("Unreviewed author fix HEAD")
    BASE.verify_sources(sources)
    return b"\n".join(sources[name] for name in CONTRACT["external_sources"]) + b"\n" + negative_sql(case_id)


def expected_markers(case_id):
    return BASE.expected_markers(case_id)


def inspect_result(case_id, *, stdout, stderr, returncode):
    """Retain old native gates and require the extra affected-case schema probe."""
    get_case(case_id)
    result = BASE.inspect_result(case_id, stdout=stdout, stderr=stderr, returncode=returncode)
    probes = [line.strip() for line in stdout.splitlines()
              if line.strip().startswith("RETRY_ORIGIN_V2_")]
    expected = [source_probe_marker(case_id)] if case_id in _corrected else []
    if probes != expected:
        result["status"] = "FAIL"
    if case_id in _corrected and probes == expected:
        lines = [line.strip() for line in stdout.splitlines()]
        positive = "RETRY_NEGATIVE_POSITIVE_RETRY_" + case_id
        mutated = "RETRY_NEGATIVE_MUTATION_CONFIRMED_" + case_id
        if positive not in lines or mutated not in lines or not (
            lines.index(positive) < lines.index(expected[0]) < lines.index(mutated)
        ):
            result["status"] = "FAIL"
    result["review_provider_version"] = PROVIDER_VERSION
    result["source_binding_probe"] = "OBSERVED" if expected and probes == expected else "NOT_REQUIRED" if not expected else "MISSING_OR_INVALID"
    result["historical_native_run"] = VERSION_CONTRACT["historical_native_run"]["run_id"]
    return result
