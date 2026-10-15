"""Owned synthetic experiments for the pinned public event handler.

This is a test module, not an operational renderer, transport adapter, admission
policy, or application API. It accepts only the inherited owned CRM runner. The
public handler is never instrumented. A separate TEST_ONLY tracer records event
invocations, including nontransactional NOTICE evidence on a rollback path.

Notification absence is measured only between observed positive-control commits
on an independently connected LISTEN client. It says nothing about external
consumers, work queues, a live target, or an operational DDL/ACL window.
"""
import codecs
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import time

from cases import F, database
from direct_wrapper import capture_sql, json_sql, normalized, render, sequence_state_sql
from envelope import render_review_proposal
from public_source import BODY_SHA256, verify_source
from test_operational_capture import require_readonly_query
from wrapper_cases import _capture, _setup, owner_only


ROOT = Path(__file__).resolve().parent
REPOSITORY = ROOT.parents[2]
CAPTURE_PACKAGE = ROOT.parent / 'crm-canonical-review' / 'operational-capture'
CANONICAL_SHA256 = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
NOTIFICATION = re.compile(
    r'Asynchronous notification "pgrst" with payload "([^"\r\n]*)" '
    r'received from server process with PID ([0-9]+)\.')
EVENT_CASES = (
    'event-public-source-integrity',
    'event-public-source-tamper-rejected',
    'event-projection-syntax-events',
    'event-lab-renderer-stays-fenced',
    'event-operational-proposal-stays-fenced',
    'event-positive-create-commit',
    'event-positive-create-rollback',
    'event-exact-canonical-commit-nobypassrls',
    'event-registered-readonly-nobypassrls',
    'event-rollback-after-default-insert-nobypassrls',
    'event-exact-canonical-commit-bypassrls',
    'event-registered-readonly-bypassrls',
    'event-rollback-after-default-insert-bypassrls',
)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def _save(r, label, value):
    (r.output / (label + '.json')).write_text(json.dumps(value, indent=2) + '\n', encoding='utf8')


def _literal(value):
    return "'" + value.replace("'", "''") + "'"


