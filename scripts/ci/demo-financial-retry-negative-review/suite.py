"""Pure SQL provider for an author's owned synthetic runner. Never connects.

Fixtures are consumed unchanged, verified by bytes and SHA256. This provider
does not install the engine or attest the caller's checkout/container/cleanup.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
CONTRACT = json.loads((HERE / "contract.json").read_text(encoding="utf-8"))


def _load(filename):
    spec = importlib.util.spec_from_file_location("retry_negative_" + filename, HERE / (filename + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_authority = _load("authority_cases")
CASES = (_load("adoption_cases").CASES + _authority.CASES
         + _load("origin_materialization_cases").CASES)
BLOCKED_CASES = _authority.BLOCKED_CASES


def get_case(case_id):
    matches = [case for case in CASES if case["id"] == case_id]
    if len(matches) != 1:
        raise ValueError("Unknown or ambiguous negative case")
    return matches[0]


def verify_sources(sources):
    """Exact bytes only; Windows CRLF is not silently accepted or rewritten."""
    pins = CONTRACT["external_sources"]
    if set(sources) != set(pins):
        raise ValueError("Exactly the three pinned author fixtures are required")
    for name, pin in pins.items():
        body = sources[name]
        if type(body) is not bytes:
            raise TypeError("Author fixture must be bytes: " + name)
        if len(body) != pin["bytes"] or hashlib.sha256(body).hexdigest() != pin["sha256"]:
            raise ValueError("Author fixture byte drift: " + name)


def expected_markers(case_id):
    case = get_case(case_id)
    stages = ["PREFLIGHT"]
    if case["phase"] == "materialized":
        stages += ["POSITIVE_RETRY"]
    if case.get("rejection_stage", "rpc") == "rpc":
        stages += ["MUTATION_CONFIRMED"]
    stages += ["REJECTION_OBSERVED", "TABLE_ROWS_PRESERVED", "ROLLBACK_COMPLETE"]
    return ["RETRY_NEGATIVE_" + stage + "_" + case_id for stage in stages]


def _marker(stage, case_id):
    return "\\echo RETRY_NEGATIVE_" + stage + "_" + case_id + "\n"


PREFLIGHT = r"""
\set ON_ERROR_STOP on
DO $retry_preflight$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('role')<>'none'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR current_setting('transaction_isolation')<>'read committed'
 OR current_setting('transaction_read_only')<>'off'
 OR current_setting('session_replication_role')<>'origin'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper
   AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER')
 OR (SELECT count(*) FROM pg_temp.financial_context)<>1
 OR EXISTS(SELECT 1 FROM pg_temp.financial_context WHERE context_id IS NULL)
 OR auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR auth.jwt()->>'fixture' IS DISTINCT FROM 'SYNTHETIC'
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM public.proveedor_facturas)
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_FRESH_SYNTHETIC_LAB_REQUIRED'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $retry_preflight$;
CREATE TEMP TABLE retry_negative_outer_rows AS SELECT pg_temp.financial_snapshot() body;
BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
"""


POSITIVE = r"""
CREATE TEMP TABLE retry_negative_positive(result jsonb);
DO $retry_positive$
DECLARE ctx uuid; first_result jsonb; retry_result jsonb; before_retry jsonb;
  v_run uuid; v_lineage uuid; v_checkpoint uuid;
BEGIN
 SELECT context_id INTO STRICT ctx FROM pg_temp.financial_context;
 SET LOCAL ROLE service_role;
 first_result:=demo_flow_writer.prepare_execute_checkpoint(ctx,0);
 PERFORM demo_financial_lab.flush_deferred();
 RESET ROLE;
 v_run:=(first_result->>'run_id')::uuid;
 v_lineage:=(first_result->>'lineage_id')::uuid;
 v_checkpoint:=(first_result->>'checkpoint_id')::uuid;
 IF first_result->>'status' IS DISTINCT FROM 'materialized'
 OR first_result->>'materialization' IS DISTINCT FROM 'executed'
 OR v_run IS NULL OR v_lineage IS NULL OR v_checkpoint IS NULL
 OR (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage)<>13
 OR NOT EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts a
   JOIN demo_flow_writer.execution_receipts x ON x.execution_run_id=a.run_id
   JOIN demo_flow_writer.seed_checkpoints c ON c.id=x.checkpoint_id
   JOIN public.demo_seed_state s ON s.id AND s.last_seeded_at=c.checked_at
   WHERE a.context_id=ctx AND a.run_id=v_run AND a.lineage_id=v_lineage
   AND x.lineage_id=v_lineage AND c.id=v_checkpoint AND c.lineage_id=v_lineage
   AND c.execution_run_id=v_run AND x.projection_sha256=c.projection_sha256
   AND c.projection_sha256=demo_flow_writer.projection_sha256(v_lineage))
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_GENUINE_MATERIALIZATION_REQUIRED'; END IF;
 -- Verify as the same selected technical role through the canonical boundary.
 -- No exception handler: the old adoption bug must fail before any denial test.
 before_retry:=pg_temp.financial_snapshot();
 SET LOCAL ROLE service_role;
 retry_result:=demo_flow_writer.prepare_execute_checkpoint(ctx,0);
 PERFORM demo_financial_lab.flush_deferred();
 RESET ROLE;
 IF retry_result IS DISTINCT FROM first_result
 OR pg_temp.financial_snapshot() IS DISTINCT FROM before_retry
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_UNCHANGED_RETRY_REQUIRED'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
 INSERT INTO pg_temp.retry_negative_positive VALUES(first_result);
