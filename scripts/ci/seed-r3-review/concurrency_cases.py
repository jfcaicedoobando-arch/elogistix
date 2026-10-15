"""Designed two-psql R3 laboratory cases. Import and offline tests execute no SQL.

Only run_concurrency(runner) may start sessions. The runner must provide the
owned-container psqlctl gate; this module accepts no DSN, command or input SQL.
Historical business routines are never called. P1 is deliberately omitted.

INTEGRATED ADAPTER CONTRACT (local integration; concurrency runtime pending):
The runner explicitly invokes these cases after the original regression matrix.
Offline mock success does not establish real two-session execution.
- runner.psqlctl(db, label) returns subprocess.Popen, text=True, bufsize=1,
  stdin=PIPE, stdout=PIPE, stderr=STDOUT. The merged stream is mandatory so an
  ERROR cannot race a success marker on a different pipe.
- Before launch, the adapter revalidates its OWN full container ID, labels,
  pinned image and isolation; it checks server_version_num == 170006 (PG17.6,
  not 171006), current/session user postgres NOSUPERUSER and no admin membership.
- It uses only docker exec -i OWN_ID psql -X -w -qAt, the private Unix socket,
  fixed postgres user, validated synthetic DB, ON_ERROR_STOP=0 and verbose errors.
  No external content, host DSN, ports, credentials, inherited PG env or shell.
- The adapter independently registers children and terminates/waits on them in
  its outer finally before shutting down the owned cluster. This module also
  closes both sessions, terminates remaining DB backends and verifies zero
  sessions before dropping each independent synthetic database.
- Existing runner.query/snapshot/check/save/output/result interfaces are used.
  postgres must still be the independently installed historical template with
  unarmed event fixture; no restore is performed in an exercised database.

The enclosing runner must mark any raised exception as failed. Importing this
module or running its mock tests is NOT runtime concurrency evidence.
"""
from contextlib import contextmanager
import copy
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import queue
import re
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent
R3_SHA256 = '7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86'
SIGS = ('seed_demo_organization_core()', 'seed_demo_organization()',
        'seed_demo_organization_guarded(bigint)', '_seed_demo_limpiar_financiero()')
TIMEOUT = 20.0


def require(value, message):
    if not value:
        raise AssertionError(message)


def primary_errors(text):
    """Parse exact ERROR SQLSTATE; fail closed on malformed or fatal diagnostics."""
    errors = []
    prefix = r'^(?:psql:[^\n]*?:\d+: )?'
    for line in text.splitlines():
        severe = re.match(prefix + r'(ERROR|FATAL|PANIC):', line)
        if severe:
            parsed = re.fullmatch(prefix + r'ERROR:\s+([0-9A-Z]{5}): (.*)', line)
            require(parsed is not None, 'Unparseable/fatal primary diagnostic: ' + line)
            errors.append(parsed.groups())
    return errors


def validate_identity(identity):
    require(identity['version'] == '170006', 'PostgreSQL 17.6 required')
    require(identity['user'] == identity['session_user'] == 'postgres'
            and identity['superuser'] is False and identity['admin_member'] is False,
            'Operator privilege mismatch')
    require(type(identity['pid']) is int and identity['pid'] > 0
            and identity['backend_start'], 'Invalid backend identity')


def validate_pair(a, b):
    validate_identity(a)
    validate_identity(b)
    require(a['pid'] != b['pid'], 'Two distinct backend PIDs required')


def first_target(snapshot):
    return min((x['row'] for x in snapshot['functions']
                if x['row']['proname'] in [s.split('(')[0] for s in SIGS]),
               key=lambda row: int(row['oid']))


@dataclass
class Reply:
    state: str
    text: str

    def ok(self):
        require(self.state == '00000' and not primary_errors(self.text), self.text)
        return self

    def json(self):
        self.ok()
        rows = [json.loads(line) for line in self.text.splitlines() if line.startswith('{')]
        require(len(rows) == 1, 'Expected one JSON object: ' + self.text)
        return rows[0]


def parse_marker(line, marker):
    match = re.fullmatch(re.escape(marker) + r' ([0-9A-Z]{5})\n?', line)
    return match.group(1) if match else None


