"""Two-session acceptance v2 tests; imported only by the isolated Actions runner.

This module never creates a Docker container, accesses Git, opens a network
connection, installs software, or changes a business function/trigger/ACL. The
parent MUST pass its already-verified owned-container command and a query helper
that observes the SAME disposable database clone. Fixtures are committed so
independent transactions can see them; discard the clone after the suite.
"""
from dataclasses import dataclass
import json
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import uuid


EXPECTED_CASE_IDS = (
    "same_quote_accept_accept",
    "competing_accept_busy_then_conflict",
    "competing_accept_retry_after_rollback",
    "same_quote_convert_convert",
    "sister_accept_during_conversion_commit",
    "sister_accept_during_conversion_rollback_retry",
    "accept_retry_waits_for_conversion",
    "shared_lead_company_conversion_blocks_acceptance",
)
COMMAND_SECONDS = 25
BARRIER_SECONDS = 12
SUITE_SECONDS = 240


@dataclass(frozen=True)
class ConcurrencyContext:
    # query(sql, label, timeout=<seconds>) -> (stdout: str, stderr: str)
    query: object
    # Full argv: docker exec -i ... OWNED_CONTAINER /usr/bin/env -i ... psql
    # -X -w -A -t -v ON_ERROR_STOP=1. No shell interpolation or host ports.
    psql_argv: list
    # Explicit clean Docker environment, not os.environ.
    env: dict
    evidence_dir: Path


def require(condition, message):
    if not condition:
        raise RuntimeError("ACCEPTANCE_CONCURRENCY_ASSERT: " + message)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def one_json(lines, label):
    if isinstance(lines, str):
        lines = lines.splitlines()
    values = []
    for line in lines:
        try:
            values.append(json.loads(line))
        except json.JSONDecodeError:
            if line.strip():
                raise RuntimeError(label + ": unexpected non-JSON output: " + line[:300])
    require(len(values) == 1, label + ": expected exactly one JSON row")
    return values[0]


# SECURITY INVOKER is deliberate: the assertions observe the actual calling
# role/subject. The exception subtransaction catches an actual RPC failure, not
# an imitation. It cannot make a failed SQLSTATE count as successful acceptance.
SESSION_HELPERS = r"""
SET statement_timeout='20s';
SET lock_timeout='18s';
SET idle_in_transaction_session_timeout='45s';
CREATE FUNCTION pg_temp.invoke(operation text, quote_id uuid, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $helper$
DECLARE result jsonb; caller text := current_user; subject uuid := auth.uid();
BEGIN
 IF caller <> 'authenticated' OR subject IS NULL
    OR auth.role() IS DISTINCT FROM 'authenticated'
    OR public.has_role(subject,'super_admin'::public.app_role) THEN
   RAISE EXCEPTION 'ACCEPTANCE_CONCURRENCY_BAD_AUTH';
 END IF;
 BEGIN
  IF operation='accept' THEN
   result := public.aceptar_cotizacion_version(quote_id);
  ELSIF operation='convert' THEN
   result := public.convertir_prospecto_a_cliente_rpc(quote_id,payload);
  ELSE
   RAISE EXCEPTION 'Unknown test operation';
  END IF;
 EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok',false,'sqlstate',SQLSTATE,'message',SQLERRM,
                            'caller',caller,'subject',subject);
 END;
 RETURN jsonb_build_object('ok',true,'value',result,'caller',caller,'subject',subject);
END $helper$;
SELECT jsonb_build_object('pid',pg_backend_pid(),'session_user',session_user,
                         'current_user',current_user);
"""


# This observer never calls a business RPC or changes row values. It acquires
# no lasting row lock: success requires real contention, an explicitly verified
# cancel of its own backend, and ROLLBACK. SQLSTATE 57014 alone is not evidence.
PROBE_HELPERS = r"""
SET statement_timeout='20s';
SET lock_timeout='18s';
SET idle_in_transaction_session_timeout='45s';
CREATE FUNCTION pg_temp.lock_probe(relation_name text, expected_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $probe$
DECLARE actual_id uuid; caller text := current_user; subject uuid := auth.uid();
BEGIN
 IF caller <> 'authenticated' OR subject IS NULL
    OR auth.role() IS DISTINCT FROM 'authenticated'
    OR public.has_role(subject,'super_admin'::public.app_role)
    OR relation_name NOT IN ('cotizaciones','crm_oportunidades','crm_leads','crm_empresas') THEN
   RAISE EXCEPTION 'ACCEPTANCE_CONCURRENCY_BAD_PROBE';
 END IF;
 BEGIN
  EXECUTE format('SELECT id FROM public.%I WHERE id=$1 FOR UPDATE',relation_name)
    INTO actual_id USING expected_id;
  RETURN jsonb_build_object('acquired',actual_id IS NOT NULL,'row_id',actual_id,'caller',caller,'subject',subject);
 EXCEPTION WHEN query_canceled THEN
  RETURN jsonb_build_object('acquired',false,'cancelled',true,'sqlstate',SQLSTATE,
      'message',SQLERRM,'row_id',expected_id,'caller',caller,'subject',subject);
 END;
END $probe$;
SELECT jsonb_build_object('pid',pg_backend_pid(),'session_user',session_user,
                         'current_user',current_user);
"""


