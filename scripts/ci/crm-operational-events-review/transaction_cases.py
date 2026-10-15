"""Owned disposable witnesses for the separate transaction proposal.

The public proposal remains unconditionally fenced. A distinct TEST_ONLY
builder executes its shared program only in the CRM runner's owned synthetic
PostgreSQL 17.6 fixture. There is no DSN, application mode or target input.
Saved envelopes and emitted SQL contain independently created synthetic data.
"""
import hashlib
import json
import re
import time

from cases import database
from comparator import compare, _same
from comparator_cases import _capture_bundle, _returning
from event_cases import (CANONICAL_SHA256, REPOSITORY, _context, _fixture,
                         _Listener, _clear_trace, _require_revoke_trace, _state,
                         _trace, require)
from projection_validator import ProjectionValidator
from public_source import verify_source
from transaction_envelope import (render_synthetic_transaction,
                                  render_transaction_proposal,
                                  semantic_witness_sql, transaction_core_sha256)


TRANSACTION_CASES = (
    'transaction-public-proposal-stays-fenced',
    'transaction-exact-canonical-commit-default-returning',
    'transaction-registered-readonly-no-allocation',
    'transaction-rollback-after-default-insert-sequence-gap',
    'transaction-stale-catalog-preimage-rejected',
    'transaction-stale-drizzle-preimage-rejected',
    'transaction-stale-supabase-preimage-rejected',
    'transaction-stale-sequence-preimage-rejected',
    'transaction-ledger-lock-contention-rejected',
    'transaction-empty-handler-search-path-broader-nosuperuser-profile',
    'transaction-stale-builtin-binding-preimage-rejected',
)


class _CaptureLane:
    """Reuse unchanged generic collection under a separate artifact subtree."""
    def __init__(self, runner):
        self.runner = runner
        self.output = runner.output / 'transaction-evidence'
        self.output.mkdir(parents=True, exist_ok=False)

    def query(self, *args, **kwargs):
        return self.runner.query(*args, **kwargs)


def _capture(lane, validator, db, label):
    bundle = _capture_bundle(lane, db, label)
    # Call the actual offline Draft validator on every complete envelope. The
    # builder/compare callbacks share its content cache, not a semantic double.
    from evidence import ingest
    ingest(bundle, validate_projection=validator)
    return bundle


def _semantic(r, db, before, label):
    """Read installed bindings in the fixture; never execute a default/callback."""
    sql = semantic_witness_sql(before)
    from test_operational_capture import require_readonly_query
    require_readonly_query(sql)
    witness = json.loads(r.query('BEGIN READ ONLY;' + sql + 'COMMIT;',
                                 label + '-semantic-bindings', db).stdout)
    _save(r, label + '-semantic-witness', witness)
    return witness


