#!/usr/bin/env python3
"""No-database checks for the strict session observation protocol."""
import importlib.util
import json
from pathlib import Path
import queue
import sys
import tempfile
import time
from types import SimpleNamespace
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("h14_protocol_under_test", HERE / "concurrency.py")
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
ci_spec = importlib.util.spec_from_file_location("h14_ci_boundary_under_test", HERE / "ci_run.py")
ci = importlib.util.module_from_spec(ci_spec)
sys.modules[ci_spec.name] = ci
ci_spec.loader.exec_module(ci)


class NeverWrite:
    def write(self, value):
        raise AssertionError("SQL must not be sent after a terminal response")

    def flush(self):
        raise AssertionError("Terminal session must not be flushed")


class ProtocolTests(unittest.TestCase):
    def session(self, lines):
        events = []
        session = m.Session.__new__(m.Session)
        session.lab = SimpleNamespace(
            deadline=time.monotonic() + 1, failures=False,
            event=lambda kind, **data: events.append((kind, data)),
        )
        session.label = "synthetic-wire"
        session.pid = 123
        session.lines = queue.Queue()
        for line in lines:
            session.lines.put(line)
        session.busy = True
        session.pending = {"token": "reviewed", "stdout": [], "stderr": [], "error": None, "sqlstate": None}
        session.native_failed = False
        session.transport_failed = False
        session.terminal_reason = None
        session.eof_channels = set()
        session.closed = False
        session.proc = SimpleNamespace(poll=lambda: 0, stdin=NeverWrite())
        return session, events

    def test_native_error_before_marker_is_preserved_and_session_not_reused(self):
        session, _ = self.session([
            ("stderr", 'ERROR:  42703: column "fixture_typo" does not exist'),
            ("stderr", "HINT:  fixture errors are not a financial rejection"),
            ("stderr", "LOCATION:  errorMissingColumn, parse_relation.c:3665"),
            ("stdout", None), ("stderr", None),
        ])
        result = session.finish(timeout=.2)
        self.assertTrue(result["error"])
        self.assertEqual(result["sqlstate"], "42703")
        self.assertIn("HINT:  fixture errors are not a financial rejection", result["stderr"])
        with self.assertRaises(m.SessionUnavailable):
            session.start("SELECT public.eliminar_embarque_completo(NULL)")

    def test_eof_without_result_marker_fails_closed(self):
        session, events = self.session([("stdout", None), ("stderr", None)])
        with self.assertRaises(m.SessionUnavailable):
            session.finish(timeout=.2)
        self.assertTrue(session.lab.failures)
        self.assertTrue(session.transport_failed)
        self.assertIn("session_terminal", [kind for kind, _ in events])
        with self.assertRaises(m.SessionUnavailable):
            session.start("SELECT 1")

    def test_success_requires_the_matching_result_marker(self):
        session, _ = self.session([
            ("stdout", 'H14_END_other false 00000'),
            ("stdout", '{"value":true}'),
            ("stdout", 'H14_END_reviewed false 00000'),
        ])
        result = session.finish(timeout=.2)
        self.assertFalse(result["error"])
        self.assertEqual(result["sqlstate"], "00000")
        self.assertFalse(session.busy)
        self.assertIn('{"value":true}', result["stdout"])

    def test_owner_context_cannot_count_as_authenticated_probe(self):
        actual = dict(current_user="postgres", session_user="postgres", auth_uid="actor",
                      org="tenant", isolation="read committed", admin=True,
                      operador=True, super_admin=False)
        with self.assertRaises(RuntimeError):
            m.check_actor(actual, "actor", "tenant", True, True)


