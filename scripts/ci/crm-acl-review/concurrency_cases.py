"""Disposable-only PostgreSQL concurrency acceptance cases 9–12 and 14.

No database work runs at import time. ``run(r)`` uses only the owning Runner.
Barriers use observed pg_stat_activity/pg_locks, never sleep-based ordering.
An event-trigger barrier executes the exact fixture-bound candidate bytes, but
relaxes lock_timeout *inside the barrier* and restores it afterwards. Explicit
source-injected regression probes and the omitted-COMMIT client test are marked
instrumented and cannot be presented as exact-byte integration evidence.
"""
from contextlib import contextmanager
from copy import deepcopy
import hashlib
import json
import re
import time

FUNCTIONS = (
    'public._crm_empresa_no_borrar_cliente()',
    'public._crm_empresa_no_delete_fisico()',
)
GATE_CLASS = 1837164
GATE_KEY = 51
TARGET_SQL = """
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)
   FROM pg_proc p WHERE p.oid IN
   ('public._crm_empresa_no_borrar_cliente()'::regprocedure,
    'public._crm_empresa_no_delete_fisico()'::regprocedure)),
 'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb)
   FROM pg_trigger t WHERE t.tgfoid IN
   ('public._crm_empresa_no_borrar_cliente()'::regprocedure,
    'public._crm_empresa_no_delete_fisico()'::regprocedure)));
"""


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def response_json(response):
    """psql -qAt may emit notices; accept exactly one JSON-valued output line."""
    found = []
    for line in response.stdout.splitlines():
        try:
            found.append(json.loads(line))
        except (ValueError, TypeError):
            continue
    require(len(found) == 1, 'Expected exactly one JSON result: ' + response.stdout)
    return found[0]


def sqlstate(response):
    match = re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):', response.stdout)
    return match.group(1) if match else None


def rejected(response, label, marker=None, state=None):
    require(response.returncode != 0, label + ': migration silently succeeded')
    found = sqlstate(response)
    require(found is not None, label + ': missing SQLSTATE in error evidence')
    if marker:
        require(marker in response.stdout, label + ': unexpected error ' + response.stdout)
    if state:
        require(found == state, label + ': unexpected SQLSTATE ' + str(found))
    return found


def normalized_snapshot(value):
    """Clones preserve fixture object OIDs; only pg_shdepend.dbid differs."""
    value = deepcopy(value)
    for item in value.get('pg_shdepend', []):
        item['dbid'] = '<fixture-database>'
    return value


@contextmanager
def case_database(r, label):
    suffix = label.replace('-', '_')
    # PostgreSQL identifiers are limited to 63 bytes. Preserve uniqueness when
    # long evidence labels need a shorter database identifier.
    if len(suffix) > 47:
        suffix = suffix[:38] + '_' + hashlib.sha256(label.encode()).hexdigest()[:8]
    db = r.clone(suffix)
    require(re.fullmatch(r'crm_acl_fixture_[a-zA-Z0-9_]+', db),
            'Refusing non-fixture database name: ' + str(db))
    try:
        yield db
    except BaseException:
        # Preserve failed-case evidence until the owner's cluster cleanup.
        raise
    else:
        r.query('DROP DATABASE "' + db + '";', label + '-drop-fixture')


def target_state(r, db, label):
    return response_json(r.query(TARGET_SQL, label, db))


def observed_state(r, db, app, label):
    return response_json(r.query("""
SELECT coalesce((SELECT jsonb_build_object(
 'pid',a.pid,'state',a.state,'wait_event_type',a.wait_event_type,
 'wait_event',a.wait_event,'blockers',pg_blocking_pids(a.pid),
 'locks',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb)
          FROM pg_locks l WHERE l.pid=a.pid))
 FROM pg_stat_activity a WHERE a.datname=current_database()
 AND a.application_name=""" + literal(app) + ") ,'null'::jsonb);", label, db, user='supabase_admin'))


def wait_state(r, db, app, label, allow_wait=False, timeout=12):
    """Observe actual completion/lock state, with a deadline rather than sleeps."""
    deadline = time.monotonic() + timeout
    count = 0
    while time.monotonic() < deadline:
        count += 1
        state = observed_state(r, db, app, label + '-observe-' + str(count))
        if state and state['state'] == 'idle in transaction':
            return state
        if allow_wait and state and state['wait_event_type'] == 'Lock':
            require(any(not lock['granted'] for lock in state['locks']),
                    label + ': activity said Lock without an ungranted pg_lock')
            return state
    raise AssertionError(label + ': session never reached the required observed state')