class _Listener:
    """One registered psql client; no thread or competing pipe reader.

    selectors/os.read are used only in Linux Actions. Until finish_session is
    called, the TextIOWrapper is never read, so it has no hidden buffered input.
    Consumed bytes and finish_session's remaining output are saved together.
    """
    def __init__(self, r, db, label):
        require(re.fullmatch(r'[a-z0-9_-]+', label), 'Unsafe synthetic listener label')
        self.r, self.db, self.label = r, db, label
        self.process = None
        self.selector = None
        self.decoder = codecs.getincrementaldecoder('utf8')('strict')
        self.output = ''
        self.commands = []
        self.counter = 0
        self.before_index = None
        self.after_index = None
        self.backend_pid = None
        self.control_pids = []

    def _record(self, sql):
        self.commands.append(sql)
        (self.r.output / 'logs' / (self.label + '-full.sql')).write_text(
            '\n'.join(self.commands) + '\n', encoding='utf8')

    def _release(self, sql):
        self._record(sql)
        self.r.release(self.process, sql)

    def _read_until(self, predicate, label, timeout=8):
        deadline = time.monotonic() + timeout
        while not predicate():
            remaining = deadline - time.monotonic()
            require(remaining > 0, self.label + ': listener barrier timed out: ' + label)
            ready = self.selector.select(min(.2, remaining))
            if not ready:
                require(self.process.poll() is None, self.label + ': listener exited before ' + label)
                continue
            raw = os.read(self.process.stdout.fileno(), 65536)
            require(raw, self.label + ': listener EOF before ' + label)
            self.output += self.decoder.decode(raw)

    def _notifications(self):
        return [{'payload': m[0], 'pid': int(m[1])} for m in NOTIFICATION.findall(self.output)]

    def __enter__(self):
        ready = 'TEST_ONLY_LISTENER_READY_' + self.label
        sql = ("SET application_name=" + _literal('test_only_' + self.label) + ";"
               "LISTEN pgrst;SELECT " + _literal(ready + ':') + "||pg_catalog.pg_backend_pid();")
        self._record(sql)
        self.process = self.r.session(sql, self.label, self.db)
        self.selector = selectors.DefaultSelector()
        self.selector.register(self.process.stdout.fileno(), selectors.EVENT_READ)
        try:
            pattern = re.compile(re.escape(ready) + r':([0-9]+)')
            self._read_until(lambda: pattern.search(self.output) is not None, 'LISTEN-ready')
            self.backend_pid = int(pattern.search(self.output)[1])
            # LISTEN is its own committed statement before the SELECT marker.
            # This second connection confirms that the measured PID is our client.
            observed = json.loads(self.r.query(
                "SELECT pg_catalog.jsonb_build_object('pid',pid,'user',usename,'database',datname) "
                "FROM pg_catalog.pg_stat_activity WHERE pid=" + str(self.backend_pid) + ';',
                self.label + '-independent-client', self.db, user='supabase_admin').stdout)
            require(observed == {'pid': self.backend_pid, 'user': 'postgres', 'database': self.db},
                    self.label + ': independent listener identity mismatch')
            self.before_index = self._control('before')
            return self
        except BaseException:
            self.__exit__(*__import__('sys').exc_info())
            raise

    def _control(self, phase):
        self.counter += 1
        payload = 'TEST_ONLY_CONTROL_' + phase + '_' + self.label
        # This is a genuine independent sending backend, not a notification
        # synthesized by the listener or an assumed transport side effect.
        sender = self.r.query("SELECT pg_catalog.pg_backend_pid();NOTIFY pgrst," + _literal(payload) + ';',
                              self.label + '-' + phase + '-control-send', self.db)
        sender_pid = int(sender.stdout.strip())
        require(sender_pid != self.backend_pid, self.label + ': control sender is not independent')
        marker = 'TEST_ONLY_DRAIN_' + str(self.counter) + '_' + self.label
        self._release('SELECT ' + _literal(marker) + ';')
        self._read_until(lambda: marker in self.output and any(
            n['payload'] == payload for n in self._notifications()), phase + '-positive-control')
        matching = [(index, n) for index, n in enumerate(self._notifications()) if n['payload'] == payload]
        require(len(matching) == 1 and matching[0][1]['pid'] == sender_pid,
                self.label + ': control delivery was duplicated or came from another backend')
        self.control_pids.append(sender_pid)
        return matching[0][0]

    def finish_measurement(self, expected_reload_count):
        self.after_index = self._control('after')
        messages = self._notifications()
        require(self.before_index < self.after_index, self.label + ': positive-control order reversed')
        measured = messages[self.before_index + 1:self.after_index]
        require(all(n['payload'] == 'reload schema' for n in measured),
                self.label + ': unexpected notification in owned fixture interval')
        require(len(measured) == expected_reload_count,
                self.label + ': unexpected schema notification count: ' + str(measured))
        result = {'listener_pid': self.backend_pid, 'independent_control_pids': self.control_pids,
                  'before_control_observed': True, 'after_control_observed': True,
                  'notifications_between_controls': measured,
                  'scope': 'BOUNDED_SYNTHETIC_COMMIT_INTERVAL_ONLY'}
        _save(self.r, self.label + '-notification-measurement', result)
        return result

    def __exit__(self, exc_type, exc_value, traceback):
        if self.selector is not None:
            self.selector.close()
            self.selector = None
        if self.process is not None:
            process, self.process = self.process, None
            try:
                self._record('\\q')
                if process.poll() is None:
                    self.r.release(process, '\\q')
            finally:
                response = self.r.finish_session(process, self.label,
                                                 expected=0 if exc_type is None else None)
                self.output += self.decoder.decode(b'', final=True) + response.stdout
                (self.r.output / 'logs' / (self.label + '.stdout')).write_text(self.output, encoding='utf8')
        return False


def _function_sql(body):
    if (type(body) is not bytes or len(body) != 729
            or hashlib.sha256(body).hexdigest() != BODY_SHA256
            or body.decode('utf8').encode('utf8') != body or b'\r' in body):
        raise ValueError('CRM_EVENT_SOURCE_BODY_BYTES')
    tag = '$test_only_public_pgrst_source$'
    require(tag.encode('ascii') not in body, 'Public source collides with fixture dollar tag')
    return ('CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger LANGUAGE plpgsql AS '
            + tag + body.decode('utf8') + tag + ';')


