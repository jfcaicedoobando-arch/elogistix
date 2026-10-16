"""Offline parser, synchronization and lifecycle tests. No SQL or Docker executed."""
import copy
import hashlib
import io
import json
from pathlib import Path
import queue
import tempfile
import unittest
from unittest.mock import patch

import concurrency_cases as cc


class ParserTests(unittest.TestCase):
    def test_exact_primary_sqlstate(self):
        text = 'ERROR:  XX000: tuple concurrently updated\nCONTEXT:  P0001: irrelevant\n'
        self.assertEqual(cc.primary_errors(text), [('XX000', 'tuple concurrently updated')])

    def test_context_cannot_supply_primary_error(self):
        self.assertEqual(cc.primary_errors('CONTEXT: ERROR: P0001: R2_LOCK_DRIFT\n'), [])
        self.assertEqual(cc.primary_errors('NOTICE: ERROR: XX000: tuple concurrently updated\n'), [])

    def test_filename_error_prefix(self):
        self.assertEqual(cc.primary_errors('psql:/tmp/input.sql:77: ERROR:  55P03: canceling statement due to lock timeout\n'), [('55P03', 'canceling statement due to lock timeout')])

    def test_marker_exact_not_substring(self):
        self.assertEqual(cc.parse_marker('R3_MARK_abc 00000\n', 'R3_MARK_abc'), '00000')
        for text in ('NOTICE: R3_MARK_abc 00000\n', 'R3_MARK_abc 00000 trailing\n', 'R3_MARK_other 00000\n', 'R3_MARK_abc :SQLSTATE\n'):
            self.assertIsNone(cc.parse_marker(text, 'R3_MARK_abc'))

    def test_reply_rejects_error_even_with_success_marker(self):
        with self.assertRaises(AssertionError):
            cc.Reply('00000', 'ERROR:  P0001: failed earlier statement\n').ok()

    def test_reply_requires_one_json_object(self):
        self.assertEqual(cc.Reply('00000', '\n{"pid":7}\n').json(), {'pid': 7})
        with self.assertRaises(AssertionError):
            cc.Reply('00000', '{"pid":7}\n{"pid":8}\n').json()


class LockObservationTests(unittest.TestCase):
    def setUp(self):
        self.waiting = {'pid': 7, 'backend_start': 'wait-start'}
        self.holder = {'pid': 8, 'backend_start': 'holder-start'}
        self.record = {'pid': 7, 'backend_start': 'wait-start', 'holder_start': 'holder-start', 'wait_event_type': 'Lock', 'blockers': [8]}

    def test_exact_identity_and_blocker_required(self):
        self.assertTrue(cc.blocking_record(self.record, self.waiting, self.holder))
        for key, value in [('pid', 9), ('backend_start', 'reused-pid'), ('holder_start', 'reused-holder'), ('wait_event_type', 'IO'), ('blockers', [9])]:
            modified = {**self.record, key: value}
            self.assertFalse(cc.blocking_record(modified, self.waiting, self.holder))

    def test_observed_edge_succeeds(self):
        record = self.record
        class Observer:
            def execute(self, sql):
                self.sql = sql
                return cc.Reply('00000', json.dumps(record))
        observer = Observer()
        self.assertEqual(cc.observe_block(observer, self.waiting, self.holder), [record])
        self.assertIn('pg_stat_clear_snapshot()', observer.sql)
        self.assertIn('pg_blocking_pids(a.pid)', observer.sql)

    def test_no_observation_is_failure_not_pass(self):
        with patch.object(cc.time, 'monotonic', side_effect=[0.0, 3.0]):
            with self.assertRaisesRegex(AssertionError, 'not observed'):
                cc.observe_block(None, self.waiting, self.holder, timeout=2.5)


