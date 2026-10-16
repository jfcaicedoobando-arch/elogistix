"""Offline integration gates for the additional providers; SQL stays NOT_RUN."""
import importlib.util
from pathlib import Path
import re
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retry_supplement_suite_tests", HERE / "supplemental_suite.py")
suite = importlib.util.module_from_spec(spec)
spec.loader.exec_module(suite)


class SupplementalIntegrationTests(unittest.TestCase):
    def test_original_nine_files_remain_exactly_locked(self):
        suite.verify_delivery()
        self.assertEqual(9, len(suite.LOCK["original_files"]))
        with patch.object(Path, "read_bytes", return_value=b"changed original delivery"):
            with self.assertRaisesRegex(ValueError, "Original PR357 delivery changed"):
                suite.verify_delivery()

    def test_additional_cases_do_not_shadow_original_cases(self):
        original = {case["id"] for case in suite.BASE.CASES}
        additional = {case["id"] for case in suite.CASES}
        self.assertEqual(3, len(additional))
        self.assertFalse(original & additional)
        self.assertEqual(2, sum(case["phase"] == "fresh" for case in suite.CASES))
        self.assertEqual(1, sum(case["phase"] == "materialized" for case in suite.CASES))
        for name in original | {"unknown", "x'; COMMIT; --"}:
            with self.subTest(name=name), self.assertRaises(ValueError):
                suite.negative_sql(name)

    def test_rendering_retains_rollback_and_uncaught_positive_control(self):
        for case in suite.CASES:
            body = suite.negative_sql(case["id"]).decode()
            executable = re.sub(r"--[^\n]*", "", body)
            self.assertEqual(1, len(re.findall(r"(?m)^ROLLBACK;", body)))
            self.assertNotRegex(executable, r"(?i)\b(?:COMMIT|GRANT|TRUNCATE)\b|DISABLE\s+TRIGGER|SET\s+(?:LOCAL\s+)?session_replication_role")
            self.assertLess(body.index("RETRY_SUPPLEMENT_MUTATION_CONFIRMED"), body.index("DO $retry_denial$"))
            self.assertIn("SQLSTATE '" + case["expected_sqlstate"] + "'", body)
            self.assertIn("IS DISTINCT FROM '" + case["expected_message"] + "' THEN RAISE", body)
            if case["phase"] == "materialized":
                self.assertLess(body.index("END $retry_positive$"), body.index("CREATE TEMP TABLE retry_negative_before_mutation"))

    def test_unreviewed_fix_and_missing_fixtures_are_rejected(self):
        name = suite.CASES[0]["id"]
        with self.assertRaisesRegex(ValueError, "HEAD"):
            suite.suite_sql(name, {}, author_fix_head="unreviewed")
        with self.assertRaises(ValueError):
            suite.suite_sql(name, {}, author_fix_head=suite.BASE.CONTRACT["author_fix_head"])

    def test_complete_marker_stream_cannot_bypass_sequence_evidence(self):
        name = suite.CASES[0]["id"]
        stdout = "\n".join(suite.expected_markers(name))
        result = suite.inspect_result(name, stdout=stdout, stderr="", returncode=0)
        self.assertEqual("FAIL", result["status"])

    def test_observed_sequence_change_does_not_become_rollback_or_failure(self):
        name = suite.CASES[0]["id"]
        stdout = "\n".join(suite.expected_markers(name))
        observation = {"status": "COMPLETE", "comparison": "CHANGED"}
        with patch.object(suite.SEQUENCES, "inspect_output", return_value=observation):
            result = suite.inspect_result(name, stdout=stdout, stderr="", returncode=0)
        self.assertEqual("ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP", result["status"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])
        self.assertEqual("NOT_ADMITTED", result["admission"])
        self.assertEqual(observation, result["sequences"])

    def test_native_errors_exit_failure_and_marker_reordering_fail(self):
        name = suite.CASES[-1]["id"]
        markers = suite.expected_markers(name)
        stdout = "\n".join(markers)
        with patch.object(suite.SEQUENCES, "inspect_output", return_value={"status": "COMPLETE"}):
            for text, stderr, code in (
                (stdout, "ERROR: native failure", 0), (stdout, "", 1),
                ("\n".join(reversed(markers)), "", 0),
                (stdout + "\n" + markers[-1], "", 0),
            ):
                self.assertEqual("FAIL", suite.inspect_result(name, stdout=text, stderr=stderr, returncode=code)["status"])

    def test_sequence_calibration_is_temp_only_after_native_positive_control(self):
        bodies = {name: b"-- offline composition fixture\n" for name in suite.BASE.CONTRACT["external_sources"]}
        with patch.object(suite.BASE, "verify_sources"):
            sql = suite.sequence_control_sql(bodies, author_fix_head=suite.BASE.CONTRACT["author_fix_head"]).decode()
        self.assertLess(sql.index("CREATE TEMP SEQUENCE"), sql.index("\nBEGIN;\n"))
        self.assertLess(sql.index("END $retry_positive$"), sql.index("PERFORM pg_catalog.nextval"))
        self.assertEqual(2, len(re.findall(r"PERFORM pg_catalog.nextval\('pg_temp\.retry_negative_review_sequence_probe'", sql)))
        self.assertEqual(1, len(re.findall(r"(?m)^ROLLBACK;", sql)))
        self.assertGreater(sql.index("'probe_after_outer_rollback'"), sql.index("\nROLLBACK;"))
        with self.assertRaisesRegex(ValueError, "HEAD"):
            suite.sequence_control_sql({}, author_fix_head="unreviewed")

    def test_sequence_calibration_needs_native_observations(self):
        stdout = "\n".join("RETRY_SUPPLEMENT_" + stage + "_" + suite.SEQUENCE_CONTROL_ID
                           for stage in ("PREFLIGHT", "POSITIVE_RETRY", "PROBE_ADVANCED", "ROLLBACK_COMPLETE"))
        result = suite.inspect_sequence_control(stdout=stdout, stderr="", returncode=0)
        self.assertEqual("FAIL", result["status"])
        self.assertEqual("NOT_ESTABLISHED", result["temp_probe"]["calibration"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])

    def test_combined_sequence_frames_reach_calibration_without_bypassing_parser(self):
        # Reuse typed parser fixtures; this is synthetic stdout, not SQL evidence.
        fixtures = suite._load("test_sequence_observation")
        frames = {}
        for label, last, called in zip(suite.SEQUENCES.PROBE_LABELS, (17, 24, 24), (False, True, True)):
            frames[label] = fixtures.frame(label, fixtures.snapshot([
                fixtures.entry(schema="pg_temp", name=suite.SEQUENCES.PROBE_NAME, last=last, called=called)
            ], scope="temp_probe"))
        for label in ("baseline_after_prep", "after_positive", "after_outer_rollback"):
            frames[label] = fixtures.frame(label, fixtures.snapshot())
        marker = lambda stage: "RETRY_SUPPLEMENT_" + stage + "_" + suite.SEQUENCE_CONTROL_ID
        stdout = "\n".join((frames["probe_before"], frames["baseline_after_prep"],
                            marker("PREFLIGHT"), marker("POSITIVE_RETRY"), frames["after_positive"],
                            frames["probe_after_advance"], marker("PROBE_ADVANCED"),
                            frames["probe_after_outer_rollback"], frames["after_outer_rollback"],
                            marker("ROLLBACK_COMPLETE")))
        result = suite.inspect_sequence_control(stdout=stdout, stderr="", returncode=0)
        self.assertEqual("ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP", result["status"])
        self.assertEqual("TEMP_PROBE_ADVANCE_OBSERVED_AFTER_OUTER_ROLLBACK", result["temp_probe"]["calibration"])
        self.assertEqual("NOT_ADMITTED", result["admission"])
        self.assertEqual("NOT_RUN", result["native_business_commit"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])
        changed = stdout.replace(frames["probe_after_outer_rollback"], fixtures.frame(
            "probe_after_outer_rollback", fixtures.snapshot([
                fixtures.entry(schema="pg_temp", name=suite.SEQUENCES.PROBE_NAME, last=17, called=False)
            ], scope="temp_probe")))
        self.assertEqual("FAIL", suite.inspect_sequence_control(stdout=changed, stderr="", returncode=0)["status"])


if __name__ == "__main__":
    unittest.main()