class Session:
    """Persistent psql stdin, bounded command acknowledgments, separate logs."""
    def __init__(self, harness, label, probe_only=False):
        self.h = harness
        self.label = label
        self.probe_only = probe_only
        self.application_name = 'acceptance-' + uuid.uuid4().hex
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
                                        + (PROBE_HELPERS if probe_only else SESSION_HELPERS)), label + ' startup')
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
        self.pending = '__ACCEPTANCE_BARRIER_' + uuid.uuid4().hex + '__'
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

    def begin(self, fixture, probe_actor=None):
        require(probe_actor is None or (self.probe_only and probe_actor == 'seller'),
                'Only a non-RPC observer may select the fixture seller')
        self.fixture = dict(fixture)
        self.actor = fixture['seller' if probe_actor == 'seller' else 'manager']
        required_role = 'vendedor' if probe_actor == 'seller' else 'gerente_operaciones' 
        claims = json.dumps({'sub': self.actor, 'role': 'authenticated',
                             'email': self.actor + '@test.invalid'}, separators=(',', ':'))
        data = one_json(self.execute("BEGIN ISOLATION LEVEL READ COMMITTED;\n"
            "SET LOCAL ROLE authenticated;\n"
            "DO $claims$ BEGIN PERFORM set_config('request.jwt.claims'," + literal(claims) + ",true); END $claims$;\n"
            "SELECT jsonb_build_object('pid',pg_backend_pid(),'caller',current_user,'subject',auth.uid(),"
            "'auth_role',auth.role(),'org_scope',public.org_scope(),'member',public.is_org_member(" + literal(fixture['org']) + "::uuid),"
            "'tenant_scope',public.rls_tenant_scope_ok(" + literal(fixture['org']) + "::uuid),"
            "'global_admin',public.has_role(auth.uid(),'super_admin'::public.app_role),"
            "'actor_has_role',public.has_role(auth.uid()," + literal(required_role) + "::public.app_role),"
            "'conversion_authorized',public.has_any_role_in_org(auth.uid(),"
            "ARRAY['admin','admin_org','operador','contador','super_admin']::public.app_role[],"
            + literal(fixture['org']) + "::uuid));"), self.label + ' actor')
        require(data['pid'] == self.pid and data['caller'] == 'authenticated'
                and data['subject'] == self.actor and data['auth_role'] == 'authenticated'
                and data['org_scope'] == fixture['org'] and data['member'] is True
                and data['tenant_scope'] is True and data['global_admin'] is False
                and data['actor_has_role'] is True
                and (probe_actor == 'seller' or data['conversion_authorized'] is True),
                self.label + ': actual role/tenant/legacy hierarchy failed')
        self.auth_context = data

    def call(self, operation, quote_id, payload=None, asynchronous=False):
        require(not self.probe_only, 'A row-lock observer cannot call a business RPC')
        sql = "SELECT pg_temp.invoke(" + ','.join((literal(operation), literal(quote_id) + '::uuid',
              literal(json.dumps(payload or {}, separators=(',', ':'))) + '::jsonb')) + ");"
        self.start(sql)
        if not asynchronous:
            return self.result()

    def result(self):
        data = one_json(self.finish(), self.label + ' RPC')
        require(data['caller'] == 'authenticated' and data['subject'] == self.actor,
                self.label + ': RPC caller identity changed')
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
                                     + str(self.pid) + " AND datname='acceptance_concurrency' AND application_name="
                                     + literal(self.application_name) + ';',
                                     self.label + '-cancel-owned-backend', timeout=5)
            except Exception:
                pass
        if self.process.poll() is None:
            try:
                self.process.stdin.write('\nROLLBACK;\n\\q\n')
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


TABLES = ('organizations', 'organization_members', 'clientes', 'cotizaciones',
          'cotizacion_versiones', 'crm_oportunidades', 'crm_historial_etapas',
          'crm_etapas_pipeline', 'crm_leads', 'crm_empresas', 'crm_oportunidad_empresa',
          'bitacora_actividad', 'crm_notificaciones', 'embarques', 'facturas')


