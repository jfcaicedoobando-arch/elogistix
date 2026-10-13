"""Offline safety contracts; real CLI controls are mandatory in CI."""

import contextlib
import importlib.util
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import tomllib
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("snapshot", HERE / "gitleaks_snapshot.py")
snapshot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(snapshot)
CONFIG = (HERE.parent.parent / ".gitleaks.toml").read_bytes()
DUMMY = ("DUMMY_" + "Z" * 16).encode()
REAL_BINARY = os.environ.get("GITLEAKS_TEST_BINARY")
if os.environ.get("REQUIRE_GITLEAKS_BINARY") == "1" and not shutil.which(REAL_BINARY or ""):
    raise RuntimeError("Required real Gitleaks controls cannot be skipped.")


class Fixture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="test-gitleaks-snapshot-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.git("init", "-q", "--initial-branch=main")
        self.git("config", "user.name", "Synthetic Fixture")
        self.git("config", "user.email", "fixture@example.invalid")
        self.write(".gitleaks.toml", CONFIG)
        self.base = self.commit()
        self.calls = []
        self.scanner_report = None
        self.scanner_code = 0
        self.scanner_output = b"INF 1 commits scanned.\nINF scanned ~12 bytes (12 bytes) in 1ms\nINF no leaks found\n"
        self.real_run = subprocess.run
        self.fake_binary = str(self.root / "fake-gitleaks")
        Path(self.fake_binary).touch()

    def git(self, *args):
        return subprocess.run(
            ["git", "-C", str(self.repo), "-c", "core.hooksPath=/dev/null",
             "-c", "commit.gpgsign=false", *args],
            capture_output=True, check=True,
        ).stdout.decode().strip()

    def write(self, path, data):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    def commit(self):
        self.git("add", "--all")
        self.git("commit", "-qm", "synthetic fixture", "--allow-empty")
        return self.git("rev-parse", "HEAD")

    def event(self, head, base=None):
        return {"pull_request": {"head": {"sha": head}, "base": {"sha": base or self.base}}}

    def fake_run(self, args, **kwargs):
        if args[0] != self.fake_binary:
            return self.real_run(args, **kwargs)
        if args[1:] == ["version"]:
            return subprocess.CompletedProcess(args, 0, b"8.24.3\n", b"")
        source = Path(args[-1])
        entries = snapshot.tree(source, "HEAD")
        self.calls.append({
            "args": args,
            "source": source,
            "files": {path: snapshot.blob(source, entry) for path, entry in entries.items()},
            "config": Path(args[args.index("--config") + 1]).read_bytes(),
        })
        if self.scanner_report is not None:
            Path(args[args.index("--report-path") + 1]).write_text(json.dumps(self.scanner_report))
        return subprocess.CompletedProcess(args, self.scanner_code, b"", self.scanner_output)

    def scanned_files(self):
        return {name: data for call in self.calls for name, data in call["files"].items()}

    def run_scan(self, head, event_name="pull_request", event=None):
        output = io.StringIO()
        with patch.object(snapshot.shutil, "which", return_value=self.fake_binary), \
             patch.object(snapshot.subprocess, "run", side_effect=self.fake_run), \
             contextlib.redirect_stdout(output):
            result = snapshot.scan(self.repo, event_name, event or self.event(head), head)
        for call in self.calls:
            self.assertFalse(call["source"].exists(), "Temporary content must be removed")
        return result, output.getvalue()

    def merged_head(self):
        self.git("checkout", "-qb", "side")
        self.write("src/side.ts", b"export const side = true;\n")
        first = self.commit()
        self.git("checkout", "-q", "main")
        self.git("merge", "--no-ff", "--no-commit", "side")
        self.write("src/merge-only.ts", DUMMY)
        return first, self.commit()


