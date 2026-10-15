"""Offline contracts only: no SQL/Docker/server starts."""
import ast
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import ledger_cases as subject

ROOT = Path(__file__).resolve().parent


def fixture():
    return {'base': {'functions': [{'row': {'oid': 1, 'prosrc': 'body', 'proname': 'seed_demo_organization'}, 'xmin': '2', 'ctid': '(0,1)'}]},
            'rows': [{'id': 1, 'hash': 'old', 'created_at': 1}],
            'metadata': {'oid': 5}, 'details': {'triggers': []}, 'supabase_digest': 'fixed',
            'sequence_state': {'last_value': 1, 'is_called': True}}


class OfflineLedgerTests(unittest.TestCase):
    def test_import_has_no_process_or_db_actions(self):
        with patch('subprocess.Popen', side_effect=AssertionError('Process forbidden')), patch('subprocess.run', side_effect=AssertionError('Process forbidden')):
            spec = importlib.util.spec_from_file_location('inert_ledger', ROOT / 'ledger_cases.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

    def test_rollback_allows_sequence_gap_only(self):
        before = fixture()
        after = copy.deepcopy(before)
        after['sequence_state']['last_value'] += 1
        result = subject.verify_rollback(before, after)
        self.assertTrue(result['sequence_is_nontransactional'])
        for section in ('rows', 'metadata', 'details', 'supabase_digest', 'base'):
            changed = copy.deepcopy(after)
            changed[section] = None
            with self.assertRaises(AssertionError):
                subject.verify_rollback(before, changed)

    def test_full_history_preserved(self):
        before = fixture()
        after = copy.deepcopy(before)
        after['rows'].append({'id': 2, 'hash': 'new', 'created_at': 2})
        subject.verify_history(before, after, 'new', 2)
        for mutation in ('duplicate', 'replace_id', 'wrong_when', 'supabase', 'metadata', 'details'):
            changed = copy.deepcopy(after)
            if mutation == 'duplicate':
                changed['rows'].append(copy.deepcopy(changed['rows'][-1]))
            elif mutation == 'replace_id':
                changed['rows'][0]['id'] = 999
            elif mutation == 'wrong_when':
                changed['rows'][-1]['created_at'] = 3
            elif mutation == 'supabase':
                changed['supabase_digest'] = 'changed'
            elif mutation == 'details':
                changed['details']['triggers'] = ['drift']
            else:
                changed['metadata']['oid'] = 6
            with self.subTest(mutation=mutation), self.assertRaises(AssertionError):
                subject.verify_history(before, changed, 'new', 2)

    def test_retry_normalizes_only_function_tuple_versions(self):
        before = fixture()
        after = copy.deepcopy(before)
        after['base']['functions'][0].update(xmin='3', ctid='(0,2)')
        self.assertEqual(subject.logical(before, {1}), subject.logical(after, {1}))
        after['base']['functions'][0]['row']['prosrc'] = 'drift'
        self.assertNotEqual(subject.logical(before, {1}), subject.logical(after, {1}))

    def test_finalizer_requires_every_cleanup_fact(self):
        good = {'ledger_cases': 'checks_pass_cleanup_pending', 'ledger_checks': [{'case': name, 'status': 'checks_pass_cleanup_pending', 'case_database_cleanup': 'confirmed'} for name in subject.CASE_NAMES],
                'cleanup': 'confirmed_stopped_and_removed', 'pg_status_3_and_no_pid': True, 'owned_psql_clients_closed': True}
        for key in ('ledger_cases', 'cleanup', 'pg_status_3_and_no_pid', 'owned_psql_clients_closed'):
            value = copy.deepcopy(good)
            value.pop(key)
            with self.subTest(key=key), self.assertRaises(AssertionError):
                subject.finalize_ledger_result(value)
            self.assertNotEqual(value['ledger_checks'][0]['status'], 'PASS')
        subject.finalize_ledger_result(good)
        self.assertEqual(good['ledger_cases'], 'PASS')
        self.assertEqual(good['ledger_checks'][0]['status'], 'PASS')

    def test_unrelated_function_tuple_version_is_not_hidden(self):
        before = fixture()
        before['base']['functions'][0]['row']['oid'] = 99  # Same name, unrelated overload/namespace
        after = copy.deepcopy(before)
        after['base']['functions'][0]['xmin'] = '99'
        self.assertNotEqual(subject.logical(before, {1}), subject.logical(after, {1}))

    def test_empty_or_partial_case_manifest_cannot_pass(self):
        for names in ((), subject.CASE_NAMES[:-1], subject.CASE_NAMES + ('clean',)):
            value = {'ledger_cases': 'checks_pass_cleanup_pending', 'ledger_checks': [{'case': n, 'status': 'checks_pass_cleanup_pending', 'case_database_cleanup': 'confirmed'} for n in names], 'cleanup': 'confirmed_stopped_and_removed', 'pg_status_3_and_no_pid': True, 'owned_psql_clients_closed': True}
            with self.assertRaises(AssertionError):
                subject.finalize_ledger_result(value)

    def test_failed_case_cannot_be_promoted(self):
        value = {'ledger_cases': 'checks_pass_cleanup_pending', 'ledger_checks': [{'case': name, 'status': 'FAIL', 'case_database_cleanup': 'confirmed'} for name in subject.CASE_NAMES],
                 'cleanup': 'confirmed_stopped_and_removed', 'pg_status_3_and_no_pid': True, 'owned_psql_clients_closed': True}
        with self.assertRaises(AssertionError):
            subject.finalize_ledger_result(value)

    def test_late_fault_proves_all_four_hashes_and_no_seed_call(self):
        stopped = {'a()': 'a' * 64, 'b()': 'b' * 64, 'c()': 'c' * 64, 'd(bigint)': 'd' * 64}
        sql = subject.fault_constraint(stopped)
        self.assertIn('observed IS DISTINCT FROM', sql)
        self.assertIn(subject.FAULT, sql)
        self.assertIn('NOT VALID', sql)
        self.assertNotIn('PERFORM public.', sql)
        self.assertNotIn('CREATE TRIGGER', sql)
        self.assertLess(sql.index('observed IS DISTINCT'), sql.index(subject.FAULT))

    def test_deferred_trigger_is_real_constraint_variant(self):
        sql = subject.trigger_fixture(True)
        self.assertIn('CREATE CONSTRAINT TRIGGER', sql)
        self.assertIn('DEFERRABLE INITIALLY DEFERRED', sql)
        self.assertIn('AFTER INSERT', sql)
        self.assertNotIn('DEFERRABLE', subject.trigger_fixture(False))

    def test_no_external_connection_or_process_surface(self):
        tree = ast.parse((ROOT / 'ledger_cases.py').read_text())
        imported = {n.names[0].name for n in ast.walk(tree) if isinstance(n, ast.Import)}
        self.assertFalse(imported & {'subprocess', 'psycopg', 'socket', 'requests'})
        source = (ROOT / 'ledger_cases.py').read_text()
        self.assertIn('controls.case_sessions(runner, case_name)', source)
        self.assertIn("ledger_cases='RUNNING'", source)
        self.assertNotIn('runner.check(', source)

    def test_metadata_extractor_fail_closed(self):
        self.assertEqual(subject.metadata_sql('$ledger_metadata_sql$SELECT 1$ledger_metadata_sql$'), 'SELECT 1;')
        with self.assertRaises(AssertionError):
            subject.metadata_sql('SELECT 1')


if __name__ == '__main__':
    unittest.main()
