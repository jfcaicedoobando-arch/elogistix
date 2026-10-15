"""Disposable PostgreSQL store cases; all issuer and business data are SYNTHETIC.

The caller compiles the verified store.sql bytes first and supplies SQL exported
from the original store.mjs as r.store_sql. These cases do not certify the JS
owner, issuer authentication, physical driver, failover durability or identity.
"""
import copy
import json
import re
import time
import uuid


NAMESPACE = uuid.UUID('9b058f2e-2d4a-5000-8000-000000000001')
UUID_PATTERN = r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}'
SCOPE = 'SYNTHETIC SQL fixture only; real issuer/identity/driver remain UNBOUND'
ISSUER_INVALIDS = (('deployment', ''), ('canonical_version', 2), ('tenant_id', ''), ('manifest_identity', ''),
                   ('scheduler_job_identity', ''), ('authorized_occurrence', ''), ('binding', []), ('binding', None))
BINDING_FIELDS = ('tenant', 'origin', 'contextId', 'runId', 'lineageId', 'skipMs', 'snapshots', 'generation', 'expiresAt')
APPEND_ONLY_SUFFIXES = tuple(table + '-' + verb for table in ('issuer_obligations', 'claims')
                             for verb in ('update', 'delete')) + ('issuer_obligations-truncate', 'claims-truncate')
CASES = (
    tuple('sql-append-only-zero-rows-' + suffix for suffix in APPEND_ONLY_SUFFIXES)
    + tuple('sql-issuer-check-' + field + '-' + str(index) for index, (field, _) in enumerate(ISSUER_INVALIDS))
    + ('sql-logical-obligation-distinct-ids-and-binding', 'sql-issuer-primary-key', 'sql-issuer-context-unique')
    + tuple('sql-foreign-key-' + field for field in ('deployment', 'obligation_id', 'context_id'))
    + tuple('sql-foreign-key-binding-' + field for field in BINDING_FIELDS)
    + ('sql-foreign-key-binding-snapshot-manifest', 'sql-foreign-key-binding-snapshot-financial',
       'sql-foreign-key-binding-missing-component', 'sql-claim-stage-check', 'sql-original-ingress-requires-dispatch')
    + tuple('sql-original-' + stage + '-wrong-' + component for component in ('deployment', 'context_id')
            for stage in ('dispatch', 'ingress'))
    + ('sql-original-dispatch-first', 'sql-original-dispatch-duplicate', 'sql-original-ingress-first',
       'sql-original-ingress-duplicate', 'sql-direct-duplicate-claim')
    + tuple('sql-append-only-populated-' + suffix for suffix in APPEND_ONLY_SUFFIXES)
    + ('sql-durable-claim-before-separate-synthetic-business', 'sql-two-connections-claim-commit',
       'sql-two-connections-claim-rollback', 'sql-postclaim-business-rollback-explicit',
       'sql-postclaim-business-rollback-failure')
)
SNAPSHOT_SQL = """SELECT jsonb_build_object(
 'issuer',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY deployment,obligation_id),'[]')
           FROM demo_owner_review.issuer_obligations o),
 'claims',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY deployment,obligation_id,stage),'[]')
           FROM demo_owner_review.claims c),
 'synthetic_business_events',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY event_id),'[]')
           FROM qa_synthetic.business_events b));
"""


def require(ok, message):
    if not ok:
        raise AssertionError(message)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def json_literal(value):
    return literal(json.dumps(value, sort_keys=True, separators=(',', ':'))) + '::jsonb'


def synthetic_uuid(label):
    return str(uuid.uuid5(NAMESPACE, 'SYNTHETIC/' + label))


def issuance(label):
    context = synthetic_uuid(label + '/context')
    return dict(deployment='SYNTHETIC_DEPLOYMENT', obligation_id=synthetic_uuid(label + '/obligation'),
                canonical_version=1, tenant_id='SYNTHETIC_TENANT',
                manifest_identity='SYNTHETIC_MANIFEST', scheduler_job_identity='SYNTHETIC_JOB',
                authorized_occurrence='SYNTHETIC_OCCURRENCE/' + label, context_id=context,
                binding=dict(tenant='SYNTHETIC_TENANT', origin='SYNTHETIC_SCHEDULER', contextId=context,
                             runId='SYNTHETIC_RUN/' + label, lineageId='SYNTHETIC_LINEAGE', skipMs=0,
                             snapshots=dict(manifest='SYNTHETIC_MANIFEST_SNAPSHOT',
                                            financial='SYNTHETIC_FINANCIAL_SNAPSHOT'),
                             generation=1, expiresAt='2099-01-01T00:00:00Z'))