class SnapshotTests(Fixture):
    def test_merge_head_covers_content_omitted_by_legacy_history(self):
        first, head = self.merged_head()
        self.assertEqual(self.git("log", "--format=%H", "--no-merges", "--first-parent",
                                  first + "^.." + head), "")
        self.run_scan(head)
        self.assertEqual(set(self.scanned_files()), {"src/side.ts", "src/merge-only.ts"})
        self.assertEqual(self.scanned_files()["src/merge-only.ts"], DUMMY)

    def test_single_merge_push_uses_before_and_final_after(self):
        _, head = self.merged_head()
        self.run_scan(head, "push", {"before": self.base, "after": head})
        self.assertIn("src/merge-only.ts", self.scanned_files())

    def test_pr_over_thirty_commits_uses_exact_event_head(self):
        for number in range(32):
            self.write("docs/page.md", f"revision {number}\n".encode())
            head = self.commit()
        self.run_scan(head)
        self.assertEqual(self.calls[0]["files"]["docs/page.md"], b"revision 31\n")

    def test_checkout_synthetic_merge_does_not_replace_event_head(self):
        self.write("src/pr.ts", b"actual PR content\n")
        head = self.commit()
        self.write("src/synthetic-only.ts", DUMMY)
        self.commit()
        self.run_scan(head)
        self.assertEqual(set(self.calls[0]["files"]), {"src/pr.ts"})

    def test_rename_preserves_destination_and_nul_paths(self):
        self.write(".env", b"public placeholder\n")
        self.base = self.commit()
        destination = "src/-name\twith\nspaces-á.ts"
        (self.repo / "src").mkdir()
        (self.repo / ".env").rename(self.repo / destination)
        self.write("--leading.md", b"document\n")
        head = self.commit()
        _, output = self.run_scan(head)
        self.assertEqual(set(self.scanned_files()), {destination, "--leading.md"})
        self.assertIn("deleted=1", output)
        self.assertNotIn(destination, output)

    def test_new_branch_and_dispatch_scan_full_final_tree(self):
        self.write("docs/new.md", b"content\n")
        head = self.commit()
        self.run_scan(head, "push", {"before": "0" * 40, "after": head})
        self.assertEqual(set(self.scanned_files()), {".gitleaks.toml", "docs/new.md"})
        self.calls.clear()
        self.run_scan(head, "workflow_dispatch", {})
        self.assertEqual(set(self.scanned_files()), {".gitleaks.toml", "docs/new.md"})

    def test_empty_delta_is_explicit_without_directory_scan(self):
        _, output = self.run_scan(self.base)
        self.assertEqual(self.calls, [])
        self.assertIn("No final content", output)

    def test_empty_commit_is_valid(self):
        head = self.commit()
        self.run_scan(head)
        self.assertEqual(self.calls, [])

    def test_zero_byte_document_is_valid(self):
        self.write("docs/empty.md", b"")
        _, output = self.run_scan(self.commit())
        self.assertEqual(self.calls, [])
        self.assertIn("files=1, bytes=0", output)

    def test_deleted_only_is_valid(self):
        self.write("docs/old.md", b"old document\n")
        self.base = self.commit()
        (self.repo / "docs/old.md").unlink()
        _, output = self.run_scan(self.commit())
        self.assertEqual(self.calls, [])
        self.assertIn("deleted=1", output)

    def test_allowlist_is_unchanged_for_root_patch(self):
        self.write(".env", b"public placeholder\n")
        self.write("image.png", b"\x89PNG\r\n\x1a\n\x00")
        self.run_scan(self.commit())
        self.assertEqual(self.calls[0]["config"], CONFIG)

    def test_symlink_is_literal_text_and_never_follows_target(self):
        outside = self.root / "outside.txt"
        outside.write_bytes(DUMMY)
        (self.repo / "link.txt").symlink_to(outside)
        self.run_scan(self.commit())
        self.assertEqual(self.calls[0]["files"]["link.txt"], os.fsencode(outside))
        self.assertNotIn(DUMMY, self.calls[0]["files"].values())

    def test_submodule_fails_closed_without_recursion(self):
        self.git("update-index", "--add", "--cacheinfo", "160000", self.base, "nested")
        self.git("commit", "-qm", "synthetic gitlink")
        with self.assertRaisesRegex(snapshot.CoverageError, "submodules"):
            self.run_scan(self.git("rev-parse", "HEAD"))

    def test_config_cannot_hide_changed_submodule(self):
        self.git("update-index", "--add", "--cacheinfo", "160000", self.base, "nested")
        self.git("commit", "-qm", "synthetic gitlink")
        self.git("config", "diff.ignoreSubmodules", "all")
        with self.assertRaisesRegex(snapshot.CoverageError, "submodules"):
            self.run_scan(self.git("rev-parse", "HEAD"))

    def test_missing_invalid_and_unavailable_shas_fail(self):
        for invalid in (None, "--all", "HEAD", "a" * 40, "0" * 40):
            with self.subTest(invalid=invalid), self.assertRaises(snapshot.CoverageError):
                snapshot.endpoints(self.repo, "pull_request", self.event(invalid), None)
        with self.assertRaises(snapshot.CoverageError):
            snapshot.endpoints(self.repo, "push", {"before": "missing", "after": self.base}, None)
        with self.assertRaises(snapshot.CoverageError):
            snapshot.endpoints(self.repo, "unknown", {}, self.base)

    def test_missing_binary_fails(self):
        with patch.object(snapshot.shutil, "which", return_value=None), \
             self.assertRaisesRegex(snapshot.CoverageError, "unavailable"):
            snapshot.scan(self.repo, "pull_request", self.event(self.base), self.base)

    def test_scanner_failure_is_sanitized_and_temp_removed(self):
        self.write("src/test.ts", DUMMY)
        self.scanner_code = 2
        self.scanner_output = b"finding: " + DUMMY
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2") as caught:
            self.run_scan(self.commit())
        self.assertNotIn(DUMMY.decode(), str(caught.exception))
        self.assertFalse(self.calls[0]["source"].exists())

    def test_findings_fail_closed_with_private_report_cleanup(self):
        self.write("src/test.ts", DUMMY)
        self.scanner_report = [{"RuleID": "generic-api-key", "File": "src/test.ts", "StartLine": 1,
                                "Secret": "do-not-print", "Match": "do-not-print"}]
        head = self.commit()
        for code in (2, 7):
            self.scanner_code = code
            output = io.StringIO()
            with patch.object(snapshot.shutil, "which", return_value=self.fake_binary), \
                 patch.object(snapshot.subprocess, "run", side_effect=self.fake_run), \
                 contextlib.redirect_stdout(output):
                with self.assertRaisesRegex(snapshot.CoverageError, f"exit {code}"):
                    snapshot.scan(self.repo, "pull_request", self.event(head), head)
            self.assertNotIn("do-not-print", output.getvalue())
            self.assertEqual("Finding location:" in output.getvalue(), code == 2)
            self.assertFalse(self.calls[-1]["source"].exists())
            args = self.calls[-1]["args"]
            self.assertFalse(Path(args[args.index("--report-path") + 1]).exists())

    def test_missing_coverage_summary_fails(self):
        self.write("docs/page.md", b"content\n")
        self.scanner_output = b"no leaks found\n"
        with self.assertRaisesRegex(snapshot.CoverageError, "coverage"):
            self.run_scan(self.commit())
        self.assertFalse(self.calls[0]["source"].exists())

    def test_coverage_summary_uses_exact_bytes_before_human_units(self):
        self.write("docs/page.md", b"content\n")
        self.scanner_output = b"INF 1 commits scanned.\nINF scanned ~30544 bytes (30.54 KB) in 1ms\nINF no leaks found\n"
        _, output = self.run_scan(self.commit())
        self.assertIn("scanned_bytes=30544;", output)

    def test_nonempty_root_patch_cannot_succeed_with_zero_bytes(self):
        self.write("docs/page.md", b"content\n")
        self.scanner_output = b"INF 1 commits scanned.\nINF scanned ~0 bytes (0) in 1ms\nINF no leaks found\n"
        with self.assertRaisesRegex(snapshot.CoverageError, "zero bytes"):
            self.run_scan(self.commit())

    def test_missing_root_commit_coverage_fails(self):
        self.write("docs/page.md", b"content\n")
        self.scanner_output = b"INF scanned ~12 bytes (12 bytes) in 1ms\nINF no leaks found\n"
        with self.assertRaisesRegex(snapshot.CoverageError, "single root commit"):
            self.run_scan(self.commit())

    def test_fast_import_preserves_arbitrary_paths_and_blob_framing(self):
        contents = b"\x00\xff\ncommit refs/heads/injected\ndata 0\n\ndone\n"
        name = 'src/pdf/quote"slash\\tab\tnewline\n-á.bin'
        self.write(name, contents)
        self.write("--leading.txt", b"literal leading dash\n")
        self.run_scan(self.commit())
        self.assertEqual(self.scanned_files()[name], contents)
        self.assertEqual(len(self.scanned_files()), 2)

    def test_inherited_git_environment_cannot_redirect_snapshot_writes(self):
        self.write("docs/page.md", b"content\n")
        head = self.commit()
        original = {str(p.relative_to(self.repo)): p.read_bytes()
                    for p in self.repo.rglob("*") if p.is_file()}
        injected = {
            "GIT_DIR": str(self.repo / ".git"),
            "GIT_WORK_TREE": str(self.repo),
            "GIT_OBJECT_DIRECTORY": str(self.repo / ".git/objects"),
            "GIT_INDEX_FILE": str(self.repo / ".git/index"),
            "GIT_CONFIG_COUNT": "1",
            "GIT_CONFIG_KEY_0": "core.hooksPath",
            "GIT_CONFIG_VALUE_0": str(self.root / "unexpected-hooks"),
        }
        with patch.dict(os.environ, injected):
            self.run_scan(head)
        after = {str(p.relative_to(self.repo)): p.read_bytes()
                 for p in self.repo.rglob("*") if p.is_file()}
        self.assertEqual(original, after)
        self.assertEqual(set(self.scanned_files()), {"docs/page.md"})

    def test_inconsistent_empty_selection_fails(self):
        self.write("docs/page.md", b"content\n")
        head = self.commit()
        real_git = snapshot.git

        def missing_selection(repo, *args, **kwargs):
            if "--name-status" in args:
                return subprocess.CompletedProcess(args, 0, b"", b"")
            return real_git(repo, *args, **kwargs)

        with patch.object(snapshot, "git", side_effect=missing_selection), \
             self.assertRaisesRegex(snapshot.CoverageError, "empty selection"):
            self.run_scan(head)

    def test_incomplete_materialization_fails(self):
        self.write("docs/page.md", b"content\n")
        head = self.commit()
        entries = snapshot.tree(self.repo, head)
        destination = self.root / "broken"
        destination.mkdir()
        with patch.object(Path, "write_bytes", return_value=0), \
             self.assertRaisesRegex(snapshot.CoverageError, "materialization"):
            snapshot.materialize(self.repo, entries, ["docs/page.md"], destination)

    def test_cli_flags_keep_relative_paths_redaction_and_private_report(self):
        self.write("src/file.ts", b"content\n")
        self.run_scan(self.commit())
        args = self.calls[0]["args"]
        self.assertEqual(args[1], "git")
        log_options = next(arg for arg in args if arg.startswith("--log-opts="))
        self.assertIn("--root --text --no-ext-diff --no-textconv -1", log_options)
        self.assertTrue(args[-1].endswith("snapshot.git"))
        self.assertIn("--redact=100", args)
        self.assertNotIn("--verbose", args)
        self.assertIn("--report-format=json", args)
        report = Path(args[args.index("--report-path") + 1])
        self.assertEqual(report.name, "findings.json")
        self.assertFalse(report.exists())
        self.assertNotIn("--follow-symlinks", args)


class FindingMetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.report = Path(self.temp.name) / "findings.json"
        self.safe = {"RuleID": "generic-api-key", "File": "supabase/schema/baseline.sql", "StartLine": 6628,
                     "Secret": "do-not-print", "Match": "do-not-print", "Description": "do-not-print"}

    def metadata(self, value, paths=("supabase/schema/baseline.sql",)):
        self.report.write_text(json.dumps(value))
        return snapshot.finding_metadata(self.report, paths)

    def test_only_known_bounded_location_is_emitted(self):
        result = self.metadata([self.safe])
        self.assertEqual(result, ["Finding location: path=supabase/schema/baseline.sql; rule=generic-api-key; line=6628"])
        self.assertNotIn("do-not-print", str(result))

    def test_untrusted_metadata_is_suppressed(self):
        for field, values in {
            "RuleID": ["unknown", "::error::bad", {}, None],
            "File": ["other.sql", "../secret", "x\n::error::bad", {}, None],
            "StartLine": [True, 0, -1, 10_000_001, "6628", {}, None],
        }.items():
            for value in values:
                with self.subTest(field=field, value=value):
                    self.assertEqual(self.metadata([{**self.safe, field: value}]), [])
        for path in ("../secret", "x\n::error::bad", "x" * 241, "/absolute", "a//b"):
            self.assertEqual(self.metadata([{**self.safe, "File": path}], (path,)), [])

    def test_malformed_missing_and_oversized_reports_are_private(self):
        self.assertEqual(snapshot.finding_metadata(self.report, ()), [])
        for raw in ("do-not-print", "[" * 2000, " " * 1_048_577):
            self.report.write_text(raw)
            self.assertEqual(snapshot.finding_metadata(self.report, ()), [])
        for value in ({"Secret": "do-not-print"}, None, [None, "do-not-print"]):
            self.assertEqual(self.metadata(value), [])

    def test_symlink_report_is_rejected(self):
        target = Path(self.temp.name) / "target"
        target.write_text(json.dumps([self.safe]))
        self.report.symlink_to(target)
        self.assertEqual(snapshot.finding_metadata(self.report, (self.safe["File"],)), [])

    def test_duplicates_and_output_are_bounded(self):
        self.assertEqual(len(self.metadata([self.safe] * 50)), 1)
        self.assertEqual(len(self.metadata([{**self.safe, "StartLine": n} for n in range(1, 50)])), 20)


