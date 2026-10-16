#!/usr/bin/env python3
"""Rollback-only real demo guard race tests, strictly in an owned CI clone."""
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import uuid
COMMAND_SECONDS=25
BARRIER_SECONDS=8
SUITE_SECONDS=180
EXPECTED_SOURCE_SHA256='59d7aa84e5cdcfe94d2e34ac5c8c78e0aa68d65e5168178836ba44a9dfe2c1fe'
EXPECTED_BODY_SHA256='7d139b609da7020fd178744dda6a48a13de331d21b6c29d0c31f6c39a255f3b7'
EXPECTED_BODY_MD5='49ad742438d1a94b22524bcb8cb06633'
MIGRATION='supabase/migrations/20261013210000_guard_demo_cleanup_tenant_graph.sql'
CASES=('writer_nowait_55P03','guard_blocks_writer_ddl_and_unsafe_insert')
EDGE='public.anticipos_aplicaciones'
# Two-int advisory lock has classid=key1,objid=key2,objsubid=2.
BARRIER=(190132,210013)
DEMO='de100000-0000-0000-0000-000000000001'
HERE=Path(__file__).resolve().parent

def require(condition,message):
    if not condition: raise RuntimeError('DEMO_GUARD_ASSERT: '+message)
def literal(value): return "'"+str(value).replace("'","''")+"'"
def one_json(lines,label):
    if isinstance(lines,str): lines=lines.splitlines()
    rows=[json.loads(x) for x in lines if x.strip()]
    require(len(rows)==1,label+': expected exactly one JSON row')
    return rows[0]
SESSION_HELPERS="""
SET statement_timeout='20s';
SET lock_timeout='18s';
SET idle_in_transaction_session_timeout='45s';
SET deadlock_timeout='30s';
SELECT jsonb_build_object('pid',pg_backend_pid(),'session_user',session_user,'current_user',current_user);
"""

class Session:
    """Persistent psql stdin, bounded command acknowledgments, separate logs."""
    def __init__(self, harness, label):
        self.h = harness
        self.label = label
        self.application_name = 'demo-guard-' + uuid.uuid4().hex
        self.actor = None
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
        self.pending = '__DEMO_GUARD_BARRIER_' + uuid.uuid4().hex + '__'
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
                self.process.stdin.write(('\nROLLBACK;\n' if self.actor is not None or self.pending else '\n') + '\\q\n')
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
            and type(rows[0].get('oid')) is int and rows[0]['oid'] > 0
            and (expected_oid is None or rows[0]['oid'] == expected_oid),
            'Owned clone identity changed; refusing deletion')
    return True


# All persistent app rows plus schema/security objects. No source DML and no
# full-row values in logs: each relation is reduced to a deterministic digest.
FINGERPRINT_SQL = r"""
SELECT format($q$SELECT jsonb_build_object('table',%L,'rows',count(*),'digest',
 md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')))
 FROM %I.%I t;$q$,n.nspname||'.'||c.relname,n.nspname,c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','auth') AND c.relkind='r' ORDER BY n.nspname,c.relname
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

def fingerprint(context):
    stdout,_=context.query(FINGERPRINT_SQL,'complete-app-fingerprint')
    return sorted([json.loads(x) for x in stdout.splitlines() if x.strip()],key=lambda x:json.dumps(x,sort_keys=True))

def outcome_ok(data):
    require(data.get('ok') is True and data.get('value') is True,'Wrapper must return true: '+str(data))

def outcome_error(data,state):
    require(data.get('ok') is False and data.get('sqlstate')==state,
            'Expected exact SQLSTATE '+state+', got '+str(data))

INVOKE_SQL=r"""
CREATE FUNCTION pg_temp.race_invoke() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE value boolean;
BEGIN
 BEGIN
   value:=pg_temp.demo_call(0);
 EXCEPTION WHEN OTHERS THEN
   RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM);
 END;
 RETURN jsonb_build_object('ok',true,'value',value);
END $$;
CREATE TEMP TABLE race_baseline AS SELECT
 pg_temp.demo_snapshot('de100000-0000-0000-0000-000000000001') AS demo,
 pg_temp.demo_snapshot((SELECT org FROM pg_temp.demo_test_ids WHERE org<>'de100000-0000-0000-0000-000000000001')) AS other_rows,
 (SELECT to_jsonb(s) FROM public.demo_seed_state s WHERE id=true) AS seed_state;
