#!/usr/bin/env python3
"""Two authenticated KAM sessions; callable only from the verified clone adapter."""
from dataclasses import dataclass
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import uuid

COMMAND_SECONDS = 25
BARRIER_SECONDS = 8
SUITE_SECONDS = 120
CLONE_PATTERN = r'crm_prospecto_kam_[0-9a-f]{32}'
SIGNATURE = 'public.crm_empresa_pasar_a_prospecto(uuid)'


def require(condition, message):
    if not condition:
        raise RuntimeError('CRM_PROSPECTO_KAM_ASSERT: ' + message)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def one_json(lines, label):
    if isinstance(lines, str):
        lines = lines.splitlines()
    rows = [json.loads(line) for line in lines if line.strip()]
    require(len(rows) == 1, label + ': exactly one JSON row required')
    return rows[0]


# Hashes, not app row contents, leave the source database. Statistics altered
# by read-only access are excluded; data, sequence values and security stay fixed.
FINGERPRINT_SQL = r"""
SELECT format($q$SELECT jsonb_build_object('table',%L,'rows',count(*),'digest',
 md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')))
 FROM %I.%I t;$q$,n.nspname||'.'||c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p','S') ORDER BY n.nspname,c.relname
\gexec
SELECT jsonb_build_object('catalog',kind,'digest',md5(coalesce(string_agg(row_text,E'\n' ORDER BY row_text),'')))
FROM (
 SELECT 'functions' AS kind,to_jsonb(p)::text AS row_text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'constraints',to_jsonb(c)::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'triggers',to_jsonb(t)::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'relations',(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'])::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')
 UNION ALL SELECT 'policies',to_jsonb(p)::text FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')
) x GROUP BY kind ORDER BY kind;
"""


@dataclass
class Context:
    psql_argv: list
    env: dict
    evidence_dir: Path
    database: str
    source_commit: str
    body_md5: str

    def query(self, sql, label, timeout=25):
        result = subprocess.run(self.psql_argv, env=self.env, input=sql, text=True,
                                capture_output=True, timeout=timeout)
        require(result.returncode == 0, label + ': psql failed: ' + result.stderr)
        require(not re.search(r'(^|\n)(WARNING|ERROR|FATAL):', result.stderr),
                label + ': unexpected server diagnostic: ' + result.stderr)
        return result.stdout, result.stderr


def fingerprint(context):
    stdout, _ = context.query(FINGERPRINT_SQL, 'source-fingerprint')
    rows = [json.loads(line) for line in stdout.splitlines() if line.strip()]
    require(rows and any(row.get('catalog') == 'functions' for row in rows), 'Incomplete source fingerprint')
    return sorted(rows, key=lambda row: json.dumps(row, sort_keys=True))


SESSION_HELPERS = r"""
SET statement_timeout='20s';
SET lock_timeout='18s';
SET idle_in_transaction_session_timeout='45s';
CREATE FUNCTION pg_temp.invoke(company uuid, actor uuid, tenant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $helper$
DECLARE result jsonb; denied boolean := false; caller text := current_user;
BEGIN
 IF caller <> 'authenticated' OR auth.uid() IS DISTINCT FROM actor
    OR auth.role() IS DISTINCT FROM 'authenticated' OR public.org_scope() IS DISTINCT FROM tenant
    OR NOT EXISTS(SELECT 1 FROM public.organization_members
                  WHERE user_id=actor AND organization_id=tenant AND role::text='vendedor') THEN
   RAISE EXCEPTION 'CRM_PROSPECTO_KAM_BAD_AUTH';
 END IF;
 BEGIN
   PERFORM public._assert_writer(tenant);
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'CRM_PROSPECTO_KAM_WRITER_BYPASS'; END IF;
 result := public.crm_empresa_pasar_a_prospecto(company);
 RETURN jsonb_build_object('value',result,'caller',caller,'subject',auth.uid(),'tenant',tenant);
END $helper$;
SELECT jsonb_build_object('pid',pg_backend_pid(),'session_user',session_user,'current_user',current_user);
"""