@unittest.skipUnless(REAL_BINARY, "Gitleaks not installed locally; real controls are required in CI")
class RealScannerTests(Fixture):
    def setUp(self):
        super().setUp()
        custom = CONFIG + b'\n[[rules]]\nid = "snapshot-dummy"\nregex = "DUMMY_[A-Z]{16}"\n'
        self.write(".gitleaks.toml", custom)
        self.base = self.commit()

    def actual_scan(self, head):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = snapshot.scan(self.repo, "pull_request", self.event(head), head, REAL_BINARY)
        self.assertIn("scanned_bytes=", output.getvalue())
        return result, output.getvalue()

    def test_real_merge_only_dummy_is_detected(self):
        _, head = self.merged_head()
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
            self.actual_scan(head)

    def test_real_clean_document_is_scanned(self):
        self.write("docs/clean.md", b"Ordinary clean documentation.\n")
        result, output = self.actual_scan(self.commit())
        self.assertEqual(result, 0)
        self.assertRegex(output, r"scanned_bytes=[1-9][0-9]*;")

    def test_real_allowlist_retains_relative_env_path(self):
        self.write(".env", DUMMY)
        result, output = self.actual_scan(self.commit())
        self.assertEqual(result, 0)
        # Git mode counts patch bytes before checking path allowlists.
        self.assertRegex(output, r"scanned_bytes=[1-9][0-9]*;")

    def test_real_rename_out_of_allowlist_detects_dummy(self):
        self.write(".env", DUMMY)
        self.base = self.commit()
        (self.repo / ".env").rename(self.repo / "exposed.txt")
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
            self.actual_scan(self.commit())

    def test_real_allowlisted_directory_name_cannot_hide_merge_content(self):
        self.git("checkout", "-qb", "side")
        self.write("src/side.ts", b"export const side = true;\n")
        self.commit()
        self.git("checkout", "-q", "main")
        self.git("merge", "--no-ff", "--no-commit", "side")
        self.write("src/lib/pdf/merge-only.ts", DUMMY)
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
            self.actual_scan(self.commit())

    def test_real_attributes_cannot_hide_text_as_binary(self):
        self.write(".gitattributes", b"*.txt -diff\n")
        self.write("src/marked-binary.txt", DUMMY)
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
            self.actual_scan(self.commit())

    def test_real_git_parser_handles_quoted_and_leading_dash_paths(self):
        self.write('--quote"tab\tnewline\nbackslash\\á.txt', DUMMY)
        with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
            self.actual_scan(self.commit())


