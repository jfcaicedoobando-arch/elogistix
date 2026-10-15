"""Offline mocked Docker contracts. No Docker or SQL is launched by these tests."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('financial_engine_runner', ROOT / 'run_ci.py')
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)
TOKEN = 'b' * 32
CID = 'a' * 64
NAME = 'demo-financial-' + TOKEN
IMAGE_ID = 'sha256:' + 'c' * 64


def image():
    return {'Id': IMAGE_ID, 'RepoDigests': [runner.IMAGE], 'Os': 'linux', 'Architecture': 'amd64',
            'Config': {'Env': ['PGDATA=' + runner.PGDATA, 'PATH=/usr/bin:/bin'],
                       'Entrypoint': ['docker-entrypoint.sh']}}


def container(running=False):
    return {'Id': CID, 'Name': '/' + NAME, 'Image': IMAGE_ID,
            'Config': {'Image': runner.IMAGE, 'Labels': {runner.LABEL: TOKEN},
                       'Entrypoint': ['docker-entrypoint.sh'], 'Cmd': runner.PG_COMMAND,
                       'Env': image()['Config']['Env'] + ['POSTGRES_USER=supabase_admin', 'POSTGRES_HOST_AUTH_METHOD=trust']},
            'HostConfig': {'NetworkMode': 'none', 'PortBindings': {}, 'PublishAllPorts': False,
                           'Privileged': False, 'Tmpfs': {runner.PGDATA: runner.TMPFS_OPTIONS},
                           'SecurityOpt': ['no-new-privileges'], 'Memory': 1073741824,
                           'NanoCpus': 2000000000, 'PidsLimit': 128},
            'Mounts': [], 'NetworkSettings': {'Networks': {'none': {}}, 'Ports': {'5432/tcp': None}},
            'State': {'Running': running}}


def response(stdout='', code=0):
    return SimpleNamespace(stdout=stdout, returncode=code)


class Isolation(unittest.TestCase):
    def test_every_catalog_gate_is_a_strict_boolean(self):
        complete = {'complete': True, 'canonical_closure_complete': True, 'fixtures_complete': True}
        self.assertEqual(runner.verify_catalog({'catalog-status.json': json.dumps(complete).encode()}), complete)
        for key in complete:
            for value in [False, 'true', 1, None]:
                catalog = dict(complete, **{key: value})
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    runner.verify_catalog({'catalog-status.json': json.dumps(catalog).encode()})

    def test_plan_never_launches_process(self):
        with patch.object(runner, 'verify_inputs', return_value={'catalog-status.json': b'{"complete":false}'}), \
                patch.object(runner, 'command', side_effect=AssertionError('process launched')), \
                patch('sys.argv', ['run_ci.py']):
            runner.main()

    def test_execution_requires_both_optins(self):
        for env, optin in [({}, True), ({'GITHUB_ACTIONS': 'true'}, True),
                           ({'GITHUB_ACTIONS': 'true', 'DEMO_ACCEPTANCE_ISOLATED': '1'}, False)]:
            with self.subTest(env=env, optin=optin), self.assertRaises(ValueError):
                runner.guard_execution(env, optin)

    def test_complete_catalog_required_before_any_docker(self):
        with tempfile.TemporaryDirectory() as temp, \
                patch.object(runner, 'verify_inputs', return_value={'catalog-status.json': b'{"complete":false}'}), \
                patch.object(runner, 'command', side_effect=AssertionError('Docker launched')):
            output = Path(temp) / 'evidence'
            with self.assertRaisesRegex(ValueError, 'incomplete'):
                runner.run(output)
            status = json.loads((output / 'result.json').read_text())
            self.assertEqual(status['financial_engine'], 'NOT_RUN')
            self.assertEqual(status['overall'], 'BLOCKED')
            self.assertEqual(status['cleanup']['status'], 'NOT_RUN')
            self.assertTrue(status['cleanup']['container_not_created'])
            self.assertFalse(status['cleanup_verified'])

    def test_scrubbed_process_environment_and_no_shell(self):
        with patch.object(runner.subprocess, 'run', return_value=response()) as process, \
                patch.dict(runner.os.environ, {'PGPASSWORD': 'not-forwarded', 'DOCKER_HOST': 'not-forwarded'}):
            runner.command(['docker', 'version'])
            args, kwargs = process.call_args
            self.assertEqual(args[0], ['docker', '--host=unix:///var/run/docker.sock', 'version'])
            self.assertEqual(set(kwargs['env']), {'PATH', 'LANG', 'HOME', 'DOCKER_CONFIG'})
            self.assertNotIn('shell', kwargs)
            self.assertEqual(kwargs['env']['PATH'], '/usr/bin:/bin')

    def test_pinned_local_image_required(self):
        for field, value in [('RepoDigests', []), ('Os', 'windows'), ('Architecture', 'arm64'), ('Id', 'bad')]:
            obj = image()
            obj[field] = value
            with self.subTest(field=field), patch.object(runner, 'command', return_value=response(json.dumps([obj]))), \
                    self.assertRaises(RuntimeError):
                runner.inspect_image()

    def test_owned_container_baseline_accepted(self):
        with patch.object(runner, 'command', return_value=response(json.dumps([container()]))):
            self.assertEqual(runner.inspect_owned(NAME, TOKEN, image())['Id'], CID)

    def test_isolation_mutations_rejected(self):
        mutations = [
            ('Config', 'Image', 'postgres:latest'), ('Config', 'Env', ['PGPASSWORD=secret']),
            ('Config', 'Labels', {runner.LABEL: 'other'}), ('Config', 'Entrypoint', ['sh']),
            ('Config', 'Cmd', ['-c', 'listen_addresses=*']),
            ('HostConfig', 'NetworkMode', 'host'), ('HostConfig', 'PortBindings', {'5432/tcp': [{}]}),
            ('HostConfig', 'PublishAllPorts', True), ('HostConfig', 'Privileged', True),
            ('HostConfig', 'Binds', ['/host:/container']), ('HostConfig', 'VolumesFrom', ['other']),
            ('HostConfig', 'Mounts', [{'Type': 'volume'}]), ('HostConfig', 'Links', ['other']),
            ('HostConfig', 'ExtraHosts', ['host:127.0.0.1']), ('HostConfig', 'CapAdd', ['SYS_ADMIN']),
            ('HostConfig', 'Devices', [{}]), ('HostConfig', 'DeviceRequests', [{}]),
            ('HostConfig', 'PidMode', 'host'), ('HostConfig', 'IpcMode', 'host'),
            ('HostConfig', 'UTSMode', 'host'), ('HostConfig', 'CgroupnsMode', 'host'),
            ('HostConfig', 'Tmpfs', {}), ('HostConfig', 'SecurityOpt', []),
            ('HostConfig', 'Memory', 0), ('HostConfig', 'PidsLimit', -1), ('HostConfig', 'NanoCpus', 0),
            ('NetworkSettings', 'Networks', {'bridge': {}}), ('NetworkSettings', 'Ports', {'5432/tcp': [{}]}),
        ]
        for section, key, value in mutations:
            obj = container()
            obj[section][key] = value
            with self.subTest(section=section, key=key), \
                    patch.object(runner, 'command', return_value=response(json.dumps([obj]))), \
                    self.assertRaises(RuntimeError):
                runner.inspect_owned(NAME, TOKEN, image())
        for key, value in [('Name', '/other'), ('Id', 'bad'), ('Image', 'wrong'),
                           ('Mounts', [{'Type': 'bind', 'Destination': '/host'}]),
                           ('Mounts', [{'Type': 'volume', 'Destination': runner.PGDATA}])]:
            obj = container()
            obj[key] = value
            with self.subTest(key=key), patch.object(runner, 'command', return_value=response(json.dumps([obj]))), \
                    self.assertRaises(RuntimeError):
                runner.inspect_owned(NAME, TOKEN, image())

    def test_cleanup_daemon_failure_is_not_absence(self):
        with patch.object(runner, 'command', side_effect=subprocess.CalledProcessError(1, ['docker', 'ps'])), \
                self.assertRaises(subprocess.CalledProcessError):
            runner.cleanup(NAME, TOKEN, image(), False)

    def test_uncertain_create_absence_requires_both_successful_queries(self):
        with patch.object(runner, 'command', return_value=response()) as command:
            self.assertTrue(runner.cleanup(NAME, TOKEN, image(), False)['verified'])
            self.assertEqual(command.call_count, 2)
            self.assertTrue(all(call.args[0][:3] == ['docker', 'ps', '-a'] for call in command.call_args_list))

    def test_previously_created_container_vanished_is_failure(self):
        with patch.object(runner, 'command', return_value=response()), self.assertRaisesRegex(RuntimeError, 'vanished'):
            runner.cleanup(NAME, TOKEN, image(), True)

    def test_foreign_container_is_never_removed(self):
        calls = []
        foreign = container()
        foreign['Config']['Labels'][runner.LABEL] = 'foreign'
        def command(args, **kwargs):
            calls.append(args)
            return response(json.dumps([foreign])) if args[:2] == ['docker', 'inspect'] else response(CID)
        with patch.object(runner, 'command', side_effect=command), self.assertRaises(RuntimeError):
            runner.cleanup(NAME, TOKEN, image(), True)
        self.assertFalse(any(call[:2] in (['docker', 'rm'], ['docker', 'stop']) for call in calls))

    def test_remaining_container_blocks_cleanup(self):
        with patch.object(runner, 'owned_listing', return_value={CID}), \
                patch.object(runner, 'inspect_owned', return_value=container()), \
                patch.object(runner, 'command', return_value=response()), self.assertRaisesRegex(RuntimeError, 'remains'):
            runner.cleanup(NAME, TOKEN, image(), True)

    def test_owned_container_stop_remove_then_positive_absence(self):
        with patch.object(runner, 'owned_listing', side_effect=[{CID}, set()]), \
                patch.object(runner, 'inspect_owned', side_effect=[container(True), container(False)]), \
                patch.object(runner, 'command', return_value=response()) as command:
            self.assertTrue(runner.cleanup(NAME, TOKEN, image(), True)['verified'])
            self.assertEqual([call.args[0] for call in command.call_args_list],
                             [['docker', 'stop', '--time', '10', CID], ['docker', 'rm', '-v', CID]])

    def test_cleanup_failure_writes_fail_even_after_all_suites_passed(self):
        with tempfile.TemporaryDirectory() as temp:
            reports = [{'suite': key, 'status': 'PASS'} for key in runner.SUITES]
            result = runner.write_result(Path(temp), reports, {'verified': False}, 'cleanup failure', True)
            self.assertEqual(result['financial_engine'], 'FAIL')
            self.assertEqual(result['overall'], 'FAIL')

    def test_pass_requires_complete_success_and_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            reports = [{'suite': key, 'status': 'PASS'} for key in runner.SUITES]
            for cleanup, failure, complete, expected in [({'verified': True}, None, True, 'PASS'),
                                                       ({'verified': False}, None, True, 'FAIL'),
                                                       ({'verified': True}, 'error', True, 'FAIL'),
                                                       ({'verified': True}, None, False, 'BLOCKED')]:
                result = runner.write_result(Path(temp), reports, cleanup, failure, complete)
                self.assertEqual(result['overall'], expected)
                self.assertEqual(result['real_transport'], 'NOT_RUN')
                self.assertEqual(result['rls'], 'NOT_RUN')

    def test_uncertain_create_cleanup_failure_preserves_failure_evidence(self):
        frozen = {'catalog-status.json': b'{"complete":true,"canonical_closure_complete":true,"fixtures_complete":true}'}
        calls = []
        def command(args, *unused, **kwargs):
            calls.append(args)
            if args[:2] == ['docker', 'create']:
                raise subprocess.TimeoutExpired(args, 180)
            raise subprocess.CalledProcessError(1, args, 'daemon unavailable')
        with tempfile.TemporaryDirectory() as temp, patch.object(runner, 'verify_inputs', return_value=frozen), \
                patch.object(runner, 'inspect_image', return_value=image()), \
                patch.object(runner.uuid, 'uuid4', return_value=SimpleNamespace(hex=TOKEN)), \
                patch.object(runner, 'command', side_effect=command):
            output = Path(temp) / 'evidence'
            with self.assertRaises(subprocess.CalledProcessError):
                runner.run(output)
            result = json.loads((output / 'result.json').read_text())
            self.assertEqual(result['overall'], 'FAIL')
            self.assertFalse(result['cleanup_verified'])
            self.assertIn('TimeoutExpired', result['failure'])
            self.assertIn('CalledProcessError', result['cleanup']['error'])
            self.assertEqual(sum(call[:2] == ['docker', 'create'] for call in calls), 1)

    def test_input_validation_precedes_every_process(self):
        with patch.object(runner, 'verify_inputs', side_effect=ValueError('drift')), \
                patch.object(runner, 'command', side_effect=AssertionError('process launched')):
            with self.assertRaisesRegex(ValueError, 'drift'):
                runner.run(Path('unused'))

    def test_manifest_inventory_hash_and_path_guards(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            paths = ['catalog-status.json', 'run_ci.py', 'sql/setup.sql'] + ['sql/' + x + '.sql' for x in runner.SUITES]
            rows = []
            for rel in paths:
                path = root / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'fixture')
                rows.append({'path': rel, 'bytes': 7, 'sha256': hashlib.sha256(b'fixture').hexdigest()})
            manifest = root / 'inputs.json'
            manifest.write_text(json.dumps(rows))
            self.assertIn('sql/happy.sql', runner.verify_inputs(root))
            (root / 'unhashed.sql').write_text('not allowed')
            with self.assertRaisesRegex(ValueError, 'inventory'):
                runner.verify_inputs(root)
            (root / 'unhashed.sql').unlink()
            for rel in ['../escape', '/absolute', 'C:/escape', 'sql\\escape', 'sql/../escape', './file']:
                invalid = copy.deepcopy(rows)
                invalid[0]['path'] = rel
                manifest.write_text(json.dumps(invalid))
                with self.subTest(path=rel), self.assertRaises(ValueError):
                    runner.verify_inputs(root)
            manifest.write_text(json.dumps(rows + [rows[0]]))
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                runner.verify_inputs(root)
            manifest.write_text(json.dumps(rows))
            (root / 'sql/happy.sql').write_text('drift')
            with self.assertRaisesRegex(ValueError, 'hash drift'):
                runner.verify_inputs(root)

    def test_readiness_excludes_initdb_temporary_postgres(self):
        self.assertIn('[ "$(cat /proc/1/comm)" = postgres ] && pg_isready', runner.READY_COMMAND)
        self.assertIn('-h /var/run/postgresql -U supabase_admin', runner.READY_COMMAND)

    def mocked_runtime(self, output, missing_marker=None, fail_sql=None):
        frozen = {'catalog-status.json': b'{"complete":true,"canonical_closure_complete":true,"fixtures_complete":true}',
                  'sql/setup.sql': b'-- frozen setup bytes'}
        calls, databases, staged_paths = [], [], []
        removed = False
        def command(args, stdin=None, **kwargs):
            nonlocal removed
            calls.append(args)
            if args[:2] == ['docker', 'create']:
                return response('Informational pull progress\n' + 'd' * 64 + '\n')
            if args[:2] == ['docker', 'cp']:
                staged = Path(args[2])
                staged_paths.append(staged)
                self.assertEqual((staged / 'sql/setup.sql').read_bytes(), frozen['sql/setup.sql'])
                return response()
            if args[:3] == ['docker', 'ps', '-a']:
                return response('' if removed else CID)
            if args[:2] == ['docker', 'rm']:
                removed = True
                return response()
            if args[:3] == ['docker', 'exec', '-i']:
                if stdin.startswith("SELECT current_setting('server_version_num')"):
                    return response('170006:supabase_admin:true\n')
                if stdin.startswith('CREATE DATABASE'):
                    databases.append(stdin.split()[2])
                if stdin.startswith('SELECT current_user||'):
                    return response(runner.OWNER + ':false:true:false:false:false:false\n')
                if stdin.startswith('SET demo_flow.test_disposable'):
                    key = re.search(r'\\i /tmp/financial/sql/(\w+)\.sql\nSELECT', stdin).group(1)
                    if key == fail_sql:
                        return response('ERROR: injected test SQL failure\n', 1)
                    markers = ['FINANCIAL_ASSERTIONS_COMPLETE_' + key,
                               'FINANCIAL_ROLLBACK_COMPLETE_' + key, 'FINANCIAL_SUITE_COMPLETE_' + key]
                    if key == missing_marker:
                        markers.pop(1)
                    return response('\n'.join(markers) + '\n')
            return response()
        with patch.object(runner, 'verify_inputs', return_value=frozen), \
                patch.object(runner, 'inspect_image', return_value=image()), \
                patch.object(runner, 'inspect_owned', return_value=container()), \
                patch.object(runner.uuid, 'uuid4', return_value=SimpleNamespace(hex=TOKEN)), \
                patch.object(runner, 'command', side_effect=command):
            if missing_marker or fail_sql:
                with self.assertRaises(RuntimeError):
                    runner.run(output)
            else:
                runner.run(output)
        self.assertTrue(removed)
        self.assertTrue(staged_paths)
        self.assertTrue(all(not path.exists() for path in staged_paths))
        self.assertEqual(sum(call[:2] == ['docker', 'create'] for call in calls), 1)
        return json.loads((output / 'result.json').read_text()), calls, databases

    def test_complete_mocked_run_uses_six_fresh_databases_then_cleanup(self):
        with tempfile.TemporaryDirectory() as temp:
            result, calls, databases = self.mocked_runtime(Path(temp) / 'evidence')
        self.assertEqual(result['overall'], 'PASS')
        self.assertTrue(result['cleanup_verified'])
        self.assertEqual(len(databases), 6)
        self.assertEqual(len(set(databases)), 6)
        self.assertTrue(all(db.startswith('demo_flow_disposable_') for db in databases))
        create = next(call for call in calls if call[:2] == ['docker', 'create'])
        self.assertIn('--pull=never', create)
        self.assertNotIn('--mount', create)
        self.assertNotIn('--publish', create)
        self.assertEqual(create[create.index('--network') + 1], 'none')
        self.assertEqual([x['suite'] for x in result['suites']], list(runner.SUITES))

    def test_missing_rollback_marker_fails_but_cleans_container(self):
        with tempfile.TemporaryDirectory() as temp:
            result, _, _ = self.mocked_runtime(Path(temp) / 'evidence', missing_marker='checkpoint')
        self.assertEqual(result['financial_engine'], 'FAIL')
        self.assertTrue(result['cleanup_verified'])
        self.assertIn('Missing/duplicate assertion or rollback marker', result['failure'])
        self.assertEqual([x['suite'] for x in result['suites']], ['happy'])

    def test_sql_failure_is_not_retried_and_cleans_container(self):
        with tempfile.TemporaryDirectory() as temp:
            result, calls, _ = self.mocked_runtime(Path(temp) / 'evidence', fail_sql='marker')
        self.assertEqual(result['overall'], 'FAIL')
        self.assertTrue(result['cleanup_verified'])
        self.assertIn('SQL stage failed', result['failure'])
        scripts = [call for call in calls if call[:3] == ['docker', 'exec', '-i']]
        self.assertEqual(len(scripts), 11)  # version, roles; 3 x (database, role, suite).


if __name__ == '__main__':
    unittest.main(verbosity=2)
