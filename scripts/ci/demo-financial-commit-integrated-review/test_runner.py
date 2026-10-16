"""Offline refusal tests for the exact-main COMMIT integration adapter.

Event, provider and result fixtures are synthetic metadata. These tests do not
execute SQL/Docker or certify the historical native COMMIT evidence.
"""
import copy
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('commit_integrated_runner_test_sut', HERE / 'run_ci.py')
r = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = r
SPEC.loader.exec_module(r)

BASE = 'ecc53750c5d920d898ca2b00a2f717371dc19cf5'
PRIOR_BASE = '616bff8d454f9de35b6590913d08b7ad0d69b049'
PRIOR_HEAD = '99cd0f6ee9db3a83fa1eb90e2828db4eb4713021'
MAIN_MERGE = '1c8e5437ede1279b490318fac9814fde65cfd504'
AUTHOR = 'a7aff9ff8f92852687c56d3bc05d41150b44b2ae'
BEHAVIOR_BASE = 'b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa'
BRANCH = 'codex/demo-financial-commit-review-20261015'
PRIOR_BRANCH = 'codex/demo-financial-behavior-recovery-20261015'
REPO = 'jfcaicedoobando-arch/elogistix'
CASE_IDS = ('original_invoker', 'proposed_definer', 'proposed_revoked')


def historical_modules():
    forbidden = lambda: Mock(side_effect=AssertionError('historical entrypoint must remain unused'))
    cp = SimpleNamespace(EVENT_BASE=PRIOR_BASE, BASE_BRANCH=PRIOR_BRANCH,
                         BRANCH=BRANCH, AUTHOR=AUTHOR, CASES=CASE_IDS,
                         gate=forbidden(), run=forbidden())
    bm = SimpleNamespace(EVENT_BASE=BEHAVIOR_BASE, gate=forbidden(), run=forbidden())
    return cp, bm


def synthetic_results():
    return [{'case_id': case, 'status': 'PASS', 'cleanup_verified': True} for case in CASE_IDS]