class Harness:
    def __init__(self, context):
        self.context = context
        self.out = Path(context.evidence_dir) / 'concurrency'
        require(not self.out.exists(), 'Concurrency evidence directory must be fresh')
        self.out.mkdir(parents=True)
        self.deadline = time.monotonic() + SUITE_SECONDS
        self.sequence = 0
        self.events = []
        self.row_proofs = {}
        self.sessions = []
        argv = context.psql_argv
        require(isinstance(argv, list) and all(isinstance(a, str) for a in argv), 'argv must be an explicit list')
        require(len(argv) > 10 and Path(argv[0]).name == 'docker' and argv[1] == 'exec'
                and '-i' in argv[2:] and 'psql' in argv and '-X' in argv and '-w' in argv
                and '-A' in argv and '-t' in argv and 'ON_ERROR_STOP=1' in argv,
                'Use owned-container docker exec -i, isolated psql -X -w -A -t ON_ERROR_STOP=1')
        # Suppress psql SET/BEGIN/DDL command tags, leaving JSON and barriers.
        if '-q' not in argv:
            self.context.psql_argv.append('-q')
        require(isinstance(context.env, dict) and context.env.get('DOCKER_HOST') == 'unix:///var/run/docker.sock',
                'Use the parent clean local Docker environment')

    def check_deadline(self):
        if time.monotonic() > self.deadline:
            raise TimeoutError('Concurrency suite exceeded its global deadline')

    def query(self, sql, label, timeout=15):
        self.check_deadline()
        self.sequence += 1
        full_label = f'concurrency-{self.sequence:03}-{label}'
        self.out.joinpath(full_label + '.sql').write_text(sql + '\n')
        stdout, stderr = self.context.query(sql, full_label, timeout=timeout)
        require(not re.search(r'(^|\n)(?:ERROR|FATAL):', stderr), full_label + ': observer SQL error')
        return stdout

    def state(self, f, label):
        org = literal(f['org']) + '::uuid'
        parts = []
        for table in TABLES:
            predicate = 'id=' + org if table == 'organizations' else 'organization_id=' + org
            parts.extend((literal(table), "(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public."
                          + table + ' t WHERE ' + predicate + ')'))
        ids = ','.join(literal(f[k]) + '::uuid' for k in ('manager', 'seller'))
        parts.extend(("'user_roles'", "(SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM public.user_roles t WHERE user_id IN (" + ids + '))',
                      "'auth.users'", "(SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM auth.users t WHERE id IN (" + ids + '))'))
        data = one_json(self.query('SELECT jsonb_build_object(' + ','.join(parts) + ')::text;', label), label)
        self.out.joinpath(label + '.snapshot.json').write_text(json.dumps(data, sort_keys=True, indent=2) + '\n')
        return data

    def wait_blocked(self, waiter, holder, label, relation=None, row_id=None):
        end = min(self.deadline, time.monotonic() + BARRIER_SECONDS)
        latest = None
        while time.monotonic() < end:
            latest = one_json(self.query(
                "SELECT jsonb_build_object('waiter'," + str(waiter.pid) + ", 'holder'," + str(holder.pid)
                + ", 'blockers',pg_blocking_pids(" + str(waiter.pid) + "), 'state',a.state,"
                "'wait_event_type',a.wait_event_type,'wait_event',a.wait_event,'query',a.query,"
                "'locks',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) FROM pg_locks l WHERE l.pid IN ("
                + str(waiter.pid) + ',' + str(holder.pid) + "))) FROM pg_stat_activity a WHERE a.pid="
                + str(waiter.pid) + ';', label), label)
            if holder.pid in latest['blockers'] and latest['wait_event_type'] == 'Lock':
                require(waiter.pending is not None, label + ': waiter did not have an outstanding RPC')
                if relation:
                    self.assert_row_proof(holder, relation, row_id, label + '-target-row')
                self.events.append({'barrier': label, 'proof': latest})
                return
            require(waiter.process.poll() is None, label + ': waiter exited instead of blocking')
            # Polling backoff is never success evidence; only exact blocker data is.
            time.sleep(.04)
        raise TimeoutError(label + ': exact blocking PID was not observed: ' + json.dumps(latest))

    @staticmethod
    def valid_identity(data, session):
        return (data.get('pid') == session.pid
                and data.get('datname') == 'acceptance_concurrency'
                and data.get('application_name') == session.application_name)

    def assert_row_proof(self, holder, relation, row_id, label):
        proof = self.row_proofs.get((holder.pid, relation, row_id))
        require(proof is not None, label + ': exact row must be probed before starting a queued RPC')
        current = one_json(self.query(
            "SELECT jsonb_build_object('pid',a.pid,'datname',a.datname,'application_name',a.application_name,"
            "'backend_xid',a.backend_xid::text,'state',a.state,'xid_lock',EXISTS(SELECT 1 FROM pg_locks l "
            "WHERE l.pid=a.pid AND l.locktype='transactionid' AND l.transactionid=a.backend_xid "
            "AND l.granted AND l.mode='ExclusiveLock')) FROM pg_stat_activity a WHERE a.pid="
            + str(holder.pid) + ';', label), label)
        require(self.valid_identity(current, holder)
                and current['backend_xid'] == proof['holder']['backend_xid']
                and current['backend_xid'] is not None and current['xid_lock'] is True
                and current['state'] in ('active', 'idle in transaction'),
                label + ': row proof does not belong to the same live holder transaction')
        data = {'row_proof': proof['label'], 'relation': relation, 'row_id': row_id,
                'holder_transaction': current}
        self.events.append({'barrier': label, 'proof': data})
        return data

    @staticmethod
    def validate_probe_owner(data, fixture):
        require(data.get('id') == fixture['lead'] and data.get('organization_id') == fixture['org']
                and data.get('vendedor_id') == fixture['seller'] and data.get('caller') == 'authenticated'
                and data.get('subject') == fixture['seller'],
                'Lead observer must read the exact same-tenant lead owned by the fixture seller under RLS')

    def row_held(self, holder, relation, row_id, label):
        require(relation in ('cotizaciones', 'crm_oportunidades', 'crm_leads', 'crm_empresas'), 'Unexpected lock target')
        require(holder.fixture is not None and holder.actor == holder.fixture['manager'],
                'A lock probe requires the same authenticated manager and tenant as the holder')
        require(relation != 'crm_leads' or row_id == holder.fixture['lead'],
                'Seller observer is restricted to the exact fixture lead')
        probe_actor = 'seller' if relation == 'crm_leads' else None
        probe = Session(self, label + '-observer', probe_only=True)
        try:
            require(probe.pid != holder.pid, 'Lock observer must have its own backend')
            probe.begin(holder.fixture, probe_actor=probe_actor)
            ownership = None
            if relation == 'crm_leads':
                ownership = one_json(probe.execute(
                    "SELECT jsonb_build_object('id',id,'organization_id',organization_id,'vendedor_id',vendedor_id,"
                    "'caller',current_user,'subject',auth.uid()) FROM public.crm_leads WHERE id="
                    + literal(row_id) + '::uuid;'), label + '-owner-preflight')
                self.validate_probe_owner(ownership, holder.fixture)
            sql = "SELECT pg_temp.lock_probe(" + literal(relation) + ',' + literal(row_id) + '::uuid);'
            probe.start(sql)
            end = min(self.deadline, time.monotonic() + BARRIER_SECONDS)
            latest = None
            while time.monotonic() < end:
                latest = one_json(self.query(
                    "SELECT jsonb_build_object('probe',jsonb_build_object('pid',p.pid,'datname',p.datname,"
                    "'application_name',p.application_name,'state',p.state,'query',p.query,"
                    "'wait_event_type',p.wait_event_type,'wait_event',p.wait_event),"
                    "'holder',jsonb_build_object('pid',h.pid,'datname',h.datname,'application_name',h.application_name,"
                    "'backend_xid',h.backend_xid::text,'state',h.state),"
                    "'blockers',pg_blocking_pids(p.pid),'locks',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) "
                    "FROM pg_locks l WHERE l.pid IN (p.pid,h.pid))) FROM pg_stat_activity p "
                    "JOIN pg_stat_activity h ON h.pid=" + str(holder.pid) + ' WHERE p.pid=' + str(probe.pid) + ';',
                    label + '-observe'), label)
                require(self.valid_identity(latest['probe'], probe)
                        and self.valid_identity(latest['holder'], holder), label + ': observer/holder identity mismatch')
                p, h = latest['probe'], latest['holder']
                if (latest['blockers'] == [holder.pid] and p['state'] == 'active'
                        and p['wait_event_type'] == 'Lock' and p['wait_event'] == 'transactionid'):
                    require(p['query'].strip() == sql and h['backend_xid'] is not None
                            and h['state'] in ('active', 'idle in transaction'), label + ': unexpected blocked SQL/holder transaction')
                    waiting = [l for l in latest['locks'] if l['pid'] == probe.pid
                               and l['locktype'] == 'transactionid' and not l['granted'] and l['mode'] == 'ShareLock']
                    owned = [l for l in latest['locks'] if l['pid'] == holder.pid
                             and l['locktype'] == 'transactionid' and l['granted'] and l['mode'] == 'ExclusiveLock']
                    require(any(w['transactionid'] == own['transactionid'] for w in waiting for own in owned)
                            and any(own['transactionid'] == h['backend_xid'] for own in owned),
                            label + ': waiting XID must match exact holder lock and live top-level transaction')
                    break
                require(probe.process.poll() is None, label + ': observer exited before lock proof')
                require(not (p['query'].strip() == sql and p['state'] == 'idle in transaction'),
                        label + ': observer completed without blocking on the intended holder; row may be invisible or absent')
                time.sleep(.04)
            else:
                raise TimeoutError(label + ': exact row observer was not blocked by holder: ' + json.dumps(latest))
            cancelled = one_json(self.query(
                "SELECT jsonb_build_object('cancelled',pg_cancel_backend(pid)) FROM pg_stat_activity WHERE pid="
                + str(probe.pid) + " AND datname='acceptance_concurrency' AND application_name="
                + literal(probe.application_name) + " AND state='active' AND btrim(query)=" + literal(sql) + ';',
                label + '-cancel-owned-observer'), label)
            require(cancelled.get('cancelled') is True, label + ': exact owned observer cancellation failed')
            result = one_json(probe.finish(), label + ' observer cancelled')
            require(result.get('acquired') is False and result.get('cancelled') is True
                    and result.get('sqlstate') == '57014'
                    and result.get('message') == 'canceling statement due to user request'
                    and result.get('row_id') == row_id and result.get('caller') == 'authenticated'
                    and result.get('subject') == probe.actor, label + ': observer must report the verified cancellation')
            probe.end(False)
            proof = {'label': label, 'relation': relation, 'row_id': row_id, **latest,
                     'cancellation': cancelled, 'observer_result': result, 'observer_rollback': True,
                     'probe_auth': probe.auth_context, 'lead_owner_preflight': ownership}
            self.row_proofs[(holder.pid, relation, row_id)] = proof
            self.events.append({'barrier': label, 'proof': proof})
            return proof
        finally:
            self.close_pair((probe,))

    def pair(self, label):
        a = Session(self, label + '-a')
        b = Session(self, label + '-b')
        require(a.pid != b.pid, 'Concurrency requires distinct PostgreSQL backends')
        return a, b

    def close_pair(self, pair):
        for session in pair:
            session.close()
            self.sessions.remove(session)

    def seed(self, label, shared=False):
        f = {key: str(uuid.uuid4()) for key in ('org', 'manager', 'seller', 'lead', 'company', 'op', 'quote', 'sister', 'op_two', 'quote_two')}
        f['label'] = label
        f['manager_email'] = f['manager'] + '@test.invalid'
        f['lead_state'] = 'Calificado' if shared else 'Prospecto'
        q = {k: literal(v) for k, v in f.items()}
        sql = """
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='5s';
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 (%(manager)s,%(manager_email)s,'{"skip_auto_org":"true"}'::jsonb),
 (%(seller)s,%(seller)s||'@test.invalid','{"skip_auto_org":"true"}'::jsonb);
INSERT INTO public.organizations(id,nombre) VALUES(%(org)s,'CONCURRENCY '||%(label)s);
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 (%(org)s,%(manager)s,'gerente_operaciones'),(%(org)s,%(seller)s,'vendedor');
DO $fixture$
BEGIN
 IF (SELECT count(*) FROM public.user_roles WHERE user_id IN (%(manager)s::uuid,%(seller)s::uuid)) <> 2
    OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=%(manager)s AND role='gerente_operaciones')
    OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=%(seller)s AND role='vendedor') THEN
   RAISE EXCEPTION 'Membership mirror must create exactly the current roles';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crm_etapas_pipeline WHERE organization_id=%(org)s AND tipo='abierta' AND activa AND deleted_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM public.crm_etapas_pipeline WHERE organization_id=%(org)s AND tipo='ganada' AND activa AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Real organization trigger must provide the open and won pipeline';
 END IF;
END $fixture$;
INSERT INTO public.crm_leads(id,organization_id,empresa,estado,vendedor_id,created_by)
 VALUES(%(lead)s,%(org)s,'Concurrency prospect',%(lead_state)s,%(seller)s,%(seller)s);
INSERT INTO public.crm_empresas(id,organization_id,nombre,lead_origen_id,estado_crm,created_by)
 VALUES(%(company)s,%(org)s,'Concurrency company',%(lead)s,'Prospecto',%(seller)s);
INSERT INTO public.crm_oportunidades(id,organization_id,nombre,lead_id,vendedor_id,created_by,etapa_id,moneda)
 VALUES(%(op)s,%(org)s,'Concurrency opportunity',%(lead)s,%(seller)s,%(seller)s,
 (SELECT id FROM public.crm_etapas_pipeline WHERE organization_id=%(org)s AND tipo='abierta' AND activa AND deleted_at IS NULL ORDER BY orden,id LIMIT 1),'MXN');
INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id)
 VALUES(%(org)s,%(op)s,%(company)s);
INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,
 es_prospecto,prospecto_empresa,oportunidad_id,created_by,fecha_vigencia,conceptos_venta) VALUES
 (%(quote)s,%(org)s,'CONC-'||%(quote)s,'Marítimo','Importación','LCL','Enviada',3,
 true,'Concurrency prospect',%(op)s,%(seller)s,CURRENT_DATE+15,
 '[{"concepto":"Flete","cantidad":1,"precio_unitario":2300,"moneda":"MXN"}]'),
 (%(sister)s,%(org)s,'CONC-'||%(sister)s,'Marítimo','Importación','LCL','Enviada',4,
 true,'Concurrency prospect',%(op)s,%(seller)s,CURRENT_DATE+15,
 '[{"concepto":"Flete","cantidad":1,"precio_unitario":2400,"moneda":"MXN"}]');
""" % q
        if shared:
            sql += """
INSERT INTO public.crm_oportunidades(id,organization_id,nombre,lead_id,vendedor_id,created_by,etapa_id,moneda)
 VALUES(%(op_two)s,%(org)s,'Shared-lead opportunity',%(lead)s,%(seller)s,%(seller)s,
 (SELECT id FROM public.crm_etapas_pipeline WHERE organization_id=%(org)s AND tipo='abierta' AND activa AND deleted_at IS NULL ORDER BY orden,id LIMIT 1),'MXN');
INSERT INTO public.crm_oportunidad_empresa(organization_id,oportunidad_id,empresa_id)
 VALUES(%(org)s,%(op_two)s,%(company)s);
INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,tipo_embarque,estado,version,
 es_prospecto,prospecto_empresa,oportunidad_id,created_by,fecha_vigencia,conceptos_venta)
 VALUES(%(quote_two)s,%(org)s,'CONC-'||%(quote_two)s,'Marítimo','Importación','LCL','Enviada',5,
 true,'Concurrency prospect',%(op_two)s,%(seller)s,CURRENT_DATE+15,
 '[{"concepto":"Flete","cantidad":1,"precio_unitario":2500,"moneda":"MXN"}]');
""" % q
        sql += 'COMMIT;'
        self.query(sql, label + '-seed', timeout=30)
        baseline = self.state(f, label + '-baseline')
        require(not baseline['clientes'], label + ': fixture must not create a client')
        require(all(c['estado'] == 'Enviada' and c['cliente_id'] is None and c['es_prospecto'] is True
                    and c['version_aceptada'] is None and c['aceptada_en'] is None and c['aceptada_por'] is None
                    and c['subtotal'] > 0 for c in baseline['cotizaciones']), label + ': invalid initial quote fixture')
        require(len(baseline['crm_leads']) == 1 and baseline['crm_leads'][0]['estado'] == f['lead_state'],
                label + ': real lead state differs from fixture contract')
        require(len(baseline['crm_empresas']) == 1 and baseline['crm_empresas'][0]['cliente_id'] is None,
                label + ': real company required without client')
        return f, baseline

    def close(self):
        for session in list(self.sessions):
            session.close()
        self.sessions.clear()


