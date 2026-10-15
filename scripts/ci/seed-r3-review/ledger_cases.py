"""LAB ONLY. Import is inert. run_ledger_cases needs the reviewed owned Runner.

No DSN, remote credentials, subprocess launch or business invocation API.
Uses the frozen R3 Session lifecycle; all evidence remains pending until outer
container shutdown/removal. This subset does not certify L15 exclusion or any
production transport. PostgreSQL runtime is never implied by offline tests.
"""
import copy
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
R3_HASH = '7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86'
TEST_WHEN = 1900000000000
SIG_NAMES = {'_seed_demo_limpiar_financiero', 'seed_demo_organization_core', 'seed_demo_organization', 'seed_demo_organization_guarded'}
CASE_NAMES = ('clean', 'adopt', 'version_collision', 'hash_collision_older', 'hash_collision_newer', 'registered_historical', 'duplicate_identity', 'metadata_drift', 'insert_fault', 'trigger', 'deferred_trigger', 'deferred_outer', 'supabase_drift')
FAULT = 'LAB_INSERT_FAULT_AFTER_FOUR_STOPPED'
COLLISION = 'LEDGER_PREFLIGHT: duplicate or conflicting new identity'
HISTORICAL = 'LEDGER_PREFLIGHT: existing registration requires exact stopped postimage; refuse historical reinstatement'
TRIGGER = 'LEDGER_PREFLIGHT: ledger triggers/rules/expression or partial indexes are outside reviewed contract'


def require(value, message):
    if not value:
        raise AssertionError(message)


def stable_digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def transactional(witness):
    value = copy.deepcopy(witness)
    value.pop('sequence_state')
    return value


def logical(witness, target_oids):
    value = transactional(witness)
    for item in value['base']['functions']:
        if int(item['row']['oid']) in target_oids:
            item.pop('xmin', None)
            item.pop('ctid', None)
    return value


def verify_rollback(before, after):
    require(transactional(before) == transactional(after), 'Transactional witness changed after rejection')
    return {'before': before['sequence_state'], 'after': after['sequence_state'],
            'sequence_is_nontransactional': True}


def verify_history(before, after, migration_hash, when):
    expected_history = before['rows']
    new = [r for r in after['rows'] if r['hash'] == migration_hash and r['created_at'] == when]
    require(len(new) == 1, 'Exactly one canonical identity required')
    require([r for r in after['rows'] if r not in new] == expected_history, 'Historical full rows or multiplicities changed')
    require(len(after['rows']) == len(expected_history) + 1, 'Ledger cardinality changed')
    require(before['metadata'] == after['metadata'], 'Drizzle metadata changed')
    require(before['details'] == after['details'], 'Detailed ledger/sequence/Supabase metadata changed')
    require(before['supabase_digest'] == after['supabase_digest'], 'Supabase digest changed')


def finalize_ledger_result(result):
    """Called by enclosing adapter only AFTER its owned-cluster cleanup."""
    require(result.get('ledger_cases') == 'checks_pass_cleanup_pending', 'Ledger checks incomplete')
    require(result.get('cleanup') == 'confirmed_stopped_and_removed'
            and result.get('pg_status_3_and_no_pid') is True
            and result.get('owned_psql_clients_closed') is True, 'Cleanup is unconfirmed')
    require(tuple(case['case'] for case in result['ledger_checks']) == CASE_NAMES, 'Missing/duplicate/unexpected ledger case')
    for case in result['ledger_checks']:
        require(case.get('case_database_cleanup') == 'confirmed', 'Case cleanup unconfirmed')
        require(case['status'] == 'checks_pass_cleanup_pending', 'Case not verified')
    for case in result['ledger_checks']:
        case['status'] = 'PASS'
    result['ledger_cases'] = 'PASS'


def metadata_sql(source):
    match = re.search(r'\$ledger_metadata_sql\$(.*?)\$ledger_metadata_sql\$', source, re.S)
    require(match is not None, 'Reviewed metadata query absent')
    return match.group(1) + ';'


