"""TEST_ONLY reduced semantic doubles; complete real-schema cases run in CI.

Ledger/binding profile checks already have independent inherited unit tests.
Here they are explicit boundary doubles; runtime uses both real implementations.
"""
import copy
import inspect
import json
import unittest
from unittest.mock import patch

import comparator
import committed_state as committed
import transaction_envelope as transaction
from test_comparator import applied, fixture, history, registration
from test_evidence import trusted_test_only_projection


class CommittedStateTests(unittest.TestCase):
    def compare(self, before, after, **kwargs):
        with patch.object(transaction, '_ledger_read_profile') as ledger, \
             patch.object(transaction, '_bindings', side_effect=lambda witness, bundle: (witness, '99099')) as bindings:
            result = committed.compare_committed_state(before, after,
                before_bindings=kwargs.pop('before_bindings', {}),
                after_bindings=kwargs.pop('after_bindings', {}),
                validate_projection=kwargs.pop('validate_projection', trusted_test_only_projection), **kwargs)
            self.assertEqual(ledger.call_count, 2)
            self.assertEqual(bindings.call_count, 2)
            return result

    def rejects(self, before, after, code='CRM_COMMITTED_', **kwargs):
        with self.assertRaisesRegex(committed.CommittedStateError, code):
            self.compare(before, after, **kwargs)

    def test_committed_without_receipt_does_not_mutate_or_call_receipt_comparator(self):
        before, after, _ = applied()
        saved = copy.deepcopy((before, after))
        with patch.object(comparator, 'compare', side_effect=AssertionError('receipt channel called')):
            result = self.compare(before, after)
        self.assertEqual((before, after), saved)
        self.assertEqual(result['admission'], 'NOT_ADMITTED')
        self.assertEqual(result['result'], 'estado comprometido observado')
        self.assertEqual(result['retry_permission'], 'NOT_GRANTED')
        self.assertEqual(result['rollback'], 'NOT_ESTABLISHED')
        self.assertEqual(result['execution_attribution'], 'NOT_ESTABLISHED')
        self.assertNotIn('990', json.dumps(result))
        self.assertEqual(set(inspect.signature(committed.compare_committed_state).parameters),
            {'before', 'after', 'before_bindings', 'after_bindings', 'validate_projection'})

    def test_same_backend_after_commit_is_accepted(self):
        before, after, _ = applied()
        self.assertEqual(before['drizzle_history']['capture']['backend_pid'],
                         after['drizzle_history']['capture']['backend_pid'])
        self.compare(before, after)

    def test_every_capture_rejects_assigned_xid_in_before_and_after(self):
        for side in (0, 1):
            initial = applied()[:2]
            for index in range(len(committed._envelopes(initial[side]))):
                before, after, _ = applied()
                committed._envelopes((before, after)[side])[index]['capture']['xid_if_assigned'] = '99333'
                with self.subTest(side=side, index=index):
                    self.rejects(before, after, 'ASSIGNED_XID')

    def test_history_xid_cannot_be_replaced_by_activity_or_other_capture(self):
        before, after, _ = applied()
        after['drizzle_history']['capture']['xid_if_assigned'] = '99333'
        after['activity']['capture']['xid_if_assigned'] = None
        self.rejects(before, after, 'ASSIGNED_XID')
        del after['drizzle_history']['capture']['xid_if_assigned']
        self.rejects(before, after)

    def test_absence_never_proves_rollback_or_retry(self):
        before = fixture()
        for gap in (False, True):
            after = copy.deepcopy(before)
            after['catalog']['result'] = comparator._helper_postimage(before)[0]
            after['sequence_state']['result']['sequence_state']['is_called'] = gap
            self.rejects(before, after, 'EXACT_NEW_ROW_REQUIRED_NO_ROLLBACK_OR_RETRY_CONCLUSION')

    def test_exact_prior_history_and_single_canonical_append_required(self):
        mutations = (
            lambda rows: rows.__setitem__(0, registration(9)[1]),
            lambda rows: rows.append(registration(9)[1]),
            lambda rows: rows[-1].update(created_at=str(comparator.JOURNAL_WHEN + 1)),
            lambda rows: rows[-1].update(hash='a' * 64),
        )
        for mutate in mutations:
            before, after, _ = applied()
            mutate(after['drizzle_history']['result']['rows'])
            history(after['drizzle_history']['result'], after['drizzle_history']['result']['rows'])
            self.rejects(before, after)

    def test_registered_baseline_or_conflict_is_not_a_new_commit_delta(self):
        before, after, _ = applied()
        self.rejects(after, copy.deepcopy(after), 'PREIMAGE_REGISTRATION_CONFLICT_OR_FUTURE')
        history(before['drizzle_history']['result'], [registration(7)[1]])
        self.rejects(before, after)

    def test_sequence_gap_and_profile_drift_reject(self):
        for mutation in (
            lambda b: b['sequence_state']['result']['sequence_state'].update(last_value='9'),
            lambda b: b['sequence_state']['result']['sequence_state'].update(is_called=False),
            lambda b: b['catalog']['result']['sequences'][0].update(seqcache='2'),
        ):
            before, after, _ = applied()
            mutation(after)
            self.rejects(before, after)

    def test_catalog_acl_dependency_and_scope_drift_reject(self):
        for mutate in (
            lambda c: c['relations'][0]['metadata'].update(relfilenode='99111'),
            lambda c: c['functions'][0]['metadata'].update(proacl=['postgres=X/postgres', 'service_role=X/postgres']),
            lambda c: c['shared_dependencies'].pop(),
            lambda c: c['dependencies'].append(copy.deepcopy(c['dependencies'][0])),
            lambda c: c['defaults'][0].update(tree_sha256='a' * 64),
        ):
            before, after, _ = applied()
            mutate(after['catalog']['result'])
            self.rejects(before, after)

    def test_supabase_drift_and_incomplete_evidence_reject(self):
        before, after, _ = applied()
        after['supabase_manifest_before']['result']['row_count'] = '999'
        self.rejects(before, after)
        for key in ('catalog', 'activity', 'sequence_state', 'supabase_pages', 'drizzle_history'):
            before, after, _ = applied()
            del after[key]
            self.rejects(before, after)

    def test_binding_drift_rejects_separately_from_scoped_catalog(self):
        before, after, _ = applied()
        self.rejects(before, after, 'BINDINGS_DRIFT', before_bindings={'cost': 1}, after_bindings={'cost': 2})

    def test_real_ledger_and_binding_checks_are_not_optional(self):
        before, after, _ = applied()
        for method in ('_ledger_read_profile', '_bindings'):
            with patch.object(transaction, '_ledger_read_profile'), patch.object(transaction, '_bindings', return_value=({}, '99099')):
                with patch.object(transaction, method, side_effect=transaction.TransactionError('PRIVATE_SENTINEL')):
                    with self.assertRaisesRegex(committed.CommittedStateError, '^CRM_COMMITTED_PROFILE_REJECTED$'):
                        committed.compare_committed_state(before, after, before_bindings={}, after_bindings={},
                            validate_projection=trusted_test_only_projection)

    def test_schema_callback_is_required_and_failures_sanitized(self):
        before, after, _ = applied()
        for callback in (None, True, lambda _: False, lambda _: 1):
            self.rejects(before, after, validate_projection=callback)
        def fails(_):
            raise RuntimeError('PRIVATE_SENTINEL')
        self.rejects(before, after, '^CRM_COMMITTED_EVIDENCE_REJECTED$', validate_projection=fails)

    def test_json_duplicate_keys_raw_fields_and_nonfinite_reject(self):
        before, after, _ = applied()
        self.compare(json.dumps(before), json.dumps(after).encode())
        for invalid in ('{"a":1,"a":2}', '{"a":NaN}', b'\xff'):
            self.rejects(invalid, after)
        after['catalog']['result']['prosrc'] = 'PRIVATE_SENTINEL'
        self.rejects(before, after)
