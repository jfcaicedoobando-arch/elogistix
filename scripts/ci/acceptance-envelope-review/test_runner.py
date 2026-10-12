#!/usr/bin/env python3
"""Offline source/guard regression tests. These never claim PostgreSQL passed."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('envelope_runner', HERE / 'run.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class ContractTests(unittest.TestCase):
    def test_exact_original_and_payload(self):
        original = r.static_check()
        self.assertEqual(r.sha(original.encode()), r.ENVELOPE_SHA)
        self.assertEqual(r.sha(r.payload(original)), r.PAYLOAD_SHA)

    def test_oid_is_only_changed_text(self):
        original = r.static_check()
        adapted = r.adapt_oid(original, 17135)
        self.assertEqual(adapted.replace('v_before.oid <> 17135', 'v_before.oid <> 100911'), original)
        self.assertEqual(r.payload(original), r.payload(adapted))
        for protected in ["current_database() <> 'postgres'", "current_setting('server_version_num') <> '170006'", 'COMMIT;', 'EXECUTE v_sql;', 'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;']:
            self.assertIn(protected, adapted)

    def test_modified_envelope_rejected(self):
        with self.assertRaisesRegex(RuntimeError, 'Unreviewed envelope'):
            r.adapt_oid(r.static_check() + '\n', 17135)

    def test_nonlocal_oid_rejected(self):
        for oid in [100911, 0, -1, '17135']:
            with self.assertRaises(RuntimeError):
                r.adapt_oid(r.static_check(), oid)

    def test_payload_delimiter_count_failclosed(self):
        for source in ['', '$migration_payload$x', '$migration_payload$x$migration_payload$y$migration_payload$']:
            with self.assertRaises(RuntimeError):
                r.payload(source)

    def test_case_inventory(self):
        self.assertEqual(len(r.CASES), 18)
        self.assertEqual(len(set(r.CASES)), 18)
        self.assertEqual(r.CASES[-3:], ['exact_apply_after_lock_release', 'separate_readback', 'retry_existing_ledger'])

    def test_logical_catalog_keeps_security_fields(self):
        data = {'relations': [{'oid': 1, 'relpages': 9, 'reltuples': 7, 'relfrozenxid': '1', 'relhastriggers': True, 'relrowsecurity': True, 'relacl': ['x']}], 'constraints': [{'convalidated': True}]}
        actual = r.logical_catalog(data)
        self.assertEqual(actual['relations'], [{'oid': 1, 'relhastriggers': True, 'relrowsecurity': True, 'relacl': ['x']}])
        self.assertEqual(actual['constraints'], data['constraints'])
        self.assertEqual(data['relations'][0]['relpages'], 9)

    def test_delta_allows_only_target_source(self):
        before = {'relations': [], 'procs': [{'oid': 1, 'proname': 'aceptar_cotizacion_version', 'prosrc': 'old', 'proacl': ['exact']}, {'oid': 2, 'proname': 'other', 'prosrc': 'untouched'}]}
        after = copy.deepcopy(before)
        after['procs'][0]['prosrc'] = 'new'
        with patch.object(r, 'BODY_BEFORE', r.sha(b'old')), patch.object(r, 'BODY_AFTER', r.sha(b'new')):
            r.assert_only_source_delta(before, after)
            after['procs'][0]['proacl'] = ['changed']
            with self.assertRaises(RuntimeError):
                r.assert_only_source_delta(before, after)
            after['procs'][0]['proacl'] = ['exact']
            after['procs'][1]['prosrc'] = 'changed'
            with self.assertRaises(RuntimeError):
                r.assert_only_source_delta(before, after)

    def test_workflow_scoped_no_secrets(self):
        workflow = (HERE.parents[2] / '.github/workflows/acceptance-envelope-review.yml').read_text()
        self.assertIn(r.BRANCH, workflow)
        self.assertIn('persist-credentials: false', workflow)
        self.assertIn('contents: read', workflow)
        self.assertNotIn('pull_request_target:', workflow)
        self.assertNotIn('secrets.', workflow)
        self.assertNotIn('base.sha ==', workflow)

    def test_no_remote_fallback_or_relaxed_preparation(self):
        source = (HERE / 'run.py').read_text()
        for guard in ["'--network=none'", "'--read-only'", "'PGDATABASE=postgres'", "'DOCKER_HOST': 'unix:///var/run/docker.sock'", "sourceArchiveSha256=sha(packed)", "containerAbsenceVerified"]:
            self.assertIn(guard, source)
        self.assertNotIn('DATABASE_URL=', source)
        self.assertNotIn("query('\\\\i supabase/tests/rls/_ci_post_migrate.sql", source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
