"""Offline safety-contract checks; these do not execute or compile PostgreSQL."""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent
SQL = ROOT / "sql"
TARGETS = {
    "checkpoint": "demo_flow_writer.seed_checkpoints",
    "marker": "public.demo_seed_state",
    "execution_receipt": "demo_flow_writer.execution_receipts",
    "event": "demo_flow_writer.events",
    "receipt": "demo_flow_writer.receipts",
}


def read(name):
    return (SQL / name).read_text(encoding="utf-8")


def executable(source):
    return re.sub(r"--[^\n]*", "", source)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def snapshot_contract(source):
    start = source.index("CREATE FUNCTION pg_temp.financial_snapshot()")
    body = source[start:source.index("END $fn$;", start)]
    schemas = re.search(r"n\.nspname IN\(([^)]+)\)", body)
    require(schemas is not None, "explicit snapshot schemas")
    require(set(re.findall(r"'([^']+)'", schemas.group(1))) == {
        "public", "auth", "demo_flow_writer", "demo_fixture_identity", "financial_compile_fixture"
    }, "complete persistent fixture schemas")
    require("c.relkind IN('r','p')" in body, "all ordinary/partitioned tables")
    require("jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)" in body, "all columns and stable row order")
    require("FROM %I.%I t'" in body, "no per-table row filtering")
    require("result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data)" in body, "table identity retained")


def deferred_contract(source):
    start = source.index("CREATE FUNCTION demo_financial_lab.flush_deferred()")
    body = source[start:source.index("END $fn$;", start)]
    require("SECURITY DEFINER SET search_path=pg_catalog" in body, "bounded test definer")
    for guard in (
        "current_database()<>'demo_financial_compile_recovery_lab'",
        "current_user<>'postgres'", "session_user<>'postgres'",
        "current_setting('role')<>'service_role'",
    ):
        require(guard in body, "disposable owner/role guard")
    transport = body.find("PERFORM demo_flow_writer.assert_rpc_transport();")
    flush = body.find("SET CONSTRAINTS ALL IMMEDIATE;")
    require(transport >= 0 and flush > transport, "real transport and deferred trigger execution")
    function_body = body.split("AS $fn$", 1)[1]
    require("EXCEPTION WHEN" not in function_body and not re.search(r"\bRETURN\b", function_body), "no swallowed deferred failure")


def exact_fault_contract(source):
    require("USING ERRCODE='P0T01'" in source, "distinct injection state")
    require("GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;" in source, "actual state and message")
    require("IF state<>'P0T01' OR msg IS DISTINCT FROM expected THEN RAISE; END IF;" in source, "rethrow unrelated errors")
    require("IF NOT rejected THEN RAISE EXCEPTION 'Required injected fault not reached'; END IF;" in source, "injection must be reached")
    require("LANGUAGE plpgsql SECURITY INVOKER" in source, "fault caller retains selected role")
    require("PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);" in source, "canonical boundary invoked")
    for name, table in TARGETS.items():
        action = "INSERT OR UPDATE" if name == "marker" else "INSERT"
        require(f"WHEN '{name}' THEN CREATE TRIGGER financial_fault BEFORE {action} ON {table}" in source,
                "only exact target injected")
    require(source.count("CREATE TRIGGER financial_fault ") == len(TARGETS), "closed injection set")
    require("ELSE RAISE EXCEPTION 'Unknown fault target';" in source, "unknown target fails")


def materialization_evidence_contract(source):
    drain = "SET LOCAL ROLE service_role;\nSELECT demo_financial_lab.flush_deferred();\nRESET ROLE;"
    marker = "SELECT 'FINANCIAL_MATERIALIZATION_ASSERTIONS_COMPLETE_happy';"
    require(source.count(drain) == 1 and source.count(marker) == 1, "one genuine drain and positive marker")
    ordered = [
        "PERFORM demo_flow_writer.verify_materialized(v_run);",
        "RAISE EXCEPTION 'Authentic materialization cardinality mismatch'",
        "RAISE EXCEPTION 'Projection/checkpoint/marker/receipt mismatch'",
        drain, marker, "\\echo FINANCIAL_PHASE_happy_materialized",
        "CREATE TEMP TABLE before_replay", "AS replay \\gset",
        "SELECT 'FINANCIAL_ASSERTIONS_COMPLETE_happy';", "ROLLBACK;",
        "SELECT 'FINANCIAL_ROLLBACK_COMPLETE_happy';",
    ]
    positions = [source.find(token) for token in ordered]
    require(all(position >= 0 for position in positions) and positions == sorted(positions),
            "materialization assertions and real drain precede marker, strict replay and rollback")