def insert_issuance(row):
    columns = ('deployment', 'obligation_id', 'canonical_version', 'tenant_id', 'manifest_identity',
               'scheduler_job_identity', 'authorized_occurrence', 'context_id', 'binding')
    values = [str(row[c]) if c == 'canonical_version' else
              json_literal(row[c]) if c == 'binding' else literal(row[c]) for c in columns]
    return 'INSERT INTO demo_owner_review.issuer_obligations (' + ','.join(columns) + ') VALUES (' + ','.join(values) + ');'


def insert_claim(row, stage='dispatch'):
    return ('INSERT INTO demo_owner_review.claims(deployment,obligation_id,context_id,stage,binding) VALUES ('
            + ','.join((literal(row['deployment']), literal(row['obligation_id']), literal(row['context_id']),
                        literal(stage), json_literal(row['binding']))) + ');')


def one_json(result):
    values = []
    for line in result.stdout.splitlines():
        try:
            values.append(json.loads(line))
        except (ValueError, TypeError):
            continue
    require(len(values) == 1, 'Expected exactly one JSON result')
    return values[0]


def returned_rows(result):
    """Parse original RETURNING's three columns without rewriting its SQL."""
    rows, markers = [], []
    for line in result.stdout.splitlines():
        if not line:
            continue
        parts = line.split('|', 2)
        if len(parts) == 3 and re.fullmatch(UUID_PATTERN, parts[0]) and re.fullmatch(UUID_PATTERN, parts[1]):
            binding = json.loads(parts[2])
            require(isinstance(binding, dict), 'RETURNING binding must be an object')
            rows.append(dict(obligation_id=parts[0], context_id=parts[1], binding=binding))
        else:
            try:
                marker = json.loads(line)
            except (ValueError, TypeError):
                raise AssertionError('Unexpected original claim query output') from None
            require(isinstance(marker, dict) and set(marker) == {'synthetic_marker', 'pid'}
                    and marker['synthetic_marker'] in ('commit-completed', 'rollback-completed')
                    and type(marker['pid']) is int, 'Unexpected session marker')
            markers.append(marker)
    require(len(rows) <= 1, 'Claim returned more than one row')
    return rows, markers


def prepared_claim(r, stage, row):
    require(stage in ('dispatch', 'ingress'), 'Unsupported stage')
    sql = r.store_sql[stage]
    require(isinstance(sql, str) and sql.startswith('INSERT INTO demo_owner_review.claims\n'),
            'Original store SQL export required')
    # Preserve the exported query verbatim between AS and its statement terminator.
    return ('PREPARE qa_demo_' + stage + '(text,uuid) AS\n' + sql + ';\nEXECUTE qa_demo_' + stage
            + '(' + literal(row['deployment']) + ',' + literal(row['context_id']) + ');\n'
            + 'DEALLOCATE qa_demo_' + stage + ';\n')


def snapshot(r, db, label):
    return one_json(r.query(SNAPSHOT_SQL, label, db))


def check(r, label, **details):
    r.check(label, scope=SCOPE, business_fixture='SYNTHETIC', **details)


def rejected(r, db, label, sql, state, marker=None):
    before = snapshot(r, db, label + '-before')
    result = r.query(sql, label + '-rejection', db, expected=3)
    errors = re.findall(r'^(ERROR|FATAL):\s+([0-9A-Z]{5}):[ \t]*(.*)$', result.stdout, re.M)
    require(result.returncode == 3 and len(errors) == 1 and errors[0][1] == state,
            label + ': wrong primary SQLSTATE')
    if marker:
        require(marker in errors[0][2], label + ': wrong primary error')
    require(snapshot(r, db, label + '-after') == before, label + ': rejected statement changed history')
    check(r, label, sqlstate=state, complete_row_state_unchanged=True)


def assert_rows(result, row, count):
    rows, markers = returned_rows(result)
    require(not markers, 'Unexpected marker in standalone claim')
    expected = [dict(obligation_id=row['obligation_id'], context_id=row['context_id'], binding=row['binding'])] if count else []
    require(rows == expected, 'Original claim RETURNING mismatch')
    return rows


