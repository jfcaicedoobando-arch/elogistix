#!/usr/bin/env python3
"""H14 race characterization. PREPARED ONLY until root authorizes the runner.

No lifecycle, host pg client/library, URLs or ERP source writes. Every database
connection is an independent reviewed helper --session into the races clone.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid

SOURCE = "e302a5a8baee295a5de83adc91265c87cbf45988"

CASES = tuple("C"+str(i).zfill(2) for i in range(1,15))
EXPECTED = {
 "C01":"Dependency after preview but before RPC must block without partial mutation.",
 "C02":"Deleter mutex first: writer 55P03, then deleted-target 23514 in a new transaction.",
 "C03":"Writer mutex first, ROLLBACK: waiting deleter may complete, dependency0.",
 "C04":"Normal membership revocation after preview must reject 42501.",
 "C05":"Writer mutex first, COMMIT: waiting deleter must reject 23514, dependency1.",
 "C06":"Second writer in the same company must receive 55P03 without effects.",
 "C07":"Independent other-company writer can progress while company A mutex is held.",
 "C08":"Initially empty invoice graph: child first serializes concurrent edge creation.",
 "C09":"Initially empty invoice graph: edge first serializes concurrent child creation.",
 "C10":"Foreign locked target must return generic42501 before disclosing lock/deleted status.",
 "C11":"Two-target writer reentry and reverse contender avoid deadlock, second55P03.",
 "C12":"RR stale writer after committed deletion must fail closed, no new edge.",
 "C13":"Serializable stale writer after committed deletion must fail closed, no new edge.",
 "C14":"Role revoked while RPC waits after its initial actor gate must reject after lock, without partial effects."
}


class UnprovenOrder(RuntimeError):
    pass


class SessionUnavailable(RuntimeError):
    pass


class ControlSessionLost(RuntimeError):
    pass


def lit(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql_json(value):
    return lit(json.dumps(value, separators=(",", ":"))) + "::jsonb"


def uid(value):
    return str(uuid.UUID(str(value)))


@dataclass
class Context:
    session_argv: list
    env: dict
    output: Path
    database: str
    run_id: str
    source_commit: str
    rpc_md5: str
    fixture_helpers: str
    capture_helpers: str


class Lab:
    def __init__(self, context):
        self.context=context
        self.run_id=context.run_id
        self.database=context.database
        if not re.fullmatch(r"h14_races_[a-f0-9]{32}",self.database) or not re.fullmatch(r"[a-f0-9]{32}",self.run_id):
            raise ValueError("Owned races clone required")
        self.output=Path(context.output)
        self.output.mkdir(parents=True,exist_ok=False)
        self.events=self.output/"timeline.jsonl"
        self.mutex=threading.Lock()
        self.sessions=[]
        self.emitted=set()
        self.failures=False
        self.secondary_errors=[]
        self.deadline=time.monotonic()+270
        self.env=context.env
        self.finance=context.fixture_helpers
        self.capture=context.capture_helpers

    def event(self, kind, **data):
        row = {"monotonic_ns": time.monotonic_ns(), "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "kind": kind, **data}
        with self.mutex:
            with self.events.open("a") as stream:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")

    def save(self, name, data):
        path = self.output / name
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return str(path)

    def session(self, label):
        return Session(self, label)

    def secondary(self, kind, **data):
        self.failures = True
        row = {"kind": kind, **data}
        self.secondary_errors.append(row)
        self.event(kind, **data)

    def preflight(self, case, actor, shipment, org, admin):
        session=self.session(case+"-preview")
        session.auth(actor,org,admin=admin)
        result=session.json("SELECT public.diagnosticar_baja_embarque("+lit(shipment)+"::uuid)")
        if result.get("version")!=1 or result.get("bloqueado") is not False:
            raise RuntimeError("Canonical diagnostic must establish empty unblocked preview")
        session.run("ROLLBACK");session.close()
        self.save(case+"-preview.json",result)
        self.event("canonical_preview",case=case,result=result)
        return result

    def snapshot(self, owner, case, label, f):
        data = owner.json("SELECT jsonb_build_object('org_a',pg_temp.h14_fin_snapshot(" + lit(f["org_a"]) + "::uuid),'org_b',pg_temp.h14_fin_snapshot(" + lit(f["org_b"]) + "::uuid));")
        return data, self.save(f"{case}-{label}.json", data)

    def result(self, case, status, observed, **extra):
        if case in self.emitted:
            raise RuntimeError("Duplicate case result")
        row = {"case_id": case, "source_commit": self.context.source_commit, "fixture_class": "isolated concurrent fictitious relational fixture",
               "policy_pending": False, "expected_by_code": EXPECTED[case],
               "execution_status": status, "observed": observed, **extra}
        self.emitted.add(case)
        if status != "OBSERVED":
            self.failures = True
        self.event("case_result", **row)
        print("H14_RESULT " + json.dumps(row, ensure_ascii=False), flush=True)

    def close(self):
        # Control only owned pids; cancelling is cleanup, never order evidence.
        controls = [s for s in self.sessions if s.usable and not s.busy]
        control = controls[0] if controls else None
        for s in reversed(self.sessions):
            if s.busy and control is not None and s.pid is not None:
                try:
                    cancel_owned(control, s)
                    s.finish(timeout=4)
                except Exception as error:
                    self.secondary("cleanup_cancel_error", session=s.label, error=str(error))
            s.close()


class Session:
    def __init__(self, lab, label):
        self.lab, self.label = lab, label
        self.lines = queue.Queue()
        self.busy = False
        self.pid = None
        self.pending = None
        self.native_failed = False
        self.transport_failed = False
        self.terminal_reason = None
        self.eof_channels = set()
        self.closed = False
        self.proc = subprocess.Popen(lab.context.session_argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1, env=lab.env)
        # Registration precedes bootstrap: an init failure still closes this process.
        lab.sessions.append(self)
        self.readers = []
        for name, pipe in (("stdout", self.proc.stdout), ("stderr", self.proc.stderr)):
            def read(stream=pipe, channel=name):
                for line in iter(stream.readline, ""):
                    self.lab.event("psql_output", session=self.label, channel=channel, text=line.rstrip("\n"))
                    self.lines.put((channel, line.rstrip("\n")))
                self.lines.put((channel, None))
            t = threading.Thread(target=read, daemon=True)
            t.start()
            self.readers.append(t)
        self.run(lab.finance + "\n" + lab.capture, bootstrap=True)
        self.app_name = "h14-races-" + label + "-" + lab.run_id[:8]
        self.run("SET application_name=" + lit(self.app_name))
        for sql in ("SET statement_timeout='45s'", "SET lock_timeout='30s'", "SET idle_in_transaction_session_timeout='60s'",
                    "SET h14.run_id=" + lit(lab.run_id)):
            self.run(sql)
        self.pid = self.json("SELECT jsonb_build_object('pid',pg_backend_pid());")["pid"]
        if any(s is not self and s.proc.poll() is None and s.pid == self.pid for s in lab.sessions):
            raise RuntimeError("Sessions did not obtain independent backend pids")

    @property
    def usable(self):
        return not (self.closed or self.native_failed or self.transport_failed) and self.proc.poll() is None

    def terminal(self, reason):
        self.transport_failed = True
        self.terminal_reason = reason
        self.lab.failures = True
        self.lab.event("session_terminal",session=self.label,pid=self.pid,reason=reason)

    def start(self, sql, bootstrap=False):
        if not self.usable:
            raise SessionUnavailable(f"Session {self.label} is terminal; no SQL sent: {self.terminal_reason}")
        if self.busy:
            raise RuntimeError("Cannot queue statements behind an unobserved SQL result")
        self.busy = True
        token = uuid.uuid4().hex
        self.pending = {"token": token, "stdout": [], "stderr": [], "error": None, "sqlstate": None}
        self.lab.event("statement_start", session=self.label, pid=self.pid, sql=sql)
        text = sql.rstrip() + ("\n" if bootstrap or sql.rstrip().endswith(";") else ";\n")
        text += f"\\echo H14_END_{token} :ERROR :SQLSTATE\n"
        try:
            self.proc.stdin.write(text)
            self.proc.stdin.flush()
        except (BrokenPipeError, OSError, ValueError) as error:
            self.terminal("stdin write failed; statement outcome unobserved: " + str(error))
            raise SessionUnavailable(self.terminal_reason) from error

    def finish(self, timeout=12):
        if not self.busy:
            raise RuntimeError("No SQL in flight")
        deadline = min(time.monotonic() + timeout, self.lab.deadline)
        result = self.pending
        ended = False
        verbose_end = False
        native_state = None
        while time.monotonic() < deadline:
            try:
                channel, text = self.lines.get(timeout=min(.1, max(.001, deadline-time.monotonic())))
            except queue.Empty:
                # Reader queues must drain before EOF is interpreted. A child
                # exit can precede delivery of the last native ERROR/HINT lines.
                continue
            if text is None:
                self.eof_channels.add(channel)
                if self.eof_channels == {"stdout","stderr"} and not ended:
                    self.terminal("psql EOF before result marker; outcome unobserved")
                    raise SessionUnavailable(self.terminal_reason)
                continue
            if channel == "stdout" and text.startswith("H14_END_" + result["token"] + " "):
                fields = text.split()
                result["error"] = fields[-2] == "true"
                result["sqlstate"] = fields[-1]
                ended = True
            else:
                result[channel].append(text)
                if channel == "stderr":
                    native = re.search(r"\b(?:ERROR|FATAL):\s+([0-9A-Z]{5}):", text)
                    if native:
                        native_state = native.group(1)
                if channel == "stderr" and text.startswith("LOCATION:"):
                    verbose_end = True
            if native_state and verbose_end:
                # Strict psql ON_ERROR_STOP remains enabled; fixture errors exit
                # before the marker. Expected RPC errors use capture.sql instead.
                result["error"], result["sqlstate"] = True, native_state
                self.native_failed = True
                self.terminal_reason = "strict psql terminated after native SQLSTATE " + native_state
                self.busy, self.pending = False, None
                self.lab.event("statement_end",session=self.label,pid=self.pid,result=result)
                return result
            if ended and (not result["error"] or verbose_end):
                self.busy = False
                self.pending = None
                self.lab.event("statement_end", session=self.label, pid=self.pid, result=result)
                return result
        self.terminal("statement response timeout; no mutation retry")
        raise TimeoutError(f"Statement response timeout in {self.label}; no mutation retry")

    def run(self, sql, bootstrap=False):
        self.start(sql, bootstrap)
        r = self.finish(timeout=20 if bootstrap else 12)
        if r["error"]:
            raise RuntimeError(json.dumps(r))
        return r

    def json(self, sql):
        r = self.run(sql)
        values = [json.loads(line) for line in r["stdout"] if line.startswith(("{", "["))]
        if len(values) != 1:
            raise RuntimeError("Expected exactly one JSON SQL row")
        return values[0]

    def auth(self, actor, org, admin=True, operator=True, isolation="READ COMMITTED"):
        if isolation not in ("READ COMMITTED","REPEATABLE READ","SERIALIZABLE"): raise ValueError("Invalid test isolation")
        self.run("BEGIN ISOLATION LEVEL "+isolation)
        self.json("SELECT jsonb_build_object('claims',set_config('request.jwt.claims'," + lit(json.dumps({"sub": actor, "role": "authenticated"})) + ",true));")
        self.run("SET LOCAL ROLE authenticated")
        return check_actor(self.auth_snapshot(), actor, org, admin, operator,isolation.lower())

    def auth_snapshot(self):
        return self.json("SELECT jsonb_build_object('current_user',current_user,'session_user',session_user,'auth_uid',auth.uid(),'org',public.current_user_org_id(),'admin',public.has_role(auth.uid(),'admin'::public.app_role),'operador',public.has_role(auth.uid(),'operador'::public.app_role),'super_admin',public.has_role(auth.uid(),'super_admin'::public.app_role),'claims',current_setting('request.jwt.claims')::jsonb,'isolation',current_setting('transaction_isolation'));")

    def close(self):
        if self.closed:
            return
        if self.proc.poll() is None:
            try:
                if not self.busy and self.usable:
                    self.run("ROLLBACK")
                self.proc.stdin.close()
                self.proc.wait(timeout=3)
            except Exception as error:
                self.lab.secondary("session_close_error", session=self.label, error=str(error))
                self.proc.terminate()
                try:
                    self.proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self.proc.kill()
                    self.proc.wait(timeout=2)
        for t in self.readers:
            t.join(timeout=.5)
        if self.proc.poll() is None:
            self.lab.secondary("session_still_running", session=self.label, pid=self.pid)
        else:
            self.closed = True
        self.lab.event("session_closed", session=self.label, pid=self.pid, returncode=self.proc.returncode)


def check_actor(actual, actor, org, admin, operator,isolation="read committed"):
    expected = {"current_user": "authenticated", "session_user": "postgres", "auth_uid": actor,
                "org": org, "isolation": isolation, "admin": admin,
                "operador": operator, "super_admin": False}
    if any(actual.get(k) != v for k, v in expected.items()):
        raise RuntimeError("Actual actor/role flags do not match fixture: " + json.dumps(actual))
    return actual


def cancel_owned(control, session):
    return control.json("SELECT jsonb_build_object('cleanup_cancelled',CASE WHEN EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=" + str(int(session.pid)) + " AND datname=" + lit(session.lab.database) + " AND application_name=" + lit(session.app_name) + ") THEN pg_cancel_backend(" + str(int(session.pid)) + ") ELSE false END);")


def backend_gone(owner, session):
    if session.pid is None:
        raise RuntimeError("Cannot prove an unregistered backend exited; infra cleanup must verify")
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        value = owner.json("SELECT jsonb_build_object('present',EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=" + str(int(session.pid)) + "));")
        if value["present"] is False:
            return
    raise RuntimeError("Owned backend still visible after psql/helper exit")


def cleanup_case_sessions(lab, owner, case, sessions):
    """Fresh connections may clean up, never resume a failed case's mutations."""
    control = owner if owner.usable and not owner.busy else None
    replacement = None
    if control is None:
        try:
            replacement = lab.session(case+"-cleanup-only")
            control = replacement
            lab.event("cleanup_control_replaced",case=case,failed_session=owner.label,
                      failed_reason=owner.terminal_reason,replacement_pid=control.pid,
                      scope="owned backend cancellation/absence only; no mutation retry")
        except Exception as error:
            lab.secondary("cleanup_control_unavailable",case=case,error=str(error))
    for session in reversed(sessions):
        if session.busy and session.pid is not None:
            try:
                if control is None or not control.usable or control.busy:
                    raise SessionUnavailable("No healthy control for owned cancellation")
                cancel_owned(control,session)
                session.finish(timeout=4)
            except Exception as error:
                lab.secondary("case_cleanup_error",case=case,session=session.label,error=str(error))
        try:
            session.close()
        except Exception as error:
            lab.secondary("session_close_error",case=case,session=session.label,error=str(error))
        try:
            if control is None or not control.usable or control.busy:
                raise SessionUnavailable("No healthy control for backend absence verification")
            backend_gone(control,session)
        except Exception as error:
            lab.secondary("backend_cleanup_unconfirmed",case=case,session=session.label,error=str(error))
    if replacement is not None:
        # Strict ON_ERROR_STOP can leave the proxy waiting for host stdin even
        # after psql has exited. Close that terminal owner; never query it again.
        try:
            owner.close()
        except Exception as error:
            lab.secondary("session_close_error",case=case,session=owner.label,error=str(error))
        try:
            backend_gone(replacement,owner)
        except Exception as error:
            lab.secondary("backend_cleanup_unconfirmed",case=case,session=owner.label,error=str(error))
        try:
            replacement.close()
        except Exception as error:
            lab.secondary("session_close_error",case=case,session=replacement.label,error=str(error))


