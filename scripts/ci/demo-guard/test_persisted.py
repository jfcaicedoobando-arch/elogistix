#!/usr/bin/env python3
"""Offline phase/refusal regressions. Never contacts Docker or PostgreSQL."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('disabled_persisted_tested', HERE / 'persisted-disabled.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SUITE = Path(os.environ.get('DEMO_DISABLED_SOURCE_ROOT', str(HERE.parents[2]))) / 'supabase/tests/rls/test_rls_demo_seed_disabled.sql'
FLAGS = {'GITHUB_ACTIONS': 'true', 'ISOLATED_QA_DB': '1', 'DEMO_GUARD_DISPOSABLE': '1'}
DATABASE = 'demo_guard_race_' + 'a' * 32


class PersistedPhases(unittest.TestCase):
    def context(self, root, fail=None, corrupt=False):
        calls = []
        def query(sql, label, timeout):
            calls.append((label, sql))
            if fail and fail in label:
                raise RuntimeError('synthetic interrupted phase')
            phase = next((p for p in ('A', 'B', 'C') if "'phase','" + p + "'" in sql), 'fixture')
            rows = [{'phase': phase, 'pid': len(calls), 'database': DATABASE, 'user': 'postgres',
                     'session': 'postgres', 'address': None}]
            if phase == 'C':
                marker = next(x for x in m.MARKERS if '-' + x + '-' in label)
                rows.append({'verified': not corrupt, 'marker': marker, 'calls': 15 * (m.MARKERS.index(marker) + 1),
                             'attempted_DML': 0, 'routes': 4, 'transaction_read_only': 'on'})
            return '\n'.join(json.dumps(r) for r in rows) + '\n', ''
        return SimpleNamespace(database=DATABASE, evidence_dir=root, source_commit='a' * 40, query=query), calls

    def test_three_commits_then_read_only_reopen_per_marker_without_repair(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, FLAGS, clear=True), patch.object(m, 'SUITE', SUITE):
            context, calls = self.context(Path(temp))
            result = m.run_persisted(context)
            self.assertEqual(result['status'], 'pass')
            self.assertEqual(result['calls'], 45)
            self.assertEqual(len(calls), 10)
            self.assertIn('CREATE SCHEMA qa_demo_stop_', calls[0][1])
            self.assertIn('SET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;', calls[0][1])
            for index, marker in enumerate(m.MARKERS):
                a, b, c = [sql for _, sql in calls[1 + index * 3:4 + index * 3]]
                self.assertIn('INSERT INTO public.demo_seed_state', a) if marker != 'absent' else self.assertNotIn('INSERT INTO public.demo_seed_state', a)
                self.assertIn('qa_stop_checkpoint SELECT', a)
                self.assertIn('reopened committed fixture snapshot', b)
                self.assertNotRegex(b, r'(INSERT INTO|UPDATE|DELETE FROM) public\.')
                self.assertNotIn('ROLLBACK;', b)
                self.assertIn('SELECT public.seed_demo_organization_guarded(NULL)', b)
                self.assertIn('SELECT public._seed_demo_limpiar_financiero()', b)
                self.assertIn('BEGIN READ ONLY;', c)
                self.assertNotRegex(c, r'INSERT|UPDATE|DELETE|CREATE|ALTER|DROP')
                for sql in (a, b, c):
                    self.assertTrue(sql.rstrip().endswith('COMMIT;'))
                    self.assertNotIn('CREATE OR REPLACE FUNCTION public.', sql)
            self.assertEqual(len({row['pid'] for item in result['cases'] for row in item['connections']}), 9)

    def test_failed_probe_never_runs_read_only_verification_or_later_setup(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, FLAGS, clear=True), patch.object(m, 'SUITE', SUITE):
            context, calls = self.context(Path(temp), fail='absent-B')
            with self.assertRaisesRegex(RuntimeError, 'synthetic interrupted'):
                m.run_persisted(context)
            self.assertEqual(len(calls), 3)
            self.assertFalse(any('-C-' in label for label, _ in calls))
            self.assertEqual(json.loads((Path(temp) / 'persisted-disabled/result.json').read_text())['status'], 'fail')

    def test_committed_snapshot_mismatch_fails_and_stops_before_next_marker(self):
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, FLAGS, clear=True), patch.object(m, 'SUITE', SUITE):
            context, calls = self.context(Path(temp), corrupt=True)
            with self.assertRaisesRegex(RuntimeError, 'Committed application data'):
                m.run_persisted(context)
            self.assertEqual(len(calls), 4)

    def test_missing_opt_in_unowned_database_or_remote_route_refuses_before_query(self):
        for change in [{'GITHUB_ACTIONS': ''}, {'ISOLATED_QA_DB': ''}, {'DEMO_GUARD_DISPOSABLE': ''},
                       *[{key: 'remote'} for key in ('DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR')]]:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, {**FLAGS, **change}, clear=True):
                context, calls = self.context(Path(temp))
                with self.assertRaises(RuntimeError):
                    m.run_persisted(context)
                self.assertEqual(calls, [])
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, FLAGS, clear=True):
            context, calls = self.context(Path(temp))
            context.database = 'postgres'
            with self.assertRaises(RuntimeError):
                m.run_persisted(context)
            self.assertEqual(calls, [])

    def test_unreviewed_source_shapes_or_schema_names_fail_closed(self):
        suite = SUITE.read_text()
        schema = 'qa_demo_stop_' + 'a' * 32
        for source in [suite.replace('DO $matrix$', 'DO $changed$'),
                       suite.replace(m.SETUP_START, '-- removed'),
                       suite.replace('ROLLBACK;', 'COMMIT;'),
                       suite + '\nCREATE OR REPLACE FUNCTION public.seed_demo_organization_core()']:
            with self.subTest(source=source[:20]), self.assertRaises(RuntimeError):
                m.program(source, schema)
        with self.assertRaises(RuntimeError):
            m.program(suite, 'public; DROP SCHEMA public CASCADE;')


if __name__ == '__main__':
    unittest.main(verbosity=2)