def live_claim(r, db, label, stage, row, count):
    sql = ('BEGIN;\n' + r.store_sql['durable'] + ';\n' + prepared_claim(r, stage, row) + 'COMMIT;\n')
    return assert_rows(r.query(sql, label, db), row, count)


def activity(r, db, app, label):
    return one_json(r.query("""SELECT coalesce((SELECT jsonb_build_object(
 'pid',pid,'backend_start',backend_start,'state',state,'wait_event_type',wait_event_type,
 'wait_event',wait_event,'blockers',pg_blocking_pids(pid),
 'locks',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM pg_locks l WHERE l.pid=a.pid))
 FROM pg_stat_activity a WHERE datname=current_database() AND application_name="""
                            + literal(app) + "),'null'::jsonb);", label, db))


def idle(r, db, app, label, process):
    deadline = time.monotonic() + 12
    index = 0
    while time.monotonic() < deadline:
        require(process.poll() is None, label + ': session exited before observed completion')
        index += 1
        observed = activity(r, db, app, label + '-observe-' + str(index))
        if observed and observed['state'] == 'idle in transaction':
            return observed
    raise AssertionError(label + ': no observed idle transaction')


def start_claim(r, db, app, row):
    return r.session('SET application_name=' + literal(app) + ";\nSET statement_timeout='20s';\nBEGIN;\n"
                     + r.store_sql['durable'] + ';\n' + prepared_claim(r, 'ingress', row), app, db)


def finish_claim(r, process, label, commit=True):
    marker = 'commit-completed' if commit else 'rollback-completed'
    r.release(process, ('COMMIT;' if commit else 'ROLLBACK;') +
              "\nSELECT jsonb_build_object('synthetic_marker'," + literal(marker) + ",'pid',pg_backend_pid());\n")
    result = r.finish_session(process, label)
    rows, markers = returned_rows(result)
    require(len(markers) == 1 and markers[0]['synthetic_marker'] == marker,
            label + ': missing transaction completion marker')
    return rows, markers[0]


def ingress_count(state, row):
    return sum(c['deployment'] == row['deployment'] and c['obligation_id'] == row['obligation_id']
               and c['context_id'] == row['context_id'] and c['stage'] == 'ingress'
               and c['binding'] == row['binding'] for c in state['claims'])


def observer(r, db, row, label, expected_count, claimant_pid):
    result = one_json(r.query("SELECT jsonb_build_object('observer_pid',pg_backend_pid(),'claims',"
                             "(SELECT count(*) FROM demo_owner_review.claims WHERE deployment="
                             + literal(row['deployment']) + ' AND obligation_id=' + literal(row['obligation_id'])
                             + "::uuid AND stage='ingress'));", label, db))
    require(result['observer_pid'] != claimant_pid and result['claims'] == expected_count,
            label + ': independent visibility mismatch')
    return result


def business_insert(row):
    return ('INSERT INTO qa_synthetic.business_events(obligation_id,context_id,fixture_label) VALUES ('
            + literal(row['obligation_id']) + '::uuid,' + literal(row['context_id']) + "::uuid,'SYNTHETIC');")


def business_if_claimed(r, db, label, rows, row):
    if not rows:
        return False
    require(rows == [dict(obligation_id=row['obligation_id'], context_id=row['context_id'], binding=row['binding'])],
            label + ': unexpected claimant')
    r.query('BEGIN;\n' + business_insert(row) + '\nCOMMIT;', label, db)
    return True


def append_only(r, db, phase, populated=False):
    for table in ('issuer_obligations', 'claims'):
        for verb in ('update', 'delete'):
            sql = ('UPDATE demo_owner_review.' + table + ' SET binding=binding' if verb == 'update'
                   else 'DELETE FROM demo_owner_review.' + table)
            sql += ';' if populated else ' WHERE false;'
            rejected(r, db, 'sql-append-only-' + phase + '-' + table + '-' + verb,
                     sql, 'P0001', 'immutable owner history')
    # Listing both tables satisfies the FK prerequisite before the issuer's BEFORE TRUNCATE trigger.
    for target, tables in (('issuer_obligations', 'issuer_obligations,demo_owner_review.claims'), ('claims', 'claims')):
        rejected(r, db, 'sql-append-only-' + phase + '-' + target + '-truncate',
                 'TRUNCATE TABLE demo_owner_review.' + tables + ';', 'P0001', 'immutable owner history')


