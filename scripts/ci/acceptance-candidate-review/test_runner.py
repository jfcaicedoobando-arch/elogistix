#!/usr/bin/env python3
"""Static harness tests, not substitutes for PostgreSQL or concurrency evidence."""
import ast
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('acceptance_v2_runner', HERE / 'run.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class HarnessStaticChecks(unittest.TestCase):
    def test_all_python_syntax(self):
        for path in HERE.glob('*.py'):
            ast.parse(path.read_text())

    def test_complete_explicit_inventory(self):
        contract, index = runner.static_check()
        self.assertEqual(contract['review_state'], 'draft_ci_only_not_merge_approval')
        self.assertEqual(len(index['files']), 1528)
        self.assertEqual(contract['review_branch'], 'fix/acceptance-canonical-prospect-20261012')
        self.assertEqual(set(contract['postgres']), {'17.9', '17.6'})
        self.assertEqual(contract['postgres']['17.9']['version_num'], '170009')

    def test_git_blob_hash(self):
        self.assertEqual(runner.blob(b''), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')

    def test_semantic_marker_contract(self):
        contract, _ = runner.static_check()
        expected = contract['semantic_cases']
        self.assertEqual(len(expected), 115)
        stderr = '\n'.join('NOTICE:  ACCEPTANCE_V2_CASE:' + case for case in expected)
        self.assertEqual(re.findall(r'ACCEPTANCE_V2_CASE:([a-z0-9_]+)', stderr), expected)
        self.assertEqual(len(contract['concurrency_cases']), 8)

    def test_unreviewed_candidate_is_blocked_before_execution(self):
        for contract in ({}, {'candidate_binding_ready': True, 'candidate_revision': 2},
                         {'candidate_binding_ready': True, 'candidate_revision': 3}):
            with self.assertRaises(RuntimeError):
                runner.require_candidate_ready(contract)
        runner.require_candidate_ready({'candidate_binding_ready': True, 'candidate_revision': 3,
                                        'accessory_client_fix_reviewed': True})

    def test_regular_file_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'safe.sql').write_text('SELECT 1;')
            self.assertEqual(runner.regular(root, 'safe.sql'), root / 'safe.sql')
            for unsafe in ('../outside.sql', '/absolute.sql', 'missing.sql'):
                with self.assertRaises(RuntimeError):
                    runner.regular(root, unsafe)
            (root / 'alias.sql').symlink_to('safe.sql')
            with self.assertRaises(RuntimeError):
                runner.regular(root, 'alias.sql')

    def test_physical_counters_only_are_ignored(self):
        value = {'relations': [{'relpages': 5, 'relallvisible': 2, 'relfrozenxid': '123', 'relminmxid': '4', 'relacl': ['authenticated=r/test'], 'relrowsecurity': True}], 'constraints': [{'contype': 'f', 'convalidated': True}]}
        normalized = runner.logical_catalog(json.dumps(value))
        self.assertEqual(normalized, {'relations': [{'relacl': ['authenticated=r/test'], 'relrowsecurity': True}], 'constraints': [{'contype': 'f', 'convalidated': True}]})

    def test_candidate_catalog_delta_is_narrow(self):
        old = {'relations': [], 'policies': [{'polname': 'real_policy'}], 'procs': [
            {'oid': '42', 'proname': 'aceptar_cotizacion_version', 'prosrc': 'old', 'proowner': '10', 'proacl': ['authenticated=X/postgres']},
            {'oid': '43', 'proname': 'convertir_prospecto_a_cliente_rpc', 'prosrc': 'original_converter'}]}
        new = json.loads(json.dumps(old)); new['procs'][0]['prosrc'] = 'new'
        contract = {'original_acceptance_body_sha256': runner.sha(b'old'), 'candidate_acceptance_body_sha256': runner.sha(b'new'),
                    'original_conversion_body_sha256': runner.sha(b'original_converter')}
        runner.assert_candidate_delta(json.dumps(old), json.dumps(new), contract)
        for mutation in ('acl', 'converter', 'policy', 'owner'):
            changed = json.loads(json.dumps(new))
            if mutation == 'acl': changed['procs'][0]['proacl'].append('anon=X/postgres')
            if mutation == 'owner': changed['procs'][0]['proowner'] = '20'
            if mutation == 'converter': changed['procs'][1]['prosrc'] = 'fake_success'
            if mutation == 'policy': changed['policies'][0]['polname'] = 'relaxed'
            with self.assertRaises(RuntimeError):
                runner.assert_candidate_delta(json.dumps(old), json.dumps(changed), contract)

    def test_baseline_diff_scope(self):
        base = 'CREATE SCHEMA public;\nCREATE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid) RETURNS jsonb\nLANGUAGE plpgsql AS $$old$$;\nCREATE TABLE public.real_table(id uuid);\n'
        candidate = base.replace('$$old$$', '$$new$$')
        self.assertEqual(runner.strip_acceptance_definition(base), runner.strip_acceptance_definition(candidate))
        self.assertNotEqual(runner.strip_acceptance_definition(base), runner.strip_acceptance_definition(candidate.replace('real_table(id uuid)', 'real_table(id text)')))
        for invalid in ('', base + base):
            with self.assertRaises((RuntimeError, ValueError)):
                runner.strip_acceptance_definition(invalid)

    def test_no_auth_or_business_success_bypass(self):
        for name in ('neutral-cases.sql', 'preconditions.sql', 'semantic-cases.sql'):
            content = (HERE / name).read_text()
            self.assertNotRegex(content, r'(?i)CREATE(?: OR REPLACE)? FUNCTION public\.')
            self.assertNotRegex(content, r'(?i)(DISABLE TRIGGER|session_replication_role|ALTER POLICY|GRANT EXECUTE)')
        sql = (HERE / 'neutral-cases.sql').read_text()
        self.assertIn('ok IS DISTINCT FROM true', sql)
        self.assertTrue(sql.rstrip().endswith('ROLLBACK;'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