def _fixture(r, db, label, body):
    _setup(r, db, label)
    # Numeric version is solely a synthetic metadata-projection witness.
    r.query("UPDATE supabase_migrations.schema_migrations SET version='20000101000000';"
            'CREATE SCHEMA extensions AUTHORIZATION postgres;'
            'CREATE TABLE public.test_only_event_trace('
            'ordinal bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,event text NOT NULL,'
            'tag text NOT NULL,commands jsonb NOT NULL);' + _function_sql(body) + """
CREATE FUNCTION public.test_only_event_trace_handler() RETURNS event_trigger
LANGUAGE plpgsql AS $test_only_trace$
DECLARE observed jsonb;
BEGIN
  SELECT pg_catalog.jsonb_build_object('event',TG_EVENT,'tag',TG_TAG,'commands',
    COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'classid',classid,'objid',objid,'objsubid',objsubid,'command_tag',command_tag,
      'object_type',object_type,'schema_name',schema_name,'object_identity',object_identity,
      'in_extension',in_extension) ORDER BY classid,objid,objsubid,command_tag),'[]'::jsonb))
    INTO observed FROM pg_catalog.pg_event_trigger_ddl_commands();
  INSERT INTO public.test_only_event_trace(event,tag,commands)
    VALUES (TG_EVENT,TG_TAG,observed->'commands');
  RAISE NOTICE 'TEST_ONLY_EVENT_TRACE:%',observed;
END
$test_only_trace$;
""", label + '-event-functions-fixture', db)
    # PostgreSQL requires superuser to CREATE EVENT TRIGGER. Only this owned
    # fixture bootstrap uses the harness's synthetic administrator. Candidate
    # and verification statements always connect as NOSUPERUSER postgres.
    r.query("CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end "
            "EXECUTE FUNCTION extensions.pgrst_ddl_watch();"
            "CREATE EVENT TRIGGER test_only_trace ON ddl_command_end "
            "EXECUTE FUNCTION public.test_only_event_trace_handler();",
            label + '-event-triggers-admin-fixture', db, user='supabase_admin')
    _clear_trace(r, db, label)
    definitions = _extensions(r, db, label + '-installed-handler')
    handler = next(p for p in definitions['functions'] if p['proname'] == 'pgrst_ddl_watch')
    require(handler['prosrc'].encode('utf8') == body and not handler['prosecdef']
            and handler['proconfig'] is None, 'Installed public handler body/profile differs')
    require(len(definitions['events']) == 2 and all(
        e['evtevent'] == 'ddl_command_end' and e['evtenabled'] == 'O' and e['evttags'] is None
        for e in definitions['events']), 'Fixture event trigger definitions differ')


def _extensions(r, db, label):
    result = json.loads(r.query("""SELECT pg_catalog.jsonb_build_object(
 'namespace',(SELECT pg_catalog.to_jsonb(n) FROM pg_catalog.pg_namespace n WHERE n.nspname='extensions'),
 'functions',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY p.oid),'[]')
   FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='extensions'),
 'events',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) ORDER BY e.oid),'[]') FROM pg_catalog.pg_event_trigger e),
 'event_functions',(SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) ORDER BY p.oid),'[]')
   FROM pg_catalog.pg_proc p WHERE p.oid IN (SELECT evtfoid FROM pg_catalog.pg_event_trigger)));
""", label, db).stdout)
    _save(r, label, result)
    return result


def _state(r, db, label):
    return {'contract': _capture(r, db, label), 'extensions': _extensions(r, db, label + '-extensions')}


def _trace(r, db, label):
    rows = json.loads(r.query("SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t) ORDER BY ordinal),'[]') "
                              'FROM public.test_only_event_trace t;', label, db).stdout)
    _save(r, label, rows)
    return rows


def _clear_trace(r, db, label):
    r.query('DELETE FROM public.test_only_event_trace;', label + '-clear-trace', db)


def _context(r, db, label, bypass):
    observed = json.loads(r.query("SELECT pg_catalog.jsonb_build_object('user',current_user,'session_user',session_user,"
        "'superuser',rolsuper,'bypass_rls',rolbypassrls,'admin_member',"
        "pg_catalog.pg_has_role(current_user,'supabase_admin','MEMBER')) "
        'FROM pg_catalog.pg_roles WHERE rolname=current_user;', label, db).stdout)
    require(observed == {'user': 'postgres', 'session_user': 'postgres', 'superuser': False,
                         'bypass_rls': bypass, 'admin_member': False}, 'Synthetic execution profile mismatch')
    _save(r, label, observed)