def run_cases(lab,owner):
    for case in CASES:
        if not owner.usable or owner.busy:
            raise ControlSessionLost("control-session-lost before " + case + ": " + str(owner.terminal_reason))
        run_case(lab,owner,case)
        if not owner.usable or owner.busy:
            raise ControlSessionLost("control-session-lost after " + case + ": " + str(owner.terminal_reason))


def emit_unstarted(lab,error):
    control_lost = isinstance(error,ControlSessionLost)
    for case in CASES:
        if case not in lab.emitted:
            lab.result(case,"NOT_EXECUTED_INFRASTRUCTURE",
                       {"case_not_started":True,"reason":"control-session-lost" if control_lost else "suite-setup-failed"},
                       error=str(error))


def lock_observation(owner, rpc, locker):
    a, b = int(rpc.pid), int(locker.pid)
    return owner.json(f"""SELECT jsonb_build_object(
      'target_relation_oid','public.conceptos_venta'::regclass::oid,
      'rpc', (SELECT jsonb_build_object('pid',pid,'application_name',application_name,'state',state,
        'wait_event_type',wait_event_type,'wait_event',wait_event,'query_start',query_start,'query',query)
        FROM pg_stat_activity WHERE pid={a}), 'blocking_pids',pg_blocking_pids({a}),
      'locks', (SELECT coalesce(jsonb_agg(jsonb_build_object('pid',pid,'locktype',locktype,
        'relation',relation::regclass::text,'relation_oid',relation,'mode',mode,'granted',granted,'transactionid',transactionid::text,
        'page',page,'tuple',tuple) ORDER BY pid,locktype,mode),'[]'::jsonb)
        FROM pg_locks WHERE pid IN ({a},{b})) );""")


