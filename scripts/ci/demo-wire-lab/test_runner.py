"""Offline authorization, archive and evidence checks; no Docker or database."""
import copy
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

import run_ci as lane


def event_fixture():
    repo = {'full_name': lane.REPOSITORY, 'owner': {'login': lane.OWNER}}
    head = 'a' * 40
    event = {'action': 'opened', 'repository': repo,
             'pull_request': {'draft': True,
                              'head': {'repo': repo, 'ref': lane.BRANCH, 'sha': head},
                              'base': {'repo': repo, 'ref': lane.BASE_REF, 'sha': lane.BASE}}}
    env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': lane.REPOSITORY}
    return event, env, head


def synthetic_tar(extra=(), omit=()):
    files = {'node': b'SYNTHETIC non-executable test bytes', 'lab_wire.mjs': b'// SYNTHETIC',
             'runtime.mjs': b'// SYNTHETIC', 'deps/node_modules/pg/package.json': b'{"synthetic":true}',
             'source/driver.mjs': b'// SYNTHETIC original-source placeholder'}
    out = io.BytesIO()
    with tarfile.open(fileobj=out, mode='w') as archive:
        for name, payload in files.items():
            if name in omit:
                continue
            info = tarfile.TarInfo(name)
            info.size = len(payload)
            info.mode = 0o755 if name == 'node' else 0o644
            archive.addfile(info, io.BytesIO(payload))
        for info, payload in extra:
            archive.addfile(info, io.BytesIO(payload) if payload else None)
    return out.getvalue(), files


def synthetic_report():
    return {'status': 'PASS_SYNTHETIC_ONLY', 'scope': 'SYNTHETIC', 'operationalWire': 'UNBOUND',
            'cases': [{'case': name, 'status': 'PASS'} for name in lane.RUNTIME_CASES],
            'timeline': [{'event': 'SYNTHETIC_TEST_ONLY'}], 'physicalWire': {'scope': 'SYNTHETIC'}}


def synthetic_failure_report():
    value = synthetic_report()
    value.update(status='FAIL_SYNTHETIC_ONLY', cases=value['cases'][:1],
                 failure={'case': lane.RUNTIME_CASES[1], 'code': 'SYNTHETIC_FAILURE'})
    return value


