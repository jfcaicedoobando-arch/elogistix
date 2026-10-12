#!/usr/bin/env python3
"""Offline unit tests only: these do not count as executed PostgreSQL cases."""
import ast
import copy
import importlib.util
import inspect
import json
from pathlib import Path
import sys
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('lock_probe_concurrency', HERE / 'concurrency.py')
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)


class FakeSession:
    instances = []
    result_override = None
    def __init__(self, harness, label, probe_only=False):
        assert probe_only
        self.pid = 202
        self.application_name = 'observer-app'
        self.pending = None
        self.process = SimpleNamespace(poll=lambda: None)
        self.ended = []
        self.closed = False
        self.instances.append(self)
    def begin(self, fixture, probe_actor=None):
        self.fixture = fixture
        self.actor = fixture['seller' if probe_actor == 'seller' else 'manager']
        self.auth_context = {'subject': self.actor, 'caller': 'authenticated', 'org_scope': fixture.get('org')}
    def execute(self, sql):
        return [json.dumps({'id': self.fixture['lead'], 'organization_id': self.fixture['org'],
                            'vendedor_id': self.fixture['seller'], 'caller': 'authenticated', 'subject': self.actor})]
    def start(self, sql):
        self.pending = sql
    def finish(self):
        if self.result_override is not None:
            return [json.dumps(self.result_override)]
        return [json.dumps({'acquired': False, 'cancelled': True, 'sqlstate': '57014',
                           'message': 'canceling statement due to user request',
                           'row_id': 'row-1', 'caller': 'authenticated', 'subject': self.actor})]
    def end(self, commit=True):
        self.ended.append(commit)


