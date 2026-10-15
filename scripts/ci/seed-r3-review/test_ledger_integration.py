"""Offline integration gates only; never starts a database or container."""
import importlib.util
import json
import os
import tempfile
import subprocess
from contextlib import ExitStack
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('ledger_ci_adapter', ROOT / 'run_ci.py')
ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ci)


class LedgerIntegrationGates(unittest.TestCase):
    def test_explicitly_reviewed_branch_base_and_digest_are_consistent(self):
        contract = json.loads((ROOT / 'review-contract.json').read_text())
        workflow = (ROOT.parents[2] / '.github/workflows/seed-r3-review.yml').read_text()
        self.assertEqual(ci.BASE, 'c935c2593dfd725edb3c30dcab9bd6f0439ff71b')
        self.assertEqual(ci.BRANCH, 'fix/seed-r3-ledger-review-20261015')
        self.assertEqual(contract['base_sha'], ci.BASE)
        self.assertEqual(contract['head_branch'], ci.BRANCH)
        self.assertEqual(contract['image'], ci.IMAGE)
        self.assertEqual(contract['server_version_num'], '170006')
        self.assertIn(ci.BASE, workflow)
        self.assertIn(ci.BRANCH, workflow)
        self.assertIn('github.event.pull_request.draft == true', workflow)

    def test_unreviewed_ledger_hook_fails_before_import(self):
        with patch.object(ci, 'HASHES', {}), patch.object(ci.importlib.util, 'spec_from_file_location') as loader:
            with self.assertRaisesRegex(RuntimeError, 'Ledger input has not been reviewed'):
                ci.run_ledger_cases(Mock(), Mock())
            loader.assert_not_called()

    def test_cli_enters_guarded_main_and_optimized_runtime_rejected(self):
        source = (ROOT / 'run_ci.py').read_text()
        tail = source.split("if __name__ == '__main__':", 1)[1]
        self.assertEqual(tail.strip(), 'main()')
        result = subprocess.run([sys.executable, '-I', '-O', str(ROOT / 'run_ci.py')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Python optimization would disable matrix assertions', result.stderr)

    def test_ledger_failures_cannot_pass_and_always_cleanup(self):
        for scenario in ('case_failure', 'missing_finalizer', 'finalizer_failure', 'cleanup_failure'):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as tmp:
                path = Path(tmp)
                event = path / 'event.json'
                event.write_text('{}')
                sha = 'a' * 40
                environment = {'GITHUB_EVENT_PATH': str(event), 'RUNNER_TEMP': tmp,
                               'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
                def concurrency(runner):
                    runner.result['concurrency_two_sessions'] = 'PASS'
                def terminal(runner, controls):
                    runner.result['terminal_direct_calls'] = 'PASS'
                def ledger(runner, controls):
                    runner.result['ledger_cases'] = 'RUNNING'
                    if scenario == 'case_failure':
                        raise RuntimeError('injected ledger failure')
                    runner.result['ledger_cases'] = 'checks_pass_cleanup_pending'
                    if scenario == 'missing_finalizer':
                        return None
                    module = Mock()
                    module.finalize_ledger_result.side_effect = RuntimeError('injected finalizer failure')
                    return module
                def cleanup(runner):
                    if scenario == 'cleanup_failure':
                        raise RuntimeError('injected cleanup failure')
                    runner.result.update(cleanup='confirmed_stopped_and_removed',
                                         pg_status_3_and_no_pid=True, owned_psql_clients_closed=True)
                with ExitStack() as stack:
                    stack.enter_context(patch.dict(os.environ, environment))
                    stack.enter_context(patch.object(sys, 'argv', ['run_ci.py']))
                    stack.enter_context(patch.object(ci.subprocess, 'check_output', return_value=sha))
                    stack.enter_context(patch.object(ci, 'gate', return_value=sha))
                    stack.enter_context(patch.object(ci.Runner, 'start'))
                    stack.enter_context(patch.object(ci, 'matrix'))
                    stack.enter_context(patch.object(ci, 'run_concurrency', side_effect=concurrency))
                    stack.enter_context(patch.object(ci, 'run_terminal_calls', side_effect=terminal))
                    stack.enter_context(patch.object(ci, 'run_ledger_cases', side_effect=ledger))
                    cleanup_mock = stack.enter_context(patch.object(ci.Runner, 'cleanup', autospec=True, side_effect=cleanup))
                    with self.assertRaisesRegex(RuntimeError, 'regression failed'):
                        ci.main()
                    cleanup_mock.assert_called_once()
                result = json.loads((path / ('seed-r3-1-1-' + sha[:12]) / 'result.json').read_text())
                self.assertEqual(result['status'], 'failed')
                self.assertEqual(result['ledger_cases'], 'FAILED')


if __name__ == '__main__':
    unittest.main()
