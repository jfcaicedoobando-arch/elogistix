"""Offline integrated-runner refusal tests; no SQL/Docker/native subprocess.

Providers and results below are explicitly synthetic metadata. They test routing,
inventory-shaped expectations and acceptance gates, not financial behavior.
"""
import copy
import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('integrated_base_runner_test_sut', HERE / 'run_ci.py')
r = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = r
SPEC.loader.exec_module(r)

BASE = '326d981b9d98cae405c42158b66a3960cfe75bd3'
BRANCH = 'codex/demo-financial-behavior-recovery-20261015'
REPO = 'jfcaicedoobando-arch/elogistix'
ORIGINAL_IDS = ('foreign_bound_invoice_id', 'authority_scheduler_disabled', 'authority_transport_disabled',
                'tenant_organization_inactive', 'manifest_scheduler_hash_drift', 'expiry_run_shortened',
                'guarded_tenant_run_rebinding', 'mutable_supplier_origin_drift', 'materialized_invoice_folio_drift')
SUPPLEMENT_IDS = ('foreign_bound_concept_id', 'foreign_bound_payment_id', 'tenant_authority_reassignment')
SEQUENCE_ID = 'sequence_nontransactional_control'


def native_module():
    return SimpleNamespace(CASE_IDS=ORIGINAL_IDS, SUPPLEMENT_CASE_IDS=SUPPLEMENT_IDS,
                           SEQUENCE_CONTROL_ID=SEQUENCE_ID, AUTHOR=r.AUTHOR)


def provider(ids=ORIGINAL_IDS, version=2):
    return SimpleNamespace(PROVIDER_VERSION=version,
                           CASES=tuple({'id': case, 'phase': 'SYNTHETIC_TEST_METADATA'} for case in ids))


def results(ids, key='case_id'):
    return [{key: case, 'status': 'PASS', 'cleanup_verified': True} for case in ids]