def _apply_sql(candidate, when, *, fault=False):
    """A test experiment only: not the fenced operational proposal or LAB renderer.

    Full catalog/ledger/sequence preservation is compared independently by the
    Python controller. This intentionally does not implement operational gates.
    """
    require(type(candidate) is bytes and hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256,
            'Event experiment canonical bytes differ')
    require(candidate.decode('utf8').encode('utf8') == candidate, 'Canonical UTF-8 roundtrip differs')
    return """-- TEST_ONLY owned-fixture experiment, not an application envelope.
SET statement_timeout='20s';
DO $test_only_event_experiment$
DECLARE
  v_payload constant bytea := pg_catalog.decode('""" + candidate.hex() + """','hex');
  v_sql text;
  v_inserted jsonb;
BEGIN
  IF current_database() !~ '^crm_acl_fixture_[a-z0-9_]+$'
     OR current_user<>'postgres' OR session_user<>'postgres'
     OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user)
     OR current_setting('server_version_num')<>'170006'
     OR current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_CONTEXT';
  END IF;
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  LOCK TABLE ONLY drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  LOCK TABLE ONLY supabase_migrations.schema_migrations IN SHARE MODE NOWAIT;
  LOCK TABLE ONLY public.crm_empresas IN SHARE UPDATE EXCLUSIVE MODE NOWAIT;
  IF pg_catalog.encode(pg_catalog.sha256(v_payload),'hex')<>'""" + CANONICAL_SHA256 + """' THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_CANONICAL_SHA256';
  END IF;
  v_sql:=pg_catalog.convert_from(v_payload,'UTF8');
  IF pg_catalog.convert_to(v_sql,'UTF8') IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_CANONICAL_ROUNDTRIP';
  END IF;
  EXECUTE v_sql;
  INSERT INTO drizzle.__drizzle_migrations(hash,created_at)
    VALUES ('""" + CANONICAL_SHA256 + "'," + str(when) + """ )
    RETURNING pg_catalog.to_jsonb(__drizzle_migrations) INTO v_inserted;
  RAISE NOTICE 'TEST_ONLY_DEFAULT_INSERT:%',v_inserted;
""" + ("  RAISE EXCEPTION 'TEST_ONLY_EVENT_AFTER_INSERT';\n" if fault else '') + """END
$test_only_event_experiment$;
"""


def _verify_registered_sql(state):
    contract = state['contract']
    state_select = sequence_state_sql(contract['sequence_name']).strip().removesuffix(';')
    return """-- TEST_ONLY verification experiment; not operational retry admission.
BEGIN READ ONLY;
DO $test_only_registered_read$
DECLARE
  v_rows jsonb;
  v_sequence jsonb;
BEGIN
  IF current_database()<>""" + _literal(contract['context']['database']) + """
     OR current_user<>'postgres' OR session_user<>'postgres'
     OR current_setting('transaction_read_only')<>'on' THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_VERIFY_CONTEXT';
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY id),'[]')
    INTO v_rows FROM drizzle.__drizzle_migrations d;
  """ + state_select + " INTO v_sequence;\n" + """
  IF v_rows IS DISTINCT FROM """ + json_sql(contract['drizzle']) + """
     OR v_sequence IS DISTINCT FROM """ + json_sql(contract['sequence_state']) + """ THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_REGISTERED_HISTORY_OR_SEQUENCE';
  END IF;
  IF (SELECT count(*) FROM pg_catalog.pg_proc p
      WHERE p.oid=ANY(ARRAY['""" + F[0] + "'::regprocedure::oid,'" + F[1] + """'::regprocedure::oid])
        AND p.proacl=ARRAY['postgres=X/postgres']::aclitem[]
        AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        AND NOT pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE'))<>2 THEN
    RAISE EXCEPTION 'TEST_ONLY_EVENT_REGISTERED_ACL';
  END IF;
END
$test_only_registered_read$;
COMMIT;
"""


