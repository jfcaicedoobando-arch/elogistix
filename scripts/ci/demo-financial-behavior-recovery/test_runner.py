"""Offline rejection tests; never invokes SQL or Docker."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("behavior_runner_test", HERE / "run_ci.py")
r = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = r
spec.loader.exec_module(r)

class RunnerTests(unittest.TestCase):
    def event(self):
        repo = {"full_name": r.REPOSITORY, "owner": {"login": "jfcaicedoobando-arch"}}
        return {"action": "opened", "repository": repo, "pull_request": {"draft": True,
            "head": {"repo": repo, "ref": r.BRANCH, "sha": "a" * 40},
            "base": {"repo": repo, "ref": r.BASE_BRANCH, "sha": r.COMPILE_SHA}}}
    def test_gate_rejects_local_before_any_subprocess(self):
        with patch.dict(r.os.environ, {}, clear=True), patch.object(r.subprocess, "check_output") as cmd:
            with self.assertRaises(RuntimeError): r.run(HERE / "never-created", "happy")
            cmd.assert_not_called()
    def test_gate_binds_full_pr_identity(self):
        env = {"GITHUB_ACTIONS": "true", "GITHUB_EVENT_NAME": "pull_request", "GITHUB_REPOSITORY": r.REPOSITORY}
        r.gate(self.event(), env, "a" * 40)
        mutations = [("draft", False), ("base_sha", "b" * 40), ("base_ref", "main"), ("head_ref", "main"), ("foreign", "foreign/repo")]
        for key, value in mutations:
            event = copy.deepcopy(self.event())
            if key == "draft": event["pull_request"][key] = value
            elif key == "foreign": event["pull_request"]["head"]["repo"]["full_name"] = value
            else:
                side, field = key.split("_")
                event["pull_request"][side][field] = value
            with self.subTest(key=key), self.assertRaises(RuntimeError): r.gate(event, env, "a" * 40)
    def test_includes_are_frozen_and_cannot_escape(self):
        self.assertEqual(r.expand_sql({"sql/a.sql": b"\\ir fault.sql\n", "sql/fault.sql": b"SELECT 1;\n"}, "sql/a.sql"), b"SELECT 1;\n\n")
        for line in (b"\\ir ../../secret.sql", b"\\ir unknown.sql", b"\\ir assertions.sql extra"):
            with self.assertRaises(RuntimeError): r.expand_sql({"sql/a.sql": line}, "sql/a.sql")
        with self.assertRaises(RuntimeError): r.expand_sql({"sql/fault.sql": b"\\ir fault.sql"}, "sql/fault.sql")
    def test_bounded_sqlstate_and_last_phase(self):
        d = r.diagnose(b"FINANCIAL_PHASE_fixture\nFINANCIAL_PHASE_prepare_context\n", b"ERROR:  23514: safe constraint\nLINE 1: INSERT\n", "case", 3)
        self.assertEqual((d["phase"], d["sqlstate"]), ("prepare_context", "23514"))
        self.assertLessEqual(len(d["lines"]), 8)
    def test_never_accepts_missing_cleanup_or_marker(self):
        good = {"cleanup": "confirmed_stopped_and_removed", "shutdown_confirmed": True, "pg_status_3_and_no_pid": True,
                "owned_psql_clients_closed": True, "suite_markers": True, "stages": [{"stage": x, "status": "PASS"} for x in ("install", "synthetic-boundary-privileges", "behavior-happy")]}
        self.assertEqual(r.case_summary(good, "happy", True, ["install"])["status"], "PASS")
        for key in ("cleanup", "shutdown_confirmed", "pg_status_3_and_no_pid", "owned_psql_clients_closed", "suite_markers", "stages"):
            bad = copy.deepcopy(good); bad.pop(key)
            with self.subTest(key=key): self.assertEqual(r.case_summary(bad, "happy", True, ["install"])["status"], "FAIL")
    def test_failure_before_engine_is_not_behavior_pass(self):
        result = {"diagnostic": {"phase": "prepare_context", "sqlstate": "P0001"}}
        self.assertEqual(r.case_summary(result, "happy", False, ["install"])["financial_behavior"], "NOT_RUN")
        self.assertEqual(r.case_summary({"stage": "canonical-catalog"}, "happy", False, ["install"])["financial_behavior"], "NOT_RUN")
    def test_exact_milestone_and_package_hashes(self):
        frozen, pins = r.verify_inputs()
        self.assertEqual(pins["compile_commit"], r.COMPILE_SHA)
        self.assertEqual(len(pins["compile_sources"]), 26)
        self.assertIn("sql/fixture.sql", frozen)
        self.assertNotIn(b"\\ir", r.suite_sql(frozen, "happy"))
    def test_fault_success_requires_observed_exact_injection_marker(self):
        good = {"cleanup": "confirmed_stopped_and_removed", "shutdown_confirmed": True, "pg_status_3_and_no_pid": True,
                "owned_psql_clients_closed": True, "suite_markers": True, "stages": [{"stage": x, "status": "PASS"} for x in ("install", "synthetic-boundary-privileges", "behavior-event")]}
        self.assertEqual(r.case_summary(good, "event", True, ["install"])["status"], "FAIL")
        good["injection_observed"] = True
        self.assertEqual(r.case_summary(good, "event", True, ["install"])["status"], "PASS")
    def test_fault_probe_gate_keeps_replay_fail_without_hiding_independent_probes(self):
        self.assertTrue(r.fault_probes_allowed({"status": "PASS"}))
        partial = {"status": "FAIL", "materialization_assertions": "PASS", "cleanup_verified": True, "diagnostic": {"phase": "happy_materialized"}}
        self.assertTrue(r.fault_probes_allowed(partial))
        for key in ("materialization_assertions", "cleanup_verified", "diagnostic"):
            bad = copy.deepcopy(partial); bad.pop(key)
            with self.subTest(key=key): self.assertFalse(r.fault_probes_allowed(bad))
        self.assertFalse(r.fault_probes_allowed({**partial, "diagnostic": {"phase": "prepare_context"}}))
    def test_variant_has_exactly_three_fixture_changes_and_derived_digest(self):
        import re
        source = r.file_bytes(r.COMPILE / "upstream/flow/sql/02-manifest.sql")
        variant, evidence = r.laboratory_manifest(source)
        original_json = json.loads(re.search(rb"\$manifest\$(.*?)\$manifest\$", source).group(1))
        variant_json = json.loads(re.search(rb"\$manifest\$(.*?)\$manifest\$", variant).group(1))
        restored = copy.deepcopy(variant_json)
        for n in (1, 2, 3):
            self.assertEqual(restored["fixtures"][n - 1]["shipmentExpediente"], "DEMO-2026-" + str(n))
            restored["fixtures"][n - 1]["shipmentExpediente"] = "SYNTHETIC-SHIPMENT-" + str(n)
        self.assertEqual(restored, original_json)
        restored_bytes = variant.replace(evidence["variant_derived_json_digest"].encode(), evidence["original_declared_manifest_digest"].encode())
        for n in (1, 2, 3):
            restored_bytes = restored_bytes.replace(('"shipmentExpediente":"DEMO-2026-' + str(n) + '"').encode(), ('"shipmentExpediente":"SYNTHETIC-SHIPMENT-' + str(n) + '"').encode())
        self.assertEqual(restored_bytes, source)
        self.assertEqual(r.sha(variant), evidence["variant_sha256"])
        with self.assertRaises(RuntimeError): r.laboratory_manifest(source + b"-- mutation")
    def test_inventory_rejects_path_escape_and_hash_drift(self):
        with tempfile.TemporaryDirectory(dir=HERE) as tmp:
            root = Path(tmp); (root / "a").write_bytes(b"a")
            row = {"path": "a", "bytes": 1, "sha256": r.sha(b"a")}
            self.assertEqual(r.inventory(root, [row]), {"a": b"a"})
            for mutation in ({**row, "path": "../a"}, {**row, "sha256": "0" * 64}, {**row, "bytes": 2}):
                with self.assertRaises(RuntimeError): r.inventory(root, [mutation])

if __name__ == "__main__": unittest.main()