class Session:
    def __init__(self, harness, label):
        self.h, self.label = harness, label
        self.application_name = 'crm-kam-' + uuid.uuid4().hex
        self.pending = None
        self.actor = None
        self.pid = None
        self.closed = False
        self.lines = queue.Queue()
        self.logs = [(harness.out / (label + suffix)).open('w')
                     for suffix in ('.stdout.log', '.stderr.log', '.sql')]
        self.process = subprocess.Popen(harness.context.psql_argv, env=harness.context.env,
                                        text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, bufsize=1)
        harness.sessions.append(self)
        self.readers = [threading.Thread(target=self._read, args=(stream, log, stdout), daemon=True)
                        for stream, log, stdout in ((self.process.stdout, self.logs[0], True),
                                                   (self.process.stderr, self.logs[1], False))]
        for reader in self.readers:
            reader.start()
        identity = one_json(self.execute('SET application_name=' + literal(self.application_name) + ';\n'
                                        + SESSION_HELPERS), label + '-startup')
        require(identity['session_user'] == 'postgres' and identity['current_user'] == 'postgres',
                'Session must originate in the verified fixture transport')
        self.pid = int(identity['pid'])

    def _read(self, source, log, stdout):
        try:
            for line in iter(source.readline, ''):
                log.write(line)
                log.flush()
                if stdout:
                    self.lines.put(line.rstrip('\n'))
        finally:
            if stdout:
                self.lines.put(None)

    def start(self, sql):
        require(self.pending is None and not self.closed, self.label + ': overlapping command')
        require(time.monotonic() < self.h.deadline, 'Suite deadline exceeded')
        self.pending = '__CRM_KAM_DONE_' + uuid.uuid4().hex + '__'
        command = sql.rstrip() + '\n\\echo ' + self.pending + '\n'
        self.logs[2].write(command)
        self.logs[2].flush()
        self.process.stdin.write(command)
        self.process.stdin.flush()

    def finish(self):
        require(self.pending is not None, self.label + ': no command pending')
        end = min(time.monotonic() + COMMAND_SECONDS, self.h.deadline)
        result = []
        while time.monotonic() < end:
            try:
                line = self.lines.get(timeout=min(.25, max(.001, end - time.monotonic())))
            except queue.Empty:
                require(self.process.poll() is None, self.label + ': psql exited before marker')
                continue
            require(line is not None, self.label + ': psql closed before marker; inspect stderr')
            if line == self.pending:
                self.pending = None
                return result
            result.append(line)
        raise TimeoutError(self.label + ': command completion deadline exceeded')

    def execute(self, sql):
        self.start(sql)
        return self.finish()

    def begin(self, fixture):
        self.actor = fixture['actor']
        self.fixture = fixture
        claims = json.dumps({'sub': self.actor, 'role': 'authenticated'})
        self.execute('BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; '
                     'DO $claims$ BEGIN PERFORM set_config(\'request.jwt.claims\',' + literal(claims)
                     + ',true); END $claims$;')

    def call(self, asynchronous=False):
        self.start('SELECT pg_temp.invoke(' + literal(self.fixture['company']) + '::uuid,'
                   + literal(self.actor) + '::uuid,' + literal(self.fixture['org']) + '::uuid);')
        if not asynchronous:
            return self.result()

    def result(self):
        value = one_json(self.finish(), self.label + '-rpc')
        require(value['caller'] == 'authenticated' and value['subject'] == self.actor
                and value['tenant'] == self.fixture['org'], 'Incorrect RPC actor or tenant')
        self.h.events.append({'session': self.label, 'outcome': value})
        return value['value']

    def commit(self):
        require(not self.execute('COMMIT;'), 'Unexpected commit output')
        self.actor = None

    def close(self):
        if self.closed:
            return
        self.closed = True
        if self.process.poll() is None and self.pending is not None and self.pid is not None:
            try:
                self.h.context.query('SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid='
                                     + str(self.pid) + ' AND datname=' + literal(self.h.context.database)
                                     + ' AND application_name=' + literal(self.application_name) + ';',
                                     self.label + '-cancel-owned-backend', timeout=5)
            except Exception:
                # Still close/kill our psql process; cancellation failure must
                # not abandon an open transaction and block owned-clone cleanup.
                pass
        if self.process.poll() is None:
            try:
                self.process.stdin.write(('\nROLLBACK;\n' if self.actor or self.pending else '\n') + '\\q\n')
                self.process.stdin.flush()
                self.process.stdin.close()
                self.process.wait(timeout=6)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self.process.kill()
                self.process.wait(timeout=5)
        for reader in self.readers:
            reader.join(timeout=3)
        for stream in (self.process.stdout, self.process.stderr):
            stream.close()
        for log in self.logs:
            log.close()