def _registered(before, after, when):
    old, new = before['contract'], after['contract']
    require(normalized(old['catalog']) == normalized(new['catalog']),
            'Canonical experiment changed metadata other than exact two helper service-role ACL dependencies')
    require(before['extensions'] == after['extensions'], 'Event handlers or event definitions changed')
    require(old['supabase'] == new['supabase'], 'Supabase history changed')
    require(new['drizzle'][:-1] == old['drizzle'] and len(new['drizzle']) == len(old['drizzle']) + 1,
            'Default registration did not preserve all prior Drizzle rows')
    inserted = new['drizzle'][-1]
    require(set(inserted) == {'id', 'hash', 'created_at'} and inserted['hash'] == CANONICAL_SHA256
            and inserted['created_at'] == when and type(inserted['id']) is int
            and inserted['id'] > max(row['id'] for row in old['drizzle']), 'Unexpected default-generated registration')
    require(new['sequence_state'] == {'last_value': inserted['id'], 'is_called': True},
            'Measured sequence does not match actual RETURNING/default-generated registration')
    require(inserted['id'] == old['sequence_state']['last_value'] + int(old['sequence_state']['is_called']),
            'Default did not use the measured next value of the fixture serial sequence')
    for key in ('context', 'sequence_name', 'ledger_default', 'scope'):
        require(old[key] == new[key], 'Registration changed ' + key)
    return inserted


def _require_revoke_trace(rows, output):
    require(len(rows) == 2 and all(row['event'] == 'ddl_command_end' and row['tag'] == 'REVOKE' for row in rows),
            'Expected exactly two REVOKE ddl_command_end invocations')
    require(all(isinstance(row['commands'], list) and all(command['command_tag'] == 'REVOKE'
                for command in row['commands']) for row in rows), 'Unexpected collected DDL command tag')
    require(output.count('TEST_ONLY_EVENT_TRACE:') == 2, 'Tracer NOTICE evidence count differs')


def _projection(r, db):
    before = _state(r, db, 'event-projection-before')
    trace_before = _trace(r, db, 'event-projection-trace-before')
    results = {}
    files = sorted(CAPTURE_PACKAGE.glob('*.sql'))
    require(len(files) == 6, 'Projection SQL file set differs')
    for index, file in enumerate(files, 1):
        sql = file.read_text(encoding='utf8')
        require_readonly_query(sql)
        result = json.loads(r.query('BEGIN READ ONLY;' + sql + 'COMMIT;',
                                    'event-projection-' + file.stem, db).stdout)
        require(result['kind'] == 'crm-operational-evidence-v1' and result['admission'] == 'NOT_ADMITTED',
                'Projection accidentally claimed admission')
        results[result['section']] = result
        _save(r, 'projection-' + str(index).zfill(2) + '_' + file.stem.split('_', 1)[1], result)
    generated = results['discovery']['result']['sequence']['state_select']
    require_readonly_query(generated)
    sequence = json.loads(r.query('BEGIN READ ONLY;' + generated + 'COMMIT;',
                                  'event-projection-generated-sequence', db).stdout)
    require(sequence['result']['identity_matches'] is True, 'Projection sequence identity mismatch')
    _save(r, 'projection-07_sequence', sequence)
    require(results['catalog']['result']['event_triggers'], 'Active event metadata was not projected')
    require(results['supabase_page']['result']['page_rows'][0]['version'] == '20000101000000',
            'Synthetic numeric Supabase version projection differs')
    require(_state(r, db, 'event-projection-after') == before, 'Read-only projection changed fixture state')
    require(_trace(r, db, 'event-projection-trace-after') == trace_before, 'Projection invoked DDL event tracer')
    r.check('event-projection-syntax-events', exact_select_files=6, generated_sequence_select=True,
            active_event_metadata=True, catalog_ledgers_and_sequence_unchanged=True,
            formal_json_schema_validation='SEPARATE_WORKFLOW_STEP', operational_admission='NOT_ADMITTED')