def success(response, unchanged, operation, f):
    require(response['ok'] is True, operation + ': unexpected RPC rejection: ' + json.dumps(response))
    value = response['value']
    require(value['sin_cambios'] is unchanged, operation + ': incorrect idempotency result')
    if operation == 'accept':
        require(value['origen_aceptacion'] == 'aceptacion_prospecto_crm', 'Prospect acceptance origin differs')
    else:
        require(value['cliente_id'] and value['oportunidad_id'] == f['op'] and value['lead_id'] == f['lead'],
                'Original conversion response identity differs')
        require(value['creado'] is (not unchanged), 'Fresh generic-RFC fixture must create exactly one client')
        require(value['cotizaciones_revinculadas'] == (0 if unchanged else 1), 'Expected exactly one historical sister relink')
    return value


def failure(response, state, message):
    require(response['ok'] is False and response['sqlstate'] == state and response['message'].startswith(message),
            'Unexpected rejection: expected ' + state + '/' + message + ', got ' + json.dumps(response))


def payload(f):
    return {'nombre': 'CONCURRENCY CLIENT ' + f['label'], 'contacto': 'Fixture Contact',
            'email': f['org'] + '@test.invalid', 'telefono': '5555555555',
            'rfc': 'XAXX010101000', 'direccion': 'Fixture 1', 'ciudad': 'CDMX',
            'estado': 'CDMX', 'cp': '06600', 'regimen_fiscal': '601',
            'uso_cfdi_default': 'G03', 'forma_pago_default': '99', 'metodo_pago_default': 'PPD'}


