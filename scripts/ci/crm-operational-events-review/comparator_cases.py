"""Three owned synthetic PostgreSQL witnesses for the offline comparator.

These experiments have no target connection arguments or operational mode.
The existing CI runner alone creates and destroys their network-disabled
PostgreSQL 17.6 fixtures. Full bundles saved here contain synthetic data only.
Every projection is read in an explicit READ ONLY transaction and is validated
by the actual offline Draft 2020-12 validator, not a semantic-test double.
"""
import hashlib
import json
import re

from cases import database
from comparator import compare
from event_cases import (CAPTURE_PACKAGE, CANONICAL_SHA256, REPOSITORY, _apply_sql,
                         _context, _fixture, _require_revoke_trace, _state, _trace,
                         _verify_registered_sql, require)
from evidence import BUNDLE_KIND
from projection_validator import ProjectionValidator
from public_source import verify_source
from test_operational_capture import require_readonly_query


COMPARATOR_CASES = (
    'comparator-exact-canonical-commit-default-returning',
    'comparator-registered-readonly-no-allocation',
    'comparator-rollback-after-default-insert-sequence-gap',
)
_OFFSET_LITERAL = 'params AS (SELECT 0::bigint AS offset_value,100::bigint AS page_size)'


def _capture_bundle(r, db, label):
    """Collect complete generic envelopes exclusively inside an owned fixture."""
    require(re.fullmatch(r'crm_acl_fixture_[a-z0-9_]+', db) is not None,
            'Comparator capture requires an owned synthetic database name')
    require(re.fullmatch(r'[a-z0-9-]+', label) is not None, 'Unsafe comparator artifact label')
    target = r.output / 'comparator-bundles' / label
    target.mkdir(parents=True, exist_ok=False)

    def collect(filename, name, source=None):
        sql = source if source is not None else (CAPTURE_PACKAGE / filename).read_text(encoding='utf8')
        require_readonly_query(sql)
        observed = json.loads(r.query('BEGIN READ ONLY;' + sql + 'COMMIT;',
                                      label + '-' + name, db).stdout)
        require(observed['kind'] == 'crm-operational-evidence-v1'
                and observed['admission'] == 'NOT_ADMITTED'
                and observed['capture']['database'] == db,
                'Comparator projection kind, admission, or owned identity differs')
        (target / ('projection-' + name + '.json')).write_text(
            json.dumps(observed, indent=2) + '\n', encoding='utf8')
        return observed

    discovery = collect('01_discovery.sql', 'discovery')
    catalog = collect('02_scoped_catalog.sql', 'catalog')
    drizzle = collect('03_drizzle_history.sql', 'drizzle-history')
    manifest_before = collect('04_supabase_manifest.sql', 'supabase-manifest-before')
    page_source = (CAPTURE_PACKAGE / '05_supabase_page.sql').read_text(encoding='utf8')
    require(page_source.count(_OFFSET_LITERAL) == 1, 'Pinned Supabase page parameter changed')
    pages, offset = [], 0
    while True:
        require(len(pages) < 1000, 'Synthetic comparator page collection bound exceeded')
        # Only the documented integer offset changes. Page size and query bytes
        # otherwise remain the inherited generic projection. No values are SQL.
        literal = ('params AS (SELECT ' + str(offset)
                   + '::bigint AS offset_value,100::bigint AS page_size)')
        sql = page_source.replace(_OFFSET_LITERAL, literal, 1)
        page = collect(None, 'supabase-page-' + str(len(pages) + 1).zfill(4), sql)
        pages.append(page)
        result = page['result']
        require(result['offset'] == str(offset), 'Synthetic comparator page offset differs')
        if result['has_more'] is False:
            require(result['next_offset'] is None, 'Synthetic terminal page has next offset')
            break
        require(result['has_more'] is True and type(result['next_offset']) is str
                and re.fullmatch(r'[1-9][0-9]*', result['next_offset']) is not None,
                'Synthetic next page offset is not an exact positive decimal')
        next_offset = int(result['next_offset'])
        require(next_offset == offset + 100, 'Synthetic comparator page gap or overlap')
        offset = next_offset
    manifest_after = collect('04_supabase_manifest.sql', 'supabase-manifest-after')
    generated = discovery['result']['sequence']['state_select']
    require(type(generated) is str, 'Synthetic sequence discovery did not return a SELECT')
    sequence = collect(None, 'sequence-state', generated)
    activity = collect('06_activity.sql', 'activity')
    bundle = dict(kind=BUNDLE_KIND, discovery=discovery, catalog=catalog,
                  drizzle_history=drizzle, supabase_manifest_before=manifest_before,
                  supabase_pages=pages, supabase_manifest_after=manifest_after,
                  sequence_state=sequence, activity=activity)
    (target / 'bundle.json').write_text(json.dumps(bundle, indent=2) + '\n', encoding='utf8')
    return bundle


def _returning(output, when):
    """Parse the actual INSERT RETURNING notice, including rollback witnesses."""
    matches = re.findall(r'TEST_ONLY_DEFAULT_INSERT:(\{[^\r\n]*\})', output)
    require(len(matches) == 1, 'Exactly one actual default INSERT RETURNING notice required')
    row = json.loads(matches[0])
    require(set(row) == {'id', 'hash', 'created_at'} and type(row['id']) is int
            and type(row['created_at']) is int and row['hash'] == CANONICAL_SHA256
            and row['created_at'] == when, 'Actual synthetic RETURNING row differs')
    return row