class Harness:
    def __init__(self, context):
        self.context, self.out = context, context.evidence_dir
        require(not self.out.exists(), 'Fresh run evidence directory required')
        self.out.mkdir(parents=True)
        self.sessions, self.events = [], []
        self.sequence = 0
        self.deadline = time.monotonic() + SUITE_SECONDS

    def query(self, sql, label):
        require(time.monotonic() < self.deadline, 'Suite deadline exceeded')
        self.sequence += 1
        prefix = self.out / (f'{self.sequence:03}-' + label)
        prefix.with_suffix('.sql').write_text(sql + '\n')
        stdout, stderr = self.context.query(sql, label)
        prefix.with_suffix('.stdout.log').write_text(stdout)
        prefix.with_suffix('.stderr.log').write_text(stderr)
        return one_json(stdout, label)

    def seed(self):
        f = {key: str(uuid.uuid4()) for key in ('org', 'other_org', 'actor', 'other_actor', 'company', 'other_company')}
        q = {key: literal(value) for key, value in f.items()}
        sql = 'BEGIN;\n'
        sql += 'INSERT INTO auth.users(id,email) VALUES ' + ','.join(
            '(' + q[key] + ',' + literal(f[key] + '@test.invalid') + ')' for key in ('actor', 'other_actor')) + ';\n'
        sql += f"INSERT INTO public.organizations(id,nombre,activo) VALUES ({q['org']},'KAM race fixture',true),({q['other_org']},'KAM unrelated fixture',true);\n"
        sql += 'INSERT INTO public.organization_members(organization_id,user_id,role) VALUES ' + ','.join(
            '(' + q[org] + ',' + q[actor] + ",'customer_service')"
            for org, actor in (('org', 'actor'), ('other_org', 'other_actor'))) + ';\n'
        sql += "UPDATE public.organization_members SET role='vendedor' WHERE user_id IN (" + q['actor'] + ',' + q['other_actor'] + ');\n'
        # In an empty clone, auth bootstrap can give the first synthetic user
        # super_admin; membership sync deliberately preserves platform roles.
        # Set only these new fixture identities to exact KAM, with all real
        # triggers active, so neither RPC can take the legacy writer bypass.
        sql += "UPDATE public.user_roles SET role='vendedor' WHERE user_id IN (" + q['actor'] + ',' + q['other_actor'] + ');\n'
        sql += 'INSERT INTO public.crm_empresas(id,organization_id,nombre,created_by) VALUES ' + ','.join(
            '(' + q[company] + ',' + q[org] + ",'KAM concurrency company'," + q[actor] + ')'
            for company, org, actor in (('company', 'org', 'actor'), ('other_company', 'other_org', 'other_actor'))) + ';\n'
        sql += "SELECT jsonb_build_object('stages',(SELECT count(*) FROM public.crm_etapas_pipeline WHERE organization_id=" + q['org'] + " AND nombre='Prospecto' AND activa IS TRUE AND deleted_at IS NULL));\nCOMMIT;"
        seeded = self.query(sql, 'seed')
        require(seeded['stages'] == 1, 'Real organization trigger must supply exactly one active Prospecto stage')
        before = self.snapshot(f, 'baseline')
        require(len(before['companies']) == 2 and not before['leads'] and not before['opportunities']
                and not before['links'], 'Company-only fixture required')
        require(len(before['memberships']) == 2 and all(row['role'] == 'vendedor' for row in before['memberships'])
                and len(before['roles']) == 2 and all(row['role'] == 'vendedor' for row in before['roles']),
                'Membership and global mirror must both be exact KAM')
        require(sorted((row['id'], row['email']) for row in before['users']) ==
                sorted((f[key], f[key] + '@test.invalid') for key in ('actor', 'other_actor')), 'Auth identities missing')
        return f, before

    def snapshot(self, f, label):
        orgs = ','.join(literal(f[key]) + '::uuid' for key in ('org', 'other_org'))
        users = ','.join(literal(f[key]) + '::uuid' for key in ('actor', 'other_actor'))
        entries = []
        for key, table in (('companies', 'crm_empresas'), ('leads', 'crm_leads'),
                           ('opportunities', 'crm_oportunidades'), ('links', 'crm_oportunidad_empresa'),
                           ('history', 'crm_historial_etapas'), ('clients', 'clientes'),
                           ('audit', 'bitacora_actividad'), ('notifications', 'crm_notificaciones'),
                           ('memberships', 'organization_members')):
            entries.extend((literal(key), "(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('__ctid',t.ctid::text,'__xmin',t.xmin::text) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public."
                            + table + ' t WHERE organization_id IN (' + orgs + '))'))
        entries.extend(("'roles'", "(SELECT coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('__ctid',t.ctid::text,'__xmin',t.xmin::text) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.user_roles t WHERE user_id IN (" + users + '))',
                        "'users'", "(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY id) FROM auth.users WHERE id IN (" + users + '))'))
        value = self.query('SELECT jsonb_build_object(' + ','.join(entries) + ');', label)
        (self.out / (label + '.json')).write_text(json.dumps(value, indent=2) + '\n')
        return value

    def wait_blocked(self, waiter, holder):
        end = min(self.deadline, time.monotonic() + BARRIER_SECONDS)
        while time.monotonic() < end:
            require(waiter.process.poll() is None and waiter.pending is not None and waiter.lines.empty(),
                    'Waiter completed/disconnected before lock proof')
            proof = self.query("SELECT jsonb_build_object('holder'," + str(holder.pid) + ",'waiter'," + str(waiter.pid)
                               + ",'blockers',pg_blocking_pids(" + str(waiter.pid) + "),'state',state,'wait_event_type',wait_event_type,"
                               "'database',datname,'application_name',application_name) FROM pg_stat_activity WHERE pid="
                               + str(waiter.pid) + ';', 'lock-proof')
            if holder.pid in proof['blockers'] and proof['state'] == 'active' and proof['wait_event_type'] == 'Lock':
                require(proof['database'] == self.context.database and proof['application_name'] == waiter.application_name,
                        'Waiter identity changed')
                require(waiter.process.poll() is None and waiter.lines.empty(), 'Waiter completed at lock barrier')
                self.events.append({'barrier': 'second-rpc-waits-on-first', 'proof': proof})
                return
            time.sleep(.04)
        raise TimeoutError('Exact holder/waiter lock contention was not observed')