def barrier(owner, rpc, locker, lab, case):
    deadline = min(time.monotonic()+8, lab.deadline)
    while time.monotonic() < deadline:
        value = lock_observation(owner, rpc, locker)
        lab.event("lock_observation", case=case, **value)
        active = value.get("rpc") or {}
        relation_lock = any(x["pid"] == rpc.pid and x["relation_oid"] == value["target_relation_oid"] and x["mode"] == "RowExclusiveLock" and x["granted"] for x in value["locks"])
        if active.get("wait_event_type") == "Lock" and locker.pid in value["blocking_pids"] and relation_lock:
            return value
    raise UnprovenOrder("No observed RPC blocker + RowExclusiveLock at first operational table")


def metadata(owner, lab):
    value=owner.json("SELECT jsonb_build_object('database',current_database(),'server_version_num',current_setting('server_version_num'),'socket',current_setting('unix_socket_directories'),'server_addr',inet_server_addr(),'rpc_md5',(SELECT md5(prosrc) FROM pg_proc WHERE oid='public.eliminar_embarque_completo(uuid)'::regprocedure),'rpc_security_definer',(SELECT prosecdef FROM pg_proc WHERE oid='public.eliminar_embarque_completo(uuid)'::regprocedure))")
    if value.get('database')!=lab.database or value.get('server_version_num')!='170009' or value.get('socket') not in ('/lab','/var/run/postgresql') or value.get('server_addr') is not None or value.get('rpc_md5')!=lab.context.rpc_md5 or value.get('rpc_security_definer') is not True:
        raise RuntimeError('Owned strict clone/postimage metadata mismatch')
    return value