class CommitIntegratedRunnerTests(unittest.TestCase):
    def event(self):
        repository = {'full_name': REPO, 'owner': {'login': 'jfcaicedoobando-arch'}}
        return {'action': 'synchronize', 'repository': copy.deepcopy(repository),
                'pull_request': {'draft': True,
                                 'head': {'repo': copy.deepcopy(repository), 'ref': BRANCH, 'sha': 'a' * 40},
                                 'base': {'repo': copy.deepcopy(repository), 'ref': 'main', 'sha': BASE}}}

    def env(self):
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': REPO}

    def test_loader_registers_module_and_pins_exact_reviewed_integration(self):
        self.assertIs(sys.modules[SPEC.name], r)
        self.assertEqual((r.BASE, r.PRIOR_BASE, r.PRIOR_HEAD, r.MAIN_MERGE, r.AUTHOR),
                         (BASE, PRIOR_BASE, PRIOR_HEAD, MAIN_MERGE, AUTHOR))
        self.assertEqual((r.BRANCH, r.REPOSITORY, r.CASES), (BRANCH, REPO, CASE_IDS))
        loaded = r.module('commit_integrated_loader_test', HERE / 'run_ci.py')
        self.assertIs(sys.modules['commit_integrated_loader_test'], loaded)

    def test_gate_accepts_exact_owned_draft_without_rewriting_event(self):
        for action in ('opened', 'synchronize', 'reopened'):
            event = self.event(); event['action'] = action
            before = copy.deepcopy(event)
            r.gate(event, self.env(), 'a' * 40)
            self.assertEqual(event, before)

    def test_gate_rejects_foreign_repository_or_owner_on_both_sides(self):
        for side in ('head', 'base'):
            for field, value in [('full_name', 'other/repo'), ('owner', {'login': 'other'})]:
                event = self.event(); event['pull_request'][side]['repo'][field] = value
                with self.subTest(side=side, field=field), self.assertRaises(RuntimeError):
                    r.gate(event, self.env(), 'a' * 40)

    def test_gate_rejects_nondraft_and_truthy_draft_shortcut(self):
        for value in (False, 1, 'true', None):
            event = self.event(); event['pull_request']['draft'] = value
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                r.gate(event, self.env(), 'a' * 40)

    def test_gate_rejects_old_stack_base_wrong_main_and_wrong_head_branch(self):
        for side, field, value in [('base', 'ref', PRIOR_BRANCH), ('base', 'ref', 'other'),
                                   ('base', 'sha', PRIOR_BASE), ('base', 'sha', 'b' * 40),
                                   ('head', 'ref', 'main'), ('head', 'ref', PRIOR_BRANCH),
                                   ('head', 'sha', 'b' * 40)]:
            event = self.event(); event['pull_request'][side][field] = value
            with self.subTest(side=side, field=field, value=value), self.assertRaises(RuntimeError):
                r.gate(event, self.env(), 'a' * 40)

    def test_gate_requires_matching_lowercase_full_checkout_sha(self):
        for head in ('a' * 39, 'A' * 40, 'z' * 40, 'b' * 40, ''):
            with self.subTest(head=head), self.assertRaises(RuntimeError):
                r.gate(self.event(), self.env(), head)

    def test_gate_rejects_nonactions_push_target_event_and_wrong_top_repository(self):
        for field, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_ACTIONS', 'TRUE'),
                             ('GITHUB_EVENT_NAME', 'push'), ('GITHUB_EVENT_NAME', 'pull_request_target'),
                             ('GITHUB_REPOSITORY', 'other/repo')]:
            env = self.env(); env[field] = value
            with self.subTest(field=field, value=value), self.assertRaises(RuntimeError):
                r.gate(self.event(), env, 'a' * 40)
        for field, value in [('action', 'closed'), ('repository', {'full_name': 'other/repo'})]:
            event = self.event(); event[field] = value
            with self.subTest(field=field), self.assertRaises(RuntimeError):
                r.gate(event, self.env(), 'a' * 40)

    def test_local_run_stops_before_event_read_git_provider_or_native_execution(self):
        with patch.dict(r.os.environ, {}, clear=True), patch.object(r.Path, 'read_text') as read, \
                patch.object(r.subprocess, 'run') as native, patch.object(r.subprocess, 'check_output') as git, \
                patch.object(r, 'module') as load:
            with self.assertRaisesRegex(RuntimeError, 'Actions only'): r.run(None)
            read.assert_not_called(); native.assert_not_called(); git.assert_not_called(); load.assert_not_called()

    def test_historical_metadata_is_accepted_intact_without_calling_obsolete_gates(self):
        cp, bm = historical_modules()
        before = (cp.EVENT_BASE, cp.BASE_BRANCH, cp.BRANCH, cp.AUTHOR, cp.CASES, bm.EVENT_BASE)
        r.verify_historical_modules(cp, bm)
        self.assertEqual((cp.EVENT_BASE, cp.BASE_BRANCH, cp.BRANCH, cp.AUTHOR, cp.CASES, bm.EVENT_BASE), before)
        for method in (cp.gate, cp.run, bm.gate, bm.run): method.assert_not_called()

    def test_historical_base_branch_author_and_behavior_base_cannot_be_retargeted(self):
        for which, field, value in [('cp', 'EVENT_BASE', BASE), ('cp', 'BASE_BRANCH', 'main'),
                                    ('cp', 'BRANCH', PRIOR_BRANCH), ('cp', 'AUTHOR', 'b' * 40),
                                    ('bm', 'EVENT_BASE', BASE)]:
            cp, bm = historical_modules(); setattr(cp if which == 'cp' else bm, field, value)
            with self.subTest(module=which, field=field), self.assertRaises(RuntimeError):
                r.verify_historical_modules(cp, bm)

    def test_historical_case_inventory_requires_exact_three_in_original_order(self):
        variants = (CASE_IDS[:-1], (*CASE_IDS, 'extra'),
                    (CASE_IDS[1], CASE_IDS[0], CASE_IDS[2]), (*CASE_IDS[:-1], CASE_IDS[0]),
                    (*CASE_IDS[:-1], 'changed'), list(CASE_IDS))
        for ids in variants:
            cp, bm = historical_modules(); cp.CASES = ids
            with self.subTest(ids=ids), self.assertRaises(RuntimeError): r.verify_historical_modules(cp, bm)

    def test_acceptance_requires_exact_three_ordered_cases_and_is_nonmutating(self):
        rows = synthetic_results(); before = copy.deepcopy(rows)
        self.assertTrue(r.accepted(rows))
        self.assertEqual(rows, before)
        for mutant in ([], rows[:-1], [*rows, rows[-1]], [rows[1], rows[0], rows[2]],
                       [rows[0], rows[1], rows[0]]):
            with self.subTest(ids=[v.get('case_id') for v in mutant]): self.assertFalse(r.accepted(mutant))

    def test_acceptance_rejects_failed_notrun_and_unverified_cleanup_in_each_case(self):
        for index in range(3):
            for field, value in [('status', 'FAIL'), ('status', 'NOT_RUN'),
                                 ('status', 'PASS_SYNTHETIC_ONLY'), ('cleanup_verified', False),
                                 ('cleanup_verified', 1), ('cleanup_verified', 'true'), ('cleanup_verified', None)]:
                rows = synthetic_results(); rows[index][field] = value
                with self.subTest(index=index, field=field, value=value): self.assertFalse(r.accepted(rows))

    def test_acceptance_rejects_missing_fields_unknown_ids_and_wrong_key(self):
        for index in range(3):
            for field in ('case_id', 'status', 'cleanup_verified'):
                rows = synthetic_results(); rows[index].pop(field)
                with self.subTest(index=index, missing=field): self.assertFalse(r.accepted(rows))
        for value in ('unreviewed', None):
            rows = synthetic_results(); rows[-1]['case_id'] = value
            with self.subTest(value=value): self.assertFalse(r.accepted(rows))
        rows = synthetic_results()
        for row in rows: row['suite'] = row.pop('case_id')
        self.assertFalse(r.accepted(rows))

    def test_added_paths_accepts_only_exact_census_and_does_not_mutate_inputs(self):
        expected = ('owned/package/one.py', 'owned/package/two.sql', 'owned/workflow.yml')
        changes = [('A', path) for path in reversed(expected)]; before = copy.deepcopy(changes)
        r.validate_added_paths(changes, expected)
        self.assertEqual(changes, before)

    def test_added_paths_rejects_modified_deleted_renamed_copied_or_type_changed_files(self):
        expected = ('owned/one.py', 'owned/two.sql')
        for status in ('M', 'D', 'R100', 'C100', 'T', 'U', '?'):
            changes = [('A', expected[0]), (status, expected[1])]
            with self.subTest(status=status), self.assertRaises(RuntimeError):
                r.validate_added_paths(changes, expected)

    def test_added_paths_rejects_empty_duplicate_missing_extra_or_foreign_census(self):
        expected = ('owned/one.py', 'owned/two.sql')
        variants = ([], [('A', expected[0])], [('A', p) for p in (*expected, 'extra')],
                    [('A', expected[0]), ('A', expected[0])],
                    [('A', expected[0]), ('A', 'supabase/schema/baseline.sql')])
        for changes in variants:
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                r.validate_added_paths(changes, expected)
        for bad_expected in ((), (expected[0], expected[0])):
            with self.subTest(expected=bad_expected), self.assertRaises(RuntimeError):
                r.validate_added_paths([('A', p) for p in bad_expected], bad_expected)


if __name__ == '__main__':
    unittest.main()