def row(state, table, row_id):
    matches = [x for x in state[table] if x['id'] == row_id]
    require(len(matches) == 1, table + ': expected one identified row')
    return matches[0]


def seal(state, quote_id):
    quote = row(state, 'cotizaciones', quote_id)
    return {k: quote[k] for k in ('version', 'version_aceptada', 'aceptada_en', 'aceptada_por')}


def assert_final(state, f, winner=None, converted=False, original_seal=None):
    winner = winner or f['quote']
    quote = row(state, 'cotizaciones', winner)
    op = row(state, 'crm_oportunidades', f['op'])
    lead = row(state, 'crm_leads', f['lead'])
    company = row(state, 'crm_empresas', f['company'])
    require(quote['estado'] == 'Aceptada' and quote['version_aceptada'] == quote['version']
            and quote['aceptada_en'] is not None and quote['aceptada_por'] == f['manager'], 'One complete authenticated acceptance seal')
    require(op['cotizacion_ganadora_id'] == winner and op['valor_real'] == quote['subtotal']
            and row(state, 'crm_etapas_pipeline', op['etapa_id'])['tipo'] == 'ganada', 'Winner, real amount and won stage must agree')
    require(sum(x['estado'] in ('Aceptada', 'En operación') for x in state['cotizaciones']) == 1,
            'Exactly one accepted quote across the fixture')
    for other in state['cotizaciones']:
        if other['id'] != winner:
            require(other['estado'] == 'Enviada' and other['version_aceptada'] is None
                    and other['aceptada_en'] is None and other['aceptada_por'] is None, 'Losing quote must remain unsealed')
    require(len(state['crm_historial_etapas']) == 1, 'One CRM stage-history transition')
    for action, entity in (('cotizacion.aceptada_version_fijada', winner), ('oportunidad_ganada_auto', f['op'])):
        require(sum(x['accion'] == action and x['entidad_id'] == entity for x in state['bitacora_actividad']) == 1,
                'Exactly one audit: ' + action)
    require(sum(x['accion'] == 'cotizacion.aceptada_version_fijada' for x in state['bitacora_actividad']) == 1,
            'No losing acceptance audit')
    require(sum(x['accion'].startswith('oportunidad_ganada') for x in state['bitacora_actividad']) == 1,
            'No extra CRM closure, relink or revaluation audit')
    require(sum(x['tipo'] == 'oportunidad_ganada' and x['user_id'] == f['seller']
                and x['link'] == '/crm/oportunidades/' + f['op'] for x in state['crm_notificaciones']) == 1,
            'Exactly one real seller CRM won notification')
    require(sum(x['tipo'] == 'oportunidad_ganada' for x in state['crm_notificaciones']) == 1,
            'No additional won notifications')
    require(not state['embarques'] and not state['facturas'], 'Acceptance/conversion must not create shipments or invoices')
    conversion_audits = [x for x in state['bitacora_actividad'] if x['accion'] == 'convertir_prospecto_a_cliente']
    if converted:
        require(len(state['clientes']) == 1 and len(conversion_audits) == 1, 'Exactly one client and one conversion audit')
        client_id = state['clientes'][0]['id']
        require(quote['cliente_id'] == client_id and quote['es_prospecto'] is False
                and op['cliente_id'] == client_id and lead['cliente_convertido_id'] == client_id
                and lead['oportunidad_convertida_id'] == f['op'] and lead['estado'] == 'Convertido', 'One coherent conversion lineage')
        require(conversion_audits[0]['entidad_id'] == winner, 'Conversion audit must identify the winner')
        require(company['estado_crm'] == 'Cliente' and company['cliente_id'] is None,
                'Original trigger promotes company state; it does not invent a cliente_id link')
        for other in state['cotizaciones']:
            if other['oportunidad_id'] == f['op']:
                require(other['cliente_id'] == client_id and other['es_prospecto'] is False, 'Historical sister must link to exactly that client')
            else:
                require(other['cliente_id'] is None and other['es_prospecto'] is True, 'Different opportunity must not be historically relinked')
    else:
        require(not state['clientes'] and not conversion_audits and quote['cliente_id'] is None
                and quote['es_prospecto'] is True and op['cliente_id'] is None
                and lead['cliente_convertido_id'] is None and lead['oportunidad_convertida_id'] is None,
                'Acceptance must never create or link a client')
        require(lead['estado'] == ('Calificado' if f['lead_state'] == 'Calificado' else 'Pendiente de alta'),
                'Canonical lead state after acceptance')
        require(company['estado_crm'] == 'Prospecto' and company['cliente_id'] is None, 'Acceptance preserves prospect company identity')
    if original_seal is not None:
        require(seal(state, winner) == original_seal, 'Retry/conversion must preserve the exact original acceptance seal')