def issuer_cases(r, db):
    for index, (field, value) in enumerate(ISSUER_INVALIDS):
        row = issuance('invalid-' + str(index))
        row[field] = value
        rejected(r, db, 'sql-issuer-check-' + field + '-' + str(index), insert_issuance(row), '23514')
    row = issuance('uniqueness')
    r.query(insert_issuance(row), 'sql-issuer-unique-seed', db)
    logical = copy.deepcopy(row)
    logical.update(obligation_id=synthetic_uuid('unique-other-obligation'), context_id=synthetic_uuid('unique-other-context'))
    logical['binding'].update(contextId=logical['context_id'], generation=2)
    logical['binding']['snapshots']['manifest'] = 'SYNTHETIC_CHANGED_SNAPSHOT'
    rejected(r, db, 'sql-logical-obligation-distinct-ids-and-binding', insert_issuance(logical), '23505')
    same_id = issuance('different-logical-same-id')
    same_id['obligation_id'] = row['obligation_id']
    rejected(r, db, 'sql-issuer-primary-key', insert_issuance(same_id), '23505')
    same_context = issuance('different-logical-same-context')
    same_context['context_id'] = row['context_id']
    rejected(r, db, 'sql-issuer-context-unique', insert_issuance(same_context), '23505')


def binding_cases(r, db):
    row = issuance('binding')
    r.query(insert_issuance(row), 'sql-binding-seed', db)
    for field in ('deployment', 'obligation_id', 'context_id'):
        changed = copy.deepcopy(row)
        changed[field] = ('SYNTHETIC_OTHER_DEPLOYMENT' if field == 'deployment' else synthetic_uuid('foreign-' + field))
        rejected(r, db, 'sql-foreign-key-' + field, insert_claim(changed), '23503')
    require(set(row['binding']) == set(BINDING_FIELDS), 'Synthetic binding case matrix is incomplete')
    for field in BINDING_FIELDS:
        changed = copy.deepcopy(row)
        changed['binding'][field] = (1 if field == 'skipMs' else 2 if field == 'generation'
                                     else {'manifest': 'SYNTHETIC_TAMPER', 'financial': 'SYNTHETIC_TAMPER'}
                                     if field == 'snapshots' else 'SYNTHETIC_TAMPER')
        rejected(r, db, 'sql-foreign-key-binding-' + field, insert_claim(changed), '23503')
    for field in ('manifest', 'financial'):
        changed = copy.deepcopy(row)
        changed['binding']['snapshots'][field] = 'SYNTHETIC_TAMPER'
        rejected(r, db, 'sql-foreign-key-binding-snapshot-' + field, insert_claim(changed), '23503')
    changed = copy.deepcopy(row)
    del changed['binding']['tenant']
    rejected(r, db, 'sql-foreign-key-binding-missing-component', insert_claim(changed), '23503')
    rejected(r, db, 'sql-claim-stage-check', insert_claim(row, 'retry'), '23514')


def original_query_cases(r, db):
    row = issuance('original-queries')
    r.query(insert_issuance(row), 'sql-original-query-issuer', db)
    before = snapshot(r, db, 'sql-no-dispatch-before')
    live_claim(r, db, 'sql-no-dispatch-query', 'ingress', row, 0)
    require(snapshot(r, db, 'sql-no-dispatch-after') == before, 'Missing dispatch left a claim')
    check(r, 'sql-original-ingress-requires-dispatch', returned_rows=0, complete_row_state_unchanged=True)
    for component in ('deployment', 'context_id'):
        changed = copy.deepcopy(row)
        changed[component] = 'SYNTHETIC_WRONG_DEPLOYMENT' if component == 'deployment' else synthetic_uuid('wrong-context')
        for stage in ('dispatch', 'ingress'):
            label = 'sql-original-' + stage + '-wrong-' + component
            before = snapshot(r, db, label + '-before')
            live_claim(r, db, label + '-query', stage, changed, 0)
            require(snapshot(r, db, label + '-after') == before, label + ': wrote a claim')
            check(r, label, returned_rows=0, complete_row_state_unchanged=True)
    for stage in ('dispatch', 'ingress'):
        before = snapshot(r, db, 'sql-original-' + stage + '-before')
        live_claim(r, db, 'sql-original-' + stage + '-first-query', stage, row, 1)
        after = snapshot(r, db, 'sql-original-' + stage + '-after')
        require(after['issuer'] == before['issuer'] and after['synthetic_business_events'] == before['synthetic_business_events']
                and len(after['claims']) == len(before['claims']) + 1, 'Unexpected original claim delta')
        require(sum(c['obligation_id'] == row['obligation_id'] and c['stage'] == stage
                    and c['binding'] == row['binding'] for c in after['claims']) == 1, 'Claimant not unique')
        check(r, 'sql-original-' + stage + '-first', returned_rows=1, claimant_count=1)
        live_claim(r, db, 'sql-original-' + stage + '-duplicate-query', stage, row, 0)
        require(snapshot(r, db, 'sql-original-' + stage + '-duplicate-after') == after, 'Duplicate changed state')
        check(r, 'sql-original-' + stage + '-duplicate', returned_rows=0, complete_row_state_unchanged=True)
    rejected(r, db, 'sql-direct-duplicate-claim', insert_claim(row), '23505')


