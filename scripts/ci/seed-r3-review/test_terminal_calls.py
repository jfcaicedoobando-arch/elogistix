"""Offline mocks only. No SQL, Docker, subprocess or external service execution."""
from contextlib import contextmanager
import hashlib
import re
import unittest
from unittest.mock import patch

import terminal_calls as t


class Reply:
    def __init__(self, state='00000', text='', value=None):
        self.state, self.text, self.value = state, text, value
    def ok(self):
        if self.state != '00000':
            raise AssertionError(self.text)
        return self
    def json(self):
        self.ok()
        return self.value


class Controls:
    @staticmethod
    def body_hashes(snapshot):
        return snapshot['hashes']
    @staticmethod
    def primary_errors(text):
        return re.findall(r'^ERROR: ([0-9A-Z]{5}): (.*)$', text, re.M)
    @staticmethod
    def validate_identity(identity):
        if identity != {'pid': 7, 'backend_start': 'holder-start'}:
            raise AssertionError('invalid mocked holder')


class TerminalGateTests(unittest.TestCase):
    def session(self, reply):
        class Session:
            calls = []
            def execute(self, sql):
                self.calls.append(sql)
                return reply
        return Session()

    def test_no_call_before_all_four_terminal_hashes(self):
        for key in t.STOPPED:
            for mutation in ('missing', 'historical'):
                hashes = dict(t.STOPPED)
                if mutation == 'missing':
                    del hashes[key]
                else:
                    hashes[key] = 'historical-body'
                session = self.session(Reply())
                with self.subTest(key=key, mutation=mutation), self.assertRaises(AssertionError):
                    t.stopped_call(Controls, session, {'hashes': hashes}, 'cleanup')
                self.assertEqual(session.calls, [])

    def test_each_allowlisted_terminal_call_requires_exact_55000(self):
        for name, sql in t.CALLS:
            session = self.session(Reply('55000', 'ERROR: 55000: ' + t.MESSAGE))
            t.stopped_call(Controls, session, {'hashes': t.STOPPED}, name)
            self.assertEqual(session.calls, [sql])

    def test_wrong_state_or_message_rejected(self):
        for state, message in [('42501', 'approver missing'), ('55P03', 'lock timeout'), ('57014', 'statement timeout'), ('55000', 'other error'), ('00000', t.MESSAGE)]:
            with self.subTest(state=state), self.assertRaises(AssertionError):
                t.stopped_call(Controls, self.session(Reply(state, 'ERROR: ' + state + ': ' + message)), {'hashes': t.STOPPED}, 'core')

    def test_unknown_call_never_executes(self):
        session = self.session(Reply())
        with self.assertRaises(AssertionError):
            t.stopped_call(Controls, session, {'hashes': t.STOPPED}, 'SELECT evil')
        self.assertEqual(session.calls, [])

    def test_guarded_zero_and_positive_present(self):
        self.assertIn(('guarded_zero', 'SELECT public.seed_demo_organization_guarded(0);'), t.CALLS)
        self.assertIn(('guarded_cooldown', 'SELECT public.seed_demo_organization_guarded(600000);'), t.CALLS)


class HolderEvidenceTests(unittest.TestCase):
    def observer(self, held=True, start='holder-start', acquired=False):
        class Observer:
            def execute(self, sql):
                if 'pg_try_advisory_xact_lock' in sql:
                    return Reply(value={'acquired': acquired})
                return Reply(value={'pid': 7, 'backend_start': start, 'held': held})
        return Observer()

    def test_exact_holder_and_failed_nonblocking_trylock(self):
        self.assertTrue(t.observe_holder(Controls, self.observer(), {'pid': 7, 'backend_start': 'holder-start'})['held'])

    def test_missing_reused_or_released_holder_rejected(self):
        for kwargs in ({'held': False}, {'start': 'reused-pid'}, {'acquired': True}):
            with self.subTest(kwargs=kwargs), self.assertRaises(AssertionError):
                t.observe_holder(Controls, self.observer(**kwargs), {'pid': 7, 'backend_start': 'holder-start'})


