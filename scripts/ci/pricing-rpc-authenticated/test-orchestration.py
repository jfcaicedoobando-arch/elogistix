#!/usr/bin/env python3
"""Exercise the real host wrapper against a fake Docker executable, never Docker/SQL."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

PLAN = Path(__file__).resolve().parent
ROOT = PLAN.parents[2]
FAKE_DOCKER = r'''#!/usr/bin/env python3
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
sys.dont_write_bytecode = True
root = Path(os.environ['MOCK_ROOT'])
state_path = root / 'fake-state.json'
state = json.loads(state_path.read_text()) if state_path.exists() else {'operations': [], 'containers': {}, 'volumes': {}}
args = sys.argv[1:]
state['operations'].append(args)
def finish(code=0, text=''):
    state_path.write_text(json.dumps(state))
    if text: print(text)
    raise SystemExit(code)
plan = root / 'scripts/ci/pricing-rpc-authenticated'
spec = importlib.util.spec_from_file_location('contract_tests', plan / 'tests.py')
tests = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tests)
scenario = os.environ['MOCK_SCENARIO']
if args[0] == 'pull': finish(0, 'mock pinned-image pull')
if args[0] == 'create':
    arm = args[-1]
    if arm == 'candidate' and (state['containers'] or state['volumes']): finish(91, 'baseline not disposed first')
    cid = ('a' if arm == 'baseline' else 'b') * 64
    sources = {}
    for i, arg in enumerate(args):
        if arg == '--mount':
            fields = dict(part.split('=', 1) for part in args[i+1].split(',') if '=' in part)
            if not args[i+1].endswith(',readonly'): finish(92)
            sources[fields['dst']] = fields['src']
    raw = tests.inspect_data(arm, sources)
    state['containers'][cid] = {'arm': arm, 'raw': raw, 'code': 3 if arm == 'baseline' else 0}
    state['volumes'][raw[0]['Mounts'][-1]['Name']] = cid
    finish(0, cid)
if args[0] == 'inspect':
    c = state['containers'][args[-1]]
    if '--format' not in args: finish(0, json.dumps(c['raw']))
    if '.Mounts' in args[2]: finish(0, c['raw'][0]['Mounts'][-1]['Name'])
    if '.State.ExitCode' in args[2]: finish(0, str(c['code']) + ' false ""')
    finish(94, 'unexpected inspect format')
if args[0] == 'start':
    c = state['containers'][args[-1]]
    if scenario == 'baseline-success' and c['arm'] == 'baseline': c['code'] = 0
    if scenario in ('candidate-failure', 'migration-failure') and c['arm'] == 'candidate': c['code'] = 3
    finish(c['code'], 'MOCK SQL execution only')
if args[0] == 'logs': finish(0, 'MOCK server log')
if args[0] == 'cp':
    c = state['containers'][args[1].split(':')[0]]
    if scenario == 'copy-failure': finish(1, 'mock evidence copy failure')
    template = root / 'mock-template'
    if not template.exists():
        template.mkdir()
        tests.make_evidence(template)
    src = template / c['arm']
    destination = Path(args[2])
    # Only files actually emitted inside run-arm.sh, not host-produced proofs.
    allowed = {'assertion-exit.txt', 'status.txt', 'load-exit.txt', 'load.log', 'postgres-version.txt',
               'postgres-server-version.txt', 'server-version.log', 'frozen-hashes.log', 'candidate-hashes.log', 'overlay-hashes.log', 'assertions.log',
               'migration-exit.txt', 'migration.log', 'final-acl-exit.txt', 'final-acl.log'}
    for file in src.iterdir():
        if file.name in allowed: shutil.copyfile(file, destination / file.name)
    (destination / 'status.txt').write_text(f"exit_code={c['code']}\ncluster_disposed=true\n")
    if scenario == 'baseline-success' and c['arm'] == 'baseline':
        (destination / 'assertion-exit.txt').write_text('0\n')
    if scenario == 'unrelated-baseline-error' and c['arm'] == 'baseline':
        p = destination / 'assertions.log'
        p.write_text(p.read_text().replace(tests.E.ERROR, 'D05: different earlier error'))
    if scenario == 'candidate-failure' and c['arm'] == 'candidate':
        (destination / 'assertion-exit.txt').write_text('3\n')
        p = destination / 'assertions.log'
        p.write_text(p.read_text() + 'ERROR:  candidate failed\n')
    if scenario == 'migration-failure' and c['arm'] == 'candidate':
        (destination / 'migration-exit.txt').write_text('3\n')
        (destination / 'migration.log').write_text('BEGIN\nERROR:  reviewed trigger guard failed\n')
        for name in ('assertion-exit.txt', 'assertions.log', 'final-acl-exit.txt', 'final-acl.log'):
            (destination / name).unlink()
    finish()
if args[0] == 'rm':
    cid = args[-1]
    if args[1:3] != ['--force', '--volumes'] or cid not in state['containers']: finish(95)
    del state['containers'][cid]
    if scenario != 'volume-left':
        state['volumes'] = {k: v for k, v in state['volumes'].items() if v != cid}
    finish(0, cid)
if args[:2] == ['container', 'ls']:
    cid = args[-1].split('=', 1)[1]
    finish(0, cid if cid in state['containers'] else '')
if args[:2] == ['volume', 'ls']:
    volume = args[-1].removeprefix('name=^').removesuffix('$')
    finish(0, volume if volume in state['volumes'] else '')
finish(96, 'unexpected Docker operation: ' + repr(args))
'''


class OrchestrationTests(unittest.TestCase):
    def test_expected_and_fail_closed_paths(self):
        scenarios = ('success', 'baseline-success', 'unrelated-baseline-error', 'candidate-failure',
                     'migration-failure', 'volume-left', 'copy-failure')
        for scenario in scenarios:
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory(prefix='crm-host-mock-', dir=ROOT.parent) as tmp:
                root = Path(tmp)
                shutil.copytree(ROOT / 'scripts/ci/pricing-rpc-bounded', root / 'scripts/ci/pricing-rpc-bounded')
                shutil.copytree(ROOT / 'scripts/ci/pricing-crm-trigger', root / 'scripts/ci/pricing-crm-trigger')
                shutil.copytree(PLAN, root / 'scripts/ci/pricing-rpc-authenticated')
                workflow = root / '.github/workflows/pricing-rpc-authenticated.yml'
                workflow.parent.mkdir(parents=True)
                shutil.copyfile(ROOT / '.github/workflows/pricing-rpc-authenticated.yml', workflow)
                fake_bin = root / 'fake-bin'
                fake_bin.mkdir()
                fake = fake_bin / 'docker'
                fake.write_text(FAKE_DOCKER)
                fake.chmod(0o700)
                env = {'PATH': str(fake_bin) + ':' + os.environ['PATH'], 'HOME': str(root),
                       'GITHUB_ACTIONS': 'true', 'GITHUB_SHA': '1' * 40,
                       'MOCK_ROOT': str(root), 'MOCK_SCENARIO': scenario,
                       'PYTHONDONTWRITEBYTECODE': '1'}
                result = subprocess.run(['bash', str(root / 'scripts/ci/pricing-rpc-authenticated/run-ci.sh')],
                                        env=env, cwd=root, capture_output=True, text=True, timeout=60)
                evidence = root / 'pricing-rpc-authenticated-evidence'
                self.assertEqual(result.returncode, 0 if scenario == 'success' else (70 if scenario in ('volume-left', 'copy-failure') else 1),
                                 (result.stdout, result.stderr, list(evidence.iterdir())))
                state = json.loads((root / 'fake-state.json').read_text())
                creates = [op[-1] for op in state['operations'] if op[0] == 'create']
                self.assertEqual(creates, ['baseline'] if scenario in ('volume-left', 'copy-failure') else ['baseline', 'candidate'])
                self.assertFalse(state['containers'])
                if scenario != 'volume-left': self.assertFalse(state['volumes'])
                self.assertEqual((evidence / 'runner-status.txt').read_text(), f'exit_code={result.returncode}\n')
                if scenario == 'success':
                    self.assertEqual(json.loads((evidence / 'assertion-summary.json').read_text())['status'], 'two-arm-contract-passed')
                if scenario == 'migration-failure':
                    self.assertIn('reviewed trigger guard failed', (evidence / 'candidate/migration.log').read_text())
                if scenario not in ('copy-failure',):
                    self.assertTrue((evidence / 'baseline/assertions.log').exists())


if __name__ == '__main__':
    print('MOCK ORCHESTRATION ONLY: fake Docker executable; no container or PostgreSQL is run.', flush=True)
    unittest.main(verbosity=2)