# PostgreSQL sequences expose scalar columns but no composite row type: do not
# pass their whole-row variable to to_jsonb (PG17 raises 42809).
SEQUENCE_STATE_SQL = "SELECT jsonb_build_object('last_value',s.last_value,'log_cnt',s.log_cnt,'is_called',s.is_called) FROM drizzle.__drizzle_migrations_id_seq s;"
ROWS_SQL = "SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM drizzle.__drizzle_migrations d;"
DIGEST_SQL = "SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.version),'[]')::text,'UTF8')),'hex') FROM supabase_migrations.schema_migrations s;"
# Detailed records are retained alongside the candidate's digest contract.
DETAIL_SQL = """SELECT jsonb_build_object(
 'defaults',(SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(d),'definition',pg_get_expr(adbin,adrelid)) ORDER BY oid),'[]') FROM pg_attrdef d WHERE adrelid='drizzle.__drizzle_migrations'::regclass),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(t),'definition',pg_get_triggerdef(t.oid),'function',to_jsonb(p)) ORDER BY t.oid),'[]') FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE tgrelid='drizzle.__drizzle_migrations'::regclass),
 'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('row',to_jsonb(c),'definition',pg_get_constraintdef(c.oid)) ORDER BY c.oid),'[]') FROM pg_constraint c WHERE conrelid='drizzle.__drizzle_migrations'::regclass),
 'sequence_relation',(SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] FROM pg_class c WHERE oid='drizzle.__drizzle_migrations_id_seq'::regclass),
 'supabase_metadata',(SELECT to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] FROM pg_class c WHERE oid='supabase_migrations.schema_migrations'::regclass));"""


def snapshot(runner, db, label, meta_sql):
    query = lambda sql, suffix: runner.query(sql, label + '-' + suffix, db).stdout.strip()
    result = {'base': runner.snapshot(db, label + '-base'),
              'rows': json.loads(query(ROWS_SQL, 'rows')),
              'metadata': json.loads(query(meta_sql, 'metadata')),
              'details': json.loads(query(DETAIL_SQL, 'details')),
              'supabase_digest': query(DIGEST_SQL, 'supabase-digest'),
              'sequence_state': json.loads(query(SEQUENCE_STATE_SQL, 'sequence'))}
    (runner.output / (label + '.json')).write_text(json.dumps(result, indent=2) + '\n')
    return result


def fault_constraint(stopped):
    # Constraint is installed NOT VALID after H. It is still enforced for the new
    # INSERT. No trigger admission guard is disabled; the rendered LAB metadata
    # explicitly contains this extra constraint and the function appears in witness.
    encoded = json.dumps(stopped, separators=(',', ':'))
    require("'" not in encoded, 'Unexpected body hash map')
    return """CREATE FUNCTION qa_owned.ledger_insert_fault(text) RETURNS boolean LANGUAGE plpgsql AS $fault$
DECLARE observed jsonb;
BEGIN
 SELECT jsonb_object_agg(s,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) INTO observed
 FROM jsonb_object_keys('""" + encoded + """'::jsonb) s JOIN pg_proc p ON p.oid=to_regprocedure('public.'||s);
 IF observed IS DISTINCT FROM '""" + encoded + """'::jsonb THEN RAISE EXCEPTION 'LAB_FAULT_REACHED_BEFORE_FOUR_STOPPED'; END IF;
 RAISE EXCEPTION 'LAB_INSERT_FAULT_AFTER_FOUR_STOPPED';
END $fault$;
ALTER TABLE drizzle.__drizzle_migrations ADD CONSTRAINT lab_insert_fault CHECK (qa_owned.ledger_insert_fault(hash)) NOT VALID;"""


def trigger_fixture(deferred):
    function = """CREATE FUNCTION qa_owned.ledger_trigger_attack() RETURNS trigger LANGUAGE plpgsql AS $attack$
BEGIN ALTER FUNCTION public.seed_demo_organization_core() COST 101; RETURN NEW; END $attack$;"""
    if deferred:
        return function + "CREATE CONSTRAINT TRIGGER ledger_attack AFTER INSERT ON drizzle.__drizzle_migrations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION qa_owned.ledger_trigger_attack();"
    return function + "CREATE TRIGGER ledger_attack BEFORE INSERT ON drizzle.__drizzle_migrations FOR EACH ROW EXECUTE FUNCTION qa_owned.ledger_trigger_attack();"