def accept_committed(h, session, f, label):
    session.begin(f)
    success(session.call('accept', f['quote']), False, 'accept', f)
    session.end()
    result = h.state(f, label)
    assert_final(result, f)
    return result


def case_same_quote_accept(h):
    name = EXPECTED_CASE_IDS[0]
    f, baseline = h.seed(name)
    a, b = pair = h.pair(name)
    try:
        a.begin(f)
        first = success(a.call('accept', f['quote']), False, 'accept', f)
        h.row_held(a, 'cotizaciones', f['quote'], name + '-winner-held')
        b.begin(f)
        b.call('accept', f['quote'], asynchronous=True)
        h.wait_blocked(b, a, name + '-second-accept-blocked', 'cotizaciones', f['quote'])
        a.end()
        committed = h.state(f, name + '-first-commit')
        second = success(b.result(), True, 'accept', f)
        require(first['version_aceptada'] == second['version_aceptada'], 'Concurrent acceptance changed sealed version')
        b.end()
        final = h.state(f, name + '-final')
        require(final == committed, 'Second acceptance must make zero row changes')
        assert_final(final, f)
    finally:
        h.close_pair(pair)


def case_competing_accept(h, rollback):
    name = EXPECTED_CASE_IDS[2 if rollback else 1]
    f, baseline = h.seed(name)
    a, b = pair = h.pair(name)
    try:
        a.begin(f)
        success(a.call('accept', f['quote']), False, 'accept', f)
        h.row_held(a, 'crm_oportunidades', f['op'], name + '-opportunity-held')
        b.begin(f)
        failure(b.call('accept', f['sister']), '55P03', 'LC_COTIZACION_EN_PROCESO:')
        b.end(False)
        require(h.state(f, name + '-busy-no-leak') == baseline, 'Uncommitted holder and rejected contender must be invisible')
        a.end(not rollback)
        if rollback:
            require(h.state(f, name + '-holder-rollback') == baseline, 'Rollback must restore preacceptance rows exactly')
            b.begin(f)
            success(b.call('accept', f['sister']), False, 'accept', f)
            b.end()
            winner, loser = f['sister'], f['quote']
        else:
            winner, loser = f['quote'], f['sister']
        before_retry = h.state(f, name + '-before-retry')
        b.begin(f)
        failure(b.call('accept', loser), 'P0001', 'LC_COTIZACION_GANADORA_EXISTE:')
        b.end(False)
        final = h.state(f, name + '-final')
        require(final == before_retry, 'Loser retry must make zero row changes')
        assert_final(final, f, winner=winner)
    finally:
        h.close_pair(pair)


