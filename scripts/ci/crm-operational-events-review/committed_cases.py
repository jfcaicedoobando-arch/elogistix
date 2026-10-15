"""Owned PG17.6 witnesses; never a transport adapter or real target runner."""
import codecs
import copy
import json
import re
import selectors
from types import SimpleNamespace

from cases import database
from comparator import _same
from comparator_cases import _capture_bundle
from committed_state import CommittedStateError, compare_committed_state
from event_cases import _fixture, _Listener, _state, _trace, require, REPOSITORY
from evidence import ingest
from projection_validator import ProjectionValidator
from public_source import verify_source
from transaction_envelope import (render_synthetic_transaction, render_transaction_proposal,
                                  semantic_witness_sql)


COMMITTED_CASES = (
    'committed-notice-discarded',
    'committed-response-discarded-after-commit',
    'committed-stale-duplicate-no-second-effect',
    'committed-outer-transaction-own-row-rejected',
    'committed-independent-reader-does-not-see-uncommitted-row',
    'committed-same-backend-after-commit-accepted',
    'committed-notice-then-rollback-rejected',
    'committed-exact-sequence-gap-rejected',
    'committed-extra-history-row-rejected',
    'committed-catalog-drift-rejected',
    'committed-binding-drift-rejected',
    'committed-supabase-drift-rejected',
    'committed-registration-conflict-rejected',
    'committed-assigned-xid-and-incomplete-evidence-rejected',
    'committed-public-proposal-still-fenced',
)


class Lane:
    def __init__(self, runner):
        self.runner = runner
        self.output = runner.output / 'committed-evidence'
        self.output.mkdir(parents=True, exist_ok=False)

    def query(self, *args, **kwargs):
        return self.runner.query(*args, **kwargs)


class Session(_Listener):
    """Serial owned psql test client. Reuse bounded pipe-reading and ownership.

    For the open-outer-transaction negative test only, retain that transaction:
    remove the collector's fixed BEGIN READ ONLY/COMMIT framing, never SQL bytes.
    This is essential: a collector COMMIT would destroy the negative witness.
    """
    def __init__(self, runner, db, label, lane):
        super().__init__(runner, db, label)
        self.artifact_output = lane.output
        self.keep_outer_open = False

    def __enter__(self):
        self.process = self.r.session('', self.label, self.db)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout.fileno(), selectors.EVENT_READ)
        observed = self.execute('SELECT pg_catalog.pg_backend_pid();', 'ready')
        self.backend_pid = int(observed.strip())
        return self

    def execute(self, sql, label):
        self.counter += 1
        marker = 'TEST_ONLY_COMMITTED_BARRIER_' + str(self.counter)
        start = len(self.output)
        self._release(sql + '\n\\echo ' + marker)
        self._read_until(lambda: re.search(r'(?:^|\n)' + re.escape(marker) + r'\r?\n', self.output[start:]) is not None, label, timeout=30)
        text = self.output[start:].split(marker, 1)[0]
        require(not re.search(r'^(ERROR|FATAL):', text, re.M), 'Owned serial client failed')
        return text

    def query(self, sql, label, db):
        require(db == self.db, 'Owned serial database mismatch')
        if self.keep_outer_open:
            prefix, suffix = 'BEGIN READ ONLY;', 'COMMIT;'
            require(sql.startswith(prefix) and sql.endswith(suffix), 'Expected fixed collector framing')
            sql = sql[len(prefix):-len(suffix)]
        return SimpleNamespace(stdout=self.execute(sql, label))

    def __exit__(self, *_):
        if self.selector:
            self.selector.close()
        if self.process:
            if self.process.poll() is None:
                self._release('ROLLBACK;\n\\q')
            remaining = self.r.finish_session(self.process, self.label, expected=None)
            (self.r.output / 'logs' / (self.label + '-complete.stdout')).write_text(self.output + remaining.stdout)


class SessionCapture:
    def __init__(self, session):
        self.output = session.artifact_output
        self.query = session.query


def capture(lane, validator, db, label):
    value = _capture_bundle(lane, db, label)
    ingest(value, validate_projection=validator)
    binding = json.loads(lane.query('BEGIN READ ONLY;' + semantic_witness_sql(value) + 'COMMIT;',
                                    label + '-bindings', db).stdout)
    (lane.output / (label + '-bindings.json')).write_text(json.dumps(binding, indent=2) + '\n')
    return value, binding


def compare(pair_before, pair_after, validator):
    return compare_committed_state(pair_before[0], pair_after[0],
        before_bindings=pair_before[1], after_bindings=pair_after[1], validate_projection=validator)


def rejected(pair_before, pair_after, validator):
    try:
        compare(pair_before, pair_after, validator)
    except CommittedStateError as error:
        return str(error)
    raise RuntimeError('Negative committed-state comparison was accepted')