def durable_separate_case(r, db):
    row = issuance('durable-separate')
    r.query(insert_issuance(row), 'sql-durable-issuer', db)
    live_claim(r, db, 'sql-durable-dispatch', 'dispatch', row, 1)
    app = 'demo-sql-durable-claim'
    process = start_claim(r, db, app, row)
    observed = idle(r, db, app, app, process)
    before_commit = observer(r, db, row, 'sql-durable-before-commit-observer', 0, observed['pid'])
    rows, marker = finish_claim(r, process, 'sql-durable-commit')
    require(len(rows) == 1 and marker['pid'] == observed['pid'], 'Claim session changed')
    visible = observer(r, db, row, 'sql-durable-after-commit-before-business', 1, observed['pid'])
    before_business = snapshot(r, db, 'sql-durable-before-business')
    require(not any(b['obligation_id'] == row['obligation_id'] for b in before_business['synthetic_business_events']),
            'Business happened before independent claim visibility')
    business_if_claimed(r, db, 'sql-durable-synthetic-business', rows, row)
    after = snapshot(r, db, 'sql-durable-after-business')
    require(ingress_count(after, row) == 1 and len(after['synthetic_business_events']) == len(before_business['synthetic_business_events']) + 1,
            'Durable claim or synthetic business delta mismatch')
    check(r, 'sql-durable-claim-before-separate-synthetic-business', claimant_pid=observed['pid'],
          precommit_observer=before_commit, committed_observer=visible, claim_transactions=1,
          synthetic_business_transactions=1, protocol_commit_ack_certified=False)


def race_case(r, db, commit_winner):
    suffix = 'commit' if commit_winner else 'rollback'
    row = issuance('race-' + suffix)
    r.query(insert_issuance(row), 'sql-race-' + suffix + '-issuer', db)
    live_claim(r, db, 'sql-race-' + suffix + '-dispatch', 'dispatch', row, 1)
    app_a, app_b = 'demo-sql-race-' + suffix + '-a', 'demo-sql-race-' + suffix + '-b'
    a = start_claim(r, db, app_a, row)
    a_state = idle(r, db, app_a, app_a, a)
    b = start_claim(r, db, app_b, row)
    r.wait_lock(app_b, db)
    blocked = activity(r, db, app_b, app_b + '-blocking-proof')
    require(blocked and blocked['pid'] != a_state['pid'] and blocked['wait_event_type'] == 'Lock'
            and a_state['pid'] in blocked['blockers'] and any(not lock['granted'] for lock in blocked['locks']),
            'Two independent sessions did not block on the pending claim')
    a_rows, _ = finish_claim(r, a, app_a + '-finish', commit=commit_winner)
    require(len(a_rows) == 1, 'First live insert did not return its pending row')
    b_state = idle(r, db, app_b, app_b + '-ready', b)
    b_rows, _ = finish_claim(r, b, app_b + '-finish')
    require(len(b_rows) == (0 if commit_winner else 1), 'Wrong competing claim result')
    winner_rows = a_rows if commit_winner else b_rows
    winner_pid = a_state['pid'] if commit_winner else b_state['pid']
    visible = observer(r, db, row, 'sql-race-' + suffix + '-visible-before-business', 1, winner_pid)
    business_if_claimed(r, db, 'sql-race-' + suffix + '-synthetic-business', winner_rows, row)
    after = snapshot(r, db, 'sql-race-' + suffix + '-after')
    require(ingress_count(after, row) == 1 and sum(e['obligation_id'] == row['obligation_id']
            for e in after['synthetic_business_events']) == 1, 'Race did not leave exactly one claimant/business event')
    check(r, 'sql-two-connections-claim-' + suffix, first_pid=a_state['pid'], second_pid=b_state['pid'],
          observed_wait=blocked, committed_observer=visible, first_committed=commit_winner,
          first_returned=1, second_returned=len(b_rows), claimant_count=1, synthetic_business_events=1,
          application_retry_or_recovery_authorized=False)


