import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

import run_ci as lane
from sources import ROOT, SOURCE, SOURCE_BASE, STORE_SHA256


def synthetic_event():
    repo = {'full_name': lane.REPOSITORY, 'owner': {'login': 'jfcaicedoobando-arch'}}
    return {'action': 'synchronize', 'repository': repo,
            'pull_request': {'draft': True,
                             'base': {'ref': 'main', 'sha': SOURCE_BASE, 'repo': repo},
                             'head': {'ref': lane.BRANCH, 'sha': 'a' * 40, 'repo': repo}}}


class LaneTests(unittest.TestCase):
    def test_final_summary_classifies_sql_races_and_terminal_owned_cleanup(self):
        result = {'status': 'checks_pass_cleanup_pending', 'sql_lane': 'CHECKS_PASS_CLEANUP_PENDING',
                  'cleanup': 'confirmed_stopped_and_removed', 'pg_status_3_and_no_pid': True,
                  'shutdown_confirmed': True, 'phase': 'cluster_started', 'concurrency_two_sessions': 'NOT_RUN',
                  'wire': 'UNBOUND', 'checks': [
                      {'case': 'sql-two-connections-claim-' + suffix, 'status': 'pass', 'first_pid': 101,
                       'second_pid': 102, 'observed_wait': {'wait_event_type': 'Lock', 'blockers': [101]},
                       'claimant_count': 1, 'synthetic_business_events': 1} for suffix in ('commit', 'rollback')]}
        for change in ('pending_cleanup', 'failed_race', 'missing_race', 'same_backend'):
            invalid = copy.deepcopy(result)
            if change == 'pending_cleanup': invalid['cleanup'] = 'pending'
            elif change == 'failed_race': invalid['checks'][0]['status'] = 'failed'
            elif change == 'missing_race': invalid['checks'].pop()
            else: invalid['checks'][0]['second_pid'] = 101
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                lane.complete_summary(invalid)
            self.assertNotEqual(invalid['status'], 'pass')
        lane.complete_summary(result)
        self.assertEqual(result['status'], 'pass')
        self.assertEqual(result['phase'], 'complete_owned_cleanup_confirmed')
        self.assertEqual(result['concurrency_two_sessions'], 'PASS_SYNTHETIC_SQL_ONLY')
        self.assertEqual(result['concurrency_scope']['physical_owner_wire'], 'NOT_RUN')
        self.assertEqual(result['wire'], 'UNBOUND')

    def test_gate_rejects_local_fork_base_branch_and_checkout_drift(self):
        env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': lane.REPOSITORY}
        self.assertEqual(lane.gate(synthetic_event(), env, 'a' * 40), 'a' * 40)
        with self.assertRaisesRegex(RuntimeError, 'Actions only'):
            lane.gate(synthetic_event(), {}, 'a' * 40)
        changes = [('draft', False), ('base', 'sha', 'b' * 40), ('head', 'ref', 'other'),
                   ('head', 'sha', 'c' * 40), ('head', 'repo', {'full_name': 'other/repo', 'owner': {'login': 'other'}})]
        for change in changes:
            event = copy.deepcopy(synthetic_event())
            if len(change) == 2:
                event['pull_request'][change[0]] = change[1]
            else:
                event['pull_request'][change[0]][change[1]] = change[2]
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                lane.gate(event, env, 'a' * 40)

    def test_store_stdin_is_exact_bytes_and_isolation_is_inherited(self):
        # Canonical infrastructure blob, never the platform's checkout conversion.
        blob = subprocess.check_output(['git', 'show', 'HEAD:scripts/ci/crm-acl-review/run_ci.py'], cwd=ROOT)
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            (out / 'logs').mkdir()
            infrastructure = out / 'reviewed_infrastructure.py'
            infrastructure.write_bytes(blob)
            with patch.object(lane, 'INFRA', infrastructure):
                base = lane.load_infrastructure()
            runner = lane.runner_class(base)(out, 'synthetic_offline')
            runner.cid = 'synthetic_owned_container'
            runner.inspect_owned = Mock()
            response = subprocess.CompletedProcess([], 0, b'', b'')
            with patch.object(lane.subprocess, 'run', return_value=response) as call:
                runner.compile_exact_store('crm_acl_fixture_offline')
            sent = call.call_args.kwargs['input']
            self.assertIsInstance(sent, bytes)
            self.assertEqual(sent, (SOURCE / 'store.sql').read_bytes())
            self.assertNotIn('text', call.call_args.kwargs)
            self.assertEqual(runner.result['store_stdin_sha256'], STORE_SHA256)
            self.assertEqual((out / 'logs/001-exact-store.sql').read_bytes(), sent)
            args = runner.create_args()
            self.assertEqual(args[args.index('--network') + 1], 'none')
            self.assertIn('--read-only', args)
            self.assertIn('--cap-drop', args)
            for forbidden in ('--publish', '-p', '--mount', '--volume', '-v'):
                self.assertNotIn(forbidden, args)

    def test_store_queries_are_exported_from_exact_module(self):
        value = lane.query_contract()
        self.assertIn('ON CONFLICT DO NOTHING', value['ingress'])
        self.assertIn("d.stage='dispatch'", value['ingress'])
        self.assertIn('unbound_business_entrypoint', value['business'])


if __name__ == '__main__':
    unittest.main()