class Session:
    """One persistent psql with merged diagnostic/output stream and finite waits."""
    def __init__(self, runner, db, label):
        self.runner, self.label = runner, label
        self.proc = runner.psqlctl(db, label)
        self.lines = queue.Queue()
        self.transcript = []
        self.pending = None
        self.closed = False
        def read():
            try:
                for line in self.proc.stdout:
                    self.lines.put(line)
            finally:
                self.lines.put(None)
        self.reader = threading.Thread(target=read, daemon=True)
        self.reader.start()
        try:
            identity = self.execute("SET statement_timeout='15s'; SET lock_timeout='3s'; SELECT jsonb_build_object('pid',pg_backend_pid(),'backend_start',backend_start::text,'version',current_setting('server_version_num'),'user',current_user,'session_user',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER')) FROM pg_stat_activity WHERE pid=pg_backend_pid();").json()
            validate_identity(identity)
            self.identity = identity
        except BaseException:
            self.close()
            raise

    def start(self, sql):
        require(not self.closed and self.pending is None, 'Session already pending/closed')
        self.pending = 'R3_MARK_' + uuid.uuid4().hex
        self.proc.stdin.write(sql + '\n\\echo ' + self.pending + ' :SQLSTATE\n')
        self.proc.stdin.flush()

    def finish(self, timeout=TIMEOUT):
        require(self.pending is not None, 'No pending command')
        marker = self.pending
        deadline = time.monotonic() + timeout
        output = []
        while True:
            remaining = deadline - time.monotonic()
            require(remaining > 0, 'Marker deadline expired: ' + self.label)
            try:
                line = self.lines.get(timeout=remaining)
            except queue.Empty as exc:
                raise AssertionError('Marker not observed: ' + self.label) from exc
            require(line is not None, 'psql exited before marker: ' + self.label)
            self.transcript.append(line)
            state = parse_marker(line, marker)
            if state is not None:
                self.pending = None
                return Reply(state, ''.join(output))
            output.append(line)

    def execute(self, sql):
        self.start(sql)
        return self.finish()

    def close(self):
        if self.closed:
            return
        # Closing the transport alone is not proof of backend cleanup. The case
        # finalizer subsequently terminates/verifies every backend for its DB.
        try:
            if self.pending is None and self.proc.poll() is None:
                self.execute('ROLLBACK;').ok()
                self.proc.stdin.write('\\q\n')
                self.proc.stdin.flush()
                self.proc.stdin.close()
                self.proc.wait(timeout=5)
            elif self.proc.poll() is None:
                self.proc.terminate()
                self.proc.wait(timeout=5)
        except Exception:
            if self.proc.poll() is None:
                self.proc.kill()
                self.proc.wait(timeout=5)
        finally:
            self.closed = True
            self.reader.join(timeout=2)
            while not self.lines.empty():
                line = self.lines.get_nowait()
                if line is not None:
                    self.transcript.append(line)
            (self.runner.output / 'logs' / (self.label + '.session.log')).write_text(''.join(self.transcript))


def blocking_record(record, waiting, holder):
    return (record.get('pid') == waiting['pid']
            and record.get('backend_start') == waiting['backend_start']
            and record.get('holder_start') == holder['backend_start']
            and record.get('wait_event_type') == 'Lock'
            and holder['pid'] in record.get('blockers', []))


def observe_block(observer, waiting, holder, timeout=2.5):
    """A timeout is failure, not evidence. Never infer blocking from elapsed time."""
    deadline = time.monotonic() + timeout
    observations = []
    while time.monotonic() < deadline:
        record = observer.execute("SELECT pg_stat_clear_snapshot(); SELECT jsonb_build_object('pid',a.pid,'backend_start',a.backend_start::text,'holder_start',h.backend_start::text,'wait_event_type',a.wait_event_type,'wait_event',a.wait_event,'blockers',pg_blocking_pids(a.pid)) FROM pg_stat_activity a CROSS JOIN pg_stat_activity h WHERE a.pid=" + str(waiting['pid']) + ' AND h.pid=' + str(holder['pid']) + ';').json()
        observations.append(record)
        if blocking_record(record, waiting, holder):
            return observations
    raise AssertionError('Required PID/backend_start/pg_blocking_pids lock edge not observed: ' + json.dumps(observations))


def body_hashes(snapshot):
    result = {}
    for item in snapshot['functions']:
        row = item['row']
        signature = row['proname'] + ('(bigint)' if row['proname'] == 'seed_demo_organization_guarded' else '()')
        if signature in SIGS:
            result[signature] = hashlib.sha256(row['prosrc'].encode()).hexdigest()
    return result


