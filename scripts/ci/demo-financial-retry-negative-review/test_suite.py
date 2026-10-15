"""Offline failure-path tests. No database, external service or execution."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retry_negative_suite_test_subject", HERE / "suite.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)


class SuiteContractTests(unittest.TestCase):
    def stream(self, case_id):
        return "\n".join(suite.expected_markers(case_id)) + "\n"

    def test_nine_distinct_cases_with_accurate_boundaries(self):
        cases = suite.CASES
        self.assertEqual(9, len(cases))
        self.assertEqual(9, len({case["id"] for case in cases}))
        self.assertEqual(1, sum(case["phase"] == "fresh" for case in cases))
        boundary = [case for case in cases if case.get("rejection_stage") == "mutation"]
        self.assertEqual(["guarded_tenant_run_rebinding"], [case["id"] for case in boundary])
        self.assertEqual("BLOCKED", suite.BLOCKED_CASES[0]["status"])

    def test_unknown_case_cannot_render_or_inject(self):
        for invalid in ("missing", "x'; COMMIT; --", None):
            with self.subTest(case=invalid), self.assertRaises(ValueError):
                suite.negative_sql(invalid)

    def test_exact_source_set_type_and_hash_fail_closed(self):
        pins = suite.CONTRACT["external_sources"]
        with self.assertRaises(ValueError):
            suite.verify_sources({})
        bodies = {name: b"unreviewed" for name in pins}
        with self.assertRaises(ValueError):
            suite.verify_sources(bodies)
        bodies["extra.sql"] = b"x"
        with self.assertRaises(ValueError):
            suite.verify_sources(bodies)
        bodies = {name: "text" for name in pins}
        with self.assertRaises(TypeError):
            suite.verify_sources(bodies)

    def test_fixed_head_required_before_fixture_use(self):
        with self.assertRaisesRegex(ValueError, "HEAD"):
            suite.suite_sql("foreign_bound_invoice_id", {}, author_fix_head="old")

    def test_composition_preserves_each_fixture_byte_and_order(self):
        # Small synthetic pins exercise the exact-byte policy, not the real SQL.
        import hashlib
        bodies = {"fixture.sql": b"a\r\n", "prepare-context.sql": b"b\n", "assertions.sql": b"c\n"}
        pins = {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
                for name, data in bodies.items()}
        with patch.dict(suite.CONTRACT, {"external_sources": pins}):
            result = suite.suite_sql("foreign_bound_invoice_id", bodies,
                                     author_fix_head=suite.CONTRACT["author_fix_head"])
            self.assertTrue(result.startswith(b"a\r\n\nb\n\nc\n\n"))
            changed = dict(bodies, **{"fixture.sql": b"a\n"})
            with self.assertRaises(ValueError):
                suite.verify_sources(changed)

    def test_native_markers_never_imply_cleanup_or_admission(self):
        for case in suite.CASES:
            result = suite.inspect_result(case["id"], stdout=self.stream(case["id"]), stderr="", returncode=0)
            self.assertEqual("ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP", result["status"])
            self.assertEqual("NOT_ADMITTED", result["admission"])
            self.assertEqual("NOT_RUN", result["business_commit"])
            self.assertEqual("NOT_ESTABLISHED", result["sequence_rollback"])

    def test_incomplete_duplicate_reordered_foreign_and_error_receipts_fail(self):
        name = "mutable_supplier_origin_drift"
        markers = suite.expected_markers(name)
        streams = ["", "\n".join(markers[:-1]), "\n".join(markers + markers[-1:]),
                   "\n".join(reversed(markers)), self.stream(name) + "RETRY_NEGATIVE_FOREIGN_CASE\n",
                   self.stream(name) + "ERROR: unexpected SQL error\n"]
        for stdout in streams:
            with self.subTest(stdout=stdout):
                self.assertEqual("FAIL", suite.inspect_result(name, stdout=stdout, stderr="", returncode=0)["status"])
        self.assertEqual("FAIL", suite.inspect_result(name, stdout=self.stream(name), stderr="FATAL: lost session", returncode=0)["status"])
        self.assertEqual("FAIL", suite.inspect_result(name, stdout=self.stream(name), stderr="", returncode=1)["status"])

    def test_negative_rpc_handler_accepts_only_the_native_contract(self):
        for case in suite.CASES:
            body = suite._denial(case)
            self.assertIn("EXCEPTION WHEN SQLSTATE '" + case["expected_sqlstate"] + "'", body)
            self.assertIn("IS DISTINCT FROM '" + case["expected_message"] + "' THEN RAISE", body)
            self.assertNotIn("WHEN OTHERS", body)
            if case.get("rejection_stage") == "mutation":
                self.assertNotIn("PERFORM demo_flow_writer.prepare_execute_checkpoint", body)
            else:
                self.assertLess(body.index("SET LOCAL ROLE"), body.index("EXCEPTION WHEN"))

    def test_business_suffix_has_no_commit_or_guard_bypass(self):
        import re
        for case in suite.CASES:
            sql = suite.negative_sql(case["id"]).decode()
            sql_without_comments = re.sub(r"--[^\n]*", "", sql)
            self.assertNotRegex(sql_without_comments, r"(?i)\b(?:COMMIT|GRANT|TRUNCATE)\b|DISABLE\s+TRIGGER|SET\s+(?:LOCAL\s+)?session_replication_role")
            self.assertNotRegex(sql_without_comments, r"(?i)CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION")
            self.assertEqual(1, len(re.findall(r"(?m)^ROLLBACK;", sql)))
            if case["phase"] == "materialized":
                self.assertLess(sql.index("END $retry_positive$"), sql.index("CREATE TEMP TABLE retry_negative_before_mutation"))


if __name__ == "__main__":
    unittest.main()