class CiBoundaryTests(unittest.TestCase):
    def environment(self):
        return dict(GITHUB_ACTIONS="true", ISOLATED_QA_DB="1", H14_INTEGRITY_DISPOSABLE="1",
                    GITHUB_REPOSITORY="jfcaicedoobando-arch/elogistix", GITHUB_JOB="rls-tests-result",
                    GITHUB_RUN_ID="123", H14_POSTGRES_SERVICE_ID="a" * 64, POSTGRES_IMAGE=ci.PIN)

    def test_ambient_routing_is_refused_even_with_a_valid_owned_job(self):
        ci.validate_ci_environment(self.environment())
        for name in ("DATABASE_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGOPTIONS", "PGPASSFILE"):
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                ci.validate_ci_environment(self.environment() | {name: "synthetic-unapproved-route"})
        for fields in ({"DOCKER_HOST": "tcp://127.0.0.1:2375"}, {"DOCKER_CONTEXT": "unapproved-context"},
                       {"H14_POSTGRES_SERVICE_ID": "a" * 63}, {"GITHUB_REPOSITORY": "other/repository"}):
            with self.subTest(fields=fields), self.assertRaises(RuntimeError):
                ci.validate_ci_environment(self.environment() | fields)

    def test_source_allowlist_excludes_credentials_before_blob_reads(self):
        for name in (".env", ".env.production", ".aws/credentials", "supabase/.env", "supabase/migrations/secret.sql",
                     "supabase/migrations/../../.aws/credentials", "/etc/passwd"):
            with self.subTest(name=name):
                self.assertFalse(ci.permitted_source(name))
        self.assertTrue(ci.permitted_source("supabase/schema/squash/cutoff.env"))

    def test_incomplete_case_ledger_is_saved_before_failure(self):
        row = dict(case_id="C01", expected_by_code={}, observed={}, reproduction_complete=True)
        with tempfile.TemporaryDirectory(prefix="h14-evidence-test-") as tmp:
            evidence = Path(tmp) / "partial-cases.json"
            with self.assertRaises(RuntimeError):
                ci.parse_rows("H14_RESULT " + json.dumps(row) + "\n", ["C01", "C02"], evidence)
            self.assertEqual(json.loads(evidence.read_text()), [row])

    def test_reader_budget_ledger_rejects_omission_duplicate_and_failed_result(self):
        ids = ['B01.base', 'P04.reader_budget_empty', 'P04.reader_budget_shared']
        complete = [dict(case_id=case, expected_by_code={}, observed={}, reproduction_complete=True)
                    for case in ids]
        wire = lambda rows: ''.join('H14_RESULT ' + json.dumps(row) + '\n' for row in rows)
        self.assertEqual(ci.parse_rows(wire(complete), ids), complete)
        mutations = {
            'omitted-budget': complete[:-1],
            'duplicate-budget': complete + [complete[-1]],
            'failed-budget': complete[:-1] + [complete[-1] | {'reproduction_complete': False}],
        }
        with tempfile.TemporaryDirectory(prefix='h14-budget-ledger-') as tmp:
            for name, partial in mutations.items():
                with self.subTest(name=name):
                    evidence = Path(tmp) / (name + '.json')
                    with self.assertRaises(RuntimeError):
                        ci.parse_rows(wire(partial), ids, evidence)
                    self.assertEqual(json.loads(evidence.read_text()), partial)

    def test_forward_collector_preserves_private_invoker_metadata(self):
        before = dict(oid=101, body_md5='1' * 32, owner='postgres',
                      acl=['postgres=X/postgres'], security_definer=False,
                      config=['search_path=public'], volatility='v', language='plpgsql')
        after = before | {'body_md5': ci.COLLECTOR_MD5}
        ci.check_collector_postimage(before, after, ci.COLLECTOR_MD5)
        mutations = {
            'wrong-body': {'body_md5': '2' * 32},
            'changed-identity': {'oid': 102},
            'expanded-acl': {'acl': ['postgres=X/postgres', 'authenticated=X/postgres']},
            'definer': {'security_definer': True},
            'changed-owner': {'owner': 'different-role'},
            'changed-config': {'config': ['search_path=public', 'statement_timeout=0']},
        }
        for name, fields in mutations.items():
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                ci.check_collector_postimage(before, after | fields, ci.COLLECTOR_MD5)

    def test_unexpected_super_admin_cannot_mask_a_role_fixture_error(self):
        actual = dict(current_user="authenticated", session_user="postgres", auth_uid="actor",
                      org="tenant", isolation="read committed", admin=True,
                      operador=True, super_admin=True)
        with self.assertRaises(RuntimeError):
            m.check_actor(actual, "actor", "tenant", True, True)


if __name__ == "__main__":
    unittest.main()