def verify_transition(before, after, stopped):
    require(body_hashes(after) == stopped, 'Four exact final body hashes required')
    require(set(before) == set(after), 'Snapshot shape changed')
    for section in before:
        if section != 'functions':
            require(before[section] == after[section], 'Changed section: ' + section)
    old_rows = {x['row']['oid']: x for x in before['functions']}
    new_rows = {x['row']['oid']: x for x in after['functions']}
    require(old_rows.keys() == new_rows.keys(), 'OID/function inventory changed')
    for oid, old in old_rows.items():
        new = new_rows[oid]
        sig = old['row']['proname'] + ('(bigint)' if old['row']['proname'] == 'seed_demo_organization_guarded' else '()')
        if sig not in SIGS:
            require(old == new, 'Unrelated function changed')
            continue
        expected = dict(old['row'])
        expected['prosrc'] = new['row']['prosrc']
        if sig == 'seed_demo_organization_guarded(bigint)':
            expected['proconfig'] = ['search_path=public', 'row_security=off']
        require(expected == new['row'], 'Metadata/ACL drift: ' + sig)


def verify_drop(postimage, partial, cleanup_oid, proc_class):
    """Only cleanup's pg_proc row and its outgoing dependencies may disappear."""
    expected = copy.deepcopy(postimage)
    removed = [x for x in expected['functions'] if int(x['row']['oid']) == int(cleanup_oid)]
    require(len(removed) == 1 and removed[0]['row']['proname'] == '_seed_demo_limpiar_financiero', 'Unexpected cleanup identity')
    expected['functions'] = [x for x in expected['functions'] if int(x['row']['oid']) != int(cleanup_oid)]
    expected['dependencies'] = [d for d in expected['dependencies']
        if not (int(d['classid']) == int(proc_class) and int(d['objid']) == int(cleanup_oid))]
    require(partial == expected, 'DROP changed another OID/ACL/config/function/object or unexpected dependency')


def cleanup_case(runner, db, name, sessions):
    errors = []
    for session in reversed(sessions):
        try:
            session.close()
        except BaseException as exc:
            errors.append(exc)
    # All close failures still reach server-side termination AND verification.
    try:
        runner.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='" + db + "' AND pid<>pg_backend_pid();", 'cc-terminate-' + name, user='supabase_admin')
    except BaseException as exc:
        errors.append(exc)
    absent = False
    try:
        deadline = time.monotonic() + 10
        while True:
            remaining = runner.query("SELECT count(*) FROM pg_stat_activity WHERE datname='" + db + "';", 'cc-no-backends-' + name, user='supabase_admin').stdout.strip()
            if remaining == '0':
                absent = True
                break
            require(time.monotonic() < deadline, 'Case backend cleanup unconfirmed')
    except BaseException as exc:
        errors.append(exc)
    if absent:
        try:
            runner.query('DROP DATABASE ' + db + ';', 'cc-drop-' + name, user='supabase_admin')
        except BaseException as exc:
            errors.append(exc)
    if errors:
        raise BaseExceptionGroup('Case cleanup failed; outer owned-cluster cleanup still required', errors)


@contextmanager
def case_sessions(runner, name):
    require(re.fullmatch(r'[a-z_]+', name), 'Unsafe case name')
    db = 'qa_r3_cc_' + name
    sessions = []
    runner.query('CREATE DATABASE ' + db + ' TEMPLATE postgres OWNER postgres;', 'cc-create-' + name, user='supabase_admin')
    try:
        for suffix in ('a', 'b'):
            sessions.append(Session(runner, db, 'cc-' + name + '-' + suffix))
        validate_pair(sessions[0].identity, sessions[1].identity)
        yield db, sessions[0], sessions[1]
    finally:
        cleanup_case(runner, db, name, sessions)