def begin_session(r, db, app, statements, user='postgres'):
    return r.session('SET application_name = ' + literal(app) + ';\nBEGIN;\n'
                     "SET LOCAL statement_timeout = '45s';\n" + statements + '\n',
                     app, db, user=user)


def start_candidate(r, db, app, candidate=None):
    return r.session('SET application_name = ' + literal(app) + ';\n' +
                     (r.candidate if candidate is None else candidate), app, db)


def finish_transaction(r, process, label, commit=True):
    r.release(process, 'COMMIT;\n' if commit else 'ROLLBACK;\n')
    return r.finish_session(process, label)


def gate_holder(r, db, label):
    process = begin_session(r, db, label,
        f'SELECT pg_advisory_xact_lock({GATE_CLASS},{GATE_KEY});')
    state = wait_state(r, db, label, label + '-ready')
    require(any(lock['locktype'] == 'advisory' and lock['granted']
                for lock in state['locks']), label + ': missing granted gate lock')
    return process


def barrier_sql(app, point):
    require(point in (1, 2), 'Only the two real REVOKE points are supported')
    return """
CREATE SCHEMA crm_acl_ci_barrier;
CREATE FUNCTION crm_acl_ci_barrier.pause_revoke() RETURNS event_trigger
LANGUAGE plpgsql AS $ci$
DECLARE n integer; saved_timeout text;
BEGIN
 IF current_setting('application_name') <> APP_LITERAL THEN RETURN; END IF;
 n := coalesce(nullif(current_setting('crm_acl_ci_barrier.revoke_count',true),''),'0')::integer + 1;
 PERFORM set_config('crm_acl_ci_barrier.revoke_count',n::text,true);
 IF n = POINT_NUMBER THEN
   saved_timeout := current_setting('lock_timeout');
   PERFORM set_config('lock_timeout','0',true);
   PERFORM pg_advisory_xact_lock(GATE_CLASS_NUMBER,GATE_KEY_NUMBER);
   PERFORM set_config('lock_timeout',saved_timeout,true);
 END IF;
END
$ci$;
CREATE EVENT TRIGGER crm_acl_ci_pause ON ddl_command_end WHEN TAG IN ('REVOKE')
EXECUTE FUNCTION crm_acl_ci_barrier.pause_revoke();
""".replace('APP_LITERAL', literal(app)).replace('POINT_NUMBER', str(point)).replace(
        'GATE_CLASS_NUMBER', str(GATE_CLASS)).replace('GATE_KEY_NUMBER', str(GATE_KEY))


def install_barrier(r, db, app, point, label):
    r.query(barrier_sql(app, point), label + '-install-barrier', db, user='supabase_admin')


def remove_barrier(r, db, label):
    r.query('DROP EVENT TRIGGER crm_acl_ci_pause; DROP SCHEMA crm_acl_ci_barrier CASCADE;',
            label + '-remove-barrier', db, user='supabase_admin')


def assert_barrier(r, db, app):
    trace = r.wait_lock(app, db)
    state = observed_state(r, db, app, app + '-gate-proof')
    require(state and state['wait_event_type'] == 'Lock', app + ': no observed lock wait')
    require(any(lock['locktype'] == 'advisory' and not lock['granted']
                and str(lock['classid']) == str(GATE_CLASS)
                and str(lock['objid']) == str(GATE_KEY) for lock in state['locks']),
            app + ': did not wait at the intended barrier')
    return trace


def assert_owner_only(r, db, label):
    response = response_json(r.query("""
SELECT to_jsonb(count(*) = 2 AND bool_and(proacl = ARRAY['postgres=X/postgres']::aclitem[]))
FROM pg_proc WHERE oid IN
 ('public._crm_empresa_no_borrar_cliente()'::regprocedure,
  'public._crm_empresa_no_delete_fisico()'::regprocedure);
""", label, db))
    require(response is True, label + ': expected both owner-only ACLs')