class SQLAllowlistConfigTests(unittest.TestCase):
    def test_default_rules_and_detection_parameters_are_not_overridden(self):
        config = tomllib.loads(CONFIG.decode())
        self.assertEqual(config["extend"], {"useDefault": True})
        self.assertEqual(set(config), {"extend", "allowlist", "rules"})
        self.assertEqual(len(config["rules"]), 1)
        rule = config["rules"][0]
        # Inherit the complete default rule, including regex, entropy and its
        # existing allowlists. Never disable rules or substitute weaker rules.
        self.assertEqual(set(rule), {"id", "allowlists"})
        self.assertEqual(rule["id"], "generic-api-key")
        self.assertEqual(len(rule["allowlists"]), 1)
        allowlist = rule["allowlists"][0]
        self.assertEqual(set(allowlist), {
            "description", "condition", "paths", "regexTarget", "regexes",
        })
        self.assertEqual(allowlist["condition"], "AND")
        self.assertEqual(allowlist["regexTarget"], "match")
        self.assertEqual(allowlist["paths"], [r"^supabase/schema/baseline\.sql$"])
        self.assertEqual(allowlist["regexes"], [
            r"^auth\.users u ON u\.id = (?:fe2\.enviado_por|fe3\.subido_por|fe4\.capturado_por)$",
        ])


