"""Offline gate/result tests. Never start Docker, SQL, network or subprocesses."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('financial_compile_runner_tests', HERE / 'run_ci.py')
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


def event():
    repo = {'full_name': RUNNER.REPOSITORY, 'owner': {'login': 'jfcaicedoobando-arch'}}
    return {'action': 'opened', 'repository': copy.deepcopy(repo), 'pull_request': {
        'draft': True, 'head': {'ref': RUNNER.BRANCH, 'sha': 'a' * 40, 'repo': copy.deepcopy(repo)},
        'base': {'ref': 'main', 'sha': RUNNER.EVENT_BASE, 'repo': copy.deepcopy(repo)},
    }}


class GateTests(unittest.TestCase):
    def setUp(self):
        self.env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': RUNNER.REPOSITORY}

    def test_exact_draft_gate(self):
        self.assertEqual(RUNNER.gate(event(), self.env, 'a' * 40), 'a' * 40)

    def test_foreign_or_changed_event_rejected(self):
        changes = [
            lambda x: x.update(action='edited'),
            lambda x: x['pull_request'].update(draft=False),
            lambda x: x['pull_request']['head'].update(ref='fix/demo-financial-engine-review-20261015'),
            lambda x: x['pull_request']['head'].update(sha='b' * 40),
            lambda x: x['pull_request']['base'].update(sha='c' * 40),
            lambda x: x['pull_request']['base']['repo'].update(full_name='foreign/repo'),
            lambda x: x['pull_request']['head']['repo']['owner'].update(login='foreign'),
        ]
        for change in changes:
            current = event()
            change(current)
            with self.subTest(current=current), self.assertRaises(RuntimeError):
                RUNNER.gate(current, self.env, 'a' * 40)

    def test_local_execution_has_zero_subprocesses(self):
        with patch.dict(RUNNER.os.environ, {}, clear=True), patch.object(RUNNER.subprocess, 'check_output') as child:
            with self.assertRaisesRegex(RuntimeError, 'Actions-only'):
                RUNNER.run(HERE / 'must-not-create')
            child.assert_not_called()
        self.assertFalse((HERE / 'must-not-create').exists())

    def test_old_acceptance_flags_cannot_become_complete(self):
        cleanup = {'cleanup': 'confirmed_stopped_and_removed', 'shutdown_confirmed': True,
                   'pg_status_3_and_no_pid': True, 'verification_marker': True, 'owned_psql_clients_closed': True,
                   'stage': 'compile_checks_pass_cleanup_pending',
                   'stages': [{'stage': name, 'status': 'PASS'} for name in RUNNER.EXPECTED_STAGES]}
        passed = RUNNER.final_result(cleanup, True)
        self.assertEqual(passed['status'], 'PASS_COMPILE_ONLY')
        self.assertEqual(passed['stage'], 'complete_owned_cleanup_confirmed')
        for flag in ('complete', 'canonical_closure_complete', 'fixtures_complete'):
            self.assertIs(passed[flag], False)
        for field in ('financial_engine', 'financial_behavior', 'real_identity', 'real_authentication', 'runtime_acl_rls'):
            self.assertEqual(passed[field], 'NOT_RUN')
        self.assertEqual(passed['operational_wire'], 'UNBOUND')
        self.assertEqual(passed['demo'], 'DISABLED')
        for missing in cleanup:
            if missing in ('stages', 'stage'):
                continue
            broken = dict(cleanup)
            del broken[missing]
            self.assertEqual(RUNNER.final_result(broken, True)['status'], 'FAIL')
        self.assertEqual(RUNNER.final_result(cleanup, False)['status'], 'FAIL')
        incomplete = copy.deepcopy(cleanup)
        incomplete['stages'].pop()
        self.assertEqual(RUNNER.final_result(incomplete, True)['status'], 'FAIL')
        incomplete = copy.deepcopy(cleanup)
        incomplete['stages'][0]['status'] = 'FAIL'
        self.assertEqual(RUNNER.final_result(incomplete, True)['status'], 'FAIL')

    def test_complete_package_frozen_and_public_upstream_verified(self):
        frozen = RUNNER.verify_inputs()
        self.assertIn('upstream/flow/sql/04-engine.sql', frozen)
        self.assertIn('upstream/extract_catalog.py', frozen)
        self.assertNotIn('sql/happy.sql', frozen)
        self.assertNotIn('sql/canonical-fixture.sql', frozen)

    def test_path_escape_rejected_before_import(self):
        with tempfile.TemporaryDirectory(dir=HERE) as value:
            directory = Path(value)
            (directory / 'inputs.json').write_text(json.dumps([{'path': '../escape', 'bytes': 0, 'sha256': '0' * 64}]))
            with self.assertRaisesRegex(RuntimeError, 'Escaping'):
                RUNNER.verify_inputs(directory)

    def test_workflow_is_exact_head_with_read_only_permissions(self):
        workflow = (RUNNER.ROOT / '.github/workflows/demo-financial-compile-recovery.yml').read_text()
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', workflow)
        self.assertIn('persist-credentials: false', workflow)
        self.assertIn('contents: read', workflow)
        self.assertIn(RUNNER.EVENT_BASE, workflow)
        self.assertNotIn('secrets.', workflow)
        self.assertNotIn('workflow_dispatch', workflow)
        self.assertNotIn('continue-on-error', workflow)


if __name__ == '__main__':
    unittest.main()