def compile_sql(candidate, pair, validator, fault=None):
    return render_synthetic_transaction(candidate, pair[0], scope='synthetic-ci',
        validate_projection=validator, semantic_witness=pair[1], fault=fault)


def record(r, case, **details):
    r.check(case, operational_admission='NOT_ADMITTED', **details)


def save_summary(lane, label, result):
    require(result['admission'] == 'NOT_ADMITTED' and result['result'] == 'estado comprometido observado',
            'Committed comparison claimed admission or changed channel')
    (lane.output / (label + '-summary.json')).write_text(json.dumps(result, indent=2) + '\n')


def run_committed_cases(r):
    lane = Lane(r)
    validator = ProjectionValidator()
    candidate = (REPOSITORY / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    body = verify_source()['body']

    with database(r, 'committed_discarded') as db:
        _fixture(r, db, 'committed-discarded', body)
        before = capture(lane, validator, db, 'discarded-before')
        compiled = compile_sql(candidate, before, validator)
        state = _state(r, db, 'discarded-before-state')
        proposal = render_transaction_proposal(candidate, before[0], validate_projection=validator,
                                               semantic_witness=before[1])
        fenced = r.query(proposal, 'committed-public-fence', db, expected=3)
        require('CRM_TRANSACTION_NOT_ADMITTED' in fenced.stdout, 'Public fence missing')
        require(_state(r, db, 'discarded-after-fence-state') == state, 'Public fence changed state')
        record(r, COMMITTED_CASES[14], first_public_action_fenced=True)
        response = r.query("SET client_min_messages='warning';" + compiled,
                           'committed-notice-suppressed', db)
        require('TEST_ONLY_DEFAULT_INSERT:' not in response.stdout, 'NOTICE was not discarded')
        after = capture(lane, validator, db, 'discarded-after')
        save_summary(lane, 'notice-discarded', compare(before, after, validator))
        record(r, COMMITTED_CASES[0], notice_suppressed=True, no_receipt_supplied=True)
        # The compiled contract still says registration was absent. Repeating
        # this exact request must reject fresh state, never execute a second DO
        # payload or allocate another ID. This is not operational retry advice.
        committed_state = _state(r, db, 'duplicate-before-state')
        committed_trace = _trace(r, db, 'duplicate-before-trace')
        duplicate = r.query(compiled, 'committed-stale-duplicate', db, expected=3)
        require('CRM_TRANSACTION_PREIMAGE_' in duplicate.stdout
                and 'TEST_ONLY_DEFAULT_INSERT:' not in duplicate.stdout
                and 'TEST_ONLY_EVENT_TRACE:' not in duplicate.stdout, 'Stale duplicate executed effects')
        require(_state(r, db, 'duplicate-after-state') == committed_state
                and _trace(r, db, 'duplicate-after-trace') == committed_trace, 'Duplicate changed state')
        duplicate_after = capture(lane, validator, db, 'duplicate-after')
        save_summary(lane, 'duplicate-original-before', compare(before, duplicate_after, validator))
        require(rejected(after, duplicate_after, validator), 'Unchanged registration was treated as new delta')
        record(r, COMMITTED_CASES[2], original_absent_contract_replayed=True, no_second_effect=True)
        # Real complete captures, with adversarial omissions and assigned XIDs;
        # never call these altered values genuine PostgreSQL observations.
        for side in (0, 1):
            pairs = copy.deepcopy([before, after])
            pairs[side][0]['drizzle_history']['capture']['xid_if_assigned'] = '99999999'
            require('ASSIGNED_XID' in rejected(*pairs, validator), 'Assigned XID was accepted')
        incomplete = copy.deepcopy(after)
        del incomplete[0]['activity']
        require(rejected(before, incomplete, validator), 'Incomplete evidence was accepted')
        record(r, COMMITTED_CASES[13], complete_real_schema_captures_mutated_for_negative_tests=True)

    with database(r, 'committed_lost_response') as db:
        _fixture(r, db, 'committed-lost', body)
        before = capture(lane, validator, db, 'lost-before')
        # Model an adapter dropping ALL successful output after COMMIT. The
        # fixture controller knows process completion only to make this finite;
        # comparison receives no response/NOTICE/status and no receipt at all.
        r.query(compile_sql(candidate, before, validator), 'committed-output-discarded', db)
        after = capture(lane, validator, db, 'lost-after')
        save_summary(lane, 'response-discarded', compare(before, after, validator))
        record(r, COMMITTED_CASES[1], modeled_adapter_output_loss_after_commit=True,
               real_network_transport_loss_tested=False, no_response_input=True)

    with database(r, 'committed_outer') as db:
        _fixture(r, db, 'committed-outer', body)
        before = capture(lane, validator, db, 'outer-before')
        with Session(r, db, 'committed_serial_writer', lane) as writer:
            writer.execute('BEGIN;' + compile_sql(candidate, before, validator), 'open-write')
            writer.keep_outer_open = True
            own = capture(SessionCapture(writer), validator, db, 'outer-own-uncommitted')
            require(own[0]['drizzle_history']['capture']['backend_pid'] == writer.backend_pid
                    and own[0]['drizzle_history']['capture']['xid_if_assigned'] is not None
                    and len(own[0]['drizzle_history']['result']['rows']) ==
                        len(before[0]['drizzle_history']['result']['rows']) + 1,
                    'Outer writer did not observe its own uncommitted row and assigned XID together')
            require('ASSIGNED_XID' in rejected(before, own, validator), 'Own uncommitted row was accepted')
            record(r, COMMITTED_CASES[3], own_row_and_assigned_xid_in_same_history_select=True)
            independent = capture(lane, validator, db, 'outer-independent-uncommitted')
            require(_same(independent[0]['drizzle_history']['result'], before[0]['drizzle_history']['result'])
                    and independent[0]['drizzle_history']['capture']['backend_pid'] != writer.backend_pid,
                    'Independent reader saw an uncommitted ledger row')
            require(rejected(before, independent, validator), 'Invisible pending write was accepted')
            record(r, COMMITTED_CASES[4], absence_does_not_authorize_retry=True)
            writer.execute('COMMIT; RESET statement_timeout; RESET lock_timeout;', 'commit')
            writer.keep_outer_open = False
            committed = capture(SessionCapture(writer), validator, db, 'outer-same-backend-committed')
            require(committed[0]['drizzle_history']['capture']['backend_pid'] == writer.backend_pid
                    and committed[0]['drizzle_history']['capture']['xid_if_assigned'] is None,
                    'Same writer backend did not show NULL XID after commit')
            save_summary(lane, 'same-backend-committed', compare(before, committed, validator))
            record(r, COMMITTED_CASES[5], identical_writer_and_observer_backend_pid=True)

    with database(r, 'committed_rollback') as db:
        _fixture(r, db, 'committed-rollback', body)
        before = capture(lane, validator, db, 'rollback-before')
        response = r.query(compile_sql(candidate, before, validator, fault='after_insert'),
                           'committed-notice-before-rollback', db, expected=3)
        require('TEST_ONLY_DEFAULT_INSERT:' in response.stdout
                and 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT' in response.stdout, 'Missing rollback witness')
        after = capture(lane, validator, db, 'rollback-after')
        require(_same(before[0]['drizzle_history']['result'], after[0]['drizzle_history']['result'])
                and rejected(before, after, validator), 'Rollback accepted as committed state')
        record(r, COMMITTED_CASES[6], notice_not_commit_proof=True, no_retry_permission=True)

    mutations = (
        ('sequence-gap', "SELECT pg_catalog.nextval('drizzle.__drizzle_migrations_id_seq');", 7),
        ('extra-row', "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('" + 'a' * 64 + "',1792093404001);", 8),
        ('catalog', "COMMENT ON FUNCTION public._crm_empresa_no_borrar_cliente() IS 'TEST_ONLY_DRIFT';", 9),
        ('bindings', 'ALTER FUNCTION pg_catalog.nextval(pg_catalog.regclass) COST 2;', 10),
        ('supabase', "UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['TEST_ONLY_DRIFT'];", 11),
        ('conflict', "UPDATE drizzle.__drizzle_migrations SET hash='" + 'b' * 64 + "' WHERE created_at=1792093404000;", 12),
    )
    for name, mutation, index in mutations:
        with database(r, 'committed_drift_' + name.replace('-', '_')) as db:
            _fixture(r, db, 'committed-drift-' + name, body)
            before = capture(lane, validator, db, name + '-before')
            r.query(compile_sql(candidate, before, validator), 'committed-' + name + '-apply', db)
            r.query(mutation, 'committed-' + name + '-mutation', db,
                    user='supabase_admin' if name == 'bindings' else 'postgres')
            after = capture(lane, validator, db, name + '-after')
            reason = rejected(before, after, validator)
            record(r, COMMITTED_CASES[index], rejection=reason, real_post_commit_fixture_mutation=True)
    checks = r.result['checks']
    require(len(checks) == len(COMMITTED_CASES) and {item['case'] for item in checks} == set(COMMITTED_CASES),
            'Incomplete committed observation matrix')
    r.result['committed_formal_projection_count'] = validator.formally_validated
    r.result['committed_bundles'] = len(list(lane.output.rglob('bundle.json')))
    r.result['committed_summaries'] = len(list(lane.output.glob('*-summary.json')))
    r.save()