@unittest.skipUnless(REAL_BINARY, "Gitleaks not installed locally; real controls are required in CI")
class RealSQLAllowlistTests(Fixture):
    baseline_path = "supabase/schema/baseline.sql"
    references = ("fe2.enviado_por", "fe3.subido_por", "fe4.capturado_por")

    def scan_case(self, path, content, expected_leak, expected_rule="generic-api-key"):
        self.write(path, content.encode())
        head = self.commit()
        output = io.StringIO()
        try:
            with contextlib.redirect_stdout(output):
                if expected_leak:
                    with self.assertRaisesRegex(snapshot.CoverageError, "exit 2"):
                        snapshot.scan(self.repo, "pull_request", self.event(head), head, REAL_BINARY)
                else:
                    self.assertEqual(snapshot.scan(
                        self.repo, "pull_request", self.event(head), head, REAL_BINARY,
                    ), 0)
            if expected_leak:
                if expected_rule is not None:
                    self.assertIn(f"rule={expected_rule};", output.getvalue())
            else:
                self.assertRegex(output.getvalue(), r"scanned_bytes=[1-9][0-9]*;")
        finally:
            # Each case has exactly one selected content file. A finding from
            # an earlier case must never make a later negative control pass.
            (self.repo / path).unlink()
            self.base = self.commit()

    def test_real_each_verified_join_is_allowed_only_in_exact_baseline(self):
        for reference in self.references:
            content = f"LEFT JOIN auth.users u ON u.id = {reference}\n"
            for path in (self.baseline_path, "other.sql", "backup/" + self.baseline_path,
                         self.baseline_path + ".bak"):
                with self.subTest(reference=reference, path=path):
                    self.scan_case(path, content, expected_leak=path != self.baseline_path)

    def test_real_mutated_sql_context_is_not_allowlisted(self):
        for reference in self.references:
            for content in (
                f"LEFT JOIN auth.users u ON u.id = '{reference}'\n",
                f"LEFT JOIN auth.users u ON u.id = {reference}_changed\n",
                f"LEFT JOIN auth.users v ON v.id = {reference}\n",
                f"LEFT JOIN auth.users u ON u.id  = {reference}\n",
            ):
                with self.subTest(reference=reference, content=content):
                    self.scan_case(self.baseline_path, content, expected_leak=True)

    def test_real_synthetic_credential_literals_in_baseline_are_detected(self):
        # Inert high-entropy canary assembled only for tests; never a credential.
        canary = "".join(("Q8z4V2n9", "B7x5L3p6", "R1s0T4m8"))
        credential = f"api_key = '{canary}'\n"
        # Construct SQL at runtime so the test source is not itself a finding.
        # Keep the exact scanner input; never exempt this file or disable history.
        known_join = f"LEFT JOIN auth.users u ON u.id = {self.references[0]}"
        for content in (
            credential,
            f"LEFT JOIN auth.users u ON u.id = '{canary}'\n",
            f"LEFT JOIN auth.users u ON u.id = {canary}\n",
            f"{known_join}\n{credential}",
            f"{known_join}; {credential}",
        ):
            with self.subTest(content=content):
                self.scan_case(self.baseline_path, content, expected_leak=True)

    def test_real_other_default_rule_remains_active_in_baseline(self):
        # Synthetic GCP-shaped fixture. No account, issuer or usable key exists.
        value = "AI" + "za" + "".join(("Q8z4V2n9", "B7x5L3p6", "R1s0T4m8", "C2d6F9h3", "J5k"))
        self.assertEqual(len(value), 39)
        self.scan_case(self.baseline_path, f"SELECT '{value}';\n",
                       expected_leak=True, expected_rule=None)


class SQLFixtureConstructionTests(unittest.TestCase):
    def test_runtime_construction_preserves_all_thirty_scanner_scenarios(self):
        # Capture inputs without launching Git or the scanner. This fingerprint
        # is from the pre-refactor fixtures, including paths, content and expected
        # failures. Runtime construction must not weaken any real CLI control.
        fixture = RealSQLAllowlistTests()
        cases = []
        with patch.object(fixture, "scan_case", side_effect=lambda *args, **kwargs: cases.append([args, kwargs])):
            fixture.test_real_each_verified_join_is_allowed_only_in_exact_baseline()
            fixture.test_real_mutated_sql_context_is_not_allowlisted()
            fixture.test_real_synthetic_credential_literals_in_baseline_are_detected()
            fixture.test_real_other_default_rule_remains_active_in_baseline()
        self.assertEqual(len(cases), 30)
        serialized = json.dumps(cases, sort_keys=True).encode()
        self.assertEqual(hashlib.sha256(serialized).hexdigest(),
                         "1ede9bf5be228e8f712e92bc2d19771a2326ba803d93c05c27a9d88121d9dc7a")


if __name__ == "__main__":
    unittest.main()
