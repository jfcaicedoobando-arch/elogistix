#!/usr/bin/env python3
"""Contador approval race suite; only an owned disposable local PostgreSQL clone.

Transport adapted from scripts/ci/acceptance-candidate-review/concurrency.py.
Uses Python stdlib and installed psql only. No business function/ACL modifications.
"""
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
SUITE_SECONDS = 180
EXPECTED_SOURCE = '1559f48d4818d0edfe98dc46cf4cbe69770d9f82'
EXPECTED_BODY_MD5 = 'c910bfde57c93d5e8a225d221cbe41b1'
CASES = ('creator_double_click', 'creator_wins_other_contador', 'creator_rollback_waiter_succeeds')
JUSTIFICATION = 'Gasto administrativo sintético'
APPROVAL_MUTABLE_FIELDS = frozenset({
    'estado_aprobacion', 'aprobada_por', 'aprobada_at', 'motivo_rechazo',
    'aprobacion_heredada', 'justificacion_sin_vinculo', 'updated_at',
})

def require(condition, message):
    if not condition:
        raise RuntimeError('CXP_CONCURRENCY_ASSERT: ' + message)

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def one_json(lines, label):
    if isinstance(lines, str):
        lines = lines.splitlines()
    rows = [json.loads(line) for line in lines if line.strip()]
    require(len(rows) == 1, label + ': expected exactly one JSON row')
    return rows[0]

SESSION_HELPERS = r"""
SET statement_timeout='20s';
SET lock_timeout='18s';
SET idle_in_transaction_session_timeout='45s';
CREATE FUNCTION pg_temp.invoke(invoice uuid, version timestamptz, actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $helper$
DECLARE result public.proveedor_facturas; caller text := current_user; subject uuid := auth.uid();
BEGIN
 IF caller <> 'authenticated' OR subject IS DISTINCT FROM actor
    OR auth.role() IS DISTINCT FROM 'authenticated'
    OR NOT public.has_role(subject,'contador'::public.app_role)
    OR public.has_role(subject,'super_admin'::public.app_role) THEN
   RAISE EXCEPTION 'CXP_CONCURRENCY_BAD_AUTH';
 END IF;
 BEGIN
  result := public.aprobar_factura_proveedor(invoice,true,'Gasto administrativo sintético',version);
 EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM,
                            'caller',caller,'subject',subject);
 END;
 RETURN jsonb_build_object('ok',true,'value',to_jsonb(result),'caller',caller,'subject',subject);
END $helper$;
SELECT jsonb_build_object('pid',pg_backend_pid(),'session_user',session_user,
                         'current_user',current_user);
"""


