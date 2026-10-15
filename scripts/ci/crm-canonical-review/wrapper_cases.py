"""Direct-wrapper cases on owned disposable fixtures, separate from the 52 SQL cases.

Every contract below is captured from this harness's synthetic database. This
module accepts no DSN, private contract, external database, or transport option.
Registration uses the fixture's verified SERIAL default. One adversarial case
supplies a measured ID solely to prove rejection of an inconsistent sequence.
"""
import copy
import hashlib
import json
from pathlib import Path
import re
import time

from cases import F, database, semantic
from direct_wrapper import capture_sql, render, sequence_state_sql


ROOT = Path(__file__).resolve().parent
CANONICAL_SHA256 = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
PRIOR_HASH = hashlib.sha256(b'TEST ONLY: synthetic direct-wrapper prior history').hexdigest()
TIMEOUT = "SET statement_timeout='20s';"
DIRECT_CASES = (
    'direct-commit',
    'direct-idempotent-lost-response',
    'direct-rollback-after-insert',
    'direct-fresh-retry-sequence-gap',
    'direct-owner-only-unregistered',
    'direct-conflict-hash',
    'direct-conflict-when',
    'direct-history-drift',
    'direct-ledger-metadata-drift',
    'direct-supabase-history-drift',
    'direct-registered-acl-degraded',
    'direct-registered-sequence-behind',
    'direct-target-metadata-drift',
    'direct-ledger-lock-55P03',
)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def owner_only(r, db, label):
    sql = "SELECT count(*)=2 AND bool_and(proacl=ARRAY['postgres=X/postgres']::aclitem[] AND NOT has_function_privilege('service_role',oid,'EXECUTE') AND NOT has_function_privilege('anon',oid,'EXECUTE') AND NOT has_function_privilege('authenticated',oid,'EXECUTE')) FROM pg_proc WHERE oid=ANY(ARRAY['" + F[0] + "'::regprocedure::oid,'" + F[1] + "'::regprocedure::oid]);"
    require(r.query(sql, label, db).stdout.strip() == 't', label + ': final owner-only ACL not verified')


def _save(r, label, value):
    (r.output / (label + '.json')).write_text(json.dumps(value, indent=2) + '\n')


def _setup(r, db, label):
    # These definitions and prior rows belong only to the synthetic fixture.
    # RETURNING records the ID chosen by the actual default, never a guessed ID.
    sql = """
CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY, statements text[], name text);
INSERT INTO supabase_migrations.schema_migrations(version,statements,name)
VALUES ('TEST_ONLY_PRIOR',ARRAY['-- synthetic prior history'],'TEST_ONLY_PRIOR');
WITH inserted AS (
  INSERT INTO drizzle.__drizzle_migrations(hash,created_at)
  VALUES ('""" + PRIOR_HASH + """',1) RETURNING *
)
SELECT to_jsonb(inserted) FROM inserted;
"""
    observed = json.loads(r.query(sql, label + '-fixture', db).stdout)
    require(observed['hash'] == PRIOR_HASH and observed['created_at'] == 1, "Wrapper case condition failed: observed['hash'] == PRIOR_HASH and observed['created_at'] == 1")
    require(type(observed['id']) is int, "Wrapper case condition failed: type(observed['id']) is int")
    _save(r, label + '-default-insert-returning', observed)


def _capture(r, db, label):
    contract = json.loads(r.query(capture_sql(), label + '-capture', db).stdout)
    contract['scope'] = 'synthetic-ci'
    contract['sequence_state'] = json.loads(
        r.query(sequence_state_sql(contract['sequence_name']), label + '-sequence', db).stdout)
    _save(r, label + '-synthetic-contract', contract)
    return contract


def _state(r, db, label):
    return {'contract': _capture(r, db, label), 'snapshot': r.snapshot(db, label + '-catalog')}


def _refresh_sequence(r, db, contract, label):
    # Registered-state verification keeps the reviewed original prehistory and
    # catalog envelope; only nextval's observed state is refreshed independently.
    result = copy.deepcopy(contract)
    result['sequence_state'] = json.loads(
        r.query(sequence_state_sql(contract['sequence_name']), label, db).stdout)
    return result