class IntegratedRunnerTests(unittest.TestCase):
    def event(self):
        repository = {'full_name': REPO, 'owner': {'login': 'jfcaicedoobando-arch'}}
        return {'action': 'synchronize', 'repository': copy.deepcopy(repository),
                'pull_request': {'draft': True,
                                 'head': {'repo': copy.deepcopy(repository), 'ref': BRANCH, 'sha': 'a' * 40},
                                 'base': {'repo': copy.deepcopy(repository), 'ref': 'main', 'sha': BASE}}}

    def env(self):
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': REPO}

    def test_import_registers_modules_and_exact_integrated_constants(self):
        self.assertIs(sys.modules[SPEC.name], r)
        self.assertEqual((r.BASE, r.BRANCH, r.REPOSITORY), (BASE, BRANCH, REPO))
        self.assertEqual(r.LANES, ('author', 'review-v2', 'supplement'))
        loaded = r.module('integrated_base_loader_test', HERE / 'run_ci.py')
        self.assertIs(sys.modules['integrated_base_loader_test'], loaded)

    def test_gate_accepts_only_the_exact_reviewed_owned_draft(self):
        for action in ('opened', 'synchronize', 'reopened'):
            event = self.event(); event['action'] = action
            original = copy.deepcopy(event)
            r.gate(event, self.env(), 'a' * 40)
            self.assertEqual(event, original)

    def test_gate_rejects_fork_or_wrong_repository_owner_on_either_side(self):
        for side in ('head', 'base'):
            for field, value in [('full_name', 'other/repo'), ('owner', {'login': 'other'})]:
                event = self.event(); event['pull_request'][side]['repo'][field] = value
                with self.subTest(side=side, field=field), self.assertRaises(RuntimeError):
                    r.gate(event, self.env(), 'a' * 40)

    def test_gate_rejects_nondraft_wrong_branch_base_or_head(self):
        for field, value in [('draft', False), ('draft', 1), ('head_ref', 'main'), ('head_ref', 'other'),
                             ('base_ref', BRANCH), ('base_sha', r.PRIOR_BASE), ('base_sha', 'b' * 40),
                             ('head_sha', 'b' * 40)]:
            event = self.event()
            if field == 'draft': event['pull_request'][field] = value
            else:
                side, key = field.split('_'); event['pull_request'][side][key] = value
            with self.subTest(field=field, value=value), self.assertRaises(RuntimeError):
                r.gate(event, self.env(), 'a' * 40)
        for head in ['a' * 39, 'A' * 40, 'z' * 40, 'b' * 40]:
            with self.subTest(head=head), self.assertRaises(RuntimeError): r.gate(self.event(), self.env(), head)

    def test_gate_rejects_nonactions_push_and_unowned_top_level_event(self):
        for field, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_EVENT_NAME', 'push'),
                             ('GITHUB_REPOSITORY', 'other/repo')]:
            env = self.env(); env[field] = value
            with self.subTest(field=field), self.assertRaises(RuntimeError): r.gate(self.event(), env, 'a' * 40)
        for field, value in [('action', 'closed'), ('repository', {'full_name': 'other/repo'})]:
            event = self.event(); event[field] = value
            with self.subTest(field=field), self.assertRaises(RuntimeError): r.gate(event, self.env(), 'a' * 40)

    def test_local_execution_stops_before_any_native_or_historical_entrypoint(self):
        with patch.dict(r.os.environ, {}, clear=True), patch.object(r.subprocess, 'run') as native, \
                patch.object(r.subprocess, 'check_output') as git, patch.object(r, 'module') as load:
            with self.assertRaisesRegex(RuntimeError, 'Actions only'): r.run(None, 'author')
            native.assert_not_called(); git.assert_not_called(); load.assert_not_called()

    def test_historical_gate_metadata_is_checked_without_rewriting_or_invoking_it(self):
        bm = SimpleNamespace(EVENT_BASE=r.PRIOR_BASE, BRANCH=BRANCH, gate=Mock(side_effect=AssertionError('obsolete gate called')))
        nm = native_module(); nm.run = Mock(side_effect=AssertionError('historical entrypoint called'))
        before = (bm.EVENT_BASE, bm.BRANCH, nm.AUTHOR)
        r.verify_historical_modules(bm, nm)
        self.assertEqual((bm.EVENT_BASE, bm.BRANCH, nm.AUTHOR), before)
        bm.gate.assert_not_called(); nm.run.assert_not_called()
        for module, field, value in [(bm, 'EVENT_BASE', BASE), (bm, 'BRANCH', 'main'), (nm, 'AUTHOR', 'b' * 40)]:
            old = getattr(module, field); setattr(module, field, value)
            try:
                with self.subTest(field=field), self.assertRaises(RuntimeError): r.verify_historical_modules(bm, nm)
            finally: setattr(module, field, old)

    def test_review_v2_returns_all_nine_in_original_order_without_mutating_provider(self):
        p = provider(); before = copy.deepcopy(p.CASES)
        selected = r.selected_cases(p, 'review-v2', native_module())
        self.assertEqual(tuple(c['id'] for c in selected), ORIGINAL_IDS)
        self.assertEqual(len(selected), 9)
        self.assertIn('mutable_supplier_origin_drift', [c['id'] for c in selected])
        self.assertIn('materialized_invoice_folio_drift', [c['id'] for c in selected])
        self.assertEqual(p.CASES, before)

    def test_review_v2_rejects_old_missing_or_wrong_provider_version(self):
        for version in (1, 3, '2', None):
            with self.subTest(version=version), self.assertRaises(RuntimeError):
                r.selected_cases(provider(version=version), 'review-v2', native_module())

    def test_review_v2_rejects_pair_only_missing_duplicate_reordered_extra_or_changed_ids(self):
        variants = [ORIGINAL_IDS[-2:], ORIGINAL_IDS[:-1], ORIGINAL_IDS + ('unexpected',),
                    (ORIGINAL_IDS[1], ORIGINAL_IDS[0], *ORIGINAL_IDS[2:]),
                    (*ORIGINAL_IDS[:-1], ORIGINAL_IDS[0]), (*ORIGINAL_IDS[:-1], 'changed')]
        for ids in variants:
            with self.subTest(ids=ids), self.assertRaises(RuntimeError):
                r.selected_cases(provider(ids), 'review-v2', native_module())

    def test_supplement_keeps_exact_three_and_appends_one_sequence_control(self):
        p = provider(SUPPLEMENT_IDS); before = copy.deepcopy(p.CASES)
        selected = r.selected_cases(p, 'supplement', native_module())
        self.assertEqual(tuple(c['id'] for c in selected), (*SUPPLEMENT_IDS, SEQUENCE_ID))
        self.assertEqual(selected[-1], {'id': SEQUENCE_ID, 'phase': 'materialized', 'rejection_stage': 'calibration'})
        self.assertEqual(p.CASES, before)

    def test_supplement_rejects_changed_missing_duplicate_or_preinserted_sequence_case(self):
        variants = [SUPPLEMENT_IDS[:-1], (*SUPPLEMENT_IDS, SEQUENCE_ID),
                    (SUPPLEMENT_IDS[1], SUPPLEMENT_IDS[0], SUPPLEMENT_IDS[2]),
                    (*SUPPLEMENT_IDS[:-1], SUPPLEMENT_IDS[0]), (*SUPPLEMENT_IDS[:-1], 'changed')]
        for ids in variants:
            with self.subTest(ids=ids), self.assertRaises(RuntimeError):
                r.selected_cases(provider(ids), 'supplement', native_module())

    def test_author_or_unknown_lane_cannot_use_the_provider_selector(self):
        for lane in ('author', 'original', 'corrected', 'unknown'):
            with self.subTest(lane=lane), self.assertRaises(RuntimeError):
                r.selected_cases(provider(), lane, native_module())

    def test_acceptance_requires_every_expected_case_and_cleanup_for_both_key_shapes(self):
        for key, ids in [('case_id', ORIGINAL_IDS), ('case_id', (*SUPPLEMENT_IDS, SEQUENCE_ID)),
                         ('suite', ('happy', 'checkpoint', 'marker', 'execution_receipt', 'event', 'receipt', 'retry_security'))]:
            with self.subTest(key=key, count=len(ids)):
                self.assertTrue(r.accepted(results(ids, key), ids, key))
                self.assertFalse(r.accepted(results(ids, key)[:-1], ids, key))
                self.assertFalse(r.accepted([*results(ids, key), results(ids, key)[-1]], ids, key))

    def test_acceptance_rejects_status_failure_notrun_or_truthy_cleanup_shortcuts(self):
        for field, value in [('status', 'FAIL'), ('status', 'NOT_RUN'), ('status', 'PASS_COMPILE_ONLY'),
                             ('cleanup_verified', False), ('cleanup_verified', 1), ('cleanup_verified', 'true'),
                             ('cleanup_verified', None)]:
            rows = results(ORIGINAL_IDS); rows[-1][field] = value
            with self.subTest(field=field, value=value): self.assertFalse(r.accepted(rows, ORIGINAL_IDS, 'case_id'))
        for field in ('status', 'cleanup_verified', 'case_id'):
            rows = results(ORIGINAL_IDS); rows[0].pop(field)
            with self.subTest(missing=field): self.assertFalse(r.accepted(rows, ORIGINAL_IDS, 'case_id'))

    def test_acceptance_rejects_empty_wrong_key_order_duplicate_and_changed_ids(self):
        self.assertFalse(r.accepted([], (), 'case_id'))
        self.assertFalse(r.accepted([], ORIGINAL_IDS, 'case_id'))
        self.assertFalse(r.accepted(results(ORIGINAL_IDS), ORIGINAL_IDS, 'suite'))
        rows = results(ORIGINAL_IDS)
        reordered = [rows[1], rows[0], *rows[2:]]
        duplicate = [*rows[:-1], rows[0]]
        changed = copy.deepcopy(rows); changed[-1]['case_id'] = 'unreviewed'
        for mutant in (reordered, duplicate, changed):
            with self.subTest(ids=[v['case_id'] for v in mutant]):
                self.assertFalse(r.accepted(mutant, ORIGINAL_IDS, 'case_id'))


if __name__ == '__main__':
    unittest.main()