def case_same_quote_convert(h):
    name = EXPECTED_CASE_IDS[3]
    f, _ = h.seed(name)
    a, b = pair = h.pair(name)
    try:
        accepted = accept_committed(h, a, f, name + '-accepted')
        original_seal = seal(accepted, f['quote'])
        a.begin(f)
        first = success(a.call('convert', f['quote'], payload(f)), False, 'convert', f)
        h.row_held(a, 'cotizaciones', f['quote'], name + '-conversion-row-held')
        b.begin(f)
        b.call('convert', f['quote'], payload(f), asynchronous=True)
        h.wait_blocked(b, a, name + '-second-conversion-blocked', 'cotizaciones', f['quote'])
        a.end()
        committed = h.state(f, name + '-first-commit')
        second = success(b.result(), True, 'convert', f)
        require(first['cliente_id'] == second['cliente_id'], 'Concurrent conversion must return the same client')
        b.end()
        final = h.state(f, name + '-final')
        require(final == committed, 'Conversion retry must make zero row changes')
        assert_final(final, f, converted=True, original_seal=original_seal)
    finally:
        h.close_pair(pair)


def case_sister_during_conversion(h, rollback):
    name = EXPECTED_CASE_IDS[5 if rollback else 4]
    f, _ = h.seed(name)
    a, b = pair = h.pair(name)
    try:
        accepted = accept_committed(h, a, f, name + '-accepted')
        original_seal = seal(accepted, f['quote'])
        b.begin(f)
        held = one_json(b.execute("SELECT jsonb_build_object('id',id) FROM public.cotizaciones WHERE id="
                                  + literal(f['sister']) + '::uuid FOR UPDATE;'), name + '-sister-lock')
        require(held['id'] == f['sister'], 'Authenticated sister row lock must return the intended row')
        h.row_held(b, 'cotizaciones', f['sister'], name + '-sister-row-held')
        a.begin(f)
        a.call('convert', f['quote'], payload(f), asynchronous=True)
        h.wait_blocked(a, b, name + '-conversion-blocked-on-sister', 'cotizaciones', f['sister'])
        h.row_held(a, 'crm_oportunidades', f['op'], name + '-conversion-holds-opportunity')
        failure(b.call('accept', f['sister']), '55P03', 'LC_COTIZACION_EN_PROCESO:')
        # The explicit sister lock predates pg_temp.invoke's exception savepoint:
        # prove conversion is STILL waiting until the outer contender rolls back.
        h.wait_blocked(a, b, name + '-still-blocked-before-rollback')
        b.end(False)
        first = success(a.result(), False, 'convert', f)
        a.end(not rollback)
        if rollback:
            require(h.state(f, name + '-conversion-rollback') == accepted,
                    'Rolled-back original conversion must restore every tracked row')
            b.begin(f)
            retry = success(b.call('convert', f['quote'], payload(f)), False, 'convert', f)
            b.end()
            require(retry['cliente_id'] != first['cliente_id'], 'Rolled-back generated client must not be reused')
        converted = h.state(f, name + '-converted')
        b.begin(f)
        failure(b.call('accept', f['sister']), 'P0001', 'LC_COTIZACION_GANADORA_EXISTE:')
        b.end(False)
        final = h.state(f, name + '-final')
        require(final == converted, 'Post-conversion sister rejection must make zero row changes')
        assert_final(final, f, converted=True, original_seal=original_seal)
    finally:
        h.close_pair(pair)