def _registered(before, after, digest, when):
    a, b = before['contract'], after['contract']
    require(semantic(before['snapshot']) == semantic(after['snapshot']), "Wrapper case condition failed: semantic(before['snapshot']) == semantic(after['snapshot'])")
    require(semantic(a['catalog']) == semantic(b['catalog']), "Wrapper case condition failed: semantic(a['catalog']) == semantic(b['catalog'])")
    require(a['context'] == b['context'] and a['sequence_name'] == b['sequence_name'], "Wrapper case condition failed: a['context'] == b['context'] and a['sequence_name'] == b['sequence_name']")
    require(a['supabase'] == b['supabase'], 'Supabase history changed')
    require(len(b['drizzle']) == len(a['drizzle']) + 1, "Wrapper case condition failed: len(b['drizzle']) == len(a['drizzle']) + 1")
    require(b['drizzle'][:-1] == a['drizzle'], 'prior ordered Drizzle history changed')
    row = b['drizzle'][-1]
    require(set(row) == {'id', 'hash', 'created_at'}, "Wrapper case condition failed: set(row) == {'id', 'hash', 'created_at'}")
    require(row['hash'] == digest and row['created_at'] == when, "Wrapper case condition failed: row['hash'] == digest and row['created_at'] == when")
    require(type(row['id']) is int and row['id'] not in {x['id'] for x in a['drizzle']}, "Wrapper case condition failed: type(row['id']) is int and row['id'] not in {x['id'] for x in a['drizzle']}")
    require(b['sequence_state'] == {'last_value': row['id'], 'is_called': True}, "Wrapper case condition failed: b['sequence_state'] == {'last_value': row['id'], 'is_called': True}")


def _reject(r, db, label, contract, candidate, *, fault=None, error='CRM_DIRECT_'):
    before = _state(r, db, label + '-before')
    response = r.query(TIMEOUT + render(contract, candidate, fault=fault), label + '-reject', db, expected=3)
    require(re.search(r'^ERROR:\s+P0001: ' + re.escape(error), response.stdout, re.M), response.stdout)
    after = _state(r, db, label + '-after')
    if fault == 'after-insert':
        # PostgreSQL nextval is intentionally not rolled back. No ledger row or
        # catalog mutation may survive, but the observed sequence gap must.
        require(before['snapshot'] == after['snapshot'], "Wrapper case condition failed: before['snapshot'] == after['snapshot']")
        original, terminal = copy.deepcopy(before['contract']), copy.deepcopy(after['contract'])
        old_sequence = original.pop('sequence_state')
        new_sequence = terminal.pop('sequence_state')
        require(original == terminal, 'Wrapper case condition failed: original == terminal')
        require(new_sequence['is_called'] is True, "Wrapper case condition failed: new_sequence['is_called'] is True")
        require(new_sequence['last_value'] == old_sequence['last_value'] + 1, "Wrapper case condition failed: new_sequence['last_value'] == old_sequence['last_value'] + 1")
    else:
        require(before == after, 'rejected wrapper changed catalog, history, or sequence')
    return before, after


def _wait_holder(r, db, app, label):
    # Observe an acquired lock rather than relying on client timing or a sleep.
    deadline = time.monotonic() + 10
    sql = """SELECT coalesce(jsonb_agg(jsonb_build_object('pid',a.pid,'mode',l.mode,'granted',l.granted)),'[]')
FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
WHERE a.application_name='""" + app + """' AND l.relation='drizzle.__drizzle_migrations'::regclass
AND l.mode='ShareRowExclusiveLock' AND l.granted;"""
    while time.monotonic() < deadline:
        rows = json.loads(r.query(sql, label + '-observe-holder', db, user='supabase_admin').stdout)
        if rows:
            _save(r, label + '-observed-held-lock', rows)
            return
        time.sleep(.03)
    raise RuntimeError('Owned direct-wrapper holder did not acquire its ledger lock')


