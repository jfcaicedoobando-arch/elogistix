"""Offline tests. No Docker daemon, socket, network, or SQL execution."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('run_ci', Path(__file__).with_name('run_ci.py'))
ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ci)
SHA = 'a' * 40


def event():
    repo = {'full_name': ci.REPOSITORY, 'owner': {'login': ci.OWNER}}
    return {'action': 'opened', 'repository': copy.deepcopy(repo), 'pull_request': {
        'draft': True, 'base': {'repo': copy.deepcopy(repo), 'ref': 'main', 'sha': ci.BASE},
        'head': {'repo': copy.deepcopy(repo), 'ref': ci.BRANCH, 'sha': SHA}}}


def env():
    return {'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': ci.REPOSITORY}


def completed(code=0, stdout='', stderr=''):
    return subprocess.CompletedProcess([], code, stdout, stderr)


class Gates(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(ci.gate(event(), env(), SHA), SHA)

    def test_fork_base_head_draft_action_gates(self):
        mutations = [
            lambda e: e['pull_request']['head']['repo'].update(full_name='other/elogistix'),
            lambda e: e['pull_request']['base']['repo']['owner'].update(login='other'),
            lambda e: e['pull_request']['base'].update(sha='b' * 40),
            lambda e: e['pull_request']['base'].update(ref='develop'),
            lambda e: e['pull_request']['head'].update(ref='other-branch'),
            lambda e: e['pull_request'].update(draft=False),
            lambda e: e.update(action='closed'),
            lambda e: e['repository'].update(full_name='other/repo'),
        ]
        for change in mutations:
            with self.subTest(change=change):
                e = event(); change(e)
                with self.assertRaises(RuntimeError): ci.gate(e, env(), SHA)
        for name, value in [('GITHUB_EVENT_NAME', 'pull_request_target'), ('GITHUB_REPOSITORY', 'other/repo')]:
            e = env(); e[name] = value
            with self.assertRaises(RuntimeError): ci.gate(event(), e, SHA)
        with self.assertRaises(RuntimeError): ci.gate(event(), env(), 'b' * 40)

    def test_hash_locked_inputs_and_exact_matrix(self):
        ci.verify_sources()

    def test_changed_hash_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / next(iter(ci.HASHES))).write_text('changed')
            with self.assertRaisesRegex(RuntimeError, 'hash changed'): ci.verify_sources(root)

    def test_version_context_rejected(self):
        query = Mock(side_effect=[completed(), completed(stdout=json.dumps({'version': '170007'}))])
        with self.assertRaises(AssertionError):
            ci.matrix(query, Mock(), Mock(), {}, {}, Mock(), Mock(), Mock(), [])


class Lifecycle(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        (self.path / 'logs').mkdir()
        self.runner = ci.Runner(self.path, '1-1-' + SHA[:12])
        self.runner.image_id = 'sha256:' + 'b' * 64
        (self.path / 'owned.cid').write_text('c' * 64)

    def info(self):
        return {'Id': 'c' * 64, 'Name': '/' + self.runner.name, 'Image': self.runner.image_id,
                'Config': {'Image': ci.IMAGE, 'User': 'postgres', 'Labels': {
                    'io.elogistix.seed-r3': 'disposable-review', 'io.elogistix.run-id': self.runner.run_id, 'io.elogistix.ownership-token': self.runner.token}},
                'State': {'Running': True}, 'Mounts': [],
                'HostConfig': {'NetworkMode': 'none', 'ReadonlyRootfs': True, 'Privileged': False,
                    'CapDrop': ['ALL'], 'SecurityOpt': ['no-new-privileges'], 'Memory': 1073741824,
                    'NanoCpus': 2000000000, 'PidsLimit': 128, 'Tmpfs': {'/tmp': '', '/var/lib/postgresql/data': ''}}}

    def test_owned_identity(self):
        self.runner.docker = Mock(return_value=completed(stdout=json.dumps([self.info()])))
        self.runner.inspect_owned()
        self.assertEqual(self.runner.cid, 'c' * 64)

    def test_isolation_and_ownership_rejected(self):
        mutations = [lambda i: i['Config']['Labels'].update({'io.elogistix.run-id': 'foreign'}),
                     lambda i: i.update(Name='/foreign'), lambda i: i.update(Image='other'),
                     lambda i: i['HostConfig'].update(NetworkMode='host'),
                     lambda i: i['HostConfig'].update(ReadonlyRootfs=False),
                     lambda i: i['HostConfig'].update(Privileged=True),
                     lambda i: i['HostConfig'].update(Binds=['/var/run/docker.sock:/socket']),
                     lambda i: i['Config'].update(User='root'),
                     lambda i: i['HostConfig'].update(Memory=0),
                     lambda i: i['HostConfig'].update(PortBindings={'5432/tcp': []}),
                     lambda i: i.update(Mounts=[{'Type': 'volume', 'Destination': '/elsewhere'}])]
        for change in mutations:
            i = self.info(); change(i)
            self.runner.docker = Mock(return_value=completed(stdout=json.dumps([i])))
            with self.subTest(change=change):
                with self.assertRaises(RuntimeError): self.runner.inspect_owned()

    def test_fixed_image_and_restricted_create(self):
        args = self.runner.create_args()
        self.assertIn(ci.IMAGE, args)
        self.assertNotIn('--privileged', args)
        self.assertNotIn('--publish', args)
        self.assertNotIn('--volume', args)
        self.assertEqual(self.runner.env['DOCKER_HOST'], 'unix:///var/run/docker.sock')
        self.assertNotIn('PGHOST', self.runner.env)

    def test_bad_digest_rejected_before_create(self):
        self.runner.docker = Mock(side_effect=[completed(), completed(stdout=json.dumps([{'RepoDigests': ['postgres@sha256:wrong']}]))])
        with self.assertRaisesRegex(RuntimeError, 'digest mismatch'): self.runner.start()
        self.assertEqual(self.runner.docker.call_count, 2)

    def test_sql_uses_stdin_and_owned_socket(self):
        self.runner.cid = 'c' * 64
        self.runner.docker = Mock(return_value=completed())
        self.runner.query('SELECT 1;', 'test')
        call = self.runner.docker.call_args
        self.assertEqual(call.kwargs['source'], 'SELECT 1;')
        self.assertIn('/tmp/r3/socket', call.args[0])
        self.assertNotIn('SELECT 1;', call.args[0])

    def persistent_context(self):
        return {'version': '170006', 'user': 'postgres', 'session': 'postgres', 'superuser': False, 'admin_member': False, 'listen': ''}

    def test_persistent_transport_is_gated_and_registered(self):
        self.runner.cid = 'c' * 64
        self.runner.inspect_owned = Mock(return_value=self.info())
        self.runner.query = Mock(return_value=completed(stdout=json.dumps(self.persistent_context())))
        process = Mock()
        with patch.object(ci.subprocess, 'Popen', return_value=process) as popen:
            self.assertIs(self.runner.psqlctl('qa_r3_cc_writer_commit', 'cc-writer_commit-a'), process)
        args = popen.call_args.args[0]; opts = popen.call_args.kwargs
        self.assertEqual(args[:4], ['docker', 'exec', '-i', self.runner.cid])
        self.assertEqual(args[4:9], ['sh', '-c', 'exec "$@" 2>&1', 'sh', 'psql'])
        self.assertIn('/tmp/r3/socket', args)
        self.assertIn('ON_ERROR_STOP=0', args)
        self.assertIs(opts['stderr'], subprocess.STDOUT)
        self.assertFalse(opts['shell'])
        self.assertTrue(opts['text'])
        self.assertEqual(opts['bufsize'], 1)
        self.assertEqual(self.runner.sessions, [process])
        self.assertNotIn('PGHOST', opts['env'])

    def test_fixed_wrapper_merges_before_transport_without_interpolation(self):
        # Local synthetic byte I/O only: no Docker, SQL, network, or database.
        marker = 'literal; $(must_not_execute)'
        code = "import os,sys; [(os.write(2,b'ERROR: XX000: tuple concurrently updated\\n'),os.write(1,b'MARK XX000\\n')) for _ in range(100)]; os.write(1,sys.argv[1].encode())"
        completed_process = subprocess.run(['sh', '-c', 'exec "$@" 2>&1', 'sh', sys.executable, '-I', '-c', code, marker],
                                           text=True, capture_output=True, shell=False, timeout=5)
        self.assertEqual(completed_process.returncode, 0)
        self.assertEqual(completed_process.stderr, '')
        self.assertEqual(completed_process.stdout, ('ERROR: XX000: tuple concurrently updated\nMARK XX000\n' * 100) + marker)

    def test_persistent_invalid_names_identity_and_version_never_spawn(self):
        with patch.object(ci.subprocess, 'Popen') as popen:
            for db, label in [('postgres', 'cc-test-a'), ('qa_r3_cc_ok;DROP', 'cc-test-a'), ('qa_r3_cc_ok', '../log')]:
                with self.assertRaises(RuntimeError): self.runner.psqlctl(db, label)
            self.runner.inspect_owned = Mock(side_effect=RuntimeError('wrong owner'))
            with self.assertRaises(RuntimeError): self.runner.psqlctl('qa_r3_cc_ok', 'cc-test-a')
            self.runner.inspect_owned = Mock(return_value=self.info())
            for field, value in [('version', '170007'), ('superuser', True), ('session', 'supabase_admin'), ('admin_member', True), ('listen', '*')]:
                context = self.persistent_context(); context[field] = value
                self.runner.query = Mock(return_value=completed(stdout=json.dumps(context)))
                with self.assertRaises(RuntimeError): self.runner.psqlctl('qa_r3_cc_ok', 'cc-test-a')
            popen.assert_not_called()

    def test_sigterm_during_spawn_still_registers_owned_child(self):
        self.runner.cid = 'c' * 64
        self.runner.inspect_owned = Mock(return_value=self.info())
        self.runner.query = Mock(return_value=completed(stdout=json.dumps(self.persistent_context())))
        process = Mock()
        def spawn(*args, **kwargs):
            ci.signal.raise_signal(ci.signal.SIGTERM)
            return process
        old = ci.signal.getsignal(ci.signal.SIGTERM)
        with patch.object(ci.subprocess, 'Popen', side_effect=spawn):
            with self.assertRaisesRegex(RuntimeError, 'Interrupted during'): self.runner.psqlctl('qa_r3_cc_ok', 'cc-test-a')
        self.assertEqual(self.runner.sessions, [process])
        self.assertIs(ci.signal.getsignal(ci.signal.SIGTERM), old)

    def test_outer_cleanup_reaps_only_registered_children_before_inspection(self):
        process = Mock(); process.poll.return_value = None
        process.wait.side_effect = [subprocess.TimeoutExpired('owned-client', 5), 0]
        process.stdin = process.stdout = process.stderr = None
        self.runner.sessions = [process]
        order = []
        process.terminate.side_effect = lambda: order.append('terminate')
        process.kill.side_effect = lambda: order.append('kill')
        def inspect():
            order.append('inspect')
            raise RuntimeError('stop test after clients')
        self.runner.inspect_owned = Mock(side_effect=inspect)
        with self.assertRaisesRegex(RuntimeError, 'stop test'): self.runner.cleanup()
        self.assertEqual(order, ['terminate', 'kill', 'inspect'])
        self.assertTrue(self.runner.result['owned_psql_clients_closed'])
        self.assertEqual(process.wait.call_count, 2)

    def test_client_cleanup_failure_does_not_skip_owned_container_cleanup(self):
        process = Mock(); process.poll.side_effect = RuntimeError('client failure')
        self.runner.sessions = [process]
        self.runner.cid = 'c' * 64
        info = self.info(); info['State']['Running'] = False
        self.runner.inspect_owned = Mock(return_value=info)
        self.runner.docker = Mock(return_value=completed())
        self.runner.cleanup()
        self.assertFalse(self.runner.result['owned_psql_clients_closed'])
        self.assertEqual(self.runner.result['status'], 'failed')
        self.assertIn('remove-owned', [c.args[1] for c in self.runner.docker.call_args_list])

    def test_timeout_records_logs(self):
        with patch.object(ci.subprocess, 'run', side_effect=subprocess.TimeoutExpired(['docker'], 60, b'partial', b'error')):
            with self.assertRaises(subprocess.TimeoutExpired): self.runner.command(['docker'], 'timeout')
        self.assertEqual((self.path / 'logs/001-timeout.stdout').read_text(), 'partial')
        self.assertTrue((self.path / 'logs/001-timeout.timeout.json').exists())

    def test_cleanup_confirms_status_pid_and_removal(self):
        self.runner.cid = 'c' * 64
        stopped = self.info(); stopped['State']['Running'] = False
        self.runner.inspect_owned = Mock(side_effect=[self.info(), stopped])
        self.runner.inside = Mock(side_effect=[completed(), completed(), completed(), completed(3), completed()])
        self.runner.docker = Mock(return_value=completed())
        self.runner.cleanup()
        labels = [c.args[1] for c in self.runner.inside.call_args_list]
        self.assertIn('cleanup-stop', labels)
        self.assertIn('cleanup-no-pid', labels)
        self.assertEqual(self.runner.result['cleanup'], 'confirmed_stopped_and_removed')
        self.assertTrue(all(self.runner.cid in c.args[0] or ('id=' + self.runner.cid) in c.args[0] for c in self.runner.docker.call_args_list))

    def test_partial_initdb_status4_still_removes_owned_container_without_pass(self):
        self.runner.cid = 'c' * 64
        stopped = self.info(); stopped['State']['Running'] = False
        self.runner.inspect_owned = Mock(side_effect=[self.info(), stopped])
        self.runner.inside = Mock(side_effect=[completed(), completed(4)])
        self.runner.docker = Mock(return_value=completed())
        self.runner.cleanup()
        self.assertEqual(self.runner.result['cleanup'], 'confirmed_removed_after_cluster_error')
        self.assertFalse(self.runner.result['pg_status_3_and_no_pid'])
        self.assertEqual(self.runner.result['status'], 'failed')
        self.assertIn('remove-owned', [c.args[1] for c in self.runner.docker.call_args_list])

    def test_create_timeout_recovers_owned_id(self):
        (self.path / 'owned.cid').unlink()
        info = self.info(); info['State']['Running'] = False
        self.runner.docker = Mock(side_effect=[completed(stdout='c' * 64), completed(stdout=json.dumps([info])), completed(), completed()])
        self.runner.cleanup()
        self.assertEqual((self.path / 'owned.cid').read_text().strip(), 'c' * 64)
        self.assertEqual(self.runner.result['cleanup'], 'confirmed_stopped_and_removed')
        self.assertNotEqual(self.runner.result['status'], 'pass')

    def test_create_recovery_refuses_foreign_token_without_removal(self):
        (self.path / 'owned.cid').unlink()
        info = self.info(); info['Config']['Labels']['io.elogistix.ownership-token'] = 'foreign'
        self.runner.docker = Mock(side_effect=[completed(stdout='c' * 64), completed(stdout=json.dumps([info]))])
        with self.assertRaisesRegex(RuntimeError, 'token mismatch'): self.runner.cleanup()
        self.assertEqual(self.runner.docker.call_count, 2)
        self.assertFalse((self.path / 'owned.cid').exists())

    def test_wrong_primary_sqlstate_not_masked_by_context(self):
        self.runner.inside = Mock(return_value=completed(3, stderr='ERROR:  42601: syntax error\nCONTEXT: 55000: LC_SEED_DEMO_CONSERVACION_PENDIENTE\n'))
        with self.assertRaisesRegex(RuntimeError, 'stopped primary error'): self.runner.query('test', 'stopped-view', expected=3)
        with self.assertRaisesRegex(RuntimeError, 'admission SQLSTATE'): self.runner.query('test', 'admission-case', expected=3)

    def test_stopped_exact_primary_error_allowed(self):
        self.runner.inside = Mock(return_value=completed(3, stderr='ERROR:  55000: LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción\nCONTEXT: inert fixture\n'))
        self.runner.query('test', 'stopped-view', expected=3)

    def test_unconfirmed_removal_fails(self):
        self.runner.cid = 'c' * 64
        i = self.info(); i['State']['Running'] = False
        self.runner.inspect_owned = Mock(return_value=i)
        self.runner.docker = Mock(side_effect=[completed(), completed(stdout=self.runner.cid)])
        with self.assertRaisesRegex(RuntimeError, 'removal unconfirmed'): self.runner.cleanup()

    def test_main_requires_concurrency_then_cleanup_before_pass(self):
        ep = self.path / 'event.json'; ep.write_text(json.dumps(event()))
        environment = {**env(), 'GITHUB_EVENT_PATH': str(ep), 'RUNNER_TEMP': str(self.path), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
        order = []
        def concurrent(runner):
            order.append('concurrency')
            self.assertNotEqual(runner.result['status'], 'pass')
            runner.result['concurrency_two_sessions'] = 'PASS'
        def terminal(runner, controls):
            order.append('terminal')
            self.assertNotEqual(runner.result['status'], 'pass')
            runner.result['terminal_direct_calls'] = 'PASS'
        def ledger(runner, controls):
            order.append('ledger')
            runner.result['ledger_cases'] = 'checks_pass_cleanup_pending'
            module = Mock()
            def finalize(result):
                order.append('ledger-finalize')
                self.assertEqual(result['cleanup'], 'confirmed_stopped_and_removed')
                result['ledger_cases'] = 'PASS'
            module.finalize_ledger_result.side_effect = finalize
            return module
        def cleanup(runner):
            order.append('cleanup')
            self.assertNotEqual(runner.result['status'], 'pass')
            runner.result.update(pg_status_3_and_no_pid=True, owned_psql_clients_closed=True, cleanup='confirmed_stopped_and_removed')
        with patch.dict(os.environ, environment), patch.object(sys, 'argv', ['run_ci.py']), \
             patch.object(ci.subprocess, 'check_output', return_value=SHA), patch.object(ci.Runner, 'start'), \
             patch.object(ci, 'matrix', side_effect=lambda *args: order.append('matrix')), \
             patch.object(ci, 'run_concurrency', side_effect=concurrent), patch.object(ci, 'run_terminal_calls', side_effect=terminal), patch.object(ci, 'run_ledger_cases', side_effect=ledger), patch.object(ci.Runner, 'cleanup', cleanup), \
             patch('builtins.print'):
            ci.main()
        self.assertEqual(order, ['matrix', 'concurrency', 'terminal', 'ledger', 'cleanup', 'ledger-finalize'])
        result = json.loads((self.path / ('seed-r3-1-1-' + SHA[:12]) / 'result.json').read_text())
        self.assertEqual(result['status'], 'pass')

    def test_terminal_failure_still_reaches_outer_cleanup_and_cannot_pass(self):
        ep = self.path / 'event.json'; ep.write_text(json.dumps(event()))
        environment = {**env(), 'GITHUB_EVENT_PATH': str(ep), 'RUNNER_TEMP': str(self.path), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
        controls = object()
        def concurrent(runner):
            runner.result['concurrency_two_sessions'] = 'PASS'
            return controls
        def terminal(runner, actual_controls):
            self.assertIs(actual_controls, controls)
            runner.result['terminal_direct_calls'] = 'RUNNING'
            raise RuntimeError('terminal failure')
        with patch.dict(os.environ, environment), patch.object(sys, 'argv', ['run_ci.py']), \
             patch.object(ci.subprocess, 'check_output', return_value=SHA), patch.object(ci.Runner, 'start'), \
             patch.object(ci, 'matrix'), patch.object(ci, 'run_concurrency', side_effect=concurrent), \
             patch.object(ci, 'run_terminal_calls', side_effect=terminal), patch.object(ci.Runner, 'cleanup') as cleanup:
            with self.assertRaisesRegex(RuntimeError, 'regression failed'): ci.main()
            cleanup.assert_called_once()
        result = json.loads((self.path / ('seed-r3-1-1-' + SHA[:12]) / 'result.json').read_text())
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['terminal_direct_calls'], 'FAILED')

    def test_main_requires_shutdown_evidence_even_when_checks_pass(self):
        ep = self.path / 'event.json'; ep.write_text(json.dumps(event()))
        environment = {**env(), 'GITHUB_EVENT_PATH': str(ep), 'RUNNER_TEMP': str(self.path), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
        with patch.dict(os.environ, environment), patch.object(sys, 'argv', ['run_ci.py']), \
             patch.object(ci.subprocess, 'check_output', return_value=SHA), \
             patch.object(ci.Runner, 'start'), patch.object(ci, 'matrix'), patch.object(ci, 'run_concurrency'), patch.object(ci.Runner, 'cleanup'):
            with self.assertRaisesRegex(RuntimeError, 'regression failed'): ci.main()
        result = json.loads((self.path / ('seed-r3-1-1-' + SHA[:12]) / 'result.json').read_text())
        self.assertEqual(result['status'], 'failed')

    def test_main_cleanup_reached_after_timeout_and_sigterm(self):
        ep = self.path / 'event.json'; ep.write_text(json.dumps(event()))
        def sigterm():
            import signal
            signal.raise_signal(signal.SIGTERM)
        for attempt, failure in enumerate([subprocess.TimeoutExpired(['docker'], 60), sigterm], 1):
            environment = {**env(), 'GITHUB_EVENT_PATH': str(ep), 'RUNNER_TEMP': str(self.path), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': str(attempt)}
            with patch.dict(os.environ, environment), patch.object(sys, 'argv', ['run_ci.py']), \
                 patch.object(ci.subprocess, 'check_output', return_value=SHA), \
                 patch.object(ci.Runner, 'start', side_effect=failure), patch.object(ci.Runner, 'cleanup') as cleanup:
                with self.assertRaisesRegex(RuntimeError, 'regression failed'): ci.main()
                cleanup.assert_called_once()

    def test_main_never_passes_on_cleanup_failure(self):
        ep = self.path / 'event.json'; ep.write_text(json.dumps(event()))
        environment = {**env(), 'GITHUB_EVENT_PATH': str(ep), 'RUNNER_TEMP': str(self.path), 'GITHUB_RUN_ID': '1', 'GITHUB_RUN_ATTEMPT': '1'}
        with patch.dict(os.environ, environment), patch.object(sys, 'argv', ['run_ci.py']), \
             patch.object(ci.subprocess, 'check_output', return_value=SHA), \
             patch.object(ci.Runner, 'start'), patch.object(ci, 'matrix'), patch.object(ci, 'run_concurrency'), \
             patch.object(ci.Runner, 'cleanup', side_effect=RuntimeError('cleanup failed')):
            with self.assertRaisesRegex(RuntimeError, 'regression failed'): ci.main()
        result = json.loads((self.path / ('seed-r3-1-1-' + SHA[:12]) / 'result.json').read_text())
        self.assertEqual(result['status'], 'failed')
        self.assertEqual(result['cleanup'], 'failed')


if __name__ == '__main__':
    unittest.main()