class Session:
    """Persistent psql stdin, bounded command acknowledgments, separate logs."""
    def __init__(self, harness, label):
        self.h = harness
        self.label = label
        self.application_name = 'cxp-approval-' + uuid.uuid4().hex
        self.fixture = None
        self.pending = None
        self.lines = queue.Queue()
        self.closed = False
        self.pid = None
        self.stdout = self.h.out.joinpath(label + '.stdout.log').open('w')
        self.stderr = self.h.out.joinpath(label + '.stderr.log').open('w')
        self.commands = self.h.out.joinpath(label + '.sql').open('w')
        self.process = subprocess.Popen(
            self.h.context.psql_argv, env=self.h.context.env, text=True,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            bufsize=1,
        )
        # Register before waiting for startup, so even a startup failure is
        # cleaned up by the suite's finally block.
        self.h.sessions.append(self)
        self.readers = [
            threading.Thread(target=self._read, args=(self.process.stdout, self.stdout, True), daemon=True),
            threading.Thread(target=self._read, args=(self.process.stderr, self.stderr, False), daemon=True),
        ]
        for reader in self.readers:
            reader.start()
        identity = one_json(self.execute('SET application_name=' + literal(self.application_name) + ';\n'
                                        + SESSION_HELPERS), label + ' startup')
        require(identity['session_user'] == 'postgres' and identity['current_user'] == 'postgres',
                'Session must originate inside the owned PostgreSQL fixture runner')
        self.pid = int(identity['pid'])
        self.actor = None

    def _read(self, source, log, is_stdout):
        try:
            for line in iter(source.readline, ''):
                log.write(line)
                log.flush()
                if is_stdout:
                    self.lines.put(line.rstrip('\n'))
        finally:
            if is_stdout:
                self.lines.put(None)

    def start(self, sql):
        require(self.pending is None and not self.closed, self.label + ': overlapping session command')
        self.h.check_deadline()
        self.pending = '__CXP_APPROVAL_BARRIER_' + uuid.uuid4().hex + '__'
        text = sql.rstrip() + '\n\\echo ' + self.pending + '\n'
        self.commands.write(text)
        self.commands.flush()
        self.process.stdin.write(text)
        self.process.stdin.flush()

    def finish(self, seconds=COMMAND_SECONDS):
        require(self.pending is not None, self.label + ': no pending command')
        end = min(time.monotonic() + seconds, self.h.deadline)
        result = []
        while time.monotonic() < end:
            try:
                line = self.lines.get(timeout=min(.25, max(.001, end - time.monotonic())))
            except queue.Empty:
                if self.process.poll() is not None:
                    raise RuntimeError(self.label + ': psql exited before completion marker; inspect stderr')
                continue
            require(line is not None, self.label + ': psql closed before completion marker; inspect stderr')
            if line == self.pending:
                self.pending = None
                return result
            result.append(line)
        raise TimeoutError(self.label + ': SQL did not reach its completion marker before deadline')

    def execute(self, sql, seconds=COMMAND_SECONDS):
        self.start(sql)
        return self.finish(seconds)

    def begin(self, fixture, actor):
        self.fixture = fixture
        self.actor = actor
        claims = json.dumps({'sub': actor, 'role': 'authenticated', 'email': actor + '@test.invalid'})
        sql = ("BEGIN ISOLATION LEVEL READ COMMITTED; SET LOCAL ROLE authenticated; "
               "DO $claims$ BEGIN PERFORM set_config('request.jwt.claims'," + literal(claims) + ",true); END $claims$; "
               "SELECT jsonb_build_object('pid',pg_backend_pid(),'caller',current_user,'subject',auth.uid(),"
               "'auth_role',auth.role(),'member',EXISTS(SELECT 1 FROM public.organization_members "
               "WHERE user_id=auth.uid() AND organization_id=" + literal(fixture['org']) + "::uuid),"
               "'contador',public.has_role(auth.uid(),'contador'::public.app_role),"
               "'super_admin',public.has_role(auth.uid(),'super_admin'::public.app_role));")
        data = one_json(self.execute(sql), self.label + ' actor')
        require(data['pid'] == self.pid and data['caller'] == 'authenticated'
                and data['subject'] == actor and data['auth_role'] == 'authenticated'
                and data['member'] is True and data['contador'] is True
                and data['super_admin'] is False, self.label + ': incorrect authenticated Contador identity')
        self.h.events.append({'identity': data, 'session': self.label})

    def call(self, invoice, version, asynchronous=False):
        self.start("SELECT pg_temp.invoke(" + literal(invoice) + "::uuid," + literal(version)
                   + "::timestamptz," + literal(self.actor) + "::uuid);")
        if not asynchronous:
            return self.result()

    def result(self):
        data = one_json(self.finish(), self.label + ' RPC')
        require(data['caller'] == 'authenticated' and data['subject'] == self.actor,
                self.label + ': RPC caller identity changed')
        self.h.events.append({'outcome': data, 'session': self.label})
        return data

    def end(self, commit=True):
        require(not self.execute('COMMIT;' if commit else 'ROLLBACK;'), self.label + ': transaction command returned rows')
        self.actor = None
        self.fixture = None

    def close(self):
        if self.closed:
            return
        self.closed = True
        # On failure cancel only our backend, never a database-wide connection.
        if self.process.poll() is None and self.pending is not None and self.pid is not None:
            try:
                # Cleanup is bounded separately and must still run after the
                # global suite deadline has expired.
                self.h.context.query('SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE pid='
                                     + str(self.pid) + ' AND datname=' + literal(self.h.context.database) + ' AND application_name='
                                     + literal(self.application_name) + ';',
                                     self.label + '-cancel-owned-backend', timeout=5)
            except Exception:
                pass
        if self.process.poll() is None:
            try:
                self.process.stdin.write(('\nROLLBACK;\n' if getattr(self, 'actor', None) is not None or self.pending else '\n') + '\\q\n')
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
        for log in (self.stdout, self.stderr, self.commands):
            log.close()