def business_rollback_case(r, db, fail_after_effect):
    suffix = 'failure' if fail_after_effect else 'explicit'
    row = issuance('business-rollback-' + suffix)
    r.query(insert_issuance(row), 'sql-business-' + suffix + '-issuer', db)
    live_claim(r, db, 'sql-business-' + suffix + '-dispatch', 'dispatch', row, 1)
    live_claim(r, db, 'sql-business-' + suffix + '-claim-commit', 'ingress', row, 1)
    before = snapshot(r, db, 'sql-business-' + suffix + '-before')
    require(ingress_count(before, row) == 1, 'Business started without durable claim')
    sql = 'BEGIN;\n' + business_insert(row) + '\n'
    if fail_after_effect:
        sql += business_insert(row).replace("'SYNTHETIC'", "'SYNTHETIC_INJECTED_FAILURE'")
        result = r.query(sql, 'sql-business-failure-after-first-effect', db, expected=3)
        errors = re.findall(r'^ERROR:\s+([0-9A-Z]{5}):', result.stdout, re.M)
        require(errors == ['23514'], 'Synthetic business failed for the wrong reason')
    else:
        r.query(sql + 'ROLLBACK;', 'sql-business-explicit-rollback', db)
    require(snapshot(r, db, 'sql-business-' + suffix + '-after') == before,
            'Business rollback lost claim or retained an effect')
    retry = live_claim(r, db, 'sql-business-' + suffix + '-duplicate-retry', 'ingress', row, 0)
    require(not business_if_claimed(r, db, 'sql-business-' + suffix + '-forbidden-retry', retry, row),
            'Duplicate live insert regained permission')
    require(snapshot(r, db, 'sql-business-' + suffix + '-after-retry') == before,
            'Duplicate retry changed state')
    check(r, 'sql-postclaim-business-rollback-' + suffix, claimant_count=1, duplicate_returned=0,
          sqlstate='23514' if fail_after_effect else None, synthetic_business_effects_rolled_back=True,
          fixture_outcome='consumed; application quarantine remains an independent requirement')


def run_sql_cases(r, db):
    require(re.fullmatch(r'crm_acl_fixture_[a-z0-9_]+', db), 'Disposable fixture database required')
    for key in ('dispatch', 'ingress', 'durable'):
        require(isinstance(r.store_sql.get(key), str) and r.store_sql[key], 'Missing original store SQL export')
    require(r.store_sql['durable'] == "SET LOCAL synchronous_commit = 'on'", 'Unexpected durability statement')
    r.query("CREATE SCHEMA qa_synthetic;\nCREATE TABLE qa_synthetic.business_events ("
            "event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,obligation_id uuid NOT NULL,"
            "context_id uuid NOT NULL,fixture_label text NOT NULL CHECK(fixture_label='SYNTHETIC'));\n"
            "COMMENT ON TABLE qa_synthetic.business_events IS 'SYNTHETIC business fixture; no real engine, issuer or identity';",
            'sql-create-synthetic-business-fixture', db)
    initial = snapshot(r, db, 'sql-initial-empty-store')
    require(initial == dict(issuer=[], claims=[], synthetic_business_events=[]), 'Store must start empty')
    append_only(r, db, 'zero-rows')
    issuer_cases(r, db)
    binding_cases(r, db)
    original_query_cases(r, db)
    append_only(r, db, 'populated', populated=True)
    durable_separate_case(r, db)
    race_case(r, db, True)
    race_case(r, db, False)
    business_rollback_case(r, db, False)
    business_rollback_case(r, db, True)