def _compare(r, label, before, after, outcome, validator, returned_row=None):
    summary = compare(before, after, outcome=outcome, returned_row=returned_row,
                      validate_projection=validator)
    require(summary['kind'] == 'crm-operational-delta-review-v1'
            and summary['admission'] == 'NOT_ADMITTED'
            and summary['comparison'] == 'MATCHED_DECLARED_DELTA_REVIEW_ONLY'
            and summary['outcome'] == outcome,
            'Comparator summary differs or claims operational admission')
    (r.output / ('comparator-' + label + '-summary.json')).write_text(
        json.dumps(summary, indent=2) + '\n', encoding='utf8')
    return summary


def run_comparator_cases(r):
    """Append exactly three checks, solely after inherited source/CI gates."""
    start = len(r.result['checks'])
    validator = ProjectionValidator()
    body = verify_source()['body']
    candidate = (REPOSITORY / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    require(hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256, 'Comparator candidate bytes differ')
    entries = json.loads((REPOSITORY / 'drizzle/migrations/meta/_journal.json').read_text(encoding='utf8'))['entries']
    entries = [entry for entry in entries if entry['tag'] == '0021_crm_helpers_owner_only']
    require(len(entries) == 1 and type(entries[0]['when']) is int, 'Comparator journal entry differs')
    when = entries[0]['when']

    with database(r, 'comparator_commit') as db:
        _fixture(r, db, 'comparator-commit', body)
        _context(r, db, 'comparator-commit-context', False)
        state_before = _state(r, db, 'comparator-commit-state-before')
        before = _capture_bundle(r, db, 'commit-before')
        require(_state(r, db, 'comparator-commit-readonly-confirmed') == state_before,
                'Comparator before capture changed owned fixture')
        response = r.query(_apply_sql(candidate, when), 'comparator-commit-apply', db)
        returned = _returning(response.stdout, when)
        _require_revoke_trace(_trace(r, db, 'comparator-commit-trace'), response.stdout)
        state_after = _state(r, db, 'comparator-commit-state-after')
        after = _capture_bundle(r, db, 'commit-after')
        require(_state(r, db, 'comparator-commit-after-readonly-confirmed') == state_after,
                'Comparator after capture changed owned fixture')
        require(state_before['extensions'] == state_after['extensions'],
                'Comparator commit changed public event definitions')
        _compare(r, 'commit', before, after, 'applied', validator, returned)
        r.check(COMPARATOR_CASES[0], exact_canonical_sha256=CANONICAL_SHA256,
                actual_default_returning=returned, full_before_after_bundles=True,
                real_draft_schema_validation=True, event_definitions_preserved=True,
                operational_admission='NOT_ADMITTED')

        registered_before = _capture_bundle(r, db, 'registered-before')
        verify_state = _state(r, db, 'comparator-registered-state-before')
        trace_before = _trace(r, db, 'comparator-registered-trace-before')
        verified = r.query(_verify_registered_sql(verify_state), 'comparator-registered-readonly', db)
        require('TEST_ONLY_DEFAULT_INSERT:' not in verified.stdout,
                'Registered read-only path unexpectedly performed INSERT')
        registered_after = _capture_bundle(r, db, 'registered-after')
        require(_state(r, db, 'comparator-registered-state-after') == verify_state
                and _trace(r, db, 'comparator-registered-trace-after') == trace_before,
                'Registered read-only path changed catalog, history, sequence, or DDL trace')
        _compare(r, 'registered', registered_before, registered_after,
                 'registered_read_only', validator)
        r.check(COMPARATOR_CASES[1], read_only_transaction=True,
                no_ddl_no_new_row_no_nextval=True, full_before_after_bundles=True,
                real_draft_schema_validation=True, event_definitions_preserved=True,
                operational_admission='NOT_ADMITTED')

    with database(r, 'comparator_rollback') as db:
        _fixture(r, db, 'comparator-rollback', body)
        _context(r, db, 'comparator-rollback-context', False)
        state_before = _state(r, db, 'comparator-rollback-state-before')
        before = _capture_bundle(r, db, 'rollback-before')
        response = r.query(_apply_sql(candidate, when, fault=True),
                           'comparator-rollback-after-default-insert', db, expected=3)
        require(re.search(r'^ERROR:\s+P0001: TEST_ONLY_EVENT_AFTER_INSERT$', response.stdout, re.M),
                'Comparator rollback did not reach intended post-INSERT error')
        returned = _returning(response.stdout, when)
        require(response.stdout.count('TEST_ONLY_EVENT_TRACE:') == 2
                and not _trace(r, db, 'comparator-rollback-trace'),
                'Rollback did not invoke two REVOKEs or persisted transactional trace')
        state_after = _state(r, db, 'comparator-rollback-state-after')
        after = _capture_bundle(r, db, 'rollback-after')
        require(_state(r, db, 'comparator-rollback-readonly-confirmed') == state_after
                and state_before['extensions'] == state_after['extensions'],
                'Comparator rollback/capture changed event definitions or fixture')
        _compare(r, 'rollback', before, after, 'rolled_back_after_insert', validator, returned)
        r.check(COMPARATOR_CASES[2], sqlstate='P0001', insert_returning_observed=True,
                nontransactional_sequence_gap=True, full_before_after_bundles=True,
                real_draft_schema_validation=True, event_definitions_preserved=True,
                operational_admission='NOT_ADMITTED')

    require(validator.formally_validated == 48,
            'Three synthetic comparator pairs require 48 actually validated projections')
    checks = r.result['checks'][start:]
    require(tuple(item['case'] for item in checks) == COMPARATOR_CASES
            and all(item['status'] == 'pass' for item in checks), 'Incomplete comparator case matrix')
    r.result['comparator_formal_projection_count'] = validator.formally_validated
    r.result['comparator_bundles'] = 6
    r.result['comparator_operational_admission'] = 'NOT_ADMITTED'
    r.save()
    return checks