def run_wrapper_cases(r):
    """Append and return exactly 14 named synthetic direct-wrapper checks."""
    start = len(r.result['checks'])
    candidate = (ROOT.parents[2] / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    digest = hashlib.sha256(candidate).hexdigest()
    require(digest == CANONICAL_SHA256, 'Wrapper case condition failed: digest == CANONICAL_SHA256')
    entries = json.loads((ROOT.parents[2] / 'drizzle/migrations/meta/_journal.json').read_text())['entries']
    journal = [x for x in entries if x['tag'] == '0021_crm_helpers_owner_only']
    require(len(journal) == 1, 'Wrapper case condition failed: len(journal) == 1')
    when = journal[0]['when']

    with database(r, 'direct_commit') as db:
        _setup(r, db, 'direct-commit')
        before = _state(r, db, 'direct-commit-before')
        contract = before['contract']
        r.query(TIMEOUT + render(contract, candidate), 'direct-commit-apply', db)
        after = _state(r, db, 'direct-commit-after')
        _registered(before, after, digest, when)
        owner_only(r, db, 'direct-commit-owner-only')
        r.check('direct-commit', canonical_sha256=digest, prior_history_preserved=True,
                default_generated_id=after['contract']['drizzle'][-1]['id'], supabase_unchanged=True)

        # Model uncertain delivery by making no inference from the first
        # response: independently inspect both histories and final target state.
        observed = _state(r, db, 'direct-lost-response-independent-read')
        require(observed == after, 'Wrapper case condition failed: observed == after')
        owner_only(r, db, 'direct-lost-response-owner-only')
        retry = _refresh_sequence(r, db, contract, 'direct-idempotent-sequence-refresh')
        r.query(TIMEOUT + render(retry, candidate), 'direct-idempotent-verify', db)
        require(_state(r, db, 'direct-idempotent-after') == observed, "Wrapper case condition failed: _state(r, db, 'direct-idempotent-after') == observed")
        r.check('direct-idempotent-lost-response', independent_postcondition_verified=True,
                additional_rows=0, sequence_unchanged=True,
                transport_claim='synthetic uncertain-response model only')

    with database(r, 'direct_rollback') as db:
        _setup(r, db, 'direct-rollback')
        contract = _capture(r, db, 'direct-rollback-initial')
        _, gap = _reject(r, db, 'direct-rollback', contract, candidate, fault='after-insert',
                         error='CRM_DIRECT_INJECTED_AFTER_INSERT')
        r.check('direct-rollback-after-insert', catalog_and_rows_rolled_back=True,
                nontransactional_sequence_gap_observed=True)
        # A fresh capture admits the real post-failure sequence state. A gap is
        # not a conflicting row or an excuse to reset/reuse the sequence value.
        retry = _capture(r, db, 'direct-gap-fresh-capture')
        require(retry == gap['contract'], "Wrapper case condition failed: retry == gap['contract']")
        r.query(TIMEOUT + render(retry, candidate), 'direct-gap-retry', db)
        after = _state(r, db, 'direct-gap-after')
        _registered(gap, after, digest, when)
        owner_only(r, db, 'direct-gap-owner-only')
        require(after['contract']['drizzle'][-1]['id'] > gap['contract']['sequence_state']['last_value'], "Wrapper case condition failed: after['contract']['drizzle'][-1]['id'] > gap['contract']['sequence_state']['last_value']")
        r.check('direct-fresh-retry-sequence-gap', sequence_gap_accepted=True,
                default_generated_id=after['contract']['drizzle'][-1]['id'])

    with database(r, 'direct_owner_only_unregistered') as db:
        name = 'direct-owner-only-unregistered'
        _setup(r, db, name)
        r.query(TIMEOUT + candidate.decode('utf8'), name + '-canonical-before-registration', db)
        owner_only(r, db, name + '-owner-before-registration')
        before = _state(r, db, name + '-before')
        r.query(TIMEOUT + render(before['contract'], candidate), name + '-adopt', db)
        after = _state(r, db, name + '-after')
        _registered(before, after, digest, when)
        owner_only(r, db, name + '-owner-after-registration')
        r.check(name, owner_only_unregistered_adopted=True, additional_rows=1,
                default_generated_id=after['contract']['drizzle'][-1]['id'], supabase_unchanged=True)

    mutations = (
        ('direct-conflict-hash', "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('" + digest + "'," + str(when - 1) + ") RETURNING to_jsonb(__drizzle_migrations);"),
        ('direct-conflict-when', "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('" + hashlib.sha256(b'TEST ONLY: synthetic conflicting timestamp').hexdigest() + "'," + str(when) + ") RETURNING to_jsonb(__drizzle_migrations);"),
        ('direct-history-drift', "UPDATE drizzle.__drizzle_migrations SET hash='" + hashlib.sha256(b'TEST ONLY: synthetic history drift').hexdigest() + "' WHERE created_at=1;"),
        ('direct-ledger-metadata-drift', 'ALTER TABLE drizzle.__drizzle_migrations ADD COLUMN test_only_drift text;'),
        ('direct-supabase-history-drift', "INSERT INTO supabase_migrations.schema_migrations VALUES ('TEST_ONLY_DRIFT',ARRAY['-- synthetic drift'],'TEST_ONLY_DRIFT');"),
    )
    for name, mutation in mutations:
        with database(r, name.replace('-', '_')) as db:
            _setup(r, db, name)
            contract = _capture(r, db, name + '-initial')
            r.query(mutation, name + '-mutate', db)
            # Independent capture observes any actual sequence movement caused
            # by the fixture mutation; history is still the original envelope.
            contract = _refresh_sequence(r, db, contract, name + '-sequence-refresh')
            _reject(r, db, name, contract, candidate)
            r.check(name, sqlstate='P0001', complete_rollback=True)

    with database(r, 'direct_registered_acl_degraded') as db:
        name = 'direct-registered-acl-degraded'
        _setup(r, db, name)
        contract = _capture(r, db, name + '-initial')
        r.query(TIMEOUT + render(contract, candidate), name + '-register', db)
        owner_only(r, db, name + '-owner-before-drift')
        r.query('GRANT EXECUTE ON FUNCTION ' + F[0] + ' TO service_role;', name + '-mutate', db)
        contract = _refresh_sequence(r, db, contract, name + '-sequence-refresh')
        _reject(r, db, name, contract, candidate)
        r.check(name, sqlstate='P0001', registered_row_does_not_skip_target_verification=True,
                complete_rollback=True)

    with database(r, 'direct_registered_sequence_behind') as db:
        name = 'direct-registered-sequence-behind'
        _setup(r, db, name)
        contract = _capture(r, db, name + '-initial')
        r.query(TIMEOUT + candidate.decode('utf8'), name + '-canonical-without-registration', db)
        owner_only(r, db, name + '-owner-only')
        measured = json.loads(r.query(sequence_state_sql(contract['sequence_name']),
                                      name + '-measured-sequence', db).stdout)
        require(measured == contract['sequence_state'], name + ': canonical SQL changed the ledger sequence')
        require(type(measured['last_value']) is int and type(measured['is_called']) is bool,
                name + ': measured sequence state has unexpected types')
        measured_next = measured['last_value'] + int(measured['is_called'])
        require(measured_next > max(x['id'] for x in contract['drizzle']),
                name + ': measured next value must follow the synthetic prior history')
        # TEST_ONLY attack: deliberately supply the observed next ID without
        # calling nextval. This is never an operational registration convention.
        attack = "INSERT INTO drizzle.__drizzle_migrations(id,hash,created_at) VALUES (" + str(measured_next) + ",'" + digest + "'," + str(when) + ") RETURNING to_jsonb(__drizzle_migrations);"
        observed = json.loads(r.query(attack, name + '-test-only-explicit-id-attack', db).stdout)
        require(observed == {'id': measured_next, 'hash': digest, 'created_at': when},
                name + ': adversarial fixture did not insert its measured row')
        _save(r, name + '-test-only-measured-id', {'sequence': measured, 'inserted': observed})
        contract = _refresh_sequence(r, db, contract, name + '-sequence-refresh')
        require(contract['sequence_state'] == measured, name + ': attack unexpectedly advanced the sequence')
        _reject(r, db, name, contract, candidate, error='CRM_DIRECT_CONFLICT')
        r.check(name, sqlstate='P0001', test_only_explicit_id_measured=True,
                registered_sequence_behind_rejected=True, complete_rollback=True)

    with database(r, 'direct_target_metadata_drift') as db:
        name = 'direct-target-metadata-drift'
        _setup(r, db, name)
        contract = _capture(r, db, name + '-initial')
        # Portable canonical SQL accepts a current comment as its own baseline;
        # the captured wrapper envelope must detect this intervening change.
        r.query('COMMENT ON FUNCTION ' + F[0] + " IS 'TEST ONLY: synthetic contract drift';", name + '-mutate', db)
        _reject(r, db, name, contract, candidate)
        r.check(name, sqlstate='P0001', captured_catalog_drift_rejected=True, complete_rollback=True)

    with database(r, 'direct_ledger_contention') as db:
        name = 'direct-ledger-lock-55P03'
        _setup(r, db, name)
        contract = _capture(r, db, name + '-initial')
        before = _state(r, db, name + '-before')
        holder = r.session("SET application_name='direct_ledger_holder';BEGIN;LOCK TABLE drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE;", name + '-holder', db)
        competitor = None
        competitor_finished = False
        try:
            _wait_holder(r, db, 'direct_ledger_holder', name)
            competitor = r.session(TIMEOUT + render(contract, candidate), name + '-competitor', db)
            response = r.finish_session(competitor, name + '-competitor', expected=None)
            competitor_finished = True
            require(response.returncode == 3, response.stdout)
            require(re.search(r'^ERROR:\s+55P03:', response.stdout, re.M), response.stdout)
        finally:
            # All spawned clients are owned/registered by the harness; finish
            # both before database teardown, including assertion failure paths.
            try:
                r.release(holder, 'ROLLBACK;\n\\q')
            finally:
                try:
                    r.finish_session(holder, name + '-holder')
                finally:
                    if competitor is not None and not competitor_finished:
                        r.finish_session(competitor, name + '-competitor-cleanup', expected=None)
        require(_state(r, db, name + '-after') == before, "Wrapper case condition failed: _state(r, db, name + '-after') == before")
        r.check(name, sqlstate='55P03', acquired_competitor_lock_observed=True,
                complete_rollback=True, owned_clients_finished=True)

    checks = r.result['checks'][start:]
    require(tuple(x['case'] for x in checks) == DIRECT_CASES, "Wrapper case condition failed: tuple((x['case'] for x in checks)) == DIRECT_CASES")
    require(len(checks) == 14 and all(x['status'] == 'pass' for x in checks), "Wrapper case condition failed: len(checks) == 14 and all((x['status'] == 'pass' for x in checks))")
    return checks