def case_accept_retry_during_conversion(h):
    name = EXPECTED_CASE_IDS[6]
    f, _ = h.seed(name)
    a, b = pair = h.pair(name)
    try:
        accepted = accept_committed(h, a, f, name + '-accepted')
        a.begin(f)
        success(a.call('convert', f['quote'], payload(f)), False, 'convert', f)
        h.row_held(a, 'cotizaciones', f['quote'], name + '-conversion-row-held')
        b.begin(f)
        b.call('accept', f['quote'], asynchronous=True)
        h.wait_blocked(b, a, name + '-accept-retry-blocked', 'cotizaciones', f['quote'])
        a.end()
        committed = h.state(f, name + '-conversion-commit')
        result = b.result()
        require(result['ok'] is True and result['value']['sin_cambios'] is True
                and result['value']['origen_aceptacion'] == 'autorizacion_cliente',
                'Retry after conversion must use original existing-client idempotent path')
        b.end()
        final = h.state(f, name + '-final')
        require(final == committed, 'Acceptance retry after conversion must make zero row changes')
        assert_final(final, f, converted=True, original_seal=seal(accepted, f['quote']))
    finally:
        h.close_pair(pair)


def case_shared_lead_conversion(h):
    name = EXPECTED_CASE_IDS[7]
    f, _ = h.seed(name, shared=True)
    a, b = pair = h.pair(name)
    try:
        accepted = accept_committed(h, a, f, name + '-accepted')
        # Calificado intentionally survives first acceptance in the original
        # trigger, so the other opportunity is not already invalid merely due
        # to Pendiente de alta. Conversion creates the conflict under test.
        require(row(accepted, 'crm_leads', f['lead'])['estado'] == 'Calificado', 'Shared-lead precondition')
        a.begin(f)
        success(a.call('convert', f['quote'], payload(f)), False, 'convert', f)
        h.row_held(a, 'crm_leads', f['lead'], name + '-shared-lead-held')
        b.begin(f)
        b.call('accept', f['quote_two'], asynchronous=True)
        h.wait_blocked(b, a, name + '-accept-waits-on-shared-lead', 'crm_leads', f['lead'])
        h.row_held(b, 'crm_oportunidades', f['op_two'], name + '-other-opportunity-held')
        h.row_held(a, 'crm_empresas', f['company'], name + '-company-promotion-held')
        a.end()
        committed = h.state(f, name + '-conversion-commit')
        failure(b.result(), 'P0001', 'LC_COTIZACION_ACEPTACION_INCONSISTENTE:')
        b.end(False)
        final = h.state(f, name + '-final')
        require(final == committed, 'Shared-lead conflicting acceptance must fully rollback')
        other = row(final, 'crm_oportunidades', f['op_two'])
        require(other['cotizacion_ganadora_id'] is None and other['cliente_id'] is None
                and row(final, 'crm_etapas_pipeline', other['etapa_id'])['tipo'] == 'abierta',
                'Other opportunity remains open, unconverted and without a winner')
        assert_final(final, f, converted=True, original_seal=seal(accepted, f['quote']))
    finally:
        h.close_pair(pair)


def run_concurrency(context):
    """Run after full real-schema replay + exact v2 candidate in disposable clone.

    Returns the complete ordered case records. Any missing barrier, wrong error,
    failed assertion, timeout, auth mismatch or session failure raises. The
    parent must propagate that exception as a failed CI status, preserve logs,
    and always remove its owned container/clone. This is test evidence, never an
    approval of the candidate. All seeded identities/data are synthetic.
    """
    h = Harness(context)
    results = []
    status = {'status': 'running', 'expected_case_ids': list(EXPECTED_CASE_IDS),
              'cases': results, 'sqlExecuted': True, 'candidateApproval': False,
              'tracked_tables': list(TABLES) + ['user_roles', 'auth.users'],
              'limits': {'command_seconds': COMMAND_SECONDS, 'barrier_seconds': BARRIER_SECONDS,
                         'suite_seconds': SUITE_SECONDS, 'business_sessions_per_case': 2,
                         'transient_lock_observers_at_once': 1,
                         'observer': 'read-only catalog queries plus one authenticated exact-row FOR UPDATE probe (fixture seller owner only for crm_leads, manager otherwise), verified own-PID cancellation and unconditional rollback; no business RPC or row mutation; setup seeding is privileged'}}
    h.out.joinpath('result.json').write_text(json.dumps(status, indent=2) + '\n')
    runners = (
        case_same_quote_accept,
        lambda harness: case_competing_accept(harness, False),
        lambda harness: case_competing_accept(harness, True),
        case_same_quote_convert,
        lambda harness: case_sister_during_conversion(harness, False),
        lambda harness: case_sister_during_conversion(harness, True),
        case_accept_retry_during_conversion,
        case_shared_lead_conversion,
    )
    try:
        for case_id, runner in zip(EXPECTED_CASE_IDS, runners):
            started = time.monotonic()
            event_start = len(h.events)
            runner(h)
            results.append({'id': case_id, 'status': 'pass', 'seconds': round(time.monotonic() - started, 3),
                            'barriers': h.events[event_start:]})
            h.out.joinpath('result.json').write_text(json.dumps(status, indent=2) + '\n')
        require(tuple(r['id'] for r in results) == EXPECTED_CASE_IDS, 'Missing or reordered concurrency case')
        status['status'] = 'pass'
        return results
    except BaseException as error:
        status.update(status='fail', error_type=type(error).__name__, error=str(error))
        raise
    finally:
        try:
            h.close()
        finally:
            status['barriers'] = h.events
            h.out.joinpath('result.json').write_text(json.dumps(status, indent=2) + '\n')
