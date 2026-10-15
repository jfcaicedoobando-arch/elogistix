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


class RunnerSafety(unittest.TestCase):
    def test_gate_accepts_only_frozen_stacked_draft_checkout(self):
        event, env, head = event_fixture()
        self.assertEqual(lane.gate(event, env, head), head)
        mutations = (
            lambda e: e.update(action='closed'),
            lambda e: e['pull_request'].update(draft=False),
            lambda e: e['pull_request']['head'].update(ref='main'),
            lambda e: e['pull_request']['head'].update(sha='b' * 40),
            lambda e: e['pull_request']['base'].update(ref='main'),
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

    def test_node_invocation_is_registered_and_has_no_pg_environment(self):
        class Base:
            def inspect_owned(self):
                pass
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


if __name__ == '__main__':
    unittest.main()