@dataclass
class Context:
    psql_argv: list
    env: dict
    evidence_dir: Path
    database: str
    source_commit: str

    def query(self, sql, label, timeout=25):
        result = subprocess.run(self.psql_argv, env=self.env, input=sql, text=True,
                                capture_output=True, timeout=timeout)
        require(result.returncode == 0, label + ': psql failed: ' + result.stderr)
        require(not re.search(r'(^|\n)(WARNING|ERROR|FATAL):', result.stderr),
                label + ': warning or error: ' + result.stderr)
        return result.stdout, result.stderr


class Harness:
    def __init__(self, context):
        self.context = context
        self.out = context.evidence_dir
        require(not self.out.exists(), 'Evidence directory must be fresh')
        self.out.mkdir(parents=True)
        self.sessions = []
        self.events = []
        self.sequence = 0
        self.deadline = time.monotonic() + SUITE_SECONDS

    def check_deadline(self):
        require(time.monotonic() < self.deadline, 'Global suite deadline exceeded')

    def query(self, sql, label):
        self.check_deadline()
        self.sequence += 1
        prefix = self.out / (f'{self.sequence:03}-' + label)
        prefix.with_suffix('.sql').write_text(sql + '\n')
        stdout, stderr = self.context.query(sql, label)
        prefix.with_suffix('.stdout.log').write_text(stdout)
        prefix.with_suffix('.stderr.log').write_text(stderr)
        return one_json(stdout, label)

    def seed(self, case):
        f = {key: str(uuid.uuid4()) for key in ('org', 'other_org', 'a', 'b', 'other_actor')}
        q = {k: literal(v) for k, v in f.items()}
        # Mandatory auth.users insert: no best-effort swallowing or ON CONFLICT.
        sql = 'BEGIN;\n' + Path(__file__).with_name('fixture.sql').read_text() + '\n'
        sql += 'INSERT INTO auth.users(id,email) VALUES ' + ','.join(
            '(' + q[k] + ',' + literal(f[k] + '@test.invalid') + ')' for k in ('a','b','other_actor')) + ';\n'
        sql += f"INSERT INTO public.organizations(id,nombre) VALUES ({q['org']},'CXP race fixture'),({q['other_org']},'CXP unrelated fixture');\n"
        sql += "INSERT INTO public.organization_members(organization_id,user_id,role) VALUES " + ','.join(
            '(' + q[org] + ',' + q[actor] + ",'contador')" for org,actor in (('org','a'),('org','b'),('other_org','other_actor'))) + ';\n'
        sql += "INSERT INTO public.user_roles(user_id,role) VALUES " + ','.join(
            '(' + q[actor] + ",'contador')" for actor in ('a','b','other_actor')) + ' ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role;\n'
        sql += "SELECT jsonb_build_object('invoice',pg_temp.cxp_fixture(" + q['org'] + ',' + q['a'] + "),'other_invoice',pg_temp.cxp_fixture(" + q['other_org'] + ',' + q['other_actor'] + "));\nCOMMIT;"
        f.update(self.query(sql, case + '-seed'))
        baseline = self.snapshot(f, case + '-baseline')
        require(len(baseline['invoices']) == 2 and len(baseline['concepts']) == 2, 'Expected two fixture invoices and concepts')
        require(baseline['payments'] == [], 'Fixture starts with no payments')
        require(len(baseline['memberships']) == 3 and len(baseline['roles']) == 3, 'Exact synthetic role/membership setup')
        require(sorted((u['id'],u['email']) for u in baseline['users']) ==
                sorted((f[k],f[k]+'@test.invalid') for k in ('a','b','other_actor')), 'Mandatory audit email fixture')
        require(not decisions(baseline, f['invoice']), 'Target starts without a decision')
        # PostgreSQL JSON serialization preserves timestamp microseconds; no Date conversion.
        f['version'] = invoice_row(baseline, f['invoice'])['updated_at']
        require(isinstance(f['version'],str) and f['version'], 'CAS timestamp missing')
        return f, baseline

    def snapshot(self, f, label):
        orgs = ','.join(literal(f[k]) + '::uuid' for k in ('org','other_org'))
        users = ','.join(literal(f[k]) + '::uuid' for k in ('a','b','other_actor'))
        entries = []
        for key,table in (('invoices','proveedor_facturas'),('concepts','proveedor_facturas_conceptos'),
                          ('payments','pagos_proveedor'),('audit','bitacora_actividad'),('memberships','organization_members')):
            entries.extend((literal(key), "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public."
                            +table+' t WHERE organization_id IN ('+orgs+'))'))
        entries.extend(("'roles'", "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public.user_roles t WHERE user_id IN ("+users+'))',
                        "'users'", "(SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY id) FROM auth.users WHERE id IN ("+users+'))'))
        value = self.query('SELECT jsonb_build_object('+','.join(entries)+');',label)
        (self.out/(label+'.json')).write_text(json.dumps(value,indent=2)+'\n')
        return value

    def wait_blocked(self, b, a, label):
        end = min(self.deadline, time.monotonic()+BARRIER_SECONDS)
        while time.monotonic() < end:
            require(b.process.poll() is None and b.pending is not None and b.lines.empty(),
                    'Waiter completed/disconnected before contention proof')
            proof = self.query("SELECT jsonb_build_object('holder',"+str(a.pid)+",'waiter',"+str(b.pid)
                +",'blockers',pg_blocking_pids("+str(b.pid)+"),'state',state,'wait_event_type',wait_event_type,"
                "'database',datname,'application_name',application_name) FROM pg_stat_activity WHERE pid="+str(b.pid)+';',label)
            if (a.pid in proof['blockers'] and proof['state']=='active' and proof['wait_event_type']=='Lock'):
                require(proof['database']==self.context.database and proof['application_name']==b.application_name,
                        'Wrong waiter identity')
                require(b.process.poll() is None and b.lines.empty(), 'Waiter finished at barrier')
                self.events.append({'barrier':label,'proof':proof})
                return
            time.sleep(.04)
        raise TimeoutError('Exact holder/waiter lock barrier not observed')


