"""Source/derivation regressions only; PostgreSQL and real authority are NOT_RUN.

These tests do not emulate SQL or substitute an authorization oracle. Runtime
positive/negative cases must execute the pinned real functions in Actions.
"""
from pathlib import Path
import hashlib
import re
import unittest


HERE = Path(__file__).resolve().parent
UPSTREAM = HERE.parent / "demo-financial-compile-recovery" / "upstream"
PATCH = HERE / "sql" / "replay-correction.sql"
PINS = {
    "flow/issuer/10-issuer.sql": "8c739036ea948163d83617d6f59068f5b414a641c251c7ac4115be82b3d0a81e",
    "authentic/bridge.sql": "69bbcd2ec825953ca4fda822ec5fde143f1f70a5120f372ee3c211e96523c5b2",
    "authentic/producer.sql": "f0a14f683ee524527ed3b7f29305bc793f7f9e3d5581b4332da72f8fb8bb55a6",
    "flow/issuer/11-atomic-entry.sql": "a2093b45e37c922f0505e496581381b4b5a3d105d3f0e583d694ef92e9c47cb3",
    "flow/issuer/13-readonly-verifiers.sql": "15ff74c47b4b33840fceb5ec918f25749f9c9c4ef761c61a976b438a60f81dcd",
    "flow/issuer/16-owner-registry.sql": "a74d69ed6d19356ba36fe27d7070a496e99c3ef5cec7a030c3b96b609a64463b",
    "flow/sql/01-private.sql": "e78412eb7e0efe59749c7f7077b8955df5752a4a8d911a02822ddf56c57dd9a2",
    "flow/sql/04-engine.sql": "44460cb9e8e4028ad02e3eb2485ca451ab9489208f84b9c2a85917d45a642f1d",
}
ORIGINAL_FUNCTION_SHA256 = "fa7f2186dff8847f265148380b5726f6a02cf27709c79b2b39f633edb377194c"
ORIGINAL_PROSRC_SHA256 = "7714ae2d6814df546d30c9abfcab3a4eaa51176b5887e4d5f1b2e169788664b1"
DECLARATIONS = (
    " retry_origin jsonb; retry_clients jsonb; retry_bindings jsonb; retry_ids uuid[];\n"
    " retry_owner oid; retry_origin_oid oid; retry_app record;\n"
    " retry_execution demo_flow_writer.execution_receipts; retry_checkpoint demo_flow_writer.seed_checkpoints;\n"
    " retry_marker timestamptz;\n"
)
BEGIN = " -- BEGIN SAME_CONTEXT_RETRY_CORRECTION\n"
END = " -- END SAME_CONTEXT_RETRY_CORRECTION\n"


def digest(body):
    return hashlib.sha256(body).hexdigest()


def read(path):
    # Git LF source; Windows worktree CRLF is the only normalization allowed here.
    return path.read_bytes().replace(b"\r\n", b"\n").decode("utf-8")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def original_function():
    source = read(UPSTREAM / "flow/issuer/10-issuer.sql")
    start = source.index("CREATE FUNCTION demo_flow_writer.prepare_authorized_run(")
    return source[start:source.index("END $$;", start) + len("END $$;")]


def parts(source):
    require(source.count(BEGIN) == source.count(END) == 1, "one bounded correction branch")
    start = source.index("CREATE OR REPLACE FUNCTION demo_flow_writer.prepare_authorized_run(")
    statement = source[start:].strip()
    before, rest = statement.split(BEGIN)
    branch, after = rest.split(END)
    return statement, before, branch, after


def derivation_contract(source):
    statement, before, branch, after = parts(source)
    require(statement.count(DECLARATIONS) == 1, "exact additional declarations")
    restored = (before + after).replace(DECLARATIONS, "", 1)
    restored = restored.replace("CREATE OR REPLACE FUNCTION ", "CREATE FUNCTION ", 1)
    require(restored == original_function(), "original authority and initial anti-adoption path unchanged")
    require(digest(restored.encode()) == ORIGINAL_FUNCTION_SHA256, "pinned original statement")