def seed(owner, case):
    owner.run("BEGIN")
    f = owner.json("SELECT pg_temp.h14_fin_seed(" + lit(case) + ");")
    for field in ("org_a", "org_b", "actor_a", "actor_b", "embarque_a", "embarque_b", "cliente_a"):
        f[field] = uid(f[field])
    if case=="C02":
        f["lock_row_id"] = owner.json("SELECT jsonb_build_object('id',pg_temp.h14_fin_sale(" + sql_json(f) + ",'race-first-row'," + lit(f["embarque_a"]) + "::uuid));")["id"]
    if case in ("C04","C14"):
        actor = str(uuid.uuid5(uuid.UUID("f14c0000-0000-4000-8000-000000000000"), owner.lab.run_id + ":"+case+":coordinator"))
        owner.run("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(" + lit(actor) + "::uuid," + lit(actor+"@example.invalid") + ",'{\"skip_auto_org\":true}'::jsonb)")
        owner.run("INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(" + lit(f["org_a"]) + "::uuid," + lit(actor) + "::uuid,'coordinador_logistico')")
        f["revoked_actor"] = actor
    owner.run("COMMIT")
    return f


def insert_dependency(writer, f):
    return writer.json("SELECT jsonb_build_object('id',pg_temp.h14_fin_proforma(" + sql_json(f) + ",'race-proforma'," + lit(f["embarque_a"]) + "::uuid));")["id"]


def rpc_sql(f):
    return "SELECT pg_temp.h14_race_rpc(" + lit(f["embarque_a"]) + "::uuid)"


