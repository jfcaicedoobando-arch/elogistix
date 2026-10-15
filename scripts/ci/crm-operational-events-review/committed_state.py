"""Separate inert channel: estado comprometido observado, never a receipt.

The complete history and its NULL pg_current_xact_id_if_assigned() must come
from the SAME inherited SELECT envelope. Conservatively every before/after
projection, and both auxiliary binding observations, must have NULL XID.
A permanent INSERT assigns an XID even when that backend can see its own row.
No backend-PID inequality is required: that backend may observe after COMMIT.

This is supplied-evidence comparison, not provenance authentication, a single
snapshot, a transport contract, admission, rollback proof or retry permission.
Missing rows always reject; an execution may still be pending. No SQL, IO,
rendering or retry occurs here. The existing receipt comparator is unchanged
and is never called with a fabricated RETURNING object.
"""
import copy

import comparator
import evidence
import transaction_envelope


class CommittedStateError(ValueError):
    """Static diagnostic, without private values."""


def require(condition, code):
    if not condition:
        raise CommittedStateError('CRM_COMMITTED_' + code)


def _envelopes(bundle):
    return [bundle[key] for key in ('discovery', 'catalog', 'drizzle_history',
        'supabase_manifest_before', 'supabase_manifest_after', 'sequence_state', 'activity')] + bundle['supabase_pages']


def _no_assigned_xid(bundle):
    # Do not substitute activity.backend_xid, a separate query, an input claim,
    # or a PID comparison for the field within the actual history envelope.
    require(all(envelope['capture']['xid_if_assigned'] is None
                for envelope in _envelopes(bundle)), 'ASSIGNED_XID')


def _history(before, after):
    old, new = (bundle['drizzle_history']['result']['rows'] for bundle in (before, after))
    require(not any(row['hash'] == comparator.PAYLOAD_SHA256
                    or int(row['created_at']) >= comparator.JOURNAL_WHEN for row in old),
            'PREIMAGE_REGISTRATION_CONFLICT_OR_FUTURE')
    require(len(new) == len(old) + 1 and comparator._same(new[:-1], old),
            'EXACT_NEW_ROW_REQUIRED_NO_ROLLBACK_OR_RETRY_CONCLUSION')
    observed = new[-1]
    require(observed['hash'] == comparator.PAYLOAD_SHA256
            and observed['created_at'] == str(comparator.JOURNAL_WHEN), 'NEW_ROW_IDENTITY')
    require(observed['id'] not in {row['id'] for row in old}, 'NEW_ROW_ID_COLLISION')
    # ingest already verifies every complete row and aggregate commitment.
    # This object is an observed ledger row, never an INSERT RETURNING receipt.
    return observed


def _supabase(before, after):
    for key in ('supabase_manifest_before', 'supabase_manifest_after'):
        require(comparator._same(before[key]['result'], after[key]['result'])
                and comparator._same(before[key]['capture']['format_settings'],
                                     after[key]['capture']['format_settings']), 'SUPABASE_DRIFT')
    require(len(before['supabase_pages']) == len(after['supabase_pages'])
            and all(comparator._same(left['result'], right['result'])
                and comparator._same(left['capture']['format_settings'], right['capture']['format_settings'])
                for left, right in zip(before['supabase_pages'], after['supabase_pages'])), 'SUPABASE_DRIFT')


def compare_committed_state(before, after, *, before_bindings, after_bindings,
                            validate_projection=None):
    """Review one exact canonical committed-state delta; always NOT_ADMITTED.

    Requires complete bundles and a trusted real offline Draft validator.
    All before rows, Supabase commitments, metadata and binding observations
    remain exact except the two canonical helper ACL/dependency changes and
    one measured default-sequence allocation. The API accepts no receipt,
    execution outcome, transport claim, rollback or retry flag.
    """
    try:
        require(callable(validate_projection), 'PROJECTION_VALIDATOR_REQUIRED')
        bundles = []
        for supplied in (before, after):
            value = evidence.load_bundle(supplied) if type(supplied) in (str, bytes) else supplied
            evidence._scan(value)
            value = copy.deepcopy(value)
            evidence.ingest(value, validate_projection=validate_projection)
            _no_assigned_xid(value)
            transaction_envelope._ledger_read_profile(value)
            bundles.append(value)
        before, after = bundles
        require(comparator._identity(before) == comparator._identity(after), 'CAPTURE_IDENTITY_DRIFT')
        require(comparator._same(before['discovery']['result'], after['discovery']['result']), 'DISCOVERY_DRIFT')
        bound_before, handler_before = transaction_envelope._bindings(before_bindings, before)
        bound_after, handler_after = transaction_envelope._bindings(after_bindings, after)
        require(handler_before == handler_after and comparator._same(bound_before, bound_after), 'BINDINGS_DRIFT')
        target, _ = comparator._helper_postimage(before)
        _, remaining = comparator._helper_postimage(after)
        require(remaining == 0 and comparator._same(target, after['catalog']['result']), 'CATALOG_POSTIMAGE_DRIFT')
        observed = _history(before, after)
        _supabase(before, after)
        old_value, old_called = comparator._sequence_profile(before)
        new_value, new_called = comparator._sequence_profile(after)
        expected = old_value + 1 if old_called else old_value
        require(expected <= 2147483647 and new_value == expected and new_called is True
                and observed['id'] == str(expected), 'SEQUENCE_TRANSITION')
        old_sequence = copy.deepcopy(before['sequence_state']['result'])
        new_sequence = copy.deepcopy(after['sequence_state']['result'])
        old_sequence.pop('sequence_state')
        new_sequence.pop('sequence_state')
        require(comparator._same(old_sequence, new_sequence), 'SEQUENCE_IDENTITY_DRIFT')
        return dict(kind='crm-committed-state-review-v1', admission='NOT_ADMITTED',
            result='estado comprometido observado', comparison='MATCHED_COMMITTED_STATE_OBSERVATION_REVIEW_ONLY',
            evidence_channel='OBSERVED_COMMITTED_STATE_NOT_ORIGINAL_RETURNING',
            capture_xid='NULL_IN_EVERY_RELEVANT_CAPTURE', sequence_effect='MEASURED_DEFAULT_TRANSITION',
            execution_attribution='NOT_ESTABLISHED', rollback='NOT_ESTABLISHED', retry_permission='NOT_GRANTED',
            preimage_semantic_review='UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            default_expression_semantics='UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            complete_role_capabilities='UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            capture_provenance_and_catalog_completeness='UNKNOWN',
            supabase_row_preimages='NOT_VERIFIED_COMMITMENTS_ONLY', single_transaction_snapshot='NOT_ESTABLISHED',
            event_policy_and_external_consumers='UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            transport_and_ddl_acl_window='UNKNOWN_REQUIRES_PARENT_VERIFICATION')
    except CommittedStateError:
        raise
    except evidence.EvidenceError:
        raise CommittedStateError('CRM_COMMITTED_EVIDENCE_REJECTED') from None
    except (comparator.ComparisonError, transaction_envelope.TransactionError):
        raise CommittedStateError('CRM_COMMITTED_PROFILE_REJECTED') from None
    except (KeyError, TypeError, ValueError, OverflowError, RecursionError, UnicodeError):
        raise CommittedStateError('CRM_COMMITTED_MALFORMED_PROJECTION') from None