class FullProtocolMocks(unittest.TestCase):
    def protocol(self, cleanup_failure=False):
        events = []
        terminal_snapshot = {'hashes': dict(t.STOPPED)}
        class Runner:
            result = {}
            def save(self):
                events.append('save:' + self.result.get('terminal_direct_calls', ''))
            def snapshot(self, db, label):
                events.append(label)
                if label == 'terminal-historical-definition-baseline':
                    return {'hashes': 'historical'}
                return terminal_snapshot
            def check(self, name, **details):
                events.append('check')
                self.details = details
        class Session:
            def __init__(self, pid):
                self.identity = {'pid': pid, 'backend_start': 'holder-start' if pid == 7 else 'caller-start'}
            def execute(self, sql):
                if sql in dict(t.CALLS).values():
                    events.append('call:' + sql)
                    return Reply('55000', 'ERROR: 55000: ' + t.MESSAGE)
                if sql == t.AUTH_FIXTURE_SQL:
                    events.append('auth-fixture')
                if sql == t.INVENTORY_SQL:
                    return Reply(value={'relations': t.TABLES})
                if sql == t.AUTH_SNAPSHOT_SQL:
                    return Reply(value={'row': 'full-auth-catalog-row', 'xmin': '1', 'ctid': '(1,1)'})
                if "'uid',auth.uid()" in sql:
                    return Reply(value={'uid': '00000000-0000-0000-0000-000000000001', 'role': 'service_role'})
                if sql.startswith('-- R3'):
                    events.append('r3')
                return Reply()
        fake_source = b'-- R3 OFFLINE MOCK: no SQL is executed'
        class MockRoot:
            def __truediv__(self, name):
                return self
            def read_bytes(self):
                return fake_source
        class MockControls(Controls):
            ROOT = MockRoot()
            @staticmethod
            def verify_transition(before, after, expected):
                events.append('verified-transition')
                if after['hashes'] != expected:
                    raise AssertionError('bad final hashes')
            @staticmethod
            @contextmanager
            def case_sessions(runner, name):
                try:
                    yield 'synthetic_mock_only', Session(7), Session(8)
                finally:
                    events.append('cleanup')
                    if cleanup_failure:
                        raise RuntimeError('mock cleanup failure')
        runner = Runner()
        with patch.object(t.re, 'search') as search, patch.object(t, 'observe_holder', return_value={'held': True}), patch.object(t.json, 'loads', return_value='historical'), patch.object(t, 'R3_SHA256', hashlib.sha256(fake_source).hexdigest()):
            search.return_value.group.return_value = 'unused mocked historical hashes'
            if cleanup_failure:
                with self.assertRaisesRegex(RuntimeError, 'cleanup failure'):
                    t.run_terminal_calls(runner, MockControls)
            else:
                t.run_terminal_calls(runner, MockControls)
        return runner, events

    def test_no_call_until_r3_verified_and_auth_fixture_ready(self):
        runner, events = self.protocol()
        first_call = next(i for i, e in enumerate(events) if e.startswith('call:'))
        self.assertLess(events.index('r3'), events.index('verified-transition'))
        self.assertLess(events.index('verified-transition'), events.index('auth-fixture'))
        self.assertLess(events.index('auth-fixture'), first_call)
        self.assertEqual(sum(e.startswith('call:') for e in events), 5)
        self.assertLess(events.index('cleanup'), events.index('check'))
        self.assertEqual(runner.result['terminal_direct_calls'], 'PASS')
        self.assertEqual(runner.details['historical_seed_invocations'], 0)

    def test_cleanup_failure_cannot_claim_pass(self):
        runner, events = self.protocol(cleanup_failure=True)
        self.assertNotEqual(runner.result['terminal_direct_calls'], 'PASS')
        self.assertNotIn('check', events)


if __name__ == '__main__':
    unittest.main()