def expected_snapshot(r, label, sql, user='postgres', candidate_first=False):
    with case_database(r, label + '-reference') as db:
        if candidate_first:
            r.query(r.candidate, label + '-reference-candidate', db)
        r.query(sql, label + '-reference-mutation', db, user=user)
        return normalized_snapshot(r.snapshot(db, label + '-expected'))


def mutation(kind, function):
    if kind == 'cost':
        return 'ALTER FUNCTION ' + function + ' COST 101;'
    if kind == 'body':
        # Preserve every pg_proc property other than body: dynamic replacement
        # uses the fixture's exact definition and inserts a harmless sentinel.
        return """DO $m$ DECLARE definition text; BEGIN
 definition := pg_get_functiondef(""" + literal(function) + """::regprocedure);
 EXECUTE replace(definition, 'BEGIN', 'BEGIN'||chr(10)||'-- CRM_ACL_CI_EXTERNAL_BODY'||chr(10));
END $m$;"""
    if kind == 'acl':
        return 'GRANT EXECUTE ON FUNCTION ' + function + ' TO authenticated;'
    if kind == 'owner':
        return 'ALTER FUNCTION ' + function + ' OWNER TO authenticated;'
    if kind == 'grant':
        return 'GRANT EXECUTE ON FUNCTION ' + function + ' TO service_role;'
    if kind == 'revoke':
        return 'REVOKE EXECUTE ON FUNCTION ' + function + ' FROM postgres;'
    if kind == 'drop':
        return 'DROP FUNCTION ' + function + ' CASCADE;'
    raise ValueError('Unknown mutation: ' + kind)



def cooperative_lock_keys(candidate):
    matches = re.findall(r'pg_try_advisory_xact_lock\(\s*(\d+)\s*,\s*(\d+)\s*\)', candidate)
    require(len(matches) == 1, 'Expected one concrete cooperative advisory key pair in bound candidate')
    keys = tuple(int(value) for value in matches[0])
    require(all(0 <= key < 2**31 for key in keys), 'Advisory key is outside int4 range')
    return keys

def case9(r):
    key1, key2 = cooperative_lock_keys(r.candidate)
    for kind, sql, marker, state in (
        ('advisory', f'SELECT pg_advisory_xact_lock({key1},{key2});', 'CRM_ACL_BUSY', 'P0001'),
        ('table-ddl', 'LOCK TABLE public.crm_empresas IN ACCESS EXCLUSIVE MODE;', None, '55P03'),
    ):
        label = 'c09-' + kind
        with case_database(r, label) as db:
            before = r.snapshot(db, label + '-before')
            holder = begin_session(r, db, label + '-holder', sql)
            proof = wait_state(r, db, label + '-holder', label + '-ready')
            result = r.query(r.candidate, label + '-migration', db, expected=None)
            error = rejected(result, label, marker, state)
            require(r.snapshot(db, label + '-after') == before, label + ': partial change')
            finish_transaction(r, holder, label + '-holder-end', commit=False)
            r.check(label, sqlstate=error, lock_evidence=proof, exact_candidate_bytes=True)
    label = 'c09-rowexclusive-compatible'
    with case_database(r, label) as db:
        before = r.snapshot(db, label + '-before')
        holder = begin_session(r, db, label + '-holder', """
INSERT INTO public.crm_empresas(organization_id,nombre)
VALUES('00000000-0000-0000-0000-000000000001','synthetic concurrent DML');
""")
        proof = wait_state(r, db, label + '-holder', label + '-ready')
        require(any(lock['mode'] == 'RowExclusiveLock' and lock['granted']
                    for lock in proof['locks']), label + ': missing DML relation lock')
        r.query(r.candidate, label + '-migration', db)
        assert_owner_only(r, db, label + '-owner-only')
        finish_transaction(r, holder, label + '-holder-end', commit=False)
        after = r.snapshot(db, label + '-after')
        from cases import semantic
        require(semantic(before) == semantic(after), label + ': unexpected full-catalog metadata change')
        r.check(label, lock_evidence=proof, exact_candidate_bytes=True, full_metadata_preserved=True)