def injection_setup_contract(source):
    require("DO $$ DECLARE v_target text; BEGIN" in source, "local variable distinct from column")
    require("v_target:=(SELECT i.target FROM pg_temp.financial_fault_input i);" in source,
            "qualified fault input column")
    require("CASE v_target" in source and "DECLARE target " not in source,
            "dispatch uses unambiguous local variable")
    verified_call = "SELECT demo_financial_lab.expect_financial_fault(:'context_id'::uuid,:'expected');\nRESET ROLE;"
    observed = "SELECT 'FINANCIAL_INJECTION_OBSERVED_'||i.target FROM pg_temp.financial_fault_input i;"
    require(source.count(observed) == 1 and verified_call + "\n" + observed in source,
            "observed marker follows verified injection and role reset immediately")
    require(source.index(observed) < source.index("SELECT body FROM financial_before"),
            "separate injection evidence from subsequent snapshot assertion")


class FinancialBehaviorSuiteTests(unittest.TestCase):
    def test_full_snapshot_contract(self):
        snapshot_contract(read("assertions.sql"))

    def test_snapshot_mutants_reject_missing_auth_and_row_filter(self):
        source = read("assertions.sql")
        for mutant in (
            source.replace("'public','auth',", "'public',", 1),
            source.replace("FROM %I.%I t'", "FROM %I.%I t WHERE false'", 1),
            source.replace("jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)", "jsonb_agg(to_jsonb(t)-'updated_at')", 1),
        ):
            with self.subTest(mutant=mutant[:40]), self.assertRaises(ValueError):
                snapshot_contract(mutant)

    def test_manual_preimages_cover_two_tenants_and_every_column(self):
        source = read("assertions.sql")
        for required in (
            "count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels)<>2",
            "GROUP BY schema_name,table_name,row_id HAVING count(*)<>1",
            "x.schema_name IS DISTINCT FROM 'public'",
            "x.row_id IS NULL OR x.organization_id IS NULL",
            "x.snapshot IS NULL OR jsonb_typeof(x.snapshot)<>'object'",
            "SELECT to_jsonb(t) FROM %I.%I t WHERE id=$1",
            "actual->>'id' IS DISTINCT FROM x.row_id::text",
            "actual->>'organization_id' IS DISTINCT FROM x.organization_id::text",
            "actual IS DISTINCT FROM x.snapshot",
        ):
            self.assertIn(required, source)

    def test_actual_deferred_constraints_and_transport(self):
        deferred_contract(read("assertions.sql"))

    def test_deferred_success_stub_and_wrong_owner_are_rejected(self):
        source = read("assertions.sql")
        for mutant in (
            source.replace("SET CONSTRAINTS ALL IMMEDIATE;", "NULL;"),
            source.replace("PERFORM demo_flow_writer.assert_rpc_transport();", "NULL;"),
            source.replace("current_user<>'postgres'", "false"),
        ):
            with self.assertRaises(ValueError):
                deferred_contract(mutant)

    def test_happy_calls_real_engine_and_materialization_verifier(self):
        source = read("happy.sql")
        self.assertEqual(source.count("demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)"), 2)
        self.assertIn("PERFORM demo_flow_writer.verify_materialized(v_run);", source)
        for table, count in (("events", 13), ("receipts", 13), ("current_approvals", 3), ("simulated_payments", 1)):
            self.assertIn(f"FROM demo_flow_writer.{table} WHERE lineage_id=v_lineage)<>{count}", source)
        for table in ("seed_checkpoints", "execution_receipts"):
            self.assertIn(f"FROM demo_flow_writer.{table} WHERE execution_run_id=v_run)<>1", source)
        self.assertIn("context_id=(SELECT context_id FROM pg_temp.financial_context))<>1", source)
        self.assertIn("x.checkpoint_id=c.id AND x.projection_sha256=c.projection_sha256", source)
        self.assertIn("c.projection_sha256=demo_flow_writer.projection_sha256(v_lineage)", source)

    def test_replay_requires_same_result_and_all_persistent_rows(self):
        source = read("happy.sql")
        self.assertIn("(SELECT result FROM replay_result) IS DISTINCT FROM (SELECT result FROM financial_result)", source)
        self.assertIn("pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM before_replay)", source)
        self.assertNotIn("EXCEPTION WHEN", source)
        self.assertLess(source.index("CREATE TEMP TABLE before_replay"), source.index("AS replay \\gset"))
        self.assertLess(source.index("SELECT demo_financial_lab.flush_deferred();"), source.index("AS replay \\gset"))

    def test_materialization_evidence_requires_real_guard_drain_before_replay(self):
        materialization_evidence_contract(read("happy.sql"))

    def test_premature_materialization_marker_or_missing_drain_is_rejected(self):
        source = read("happy.sql")
        marker = "SELECT 'FINANCIAL_MATERIALIZATION_ASSERTIONS_COMPLETE_happy';"
        for mutant in (
            source.replace(marker, "").replace("SELECT demo_financial_lab.flush_deferred();", marker + "\nSELECT demo_financial_lab.flush_deferred();"),
            source.replace("SELECT demo_financial_lab.flush_deferred();", "SELECT true;"),
            source.replace("\\echo FINANCIAL_PHASE_happy_materialized", "").replace(marker, "\\echo FINANCIAL_PHASE_happy_materialized\n" + marker),
        ):
            with self.assertRaises(ValueError):
                materialization_evidence_contract(mutant)

    def test_exact_injection_and_unrelated_error_rethrow(self):
        exact_fault_contract(read("fault.sql"))

    def test_fault_target_is_unambiguous_and_observed_marker_follows_verification(self):
        injection_setup_contract(read("fault.sql"))

    def test_ambiguous_target_or_premature_observed_marker_is_rejected(self):
        source = read("fault.sql")
        marker = "SELECT 'FINANCIAL_INJECTION_OBSERVED_'||i.target FROM pg_temp.financial_fault_input i;"
        for mutant in (
            source.replace("v_target", "target").replace("i.target FROM pg_temp.financial_fault_input i", "target FROM financial_fault_input"),
            source.replace(marker, "").replace("SELECT demo_financial_lab.expect_financial_fault", marker + "\nSELECT demo_financial_lab.expect_financial_fault"),
            source.replace("v_target:=(SELECT i.target FROM pg_temp.financial_fault_input i);", "v_target:=(SELECT target FROM financial_fault_input);"),
        ):
            with self.assertRaises(ValueError):
                injection_setup_contract(mutant)

    def test_catch_all_or_skipped_injection_is_rejected(self):
        source = read("fault.sql")
        for mutant in (
            source.replace("IF state<>'P0T01' OR msg IS DISTINCT FROM expected THEN RAISE; END IF;", "NULL;"),
            source.replace("IF NOT rejected THEN RAISE EXCEPTION 'Required injected fault not reached'; END IF;", "NULL;"),
            source.replace("PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);", "NULL;"),
        ):
            with self.assertRaises(ValueError):
                exact_fault_contract(mutant)

    def test_fault_wrappers_reuse_shared_checked_suite(self):
        for target in TARGETS:
            expected = f"\\set fault_target {target}\n\\ir fault.sql\n"
            self.assertEqual(read(f"{target}.sql"), expected)
            self.assertEqual((ROOT / "references" / f"{target}.sql").read_text(encoding="utf-8"), expected)

    def test_happy_and_fault_restore_rows_after_outer_rollback(self):
        for name, snapshot in (("happy", "before_happy"), ("fault", "before_fault_outer")):
            source = read(f"{name}.sql")
            self.assertLess(source.index(f"CREATE TEMP TABLE {snapshot}"), source.index("BEGIN;"))
            rollback = source.index("ROLLBACK;")
            self.assertGreater(source.index(f"SELECT body FROM {snapshot}"), rollback)
            self.assertGreater(source.rindex("SELECT pg_temp.assert_manual_sentinels();"), rollback)
        self.assertIn("SELECT body FROM financial_before", read("fault.sql"))

    def test_fail_closed_scope_and_no_canonical_override(self):
        all_sql = "\n".join(read(name) for name in ("assertions.sql", "happy.sql", "fault.sql"))
        code = executable(all_sql)
        self.assertEqual(code.count("\\set ON_ERROR_STOP on"), 3)
        self.assertIn("current_setting('server_version_num')<>'170006'", code)
        self.assertIn("Exactly one issued financial context required", code)
        self.assertNotRegex(code, r"(?i)\bCOMMIT\s*;")
        self.assertNotRegex(code, r"(?i)\b(?:DISABLE\s+TRIGGER|session_replication_role|CREATE\s+OR\s+REPLACE)\b")
        self.assertNotRegex(code, r"(?i)CREATE\s+FUNCTION\s+(?:public|demo_flow_writer|demo_fixture_identity)\.")
        self.assertNotRegex(code, r"(?i)\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+(?:public|auth|demo_flow_writer|demo_fixture_identity)\.")

    def test_exact_success_markers_require_assertions_then_rollback(self):
        happy = read("happy.sql")
        self.assertLess(happy.index("FINANCIAL_ASSERTIONS_COMPLETE_happy"), happy.index("ROLLBACK;"))
        self.assertGreater(happy.index("FINANCIAL_ROLLBACK_COMPLETE_happy"), happy.index("ROLLBACK;"))
        fault = read("fault.sql")
        self.assertLess(fault.index("FINANCIAL_ASSERTIONS_COMPLETE_'||target"), fault.index("ROLLBACK;"))
        self.assertGreater(fault.index("FINANCIAL_ROLLBACK_COMPLETE_'||:'fault_target'"), fault.index("ROLLBACK;"))


if __name__ == "__main__":
    unittest.main()