def invoice_row(state, invoice):
    rows = [r for r in state['invoices'] if r['id']==invoice]
    require(len(rows)==1,'Exactly one target invoice required')
    return rows[0]


def decisions(state, invoice):
    return [r for r in state['audit'] if r['entidad_id']==invoice
            and (r['fuente_evento']=='rpc_aprobar_factura_proveedor'
                 or r['accion'] in ('aprobar_factura_proveedor','rechazar_factura_proveedor'))]


def approved(result, actor, creator):
    require(result['ok'] is True, 'RPC unexpectedly failed: '+str(result))
    row = result['value']
    require(row['estado_aprobacion']=='aprobada' and row['aprobada_por']==actor
            and row['created_by']==creator and row['aprobada_at'] is not None, 'Wrong winning approval or actor')
    return row


def verify_final(before, after, f, winner, returned):
    row = invoice_row(after,f['invoice'])
    require(row==returned,'Final invoice must exactly equal winning RPC row')
    original = invoice_row(before,f['invoice'])
    require({key: value for key, value in row.items() if key not in APPROVAL_MUTABLE_FIELDS}
            == {key: value for key, value in original.items() if key not in APPROVAL_MUTABLE_FIELDS},
            'Approval changed invoice fields outside the explicit approval allowlist')
    for key in ('concepts','payments','memberships','roles','users'):
        require(before[key]==after[key], 'Approval changed '+key)
    require(invoice_row(before,f['other_invoice'])==invoice_row(after,f['other_invoice']), 'Unrelated invoice changed')
    require([r for r in before['audit'] if r['organization_id']==f['other_org']]
            ==[r for r in after['audit'] if r['organization_id']==f['other_org']], 'Unrelated audit changed')
    events = decisions(after,f['invoice'])
    require(len(events)==1,'Exactly one total approval/rejection decision, regardless of actor, required')
    e=events[0]
    require(e['accion']=='aprobar_factura_proveedor' and e['fuente_evento']=='rpc_aprobar_factura_proveedor'
            and e['usuario_id']==winner and e['usuario_email']==winner+'@test.invalid'
            and e['organization_id']==f['org'] and e['modulo']=='cxp', 'Wrong decision attribution')
    details=e['detalles']
    require(details['aprobada'] is True and details['total']==100 and details['moneda']=='MXN'
            and details['tipo_cambio_usd']==1 and details['motivo']==JUSTIFICATION
            and details['justificacion_sin_vinculo']==JUSTIFICATION, 'Wrong approval audit payload')