def case10(r):
    for index, function in enumerate(FUNCTIONS, 1):
        for kind in ('body', 'cost', 'acl'):
            label = f'c10-function-{index}-{kind}'
            change = mutation(kind, function)
            expected = expected_snapshot(r, label, change)
            with case_database(r, label) as db:
                r.snapshot(db, label + '-before')
                holder = begin_session(r, db, label + '-competitor', change)
                wait_state(r, db, label + '-competitor', label + '-competitor-ready')
                migration = start_candidate(r, db, label + '-migration')
                proof = r.wait_lock(label + '-migration', db)
                finish_transaction(r, holder, label + '-competitor-commit')
                result = r.finish_session(migration, label + '-migration-result', expected=None)
                error = rejected(result, label)
                actual = normalized_snapshot(r.snapshot(db, label + '-after'))
                require(actual == expected, label + ': migration failed to fully roll back or lost external change')
                r.check(label, sqlstate=error, lock_evidence=proof,
                        first_revoke_rollback=(index == 2), exact_candidate_bytes=True)


def case11(r):
    # At point one only the first helper has been updated; there is no claim
    # that the unvisited second helper is already locked.
    scenarios = [(False, point, index, kind)
                 for point, index in ((1, 0), (2, 0), (2, 1))
                 for kind in ('cost', 'body', 'owner', 'grant', 'revoke', 'drop')]
    # REVOKE on an already owner-only ACL must also serialize real changes.
    scenarios += [(True, point, index, kind)
                  for point, index in ((1, 0), (2, 1)) for kind in ('cost', 'grant')]
    for replay, point, index, kind in scenarios:
        label = f"c11-{'replay-' if replay else ''}revoke-{point}-function-{index + 1}-{kind}"
        change = mutation(kind, FUNCTIONS[index])
        expected = expected_snapshot(r, label, change,
                                     user='supabase_admin' if kind == 'owner' else 'postgres',
                                     candidate_first=True)
        with case_database(r, label) as db:
            if replay:
                r.query(r.candidate, label + '-owner-only-setup', db)
            r.snapshot(db, label + '-before')
            app = label + '-migration'
            gate = gate_holder(r, db, label + '-gate')
            install_barrier(r, db, app, point, label)
            migration = start_candidate(r, db, app)
            assert_barrier(r, db, app)
            competitor = begin_session(r, db, label + '-competitor', change,
                                       user='supabase_admin' if kind == 'owner' else 'postgres')
            proof = r.wait_lock(label + '-competitor', db)
            finish_transaction(r, gate, label + '-open-gate')
            r.finish_session(migration, label + '-migration-result')
            wait_state(r, db, label + '-competitor', label + '-competitor-ready')
            # The competing transaction is still uncommitted: owner-only
            # state must already be visible from a third connection.
            assert_owner_only(r, db, label + '-migration-committed-first')
            finish_transaction(r, competitor, label + '-competitor-commit')
            remove_barrier(r, db, label)
            actual = normalized_snapshot(r.snapshot(db, label + '-after'))
            require(actual == expected, label + ': incorrect serialization/final state')
            r.check(label, lock_evidence=proof, candidate_committed_first=True,
                    exact_candidate_bytes=True, event_trigger_barrier=True,
                    replay_owner_only=replay, later_authorized_change_outside_invariant=True)