"""


def begin_b(b):
    b.execute('BEGIN ISOLATION LEVEL READ COMMITTED;'); b.actor='transaction'


def rollback(session):
    require(not session.execute('ROLLBACK;'),'Unexpected rollback output')
    session.actor=None


def setup_a(a):
    a.actor='transaction'
    a.execute((HERE/'fixture.sql').read_text()+"\nINSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,'2000-01-01') ON CONFLICT(id) DO UPDATE SET last_seeded_at=excluded.last_seeded_at;\n"+(HERE/'insert-parents.sql').read_text()+INVOKE_SQL)
    # Observer DDL and fixtures must not acquire the lock used as gate evidence.
    clean=one_json(a.execute("SELECT jsonb_build_object('untouched',NOT EXISTS(SELECT FROM pg_locks WHERE pid=pg_backend_pid() AND relation='public.anticipos_aplicaciones'::regclass AND granted AND mode IN ('RowExclusiveLock','ShareRowExclusiveLock','AccessExclusiveLock')));"),'untouched-edge')
    require(clean['untouched'] is True,'Probe relation was already write/DDL locked by setup')


def relation_proof(h,a,b=None,wait=False):
    sql="SELECT jsonb_build_object('oid','public.anticipos_aplicaciones'::regclass::oid::bigint,'locks',(SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,'mode',mode,'granted',granted)),'[]'::jsonb) FROM pg_locks WHERE locktype='relation' AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND relation='public.anticipos_aplicaciones'::regclass AND pid IN ("+str(a.pid)+((','+str(b.pid)) if b else '')+")));"
    proof=h.query(sql,'edge-locks')
    h.events.append({'relation_lock_evidence':proof})
    return proof


def has_lock(proof,pid,mode,granted=True):
    return any(x['pid']==pid and x['mode']==mode and x['granted'] is granted for x in proof['locks'])


def assert_released(h,pids):
    result=h.query("SELECT jsonb_build_object('remaining',count(*)) FROM pg_locks WHERE pid IN ("+','.join(map(str,pids))+") AND locktype IN ('relation','advisory') AND database=(SELECT oid FROM pg_database WHERE datname=current_database());",'locks-released')
    require(result['remaining']==0,'Transaction locks remain after rollback')


def close_sessions(sessions):
    errors=[]
    for session in sessions:
        try: session.close()
        except BaseException as error: errors.append(type(error).__name__+': '+str(error))
    return errors


def case_writer(h):
    a=Session(h,'writer-A');b=Session(h,'writer-B')
    try:
        setup_a(a);begin_b(b)
        b.execute('LOCK TABLE ONLY public.anticipos_aplicaciones IN ROW EXCLUSIVE MODE;')
        proof=relation_proof(h,a,b)
        require(has_lock(proof,b.pid,'RowExclusiveLock'),'B exact granted writer lock missing')
        a.execute("DO $$ BEGIN PERFORM set_config('demo_test.dml_forbidden','1',true); END $$;")
        data=one_json(a.execute('SELECT pg_temp.race_invoke();'),'writer-nowait')
        outcome_error(data,'55P03');h.events.append({'writer_nowait':data})
        checks=one_json(a.execute("SELECT jsonb_build_object('same',demo=pg_temp.demo_snapshot('"+DEMO+"') AND other_rows=pg_temp.demo_snapshot((SELECT org FROM pg_temp.demo_test_ids WHERE org<>'"+DEMO+"')) AND seed_state IS NOT DISTINCT FROM (SELECT to_jsonb(s) FROM public.demo_seed_state s WHERE id=true),'calls',(SELECT count(*) FROM pg_temp.demo_test_calls)) FROM race_baseline;"),'writer-unchanged')
        require(checks['same'] is True and checks['calls']==0,'NOWAIT changed fixtures/core/state')
        rollback(a);rollback(b);assert_released(h,[a.pid,b.pid])
    finally:
        errors=close_sessions((a,b))
        require(not errors,'Session cleanup failed: '+str(errors))


def wait_gate(h,a,b,graph):
    end=min(h.deadline,time.monotonic()+BARRIER_SECONDS)
    while time.monotonic()<end:
        proof=h.query("SELECT jsonb_build_object('blockers',pg_blocking_pids("+str(a.pid)+"),'waiting',EXISTS(SELECT FROM pg_locks WHERE pid="+str(a.pid)+" AND locktype='advisory' AND classid=190132 AND objid=210013 AND objsubid=2 AND NOT granted),'held',(SELECT coalesce(jsonb_agg(relation::bigint ORDER BY relation),'[]'::jsonb) FROM pg_locks WHERE pid="+str(a.pid)+" AND database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND locktype='relation' AND mode='ShareRowExclusiveLock' AND granted));",'gate-barrier')
        if proof['waiting'] is True and b.pid in proof['blockers']:
            require(set(proof['held'])==set(graph),'Gate must hold exact reviewed complete graph, including shared endpoints')
            require(a.pending is not None and a.lines.empty(),'A already returned at gate barrier')
            h.events.append({'gate_barrier':proof});return
        time.sleep(.04)
    raise TimeoutError('Exact test advisory barrier not observed')


def lock_probe(b,mode):
    require(mode in ('ROW EXCLUSIVE','ACCESS EXCLUSIVE'),'Unexpected probe mode')
    return one_json(b.execute("DO $create$ BEGIN END $create$; CREATE OR REPLACE FUNCTION pg_temp.probe() RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN BEGIN LOCK TABLE ONLY public.anticipos_aplicaciones IN "+mode+" MODE NOWAIT; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM); END; RETURN jsonb_build_object('ok',true); END $$; SELECT pg_temp.probe();"),'lock-probe')


def case_gate(h):
    a=Session(h,'gate-A');b=Session(h,'gate-B')
    try:
        setup_a(a);begin_b(b)
        graph=h.query((HERE/'graph.sql').read_text(),'reviewed-graph')['graph']
        require(len(graph)>16,'Graph missing FK/shared endpoints')
        b.execute('DO $$ BEGIN PERFORM pg_advisory_xact_lock(190132,210013); END $$;')
        a.execute("DO $$ BEGIN PERFORM set_config('demo_test.barrier','1',true); END $$;")
        ids=one_json(a.execute('SELECT to_jsonb(t) FROM pg_temp.race_insert_parents t;'),'insert-parent-ids')
        a.start('SELECT pg_temp.race_invoke();')
        wait_gate(h,a,b,graph)
        for mode in ('ROW EXCLUSIVE','ACCESS EXCLUSIVE'):
            data=lock_probe(b,mode);outcome_error(data,'55P03');h.events.append({'mode':mode,'denial':data})
        # A real INSERT attempt with cross-tenant FK intent. The relation lock
        # must block before row/constraint processing. Rollback-only fixtures are
        # deliberately not committed for B; this is not FK-acceptance evidence.
        b.execute("SET LOCAL lock_timeout='3s'; CREATE FUNCTION pg_temp.unsafe_insert() RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN BEGIN INSERT INTO public.anticipos_aplicaciones(id,organization_id,anticipo_id,proveedor_factura_id,pago_proveedor_id,monto_aplicado,moneda_aplicada) VALUES(gen_random_uuid(),'"+DEMO+"',"+literal(ids['advance'])+","+literal(ids['invoice'])+","+literal(ids['payment'])+",10,'MXN'); EXCEPTION WHEN query_canceled THEN RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM); WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM); END; RETURN jsonb_build_object('ok',true); END $$;")
        b.start('SELECT pg_temp.unsafe_insert();')
        # A waits on B's test barrier; B waits on A's gate. Both sessions set
        # deadlock_timeout=30s and B's lock_timeout=3s resolves this test-only
        # cycle before deadlock detection. Exact relation-lock wait is observed.
        h.wait_blocked(b,a,'unsafe-insert-blocked')
        proof=relation_proof(h,a,b)
        require(has_lock(proof,a.pid,'ShareRowExclusiveLock') and has_lock(proof,b.pid,'RowExclusiveLock',False),'INSERT must wait on untouched edge relation, not an FK row/observer DDL')
        denied=one_json(b.finish(),'insert-lock-timeout');outcome_error(denied,'55P03')
        h.events.append({'unsafe_insert_denied':denied,'parent_fixture':ids})
        rollback(b)
        result=one_json(a.finish(),'guard-success');outcome_ok(result)
        checks=one_json(a.execute("SELECT jsonb_build_object('calls',(SELECT count(*) FROM pg_temp.demo_test_calls),'other_same',other_rows=pg_temp.demo_snapshot((SELECT org FROM pg_temp.demo_test_ids WHERE org<>'"+DEMO+"')),'advanced',(SELECT last_seeded_at>'2000-01-01'::timestamptz FROM public.demo_seed_state WHERE id=true)) FROM race_baseline;"),'guard-final')
        require(checks['calls']==1 and checks['other_same'] is True and checks['advanced'] is True,'Core/state/non-demo outcome incorrect')
        # Statement completed but graph locks must still belong to A until END.
        held=h.query("SELECT jsonb_build_object('held',coalesce(jsonb_agg(relation::bigint ORDER BY relation),'[]'::jsonb)) FROM pg_locks WHERE pid="+str(a.pid)+" AND locktype='relation' AND mode='ShareRowExclusiveLock' AND granted;",'locks-after-return')['held']
        require(set(held)==set(graph),'Gate locks released before caller transaction end')
        rollback(a);assert_released(h,[a.pid,b.pid])
    finally:
        errors=close_sessions((a,b))
        require(not errors,'Session cleanup failed: '+str(errors))


def verify_source(root):
    migration=(root/MIGRATION).read_bytes()
    mirror=(root/'supabase/schema/security/seed_demo_organization_guarded.sql').read_bytes()
    require(hashlib.sha256(migration).hexdigest()==EXPECTED_SOURCE_SHA256 and mirror==migration,
            'Reviewed exact migration/security mirror mismatch')
    source=migration.decode()
    body=source.split('AS $function$',1)[1].split('$function$',1)[0]
    require(hashlib.sha256(body.encode()).hexdigest()==EXPECTED_BODY_SHA256
            and hashlib.md5(body.encode()).hexdigest()==EXPECTED_BODY_MD5,'Reviewed function body constants mismatch')
    roots=re.search(r'v_roots := ARRAY\[(.*?)\];',source,re.S).group(1)
    globals_=re.search(r'v_globals := array_remove\(ARRAY\[(.*?)\], NULL::oid\);',source,re.S).group(1)
    graph=re.search(r'\$graph\$(.*?)\$graph\$',source,re.S).group(1)
    graph=graph.replace('$1::oid[]','ARRAY['+roots+']').replace('$2::oid[]','array_remove(ARRAY['+globals_+'],NULL::oid)')
    graph=graph.replace('SELECT array_agg(relid ORDER BY relid) FROM tenant_graph',"SELECT jsonb_build_object('graph',array_agg(relid::bigint ORDER BY relid)) FROM tenant_graph")+';\n'
    require((HERE/'graph.sql').read_text()==graph,'Probe graph diverges from reviewed production discovery')


def run_concurrency(context):
    require(os.environ.get('DEMO_GUARD_DISPOSABLE')=='1','Explicit disposable opt-in required')
    require(re.fullmatch(r'demo_guard_race_[0-9a-f]{32}',context.database) is not None,'Only fresh owned clone accepted')
    h=Harness(context)
    record={'status':'running','source_commit':context.source_commit,'migration_sha256':EXPECTED_SOURCE_SHA256,'body_sha256':EXPECTED_BODY_SHA256,'cases':[],'sqlExecuted':True}
    try:
        pre=h.query("SELECT jsonb_build_object('database',current_database(),'user',current_user,'local',inet_server_addr() IS NULL,'body',prosrc,'owner',pg_get_userbyid(proowner),'definer',prosecdef,'language',(SELECT lanname FROM pg_language WHERE oid=prolang),'config',proconfig,'acl',proacl,'service',has_function_privilege('service_role',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE')) FROM pg_proc p WHERE oid='public.seed_demo_organization_guarded(bigint)'::regprocedure;",'preflight')
        require(pre['database']==context.database and pre['user']=='postgres' and pre['local'] is True,'Wrong database context')
        require(hashlib.sha256(pre.pop('body').encode()).hexdigest()==EXPECTED_BODY_SHA256,'Reviewed exact function body mismatch')
        require(pre['owner']=='postgres' and pre['definer'] is True and pre['language']=='plpgsql' and set(pre['config'])=={'search_path=public','row_security=off'} and pre['service'] is True and pre['anon'] is False and pre['authenticated'] is False,'Production security context/ACL mismatch')
        record['preflight']=pre
        before=fingerprint(context)
        for case,fn in zip(CASES,(case_writer,case_gate)):
            fn(h)
            require(fingerprint(context)==before,'Rollback failed to restore complete app data/schema/security')
            record['cases'].append({'id':case,'status':'pass'})
        record['status']='pass'
    except BaseException as error:
        record.update(status='fail',error_type=type(error).__name__,error=str(error));raise
    finally:
        cleanup_errors=close_sessions(h.sessions)
        if cleanup_errors:record.update(status='fail',cleanup_errors=cleanup_errors)
        warnings=[p.name for p in h.out.glob('*.stderr.log') if re.search(r'(^|\n)(WARNING|ERROR|FATAL):',p.read_text())]
        if warnings:record.update(status='fail',warning_logs=warnings)
        record['events']=h.events
        (h.out/'result.json').write_text(json.dumps(record,indent=2)+'\n')
        require(not warnings,'Unexpected session warnings/errors: '+str(warnings))
        require(not cleanup_errors,'Session cleanup failed: '+str(cleanup_errors))
    return record

if __name__=='__main__':
    raise SystemExit('Standalone database CLI refused; use verified isolated Actions adapter.')