def run_concurrency(runner):
    """Run only inside the runner-owned isolated PG17.6 laboratory after matrix."""
    source = (ROOT / 'PROPOSAL_R3_rename_lock_admission.sql').read_bytes()
    require(hashlib.sha256(source).hexdigest() == R3_SHA256, 'R3 bytes changed')
    r3 = source.decode('utf-8')
    stopped = json.loads(re.search(r'\$atomic_stopped_hashes\$(.*?)\$atomic_stopped_hashes\$', r3, re.S).group(1))
    historical = json.loads(re.search(r'\$atomic_historical_hashes\$(.*?)\$atomic_historical_hashes\$', r3, re.S).group(1))
    require(callable(getattr(runner, 'psqlctl', None)), 'Persistent-session adapter not integrated; concurrency NOT_RUN')
    runner.result['concurrency_two_sessions'] = 'RUNNING'
    runner.result['historical_guarded_loaded'] = {'status': 'OMITTED', 'reason': 'Safe synthetic cooldown and absent corporate-table prerequisites not independently accredited; no historical routine invoked.'}
    runner.save()
    snapshot_sql = (ROOT / 'snapshot.sql').read_text()
    for outcome in ('commit', 'rollback'):
        with case_sessions(runner, 'writer_' + outcome) as (db, a, b):
            before = runner.snapshot(db, 'cc-before-' + outcome)
            require(body_hashes(before) == historical, 'Case must start historical')
            first = first_target(before)
            signature = next(s for s in SIGS if s.split('(')[0] == first['proname'])
            b.execute('BEGIN; ALTER FUNCTION public.' + signature + ' COST 101;').ok()
            expected_b = b.execute(snapshot_sql).json()
            a.execute('BEGIN;').ok()
            a.start(r3)
            observations = observe_block(b, a.identity, b.identity)
            b.execute(outcome.upper() + ';').ok()
            reply = a.finish()
            if outcome == 'commit':
                errors = primary_errors(reply.text)
                allowed = [('P0001', 'R2_LOCK_DRIFT: committed concurrent metadata change preserved for ' + signature), ('XX000', 'tuple concurrently updated')]
                require(len(errors) == 1 and errors[0] in allowed and reply.state == errors[0][0], 'Unexpected concurrent rejection: ' + reply.text)
                a.execute('ROLLBACK;').ok()
                require(runner.snapshot(db, 'cc-after-commit') == expected_b, 'Rejected R3 must preserve complete competing snapshot')
            else:
                reply.ok()
                a.execute('COMMIT;').ok()
                verify_transition(before, runner.snapshot(db, 'cc-after-rollback'), stopped)
            runner.check('concurrency_writer_' + outcome, lock_observations=observations, sqlstate=reply.state, primary_errors=primary_errors(reply.text))
    with case_sessions(runner, 'held_rollback') as (db, a, b):
        before = runner.snapshot(db, 'cc-before-held')
        require(body_hashes(before) == historical, 'Historical baseline required')
        a.execute('BEGIN;').ok()
        a.execute(r3).ok()  # marker establishes completed R3, transaction held open
        visible = b.execute(snapshot_sql).json()
        require(visible == before, 'Other session must still see historical snapshot')
        b.execute("CREATE FUNCTION qa_owned.cc_unrelated() RETURNS integer LANGUAGE sql AS 'SELECT 1';").ok()
        observations = []
        for signature in SIGS:
            b.start("SET lock_timeout='2s'; ALTER FUNCTION public." + signature + ' COST 101;')
            observations.append(observe_block(a, b.identity, a.identity, timeout=1.5))
            reply = b.finish()
            require(reply.state == '55P03' and primary_errors(reply.text) == [('55P03', 'canceling statement due to lock timeout')], 'Exact lock timeout required: ' + reply.text)
        a.execute('ROLLBACK;').ok()
        b.execute('DROP FUNCTION qa_owned.cc_unrelated();').ok()
        require(runner.snapshot(db, 'cc-after-held') == before, 'Held rollback must restore complete baseline')
        runner.check('concurrency_held_rollback', lock_observations=observations, locked_routes=4, unrelated_ddl_succeeded=True, global_pg_proc_lock_claim=False)
    with case_sessions(runner, 'queued_drop') as (db, a, b):
        before = runner.snapshot(db, 'cc-before-drop')
        require(body_hashes(before) == historical, 'Historical baseline required')
        a.execute('BEGIN;').ok()
        a.execute(r3).ok()
        postimage = a.execute(snapshot_sql).json()
        verify_transition(before, postimage, stopped)
        cleanup_oid = next(x['row']['oid'] for x in postimage['functions'] if x['row']['proname'] == '_seed_demo_limpiar_financiero')
        proc_class = a.execute("SELECT jsonb_build_object('oid','pg_catalog.pg_proc'::regclass::oid);").json()['oid']
        b.execute("SET lock_timeout='10s';").ok()
        b.start('DROP FUNCTION public._seed_demo_limpiar_financiero();')
        observations = observe_block(a, b.identity, a.identity)
        a.execute('COMMIT;').ok()
        b.finish().ok()
        partial = runner.snapshot(db, 'cc-after-drop')
        remaining = dict(stopped)
        del remaining['_seed_demo_limpiar_financiero()']
        require(body_hashes(partial) == remaining, 'Three remaining stopped bodies required')
        verify_drop(postimage, partial, cleanup_oid, proc_class)
        reply = a.execute(r3)
        require(reply.state == 'P0001' and primary_errors(reply.text) == [('P0001', 'ADMISSION_PREFLIGHT: four existing routes required')], 'Partial state must reject exactly')
        require(runner.snapshot(db, 'cc-after-partial-rejection') == partial, 'Partial-state rejection changed snapshot')
        runner.check('concurrency_queued_drop', classification='LIMIT_NOT_POSTCOMMIT_SECURITY', lock_observations=observations, no_cascade=True, partial_state_rejected=True)
    runner.result['concurrency_two_sessions'] = 'PASS'
    runner.save()