def assert_extra_trigger_delta(before, after, trigger_class, relation_class):
    """Allow precisely CREATE TRIGGER's new row/dependencies/relhastriggers.

    Derive every expected trigger/dependency field from the existing equivalent
    BEFORE DELETE trigger; substitute only its new OID, name and target table.
    No global OID normalization or broad catalog-section exclusions are used.
    """
    expected = deepcopy(before)
    table = next(row for row in before['pg_class'] if row['relname'] == 'crm_acl_ci_other')
    require(table['relhastriggers'] is False, 'Extra-trigger fixture already had triggers')
    template = next(row for row in before['pg_trigger']
                    if row['tgname'] == 'trg_crm_empresa_no_delete_fisico')
    added = [row for row in after['pg_trigger'] if row['tgname'] == 'crm_acl_ci_extra']
    require(len(added) == 1, 'Expected exactly one committed extra trigger')
    new = added[0]
    require(new['oid'] not in {row['oid'] for row in before['pg_trigger']},
            'Extra trigger reused an existing trigger OID')
    expected_trigger = dict(template, oid=new['oid'], tgname='crm_acl_ci_extra', tgrelid=table['oid'])
    require(new == expected_trigger, 'Unexpected extra-trigger metadata')
    expected['pg_trigger'].append(expected_trigger)
    expected['pg_trigger'].sort(key=lambda row: int(row['oid']))
    dependencies = [row for row in before['pg_depend']
                    if str(row['classid']) == str(trigger_class) and row['objid'] == template['oid']]
    require(dependencies, 'Template trigger dependencies were not captured')
    for row in dependencies:
        changed = dict(row, objid=new['oid'])
        if str(row['refclassid']) == str(relation_class) and row['refobjid'] == template['tgrelid']:
            changed['refobjid'] = table['oid']
        expected['pg_depend'].append(changed)
    expected['pg_depend'].sort(key=lambda row: tuple(int(row[key]) for key in
        ('classid', 'objid', 'objsubid', 'refclassid', 'refobjid', 'refobjsubid')) + (row['deptype'],))
    for row in expected['pg_class']:
        if row['oid'] == table['oid']:
            row['relhastriggers'] = True
    require(after == expected, 'Extra-trigger final full-catalog diff contained unexpected changes')

def case12(r):
    label = 'c12-existing-trigger-change'
    change = 'ALTER TABLE public.crm_empresas DISABLE TRIGGER trg_crm_empresa_no_borrar_cliente;'
    expected = expected_snapshot(r, label, r.candidate + '\n' + change)
    with case_database(r, label) as db:
        r.snapshot(db, label + '-before')
        app = label + '-migration'
        gate = gate_holder(r, db, label + '-gate')
        install_barrier(r, db, app, 1, label)
        migration = start_candidate(r, db, app)
        assert_barrier(r, db, app)
        competitor = begin_session(r, db, label + '-competitor', change)
        proof = r.wait_lock(label + '-competitor', db)
        finish_transaction(r, gate, label + '-open-gate')
        r.finish_session(migration, label + '-migration-result')
        wait_state(r, db, label + '-competitor', label + '-competitor-ready')
        assert_owner_only(r, db, label + '-migration-committed-first')
        finish_transaction(r, competitor, label + '-competitor-commit')
        remove_barrier(r, db, label)
        require(normalized_snapshot(r.snapshot(db, label + '-after')) == expected,
                label + ': incorrect final metadata')
        r.check(label, lock_evidence=proof, exact_candidate_bytes=True, event_trigger_barrier=True)

    label = 'c12-extra-trigger-different-table'
    with case_database(r, label) as db:
        r.query('CREATE TABLE public.crm_acl_ci_other (id integer);', label + '-other-table', db)
        r.snapshot(db, label + '-before')
        app = label + '-migration'
        gate = gate_holder(r, db, label + '-gate')
        install_barrier(r, db, app, 2, label)
        with_barrier = r.snapshot(db, label + '-before-with-barrier')
        catalog_ids = response_json(r.query(
            "SELECT jsonb_build_object('trigger','pg_trigger'::regclass::oid,'relation','pg_class'::regclass::oid);",
            label + '-catalog-identities', db))
        migration = start_candidate(r, db, app)
        assert_barrier(r, db, app)
        competitor = begin_session(r, db, label + '-competitor', """
CREATE TRIGGER crm_acl_ci_extra BEFORE DELETE ON public.crm_acl_ci_other
FOR EACH ROW EXECUTE FUNCTION public._crm_empresa_no_delete_fisico();
""")
        observed = wait_state(r, db, label + '-competitor', label + '-race', allow_wait=True)
        if observed['wait_event_type'] == 'Lock':
            # PostgreSQL may serialize a dependency operation. Prove ordering
            # and characterize it without claiming a global dependency freeze.
            finish_transaction(r, gate, label + '-open-gate')
            r.finish_session(migration, label + '-migration-result')
            wait_state(r, db, label + '-competitor', label + '-competitor-ready')
            assert_owner_only(r, db, label + '-migration-committed-first')
            migrated = r.snapshot(db, label + '-migration-before-external-commit')
            from cases import semantic
            require(semantic(with_barrier) == semantic(migrated),
                    label + ': migration changed unexpected full-catalog metadata')
            finish_transaction(r, competitor, label + '-competitor-commit')
            external = r.snapshot(db, label + '-external-committed-with-barrier')
            assert_extra_trigger_delta(migrated, external, catalog_ids['trigger'], catalog_ids['relation'])
            outcome = 'extra_link_serialized_after_migration'
            error = None
        else:
            finish_transaction(r, competitor, label + '-competitor-commit')
            expected = r.snapshot(db, label + '-expected-external-link-with-barrier')
            finish_transaction(r, gate, label + '-open-gate')
            result = r.finish_session(migration, label + '-migration-result', expected=None)
            error = rejected(result, label, 'CRM_ACL_CONCURRENT_METADATA_DRIFT')
            require(r.snapshot(db, label + '-rollback-with-barrier') == expected,
                    label + ': full-catalog rollback lost external link or left unintended changes')
            outcome = 'concurrent_extra_link_detected_and_rolled_back'
        remove_barrier(r, db, label)
        r.snapshot(db, label + '-after')
        r.check(label, outcome=outcome, sqlstate=error, lock_evidence=observed,
                exact_candidate_bytes=True, event_trigger_barrier=True,
                full_metadata_preserved=True,
                bounded_guarantee='No broad exclusion of future dependencies is asserted')