def scenario(h, case, rollback=False, same_actor=False):
    f, before = h.seed(case)
    a=b=None
    try:
        a=Session(h,case+'-A'); b=Session(h,case+'-B')
        a.begin(f,f['a'])
        winner=approved(a.call(f['invoice'],f['version']),f['a'],f['a'])
        b.begin(f,f['a'] if same_actor else f['b'])
        b.call(f['invoice'],f['version'],asynchronous=True)
        h.wait_blocked(b,a,case+'-blocked')
        require(h.snapshot(f,case+'-while-blocked')==before, 'Uncommitted first approval leaked')
        a.end(not rollback)
        result=b.result()
        if rollback:
            winner=approved(result,f['b'],f['a'])
            require(h.snapshot(f,case+'-rolled-back')==before, 'First rollback left persistent changes')
            b.end()
        else:
            require(result['ok'] is False and result['sqlstate']=='PT409'
                    and result['message'].startswith('LC_CONFLICTO_CONCURRENCIA:'), 'Loser must return exact CAS conflict')
            committed=h.snapshot(f,case+'-winner-committed')
            b.end(False)
        after=h.snapshot(f,case+'-final')
        if not rollback:
            require(after==committed, 'Failed waiter changed persisted state')
        verify_final(before,after,f,f['b'] if rollback else f['a'],winner)
    finally:
        for session in (a,b):
            if session is not None:
                session.close()


def owned_clone_present(rows, expected_oid):
    """Validate a previously allocated absent name before caller may DROP it.

    A missing database needs no deletion. Unknown OID is allowed only for the
    caller's ambiguous-CREATE reconciliation after its prechecked name absence.
    Service ID, generated name and prechecked absence remain caller invariants.
    """
    require(isinstance(rows, list) and len(rows) <= 1, 'Ambiguous clone identity; refusing deletion')
    if not rows:
        return False
    require(rows[0].get('owner') == 'postgres'
            and isinstance(rows[0].get('oid'), int) and rows[0]['oid'] > 0
            and (expected_oid is None or rows[0]['oid'] == expected_oid),
            'Owned clone identity changed; refusing deletion')
    return True


def run_concurrency(context):
    require(os.environ.get('CXP_APPROVAL_DISPOSABLE')=='1','Explicit disposable opt-in required')
    require(re.fullmatch(r'cxp_approval_race_[0-9a-f]{32}', context.database) is not None,
            'Only a fresh dedicated race clone is accepted')
    h=Harness(context)
    record={'status':'running','source_commit':context.source_commit,'reviewed_baseline':EXPECTED_SOURCE,'cases':[], 'sqlExecuted':True}
    try:
        require(re.fullmatch(r'[a-f0-9]{40}',context.source_commit) is not None,'Invalid source commit')
        identity=h.query("SELECT jsonb_build_object('database',current_database(),'user',current_user,"
                         "'local',inet_server_addr() IS NULL,'server_version',version(),'body_md5',md5(prosrc)) "
                         "FROM pg_proc WHERE oid='public.aprobar_factura_proveedor(uuid,boolean,text,timestamptz)'::regprocedure;",'preflight')
        record['preflight']=identity
        require(identity['database']==context.database and identity['user']=='postgres'
                and identity['local'] is True and identity['body_md5']==EXPECTED_BODY_MD5,
                'Disposable local clone or exact reviewed function postimage mismatch')
        for case,rollback,same in ((CASES[0],False,True),(CASES[1],False,False),(CASES[2],True,False)):
            start=len(h.events)
            scenario(h,case,rollback,same)
            record['cases'].append({'id':case,'status':'pass','events':h.events[start:]})
        require(tuple(c['id'] for c in record['cases'])==CASES,'Missing cases')
        record['status']='pass'
    except BaseException as error:
        record.update(status='fail',error_type=type(error).__name__,error=str(error))
        raise
    finally:
        for session in h.sessions:
            session.close()
        # Any warning (including best-effort audit warning) fails the whole run.
        warnings=[p.name for p in h.out.glob('*.stderr.log') if re.search(r'(^|\n)(WARNING|ERROR|FATAL):',p.read_text())]
        if warnings:
            record.update(status='fail',warning_logs=warnings)
        record['events']=h.events
        (h.out/'result.json').write_text(json.dumps(record,indent=2)+'\n')
        require(not warnings,'Session warning/error logs: '+str(warnings))
    return record



if __name__ == '__main__':
    raise SystemExit('Standalone database CLI is unsupported. Use run-actions.py in the verified isolated Actions service.')