def verify_final(before, after, f, opportunity):
    require(len(after['leads']) == len(after['opportunities']) == len(after['links']) == 1,
            'Exactly one total lead, opportunity and company link required')
    lead, op, link = after['leads'][0], after['opportunities'][0], after['links'][0]
    require(op['id'] == opportunity and op['lead_id'] == lead['id'] and link['oportunidad_id'] == opportunity
            and link['empresa_id'] == f['company'], 'Wrong commercial lineage')
    for row in (lead, op):
        require(row['organization_id'] == f['org'] and row['created_by'] == f['actor']
                and row['vendedor_id'] == f['actor'] and row['vendedor_email'] == f['actor'] + '@test.invalid'
                and row['deleted_at'] is None, 'Ownership or tenant changed')
    require(lead['estado'] == 'Prospecto' and link['organization_id'] == f['org'], 'Wrong state or link tenant')
    for key in ('memberships', 'roles', 'users', 'clients'):
        require(before[key] == after[key], 'Conversion changed ' + key)
    for key in ('companies', 'leads', 'opportunities', 'links', 'history', 'audit', 'notifications'):
        require([row for row in before[key] if row['organization_id'] == f['other_org']]
                == [row for row in after[key] if row['organization_id'] == f['other_org']], 'Unrelated tenant changed: ' + key)
    target = [row for row in after['companies'] if row['id'] == f['company']]
    original = [row for row in before['companies'] if row['id'] == f['company']]
    require(len(target) == len(original) == 1, 'Target company missing or duplicated')
    allowed = {'lead_origen_id', 'estado_crm', 'updated_at', '__ctid', '__xmin'}
    require({key: value for key, value in target[0].items() if key not in allowed}
            == {key: value for key, value in original[0].items() if key not in allowed}, 'Company reassigned or unrelated field changed')
    require(target[0]['lead_origen_id'] == lead['id'] and target[0]['estado_crm'] == 'Prospecto', 'Company not transitioned')