def rpc_result(transport, actor, org, admin, operator):
    if transport["error"]:
        raise RuntimeError("Transport/fixture SQL error outside the RPC capture: " + json.dumps(transport))
    values = [json.loads(line) for line in transport["stdout"] if line.startswith("{")]
    if len(values) != 1:
        raise RuntimeError("Missing captured RPC result")
    value = values[0]
    check_actor(value.get("actor_at_rpc") or {},actor,org,admin,operator)
    value["capture_method"] = "Session-local SECURITY INVOKER EXCEPTION subtransaction; public RPC unchanged and not paused."
    return value



def require(condition,label):
    if condition is not True:
        raise RuntimeError('H14_REGRESSION: '+label)


def assert_error(value,state,marker):
    require(value.get('error') is True and value.get('sqlstate')==state and (value.get('message') or '').startswith(marker),
            'wrong guarded error: '+json.dumps(value))


def mutation(session,sql,actor,org,isolation='read committed'):
    value=session.json('SELECT pg_temp.h14_race_statement('+lit(sql)+')')
    check_actor(value['actor_at_rpc'],actor,org,True,True,isolation)
    return value


def dependency_sql(f,target=None,name='race-proforma'):
    return 'SELECT pg_temp.h14_fin_proforma('+sql_json(f)+','+lit(name)+','+lit(target or f['embarque_a'])+'::uuid)'


def dependency_id(owner,f,name='race-proforma'):
    return owner.json('SELECT jsonb_build_object(\'id\',pg_temp.h14_fin_uuid('+lit(f['case_key'])+','+lit(name)+'))')['id']


def visible(owner,table,row_id):
    require(table in ('proformas','pagos_factura','factura_embarques'),'fixed visibility table only')
    if table=='factura_embarques':raise ValueError('bridge needs composite key')
    return owner.json('SELECT jsonb_build_object(\'count\',count(*)) FROM public.'+table+' WHERE id='+lit(row_id)+'::uuid')['count']


def final_state(owner,f,dep=None):
    return owner.json("SELECT jsonb_build_object('shipment_deleted',(SELECT deleted_at IS NOT NULL FROM public.embarques WHERE id="+lit(f['embarque_a'])+"::uuid),'dependency_exists',"+("(SELECT count(*) FROM public.proformas WHERE id="+lit(dep)+"::uuid AND deleted_at IS NULL)" if dep else '0')+")")


def advisory_barrier(owner,rpc,writer,lab,case):
    deadline=min(time.monotonic()+8,lab.deadline)
    while time.monotonic()<deadline:
        value=lock_observation(owner,rpc,writer)
        lab.event('advisory_observation',case=case,**value)
        waiting=any(x['pid']==rpc.pid and x['locktype']=='advisory' and x['granted'] is False for x in value['locks'])
        if (value.get('rpc') or {}).get('wait_event_type')=='Lock' and writer.pid in value['blocking_pids'] and waiting:
            return value
    raise UnprovenOrder('No observed advisory wait on the real writer session')


def start_rpc(session,f):
    session.start(rpc_sql(f))


def finish_rpc(session,f):
    result=rpc_result(session.finish(timeout=20),f['actor_a'],f['org_a'],True,True)
    session.run('ROLLBACK' if result['error'] else 'COMMIT')
    return result


def new_actor_session(lab,label,f,isolation='READ COMMITTED'):
    session=lab.session(label)
    session.auth(f['actor_a'],f['org_a'],isolation=isolation)
    return session