def without_commit(candidate):
    require(candidate.rstrip().endswith('COMMIT;'), 'Expected final standalone COMMIT')
    return candidate.rstrip()[:-len('COMMIT;')] + '\n'


def injected_pre_snapshot_gate(candidate):
    anchor = '  END LOOP;\n'
    require(anchor in candidate and 'INTO before_rows' in candidate,
            'Candidate preflight structure changed: review instrumentation')
    first_end = candidate.index(anchor) + len(anchor)
    require(candidate.index('INTO before_rows') > first_end,
            'Candidate snapshot ordering changed: review instrumentation')
    injection = ("  -- CI INSTRUMENTATION ONLY: preflight race barrier.\n"
                 "  PERFORM set_config('lock_timeout','0',true);\n"
                 f'  PERFORM pg_advisory_xact_lock({GATE_CLASS},{GATE_KEY});\n'
                 "  PERFORM set_config('lock_timeout','3s',true);\n")
    return candidate[:first_end] + injection + candidate[first_end:]


def pre_snapshot_regressions(r):
    instrumented = injected_pre_snapshot_gate(r.candidate)
    for index, function in enumerate(FUNCTIONS, 1):
        label = f'c10-instrumented-pre-snapshot-cost-{index}'
        change = mutation('cost', function)
        expected = expected_snapshot(r, label, change)
        with case_database(r, label) as db:
            r.snapshot(db, label + '-before')
            gate = gate_holder(r, db, label + '-gate')
            app = label + '-migration'
            migration = start_candidate(r, db, app, instrumented)
            proof = assert_barrier(r, db, app)
            r.query(change, label + '-external-commit', db)
            finish_transaction(r, gate, label + '-open-gate')
            result = r.finish_session(migration, label + '-migration-result', expected=None)
            error = rejected(result, label, 'CRM_ACL_CONCURRENT_METADATA_DRIFT')
            require(normalized_snapshot(r.snapshot(db, label + '-after')) == expected,
                    label + ': failed rollback/external COST retention')
            r.check(label, sqlstate=error, lock_evidence=proof, exact_candidate_bytes=False,
                    instrumented_candidate_sha256=hashlib.sha256(instrumented.encode()).hexdigest(),
                    purpose='Regression for change committed after validation and before preservation snapshot')



def mutation_event_sql(app, point, change):
    require(point in (1, 2), 'Invalid event trigger point')
    return """
CREATE SCHEMA crm_acl_ci_barrier;
CREATE FUNCTION crm_acl_ci_barrier.mutate_revoke() RETURNS event_trigger
LANGUAGE plpgsql AS $ci$
DECLARE n integer;
BEGIN
 IF current_setting('application_name') <> APP_LITERAL THEN RETURN; END IF;
 n := coalesce(nullif(current_setting('crm_acl_ci_barrier.revoke_count',true),''),'0')::integer + 1;
 PERFORM set_config('crm_acl_ci_barrier.revoke_count',n::text,true);
 IF n = POINT_NUMBER THEN
   MUTATION_SQL
 END IF;
END
$ci$;
CREATE EVENT TRIGGER crm_acl_ci_pause ON ddl_command_end WHEN TAG IN ('REVOKE')
EXECUTE FUNCTION crm_acl_ci_barrier.mutate_revoke();
""".replace('APP_LITERAL', literal(app)).replace('POINT_NUMBER', str(point)).replace(
        'MUTATION_SQL', change)