def _render(candidate, before, validator, *, r, db, label, fault=None):
    witness = _semantic(r, db, before, label)
    common = dict(validate_projection=validator, semantic_witness=witness)
    proposal = render_transaction_proposal(candidate, before, **common)
    normal = render_synthetic_transaction(candidate, before,
                                          scope='synthetic-ci', **common)
    expected = transaction_core_sha256(candidate, before, **common)
    cores = []
    for sql in (proposal, normal):
        marker = re.findall(r'^-- CRM_TRANSACTION_CORE_SHA256:([0-9a-f]{64})$', sql, re.M)
        core = re.findall(r'-- CRM_TRANSACTION_CORE_BEGIN\n([\s\S]*?)-- CRM_TRANSACTION_CORE_END', sql)
        require(marker == [expected] and len(core) == 1,
                'Transaction shared-program markers or occurrence count differ')
        require(hashlib.sha256(core[0].encode('utf8')).hexdigest() == expected,
                'Extracted transaction program differs from its independently calculated SHA256')
        cores.append(core[0])
    require(cores[0] == cores[1], 'Public and TEST_ONLY transaction programs differ')
    executable, fault_digest = normal, None
    if fault:
        executable = render_synthetic_transaction(candidate, before, scope='synthetic-ci',
                                                   fault=fault, **common)
        injected = re.findall(r'-- CRM_TRANSACTION_CORE_BEGIN\n([\s\S]*?)-- CRM_TRANSACTION_CORE_END', executable)
        marker = re.findall(r'^-- CRM_TRANSACTION_CORE_SHA256:([0-9a-f]{64})$', executable, re.M)
        exception = "RAISE EXCEPTION 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT';"
        require(len(injected) == 1 and injected[0].count(exception) == 1
                and injected[0].replace(exception, '', 1) == cores[0],
                'Rollback experiment differs beyond its exact static after-INSERT fault')
        fault_digest = hashlib.sha256(injected[0].encode('utf8')).hexdigest()
        require(marker == [fault_digest], 'Rollback experiment shared-program hash differs')
    _save(r, label + '-program-proof', dict(core_sha256=expected,
        public_and_test_only_core_bytes_equal=True, independent_extracted_hash=True,
        fault_injection=fault, fault_core_sha256=fault_digest,
        fault_only_difference='STATIC_AFTER_INSERT_EXCEPTION' if fault else None,
        admission='NOT_ADMITTED'))
    (r.output / 'transaction-evidence' / (label + '-public-fenced.sql')).write_text(
        proposal, encoding='utf8')
    return executable


def _save(r, label, value):
    (r.output / 'transaction-evidence' / (label + '.json')).write_text(
        json.dumps(value, indent=2) + '\n', encoding='utf8')


def _unchanged(before, after):
    """Exact stable supplied sections; volatile capture/activity are not state."""
    for key in ('discovery', 'catalog', 'drizzle_history',
                'supabase_manifest_before', 'supabase_manifest_after', 'sequence_state'):
        require(_same(before[key]['result'], after[key]['result']),
                'Rejected transaction changed a stable complete projection: ' + key)
    require(len(before['supabase_pages']) == len(after['supabase_pages'])
            and all(_same(left['result'], right['result'])
                    for left, right in zip(before['supabase_pages'], after['supabase_pages'])),
            'Rejected transaction changed complete Supabase pages')
    for key in ('supabase_manifest_before', 'supabase_manifest_after'):
        require(_same(before[key]['capture']['format_settings'],
                      after[key]['capture']['format_settings']),
                'Supabase commitment format changed')


def _summary(r, name, before, after, outcome, validator, returned=None):
    result = compare(before, after, outcome=outcome, returned_row=returned,
                     validate_projection=validator)
    require(result['admission'] == 'NOT_ADMITTED'
            and result['comparison'] == 'MATCHED_DECLARED_DELTA_REVIEW_ONLY',
            'Transaction comparison claimed admission or failed its declared delta')
    _save(r, name + '-summary', result)
    return result


def _no_execution(response):
    require('TEST_ONLY_DEFAULT_INSERT:' not in response.stdout
            and 'TEST_ONLY_EVENT_TRACE:' not in response.stdout,
            'Rejected transaction attempted a default INSERT or canonical REVOKE')


def _observed_lock(r, db, application):
    """Positive independent pg_locks observation, with no assumed sleep barrier."""
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        rows = json.loads(r.query("SELECT COALESCE(pg_catalog.jsonb_agg("
            "pg_catalog.jsonb_build_object('pid',a.pid,'database',a.datname,"
            "'user',a.usename,'mode',l.mode,'granted',l.granted)), '[]') "
            "FROM pg_catalog.pg_stat_activity a JOIN pg_catalog.pg_locks l ON l.pid=a.pid "
            "WHERE a.application_name='" + application + "' AND l.locktype='relation' "
            "AND l.relation='drizzle.__drizzle_migrations'::regclass;",
            application + '-independent-held-lock', db, user='supabase_admin').stdout)
        if rows:
            require(len(rows) == 1 and rows[0]['database'] == db
                    and rows[0]['user'] == 'postgres'
                    and rows[0]['mode'] == 'ShareRowExclusiveLock'
                    and rows[0]['granted'] is True,
                    'Synthetic contention holder did not own the measured relation lock')
            return rows[0]
        time.sleep(.03)
    raise RuntimeError('Synthetic contention holder lock was not observed')