def run_case(lab,owner,case):
    start_count=len(lab.sessions);secondary_start=len(lab.secondary_errors)
    observed={};snapshots={};status='OBSERVED';primary_error=None
    try:
        f=seed(owner,case);lab.save(case+'-seed.json',f)
        rpc=new_actor_session(lab,case+'-rpc',f)
        if case in ('C01','C04'):
            actor=f.get('revoked_actor',f['actor_a'])
            if case=='C04':
                rpc.run('ROLLBACK');rpc.auth(actor,f['org_a'],admin=False)
            lab.preflight(case,actor,f['embarque_a'],f['org_a'],case=='C01')
            if case=='C01':
                w=new_actor_session(lab,case+'-writer',f)
                answer=mutation(w,dependency_sql(f),f['actor_a'],f['org_a']);require(answer['error'] is False,'dependency insertion must succeed')
                w.run('COMMIT');observed['dependency_committed']=True
            else:
                before_claims=rpc.auth_snapshot()['claims']
                revoker=new_actor_session(lab,case+'-revoker',f)
                row=revoker.json('WITH gone AS (DELETE FROM public.organization_members WHERE organization_id='+lit(f['org_a'])+'::uuid AND user_id='+lit(actor)+'::uuid RETURNING user_id) SELECT jsonb_build_object(\'count\',count(*)) FROM gone')
                require(row['count']==1,'normal revocation must delete exactly one membership');revoker.run('COMMIT')
                after_actor=rpc.auth_snapshot();check_actor(after_actor,actor,None,False,False)
                require(after_actor['claims']==before_claims,'stale claims must be unchanged')
                observed['actor_after']=after_actor
            before,snapshots['before_rpc']=lab.snapshot(owner,case,'before-rpc',f)
            rpc.start(rpc_sql(f))
            result=rpc_result(rpc.finish(timeout=20),actor,None if case=='C04' else f['org_a'],case=='C01',case=='C01')
            rpc.run('ROLLBACK');after,snapshots['after_rpc']=lab.snapshot(owner,case,'after-rpc',f)
            assert_error(result,'23514' if case=='C01' else '42501','LC_EMBARQUE_BLOQUEADO' if case=='C01' else 'LC_FORBIDDEN')
            require(before==after,'guarded rejection must preserve all business snapshots')
            if case=='C01':require(json.loads(result['hint'])['proformas']==1,'newly committed dependency must appear in HINT')
            observed.update(rpc=result,business_snapshots_unchanged=True)
        elif case=='C14':
            actor=f['revoked_actor'];rpc.run('ROLLBACK');entry=rpc.auth(actor,f['org_a'],admin=False)
            lab.preflight(case,actor,f['embarque_a'],f['org_a'],False)
            writer=new_actor_session(lab,case+'-mutex-writer',f)
            answer=mutation(writer,dependency_sql(f),f['actor_a'],f['org_a']);require(answer['error'] is False,'mutex writer setup succeeds')
            rpc.start(rpc_sql(f));observed['barrier_before_revocation']=advisory_barrier(owner,rpc,writer,lab,case)
            revoker=new_actor_session(lab,case+'-revoker',f)
            gone=revoker.json('WITH gone AS (DELETE FROM public.organization_members WHERE organization_id='+lit(f['org_a'])+'::uuid AND user_id='+lit(actor)+'::uuid RETURNING user_id) SELECT jsonb_build_object(\'count\',count(*)) FROM gone')
            require(gone['count']==1,'normal revocation deletes exactly one membership');revoker.run('COMMIT')
            mirror=owner.json('SELECT jsonb_build_object(\'memberships\',(SELECT count(*) FROM public.organization_members WHERE user_id='+lit(actor)+'::uuid),\'roles\',(SELECT count(*) FROM public.user_roles WHERE user_id='+lit(actor)+'::uuid))')
            require(mirror=={'memberships':0,'roles':0},'normal trigger must remove the role mirror')
            observed['barrier_after_revocation']=advisory_barrier(owner,rpc,writer,lab,case)
            before,snapshots['after_revocation']=lab.snapshot(owner,case,'after-revocation',f)
            writer.run('ROLLBACK')
            answer=rpc_result(rpc.finish(timeout=20),actor,f['org_a'],False,True)
            assert_error(answer,'42501','LC_FORBIDDEN')
            after_actor=rpc.auth_snapshot();check_actor(after_actor,actor,None,False,False)
            require(after_actor['claims']==entry['claims'],'claims remain unchanged across wait and revocation')
            rpc.run('ROLLBACK');after,snapshots['after_rpc']=lab.snapshot(owner,case,'after-rpc',f)
            require(before==after,'post-wait authorization rejection leaves no business mutation')
            observed.update(rpc=answer,entry_actor=entry,actor_after=after_actor,revocation=mirror,business_snapshots_unchanged=True)
        elif case=='C02':
            locker=new_actor_session(lab,case+'-operative-lock',f)
            locker.json('SELECT jsonb_build_object(\'id\',id) FROM public.conceptos_venta WHERE id='+lit(f['lock_row_id'])+'::uuid FOR UPDATE')
            start_rpc(rpc,f);observed['barrier']=barrier(owner,rpc,locker,lab,case)
            before,snapshots['before_writer']=lab.snapshot(owner,case,'before-writer',f)
            writer=new_actor_session(lab,case+'-writer',f)
            result=mutation(writer,dependency_sql(f),f['actor_a'],f['org_a']);assert_error(result,'55P03','LC_EMBARQUE_EN_USO')
            writer.run('ROLLBACK');after,snapshots['after_writer']=lab.snapshot(owner,case,'after-writer',f)
            require(before==after,'NOWAIT writer must leave no partial effects')
            observed['writer']=result;observed['barrier_after_rejected_writer']=barrier(owner,rpc,locker,lab,case)
            locker.run('ROLLBACK');observed['rpc']=finish_rpc(rpc,f)
            require(observed['rpc']['error'] is False,'clean deleter must complete')
            fresh=new_actor_session(lab,case+'-fresh-after-delete',f)
            before,snapshots['before_deleted_writer']=lab.snapshot(owner,case,'before-deleted-writer',f)
            result=mutation(fresh,dependency_sql(f),f['actor_a'],f['org_a']);assert_error(result,'23514','LC_EMBARQUE_ELIMINADO');fresh.run('ROLLBACK')
            after,snapshots['after_deleted_writer']=lab.snapshot(owner,case,'after-deleted-writer',f)
            require(before==after,'fresh deleted-target writer must leave no effects')
            observed.update(fresh_writer=result,final_state=final_state(owner,f,dependency_id(owner,f)))
            require(observed['final_state']=={'shipment_deleted':True,'dependency_exists':0},'no live dependency after deletion')
        elif case in ('C03','C05'):
            writer=new_actor_session(lab,case+'-writer',f)
            answer=mutation(writer,dependency_sql(f),f['actor_a'],f['org_a']);require(answer['error'] is False,'writer setup must succeed')
            dep=dependency_id(owner,f);require(visible(owner,'proformas',dep)==0,'uncommitted writer must be invisible to owner')
            start_rpc(rpc,f);observed['barrier']=advisory_barrier(owner,rpc,writer,lab,case)
            writer.run('COMMIT' if case=='C05' else 'ROLLBACK')
            require(visible(owner,'proformas',dep)==(1 if case=='C05' else 0),'writer transaction outcome must be independently visible')
            before,snapshots['after_writer']=lab.snapshot(owner,case,'after-writer',f)
            observed['rpc']=finish_rpc(rpc,f);after,snapshots['after_rpc']=lab.snapshot(owner,case,'after-rpc',f)
            if case=='C05':
                assert_error(observed['rpc'],'23514','LC_EMBARQUE_BLOQUEADO')
                require(json.loads(observed['rpc']['hint'])['proformas']==1 and before==after,'committed writer must block atomically')
            else:require(observed['rpc']['error'] is False,'rolled-back writer must not invent blocker')
            observed['final_state']=final_state(owner,f,dep)
            require(observed['final_state']=={'shipment_deleted':case=='C03','dependency_exists':1 if case=='C05' else 0},'writer-first final invariant')
        elif case in ('C06','C07'):
            writer=new_actor_session(lab,case+'-first-writer',f)
            answer=mutation(writer,dependency_sql(f),f['actor_a'],f['org_a']);require(answer['error'] is False,'first writer succeeds')
            if case=='C06':
                before,snapshots['before_contender']=lab.snapshot(owner,case,'before-contender',f)
                contender=new_actor_session(lab,case+'-contender',f)
                answer=mutation(contender,dependency_sql(f,name='second-proforma'),f['actor_a'],f['org_a']);assert_error(answer,'55P03','LC_EMBARQUE_EN_USO');contender.run('ROLLBACK')
                after,snapshots['after_contender']=lab.snapshot(owner,case,'after-contender',f)
                require(before==after,'same-org contender must leave no effects');observed['contender']=answer
            else:
                fb=f|{'case_key':case+'.other-org','org_a':f['org_b'],'actor_a':f['actor_b'],'cliente_a':f['cliente_b'],'embarque_a':f['embarque_b']}
                other=new_actor_session(lab,case+'-other-org',fb)
                answer=mutation(other,dependency_sql(fb),fb['actor_a'],fb['org_a']);require(answer['error'] is False,'other company must progress independently');other.run('COMMIT')
                dep=dependency_id(owner,fb);require(visible(owner,'proformas',dep)==1,'other company commit must be visible');observed['other_company']=answer
            writer.run('ROLLBACK');rpc.run('ROLLBACK')
        elif case in ('C08','C09'):
            rpc.run('ROLLBACK')
            owner.run('BEGIN');invoice=owner.json('SELECT jsonb_build_object(\'id\',pg_temp.h14_fin_invoice('+sql_json(f)+",'empty-graph-invoice',NULL::uuid,'Emitida'))")['id'];owner.run('COMMIT')
            child='SELECT pg_temp.h14_fin_customer_payment('+sql_json(f)+",'empty-graph-payment',"+lit(invoice)+'::uuid,10)'
            edge='INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa) VALUES('+lit(invoice)+','+lit(f['embarque_a'])+','+lit(f['org_a'])+',true)'
            first,second=(child,edge) if case=='C08' else (edge,child)
            w=new_actor_session(lab,case+'-first-writer',f);answer=mutation(w,first,f['actor_a'],f['org_a']);require(answer['error'] is False,'empty-graph first writer must succeed')
            before,snapshots['before_competing_graph']=lab.snapshot(owner,case,'before-competing-graph',f)
            v=new_actor_session(lab,case+'-competing-graph',f);answer=mutation(v,second,f['actor_a'],f['org_a']);assert_error(answer,'55P03','LC_EMBARQUE_EN_USO');v.run('ROLLBACK')
            after,snapshots['after_competing_graph']=lab.snapshot(owner,case,'after-competing-graph',f);require(before==after,'empty-graph contender must not mutate');observed['contender']=answer
            w.run('COMMIT')
            v2=new_actor_session(lab,case+'-next-transaction',f);answer=mutation(v2,second,f['actor_a'],f['org_a']);require(answer['error'] is False,'explicit next transaction links the still-live shipment');v2.run('COMMIT')
            rpc.auth(f['actor_a'],f['org_a']);start_rpc(rpc,f);answer=finish_rpc(rpc,f);assert_error(answer,'23514','LC_EMBARQUE_BLOQUEADO')
            hint=json.loads(answer['hint']);require(hint['facturas']==1 and hint['pagos_cxc']==1,'entire newly linked graph must block')
            require(final_state(owner,f)['shipment_deleted'] is False,'linked shipment remains live');observed.update(rpc=answer,graph_initially_empty=True)
        elif case=='C10':
            rpc.run('ROLLBACK')
            fb=f|{'case_key':case+'.foreign','org_a':f['org_b'],'actor_a':f['actor_b'],'cliente_a':f['cliente_b'],'embarque_a':f['embarque_b']}
            locker=new_actor_session(lab,case+'-foreign-writer',fb)
            answer=mutation(locker,dependency_sql(fb),fb['actor_a'],fb['org_a']);require(answer['error'] is False,'foreign writer holds its actual mutex and parent')
            before,snapshots['before_foreign_probe']=lab.snapshot(owner,case,'before-foreign-probe',f)
            probe=new_actor_session(lab,case+'-foreign-probe',f)
            answer=mutation(probe,dependency_sql(f,target=f['embarque_b']),f['actor_a'],f['org_a'])
            assert_error(answer,'42501','LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada')
            require(not answer.get('hint') and not answer.get('detail') and f['embarque_b'] not in answer['message'] and f['org_b'] not in answer['message'],'foreign lock/identity must not leak')
            probe.run('ROLLBACK');after,snapshots['after_foreign_probe']=lab.snapshot(owner,case,'after-foreign-probe',f);require(before==after,'foreign probe leaves all rows unchanged')
            locker.run('ROLLBACK');observed['foreign_probe']=answer
        elif case=='C11':
            rpc.run('ROLLBACK');owner.run('BEGIN');second=owner.json('SELECT jsonb_build_object(\'id\',pg_temp.h14_fin_second_shipment('+sql_json(f)+'))')['id']
            inv1=owner.json('SELECT jsonb_build_object(\'id\',pg_temp.h14_fin_invoice('+sql_json(f)+",'unlinked1',NULL::uuid))")['id']
            inv2=owner.json('SELECT jsonb_build_object(\'id\',pg_temp.h14_fin_invoice('+sql_json(f)+",'unlinked2',NULL::uuid))")['id'];owner.run('COMMIT')
            def edges(invoice,targets):return ';'.join('INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa) VALUES('+lit(invoice)+','+lit(target)+','+lit(f['org_a'])+',true)' for target in targets)
            writer=new_actor_session(lab,case+'-two-target-writer',f);answer=mutation(writer,edges(inv1,[second,f['embarque_a']]),f['actor_a'],f['org_a']);require(answer['error'] is False,'same-transaction two-target mutex reentry succeeds')
            before,snapshots['before_reverse_writer']=lab.snapshot(owner,case,'before-reverse-writer',f)
            contender=new_actor_session(lab,case+'-reverse-writer',f);answer=mutation(contender,edges(inv2,[f['embarque_a'],second]),f['actor_a'],f['org_a']);assert_error(answer,'55P03','LC_EMBARQUE_EN_USO');contender.run('ROLLBACK')
            after,snapshots['after_reverse_writer']=lab.snapshot(owner,case,'after-reverse-writer',f);require(before==after,'reverse contender has zero partial effects');writer.run('COMMIT');observed['reverse_writer']=answer
        elif case in ('C12','C13'):
            rpc.run('ROLLBACK');iso='REPEATABLE READ' if case=='C12' else 'SERIALIZABLE'
            stale=new_actor_session(lab,case+'-stale-writer',f,isolation=iso)
            before=stale.json('SELECT jsonb_build_object(\'deleted\',deleted_at IS NOT NULL) FROM public.embarques WHERE id='+lit(f['embarque_a'])+'::uuid');require(before['deleted'] is False,'writer snapshot begins with live target')
            rpc.auth(f['actor_a'],f['org_a']);start_rpc(rpc,f);answer=finish_rpc(rpc,f);require(answer['error'] is False,'independent RC deletion commits')
            before,snapshots['before_stale_writer']=lab.snapshot(owner,case,'before-stale-writer',f)
            answer=mutation(stale,dependency_sql(f),f['actor_a'],f['org_a'],iso.lower())
            require(answer['error'] is True and answer['sqlstate'] in ('25001','40001'),'stale unsupported writer must fail closed')
            if answer['sqlstate']=='25001':require(answer['message'].startswith('LC_EMBARQUE_AISLAMIENTO_NO_SOPORTADO'),'explicit unsupported isolation marker')
            stale.run('ROLLBACK');after,snapshots['after_stale_writer']=lab.snapshot(owner,case,'after-stale-writer',f);require(before==after,'stale writer has no effects')
            observed.update(stale_writer=answer,final_state=final_state(owner,f,dependency_id(owner,f)))
            require(observed['final_state']=={'shipment_deleted':True,'dependency_exists':0},'stale snapshot cannot create post-delete edge')
        else:raise RuntimeError('Unimplemented expected race case')
    except UnprovenOrder as error:status,primary_error='NOT_EXECUTED_ORDER_UNPROVEN',str(error)
    except Exception as error:status,primary_error='FIXTURE_OR_ASSERTION_FAILED',str(error)
    finally:cleanup_case_sessions(lab,owner,case,list(lab.sessions[start_count:]))
    secondary=lab.secondary_errors[secondary_start:]
    if secondary and status=='OBSERVED':status='OBSERVED_WITH_CLEANUP_FAILURE'
    lab.result(case,status,observed,snapshots=snapshots,error=primary_error,secondary_errors=secondary)


def run_concurrency(context):
    lab=None
    try:
        lab=Lab(context);owner=lab.session('control-owner');before=metadata(owner,lab);lab.save('metadata-before.json',before)
        run_cases(lab,owner);after=metadata(owner,lab);lab.save('metadata-after.json',after)
        require(before==after,'RPC metadata unchanged')
    except Exception as error:
        if lab is None:raise
        lab.event('suite_error',error_type=type(error).__name__,error=str(error));emit_unstarted(lab,error);lab.failures=True
    finally:
        if lab is not None:
            try:lab.close()
            except Exception as error:lab.secondary('suite_cleanup_failed',error=str(error))
            lab.save('driver-summary.json',{'cases':sorted(lab.emitted),'expected_cases':list(CASES),'failures':lab.failures,'secondary_errors':lab.secondary_errors,'execution_complete':lab.emitted==set(CASES) and not lab.failures})
    return {'status':'fail' if lab.failures else 'pass','cases':sorted(lab.emitted)}
