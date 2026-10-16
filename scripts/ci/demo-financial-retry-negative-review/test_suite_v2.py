"""Version2 integration gates; native SQL remains the author's responsibility."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(path):
    spec = importlib.util.spec_from_file_location("origin_v2_integration_test_subject", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


review = load(HERE / "suite_v2.py")


class VersionTwoIntegrationTests(unittest.TestCase):
    def test_nine_ids_and_exact_denial_contracts_are_preserved(self):
        self.assertEqual([c["id"] for c in review.BASE.CASES], [c["id"] for c in review.CASES])
        for before, after in zip(review.BASE.CASES, review.CASES):
            for key in before.keys() - {"mutation_sql", "proof_sql"}:
                self.assertEqual(before[key], after[key])

    def test_seven_unaffected_rendered_cases_are_byte_identical(self):
        affected = set(review.VERSION_CONTRACT["affected_cases"])
        unchanged = []
        for case in review.CASES:
            before = review.BASE.negative_sql(case["id"])
            after = review.negative_sql(case["id"])
            if case["id"] not in affected:
                self.assertEqual(before, after)
                unchanged.append(case["id"])
            else:
                self.assertNotEqual(before, after)
                self.assertEqual(1, after.count(review.source_probe_marker(case["id"]).encode()))
                self.assertLess(after.index(b"END $retry_positive$"), after.index(review.ORIGIN.source_sql_probe().encode()))
                self.assertLess(after.index(review.ORIGIN.source_sql_probe().encode()), after.index(case["mutation_sql"].encode()))
        self.assertEqual(7, len(unchanged))

    def test_original_renderer_drift_cannot_silently_replace_another_fragment(self):
        for case_id in review.VERSION_CONTRACT["affected_cases"]:
            with patch.object(review.BASE, "negative_sql", return_value=b"unexpected original fragment"):
                with self.assertRaisesRegex(ValueError, "fragment contract drift"):
                    review.negative_sql(case_id)

    def test_historical_preparation_failure_is_never_negative_pass(self):
        for case_id in review.VERSION_CONTRACT["affected_cases"]:
            partial = "\n".join(review.expected_markers(case_id)[:2])
            result = review.inspect_result(case_id, stdout=partial,
                stderr="ERROR: column a.identity_receipt_id does not exist", returncode=3)
            self.assertEqual("FAIL", result["status"])
            self.assertEqual("MISSING_OR_INVALID", result["source_binding_probe"])

    def test_affected_stream_requires_one_probe_between_positive_and_mutation(self):
        for case_id in review.VERSION_CONTRACT["affected_cases"]:
            markers = review.expected_markers(case_id)
            probe = review.source_probe_marker(case_id)
            valid = markers[:2] + [probe] + markers[2:]
            result = review.inspect_result(case_id, stdout="\n".join(valid), stderr="", returncode=0)
            self.assertEqual("ASSERTIONS_OBSERVED_PENDING_OWNED_CLEANUP", result["status"])
            self.assertEqual(2, result["review_provider_version"])
            self.assertEqual("NOT_ADMITTED", result["admission"])
            for invalid in (markers, valid + [probe], [probe] + markers, markers + [probe]):
                self.assertEqual("FAIL", review.inspect_result(case_id, stdout="\n".join(invalid), stderr="", returncode=0)["status"])

    def test_cherry_pick_requires_no_supplemental_files(self):
        # A disposable directory beneath this explicit workspace package is the
        # only copy target, and is checked before its automatic recursive cleanup.
        with tempfile.TemporaryDirectory(prefix="origin-v2-isolated-", dir=HERE) as temporary:
            isolated = Path(temporary).resolve()
            self.assertEqual(HERE, isolated.parent)
            names = list(review.VERSION_CONTRACT["original_files"]) + [
                "origin-v2-contract.json", "origin_materialization_cases_v2.py", "suite_v2.py"]
            for name in names:
                shutil.copyfile(HERE / name, isolated / name)
            module = load(isolated / "suite_v2.py")
            self.assertEqual(9, len(module.CASES))
            self.assertEqual(2, module.PROVIDER_VERSION)
            for case in module.CASES:
                self.assertTrue(module.negative_sql(case["id"]))

    def test_unreviewed_head_and_unknown_case_fail(self):
        with self.assertRaisesRegex(ValueError, "HEAD"):
            review.suite_sql(review.CASES[0]["id"], {}, author_fix_head="different")
        with self.assertRaises(ValueError):
            review.negative_sql("unknown")


if __name__ == "__main__":
    unittest.main()