def retry_contract(source):
    derivation_contract(source)
    _, before, branch, after = parts(source)
    require("c:=demo_flow_writer.read_server_context(p_context_id);" in before,
            "real current authority before retry lookup")
    require("RAISE EXCEPTION 'DEMO_TRUSTED_CONTEXT_CONFLICT'" in before,
            "common context/manifest/expiry validation before branch")
    require("IF c->>'purpose'='initial' THEN\n  SELECT a.* INTO existing" in branch,
            "same initial context only")
    require("WHERE a.context_id=p_context_id FOR SHARE;\n  IF FOUND THEN" in branch,
            "existing authorization required and locked")
    require("existing.context_id,existing.run_id,existing.lineage_id,existing.organization_id," in branch,
            "exact original authorization mapping")
    require("existing.identity_receipt_id,existing.identity_version,existing.origin_identity_sha256," in branch,
            "same identity/version/origin")
    require("existing.manifest_sha256,existing.principal,existing.not_before,existing.expires_at," in branch,
            "same manifest/principal/authority window")
    require("existing.initiator_kind,existing.initiator_user_id,existing.initiator_job_id)" in branch,
            "same scheduler/human authority description")
    require("r.purpose IS DISTINCT FROM 'initial'" in branch and "l.id,l.initial_run_id" in branch,
            "own original initial run and lineage")
    require(branch.count("PERFORM demo_flow_writer.assert_issued(existing.run_id);") == 2,
            "real authorization before work and revalidated before return")
    for required in (
        "retry_origin:=demo_fixture_identity.verify_preparation_origin(existing.identity_receipt_id);",
        "AND NOT prosecdef AND prorettype='jsonb'::regtype",
        "has_function_privilege(retry_app.oid,retry_origin_oid,'EXECUTE')",
        "has_table_privilege(retry_app.oid,'demo_fixture_identity.prepared_receipts','INSERT,UPDATE,DELETE,TRUNCATE')",
        "i->>'source_sha256' IS DISTINCT FROM existing.origin_identity_sha256",
        "i->>'source_sha256' IS DISTINCT FROM demo_flow_writer.sha256(i-'source_sha256')",
        "i->>'bindings_sha256' IS DISTINCT FROM existing.bindings_sha256",
        "i->>'bindings_sha256' IS DISTINCT FROM demo_flow_writer.sha256(i->'bindings')",
        "retry_origin->>'source_run_id' IS DISTINCT FROM i->>'source_run_id'",
        "retry_origin->>'client_bindings_sha256' IS DISTINCT FROM demo_flow_writer.sha256(retry_clients)",
        "retry_origin->>'scheduler_approval_id'=a.scheduler_approval_id::text",
        "retry_origin->'scheduler_snapshot'=a.scheduler_snapshot",
        "retry_origin->'transport_snapshot'=a.transport_snapshot",
        "(ident.source_run_id,ident.source_version,ident.category_id,ident.category_snapshot)",
        "((i->>'source_run_id')::uuid,i->>'source_version',(i->>'category_id')::uuid,i->'category_snapshot')",
        "SELECT jsonb_agg(to_jsonb(w)-'lineage_id' ORDER BY w.fixture_id) INTO retry_bindings",
        "i->'bindings' IS DISTINCT FROM retry_bindings",
        "cardinality(retry_ids) IS DISTINCT FROM 9 OR array_position(retry_ids,NULL) IS NOT NULL",
        "count(DISTINCT u.id) FROM unnest(retry_ids) u(id))<>9",
        "PERFORM demo_flow_writer.verify_materialized(existing.run_id);",
        "WHERE x.execution_run_id=existing.run_id FOR SHARE;",
        "WHERE x.id=retry_execution.checkpoint_id FOR SHARE;",
        "retry_execution.materialization IS DISTINCT FROM retry_checkpoint.materialization_status",
        "retry_checkpoint.execution_run_id IS DISTINCT FROM existing.run_id",
        "retry_checkpoint.lineage_id IS DISTINCT FROM existing.lineage_id",
        "retry_checkpoint.projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(existing.lineage_id)",
        "retry_checkpoint.checked_at IS DISTINCT FROM retry_marker",
        "retry_checkpoint.checked_at<existing.not_before OR retry_checkpoint.checked_at>=existing.expires_at",
    ):
        require(required in branch, "missing existing-context security check: " + required)
    code = re.sub(r"--[^\n]*", "", branch)
    require(not re.search(r"(?im)^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|EXECUTE)\b", code),
            "retry branch must not issue or materialize rows")
    require("verify_identity_receipt(" not in code and "verify_replay_identity_receipt(" not in code,
            "no initial adoption bridge or fictional new-purpose replay adapter on existing retry")
    require("ident.source_sha256 IS DISTINCT FROM existing.origin_identity_sha256" not in code
            and "ident.bindings_sha256 IS DISTINCT FROM existing.bindings_sha256" not in code,
            "external and internal seal domains remain distinct")
    require("i:=demo_flow_writer.verify_identity_receipt((c->>'identity_receipt_id')::uuid);" in after,
            "first call still runs real anti-adoption verifier")