def run_ledger_cases(runner, controls, renderer):
    """Call after frozen matrix with historical postgres template still intact."""
    require(callable(getattr(runner, 'psqlctl', None)), 'Owned psqlctl adapter required')
    proposal = (ROOT / 'PROPOSAL_R3_manual_ledger_wrapper.sql').read_text()
    r3 = (ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_text()
    require(hashlib.sha256(r3.encode()).hexdigest() == R3_HASH, 'Canonical R3 changed')
    stopped = json.loads(re.search(r'\$atomic_stopped_hashes\$(.*?)\$atomic_stopped_hashes\$', r3, re.S).group(1))
    historical = json.loads(re.search(r'\$atomic_historical_hashes\$(.*?)\$atomic_historical_hashes\$', r3, re.S).group(1))
    history = [{key: row[key] for key in ('hash', 'created_at')} for row in json.loads((ROOT / 'expected-drizzle-preimage.json').read_text())]
    history = [dict(row, id=i + 1) for i, row in enumerate(history)]
    meta_sql = metadata_sql(proposal)
    runner.result.update(ledger_cases='RUNNING', ledger_checks=[], ledger_uncovered={
        'L02': 'PARTIAL: clean retry only; injected terminal retry COST/prosrc not run here',
        'L07': 'PARTIAL: duplicate M only; remaining adversarial multiset runtime variants not run',
        'L12': 'PARTIAL: metadata drift and ledger trigger rejection only',
        'L09-L11': 'NOT_RUN: post-INSERT mutation variants not admitted by strict no-trigger candidate',
        'L13-L18': 'NOT_RUN: ledger concurrency, transport and applier exclusion remain unproven',
        'production_transport': 'BLOCKED: local psql does not certify remote transport',
        'external_applier_exclusion': 'BLOCKED: fixture exclusivity is not production exclusion'})
    runner.save()
    cases = [('clean', None), ('adopt', None), ('version_collision', COLLISION),
             ('hash_collision_older', COLLISION), ('hash_collision_newer', COLLISION),
             ('registered_historical', HISTORICAL), ('duplicate_identity', COLLISION),
             ('metadata_drift', 'LEDGER_PREFLIGHT: schema/ACL/triggers/default/sequence metadata drift'),
             ('insert_fault', FAULT),
             ('trigger', TRIGGER), ('deferred_trigger', TRIGGER),
             ('deferred_outer', TRIGGER), ('supabase_drift', 'LEDGER_PREFLIGHT: Supabase preimage changed')]
    require(tuple(name for name, _ in cases) == CASE_NAMES, 'Case manifest disagrees')
    for name, error in cases:
        case_name = 'ledger_' + name
        evidence = {'case': name, 'status': 'RUNNING'}
        runner.result['ledger_checks'].append(evidence)
        runner.save()
        try:
            with controls.case_sessions(runner, case_name) as (db, operator, observer):
                encoded = json.dumps(history, separators=(',', ':'))
                require("'" not in encoded, 'Unsafe fixture history')
                runner.query("CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint); INSERT INTO drizzle.__drizzle_migrations(id,hash,created_at) SELECT id,hash,created_at FROM jsonb_to_recordset('" + encoded + "'::jsonb) AS h(id int,hash text,created_at bigint); SELECT setval('drizzle.__drizzle_migrations_id_seq',20,true);", case_name + '-fixture', db)
                target_map = observer.execute("SELECT jsonb_object_agg(s,to_regprocedure('public.'||s)::oid::bigint) FROM jsonb_object_keys('" + json.dumps(stopped, separators=(',', ':')) + "'::jsonb) s;").json()
                target_oids = {int(oid) for oid in target_map.values()}
                require(len(target_oids) == 4, 'Four distinct resolved target OIDs required')
                evidence['target_oids'] = target_map
                initial = runner.snapshot(db, case_name + '-historical-precondition')
                require(controls.body_hashes(initial) == historical, 'Four historical bodies required before case setup')
                evidence['historical_precondition_verified'] = True
                if name == 'adopt':
                    operator.execute(r3).ok()
                if name == 'insert_fault':
                    runner.query(fault_constraint(stopped), case_name + '-fault', db)
                if name in ('trigger', 'deferred_trigger', 'deferred_outer'):
                    runner.query(trigger_fixture(name != 'trigger'), case_name + '-attack', db)
                before_contract = snapshot(runner, db, case_name + '-contract', meta_sql)
                binding = observer.execute("SELECT jsonb_build_object('database_name',current_database(),'database_oid',(SELECT oid::bigint FROM pg_database WHERE datname=current_database()),'server_addr',host(inet_server_addr()),'server_port',inet_server_port());").json()
                baseline = dict(binding, environment_kind='isolated_local_test', reviewed_transport_has_no_autoregistration=True,
                                reviewed_no_other_appliers=True, ledger_metadata=before_contract['metadata'],
                                supabase_history_digest=before_contract['supabase_digest'], history=history,
                                test_new_when=TEST_WHEN)
                sql = renderer.render(baseline)
                # Renderer must make lab identity explicit; never silently reuse a
                # candidate production timestamp for synthetic test registrations.
                require(f'v_new_when constant bigint := {TEST_WHEN};' in sql, 'Renderer must bind TEST_ONLY identity')
                (runner.output / (case_name + '-baseline.json')).write_text(json.dumps(baseline, indent=2) + '\n')
                (runner.output / (case_name + '-candidate.sql')).write_text(sql)
                evidence.update(wrapper_sha256=hashlib.sha256(sql.encode()).hexdigest(), canonical_sha256=R3_HASH,
                                fixture_history_sha256=stable_digest(history), identity={'hash': R3_HASH, 'created_at': TEST_WHEN},
                                sessions=[operator.identity, observer.identity], production_admission=False)
                if name == 'version_collision':
                    runner.query(f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{'0'*64}',{TEST_WHEN});", case_name + '-collision', db)
                if name.startswith('hash_collision'):
                    when = TEST_WHEN + (-1 if name.endswith('older') else 1)
                    runner.query(f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{R3_HASH}',{when});", case_name + '-collision', db)
                if name in ('registered_historical', 'duplicate_identity'):
                    runner.query(f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{R3_HASH}',{TEST_WHEN});", case_name + '-registered', db)
                if name == 'duplicate_identity':
                    runner.query(f"INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('{R3_HASH}',{TEST_WHEN});", case_name + '-duplicate', db)
                if name == 'metadata_drift':
                    runner.query('ALTER TABLE drizzle.__drizzle_migrations ENABLE ROW LEVEL SECURITY;', case_name + '-metadata-drift', db)
                if name == 'supabase_drift':
                    runner.query("INSERT INTO supabase_migrations.schema_migrations(version) VALUES ('20990101000000');", case_name + '-supabase-drift', db)
                before = snapshot(runner, db, case_name + '-before', meta_sql)
                require(controls.body_hashes(before['base']) == (stopped if name == 'adopt' else historical), 'Case body precondition changed')
                if name == 'deferred_outer':
                    operator.execute('BEGIN;').ok()
                reply = operator.execute(sql)
                evidence['primary_errors'] = controls.primary_errors(reply.text)
                if error:
                    require(reply.state == 'P0001' and evidence['primary_errors'] == [('P0001', error)], 'Wrong primary failure: ' + reply.text)
                    if name == 'deferred_outer':
                        operator.execute('ROLLBACK;').ok()
                    after = snapshot(runner, db, case_name + '-after', meta_sql)
                    evidence['sequence_observation'] = verify_rollback(before, after)
                    if name == 'insert_fault':
                        require(after['sequence_state']['last_value'] > before['sequence_state']['last_value'], 'Expected INSERT nextval was not observed')
                        evidence['four_stopped_at_insert_proven_by_primary_error'] = True
                else:
                    reply.ok()
                    after = snapshot(runner, db, case_name + '-after', meta_sql)
                    verify_history(before, after, R3_HASH, TEST_WHEN)
                    controls.verify_transition(before['base'], after['base'], stopped)
                    operator.execute(sql).ok()
                    retry = snapshot(runner, db, case_name + '-retry', meta_sql)
                    require(logical(after, target_oids) == logical(retry, target_oids), 'Retry changed logical witness')
                    require(after['sequence_state'] == retry['sequence_state'], 'Retry consumed sequence or reinserted')
                    evidence['retry_full_witness_verified'] = True
                evidence['witness_files'] = [case_name + '-before.json', case_name + '-after.json']
            # case_sessions finally closed/reaped, terminated and checked backends,
            # and dropped its owned DB before reaching this line.
            evidence.update(status='checks_pass_cleanup_pending', case_database_cleanup='confirmed')
            runner.save()
        except BaseException as exc:
            evidence.update(status='FAIL', error=str(exc))
            runner.result['ledger_cases'] = 'FAILED'
            runner.save()
            raise
    runner.result['ledger_cases'] = 'checks_pass_cleanup_pending'
    runner.save()