END $retry_positive$;
"""


def _denial(case):
    state, message = case["expected_sqlstate"], case["expected_message"]
    if not re.fullmatch(r"[0-9A-Z]{5}", state) or not re.fullmatch(r"[A-Z_]+", message):
        raise ValueError("Unsafe native error contract")
    if case.get("rejection_stage", "rpc") == "mutation":
        # SQL-literal quoting keeps inner DO dollar delimiters independent.
        operation = "EXECUTE '" + case["mutation_sql"].replace("'", "''") + "';"
        role_before = role_after = ""
    else:
        operation = ("PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);\n"
                     "PERFORM demo_financial_lab.flush_deferred();")
        role_before = "SET LOCAL ROLE service_role;"
        role_after = "RESET ROLE;"
    return f"""
DO $retry_denial$
DECLARE ctx uuid; seen boolean:=false; native_message text;
BEGIN
 SELECT context_id INTO STRICT ctx FROM pg_temp.financial_context;
 {role_before}
 BEGIN
  {operation}
 EXCEPTION WHEN SQLSTATE '{state}' THEN
  GET STACKED DIAGNOSTICS native_message=MESSAGE_TEXT;
  {role_after}
  IF native_message IS DISTINCT FROM '{message}' THEN RAISE; END IF;
  seen:=true;
 END;
 {role_after}
 IF NOT seen THEN RAISE EXCEPTION 'RETRY_NEGATIVE_EXPECTED_DENIAL_MISSING'; END IF;
END $retry_denial$;
"""


def negative_sql(case_id):
    """Suffix for exactly one fresh, already prepared synthetic candidate."""
    case = get_case(case_id)
    body = PREFLIGHT + _marker("PREFLIGHT", case_id)
    if case["phase"] == "materialized":
        body += POSITIVE + _marker("POSITIVE_RETRY", case_id)
    body += "CREATE TEMP TABLE retry_negative_before_mutation AS SELECT pg_temp.financial_snapshot() body;\n"
    if case.get("rejection_stage", "rpc") == "rpc":
        body += case["mutation_sql"] + "\n" + case["proof_sql"] + r"""
DO $retry_mutation_required$ BEGIN
 IF pg_temp.financial_snapshot() IS NOT DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_before_mutation)
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_MUTATION_NOT_OBSERVED'; END IF;
END $retry_mutation_required$;
""" + _marker("MUTATION_CONFIRMED", case_id)
    body += "CREATE TEMP TABLE retry_negative_before_denial AS SELECT pg_temp.financial_snapshot() body;\n"
    body += _denial(case) + _marker("REJECTION_OBSERVED", case_id)
    body += case["proof_sql"] + r"""
DO $retry_rows_preserved$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_before_denial)
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_DENIAL_CHANGED_TABLE_ROWS'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $retry_rows_preserved$;
""" + _marker("TABLE_ROWS_PRESERVED", case_id)
    body += r"""
ROLLBACK;
DO $retry_outer_rollback$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM
   (SELECT body FROM pg_temp.retry_negative_outer_rows)
 THEN RAISE EXCEPTION 'RETRY_NEGATIVE_OUTER_ROLLBACK_CHANGED_TABLE_ROWS'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $retry_outer_rollback$;
""" + _marker("ROLLBACK_COMPLETE", case_id)
    return body.encode("utf-8")


def suite_sql(case_id, sources, *, author_fix_head):
    """Verified exact prefix plus review-owned suffix, no connection or runner."""
    if author_fix_head != CONTRACT["author_fix_head"]:
        raise ValueError("Unreviewed author fix HEAD")
    verify_sources(sources)
    suffix = negative_sql(case_id)
    return b"\n".join(sources[name] for name in CONTRACT["external_sources"]) + b"\n" + suffix


def inspect_result(case_id, *, stdout, stderr, returncode):
    """Parse native psql -X -q -A -t output. Cleanup/ownership stays external.

    Input logs must come from that fresh owned invocation, without echo-all or
    SQL echo. This parser is not an attestation of caller-supplied strings.
    """
    expected = expected_markers(case_id)
    observed = [line.strip() for line in stdout.splitlines()
                if line.strip().startswith("RETRY_NEGATIVE_")]
    failed = returncode != 0 or re.search(r"\b(?:ERROR|FATAL|PANIC):", stdout + "\n" + stderr) is not None
    matched = not failed and observed == expected
    case = get_case(case_id)
    return {
        "case_id": case_id,
        "status": "ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP" if matched else "FAIL",
        "expected_sqlstate": case["expected_sqlstate"],
        "expected_message": case["expected_message"],
        "rejection_stage": case.get("rejection_stage", "rpc"),
        "markers": observed,
        "author_fix_head": CONTRACT["author_fix_head"],
        "admission": "NOT_ADMITTED",
        "business_commit": "NOT_RUN",
        "sequence_rollback": "NOT_ESTABLISHED",
    }