class RunnerSafety(unittest.TestCase):
    def test_gate_accepts_only_frozen_main_draft_checkout(self):
        self.assertEqual(lane.BASE_REF, 'main')
        self.assertEqual(lane.BASE, 'd1de16b7cafda5f739511cf7cfef645a7733651a')
        self.assertEqual(lane.BRANCH, 'codex/physical-wire-main-20261015')
        event, env, head = event_fixture()
        self.assertEqual(lane.gate(event, env, head), head)
        mutations = (
            lambda e: e.update(action='closed'),
            lambda e: e['pull_request'].update(draft=False),
            lambda e: e['pull_request']['head'].update(ref='main'),
            lambda e: e['pull_request']['head'].update(sha='b' * 40),
            lambda e: e['pull_request']['base'].update(ref='codex/persistence-pg176-quarantine'),
            lambda e: e['pull_request']['base'].update(sha='b' * 40),
            lambda e: e['pull_request']['head'].update(repo={'full_name': 'SYNTHETIC/fork', 'owner': {'login': lane.OWNER}}),
            lambda e: e['pull_request']['base'].update(repo={'full_name': lane.REPOSITORY, 'owner': {'login': 'SYNTHETIC_OTHER'}}),
        )
        for mutate in mutations:
            changed = copy.deepcopy(event)
            mutate(changed)
            with self.subTest(mutate=mutate), self.assertRaises(RuntimeError):
                lane.gate(changed, env, head)
        for field in ('GITHUB_ACTIONS', 'GITHUB_EVENT_NAME', 'GITHUB_REPOSITORY'):
            changed = dict(env, **{field: 'SYNTHETIC_INVALID'})
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                lane.gate(event, changed, head)

    def test_archive_hashes_cover_exact_regular_bytes(self):
        data, files = synthetic_tar()
        observed = lane.validate_tar(data)
        self.assertEqual(observed['tar_sha256'], hashlib.sha256(data).hexdigest())
        self.assertEqual(observed['files'], {name: hashlib.sha256(payload).hexdigest() for name, payload in files.items()})
        self.assertEqual(observed['expanded_bytes'], sum(map(len, files.values())))

    def test_archive_refuses_traversal_links_duplicate_and_special_files(self):
        for name in ('../escape', '/escape', 'a/./escape', 'a//escape', 'a\\escape', 'C:escape', 'NODE'):
            info = tarfile.TarInfo(name)
            info.size = 1
            data, _ = synthetic_tar(extra=((info, b'x'),))
            with self.subTest(name=name), self.assertRaises(RuntimeError):
                lane.validate_tar(data)
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.FIFOTYPE, tarfile.CHRTYPE):
            info = tarfile.TarInfo('synthetic-special')
            info.type = kind
            info.linkname = 'node'
            data, _ = synthetic_tar(extra=((info, None),))
            with self.subTest(kind=kind), self.assertRaises(RuntimeError):
                lane.validate_tar(data)
        data, _ = synthetic_tar(omit=('node',))
        with self.assertRaises(RuntimeError):
            lane.validate_tar(data)

    def test_runtime_requires_complete_ordered_unique_success_matrix(self):
        report = synthetic_report()
        self.assertEqual(lane.runtime_report(json.dumps(report)), report)
        mutations = (
            lambda r: r.update(status='FAIL'), lambda r: r.update(scope='operational'),
            lambda r: r.update(operationalWire='BOUND'), lambda r: r.update(physicalWire={}),
            lambda r: r.update(timeline=[]), lambda r: r['cases'].pop(),
            lambda r: r['cases'].reverse(), lambda r: r['cases'].append(r['cases'][0]),
            lambda r: r['cases'][0].update(status='FAIL'),
        )
        for mutate in mutations:
            changed = copy.deepcopy(report)
            mutate(changed)
            with self.subTest(mutate=mutate), self.assertRaises(RuntimeError):
                lane.runtime_report(json.dumps(changed))
        with self.assertRaises(ValueError):
            lane.runtime_report('incidental log\n' + json.dumps(report))

    def test_public_evidence_refuses_sensitive_categories_without_disclosing_values(self):
        marker = 'lib' + 'file' + '_' + 'SYNTHETIC'
        profile = chr(92).join(('C:', 'Users', 'SYNTHETIC', 'file'))
        for value in ({'value': marker}, {'value': profile}, {'secretKey': 'SYNTHETIC'},
                      {'nested': [{'password': 'SYNTHETIC'}]}, {'ownership_token': 'SYNTHETIC'}):
            with self.subTest(category=tuple(value)), self.assertRaises(RuntimeError):
                lane.public_payload(value)
        with self.assertRaises(RuntimeError):
            lane.public_payload({'value': 'SYNTHETIC_TOKEN'}, 'SYNTHETIC_TOKEN')

    def test_failure_protocol_is_safe_partial_evidence_and_never_a_pass(self):
        report = synthetic_failure_report()
        self.assertEqual(lane.runtime_failure_report(json.dumps(report)), report)
        with self.assertRaises(RuntimeError):
            lane.runtime_report(json.dumps(report))
        bootstrap = dict(report, cases=[], timeline=[], physicalWire={})
        self.assertEqual(lane.runtime_failure_report(json.dumps(bootstrap)), bootstrap)
        self.assertIsNone(lane.runtime_failure_report('raw stderr must stay private'))
        self.assertIsNone(lane.runtime_failure_report(json.dumps(synthetic_report())))
        mutations = (
            lambda r: r.update(message='SYNTHETIC raw detail'),
            lambda r: r.update(operationalWire='BOUND'),
            lambda r: r['failure'].update(stack='SYNTHETIC raw detail'),
            lambda r: r['failure'].update(code='SYNTHETIC raw detail with spaces'),
            lambda r: r['cases'][0].update(status='FAIL'),
            lambda r: r['cases'][0].update(case=lane.RUNTIME_CASES[1]),
            lambda r: r['timeline'].append({'message': 'SYNTHETIC raw detail'}),
            lambda r: r['physicalWire'].update(secretKey='SYNTHETIC'),
        )
        for mutate in mutations:
            changed = copy.deepcopy(report)
            mutate(changed)
            with self.subTest(mutate=mutate), self.assertRaises(RuntimeError):
                lane.runtime_failure_report(json.dumps(changed))

    def test_publish_copies_only_explicit_sanitized_json(self):
        # Explicit workspace temp avoids platform-specific sandbox temp redirects.
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            root = Path(directory).resolve()
            private, public = root / 'private', root / 'public'
            private.mkdir()
            public.mkdir()
            (private / 'ownership.json').write_text('SYNTHETIC_PRIVATE_SENTINEL', encoding='utf-8')
            runner = SimpleNamespace(token='SYNTHETIC_TOKEN', result={'status': 'pass', 'wire': 'UNBOUND'},
                                     physical_report=synthetic_report(), runtime_manifest={'files': {'node': 'a' * 64}})
            lane.publish(public, runner)
            self.assertEqual({p.name for p in public.iterdir()},
                             {'result.json', 'runtime.json', 'timeline.json', 'runtime-manifest.json'})
            self.assertNotIn('SYNTHETIC_PRIVATE_SENTINEL', ''.join(p.read_text(encoding='utf-8') for p in public.iterdir()))

    def test_prepare_runs_parent_store_and_absence_gate_before_synthetic_fixture(self):
        events = []
        class Base:
            def __init__(self):
                self.result = {}
            def prepare(self):
                events.append('parent-store-and-absence-gate')
                self.database = 'crm_acl_fixture_persistence'
            def query(self, source, label, db):
                events.append((source, label, db))
            def check(self, name, **details):
                events.append(name)
        persistence = SimpleNamespace(runner_class=lambda _: Base, load_infrastructure=lambda: None)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            fixture = Path(directory) / 'synthetic.sql'
            fixture.write_bytes(b'-- SYNTHETIC fixture only\n')
            with patch.object(lane, 'SYNTHETIC_FIXTURE', fixture):
                runner = lane.runner_class(persistence)()
                runner.prepare()
            self.assertEqual(events, ['parent-store-and-absence-gate',
                                      ('-- SYNTHETIC fixture only\n', 'wire-synthetic-business-fixture', 'crm_acl_fixture_persistence'),
                                      'synthetic-business-fixture-installed'])
            self.assertEqual(runner.result['synthetic_business_fixture_sha256'],
                             hashlib.sha256(fixture.read_bytes()).hexdigest())

    def test_node_loader_failure_exposes_only_bounded_library_basenames(self):
        diagnostic = ('SYNTHETIC_PRIVATE_STDERR /opt/SYNTHETIC/libstdc++.so.6: missing; '
                      'libatomic.so.1 libstdc++.so.6 libbad.so.private ' + 'lib' + 'x' * 80 + '.so.1')
        failure = lane.node_execution_failure(SimpleNamespace(returncode=127, stdout='', stderr=diagnostic))
        self.assertEqual(failure, {'code': 'NODE_EXECUTION_FAILED', 'exitCode': 127,
                                   'sharedLibraryNames': ['libatomic.so.1', 'libstdc++.so.6']})
        self.assertNotIn('SYNTHETIC_PRIVATE_STDERR', json.dumps(failure))
        many = ' '.join('libsynthetic' + str(n) + '.so.1' for n in range(20))
        self.assertEqual(len(lane.node_execution_failure(
            SimpleNamespace(returncode=1, stdout='', stderr=many))['sharedLibraryNames']), 8)
        for invalid in (None, True, 256, -256):
            with self.subTest(invalid=invalid), self.assertRaises(RuntimeError):
                lane.node_execution_failure(SimpleNamespace(returncode=invalid, stdout='', stderr=''))

    def test_exec_tmpfs_is_the_only_change_to_pinned_base_create_args(self):
        persistence = lane.load_persistence()
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            # Read the committed blob so a Windows CRLF checkout cannot weaken or
            # spuriously fail the exact infrastructure-byte gate. Never rewrite it.
            source = lane.subprocess.check_output(['git', 'show', 'HEAD:scripts/ci/crm-acl-review/run_ci.py'],
                                                 cwd=lane.ROOT)
            self.assertEqual(hashlib.sha256(source).hexdigest(), persistence.INFRA_SHA256)
            pinned = Path(directory) / 'pinned_infrastructure.py'
            pinned.write_bytes(source)
            with patch.object(persistence, 'INFRA', pinned):
                cls = lane.runner_class(persistence)
            runner = cls(Path(directory), 'SYNTHETIC_RUN')
            original = super(cls, runner).create_args()
            actual = runner.create_args()
            self.assertEqual(len(actual), len(original))
            self.assertEqual([(old, new) for old, new in zip(original, actual) if old != new],
                             [(lane.BASE_TMPFS, lane.EXEC_TMPFS)])
            self.assertEqual(lane.EXEC_TMPFS.replace(',exec,', ','), lane.BASE_TMPFS)
            self.assertEqual(actual.count('--tmpfs'), 2)

    def test_owned_inspection_requires_exact_tmpfs_options_after_parent_validation(self):
        class Base:
            def inspect_owned(self, recovered_cid=None):
                self.observed_recovered_cid = recovered_cid
                return self.info
        persistence = SimpleNamespace(runner_class=lambda _: Base, load_infrastructure=lambda: None)
        runner = lane.runner_class(persistence)()
        runner.result = {}
        runner.info = {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS)}}
        self.assertEqual(runner.inspect_owned('SYNTHETIC_CID'), runner.info)
        self.assertEqual(runner.observed_recovered_cid, 'SYNTHETIC_CID')
        self.assertTrue(runner.result['runtime_tmpfs_hostconfig_verified'])
        for options in (lane.BASE_TMPFS.split(':', 1)[1],
                        lane.EXPECTED_TMPFS['/tmp'] + ',suid',
                        lane.EXPECTED_TMPFS['/tmp'].replace('768m', '769m')):
            runner.info = {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS, **{'/tmp': options})}}
            with self.subTest(options=options), self.assertRaises(RuntimeError):
                runner.inspect_owned()
        runner.info = {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS, **{'/extra': 'rw'})}}
        with self.assertRaises(RuntimeError):
            runner.inspect_owned()

    def test_mount_evidence_is_filtered_validated_and_excludes_noexec(self):
        valid = 'rw,nosuid,nodev,relatime,size=786432k,inode64'
        self.assertEqual(lane.runtime_mount_options(valid + '\n'), valid.split(','))
        for value in ('', valid + '\n' + valid, valid + ',noexec', valid + ',SYNTHETIC_PRIVATE',
                      valid.replace('nosuid,', ''), valid.replace('nodev,', ''),
                      valid.replace('786432k', '999k'), valid + ',rw'):
            with self.subTest(category=value), self.assertRaises(RuntimeError):
                lane.runtime_mount_options(value)

    def test_execution_surface_probes_fixed_paths_and_fails_closed_before_node(self):
        persistence = SimpleNamespace(runner_class=lambda _: object, load_infrastructure=lambda: None)
        for mode, options, succeeds in (('755\n', 'rw,nosuid,nodev,size=786432k', True),
                                       ('644\n', 'rw,nosuid,nodev,size=786432k', False),
                                       ('755\n', 'rw,nosuid,nodev,noexec,size=786432k', False)):
            runner = lane.runner_class(persistence)()
            runner.result = {}
            runner.inside = Mock(side_effect=[SimpleNamespace(returncode=0, stdout=mode),
                                             SimpleNamespace(returncode=0, stdout=options)])
            with self.subTest(mode=mode, succeeds=succeeds):
                if succeeds:
                    runner.verify_runtime_execution_surface()
                    self.assertEqual(runner.inside.call_args_list[0].args[0],
                                     ['stat', '-c', '%a', '--', lane.CONTAINER_ROOT + '/node'])
                    self.assertEqual(runner.inside.call_args_list[1].args[0],
                                     ['awk', '$2 == "/tmp" && $3 == "tmpfs" {print $4}', '/proc/mounts'])
                    self.assertTrue(runner.result['runtime_tmpfs_rw_nosuid_nodev_without_noexec'])
                else:
                    with self.assertRaises(RuntimeError):
                        runner.verify_runtime_execution_surface()
                    self.assertNotIn('runtime_tmpfs_rw_nosuid_nodev_without_noexec', runner.result)

    def test_runtime_install_requires_exact_node_version_before_running_cases(self):
        class Base:
            def inspect_owned(self, recovered_cid=None):
                return {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS)}}
        persistence = SimpleNamespace(runner_class=lambda _: Base, load_infrastructure=lambda: None)
        data, _ = synthetic_tar()
        manifest = lane.validate_tar(data)
        hashes = ''.join(checksum + '  ' + lane.CONTAINER_ROOT + '/' + name + '\n'
                         for name, checksum in sorted(manifest['files'].items()))
        probes = ((0, lane.NODE_VERSION + '\n', '', True),
                  (0, 'v0.0.0\n', 'SYNTHETIC_PRIVATE_STDERR', False),
                  (127, '', '/opt/SYNTHETIC/libatomic.so.1: SYNTHETIC_PRIVATE_STDERR', False))
        for code, stdout, stderr, succeeds in probes:
            with self.subTest(code=code, succeeds=succeeds), tempfile.TemporaryDirectory(
                    dir=Path(__file__).resolve().parent) as directory:
                root = Path(directory)
                private, public = root / 'private', root / 'public'
                (private / 'logs').mkdir(parents=True)
                public.mkdir()
                archive = private / 'runtime.tar'
                archive.write_bytes(data)
                runner = lane.runner_class(persistence)()
                runner.output, runner.cid, runner.token = private, 'SYNTHETIC_CID', 'SYNTHETIC_TOKEN'
                runner.counter, runner.env, runner.result = 0, {'PATH': 'SYNTHETIC'}, {'wire': 'UNBOUND'}
                runner.inside = Mock(side_effect=[SimpleNamespace(returncode=0, stdout='', stderr=''),
                                                 SimpleNamespace(returncode=0, stdout=hashes, stderr=''),
                                                 SimpleNamespace(returncode=0, stdout='755\n', stderr=''),
                                                 SimpleNamespace(returncode=0, stdout='rw,nosuid,nodev,relatime,size=786432k,inode64\n', stderr=''),
                                                 SimpleNamespace(returncode=code, stdout=stdout, stderr=stderr)])
                transfer = SimpleNamespace(returncode=0, stdout=b'', stderr=b'')
                with patch.object(lane.subprocess, 'run', return_value=transfer):
                    if succeeds:
                        runner.install_runtime(archive, manifest)
                        self.assertEqual(runner.result['runtime_node_version'], lane.NODE_VERSION)
                        self.assertEqual(runner.result['runtime_node_mode'], '755')
                        self.assertTrue(runner.result['runtime_tmpfs_rw_nosuid_nodev_without_noexec'])
                        self.assertNotIn('runtime_node_failure', runner.result)
                    else:
                        with self.assertRaisesRegex(RuntimeError, '^NODE_EXECUTION_FAILED$'):
                            runner.install_runtime(archive, manifest)
                        self.assertEqual(runner.result['physical_wire_lab'], 'FAIL')
                        self.assertIsNone(runner.result['runtime_node_version'])
                        self.assertEqual(runner.result['runtime_node_failure']['exitCode'], code)
                args, label = runner.inside.call_args.args
                self.assertEqual(args, ['/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C',
                                        'GITHUB_ACTIONS=true', 'HOME=' + lane.CONTAINER_ROOT,
                                        lane.CONTAINER_ROOT + '/node', '--version'])
                self.assertEqual(label, 'wire-node-version-probe')
                self.assertIsNone(runner.inside.call_args.kwargs['expected'])
                self.assertFalse(any(value.startswith('PG') for value in args))
                lane.publish(public, runner)
                public_text = ''.join(path.read_text() for path in public.iterdir())
                self.assertNotIn('SYNTHETIC_PRIVATE_STDERR', public_text)
                self.assertNotIn('/opt/SYNTHETIC', public_text)

    def test_node_invocation_is_registered_and_has_no_pg_environment(self):
        class Base:
            def inspect_owned(self, recovered_cid=None):
                return {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS)}}
        persistence = SimpleNamespace(runner_class=lambda _: Base, load_infrastructure=lambda: None)
        process = Mock()
        process.communicate.return_value = (json.dumps(synthetic_report()), '')
        process.returncode = 0
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
            runner = lane.runner_class(persistence)()
            runner.output = Path(directory)
            (runner.output / 'logs').mkdir()
            runner.cid, runner.token, runner.sessions, runner.result = 'SYNTHETIC_CID', 'SYNTHETIC_TOKEN', [], {}
            runner.env = {'PATH': 'SYNTHETIC_MINIMAL_DOCKER_PATH'}
            with patch.object(lane.subprocess, 'Popen', return_value=process) as popen:
                runner.run_physical_cases()
            args = popen.call_args.args[0]
            self.assertIn('/usr/bin/env', args)
            self.assertIn('-i', args[args.index('/usr/bin/env'):])
            self.assertIn('GITHUB_ACTIONS=true', args)
            self.assertFalse(any(value.startswith('PG') for value in args))
            self.assertEqual(runner.sessions, [process])
            self.assertEqual(process._crm_label, 'wire-lab-node')
            self.assertEqual(popen.call_args.kwargs['env'], runner.env)

    def test_nonzero_and_zero_exit_failure_reports_are_preserved_without_public_stderr(self):
        class Base:
            def inspect_owned(self, recovered_cid=None):
                return {'HostConfig': {'Tmpfs': dict(lane.EXPECTED_TMPFS)}}
        persistence = SimpleNamespace(runner_class=lambda _: Base, load_infrastructure=lambda: None)
        report = synthetic_failure_report()
        for exit_code in (1, 0):
            with self.subTest(exit_code=exit_code), tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as directory:
                root = Path(directory)
                private, public = root / 'private', root / 'public'
                (private / 'logs').mkdir(parents=True)
                public.mkdir()
                runner = lane.runner_class(persistence)()
                runner.output, runner.cid, runner.token = private, 'SYNTHETIC_CID', 'SYNTHETIC_TOKEN'
                runner.sessions, runner.result, runner.env = [], {'wire': 'UNBOUND'}, {'PATH': 'SYNTHETIC'}
                process = Mock()
                process.returncode = exit_code
                process.communicate.return_value = (json.dumps(report), 'SYNTHETIC_PRIVATE_STDERR_SENTINEL')
                with patch.object(lane.subprocess, 'Popen', return_value=process), self.assertRaises(RuntimeError):
                    runner.run_physical_cases()
                self.assertEqual(runner.physical_report, report)
                self.assertEqual(runner.result['status'], 'failed')
                self.assertEqual(runner.result['physical_wire_lab'], 'FAIL')
                self.assertEqual(runner.result['runtime_failure'], report['failure'])
                self.assertEqual(runner.result['node_process_exit_code'], exit_code)
                lane.publish(public, runner)
                self.assertEqual(json.loads((public / 'runtime.json').read_text())['status'], 'FAIL_SYNTHETIC_ONLY')
                public_text = ''.join(path.read_text() for path in public.iterdir())
                self.assertNotIn('SYNTHETIC_PRIVATE_STDERR_SENTINEL', public_text)
                self.assertIn('SYNTHETIC_FAILURE', public_text)


if __name__ == '__main__':
    unittest.main()