class ReplayCorrectionSourceTests(unittest.TestCase):
    def test_all_real_dependencies_remain_pinned(self):
        for rel, expected in PINS.items():
            with self.subTest(path=rel):
                self.assertEqual(digest(read(UPSTREAM / rel).encode()), expected)

    def test_derivation_recovers_every_original_function_byte(self):
        derivation_contract(read(PATCH))
        body = original_function().split("AS $$", 1)[1].rsplit("$$;", 1)[0]
        self.assertEqual(digest(body.encode()), ORIGINAL_PROSRC_SHA256)

    def test_retry_contract_uses_real_origin_authority_and_projection(self):
        retry_contract(read(PATCH))

    def test_only_one_invoker_function_replaced_without_acl_or_adapter_change(self):
        code = re.sub(r"--[^\n]*", "", read(PATCH))
        self.assertEqual(re.findall(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+([\w.]+)", code),
                         ["demo_flow_writer.prepare_authorized_run"])
        self.assertIn("LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$", code)
        self.assertNotRegex(code, r"(?i)\b(?:GRANT|REVOKE|ALTER\s+ROLE|CREATE\s+ROLE|SECURITY\s+DEFINER)\b")

    def test_historical_failure_and_generic_replay_hold_remain_visible(self):
        original = original_function()
        self.assertLess(original.index("i:=demo_flow_writer.verify_identity_receipt("),
                        original.index("SELECT * INTO existing FROM demo_flow_writer.authorization_receipts"))
        bridge = read(UPSTREAM / "authentic/bridge.sql")
        self.assertIn("RAISE EXCEPTION 'DEMO_FINANCIAL_ADOPTION_DENIED' USING ERRCODE='23514'", bridge)
        issuer = read(UPSTREAM / "flow/issuer/10-issuer.sql")
        self.assertIn("RAISE EXCEPTION 'HOLD_REPLAY_ORIGIN_ADAPTER_REQUIRED' USING ERRCODE='42501'", issuer)
        _, _, _, fallback = parts(read(PATCH))
        self.assertIn("i:=demo_flow_writer.verify_replay_identity_receipt((c->>'identity_receipt_id')::uuid,(c->>'lineage_id')::uuid);", fallback)

    def test_original_initial_or_generic_replay_changes_are_rejected(self):
        source = read(PATCH)
        for old, new in (
            ("i:=demo_flow_writer.verify_identity_receipt((c->>'identity_receipt_id')::uuid);", "i:='{}';"),
            ("i:=demo_flow_writer.verify_replay_identity_receipt((c->>'identity_receipt_id')::uuid,(c->>'lineage_id')::uuid);", "i:='{}';"),
            ("c:=demo_flow_writer.read_server_context(p_context_id);", "c:='{}';"),
        ):
            with self.subTest(original=old), self.assertRaises(ValueError):
                retry_contract(source.replace(old, new))

    def test_missing_existing_authority_origin_or_liveness_is_rejected(self):
        source = read(PATCH)
        for old, new in (
            ("WHERE a.context_id=p_context_id FOR SHARE;", "WHERE a.run_id=p_context_id FOR SHARE;"),
            ("PERFORM demo_flow_writer.assert_issued(existing.run_id);", "PERFORM 1;"),
            ("retry_origin:=demo_fixture_identity.verify_preparation_origin(existing.identity_receipt_id);", "retry_origin:='{}';"),
            ("i->>'source_sha256' IS DISTINCT FROM existing.origin_identity_sha256", "false"),
            ("retry_origin->'scheduler_snapshot'=a.scheduler_snapshot", "true"),
        ):
            with self.subTest(original=old), self.assertRaises(ValueError):
                retry_contract(source.replace(old, new))

    def test_incomplete_mapping_wrong_seal_domain_or_snapshot_drift_bypass_is_rejected(self):
        source = read(PATCH)
        for old, new in (
            ("to_jsonb(w)-'lineage_id'", "to_jsonb(w)"),
            ("i->'bindings' IS DISTINCT FROM retry_bindings", "false"),
            ("i->>'bindings_sha256' IS DISTINCT FROM existing.bindings_sha256", "ident.bindings_sha256 IS DISTINCT FROM existing.bindings_sha256"),
            ("PERFORM demo_flow_writer.verify_materialized(existing.run_id);", "PERFORM 1;"),
            ("retry_checkpoint.checked_at IS DISTINCT FROM retry_marker", "false"),
            ("retry_checkpoint.execution_run_id IS DISTINCT FROM existing.run_id", "false"),
        ):
            with self.subTest(original=old), self.assertRaises(ValueError):
                retry_contract(source.replace(old, new))

    def test_new_context_or_unfinished_issuance_success_shortcut_is_rejected(self):
        source = read(PATCH)
        for old, new in (
            ("IF c->>'purpose'='initial' THEN\n  SELECT a.* INTO existing", "IF true THEN\n  SELECT a.* INTO existing"),
            ("FOR SHARE;\n  IF FOUND THEN", "FOR SHARE;\n  IF true THEN"),
            ("WHERE x.execution_run_id=existing.run_id FOR SHARE;", "WHERE true FOR SHARE;"),
        ):
            with self.subTest(original=old), self.assertRaises(ValueError):
                retry_contract(source.replace(old, new))


if __name__ == "__main__":
    unittest.main()