def case13(r):
    for point in (1, 2):
        for kind in ('body', 'cost'):
            label = f'c13-event-revoke-{point}-{kind}'
            with case_database(r, label) as db:
                app = label + '-migration'
                r.query(mutation_event_sql(app, point, mutation(kind, FUNCTIONS[point - 1])),
                        label + '-install-event', db, user='supabase_admin')
                before = r.snapshot(db, label + '-before')
                result = r.query('SET application_name=' + literal(app) + ';\n' + r.candidate,
                                 label + '-migration', db, expected=None)
                error = rejected(result, label, 'CRM_ACL_CONCURRENT_METADATA_DRIFT')
                require(r.snapshot(db, label + '-after') == before,
                        label + ': event mutation or partial ACL persisted')
                remove_barrier(r, db, label)
                r.check(label, sqlstate=error, exact_candidate_bytes=True,
                        synthetic_event_trigger_mutation=True, complete_rollback=True)
    label = 'c13-event-exception-second-revoke'
    with case_database(r, label) as db:
        app = label + '-migration'
        r.query(mutation_event_sql(app, 2,
            "RAISE EXCEPTION 'CRM_ACL_CI_SECOND_REVOKE_FAILURE';"),
            label + '-install-event', db, user='supabase_admin')
        before = r.snapshot(db, label + '-before')
        result = r.query('SET application_name=' + literal(app) + ';\n' + r.candidate,
                         label + '-migration', db, expected=None)
        error = rejected(result, label, 'CRM_ACL_CI_SECOND_REVOKE_FAILURE', 'P0001')
        require(r.snapshot(db, label + '-after') == before,
                label + ': second REVOKE exception did not roll back first')
        remove_barrier(r, db, label)
        r.check(label, sqlstate=error, exact_candidate_bytes=True,
                synthetic_event_trigger_exception=True, first_revoke_rollback=True)


def characterize_acl_normalization(r):
    """F2 is a bounded-guarantee observation, never a blanket rejection PASS."""
    instrumented = injected_pre_snapshot_gate(r.candidate)
    for index, function in enumerate(FUNCTIONS, 1):
        label = f'f2-pre-snapshot-grant-option-{index}'
        change = 'GRANT EXECUTE ON FUNCTION ' + function + ' TO service_role WITH GRANT OPTION;'
        rejected_expected = expected_snapshot(r, label + '-rejected', change)
        normalized_expected = expected_snapshot(r, label + '-normalized', r.candidate)
        with case_database(r, label) as db:
            r.snapshot(db, label + '-before')
            gate = gate_holder(r, db, label + '-gate')
            app = label + '-migration'
            migration = start_candidate(r, db, app, instrumented)
            proof = assert_barrier(r, db, app)
            r.query(change, label + '-external-commit', db)
            finish_transaction(r, gate, label + '-open-gate')
            result = r.finish_session(migration, label + '-migration-result', expected=None)
            actual = normalized_snapshot(r.snapshot(db, label + '-after'))
            if result.returncode == 0:
                assert_owner_only(r, db, label + '-final-owner-only')
                require(actual == normalized_expected, label + ': unexpected metadata change')
                r.check(label, status='observed_limit',
                        outcome='Concurrent service_role grant option was normalized, not rejected',
                        strict_concurrent_acl_rejection=False, final_acl_owner_only=True,
                        production_requires_new_operational_ddl_window=True,
                        exact_candidate_bytes=False, lock_evidence=proof,
                        instrumented_candidate_sha256=hashlib.sha256(instrumented.encode()).hexdigest())
            else:
                error = rejected(result, label)
                require(actual == rejected_expected, label + ': external ACL change lost on rollback')
                r.check(label, outcome='Concurrent grant option rejected with external change retained',
                        sqlstate=error, exact_candidate_bytes=False, lock_evidence=proof,
                        instrumented_candidate_sha256=hashlib.sha256(instrumented.encode()).hexdigest())