class LockProofUnitTests(unittest.TestCase):
    def setUp(self):
        FakeSession.instances = []
        FakeSession.result_override = None
        self.h = m.Harness.__new__(m.Harness)
        self.h.deadline = time.monotonic() + 30
        self.h.events = []
        self.h.row_proofs = {}
        self.h.closed = []
        self.h.close_pair = lambda pair: self.h.closed.extend(pair)
        self.holder = SimpleNamespace(pid=101, application_name='holder-app',
                                      fixture={'manager': 'manager-1', 'seller': 'seller-1', 'lead': 'row-1', 'org': 'org-1'}, actor='manager-1')
        self.observation = {
            'probe': {'pid': 202, 'datname': 'acceptance_concurrency', 'application_name': 'observer-app',
                      'state': 'active', 'query': "SELECT pg_temp.lock_probe('cotizaciones','row-1'::uuid);",
                      'wait_event_type': 'Lock', 'wait_event': 'transactionid'},
            'holder': {'pid': 101, 'datname': 'acceptance_concurrency', 'application_name': 'holder-app',
                       'backend_xid': '1200', 'state': 'idle in transaction'},
            'blockers': [101],
            'locks': [{'pid': 202, 'locktype': 'transactionid', 'mode': 'ShareLock', 'granted': False, 'transactionid': '1200'},
                      {'pid': 101, 'locktype': 'transactionid', 'mode': 'ExclusiveLock', 'granted': True, 'transactionid': '1200'}],
        }
        self.cancelled = True
        self.h.query = lambda sql, label: json.dumps(self.observation if label.endswith('-observe')
                                                   else {'cancelled': self.cancelled})

    def run_probe(self):
        with patch.object(m, 'Session', FakeSession):
            return self.h.row_held(self.holder, 'cotizaciones', 'row-1', 'test')

    def test_exact_probe_cancellation_and_rollback(self):
        proof = self.run_probe()
        self.assertTrue(proof['observer_rollback'])
        self.assertEqual(proof['row_id'], 'row-1')
        self.assertEqual(FakeSession.instances[0].ended, [False])
        self.assertEqual(self.h.closed, FakeSession.instances)
        self.assertEqual(len(self.h.row_proofs), 1)
        self.assertEqual(len(self.h.events), 1)

    def test_wrong_backend_database_or_app_never_passes(self):
        for entity, field, value in [('probe', 'pid', 999), ('holder', 'pid', 999),
                                     ('probe', 'datname', 'other_db'), ('holder', 'datname', 'other_db'),
                                     ('probe', 'application_name', 'other'), ('holder', 'application_name', 'other')]:
            with self.subTest(entity=entity, field=field):
                original = copy.deepcopy(self.observation)
                self.observation[entity][field] = value
                with self.assertRaisesRegex(RuntimeError, 'identity mismatch'):
                    self.run_probe()
                self.assertTrue(self.h.closed)
                self.assertFalse(self.h.row_proofs)
                self.observation = original

    def test_wrong_sql_missing_lock_or_missing_xid_fails_closed(self):
        for mutation in ('query', 'locks', 'xid', 'wrong_waited_xid', 'wrong_holder_xid'):
            with self.subTest(mutation=mutation):
                original = copy.deepcopy(self.observation)
                if mutation == 'query': self.observation['probe']['query'] = 'SELECT unrelated();'
                if mutation == 'locks': self.observation['locks'] = []
                if mutation == 'xid': self.observation['holder']['backend_xid'] = None
                if mutation == 'wrong_waited_xid': self.observation['locks'][0]['transactionid'] = '9999'
                if mutation == 'wrong_holder_xid': self.observation['locks'][1]['transactionid'] = '9999'
                with self.assertRaises(RuntimeError): self.run_probe()
                self.assertFalse(self.h.row_proofs)
                self.observation = original

    def test_uncontended_row_is_not_a_lock_proof(self):
        self.observation['probe']['state'] = 'idle in transaction'
        self.observation['blockers'] = []
        with self.assertRaisesRegex(RuntimeError, 'completed without blocking'):
            self.run_probe()
        self.assertEqual(self.h.closed, FakeSession.instances)
        self.assertFalse(self.h.row_proofs)

    def test_failed_cancellation_cannot_pass(self):
        self.cancelled = False
        with self.assertRaisesRegex(RuntimeError, 'cancellation failed'): self.run_probe()
        self.assertEqual(self.h.closed, FakeSession.instances)
        self.assertFalse(self.h.row_proofs)

    def test_cancel_result_must_be_manual_and_match_row_and_actor(self):
        valid = {'acquired': False, 'cancelled': True, 'sqlstate': '57014',
                 'message': 'canceling statement due to user request', 'row_id': 'row-1',
                 'caller': 'authenticated', 'subject': 'manager-1'}
        for key, value in [('acquired', True), ('cancelled', False), ('sqlstate', '55P03'),
                           ('message', 'canceling statement due to statement timeout'),
                           ('row_id', 'other-row'), ('caller', 'postgres'), ('subject', 'other-actor')]:
            with self.subTest(key=key, value=value):
                FakeSession.result_override = dict(valid, **{key: value})
                with self.assertRaisesRegex(RuntimeError, 'must report the verified cancellation'):
                    self.run_probe()
                self.assertTrue(self.h.closed)
                self.assertFalse(self.h.row_proofs)
        FakeSession.result_override = None

    def test_cleanup_cancellation_filters_owned_backend_identity(self):
        source = inspect.getsource(m.Session.close)
        self.assertIn('pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid=', source)
        self.assertIn("datname='acceptance_concurrency' AND application_name=", source)
        self.assertIn('literal(self.application_name)', source)
        self.assertNotIn("pg_cancel_backend(' + str(self.pid)", source)
        self.assertIn('ROLLBACK;', source)

    def test_transaction_must_remain_exactly_the_proved_one(self):
        self.run_probe()
        current = dict(self.observation['holder'], xid_lock=True)
        self.h.query = lambda sql, label: json.dumps(current)
        self.h.assert_row_proof(self.holder, 'cotizaciones', 'row-1', 'same')
        for key, value in [('backend_xid', '1201'), ('backend_xid', None), ('xid_lock', False),
                           ('state', 'idle'), ('datname', 'other'), ('application_name', 'other')]:
            with self.subTest(key=key, value=value):
                original = current[key]; current[key] = value
                with self.assertRaisesRegex(RuntimeError, 'same live holder transaction'):
                    self.h.assert_row_proof(self.holder, 'cotizaciones', 'row-1', 'changed')
                current[key] = original
        with self.assertRaisesRegex(RuntimeError, 'must be probed'):
            self.h.assert_row_proof(self.holder, 'cotizaciones', 'different-row', 'missing')

    def test_observer_never_calls_business_rpc_or_mutates_rows(self):
        helper = m.PROBE_HELPERS
        self.assertIn('SECURITY INVOKER', helper)
        self.assertIn('FOR UPDATE', helper)
        self.assertNotIn('public.aceptar_cotizacion_version', helper)
        self.assertNotIn('public.convertir_prospecto_a_cliente_rpc', helper)
        self.assertNotRegex(helper, r'(?i)\b(INSERT|DELETE|MERGE|TRUNCATE|GRANT|ALTER)\b')
        self.assertNotRegex(helper, r'(?i)\bUPDATE\s+public\.')
        s = m.Session.__new__(m.Session); s.probe_only = True
        with self.assertRaisesRegex(RuntimeError, 'cannot call a business RPC'):
            s.call('accept', 'row-1')

    def test_lead_observer_uses_verified_owner_and_other_tables_keep_manager(self):
        self.observation['probe']['query'] = "SELECT pg_temp.lock_probe('crm_leads','row-1'::uuid);"
        with patch.object(m, 'Session', FakeSession):
            proof = self.h.row_held(self.holder, 'crm_leads', 'row-1', 'lead')
        self.assertEqual(proof['probe_auth']['subject'], 'seller-1')
        self.assertEqual(proof['lead_owner_preflight']['vendedor_id'], 'seller-1')
        self.assertEqual(proof['holder']['pid'], self.holder.pid)
        with patch.object(m, 'Session', FakeSession):
            with self.assertRaisesRegex(RuntimeError, 'exact fixture lead'):
                self.h.row_held(self.holder, 'crm_leads', 'other-lead', 'wrong-lead')
        self.observation['probe']['query'] = "SELECT pg_temp.lock_probe('cotizaciones','row-1'::uuid);"
        proof = self.run_probe()
        self.assertEqual(proof['probe_auth']['subject'], 'manager-1')
        self.assertIsNone(proof['lead_owner_preflight'])

    def test_lead_owner_preflight_rejects_actor_tenant_owner_or_row_mismatch(self):
        valid = {'id': 'row-1', 'organization_id': 'org-1', 'vendedor_id': 'seller-1',
                 'caller': 'authenticated', 'subject': 'seller-1'}
        m.Harness.validate_probe_owner(valid, self.holder.fixture)
        for field, value in [('id', None), ('id', 'other'), ('organization_id', 'other-tenant'),
                             ('vendedor_id', 'other-owner'), ('caller', 'postgres'), ('subject', 'manager-1')]:
            with self.subTest(field=field):
                with self.assertRaisesRegex(RuntimeError, 'exact same-tenant lead owned'):
                    m.Harness.validate_probe_owner(dict(valid, **{field: value}), self.holder.fixture)

    def test_seller_may_start_only_non_rpc_probe_without_conversion_permission(self):
        fixture = {'manager': 'manager-1', 'seller': 'seller-1', 'org': 'org-1'}
        s = m.Session.__new__(m.Session); s.probe_only = True; s.pid = 1; s.label = 'seller'
        data = {'pid': 1, 'caller': 'authenticated', 'subject': 'seller-1', 'auth_role': 'authenticated',
                'org_scope': 'org-1', 'member': True, 'tenant_scope': True, 'global_admin': False,
                'conversion_authorized': False, 'actor_has_role': True}
        s.execute = lambda sql: [json.dumps(data)]
        s.begin(fixture, probe_actor='seller')
        self.assertEqual(s.actor, 'seller-1')
        self.assertFalse(s.auth_context['conversion_authorized'])
        with self.assertRaisesRegex(RuntimeError, 'cannot call a business RPC'): s.call('convert', 'row-1')
        for key, value in [('caller', 'postgres'), ('subject', 'manager-1'), ('org_scope', 'other'),
                           ('member', False), ('tenant_scope', False), ('global_admin', True), ('actor_has_role', False)]:
            original = data[key]; data[key] = value
            with self.assertRaisesRegex(RuntimeError, 'actual role/tenant'):
                s.begin(fixture, probe_actor='seller')
            data[key] = original
        s.probe_only = False
        with self.assertRaisesRegex(RuntimeError, 'Only a non-RPC observer'):
            s.begin(fixture, probe_actor='seller')
        s.probe_only = True
        with self.assertRaisesRegex(RuntimeError, 'Only a non-RPC observer'):
            s.begin(fixture, probe_actor='unrecognized')
        data['subject'] = 'manager-1'
        with self.assertRaisesRegex(RuntimeError, 'actual role/tenant'):
            s.begin(fixture)
        data['conversion_authorized'] = True
        s.begin(fixture)
        self.assertEqual(s.actor, 'manager-1')

    def test_case_inventory_unchanged_and_python_parses(self):
        ast.parse((HERE / 'concurrency.py').read_text())
        self.assertEqual(len(m.EXPECTED_CASE_IDS), 8)
        self.assertEqual(len(set(m.EXPECTED_CASE_IDS)), 8)
        self.assertNotIn("l.transactionid::text=t.xmax::text", (HERE / 'concurrency.py').read_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