def owned_clone_present(rows, expected_oid):
    require(isinstance(rows, list) and len(rows) <= 1, 'Ambiguous clone identity; refusing deletion')
    if not rows:
        return False
    require(rows[0].get('owner') == 'postgres' and type(rows[0].get('oid')) is int and rows[0]['oid'] > 0
            and (expected_oid is None or rows[0]['oid'] == expected_oid), 'Clone ownership/OID changed; refusing deletion')
    return True


def run_concurrency(context):
    require(os.environ.get('ISOLATED_QA_DB') == '1' and os.environ.get('CRM_PROSPECTO_KAM_DISPOSABLE') == '1',
            'Explicit disposable opt-in required')
    require(re.fullmatch(CLONE_PATTERN, context.database) is not None, 'Only a fresh dedicated clone is accepted')
    h = Harness(context)
    record = {'status': 'running', 'source_commit': context.source_commit, 'case': 'kam_double_click_commit', 'events': []}
    try:
        preflight = h.query("SELECT jsonb_build_object('database',current_database(),'user',current_user,'local',inet_server_addr() IS NULL,"
                            "'body_md5',md5(prosrc)) FROM pg_proc WHERE oid='" + SIGNATURE + "'::regprocedure;", 'preflight')
        require(preflight == {'database': context.database, 'user': 'postgres', 'local': True, 'body_md5': context.body_md5},
                'Clone context or checked-out function body mismatch')
        f, before = h.seed()
        first, second = Session(h, 'A'), Session(h, 'B')
        first.begin(f)
        first_result = first.call()
        require(first_result.get('sin_cambios') is False and re.fullmatch(r'[a-f0-9-]{36}', first_result.get('oportunidad_id', '')),
                'First KAM call must perform the transition')
        second.begin(f)
        second.call(asynchronous=True)
        h.wait_blocked(second, first)
        require(h.snapshot(f, 'while-blocked') == before, 'Uncommitted conversion leaked')
        first.commit()
        second_result = second.result()
        require(second_result == {'oportunidad_id': first_result['oportunidad_id'], 'sin_cambios': True},
                'Concurrent retry must reuse the exact same opportunity idempotently')
        committed = h.snapshot(f, 'first-committed')
        second.commit()
        after = h.snapshot(f, 'both-committed')
        require(after == committed, 'Idempotent waiter changed persisted state')
        verify_final(before, after, f, first_result['oportunidad_id'])
        record.update(status='pass', first_result=first_result, second_result=second_result,
                      counts={'leads': 1, 'opportunities': 1, 'links': 1}, both_committed=True)
    except BaseException as error:
        record.update(status='fail', error_type=type(error).__name__, error=str(error))
        raise
    finally:
        cleanup_errors = []
        for session in h.sessions:
            try:
                session.close()
            except BaseException as error:
                cleanup_errors.append(str(error))
        diagnostics = [path.name for path in h.out.glob('*.stderr.log')
                       if re.search(r'(^|\n)(WARNING|ERROR|FATAL):', path.read_text())]
        if cleanup_errors or diagnostics:
            record.update(status='fail', cleanup_errors=cleanup_errors, diagnostic_logs=diagnostics)
        record['events'] = h.events
        (h.out / 'result.json').write_text(json.dumps(record, indent=2) + '\n')
        require(not cleanup_errors and not diagnostics, 'Session cleanup/diagnostic failure')
    return record


if __name__ == '__main__':
    raise SystemExit('Standalone database CLI refused. Use run-actions.py in the verified isolated Actions service.')