def run_event_cases(r):
    """Append exactly EVENT_CASES on inherited owned disposable fixtures."""
    start = len(r.result['checks'])
    public = verify_source()
    body = public['body']
    candidate = (REPOSITORY / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()
    require(hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256, 'Canonical SQL changed')
    entries = json.loads((REPOSITORY / 'drizzle/migrations/meta/_journal.json').read_text(encoding='utf8'))['entries']
    selected = [e for e in entries if e['tag'] == '0021_crm_helpers_owner_only']
    require(len(selected) == 1 and type(selected[0]['when']) is int, 'Canonical journal entry differs')
    when = selected[0]['when']
    r.check('event-public-source-integrity', public_source_sha256=public['source_sha256'],
            public_body_sha256=public['body_sha256'], body_bytes=len(body),
            literal_upstream_extraction=True, license_preserved=True)
    try:
        _function_sql(body + b'\n')
    except ValueError as exc:
        require(str(exc) == 'CRM_EVENT_SOURCE_BODY_BYTES', 'Unexpected source tamper diagnostic')
    else:
        raise RuntimeError('Tampered handler was accepted')
    r.check('event-public-source-tamper-rejected', rejected_before_sql_generation=True,
            database_actions_for_tampered_source=0)

    with database(r, 'events_controls') as db:
        _fixture(r, db, 'event-controls', body)
        _context(r, db, 'event-controls-context', False)
        _projection(r, db)
        before = _state(r, db, 'event-lab-fence-before')
        try:
            render(before['contract'], candidate)
        except ValueError as exc:
            require(str(exc) == 'CRM_DIRECT_EVENT_TRIGGERS_UNSUPPORTED_IN_LAB', 'LAB admission failed for another reason')
        else:
            raise RuntimeError('LAB renderer admitted active event triggers')
        require(_state(r, db, 'event-lab-fence-after') == before, 'LAB rejection changed state')
        r.check('event-lab-renderer-stays-fenced', active_event_triggers_rejected=True,
                no_sql_generated=True, operational_admission='NOT_ADMITTED')

        proposal = render_review_proposal(candidate, {'kind': 'crm-operational-evidence-v1', 'admission': 'NOT_ADMITTED'})
        with _Listener(r, db, 'event-proposal-fence-listener') as listener:
            failed = r.query(proposal, 'event-operational-proposal-rejected', db, expected=3)
            require(re.search(r'^ERROR:\s+P0001: CRM_OPERATIONAL_NOT_ADMITTED$', failed.stdout, re.M), failed.stdout)
            listener.finish_measurement(0)
        require(_state(r, db, 'event-operational-fence-after') == before, 'Fenced proposal changed state')
        require(not _trace(r, db, 'event-operational-fence-trace'), 'Fenced proposal invoked DDL')
        r.check('event-operational-proposal-stays-fenced', sqlstate='P0001', no_ddl_no_rows_no_nextval=True,
                operational_admission='NOT_ADMITTED')

        with _Listener(r, db, 'event-positive-commit-listener') as listener:
            response = r.query('CREATE TABLE public.test_only_positive_commit(value integer);',
                               'event-positive-create-commit', db)
            listener.finish_measurement(1)
        trace = _trace(r, db, 'event-positive-create-commit-trace')
        require(len(trace) == 1 and trace[0]['tag'] == 'CREATE TABLE'
                and response.stdout.count('TEST_ONLY_EVENT_TRACE:') == 1, 'CREATE commit tracer mismatch')
        require(_extensions(r, db, 'event-positive-commit-handlers') == before['extensions'],
                'Positive control changed event handler definitions')
        r.check('event-positive-create-commit', independent_listener_observed_reload_schema=1,
                exact_public_handler_active=True)

        _clear_trace(r, db, 'event-positive-rollback')
        rollback_before = _state(r, db, 'event-positive-rollback-before')
        with _Listener(r, db, 'event-positive-rollback-listener') as listener:
            response = r.query('BEGIN;CREATE TABLE public.test_only_positive_rollback(value integer);ROLLBACK;',
                               'event-positive-create-rollback', db)
            listener.finish_measurement(0)
        require(response.stdout.count('TEST_ONLY_EVENT_TRACE:') == 1, 'Rolled-back CREATE did not invoke tracer')
        require(not _trace(r, db, 'event-positive-create-rollback-trace'), 'Rolled-back tracer rows survived')
        require(_state(r, db, 'event-positive-rollback-after') == rollback_before,
                'Rolled-back CREATE changed catalog, ledger, or Drizzle sequence')
        r.check('event-positive-create-rollback', handler_invocation_observed_before_rollback=True,
                no_notification_between_observed_controls=True, complete_transactional_rollback=True)

    original_bypass = r.query("SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname='postgres';",
                              'event-original-synthetic-bypass').stdout.strip()
    require(original_bypass in ('t', 'f'), 'Could not measure original synthetic role BYPASSRLS')
    try:
        for bypass in (False, True):
            mode = 'bypassrls' if bypass else 'nobypassrls'
            r.query('ALTER ROLE postgres ' + ('BYPASSRLS' if bypass else 'NOBYPASSRLS') + ';',
                    'event-role-fixture-' + mode, user='supabase_admin')
            with database(r, 'events_commit_' + mode) as db:
                label = 'event-commit-' + mode
                _fixture(r, db, label, body)
                _context(r, db, label + '-context', bypass)
                before = _state(r, db, label + '-before')
                with _Listener(r, db, label + '-listener') as listener:
                    response = r.query(_apply_sql(candidate, when), label + '-apply', db)
                    listener.finish_measurement(0)
                _require_revoke_trace(_trace(r, db, label + '-trace'), response.stdout)
                after = _state(r, db, label + '-after')
                inserted = _registered(before, after, when)
                owner_only(r, db, label + '-owner-only')
                require(response.stdout.count('TEST_ONLY_DEFAULT_INSERT:') == 1, 'Default INSERT RETURNING not observed')
                r.check('event-exact-canonical-commit-' + mode, canonical_sha256=CANONICAL_SHA256,
                        nosuperuser=True, bypass_rls=bypass, revoke_event_invocations=2,
                        independent_listener_reload_schema=0, default_generated_id=inserted['id'],
                        exact_acl_dependency_normalization=True, prior_histories_and_handlers_preserved=True,
                        operational_admission='NOT_ADMITTED')

                _clear_trace(r, db, label + '-registered')
                verify_before = _state(r, db, label + '-registered-before')
                with _Listener(r, db, label + '-verify-listener') as listener:
                    r.query(_verify_registered_sql(verify_before), label + '-registered-readonly', db)
                    listener.finish_measurement(0)
                require(not _trace(r, db, label + '-registered-trace'), 'Registered verification invoked DDL')
                require(_state(r, db, label + '-registered-after') == verify_before,
                        'Registered verification changed catalog, history, or sequence')
                r.check('event-registered-readonly-' + mode, read_only_transaction=True,
                        no_ddl_no_notify_no_new_row_no_nextval=True, operational_retry_admission='NOT_IMPLEMENTED')

            with database(r, 'events_rollback_' + mode) as db:
                label = 'event-rollback-' + mode
                _fixture(r, db, label, body)
                _context(r, db, label + '-context', bypass)
                before = _state(r, db, label + '-before')
                with _Listener(r, db, label + '-listener') as listener:
                    response = r.query(_apply_sql(candidate, when, fault=True), label + '-apply', db, expected=3)
                    require(re.search(r'^ERROR:\s+P0001: TEST_ONLY_EVENT_AFTER_INSERT$', response.stdout, re.M), response.stdout)
                    listener.finish_measurement(0)
                require(response.stdout.count('TEST_ONLY_EVENT_TRACE:') == 2
                        and response.stdout.count('TEST_ONLY_DEFAULT_INSERT:') == 1,
                        'Rollback path did not reach two REVOKEs and actual default INSERT')
                require(not _trace(r, db, label + '-trace'), 'Transactional tracer rows survived failed DO')
                after = _state(r, db, label + '-after')
                expected, actual = copy.deepcopy(before), copy.deepcopy(after)
                old_sequence = expected['contract'].pop('sequence_state')
                new_sequence = actual['contract'].pop('sequence_state')
                require(expected == actual, 'Failed DO changed catalog, ACLs, handlers, or ledger rows')
                require(new_sequence == {'last_value': old_sequence['last_value'] + 1, 'is_called': True},
                        'Default nextval rollback gap was not observed')
                r.check('event-rollback-after-default-insert-' + mode, sqlstate='P0001',
                        revoke_invocations_observed=2, insert_returning_observed=True,
                        acl_catalog_ledgers_and_handlers_rolled_back=True, nontransactional_sequence_gap=True,
                        no_notification_between_observed_controls=True)
    finally:
        r.query('ALTER ROLE postgres ' + ('BYPASSRLS' if original_bypass == 't' else 'NOBYPASSRLS') + ';',
                'event-restore-synthetic-role-bypass', user='supabase_admin')
        require(r.query("SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname='postgres';",
                        'event-confirm-synthetic-role-restored').stdout.strip() == original_bypass,
                'Synthetic role BYPASSRLS restoration failed')
    r.result['synthetic_role_variants_restored'] = True
    r.result['unreviewed_event_schema_policy'] = 'NOT_RUN_NO_POLICY_OR_OPERATIONAL_ADMISSION'
    r.result['external_consumer_queues_and_ddl_acl_window'] = 'NOT_RUN_REQUIRES_EXTERNAL_COORDINATION'
    checks = r.result['checks'][start:]
    require(tuple(item['case'] for item in checks) == EVENT_CASES
            and all(item['status'] == 'pass' for item in checks), 'Incomplete event case matrix')
    r.save()
    return checks
