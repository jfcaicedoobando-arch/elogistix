#!/usr/bin/env python3
"""Static and synthetic-evidence tests only: never starts Docker or PostgreSQL."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
PLAN = Path(__file__).resolve().parent
BUNDLE = PLAN.parent / 'pricing-rpc-bounded'


def module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), PLAN / (name + '.py'))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


E = module('verify-evidence')
I = module('verify-inputs')
O = module('verify-overlay')
C = module('verify-container')
B = module('build-overlay')


def assertion_log(notices, arm, detail=None):
    value = ''.join(f'psql:/overlay/{arm}-assertions.sql:30: NOTICE:  {n}\n' for n in notices)
    if arm == 'baseline':
        value += ('psql:/overlay/baseline-assertions.sql:480: ERROR:  ' + E.ERROR + '\nDETAIL:  '
                  + json.dumps(E.DETAIL if detail is None else detail)
                  + '\nCONTEXT:  PL/pgSQL function inline_code_block line 4 at RAISE\n')
    else:
        value += 'ROLLBACK\n'
    return value


def inspect_data(arm, sources):
    cid = ('a' if arm == 'baseline' else 'b') * 64
    volume = ('c' if arm == 'baseline' else 'd') * 64
    return [{'Id': cid, 'HostConfig': {
        'NetworkMode': 'none', 'Privileged': False, 'CapDrop': ['ALL'], 'CapAdd': None,
        'SecurityOpt': ['no-new-privileges'], 'PidsLimit': 128, 'Memory': 1073741824,
        'NanoCpus': 2000000000, 'PortBindings': {}, 'PidMode': '', 'Devices': [], 'DeviceRequests': None},
        'Config': {'User': 'postgres', 'Image': I.IMAGE, 'Entrypoint': ['/bin/bash'],
                   'Cmd': ['/candidate/run-arm.sh', arm],
                   'Env': ['PATH=/usr/bin:/bin', 'PG_MAJOR=17', 'PGDATA=/var/lib/postgresql/data',
                           'PRICING_CRM_ISOLATED_CONTAINER=1']},
        'Mounts': [{'Type': 'bind', 'RW': False, 'Destination': dest, 'Source': src}
                   for dest, src in sources.items()] + [
                       {'Type': 'volume', 'Destination': '/var/lib/postgresql/data', 'Driver': 'local', 'Name': volume}]}]


def make_evidence(evidence):
    overlay = evidence / 'overlay'
    B.build(BUNDLE, overlay)
    O.verify_overlay(overlay, True)
    (evidence / 'input-verification.json').write_text(json.dumps(I.verify_inputs()))
    (evidence / 'postgres-image.txt').write_text(I.IMAGE + '\n')
    (evidence / 'checkout-commit.txt').write_text('1' * 40 + '\n')
    sources = {'/bundle': str(BUNDLE), '/candidate': str(PLAN), '/overlay': str(overlay)}
    for arm in ('baseline', 'candidate'):
        p = evidence / arm
        p.mkdir()
        code = 3 if arm == 'baseline' else 0
        for name in ('assertion-exit.txt', 'docker-start-exit.txt'):
            (p / name).write_text(f'{code}\n')
        (p / 'status.txt').write_text(f'exit_code={code}\ncluster_disposed=true\n')
        (p / 'container-state.txt').write_text(f'{code} false ""\n')
        (p / 'disposal-status.txt').write_text('container_disposed=true\nanonymous_volumes_disposed=true\n')
        (p / 'load-exit.txt').write_text('0\n')
        (p / 'load.log').write_text('BEGIN\nDO\nCOMMIT\n')
        (p / 'postgres-version.txt').write_text('psql (PostgreSQL) 17.9 (Debian test fixture)\n')
        (p / 'postgres-server-version.txt').write_text('170009\nPostgreSQL 17.9 on mock test platform\n')
        (p / 'server-version.log').write_text('')
        for name, manifest in (('frozen', PLAN / 'frozen-SHA256SUMS'), ('candidate', PLAN / 'SHA256SUMS'), ('overlay', overlay / 'SHA256SUMS')):
            (p / (name + '-hashes.log')).write_text(''.join(line.split('  ', 1)[1] + ': OK\n' for line in manifest.read_text().splitlines()))
        raw = inspect_data(arm, sources)
        (p / 'container-inspect.json').write_text(json.dumps(raw))
        (p / 'container-id.txt').write_text(raw[0]['Id'] + '\n')
        isolation = C.verify_container(raw, arm, sources, raw[0]['Id'])
        (p / 'isolation.json').write_text(json.dumps(isolation))
        (p / 'anonymous-volumes.txt').write_text(isolation['anonymous_volumes'][0] + '\n')
        notices = json.loads((overlay / (arm + '-expected-notices.json')).read_text())
        (p / 'assertions.log').write_text(assertion_log(notices, arm))
        if arm == 'candidate':
            (p / 'migration-exit.txt').write_text('0\n')
            (p / 'migration.log').write_text('BEGIN\nSET\nSET\nSET\nLOCK TABLE\nDO\nCOMMIT\n')
            (p / 'final-acl-exit.txt').write_text('0\n')
            (p / 'final-acl.log').write_text('DO\n')
    return evidence


class ContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix='crm-contract-tests-', dir=PLAN.parents[2])
        cls.evidence = make_evidence(Path(cls.tmp.name))
        cls.notices = {arm: json.loads((cls.evidence / 'overlay' / (arm + '-expected-notices.json')).read_text())
                       for arm in ('baseline', 'candidate')}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_01_complete_mock_contract(self):
        report = E.verify_evidence(self.evidence)
        self.assertEqual(report['status'], 'two-arm-contract-passed')
        self.assertEqual([a['notice_count'] for a in report['arms']], [27, 32])
        self.assertEqual([a['psql_exit'] for a in report['arms']], [3, 0])

    def test_02_expected_baseline_failure(self):
        E.validate_assertions(assertion_log(self.notices['baseline'], 'baseline'), self.notices['baseline'], 'baseline', 3)

    def test_03_candidate_success(self):
        E.validate_assertions(assertion_log(self.notices['candidate'], 'candidate'), self.notices['candidate'], 'candidate', 0)

    def test_04_baseline_success_is_rejected(self):
        with self.assertRaises(ValueError):
            E.validate_assertions(assertion_log(self.notices['baseline'], 'baseline'), self.notices['baseline'], 'baseline', 0)

    def test_05_wrong_process_exits(self):
        for arm, codes in (('baseline', [1, 2, 70, 137]), ('candidate', [1, 2, 3, 137])):
            for code in codes:
                with self.subTest(arm=arm, code=code), self.assertRaises(ValueError):
                    E.validate_assertions(assertion_log(self.notices[arm], arm), self.notices[arm], arm, code)

    def test_06_notice_mutations(self):
        for arm in ('baseline', 'candidate'):
            notices = self.notices[arm]
            variants = [notices[:-1], notices[1:], [notices[1], notices[0], *notices[2:]],
                        [*notices, notices[-1]], [*notices, 'Unexpected notice'],
                        [*notices[:-1], 'PASS fabricated']]
            for changed in variants:
                with self.subTest(arm=arm, variant=changed[-1]), self.assertRaises(ValueError):
                    E.validate_assertions(assertion_log(changed, arm), notices, arm, 3 if arm == 'baseline' else 0)

    def test_07_wrong_baseline_detail(self):
        for key in E.DETAIL:
            for value in (None, False, '300', 0, 301):
                detail = dict(E.DETAIL, **{key: value})
                with self.subTest(key=key, value=value), self.assertRaises(ValueError):
                    E.validate_assertions(assertion_log(self.notices['baseline'], 'baseline', detail), self.notices['baseline'], 'baseline', 3)
        for changed in ({k: v for k, v in E.DETAIL.items() if k != 'opportunity_amount'}, dict(E.DETAIL, extra=1)):
            with self.assertRaises(ValueError):
                E.validate_assertions(assertion_log(self.notices['baseline'], 'baseline', changed), self.notices['baseline'], 'baseline', 3)

    def test_08_decimal_diagnostic_amounts(self):
        detail = {k: float(v) if type(v) == int else v for k, v in E.DETAIL.items()}
        E.validate_assertions(assertion_log(self.notices['baseline'], 'baseline', detail), self.notices['baseline'], 'baseline', 3)

    def test_09_unrelated_or_extra_diagnostics(self):
        for arm in ('baseline', 'candidate'):
            for severity in ('ERROR', 'FATAL', 'PANIC', 'WARNING'):
                log = assertion_log(self.notices[arm], arm) + severity + ':  unrelated\n'
                with self.subTest(arm=arm, severity=severity), self.assertRaises(ValueError):
                    E.validate_assertions(log, self.notices[arm], arm, 3 if arm == 'baseline' else 0)

    def test_10_baseline_detail_format(self):
        log = assertion_log(self.notices['baseline'], 'baseline')
        variants = [log.replace(E.ERROR, 'Earlier failure'), log.replace('DETAIL:', 'MISSING:'),
                    log.replace('/overlay/baseline-assertions.sql', '/candidate/other.sql'),
                    log.replace('"expected_subtotal": 300', '"expected_subtotal": 300, "expected_subtotal": 300'),
                    log + 'COMMIT\n', log.replace('CONTEXT:', 'OTHER:')]
        for changed in variants:
            with self.subTest(variant=changed[-60:]), self.assertRaises(ValueError):
                E.validate_assertions(changed, self.notices['baseline'], 'baseline', 3)

    def test_11_evidence_fail_closed(self):
        cases = [
            ('baseline/status.txt', 'exit_code=0\ncluster_disposed=true\n'),
            ('candidate/status.txt', 'exit_code=0\ncluster_disposed=false\n'),
            ('baseline/container-state.txt', '3 true ""\n'),
            ('candidate/container-state.txt', '0 false "bad"\n'),
            ('baseline/docker-start-exit.txt', '0\n'),
            ('candidate/assertion-exit.txt', '3\n'),
            ('baseline/disposal-status.txt', 'container_disposed=false\nanonymous_volumes_disposed=true\n'),
            ('candidate/disposal-status.txt', 'container_disposed=true\nanonymous_volumes_disposed=false\n'),
            ('candidate/load.log', 'ERROR:  load failed\n'),
            ('candidate/load-exit.txt', '3\n'),
            ('candidate/migration.log', 'BEGIN\nSET\nSET\nSET\nLOCK TABLE\nDO\nROLLBACK\n'),
            ('candidate/migration.log', 'ERROR:  migration failed\n'),
            ('candidate/migration-exit.txt', '3\n'),
            ('candidate/final-acl.log', 'ERROR:  ACL changed\n'),
            ('candidate/final-acl-exit.txt', '3\n'),
            ('candidate/postgres-version.txt', 'psql (PostgreSQL) 16.9\n'),
            ('candidate/postgres-version.txt', 'psql (PostgreSQL) 17.8\n'),
            ('candidate/postgres-server-version.txt', '160009\nPostgreSQL 16.9 on mock test platform\n'),
            ('candidate/postgres-server-version.txt', '170008\nPostgreSQL 17.8 on mock test platform\n'),
            ('candidate/server-version.log', 'ERROR: version query failed\n'),
            ('candidate/anonymous-volumes.txt', ''),
            ('candidate/frozen-hashes.log', 'assertions.sql: OK\n'),
            ('baseline/candidate-hashes.log', 'candidate-migration.sql: FAILED\n'),
            ('candidate/overlay-hashes.log', ''),
            ('postgres-image.txt', 'postgres:latest\n'), ('checkout-commit.txt', 'unknown\n'),
        ]
        for relative, changed in cases:
            path = self.evidence / relative
            old = path.read_text()
            try:
                path.write_text(changed)
                with self.subTest(file=relative, changed=changed), self.assertRaises(ValueError):
                    E.verify_evidence(self.evidence)
            finally:
                path.write_text(old)

    def test_12_missing_evidence_rejected(self):
        for relative in ('baseline/assertions.log', 'baseline/status.txt', 'candidate/migration.log', 'candidate/final-acl-exit.txt'):
            path = self.evidence / relative
            old = path.read_bytes()
            try:
                path.unlink()
                with self.subTest(file=relative), self.assertRaises((ValueError, FileNotFoundError)):
                    E.verify_evidence(self.evidence)
            finally:
                path.write_bytes(old)

    def test_13_baseline_never_migrated_or_continued(self):
        for name in ('migration.log', 'migration-exit.txt', 'final-acl.log', 'final-acl-exit.txt'):
            path = self.evidence / 'baseline' / name
            try:
                path.write_text('0\n')
                with self.subTest(file=name), self.assertRaises(ValueError):
                    E.verify_evidence(self.evidence)
            finally:
                path.unlink()

    def test_14_container_isolation_failures(self):
        sources = {'/bundle': str(BUNDLE), '/candidate': str(PLAN), '/overlay': str(self.evidence / 'overlay')}
        original = inspect_data('candidate', sources)
        for field, value in [('NetworkMode', 'host'), ('Privileged', True), ('CapDrop', []),
                             ('CapAdd', ['SYS_ADMIN']), ('SecurityOpt', []), ('Memory', 0),
                             ('NanoCpus', 0), ('PidsLimit', 0), ('PidMode', 'host'),
                             ('PortBindings', {'5432/tcp': []}), ('Devices', [{'PathOnHost': '/dev/sda'}])]:
            raw = copy.deepcopy(original)
            raw[0]['HostConfig'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                C.verify_container(raw, 'candidate', sources, raw[0]['Id'])
        for field, value in [('User', 'root'), ('Image', 'postgres:17'), ('Entrypoint', ['/bin/sh']),
                             ('Cmd', ['/candidate/run-arm.sh', 'baseline']), ('Env', ['SECRET=bad'])]:
            raw = copy.deepcopy(original)
            raw[0]['Config'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                C.verify_container(raw, 'candidate', sources, raw[0]['Id'])
        for change in ('writable', 'extra', 'named-volume', 'wrong-source', 'duplicate'):
            raw = copy.deepcopy(original)
            if change == 'writable': raw[0]['Mounts'][0]['RW'] = True
            if change == 'extra': raw[0]['Mounts'].append({'Type': 'bind', 'RW': False, 'Destination': '/secrets', 'Source': '/secrets'})
            if change == 'named-volume': raw[0]['Mounts'][-1]['Name'] = 'existing-database'
            if change == 'wrong-source': raw[0]['Mounts'][0]['Source'] = '/other'
            if change == 'duplicate': raw[0]['Mounts'].append(raw[0]['Mounts'][0])
            with self.subTest(change=change), self.assertRaises(ValueError):
                C.verify_container(raw, 'candidate', sources, raw[0]['Id'])

    def test_15_exact_frozen_and_reviewed_hashes(self):
        result = I.verify_inputs()
        self.assertEqual(result['candidate_files']['candidate-migration.sql'], I.MIGRATION_HASH)
        self.assertEqual(result['candidate_files']['build-overlay.py'], I.BUILDER_HASH)
        self.assertEqual(len(result['frozen_files']), 14)

    def test_16_overlay_and_l04_unchanged(self):
        overlay = self.evidence / 'overlay'
        O.verify_overlay(overlay)
        original = (BUNDLE / 'assertions.sql').read_text()
        l04 = original[original.index(B.BEFORE_L04):original.index(B.AFTER_L04) + len(B.AFTER_L04)]
        for arm in ('baseline', 'candidate'):
            self.assertEqual((overlay / (arm + '-assertions.sql')).read_text().count(l04), 1)
        self.assertEqual(self.notices['baseline'][-1], B.W01)
        self.assertIn(B.R01, self.notices['candidate'])

    def test_17_overlay_tampering(self):
        path = self.evidence / 'overlay' / 'candidate-assertions.sql'
        old = path.read_bytes()
        try:
            path.write_bytes(old + b'-- tamper\n')
            with self.assertRaises(ValueError): O.verify_overlay(path.parent)
        finally:
            path.write_bytes(old)
        path = self.evidence / 'overlay' / 'unexpected.sql'
        try:
            path.write_text('SELECT 1;')
            with self.assertRaises(ValueError): O.verify_overlay(path.parent)
        finally:
            path.unlink()

    def test_18_manifest_rejects_nonregular_and_missing_inputs(self):
        with tempfile.TemporaryDirectory(dir=PLAN.parents[2]) as temp:
            p = Path(temp)
            (p / 'a').write_text('x')
            import hashlib
            manifest = p / 'SHA256SUMS'
            manifest.write_text(hashlib.sha256(b'x').hexdigest() + '  a\n')
            I.verify_manifest(p, manifest, ('SHA256SUMS',))
            (p / 'a').unlink()
            (p / 'a').symlink_to(PLAN / 'candidate-migration.sql')
            with self.assertRaises(ValueError): I.verify_manifest(p, manifest, ('SHA256SUMS',))
            (p / 'a').unlink()
            with self.assertRaises(ValueError): I.verify_manifest(p, manifest, ('SHA256SUMS',))

    def test_19_shell_and_python_syntax(self):
        for name in ('run-ci.sh', 'run-arm.sh'):
            subprocess.run(['bash', '-n', str(PLAN / name)], check=True, capture_output=True)
        for path in PLAN.glob('*.py'):
            compile(path.read_text(), str(path), 'exec')

    def test_20_runner_scope_and_order(self):
        host = (PLAN / 'run-ci.sh').read_text()
        arm = (PLAN / 'run-arm.sh').read_text()
        self.assertIn('[[ $# == 0 && "${GITHUB_ACTIONS:-}" == true ]]', host)
        self.assertIn('run_arm baseline\nrun_arm candidate\n', host)
        self.assertEqual(host.count('dst=/'), 3)
        for required in ('--network none', '--user postgres', '--cap-drop ALL', '--security-opt no-new-privileges',
                         'docker rm --force --volumes "$CONTAINER"', 'docker container ls', 'docker volume ls'):
            self.assertIn(required, host)
        self.assertLess(arm.index('sql "$PLAN/load.sql"'), arm.index('sql "$PLAN/candidate-migration.sql"'))
        self.assertLess(arm.index('sql "$PLAN/candidate-migration.sql"'), arm.index('sql "/overlay/$ARM-assertions.sql"'))
        self.assertIn('if [[ "$ARM" == baseline || "$assertion_code" != 0 ]]; then exit "$assertion_code"; fi', arm)
        self.assertIn('env -i PATH=/usr/bin:/bin', arm)
        self.assertIn("listen_addresses=''", arm)
        self.assertIn('--auth-host=reject', arm)
        self.assertIn('--one-file-system', arm)
        for forbidden in ('docker system prune', 'docker volume prune', 'docker volume rm', '--privileged', '--network host', 'PGPASSWORD', 'DATABASE_URL'):
            self.assertNotIn(forbidden, host + arm)

    def test_21_workflow_is_ci_only(self):
        workflow = (PLAN.parents[2] / '.github/workflows/pricing-rpc-bounded.yml').read_text()
        for required in ('pull_request:', 'workflow_dispatch:', 'contents: read', 'persist-credentials: false',
                         'if: always()', 'if-no-files-found: error', 'scripts/ci/pricing-crm-trigger/run-ci.sh',
                         'set -o pipefail', '2>&1 | tee pricing-crm-preflight.log',
                         'path: |\n            pricing-crm-preflight.log\n            pricing-crm-trigger-evidence/'):
            self.assertIn(required, workflow)
        for forbidden in ('push:', 'pull_request_target:', 'secrets.', 'continue-on-error:', 'supabase', 'environment:'):
            self.assertNotIn(forbidden, workflow)

    def test_22_overlay_readable_by_container_user(self):
        overlay = self.evidence / 'overlay'
        self.assertEqual(overlay.stat().st_mode & 0o777, 0o755)
        for path in overlay.iterdir():
            self.assertEqual(path.stat().st_mode & 0o777, 0o644)

    def test_23_wrong_inputs_rejected(self):
        # Entry guards are tested without Docker: their failure happens first.
        env = dict(os.environ, GITHUB_ACTIONS='false')
        result = subprocess.run(['bash', str(PLAN / 'run-ci.sh')], env=env, capture_output=True)
        self.assertEqual(result.returncode, 64)
        result = subprocess.run(['bash', str(PLAN / 'run-arm.sh'), 'production'], env=env, capture_output=True)
        self.assertEqual(result.returncode, 64)


    def test_24_failed_preflight_keeps_artifact_log(self):
        workflow = (PLAN.parents[2] / '.github/workflows/pricing-rpc-bounded.yml').read_text()
        run = workflow.split('        run: |\n', 1)[1].split('      - name:', 1)[0]
        commands = '\n'.join(line[10:] for line in run.splitlines())
        with tempfile.TemporaryDirectory(prefix='crm-preflight-test-', dir=PLAN.parents[2]) as temp:
            root = Path(temp)
            fake_bin = root / 'fake-bin'
            fake_bin.mkdir()
            python = fake_bin / 'python3'
            python.write_text('#!/bin/sh\nprintf "mock preflight stdout\\n"\nprintf "mock preflight failure\\n" >&2\nexit 42\n')
            python.chmod(0o700)
            runtime = root / 'scripts/ci/pricing-crm-trigger/run-ci.sh'
            runtime.parent.mkdir(parents=True)
            runtime.write_text('#!/bin/sh\ntouch runtime-incorrectly-started\n')
            env = dict(os.environ, PATH=str(fake_bin) + ':' + os.environ['PATH'])
            result = subprocess.run(['/bin/bash', '-e', '-o', 'pipefail', '-c', commands],
                                    cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 42)
            self.assertEqual((root / 'pricing-crm-preflight.log').read_text(),
                             'mock preflight stdout\nmock preflight failure\n')
            self.assertFalse((root / 'runtime-incorrectly-started').exists())
            self.assertFalse((root / 'pricing-crm-trigger-evidence').exists())


if __name__ == '__main__':
    print('STATIC/MOCKED ONLY: no Docker or PostgreSQL was executed.', flush=True)
    unittest.main(verbosity=2)
