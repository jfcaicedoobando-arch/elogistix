"""Offline harness tests only. These never execute PostgreSQL, Docker or Git."""
import ast
from copy import deepcopy
from contextlib import contextmanager
import hashlib
import inspect
import json
from pathlib import Path
from subprocess import CompletedProcess
import unittest
from unittest.mock import Mock, patch

import concurrency_cases as c

ROOT = Path(__file__).resolve().parent


def response(value, code=0):
    return CompletedProcess([], code, json.dumps(value) + '\n', '')


def error(message='CRM_ACL_CONCURRENT_METADATA_DRIFT', state='P0001'):
    return CompletedProcess([], 3, f'ERROR:  {state}: {message}\n', '')


def state(wait=False, granted=False, objid=c.GATE_KEY):
    return dict(pid=11, state='active' if wait else 'idle in transaction',
                wait_event_type='Lock' if wait else 'Client',
                wait_event='advisory' if wait else 'ClientRead', blockers=[12] if wait else [],
                locks=[dict(locktype='advisory', granted=granted, classid=c.GATE_CLASS, objid=objid)])


@contextmanager
def fake_database(r, label):
    yield 'crm_acl_fixture_mock'


class ConcurrencyOffline(unittest.TestCase):
    def test_response_requires_exactly_one_json_value(self):
        self.assertEqual(c.response_json(CompletedProcess([], 0, 'NOTICE: setup\n{"ok":true}\n', '')), {'ok': True})
        for text in ('not json', 'true\nfalse\n'):
            with self.assertRaises(AssertionError):
                c.response_json(CompletedProcess([], 0, text, ''))

    def test_cooperative_keys_follow_fixture_bound_candidate(self):
        self.assertEqual(c.cooperative_lock_keys('SELECT pg_catalog.pg_try_advisory_xact_lock(817401, 817402);'), (817401, 817402))
        for bad in ('SELECT 1;', 'pg_try_advisory_xact_lock(1,2); pg_try_advisory_xact_lock(3,4);',
                    'pg_try_advisory_xact_lock(2147483648,2);'):
            with self.assertRaises(AssertionError):
                c.cooperative_lock_keys(bad)

    def test_sqlstate_and_expected_failure_fail_closed(self):
        self.assertEqual(c.rejected(error(), 'probe'), 'P0001')
        self.assertEqual(c.sqlstate(error('connection lost', '57P01')), '57P01')
        self.assertEqual(c.sqlstate(CompletedProcess([], 2, 'FATAL:  57P01: terminated', '')), '57P01')
        for result in (response(True), CompletedProcess([], 3, 'generic error', '')):
            with self.assertRaises(AssertionError):
                c.rejected(result, 'probe')
        with self.assertRaises(AssertionError):
            c.rejected(error(), 'probe', state='55P03')
        with self.assertRaises(AssertionError):
            c.rejected(error(), 'probe', marker='different marker')

    def test_normalization_changes_only_database_oid(self):
        original = {'pg_shdepend': [{'dbid': 123, 'objid': 4, 'deptype': 'a'}],
                    'pg_proc': [{'oid': 4, 'procost': 100}]}
        result = c.normalized_snapshot(original)
        self.assertEqual(result['pg_shdepend'][0]['dbid'], '<fixture-database>')
        self.assertEqual(original['pg_shdepend'][0]['dbid'], 123)
        self.assertEqual(result['pg_proc'], original['pg_proc'])
        self.assertEqual(result['pg_shdepend'][0]['objid'], 4)

    def test_clone_sanitization_and_lifecycle(self):
        r = Mock()
        r.clone.return_value = 'crm_acl_fixture_case_label'
        with c.case_database(r, 'case-label') as db:
            self.assertEqual(db, 'crm_acl_fixture_case_label')
        r.clone.assert_called_once_with('case_label')
        self.assertIn('DROP DATABASE "crm_acl_fixture_case_label"', r.query.call_args.args[0])
        r.reset_mock()
        with self.assertRaisesRegex(RuntimeError, 'preserve evidence'):
            with c.case_database(r, 'case-label'):
                raise RuntimeError('preserve evidence')
        r.query.assert_not_called()
        r.clone.return_value = 'production'
        with self.assertRaisesRegex(AssertionError, 'non-fixture'):
            with c.case_database(r, 'case-label'):
                pass
        r.query.assert_not_called()

    def test_long_clone_identifiers_are_bounded_and_distinct(self):
        r = Mock()
        r.clone.side_effect = lambda suffix: 'crm_acl_fixture_' + suffix
        names = []
        for label in ('f2-pre-snapshot-grant-option-1-normalized-reference', 'x' * 100, 'x' * 99 + 'y'):
            with c.case_database(r, label) as name:
                self.assertLessEqual(len(name), 63)
                names.append(name)
        self.assertEqual(len(set(names)), 3)

    def test_gate_install_is_admin_only_and_scoped(self):
        r = Mock()
        c.install_barrier(r, 'db', 'migration', 2, 'probe')
        sql = r.query.call_args.args[0]
        self.assertEqual(r.query.call_args.kwargs['user'], 'supabase_admin')
        self.assertIn("current_setting('application_name') <> 'migration'", sql)
        self.assertIn('IF n = 2 THEN', sql)
        self.assertIn("WHEN TAG IN ('REVOKE')", sql)
        self.assertIn("set_config('lock_timeout',saved_timeout,true)", sql)
        c.remove_barrier(r, 'db', 'probe')
        self.assertEqual(r.query.call_args.kwargs['user'], 'supabase_admin')
        for invalid in (0, 3):
            with self.assertRaises(AssertionError):
                c.barrier_sql('migration', invalid)

    def test_candidate_and_competitor_roles_are_separate(self):
        r = Mock(candidate='BEGIN; SELECT 1; COMMIT;')
        c.begin_session(r, 'db', 'owner-change', 'ALTER FUNCTION x() OWNER TO y;', user='supabase_admin')
        self.assertEqual(r.session.call_args.kwargs['user'], 'supabase_admin')
        c.begin_session(r, 'db', 'ordinary', 'SELECT 1;')
        self.assertEqual(r.session.call_args.kwargs['user'], 'postgres')
        c.start_candidate(r, 'db', 'migration')
        self.assertNotIn('user', r.session.call_args.kwargs)
        self.assertTrue(r.session.call_args.args[0].endswith(r.candidate))

    def test_wait_requires_actual_activity_and_lock(self):
        r = Mock()
        r.query.side_effect = [response(None), response(state())]
        got = c.wait_state(r, 'db', 'app', 'label')
        self.assertEqual(got['state'], 'idle in transaction')
        self.assertEqual(r.query.call_count, 2)
        self.assertEqual(r.query.call_args.kwargs['user'], 'supabase_admin')
        r.query.side_effect = [response(state(wait=True))]
        got = c.wait_state(r, 'db', 'app', 'label', allow_wait=True)
        self.assertEqual(got['wait_event_type'], 'Lock')
        r.query.side_effect = [response(state(wait=True, granted=True))]
        with self.assertRaisesRegex(AssertionError, 'ungranted'):
            c.wait_state(r, 'db', 'app', 'label', allow_wait=True)

    def test_barrier_checks_the_exact_advisory_key(self):
        r = Mock()
        r.wait_lock.return_value = ['persisted lock trace']
        r.query.return_value = response(state(wait=True))
        self.assertEqual(c.assert_barrier(r, 'db', 'app'), ['persisted lock trace'])
        r.query.return_value = response(state(wait=True, objid=999))
        with self.assertRaisesRegex(AssertionError, 'intended barrier'):
            c.assert_barrier(r, 'db', 'app')

    def test_owner_only_requires_two_rows_and_true(self):
        r = Mock()
        r.query.return_value = response(True)
        c.assert_owner_only(r, 'db', 'owner')
        self.assertIn('count(*) = 2', r.query.call_args.args[0])
        for val in (False, None):
            r.query.return_value = response(val)
            with self.assertRaises(AssertionError):
                c.assert_owner_only(r, 'db', 'owner')

    def test_mutations_preserve_definition_for_body(self):
        body = c.mutation('body', c.FUNCTIONS[0])
        self.assertIn('pg_get_functiondef', body)
        self.assertIn("'BEGIN'||chr(10)", body)
        self.assertNotIn('\\n', body)
        for kind in ('body', 'cost', 'acl', 'owner', 'grant', 'revoke', 'drop'):
            self.assertIn(c.FUNCTIONS[1], c.mutation(kind, c.FUNCTIONS[1]))
        with self.assertRaises(ValueError):
            c.mutation('unknown', c.FUNCTIONS[0])

    def test_instrumentation_does_not_mutate_frozen_candidate(self):
        path = ROOT / 'inputs' / 'proposed-owner-only.sql'
        before = path.read_bytes()
        candidate = before.decode()
        probe = c.injected_pre_snapshot_gate(candidate)
        self.assertEqual(path.read_bytes(), before)
        self.assertEqual(hashlib.sha256(before).hexdigest(),
                         hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertNotEqual(probe, candidate)
        self.assertLess(probe.index('CI INSTRUMENTATION ONLY'), probe.index('INTO before_rows'))
        self.assertGreater(probe.index('CI INSTRUMENTATION ONLY'), probe.index('  END LOOP;'))
        # Removing only the explicitly inserted barrier exactly recovers input.
        begin = probe.index('  -- CI INSTRUMENTATION ONLY')
        end = probe.index("  PERFORM set_config('lock_timeout','3s',true);\n", begin)
        end += len("  PERFORM set_config('lock_timeout','3s',true);\n")
        self.assertEqual(probe[:begin] + probe[end:], candidate)
        self.assertEqual(c.without_commit(candidate).rstrip() + '\nCOMMIT;\n', candidate)
        with self.assertRaises(AssertionError):
            c.without_commit('SELECT 1;')
        with self.assertRaises(AssertionError):
            c.injected_pre_snapshot_gate('SELECT 1;')

    def test_event_mutation_filters_application_and_revoke_number(self):
        sql = c.mutation_event_sql('my-app', 2, "RAISE EXCEPTION 'sentinel';")
        self.assertIn("<> 'my-app'", sql)
        self.assertIn('IF n = 2 THEN', sql)
        self.assertIn("RAISE EXCEPTION 'sentinel'", sql)
        self.assertNotIn('pg_sleep', sql)

    def test_no_sleep_or_direct_database_execution_in_module(self):
        tree = ast.parse(inspect.getsource(c))
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)]
        for call in calls:
            if isinstance(call.func, ast.Attribute):
                self.assertNotEqual(call.func.attr, 'sleep')
                self.assertNotIn(call.func.attr, ('Popen', 'connect'))
        source = inspect.getsource(c)
        self.assertNotIn('UPDATE pg_catalog.pg_proc', source)
        self.assertNotIn('LOCK TABLE pg_catalog.pg_proc', source)

    def test_case11_covers_all_mutations_and_only_visited_helpers(self):
        r = Mock(candidate='candidate')
        r.snapshot.return_value = {'pg_shdepend': []}
        with patch.multiple(c, case_database=fake_database,
                            expected_snapshot=Mock(return_value={'pg_shdepend': []}),
                            gate_holder=Mock(), install_barrier=Mock(),
                            start_candidate=Mock(), assert_barrier=Mock(),
                            finish_transaction=Mock(), wait_state=Mock(),
                            assert_owner_only=Mock(), remove_barrier=Mock()):
            c.case11(r)
        names = [call.args[0] for call in r.check.call_args_list]
        self.assertEqual(len(names), 22)
        for kind in ('cost', 'body', 'owner', 'grant', 'revoke', 'drop'):
            self.assertIn('c11-revoke-1-function-1-' + kind, names)
            self.assertIn('c11-revoke-2-function-1-' + kind, names)
            self.assertIn('c11-revoke-2-function-2-' + kind, names)
            self.assertNotIn('c11-revoke-1-function-2-' + kind, names)
        replay_cases = [call for call in r.check.call_args_list if call.kwargs['replay_owner_only']]
        self.assertEqual(len(replay_cases), 4)
        for point, function in ((1, 1), (2, 2)):
            for kind in ('cost', 'grant'):
                self.assertIn(f'c11-replay-revoke-{point}-function-{function}-{kind}', names)
        owners = [call for call in r.session.call_args_list if 'OWNER TO' in call.args[0]]
        self.assertEqual(len(owners), 3)
        self.assertTrue(all(call.kwargs['user'] == 'supabase_admin' for call in owners))

    def test_case10_requires_rollback_for_both_functions(self):
        r = Mock(candidate='candidate')
        r.snapshot.return_value = {'pg_shdepend': []}
        r.finish_session.return_value = error()
        with patch.multiple(c, case_database=fake_database,
                            expected_snapshot=Mock(return_value={'pg_shdepend': []}),
                            start_candidate=Mock(), finish_transaction=Mock(), wait_state=Mock()):
            c.case10(r)
        names = [call.args[0] for call in r.check.call_args_list]
        self.assertEqual(len(names), 6)
        self.assertEqual(sum(call.kwargs['first_revoke_rollback'] for call in r.check.call_args_list), 3)
        self.assertEqual(r.wait_lock.call_count, 6)

    def test_case9_rejects_unrelated_full_snapshot_corruption(self):
        r = Mock(candidate='SELECT pg_try_advisory_xact_lock(817401,817402);')
        base = {'pg_proc': [], 'pg_shdepend': [], 'unrelated': 'original'}
        corrupt = dict(base, unrelated='CORRUPTED')
        r.snapshot.side_effect = [base, base, base, base, base, corrupt]
        r.query.side_effect = [error('CRM_ACL_BUSY'), error('busy', '55P03'), response(True)]
        proof = {'locks': [{'mode': 'RowExclusiveLock', 'granted': True}]}
        with patch.multiple(c, case_database=fake_database, begin_session=Mock(),
                            wait_state=Mock(return_value=proof), finish_transaction=Mock(),
                            assert_owner_only=Mock()):
            with self.assertRaisesRegex(AssertionError, 'unexpected full-catalog'):
                c.case9(r)
        self.assertNotIn('c09-rowexclusive-compatible', [call.args[0] for call in r.check.call_args_list])

    def test_case12_serialized_rejects_unrelated_snapshot_corruption(self):
        r = Mock(candidate='candidate')
        stable = {'stable': 1}
        base = {'pg_proc': [], 'pg_shdepend': [], 'unrelated': 'original'}
        corrupt = dict(base, unrelated='CORRUPTED')
        r.snapshot.side_effect = [stable, stable, base, base, corrupt]
        r.query.return_value = response({'trigger': 2620, 'relation': 1259})
        with patch.multiple(c, case_database=fake_database,
                            expected_snapshot=Mock(return_value=stable), gate_holder=Mock(),
                            install_barrier=Mock(), start_candidate=Mock(), assert_barrier=Mock(),
                            begin_session=Mock(), finish_transaction=Mock(),
                            wait_state=Mock(return_value={'wait_event_type': 'Lock'}),
                            assert_owner_only=Mock(), remove_barrier=Mock()):
            with self.assertRaisesRegex(AssertionError, 'migration changed unexpected full-catalog'):
                c.case12(r)
        self.assertNotIn('c12-extra-trigger-different-table', [call.args[0] for call in r.check.call_args_list])

    def test_case12_rejection_requires_complete_rollback_snapshot(self):
        r = Mock(candidate='candidate')
        stable = {'stable': 1}
        base = {'pg_proc': [], 'pg_shdepend': [], 'unrelated': 'original'}
        external = dict(base, trigger_added=True)
        corrupt = dict(external, unrelated='CORRUPTED')
        r.snapshot.side_effect = [stable, stable, base, base, external, corrupt]
        r.query.return_value = response({'trigger': 2620, 'relation': 1259})
        r.finish_session.side_effect = [response(True), error()]
        with patch.multiple(c, case_database=fake_database,
                            expected_snapshot=Mock(return_value=stable), gate_holder=Mock(),
                            install_barrier=Mock(), start_candidate=Mock(), assert_barrier=Mock(),
                            begin_session=Mock(), finish_transaction=Mock(),
                            wait_state=Mock(return_value={'wait_event_type': 'Client'}),
                            assert_owner_only=Mock(), remove_barrier=Mock()):
            with self.assertRaisesRegex(AssertionError, 'full-catalog rollback'):
                c.case12(r)
        self.assertNotIn('c12-extra-trigger-different-table', [call.args[0] for call in r.check.call_args_list])

    def test_external_trigger_delta_is_an_exact_allowlist(self):
        before = {
            'pg_class': [{'oid': '9', 'relname': 'crm_empresas', 'relhastriggers': True},
                         {'oid': '100', 'relname': 'crm_acl_ci_other', 'relhastriggers': False}],
            'pg_trigger': [{'oid': '8', 'tgname': 'trg_crm_empresa_no_delete_fisico',
                            'tgrelid': '9', 'tgfoid': '7', 'tgtype': 11, 'tgenabled': 'O'}],
            'pg_depend': [
                {'classid': '2620', 'objid': '8', 'objsubid': 0, 'refclassid': '1255',
                 'refobjid': '7', 'refobjsubid': 0, 'deptype': 'n'},
                {'classid': '2620', 'objid': '8', 'objsubid': 0, 'refclassid': '1259',
                 'refobjid': '9', 'refobjsubid': 0, 'deptype': 'a'}],
            'unrelated': {'sentinel': True},
        }
        after = deepcopy(before)
        after['pg_trigger'].append(dict(before['pg_trigger'][0], oid='101',
            tgname='crm_acl_ci_extra', tgrelid='100'))
        after['pg_class'][1]['relhastriggers'] = True
        for dependency in before['pg_depend']:
            changed = dict(dependency, objid='101')
            if changed['refclassid'] == '1259':
                changed['refobjid'] = '100'
            after['pg_depend'].append(changed)
        c.assert_extra_trigger_delta(before, after, 2620, 1259)
        variants = []
        wrong = deepcopy(after); wrong['unrelated']['sentinel'] = False; variants.append(wrong)
        wrong = deepcopy(after); wrong['pg_trigger'][-1]['tgenabled'] = 'D'; variants.append(wrong)
        wrong = deepcopy(after); wrong['pg_depend'][-1]['deptype'] = 'n'; variants.append(wrong)
        wrong = deepcopy(after); wrong['pg_depend'].append(dict(wrong['pg_depend'][-1], refobjid='999')); variants.append(wrong)
        wrong = deepcopy(after); wrong['pg_class'][0]['relhastriggers'] = False; variants.append(wrong)
        for wrong in variants:
            with self.subTest(wrong=wrong):
                with self.assertRaises(AssertionError):
                    c.assert_extra_trigger_delta(before, wrong, 2620, 1259)

    def test_run_dispatches_all_required_cases_and_characterization(self):
        order = []
        names = ('case9', 'case10', 'case11', 'case12', 'case13', 'case14',
                 'pre_snapshot_regressions', 'characterize_acl_normalization')
        patches = {name: Mock(side_effect=lambda r, n=name: order.append(n)) for name in names}
        with patch.multiple(c, **patches):
            c.run(Mock())
        self.assertEqual(order, list(names))

    def test_f2_normalization_is_never_reported_as_rejection_pass(self):
        r = Mock(candidate='candidate')
        r.snapshot.return_value = {'pg_shdepend': []}
        r.finish_session.return_value = response(True)
        with patch.multiple(c, case_database=fake_database,
                            injected_pre_snapshot_gate=Mock(return_value='instrumented'),
                            expected_snapshot=Mock(return_value={'pg_shdepend': []}),
                            gate_holder=Mock(), start_candidate=Mock(), assert_barrier=Mock(),
                            finish_transaction=Mock(), assert_owner_only=Mock()):
            c.characterize_acl_normalization(r)
        self.assertEqual(r.check.call_count, 2)
        for call in r.check.call_args_list:
            self.assertEqual(call.kwargs['status'], 'observed_limit')
            self.assertFalse(call.kwargs['strict_concurrent_acl_rejection'])
            self.assertFalse(call.kwargs['exact_candidate_bytes'])
            self.assertTrue(call.kwargs['final_acl_owner_only'])


if __name__ == '__main__':
    unittest.main()