class SessionControlTests(unittest.TestCase):
    def session(self):
        session = object.__new__(cc.Session)
        session.label = 'offline'
        session.pending = 'R3_MARK_fixed'
        session.lines = queue.Queue()
        session.transcript = []
        return session

    def test_marker_collects_error_and_state(self):
        session = self.session()
        session.lines.put('ERROR:  XX000: tuple concurrently updated\n')
        session.lines.put('R3_MARK_fixed XX000\n')
        reply = session.finish(timeout=0.1)
        self.assertEqual(reply.state, 'XX000')
        self.assertIsNone(session.pending)
        self.assertEqual(cc.primary_errors(reply.text), [('XX000', 'tuple concurrently updated')])

    def test_eof_fails(self):
        session = self.session()
        session.lines.put(None)
        with self.assertRaisesRegex(AssertionError, 'before marker'):
            session.finish(timeout=0.1)

    def test_missing_marker_fails_finitely(self):
        session = self.session()
        with self.assertRaisesRegex(AssertionError, 'Marker not observed'):
            session.finish(timeout=0.001)

    def test_pending_operation_cannot_be_overwritten(self):
        session = self.session()
        session.closed = False
        with self.assertRaisesRegex(AssertionError, 'pending'):
            session.start('SELECT 1;')

    def test_sql_is_wrapped_only_outside_bytes(self):
        session = self.session()
        session.pending = None
        session.closed = False
        class Process:
            stdin = io.StringIO()
        session.proc = Process()
        source = (cc.ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_bytes()
        session.start(source.decode())
        written = session.proc.stdin.getvalue().encode()
        self.assertTrue(written.startswith(source))
        self.assertEqual(hashlib.sha256(written[:len(source)]).hexdigest(), cc.R3_SHA256)

    def test_missing_adapter_cannot_claim_execution(self):
        class Runner:
            result = {'concurrency_two_sessions': 'NOT_RUN'}
        runner = Runner()
        with self.assertRaisesRegex(AssertionError, 'not integrated'):
            cc.run_concurrency(runner)
        self.assertEqual(runner.result['concurrency_two_sessions'], 'NOT_RUN')


class CaseCleanupTests(unittest.TestCase):
    def test_two_sessions_close_before_database_drop_even_when_case_fails(self):
        events = []
        class FakeSession:
            def __init__(self, runner, db, label):
                self.label = label
                self.identity = {'version': '170006', 'user': 'postgres', 'session_user': 'postgres', 'superuser': False, 'admin_member': False, 'pid': 7 if label.endswith('-a') else 8, 'backend_start': label}
                events.append(('open', label))
            def close(self):
                events.append(('close', self.label))
        class Runner:
            def query(self, sql, label, **kwargs):
                events.append(('query', sql))
                return type('Result', (), {'stdout': '0'})()
        with patch.object(cc, 'Session', FakeSession):
            with self.assertRaisesRegex(RuntimeError, 'case failed'):
                with cc.case_sessions(Runner(), 'offline'):
                    raise RuntimeError('case failed')
        drop = next(i for i, e in enumerate(events) if e[0] == 'query' and e[1].startswith('DROP DATABASE'))
        closes = [i for i, e in enumerate(events) if e[0] == 'close']
        self.assertEqual(len(closes), 2)
        self.assertTrue(all(i < drop for i in closes))
        self.assertTrue(any('pg_terminate_backend' in e[1] for e in events if e[0] == 'query'))

    def test_untrusted_case_identifier_rejected(self):
        with self.assertRaisesRegex(AssertionError, 'Unsafe case name'):
            with cc.case_sessions(None, 'x; DROP DATABASE postgres'):
                pass

    def test_snapshot_transition_detects_acl_or_oid_change(self):
        row = {'oid': 1, 'proname': 'seed_demo_organization_core', 'prosrc': 'old', 'proconfig': ['search_path=public'], 'proacl': ['preserve']}
        before = {'functions': [{'row': row, 'xmin': '1', 'ctid': '(1,1)'}], 'ledger': []}
        newrow = {**row, 'prosrc': 'stopped'}
        after = {'functions': [{'row': newrow, 'xmin': '2', 'ctid': '(1,2)'}], 'ledger': []}
        expected = {'seed_demo_organization_core()': hashlib.sha256(b'stopped').hexdigest()}
        cc.verify_transition(before, after, expected)
        newrow['proacl'] = []
        with self.assertRaisesRegex(AssertionError, 'Metadata/ACL drift'):
            cc.verify_transition(before, after, expected)


class ReviewRegressionTests(unittest.TestCase):
    def identity(self, pid=7):
        return {'version': '170006', 'user': 'postgres', 'session_user': 'postgres', 'superuser': False, 'admin_member': False, 'pid': pid, 'backend_start': 'start-' + str(pid)}

    def test_severe_unparseable_diagnostics_fail_closed(self):
        for line in ('ERROR: syntax error', 'FATAL:  57P01: terminating', 'PANIC:  XX000: panic', 'psql:/tmp/x.sql:4: ERROR: syntax error'):
            with self.subTest(line=line), self.assertRaises(AssertionError):
                cc.Reply('00000', line).ok()
        with self.assertRaises(AssertionError):
            cc.primary_errors('ERROR:  P0001: expected\nFATAL: connection gone')

    def test_oid_strings_sort_numerically(self):
        snapshot = {'functions': [{'row': {'oid': '100', 'proname': 'seed_demo_organization_core'}}, {'row': {'oid': '99', 'proname': 'seed_demo_organization'}}]}
        self.assertEqual(cc.first_target(snapshot)['oid'], '99')

    def test_pair_requires_distinct_pids(self):
        cc.validate_pair(self.identity(7), self.identity(8))
        with self.assertRaisesRegex(AssertionError, 'distinct'):
            cc.validate_pair(self.identity(7), self.identity(7))

    def test_session_user_cannot_be_admin_after_set_role(self):
        identity = self.identity()
        identity['session_user'] = 'supabase_admin'
        with self.assertRaisesRegex(AssertionError, 'privilege'):
            cc.validate_identity(identity)

    def test_close_failure_does_not_skip_any_cleanup(self):
        events = []
        class Session:
            def __init__(self, name):
                self.name = name
            def close(self):
                events.append(self.name)
                raise OSError('close failed: ' + self.name)
        class Runner:
            def query(self, sql, label, **kwargs):
                events.append(label)
                return type('Result', (), {'stdout': '0'})()
        with self.assertRaises(ExceptionGroup) as failure:
            cc.cleanup_case(Runner(), 'qa_r3_cc_mock', 'mock', [Session('a'), Session('b')])
        self.assertEqual(len(failure.exception.exceptions), 2)
        self.assertEqual(events, ['b', 'a', 'cc-terminate-mock', 'cc-no-backends-mock', 'cc-drop-mock'])

    def test_termination_failure_still_checks_backend_absence(self):
        events = []
        class Runner:
            def query(self, sql, label, **kwargs):
                events.append(label)
                if label.startswith('cc-terminate'):
                    raise OSError('termination transport failure')
                return type('Result', (), {'stdout': '0'})()
        with self.assertRaises(ExceptionGroup):
            cc.cleanup_case(Runner(), 'qa_r3_cc_mock', 'mock', [])
        self.assertEqual(events, ['cc-terminate-mock', 'cc-no-backends-mock', 'cc-drop-mock'])

    def test_unknown_backend_state_never_drops_database(self):
        events = []
        class Runner:
            def query(self, sql, label, **kwargs):
                events.append(label)
                if label.startswith('cc-no-backends'):
                    raise OSError('verification failed')
                return type('Result', (), {'stdout': '0'})()
        with self.assertRaises(ExceptionGroup):
            cc.cleanup_case(Runner(), 'qa_r3_cc_mock', 'mock', [])
        self.assertFalse(any(label.startswith('cc-drop') for label in events))

    def test_queued_drop_full_postimage_comparison(self):
        cleanup = {'row': {'oid': '90', 'proname': '_seed_demo_limpiar_financiero', 'proacl': ['a'], 'proconfig': ['p']}, 'xmin': '1', 'ctid': '(1,1)'}
        other = {'row': {'oid': '91', 'proname': 'seed_demo_organization_core', 'proacl': ['a'], 'proconfig': ['p']}, 'xmin': '2', 'ctid': '(1,2)'}
        dep = {'classid': '1255', 'objid': '90', 'refclassid': '2615', 'refobjid': '2200'}
        unrelated_dep = {**dep, 'objid': '91'}
        postimage = {'functions': [cleanup, other], 'dependencies': [dep, unrelated_dep], 'ledger': [], 'events': []}
        partial = {'functions': [copy.deepcopy(other)], 'dependencies': [unrelated_dep], 'ledger': [], 'events': []}
        cc.verify_drop(postimage, partial, '90', '1255')
        for key, value in [('oid', '92'), ('proacl', ['changed']), ('proconfig', ['changed'])]:
            bad = copy.deepcopy(partial)
            bad['functions'][0]['row'][key] = value
            with self.subTest(key=key), self.assertRaisesRegex(AssertionError, 'DROP changed'):
                cc.verify_drop(postimage, bad, '90', '1255')
        for section, value in [('dependencies', []), ('ledger', [{'version': 'unexpected'}]), ('events', [{}])]:
            bad = {**partial, section: value}
            with self.subTest(section=section), self.assertRaisesRegex(AssertionError, 'DROP changed'):
                cc.verify_drop(postimage, bad, '90', '1255')


if __name__ == '__main__':
    unittest.main()
