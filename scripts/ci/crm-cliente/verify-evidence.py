"""Require both distinct stages; a final verify-only run is not migration replay."""
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
EXPECTED_CASES = ['independent_homonyms_no_old_row_lock', 'explicit_new_identity_retry_and_clear_then_delete', 'rfc_reuse_exact_target', 'same_identity_two_committed_conversions', 'delete_before_association', 'association_before_delete', 'kam_before_conversion', 'conversion_before_kam', 'original_link_disappears_before_lock', 'original_link_retained_across_dependent_wait', 'late_lead_claim_waits_True', 'late_lead_claim_waits_False', 'lead_claim_wins_before_conversion', 'reject_deleted', 'reject_cross_org', 'reject_ambiguous', 'reject_conflict', 'reject_wrong_lead', 'guard_new_deleted_customer']

def verify(stage, sha):
    directory = 'crm-cliente-concurrency' if stage == 'historical' else 'crm-cliente-final-concurrency'
    record = json.loads((ROOT / 'reports' / directory / 'actions-result.json').read_text())
    assert record['source_commit'] == sha and record['status'] == 'pass'
    assert record['source_preserved'] is True and record['runtime_tested'] is True
    runs = record['clone_runs']
    assert len(runs) == 2 and {r['iteration'] for r in runs} == {1, 2}
    assert len({r['database'] for r in runs}) == 2
    for item in runs:
        assert item['created'] is True and item['dropped'] is True and item['status'] == 'pass'
        key = 'whole_migration_replay' if stage == 'historical' else 'current_catalog_verification'
        assert item[key] == 'pass'
        result = json.loads((ROOT / 'reports' / directory / ('run-' + str(item['iteration'])) / 'result.json').read_text())
        assert result['source_commit'] == sha and result['status'] == 'pass' and result['both_committed'] is True
        assert result['cases'] == EXPECTED_CASES, 'Missing, extra or reordered identity cases'
    if stage == 'final':
        assert record['stage'] == 'final-0034-verify-only'
        assert all('whole_migration_replay' not in item for item in runs)

if __name__ == '__main__':
    assert sys.argv[1:] in [['historical'], ['both']], 'Only fixed historical or both stages accepted'
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    verify('historical', sha)
    if sys.argv[1] == 'both':
        verify('final', sha)
    print('CRM identity evidence verified: ' + sys.argv[1])