def _role_profile(r, db, label):
    """Measure only safe role capabilities in this owned disposable cluster."""
    profile = json.loads(r.query("SELECT pg_catalog.jsonb_build_object("
        "'user',CURRENT_USER,'session_user',SESSION_USER,'superuser',rolsuper,"
        "'bypass_rls',rolbypassrls,'create_db',rolcreatedb,'create_role',rolcreaterole,"
        "'replication',rolreplication,'can_login',rolcanlogin,'inherit',rolinherit,"
        "'admin_member',pg_catalog.pg_has_role(CURRENT_USER,'supabase_admin','MEMBER')) "
        "FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER;", label, db).stdout)
    require(profile['user'] == profile['session_user'] == 'postgres'
            and profile['superuser'] is False and profile['admin_member'] is False
            and all(type(profile[key]) is bool for key in ('bypass_rls', 'create_db',
                'create_role', 'replication', 'can_login', 'inherit')),
            'Owned synthetic role profile is not the measured NOSUPERUSER actor')
    return profile


def run_transaction_cases(r):
    start = len(r.result['checks'])
    lane, validator = _CaptureLane(r), ProjectionValidator()
    body = verify_source()['body']
    candidate = (REPOSITORY / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    require(hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256,
            'Transaction case candidate bytes differ')
    entries = json.loads((REPOSITORY / 'drizzle/migrations/meta/_journal.json').read_text(encoding='utf8'))['entries']
    entries = [entry for entry in entries if entry['tag'] == '0021_crm_helpers_owner_only']
    require(len(entries) == 1 and type(entries[0]['when']) is int,
            'Transaction case public journal entry differs')
    when = entries[0]['when']

    with database(r, 'transaction_commit') as db:
        _fixture(r, db, 'transaction-commit', body)
        _context(r, db, 'transaction-commit-context', False)
        before = _capture(lane, validator, db, 'tx-commit-before')
        state_before = _state(r, db, 'transaction-fence-state-before')
        trace_before = _trace(r, db, 'transaction-fence-trace-before')
        compiled = _render(candidate, before, validator, r=r, db=db, label='commit')
        proposal = (lane.output / 'commit-public-fenced.sql').read_text(encoding='utf8')
        response = r.query(proposal, 'transaction-public-proposal-fenced', db, expected=3)
        require(re.search(r'^ERROR:\s+P0001: CRM_TRANSACTION_NOT_ADMITTED$', response.stdout, re.M),
                'Public transaction proposal did not fail at its unconditional fence')
        _no_execution(response)
        fence_after = _capture(lane, validator, db, 'tx-fence-after')
        _unchanged(before, fence_after)
        require(_state(r, db, 'transaction-fence-state-after') == state_before
                and _trace(r, db, 'transaction-fence-trace-after') == trace_before,
                'Public proposal fence changed catalog, events, histories or sequence')
        r.check(TRANSACTION_CASES[0], sqlstate='P0001', before_payload_decode=True,
                no_ddl_no_new_row_no_nextval=True, unconditional_public_fence=True,
                full_before_after_bundles=True, operational_admission='NOT_ADMITTED')

        response = r.query(compiled, 'transaction-commit-apply', db)
        returned = _returning(response.stdout, when)
        _require_revoke_trace(_trace(r, db, 'transaction-commit-trace'), response.stdout)
        after = _capture(lane, validator, db, 'tx-commit-after')
        _summary(r, 'commit', before, after, 'applied', validator, returned)
        state_after = _state(r, db, 'transaction-commit-state-after')
        require(state_before['extensions'] == state_after['extensions'],
                'Transaction commit changed exact public event definitions')
        r.check(TRANSACTION_CASES[1], exact_canonical_sha256=CANONICAL_SHA256,
                actual_default_returning=returned, full_before_after_bundles=True,
                same_statement_pre_post_capture=True, real_draft_schema_validation=True,
                event_definitions_preserved=True, operational_admission='NOT_ADMITTED')

        registered_before = _capture(lane, validator, db, 'tx-registered-before')
        trace_before = _trace(r, db, 'transaction-registered-trace-before')
        response = r.query(_render(candidate, registered_before, validator,
                                  r=r, db=db, label='registered'),
                           'transaction-registered-readonly', db)
        require('TEST_ONLY_TRANSACTION_REGISTERED_READ_ONLY' in response.stdout,
                'Transaction registered branch was not observed')
        _no_execution(response)
        registered_after = _capture(lane, validator, db, 'tx-registered-after')
        _summary(r, 'registered', registered_before, registered_after,
                 'registered_read_only', validator)
        require(_state(r, db, 'transaction-registered-state-after') == state_after
                and _trace(r, db, 'transaction-registered-trace-after') == trace_before,
                'Transaction registered branch changed exact fixture state or DDL trace')
        r.check(TRANSACTION_CASES[2], no_ddl_no_new_row_no_nextval=True,
                full_before_after_bundles=True, same_statement_pre_post_capture=True,
                real_draft_schema_validation=True, event_definitions_preserved=True,
                operational_admission='NOT_ADMITTED')

    with database(r, 'transaction_rollback') as db:
        _fixture(r, db, 'transaction-rollback', body)
        _context(r, db, 'transaction-rollback-context', False)
        before = _capture(lane, validator, db, 'tx-rollback-before')
        original = _state(r, db, 'transaction-rollback-state-before')
        response = r.query(_render(candidate, before, validator, r=r, db=db,
                                  label='rollback', fault='after_insert'),
                           'transaction-rollback-after-default-insert', db, expected=3)
        require(re.search(r'^ERROR:\s+P0001: CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT$', response.stdout, re.M),
                'Transaction rollback did not reach the intended post-INSERT fault')
        returned = _returning(response.stdout, when)
        require(response.stdout.count('TEST_ONLY_EVENT_TRACE:') == 2
                and not _trace(r, db, 'transaction-rollback-trace'),
                'Rollback did not execute two REVOKEs or retained its transactional event trace')
        after = _capture(lane, validator, db, 'tx-rollback-after')
        _summary(r, 'rollback', before, after, 'rolled_back_after_insert', validator, returned)
        require(_state(r, db, 'transaction-rollback-state-after')['extensions'] == original['extensions'],
                'Transaction rollback changed exact public event definitions')
        r.check(TRANSACTION_CASES[3], sqlstate='P0001', insert_returning_observed=True,
                nontransactional_sequence_gap=True, full_before_after_bundles=True,
                same_statement_pre_post_capture=True, real_draft_schema_validation=True,
                event_definitions_preserved=True, operational_admission='NOT_ADMITTED')

    mutations = (
        ('catalog', "COMMENT ON FUNCTION public._crm_empresa_no_borrar_cliente() IS 'TEST_ONLY_STALE_PREIMAGE';"),
        ('drizzle', "UPDATE drizzle.__drizzle_migrations SET hash='" + hashlib.sha256(b'TEST_ONLY_STALE_HISTORY').hexdigest() + "';"),
        ('supabase', "UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['TEST_ONLY_STALE_SUPABASE'];"),
        ('sequence', "SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq'::regclass,"
                     "(SELECT last_value+7 FROM drizzle.__drizzle_migrations_id_seq),true);"),
    )
    for index, (name, sql) in enumerate(mutations, 4):
        with database(r, 'transaction_stale_' + name) as db:
            label = 'transaction-stale-' + name
            _fixture(r, db, label, body)
            baseline = _capture(lane, validator, db, 'tx-stale-' + name + '-baseline')
            # Compile first, then change one owned synthetic preimage. A static
            # Python comparison cannot manufacture this rejection after SQL.
            compiled = _render(candidate, baseline, validator,
                               r=r, db=db, label='stale-' + name)
            r.query(sql, label + '-fixture-change', db)
            observed_before = _capture(lane, validator, db, 'tx-stale-' + name + '-before')
            state_before = _state(r, db, label + '-state-before')
            trace_before = _trace(r, db, label + '-trace-before')
            response = r.query(compiled, label + '-reject', db, expected=3)
            require(re.search(r'^ERROR:\s+P0001: CRM_TRANSACTION_PREIMAGE_', response.stdout, re.M),
                    'Stale transaction preimage did not fail its in-statement guard')
            _no_execution(response)
            observed_after = _capture(lane, validator, db, 'tx-stale-' + name + '-after')
            _unchanged(observed_before, observed_after)
            require(_state(r, db, label + '-state-after') == state_before
                    and _trace(r, db, label + '-trace-after') == trace_before,
                    'Stale-preimage rejection changed exact catalog, events, history or sequence')
            r.check(TRANSACTION_CASES[index], in_statement_preimage_rejection=True,
                    no_ddl_no_new_row_no_nextval=True, full_before_after_bundles=True,
                    real_draft_schema_validation=True, operational_admission='NOT_ADMITTED')

    with database(r, 'transaction_contention') as db:
        _fixture(r, db, 'transaction-contention', body)
        before = _capture(lane, validator, db, 'tx-contention-before')
        state_before = _state(r, db, 'transaction-contention-state-before')
        trace_before = _trace(r, db, 'transaction-contention-trace-before')
        compiled = _render(candidate, before, validator, r=r, db=db, label='contention')
        application = 'test_only_transaction_contention'
        holder = r.session("SET application_name='" + application + "';BEGIN;"
                           'LOCK TABLE ONLY drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE;',
                           'transaction-contention-holder', db)
        try:
            observed = _observed_lock(r, db, application)
            response = r.query(compiled, 'transaction-contention-reject', db, expected=3)
            require(re.search(r'^ERROR:\s+55P03:', response.stdout, re.M),
                    'Transaction relation contention did not reject NOWAIT')
            _no_execution(response)
        finally:
            r.release(holder, 'ROLLBACK;\n\\q')
            r.finish_session(holder, 'transaction-contention-holder')
        after = _capture(lane, validator, db, 'tx-contention-after')
        _unchanged(before, after)
        require(_state(r, db, 'transaction-contention-state-after') == state_before
                and _trace(r, db, 'transaction-contention-trace-after') == trace_before,
                'Relation-lock rejection changed exact fixture state')
        r.check(TRANSACTION_CASES[8], sqlstate='55P03', measured_lock_holder=observed,
                nowait_contention_rejected=True, no_ddl_no_new_row_no_nextval=True,
                full_before_after_bundles=True, real_draft_schema_validation=True,
                operational_admission='NOT_ADMITTED')

    with database(r, 'transaction_broader_profile') as db:
        _fixture(r, db, 'transaction-profile', body)
        original_profile = _role_profile(r, db, 'transaction-profile-original-capabilities')
        changed = ('bypass_rls', 'create_db', 'create_role', 'replication')
        require(all(original_profile[key] is False for key in changed),
                'Owned fixture capabilities changed before the generic profile experiment')
        try:
            # Only the owned fixture bootstrap administrator can adjust these
            # global disposable-cluster attributes. No role membership or grant
            # is added. The original measured values are restored in finally.
            r.query('ALTER ROLE postgres BYPASSRLS CREATEDB CREATEROLE REPLICATION;',
                    'transaction-profile-owned-role-attributes', db, user='supabase_admin')
            profile = _role_profile(r, db, 'transaction-profile-measured-capabilities')
            require(all(profile[key] is True for key in changed)
                    and all(profile[key] == original_profile[key]
                            for key in original_profile if key not in changed),
                    'Broader synthetic actor capabilities differ beyond the declared attributes')
            _context(r, db, 'transaction-profile-context', True)
            r.query("ALTER FUNCTION extensions.pgrst_ddl_watch() SET search_path='';",
                    'transaction-profile-empty-handler-search-path', db)
            _clear_trace(r, db, 'transaction-profile')
            state_before = _state(r, db, 'transaction-profile-state-before')
            handler = next(node for node in state_before['extensions']['functions']
                           if node['proname'] == 'pgrst_ddl_watch')
            require(handler['prosrc'].encode('utf8') == body
                    and len(handler['prosrc'].encode('utf8')) == 729
                    and handler['proconfig'] == ['search_path=""']
                    and handler['prosecdef'] is False,
                    'Generic empty-search-path handler changed the exact public source/profile')
            before = _capture(lane, validator, db, 'tx-profile-before')
            compiled = _render(candidate, before, validator, r=r, db=db, label='profile')
            witness = json.loads((lane.output / 'profile-semantic-witness.json').read_text(encoding='utf8'))
            require(witness['result']['handler'] == {'oid': str(handler['oid']),
                                                     'config': ['search_path=""']},
                    'Auxiliary witness did not observe the actual empty handler search path')
            with _Listener(r, db, 'transaction_profile_listener') as listener:
                response = r.query(compiled, 'transaction-profile-commit', db)
                returning = _returning(response.stdout, when)
                _require_revoke_trace(_trace(r, db, 'transaction-profile-trace'), response.stdout)
                notification = listener.finish_measurement(0)
            after = _capture(lane, validator, db, 'tx-profile-after')
            _summary(r, 'profile', before, after, 'applied', validator, returning)
            require(_state(r, db, 'transaction-profile-state-after')['extensions'] == state_before['extensions']
                    and _role_profile(r, db, 'transaction-profile-post-commit-capabilities') == profile,
                    'Generic profile commit changed event definitions or actor capabilities')
        finally:
            options = dict(bypass_rls='BYPASSRLS', create_db='CREATEDB',
                           create_role='CREATEROLE', replication='REPLICATION')
            restore = 'ALTER ROLE postgres ' + ' '.join(
                option if original_profile[key] else 'NO' + option
                for key, option in options.items()) + ';'
            r.query(restore, 'transaction-profile-restore-owned-role-attributes',
                    db, user='supabase_admin')
            restored_profile = _role_profile(r, db, 'transaction-profile-restored-capabilities')
            require(restored_profile == original_profile,
                    'Owned synthetic actor capabilities were not restored exactly')
        _save(r, 'generic-profile-capabilities', dict(original=original_profile,
            experimental=profile, restored=restored_profile, exact_public_source_octets=729,
            actual_handler_config=handler['proconfig'], admission='NOT_ADMITTED'))
        r.check(TRANSACTION_CASES[9], exact_canonical_sha256=CANONICAL_SHA256,
                actual_default_returning=returning, exact_public_handler_octets=729,
                auxiliary_bindings_checked_in_statement=True, handler_search_path_empty=True,
                broader_nosuperuser_profile_measured=True, role_capabilities_restored=True,
                notification_reload_count=len(notification['notifications_between_controls']),
                full_before_after_bundles=True, event_definitions_preserved=True,
                real_draft_schema_validation=True, operational_admission='NOT_ADMITTED')

    with database(r, 'transaction_stale_binding') as db:
        _fixture(r, db, 'transaction-binding', body)
        baseline = _capture(lane, validator, db, 'tx-binding-baseline')
        compiled = _render(candidate, baseline, validator, r=r, db=db, label='binding')
        original = json.loads((lane.output / 'binding-semantic-witness.json').read_text(encoding='utf8'))
        builtin = next(node for node in original['result']['functions'] if node['proname'] == 'nextval')
        require(builtin['procost'] == 1 and type(builtin['procost']) is int,
                'Owned synthetic builtin cost is not its verified public profile')
        witness_sql = semantic_witness_sql(baseline)

        def observe_binding(phase):
            observation = json.loads(r.query('BEGIN READ ONLY;' + witness_sql + 'COMMIT;',
                                              'transaction-binding-' + phase, db).stdout)
            _save(r, 'binding-' + phase + '-observed', observation)
            return observation

        try:
            # This ALTER is a deliberately stale metadata fixture, not a
            # catalog UPDATE or an invocation of nextval. Only the administrator
            # of the owned network-disabled database performs it. That database
            # is destroyed; its builtin metadata never reaches another database.
            r.query('ALTER FUNCTION pg_catalog.nextval(pg_catalog.regclass) COST 2;',
                    'transaction-binding-owned-stale-cost-fixture', db, user='supabase_admin')
            _clear_trace(r, db, 'transaction-binding')
            observed_before = _capture(lane, validator, db, 'tx-binding-before')
            state_before = _state(r, db, 'transaction-binding-state-before')
            trace_before = _trace(r, db, 'transaction-binding-trace-before')
            binding_before = observe_binding('before')
            stale = next(node for node in binding_before['result']['functions'] if node['proname'] == 'nextval')
            expected_stale = dict(builtin, procost=2)
            require(_same(stale, expected_stale)
                    and _same(observed_before['catalog']['result'], baseline['catalog']['result']),
                    'Stale builtin fixture is not isolated from the existing scoped catalog projection')
            response = r.query(compiled, 'transaction-binding-reject', db, expected=3)
            require(re.search(r'^ERROR:\s+P0001: CRM_TRANSACTION_PREIMAGE_BINDINGS$', response.stdout, re.M),
                    'Stale auxiliary builtin did not fail its separate in-statement binding guard')
            _no_execution(response)
            observed_after = _capture(lane, validator, db, 'tx-binding-after')
            binding_after = observe_binding('after')
            _unchanged(observed_before, observed_after)
            require(_same(binding_before['result'], binding_after['result'])
                    and _state(r, db, 'transaction-binding-state-after') == state_before
                    and _trace(r, db, 'transaction-binding-trace-after') == trace_before,
                    'Stale-builtin rejection changed binding, catalog, history, event trace or sequence')
        finally:
            r.query('ALTER FUNCTION pg_catalog.nextval(pg_catalog.regclass) COST 1;',
                    'transaction-binding-restore-owned-builtin-cost', db, user='supabase_admin')
            restored = observe_binding('restored')
            require(_same(restored['result'], original['result']),
                    'Owned builtin metadata did not restore exactly to its measured original profile')
        r.check(TRANSACTION_CASES[10], in_statement_auxiliary_preimage_rejection=True,
                exact_prior_scoped_catalog_unchanged=True, owned_builtin_metadata_restored=True,
                no_ddl_no_new_row_no_nextval=True, full_before_after_bundles=True,
                real_draft_schema_validation=True, operational_admission='NOT_ADMITTED')

    checks = r.result['checks'][start:]
    require(tuple(item['case'] for item in checks) == TRANSACTION_CASES
            and all(item['status'] == 'pass' for item in checks),
            'Incomplete transaction case matrix')
    bundles = list((lane.output / 'comparator-bundles').glob('*/bundle.json'))
    projections = list((lane.output / 'comparator-bundles').glob('*/projection-*.json'))
    require(len(bundles) == 26 and len(projections) == 208
            and validator.formally_validated == len(projections),
            'Transaction matrix requires 26 complete bundles and 208 real Draft validations')
    r.result.update(transaction_case_count=len(checks), transaction_bundles=len(bundles),
        transaction_formal_projection_count=validator.formally_validated,
        transaction_operational_admission='NOT_ADMITTED',
        transaction_limits=['Owned synthetic fixtures only; no target profile or semantic admission',
                            'Public fence remains unconditional; no operational application mode',
                            'No transport, external actors, DDL/ACL window or full ERP replay proof'])
    r.save()
    return checks