def case14(r):
    for point in (1, 2):
        for failure in ('cancel-statement', 'connection-loss', 'statement-timeout'):
            label = f'c14-revoke-{point}-{failure}'
            with case_database(r, label) as db:
                before = r.snapshot(db, label + '-before')
                app = label + '-migration'
                gate = gate_holder(r, db, label + '-gate')
                install_barrier(r, db, app, point, label)
                migration = start_candidate(r, db, app)
                proof = assert_barrier(r, db, app)
                if failure != 'statement-timeout':
                    fn = 'pg_cancel_backend' if failure == 'cancel-statement' else 'pg_terminate_backend'
                    result = response_json(r.query('SELECT to_jsonb(' + fn + '(pid)) '
                        'FROM pg_stat_activity WHERE datname=current_database() AND application_name='
                        + literal(app) + ';', label + '-interrupt', db, user='supabase_admin'))
                    require(result is True, label + ': interruption was not accepted')
                # For timeout the original candidate's 20s timer is allowed to
                # fire; a real lock wait established the point, not a sleep.
                result = r.finish_session(migration, label + '-migration-result', expected=None)
                error = rejected(result, label, state='57P01' if failure == 'connection-loss' else '57014')
                finish_transaction(r, gate, label + '-release-gate', commit=False)
                remove_barrier(r, db, label)
                require(r.snapshot(db, label + '-after') == before, label + ': partial ACL/metadata')
                r.check(label, sqlstate=error, lock_evidence=proof,
                        exact_candidate_bytes=True, event_trigger_barrier=True)

    for index, function in enumerate(FUNCTIONS, 1):
        label = f'c14-lock-timeout-function-{index}'
        with case_database(r, label) as db:
            before = r.snapshot(db, label + '-before')
            holder = begin_session(r, db, label + '-holder', mutation('cost', function))
            wait_state(r, db, label + '-holder', label + '-holder-ready')
            migration = start_candidate(r, db, label + '-migration')
            proof = r.wait_lock(label + '-migration', db)
            result = r.finish_session(migration, label + '-migration-result', expected=None)
            error = rejected(result, label, state='55P03')
            finish_transaction(r, holder, label + '-holder-rollback', commit=False)
            require(r.snapshot(db, label + '-after') == before, label + ': partial ACL/metadata')
            r.check(label, sqlstate=error, lock_evidence=proof, exact_candidate_bytes=True)

    label = 'c14-client-exit-before-commit'
    with case_database(r, label) as db:
        before = r.snapshot(db, label + '-before')
        migration = start_candidate(r, db, label + '-migration', without_commit(r.candidate))
        proof = wait_state(r, db, label + '-migration', label + '-completed-uncommitted')
        r.release(migration, chr(92) + 'q' + chr(10))
        r.finish_session(migration, label + '-client-exit')
        require(r.snapshot(db, label + '-after') == before, label + ': disconnect failed to roll back')
        r.check(label, lock_evidence=proof, exact_candidate_bytes=False,
                instrumentation='Original transaction body; final COMMIT intentionally withheld; psql exits')

    for kind, prefix in (
        ('current-user', 'SET ROLE authenticated;\n'),
        ('repeatable-read', "SET default_transaction_isolation = 'repeatable read';\n"),
        ('serializable', "SET default_transaction_isolation = 'serializable';\n"),
    ):
        label = 'c14-context-' + kind
        with case_database(r, label) as db:
            before = r.snapshot(db, label + '-before')
            result = r.query(prefix + r.candidate, label + '-migration', db,
                             user='supabase_admin' if kind == 'current-user' else 'postgres',
                             expected=None)
            error = rejected(result, label, 'CRM_ACL_CONTEXT_MISMATCH', 'P0001')
            require(r.snapshot(db, label + '-after') == before, label + ': partial change')
            r.check(label, sqlstate=error, exact_candidate_bytes=True)


def run(r):
    """Fail closed on missing synchronization, missing rejection, or state drift."""
    case9(r)
    case10(r)
    case11(r)
    case12(r)
    case13(r)
    case14(r)
    pre_snapshot_regressions(r)
    characterize_acl_normalization(r)


run_concurrency_cases = run
