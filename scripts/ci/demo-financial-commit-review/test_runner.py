"""Offline runner refusal regressions using SYNTHETIC catalog/response metadata.

No Docker, SQL, database, network or subprocess is run by these tests. Catalog
fixtures exercise acceptance gates, not PostgreSQL behavior or external authority.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('financial_commit_runner_test_sut', HERE / 'run_ci.py')
r = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = r
SPEC.loader.exec_module(r)


def guards(definer=False, string_oids=False):
    """Explicit SYNTHETIC pg_proc/trigger evidence; never a real catalog capture."""
    oid = str if string_oids else int
    functions = {}
    for index, (name, digest) in enumerate(r.GUARD_HASHES.items(), 1):
        functions[name] = {'owner': 'postgres', 'language': 'plpgsql', 'return_type': 'trigger',
                           'body_sha256': digest, 'non_owner_execute': [],
                           'app_execute': {role: False for role in ('anon', 'authenticated', 'service_role')},
                           'metadata': {'oid': oid(1000 + index), 'proname': name, 'proowner': oid(10),
                                        'pronamespace': oid(2000), 'pronargs': 0,
                                        'proconfig': ['search_path=pg_catalog'],
                                        'prosecdef': definer if name == 'authorize_issuance_deferred' else True,
                                        'proacl': ['postgres=X/postgres'], 'procost': 100,
                                        'proparallel': 'u', 'provolatile': 'v'}}
    triggers = {}
    for index, (name, (table, fn)) in enumerate(r.TRIGGERS.items(), 1):
        table_oid, constraint_oid = oid(3000 + index), oid(4000 + index)
        triggers[name] = {'table_oid': table_oid, 'table_name': table, 'function_name': fn,
                          'metadata': {'oid': oid(5000 + index), 'tgname': name, 'tgrelid': table_oid,
                                       'tgfoid': functions[fn]['metadata']['oid'], 'tgtype': 5, 'tgenabled': 'O',
                                       'tgdeferrable': True, 'tginitdeferred': True, 'tgisinternal': False,
                                       'tgconstraint': constraint_oid, 'tgargs': '\\x', 'tgqual': None},
                          'constraint': {'oid': constraint_oid, 'contype': 't', 'conrelid': table_oid,
                                         'condeferrable': True, 'condeferred': True, 'convalidated': True}}
    return {'session_replication_role': 'origin', 'functions': functions, 'triggers': triggers}


def response(lines):
    return SimpleNamespace(stdout=('\n'.join(lines) + '\n').encode(), stderr=b'', returncode=0)


def observed(retried=False, pid=103):
    return {'scope': 'SYNTHETIC_COMMITTED_ROWS_ONLY', 'backend_pid': pid, 'events': 13, 'receipts': 13,
            'current_approvals': 3, 'simulated_payments': 1, 'retry_checked': retried,
            'snapshot_sha256': 'a' * 64, 'foreign_snapshot_sha256': 'b' * 64, 'global_snapshot_sha256': 'c' * 64}


def observer_response(value):
    return response(['FINANCIAL_CONNECTION_EVIDENCE=' + json.dumps({'phase': 'observe', 'backend_pid': value['backend_pid']}),
                     'FINANCIAL_COMMIT_OBSERVATION=' + json.dumps(value), 'FINANCIAL_COMMIT_OBSERVED'])


class RunnerRefusalTests(unittest.TestCase):
    def event(self):
        repo = {'full_name': r.REPOSITORY, 'owner': {'login': 'jfcaicedoobando-arch'}}
        return {'action': 'synchronize', 'repository': copy.deepcopy(repo), 'pull_request': {'draft': True,
                'head': {'repo': copy.deepcopy(repo), 'ref': r.BRANCH, 'sha': 'a' * 40},
                'base': {'repo': copy.deepcopy(repo), 'ref': r.BASE_BRANCH, 'sha': r.EVENT_BASE}}}

    def env(self):
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': r.REPOSITORY}

    def test_import_loader_registers_modules_before_execution(self):
        self.assertIs(sys.modules[SPEC.name], r)
        loaded = r.module('financial_commit_loader_probe', HERE / 'run_ci.py')
        self.assertIs(sys.modules['financial_commit_loader_probe'], loaded)
        self.assertEqual(loaded.CASES, ('original_invoker', 'proposed_definer', 'proposed_revoked'))

    def test_exact_owned_draft_event_is_accepted(self):
        for action in ('opened', 'synchronize', 'reopened'):
            event = self.event(); event['action'] = action
            r.gate(event, self.env(), 'a' * 40)

    def test_local_run_stops_before_subprocess_or_dependency_import(self):
        with patch.dict(r.os.environ, {}, clear=True), patch.object(r.subprocess, 'run') as native, \
                patch.object(r.subprocess, 'check_output') as git, patch.object(r, 'module') as loader:
            with self.assertRaisesRegex(RuntimeError, 'Actions only'):
                r.run(None)
            native.assert_not_called(); git.assert_not_called(); loader.assert_not_called()

    def test_gate_rejects_fork_owner_main_and_unreviewed_base(self):
        mutations = [('head.repo.full_name', 'foreign/repository'), ('base.repo.full_name', 'foreign/repository'),
                     ('head.repo.owner.login', 'foreign'), ('base.repo.owner.login', 'foreign'),
                     ('head.ref', 'main'), ('head.ref', 'unreviewed'), ('base.ref', 'main'),
                     ('base.sha', 'b' * 40), ('draft', False)]
        for path, value in mutations:
            event = self.event(); item = event['pull_request']; parts = path.split('.')
            for key in parts[:-1]: item = item[key]
            item[parts[-1]] = value
            with self.subTest(path=path), self.assertRaises(RuntimeError):
                r.gate(event, self.env(), 'a' * 40)

    def test_gate_rejects_wrong_event_environment_and_head_identity(self):
        for key, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_EVENT_NAME', 'push'),
                           ('GITHUB_REPOSITORY', 'foreign/repo')]:
            env = self.env(); env[key] = value
            with self.subTest(env=key), self.assertRaises(RuntimeError): r.gate(self.event(), env, 'a' * 40)
        for head in ['a' * 39, 'A' * 40, 'z' * 40, 'b' * 40]:
            with self.subTest(head=head), self.assertRaises(RuntimeError): r.gate(self.event(), self.env(), head)
        for path, value in [('action', 'closed'), ('repository', {'full_name': 'foreign/repo'})]:
            event = self.event(); event[path] = value
            with self.subTest(event=path), self.assertRaises(RuntimeError): r.gate(event, self.env(), 'a' * 40)

    def test_guards_accept_native_integer_or_decimal_string_oids(self):
        for strings in (False, True):
            for definer in (False, True):
                value = guards(definer, strings)
                self.assertIs(r.validate_guards(value, definer), value)

    def test_guard_inventory_and_replication_bypass_fail_closed(self):
        for mutant in ['replication', 'function_missing', 'function_extra', 'trigger_missing', 'trigger_extra']:
            value = guards()
            if mutant == 'replication': value['session_replication_role'] = 'replica'
            elif mutant == 'function_missing': value['functions'].pop('authorize_deferred')
            elif mutant == 'function_extra': value['functions']['unreviewed'] = copy.deepcopy(value['functions']['authorize_deferred'])
            elif mutant == 'trigger_missing': value['triggers'].pop('demo_checkpoint_authorize_deferred')
            else: value['triggers']['unreviewed'] = copy.deepcopy(value['triggers']['demo_authorize_deferred'])
            with self.subTest(mutant=mutant), self.assertRaises(RuntimeError): r.validate_guards(value, False)

    def test_guard_owner_body_language_return_and_security_mode_mutants(self):
        for key, replacement in [('owner', 'other_owner'), ('body_sha256', 'f' * 64),
                                  ('language', 'sql'), ('return_type', 'void')]:
            value = guards(); value['functions']['authorize_issuance_deferred'][key] = replacement
            with self.subTest(field=key), self.assertRaises(RuntimeError): r.validate_guards(value, False)
        for fn, key, replacement in [('authorize_issuance_deferred', 'prosecdef', True),
                                     ('authorize_deferred', 'prosecdef', False),
                                     ('authorize_issuance_deferred', 'proconfig', ['search_path=public']),
                                     ('authorize_issuance_deferred', 'pronargs', 1),
                                     ('authorize_issuance_deferred', 'oid', True),
                                     ('authorize_issuance_deferred', 'oid', 'not-an-oid')]:
            value = guards(); value['functions'][fn]['metadata'][key] = replacement
            with self.subTest(field=(fn, key)), self.assertRaises(RuntimeError): r.validate_guards(value, False)

    def test_effective_public_or_application_execute_is_rejected(self):
        for mutation in ('public', 'app', 'app_missing'):
            value = guards(); f = value['functions']['authorize_issuance_deferred']
            if mutation == 'public': f['non_owner_execute'] = [{'grantee': 0, 'privilege_type': 'EXECUTE'}]
            elif mutation == 'app': f['app_execute']['service_role'] = True
            else: f['app_execute'].pop('authenticated')
            with self.subTest(mutation=mutation), self.assertRaises(RuntimeError): r.validate_guards(value, False)

    def test_trigger_and_constraint_binding_mutants_are_rejected(self):
        changes = [('metadata', 'tgname', 'different'), ('metadata', 'tgrelid', 999),
                   ('metadata', 'tgfoid', 999), ('metadata', 'tgtype', 17), ('metadata', 'tgenabled', 'D'),
                   ('metadata', 'tgdeferrable', False), ('metadata', 'tginitdeferred', False),
                   ('metadata', 'tgisinternal', True), ('metadata', 'tgconstraint', 999),
                   ('constraint', 'contype', 'f'), ('constraint', 'conrelid', 999),
                   ('constraint', 'condeferrable', False), ('constraint', 'condeferred', False)]
        for section, key, replacement in changes:
            value = guards(); value['triggers']['execution_authorized_deferred'][section][key] = replacement
            with self.subTest(field=(section, key)), self.assertRaises(RuntimeError): r.validate_guards(value, False)

    def test_descriptor_accepts_only_the_single_security_flag_change(self):
        before = guards(); after = copy.deepcopy(before)
        after['functions']['authorize_issuance_deferred']['metadata']['prosecdef'] = True
        r.descriptor_delta(before, after)
        self.assertFalse(before['functions']['authorize_issuance_deferred']['metadata']['prosecdef'])
        with self.assertRaises(RuntimeError): r.descriptor_delta(before, before)

    def test_descriptor_rejects_additional_raw_catalog_metadata_changes(self):
        for section, key, replacement in [('function', 'proacl', ['postgres=X/postgres', '=X/postgres']),
                                           ('function', 'procost', 1), ('function', 'proparallel', 's'),
                                           ('function', 'proowner', 42), ('trigger', 'tgargs', '\\x01'),
                                           ('constraint', 'convalidated', False)]:
            before = guards(); after = guards(True)
            if section == 'function': target = after['functions']['authorize_issuance_deferred']['metadata']
            elif section == 'trigger': target = after['triggers']['execution_authorized_deferred']['metadata']
            else: target = after['triggers']['execution_authorized_deferred']['constraint']
            target[key] = replacement
            with self.subTest(field=(section, key)), self.assertRaises(RuntimeError): r.descriptor_delta(before, after)

    def test_frames_require_unique_native_evidence(self):
        good = observer_response(observed())
        self.assertEqual(r.observation(good, False), observed())
        for values in [[], ['FINANCIAL_COMMIT_OBSERVED'] * 2]:
            with self.subTest(values=values), self.assertRaises(RuntimeError): r.marker(response(values), 'FINANCIAL_COMMIT_OBSERVED')
        for lines in [[], ['EVIDENCE={}', 'EVIDENCE={}']]:
            with self.subTest(lines=lines), self.assertRaises(RuntimeError): r.frame(response(lines), 'EVIDENCE=')

    def test_observation_rejects_scope_counts_hashes_retry_flags_and_pid_mismatch(self):
        for key, replacement in [('scope', 'OPERATIONAL'), ('events', 12), ('receipts', 14),
                                  ('current_approvals', 2), ('simulated_payments', 0),
                                  ('snapshot_sha256', 'invalid'), ('retry_checked', True)]:
            value = observed(); value[key] = replacement
            with self.subTest(field=key), self.assertRaises(RuntimeError): r.observation(observer_response(value), False)
        wrong = observer_response(observed())
        wrong.stdout = wrong.stdout.replace(b'"phase": "observe", "backend_pid": 103', b'"phase": "observe", "backend_pid": 999')
        with self.assertRaises(RuntimeError): r.observation(wrong, False)

    def test_observer_proof_requires_five_distinct_bound_backend_pids(self):
        before, after = observed(False, 103), observed(True, 105)
        r.prove_observers(before, after, [101, 102, 103, 104, 105])
        for pids in [[101, 102, 103, 104], [101, 102, 103, 104, 103],
                     [101, 102, 103, True, 105], [101, 102, 104, 103, 105], [101, 102, 103, 104, 106]]:
            with self.subTest(pids=pids), self.assertRaises(RuntimeError): r.prove_observers(before, after, pids)

    def test_observer_proof_rejects_any_row_delta_or_unproved_retry(self):
        for key in ('snapshot_sha256', 'foreign_snapshot_sha256', 'global_snapshot_sha256'):
            before, after = observed(False, 103), observed(True, 105); after[key] = 'd' * 64
            with self.subTest(hash=key), self.assertRaises(RuntimeError): r.prove_observers(before, after, [101, 102, 103, 104, 105])
        for first_flag, second_flag in [(True, True), (False, False), (0, True), (False, 1)]:
            before, after = observed(first_flag, 103), observed(second_flag, 105)
            with self.subTest(flags=(first_flag, second_flag)), self.assertRaises(RuntimeError):
                r.prove_observers(before, after, [101, 102, 103, 104, 105])

    def stages(self, case):
        expected = r.case_stages(['install-a', 'install-b'], case)
        rows = [{'stage': name, 'native_exit': 3 if name == 'business-transaction' and case != 'proposed_definer' else 0,
                 'stdin_sha256': 'a' * 64} for name in expected]
        return expected, rows

    def test_exact_stage_shapes_keep_positive_and_negative_branches_distinct(self):
        for case in r.CASES:
            expected, rows = self.stages(case); r.validate_stages(rows, expected, case)
            self.assertEqual(expected[:2], ['install-a', 'install-b'])
            self.assertEqual(expected[-1], 'guard-catalog-final')
            self.assertEqual('proposed-deferred-owner-descriptor' in expected, case != 'original_invoker')
            self.assertEqual('observe-after-retry' in expected, case == 'proposed_definer')
            self.assertEqual('observe-controlled-rollback' in expected, case != 'proposed_definer')
        with self.assertRaises(RuntimeError): r.case_stages([], 'unknown')

    def test_missing_reordered_extra_stages_or_input_hash_are_rejected(self):
        expected, rows = self.stages('proposed_definer')
        bad_order = copy.deepcopy(rows); bad_order[0], bad_order[1] = bad_order[1], bad_order[0]
        bad_hash = copy.deepcopy(rows); bad_hash[-1]['stdin_sha256'] = 'not-a-hash'
        for mutant in [rows[:-1], [*rows, rows[-1]], bad_order, bad_hash]:
            with self.subTest(mutant=mutant[-1]), self.assertRaises(RuntimeError):
                r.validate_stages(mutant, expected, 'proposed_definer')

    def test_exit_matrix_requires_business_failure_only_for_two_negatives(self):
        for case in r.CASES:
            expected, rows = self.stages(case)
            for index, row in enumerate(rows):
                mutant = copy.deepcopy(rows)
                mutant[index]['native_exit'] = 0 if row['native_exit'] else 3
                with self.subTest(case=case, stage=row['stage']), self.assertRaises(RuntimeError):
                    r.validate_stages(mutant, expected, case)

    def test_cleanup_requires_every_owned_shutdown_confirmation(self):
        good = {'cleanup': 'confirmed_stopped_and_removed', 'shutdown_confirmed': True,
                'pg_status_3_and_no_pid': True, 'owned_psql_clients_closed': True}
        self.assertTrue(r.cleanup_ok(good))
        for field in good:
            bad = dict(good); bad.pop(field)
            with self.subTest(field=field): self.assertFalse(r.cleanup_ok(bad))


if __name__ == '__main__':
    unittest.main()
