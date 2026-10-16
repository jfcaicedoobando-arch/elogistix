"""Offline gates/composition tests. Never start PostgreSQL, Docker or a network call."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import run_ci as lane
import stage


def event():
    repository = {'full_name': lane.REPOSITORY, 'owner': {'login': 'jfcaicedoobando-arch'}}
    return {'action': 'opened', 'repository': repository, 'pull_request': {'draft': True,
        'head': {'ref': lane.BRANCH, 'sha': 'a' * 40, 'repo': copy.deepcopy(repository)},
        'base': {'ref': 'main', 'sha': lane.BASE, 'repo': copy.deepcopy(repository)}}}


def environment():
    return {'GITHUB_ACTIONS': 'true', 'AUTHORITY_ENTRY_ISOLATED': '1',
            'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': lane.REPOSITORY}


def report():
    return {'status': 'PASS_ISOLATED_INTEGRATION_ONLY', 'admission': 'NOT_ADMITTED', 'endpoint': 'DISABLED',
        'cases': [{'case': name, 'status': 'PASS'} for name in lane.CASES], 'timeline': [{'event': 'fixture'}],
        'physicalWire': {'allOwnedTransportsCloseConfirmed': True, 'version': '8.23.1', 'nodeVersion': 'v24.19.0', 'identities': [{'label': 'fixture'}]},
        'claims': 0, 'business': 'NOT_RUN', 'rpcAuthentication': 'NOT_RUN', 'operationalAcl': 'NOT_ESTABLISHED',
        'restoreDurability': 'NOT_ESTABLISHED', 'crossProcessQuarantine': 'NOT_ESTABLISHED'}


class EntryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.frozen = lane.verify_sources()
        cls.golden = lane.load_module('test_entry_golden', lane.ROOT / lane.GOLDEN / 'run_ci.py')
        cls.golden_stage = lane.load_module('test_entry_golden_stage', lane.ROOT / lane.GOLDEN / 'stage.py')

    def test_exact_gate(self):
        self.assertEqual(lane.gate(event(), environment(), 'a' * 40), 'a' * 40)

    def test_environment_gate_rejections(self):
        for key in environment():
            wrong = environment(); wrong[key] = 'wrong'
            with self.subTest(key=key), self.assertRaises(RuntimeError): lane.gate(event(), wrong)

    def test_event_gate_rejections(self):
        changes = [lambda e: e.update(action='ready_for_review'),
            lambda e: e['pull_request'].update(draft=False),
            lambda e: e['pull_request']['head'].update(ref='main'),
            lambda e: e['pull_request']['head'].update(sha='x' * 40),
            lambda e: e['pull_request']['base'].update(sha='b' * 40),
            lambda e: e['pull_request']['base'].update(ref='other'),
            lambda e: e['pull_request']['head']['repo'].update(full_name='other/repository'),
            lambda e: e['pull_request']['base']['repo']['owner'].update(login='other')]
        for change in changes:
            wrong = event(); change(wrong)
            with self.assertRaises(RuntimeError): lane.gate(wrong, environment())
        with self.assertRaises(RuntimeError): lane.gate(event(), environment(), 'c' * 40)

    def test_invalid_execution_rejected_before_subprocess(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(lane.sys, 'argv', ['run_ci.py', '--execute-disposable', '--output', '/tmp/unused-entry']), patch.object(lane.subprocess, 'check_output') as call:
            with self.assertRaises(RuntimeError): lane.main()
            call.assert_not_called()

    def test_source_inventory_and_golden_loading(self):
        self.assertEqual(len(self.frozen), 29)
        self.assertEqual(self.frozen['scripts/ci/demo-authentic-review/sql/registry.sql'],
                         (lane.ROOT / 'docs/review/demo-flow-20261015/issuer/16-owner-registry.sql').read_bytes())
        self.assertTrue(self.golden.load_persistence().load_infrastructure().IMAGE.endswith('f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'))
        self.assertEqual(self.golden_stage.PG_VERSION, '8.23.1')
        self.assertEqual(self.golden_stage.NODE_VERSION, '24.19.0')

    def test_original_sql_includes_staged_and_pinned(self):
        source = self.frozen[lane.SQL_ROOT + 'synthetic-schema.sql'].decode()
        for name in ('runtime-guards.sql', 'crm-trigger.sql'):
            self.assertIn('\\ir ' + name, source)
            self.assertIn(lane.SQL_ROOT + name, self.frozen)
        implementation = (lane.HERE / 'run_ci.py').read_text()
        self.assertIn("['-f', target]", implementation)
        self.assertLess(implementation.index('runner.install_runtime(archive, manifest)'), implementation.index('runner.prepare(frozen);'))

    def test_source_drift_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / 'scripts/ci/demo-authority-entry-postgres-review/source-pins.json'
            manifest.parent.mkdir(parents=True)
            manifest.write_bytes((lane.HERE / 'source-pins.json').read_bytes())
            for path, body in self.frozen.items():
                target = root / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(body)
            self.assertEqual(lane.verify_sources(root), self.frozen)
            target = root / lane.OWNER / 'issuer.mjs'; target.write_bytes(target.read_bytes() + b'\n')
            with self.assertRaisesRegex(RuntimeError, 'Source drift'): lane.verify_sources(root)

    def test_runtime_report_completeness(self):
        self.assertEqual(lane.parse_report(json.dumps(report()), self.golden)['status'], 'PASS_ISOLATED_INTEGRATION_ONLY')
        for change in [lambda r: r['cases'].pop(), lambda r: r['cases'].reverse(),
                lambda r: r.update(admission='ADMITTED'), lambda r: r.update(claims=1),
                lambda r: r.update(business='PASS'), lambda r: r.update(restoreDurability='PASS'),
                lambda r: r['physicalWire'].update(allOwnedTransportsCloseConfirmed=False),
                lambda r: r['physicalWire'].update(version='8.21.1')]:
            wrong = report(); change(wrong)
            with self.assertRaises(RuntimeError): lane.parse_report(json.dumps(wrong), self.golden)

    def test_failed_runtime_remains_failed(self):
        value = report(); value['status'] = 'FAIL'; value['cases'] = value['cases'][:2]
        value['failure'] = {'case': lane.CASES[2], 'code': 'ERR_ASSERTION', 'sourceLine': 42}
        self.assertEqual(lane.parse_report(json.dumps(value), self.golden)['status'], 'FAIL')
        value['failure']['code'] = '/home/somebody/private.log'
        with self.assertRaises(RuntimeError): lane.parse_report(json.dumps(value), self.golden)

    def test_sensitive_evidence_rejected(self):
        for key in ('password', 'dsn', 'connectionString', 'hostPath'):
            wrong = report(); wrong[key] = 'forbidden'
            with self.assertRaises(RuntimeError): lane.parse_report(json.dumps(wrong), self.golden)

    def test_non_actions_staging_has_no_side_effect(self):
        with patch.dict(os.environ, {}, clear=True), tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'must-not-exist'
            with self.assertRaisesRegex(RuntimeError, 'ACTIONS_LINUX_ONLY'):
                stage.stage_runtime(path, self.golden_stage, self.frozen)
            self.assertFalse(path.exists())

    def test_lock_is_original_exact_integrity(self):
        lock = json.loads(self.frozen[lane.GOLDEN + 'deps/package-lock.json'])
        self.assertIs(self.golden_stage.validate_lock(lock), lock)
        lock['packages']['node_modules/pg']['integrity'] = 'sha512-wrong'
        with self.assertRaises(RuntimeError): self.golden_stage.validate_lock(lock)

    def test_composition_does_not_invoke_historical_or_business_runtimes(self):
        source = (lane.HERE / 'run_ci.py').read_text()
        self.assertNotIn('super().prepare()', source)
        self.assertNotIn('verify_sources()', (lane.HERE / 'stage.py').read_text())
        self.assertIn("golden.CONTAINER_ROOT + '/authority-runtime.mjs'", source)
        self.assertIn("with:\n          ref: ${{ github.event.pull_request.head.sha }}", (lane.ROOT / '.github/workflows/demo-authority-entry-postgres-review.yml').read_text())
        fixture = (lane.HERE / 'fixture.sql').read_text()
        self.assertNotIn('unbound_business_entrypoint(', fixture)
        self.assertNotIn('GRANT ', fixture)
        runtime = (lane.HERE / 'runtime.mjs').read_text()
        for name in ('createIssuerEntry', 'createAuthorityProvider', 'createIssuer', 'ISSUE_SQL'):
            self.assertIn('import {', runtime); self.assertIn(name, runtime)
        self.assertNotIn('syntheticWire', runtime)

if __name__ == '__main__': unittest.main()
