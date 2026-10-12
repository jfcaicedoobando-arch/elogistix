#!/usr/bin/env python3
"""Test the original atomic envelope in one owned offline PostgreSQL 17.6.
Only its live OID guard is adapted, once, to the recorded fixture OID.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import tarfile
import tempfile
import time
import traceback

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REPO = 'jfcaicedoobando-arch/elogistix'
BRANCH = 'test/acceptance-envelope-pg176-20261012'
PREFIX = 'scripts/ci/acceptance-envelope-review/'
REFERENCE = 'scripts/ci/acceptance-candidate-review/'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
ENVELOPE_SHA = '65fd583e184f86cc09cee5327d759e12cc97893d66a00baa60668f9ec0ec168b'
PAYLOAD_SHA = 'cc2d39e7ed1c1999b7ce95a7199209ab204689f4acf11d9091f5e62094c0093d'
BODY_BEFORE = '89e114be7a0db169dfbcbbe143e2c2a241f572cfd9023da9171be17898a8f0fa'
BODY_AFTER = '22243869551dd6eb27e055d2003c54526695e027c5181d1abc698ed5e36f0fca'
DEFINITION_BEFORE = 'aa8ddf58649533b60cc62be92d0d72a57cdcc7b022831e8ae58fcb246199ef73'
INDEX_SHA = '82ba907d535c33216899d10417a37987f44a336fe47d5e8cab789a60025effcd'
CATALOG_SHA = 'bbf621cc9338e148a8aa6b34d01c665fada25219150d594e02e8015bf79591a7'
VERSION = '20261012160000'
CASES = ['oid_guard', 'wrong_database_guard', 'payload_encoding_guard', 'source_drift', 'acl_drift', 'security_definer_drift',
         'owner_drift', 'configuration_drift', 'duplicate_ledger', 'post_execute_rollback', 'ledger_postcondition_rollback', 'deferred_commit_rollback',
         'metadata_postcondition_rollback', 'advisory_lock_timeout', 'ledger_lock_timeout',
         'exact_apply_after_lock_release', 'separate_readback', 'retry_existing_ledger']


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def regular(root, relative):
    path = Path(relative)
    require(not path.is_absolute() and '..' not in path.parts, 'Unsafe source path')
    current = root
    for part in path.parts:
        current = current / part
        require(not current.is_symlink(), 'Symlink input refused')
    require(current.is_file() and stat.S_ISREG(current.stat().st_mode), 'Missing regular file: ' + relative)
    return current


def payload(envelope):
    parts = envelope.split('$migration_payload$')
    require(len(parts) == 3, 'Exactly one payload delimiter pair required')
    return parts[1].encode()


def adapt_oid(envelope, oid):
    require(sha(envelope.encode()) == ENVELOPE_SHA, 'Unreviewed envelope')
    require(isinstance(oid, int) and oid > 0 and oid != 100911, 'Distinct local OID required')
    require(envelope.count('v_before.oid <> 100911') == 1, 'One OID guard required')
    adapted = envelope.replace('v_before.oid <> 100911', 'v_before.oid <> ' + str(oid))
    require(payload(adapted) == payload(envelope) and sha(payload(adapted)) == PAYLOAD_SHA, 'Payload changed')
    require(adapted.replace('v_before.oid <> ' + str(oid), 'v_before.oid <> 100911') == envelope, 'Unexpected adaptation')
    return adapted


def logical_catalog(value):
    value = json.loads(json.dumps(value))
    for relation in value['relations'] or []:
        for key in ('relpages', 'reltuples', 'relallvisible', 'relallfrozen', 'relfrozenxid', 'relminmxid'):
            relation.pop(key, None)
    return value


def assert_only_source_delta(before, after):
    before, after = logical_catalog(before), logical_catalog(after)
    proc = next(p for p in before['procs'] if p['proname'] == 'aceptar_cotizacion_version')
    actual = next(p for p in after['procs'] if p['oid'] == proc['oid'])
    require(sha(proc['prosrc'].encode()) == BODY_BEFORE, 'Baseline body mismatch')
    require(sha(actual['prosrc'].encode()) == BODY_AFTER, 'Installed body mismatch')
    actual['prosrc'] = proc['prosrc']
    require(after == before, 'Unexpected logical catalog/ACL/FK change')


def static_check():
    original = (HERE / 'apply_atomic.sql').read_bytes()
    require(sha(original) == ENVELOPE_SHA and sha(payload(original.decode())) == PAYLOAD_SHA, 'Envelope/payload bytes drift')
    require(original.count(b'COMMIT;') == 1 and original.rstrip().endswith(b'COMMIT;'), 'Expected transaction shape')
    require(sha((HERE / 'readback.sql').read_bytes()) == 'd3f0298b970d1c079e29c85696013a671e727c9adc9b8cfd38e522722f6c6ffe', 'Original readback drift')
    require(sha((HERE / 'ledger-metadata-live.json').read_bytes()) == 'ceb2e24c8e004584e38ea1a251b62e21dfb1525f9f088bdbca78f135125f0cdf', 'Ledger metadata evidence drift')
    require(len(CASES) == len(set(CASES)) == 18, 'Case inventory mismatch')
    return original.decode()


def main():
    original = static_check()
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Actions only; no remote/local fallback')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request' and os.environ.get('GITHUB_REPOSITORY') == REPO, 'Wrong event/repository')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    pr = event['pull_request']
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unexpected event action')
    head = os.environ.get('REVIEW_COMMIT', '')
    require(re.fullmatch('[0-9a-f]{40}', head) and head == pr['head']['sha'], 'Exact head required')
    require(pr['head']['repo']['full_name'] == pr['base']['repo']['full_name'] == REPO, 'Fork refused')
    require(pr['head']['ref'] == BRANCH and pr['base']['ref'] == 'main', 'Wrong evidence branch')
    clean = {'PATH': os.environ['PATH'], 'LANG': 'C', 'LC_ALL': 'C'}
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, env=clean, text=True).strip() == head, 'Checkout mismatch')
    index_bytes = regular(ROOT, REFERENCE + 'replay-source-index.json').read_bytes()
    require(sha(index_bytes) == INDEX_SHA, 'Replay index drift')
    index = json.loads(index_bytes)
    require(index['base'] == 'becc073819df29dfc4bf4619e1deb5be92c0a4be' and len(index['files']) == 1528, 'Wrong backend index')
    inputs = {}
    for item in index['files']:
        data = regular(ROOT, item['path']).read_bytes()
        require(len(data) == item['bytes'] and blob(data) == item['git_blob_sha'], 'Pinned backend drift: ' + item['path'])
        require(item['path'] not in inputs, 'Duplicate source')
        inputs[item['path']] = data
    require(not any('_ci_post_migrate.sql' in p or VERSION in p for p in inputs), 'Relaxed setup/candidate cannot enter baseline replay')
    catalog = regular(ROOT, REFERENCE + 'catalog.sql').read_bytes()
    require(sha(catalog) == CATALOG_SHA, 'Strict catalog observer drift')
    for path in ('supabase/migrations/20261012160000_aceptacion_prospectos_crm.sql', 'supabase/schema/cotizaciones/aceptar_cotizacion_version.sql'):
        require(regular(ROOT, path).read_bytes() == payload(original), 'Merged migration/mirror differs from payload')
    for path in HERE.iterdir():
        if path.is_file() and path.suffix in ('.sql', '.json', '.py', '.md'):
            inputs[PREFIX + path.name] = regular(ROOT, PREFIX + path.name).read_bytes()
    inputs[REFERENCE + 'replay-source-index.json'] = index_bytes
    inputs[REFERENCE + 'catalog.sql'] = catalog
    out = ROOT / 'reports/acceptance-envelope-review'
    require(not out.exists(), 'Fresh evidence path required')
    out.mkdir(parents=True)
    record = {'format': 1, 'repository': REPO, 'head': head, 'observedBase': pr['base']['sha'],
              'sourceBase': index['base'], 'status': 'running', 'imageDigest': IMAGE, 'envelopeSha256': ENVELOPE_SHA,
              'payloadSha256': PAYLOAD_SHA, 'remoteDatabaseAccess': False, 'cases': [],
              'sources': {p: {'sha256': sha(b), 'bytes': len(b)} for p, b in inputs.items()},
              'containerRemoved': False, 'containerAbsenceVerified': False}
    def save():
        (out / 'run.json').write_text(json.dumps(record, indent=2) + '\n')
    save()
    scratch = tempfile.TemporaryDirectory(prefix='acceptance-envelope-owned-')
    env = {**clean, 'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': scratch.name}
    owned = None
    counter = 0
    def docker(arguments, **kw):
        return subprocess.run(['docker', *arguments], env=env, **kw)
    def pg_env():
        return ['/usr/bin/env', '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
                'PGHOST=127.0.0.1', 'PGPORT=5432', 'PGUSER=postgres', 'PGDATABASE=postgres',
                'PGCONNECT_TIMEOUT=5', 'PGSSLMODE=disable', 'PGPASSFILE=/tmp/nonexistent.pgpass']
    def argv():
        return ['docker', 'exec', '-i', '-w', '/tmp/repo', owned, *pg_env(), 'psql', '-X', '-w', '-q', '-A', '-t',
                '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
    def result_files(label, sql, result):
        nonlocal counter
        require(re.fullmatch('[a-z0-9_-]+', label), 'Unsafe evidence label')
        counter += 1
        prefix = out / ('%03d-%s' % (counter, label))
        Path(str(prefix) + '.sql').write_text(sql)
        Path(str(prefix) + '.stdout.log').write_text(result.stdout)
        Path(str(prefix) + '.stderr.log').write_text(result.stderr)
        return result
    def query(sql, label, error=None, timeout=60):
        result = result_files(label, sql, subprocess.run(argv(), env=env, input=sql, text=True, capture_output=True, timeout=timeout))
        if error:
            require(result.returncode != 0 and re.search(error, result.stderr), label + ' did not reject as required: ' + result.stderr[-1200:])
        else:
            require(result.returncode == 0 and not re.search(r'(^|\n)(?:ERROR|FATAL):', result.stderr), label + ' failed: ' + result.stderr[-1200:])
        return result.stdout.strip()
    def case(name):
        require(name == CASES[len(record['cases'])], 'Unexpected case order')
        record['cases'].append({'id': name, 'status': 'pass'})
        save()
    def interrupted(signum, frame):
        raise KeyboardInterrupt('Signal ' + str(signum))
    signal.signal(signal.SIGTERM, interrupted)
    try:
        pulled = docker(['pull', IMAGE], capture_output=True, text=True, timeout=180)
        (out / 'image-pull.log').write_text(pulled.stdout + pulled.stderr)
        require(pulled.returncode == 0, 'Pinned official image unavailable')
        boot = """set -euo pipefail
export PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin
test "$(id -un)" = postgres
initdb -D /tmp/pgdata -U postgres --no-locale -E UTF8 --auth=trust
printf "\\nlisten_addresses='127.0.0.1'\\nunix_socket_directories='/tmp'\\n" >> /tmp/pgdata/postgresql.conf
pg_ctl -D /tmp/pgdata -l /tmp/postgres.log -w start
mkdir -p /tmp/repo
exec sleep infinity"""
        created = docker(['create', '--network=none', '--user=postgres', '--read-only', '--cap-drop=ALL',
                          '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,mode=1777,size=3g',
                          '--tmpfs', '/var/lib/postgresql/data:rw,mode=1777', '--shm-size=256m',
                          '--memory=4g', '--cpus=2', '--pids-limit=256', '--entrypoint=/usr/bin/env', IMAGE,
                          '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C', 'bash', '-c', boot],
                         capture_output=True, text=True, timeout=30)
        require(created.returncode == 0, 'Container creation failed')
        owned = created.stdout.strip()
        require(re.fullmatch('[0-9a-f]{64}', owned), 'Exact owned CID required')
        record['containerId'] = owned
        inspected = docker(['inspect', owned], text=True, capture_output=True, timeout=20)
        require(inspected.returncode == 0, 'Container inspection failed')
        info = json.loads(inspected.stdout)[0]
        hc = info['HostConfig']
        require(hc['NetworkMode'] == 'none' and not hc['PortBindings'] and not hc['Binds'] and hc['ReadonlyRootfs']
                and info['Config']['User'] == 'postgres' and not hc['Privileged'] and 'ALL' in hc['CapDrop']
                and 'no-new-privileges:true' in hc['SecurityOpt']
                and all(m['Type'] == 'tmpfs' and m['Destination'] in ('/tmp', '/var/lib/postgresql/data') for m in info['Mounts']), 'Isolation mismatch')
        record['isolation'] = {k: hc[k] for k in ('NetworkMode', 'PortBindings', 'Binds', 'ReadonlyRootfs', 'Privileged', 'CapDrop', 'SecurityOpt')}
        record['isolation'].update(user=info['Config']['User'], mounts=info['Mounts'])
        save()
        require(docker(['start', owned], capture_output=True, timeout=20).returncode == 0, 'Container start failed')
        for _ in range(150):
            ready = docker(['exec', owned, *pg_env(), 'psql', '-X', '-w', '-Atc', 'SELECT 1'], capture_output=True, timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Owned PG17.6 never ready')
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            for path, data in inputs.items():
                member = tarfile.TarInfo(path)
                member.size, member.mode = len(data), 0o600
                archive.addfile(member, io.BytesIO(data))
        packed = stream.getvalue()
        (out / 'verified-source-inputs.tar').write_bytes(packed)
        record.update(sourceArchiveSha256=sha(packed), sourceArchiveFileCount=len(inputs))
        require(docker(['exec', '-i', owned, 'tar', '-xf', '-', '-C', '/tmp/repo'], input=packed, capture_output=True, timeout=60).returncode == 0, 'Source transfer failed')
        identity = query("SELECT current_database()||':'||current_setting('server_version_num')||':'||current_user||':'||session_user;", 'runtime')
        require(identity == 'postgres:170006:postgres:postgres', 'Exact PG17.6/session identity mismatch')
        record['runtime'] = identity
        replay = docker(['exec', '-w', '/tmp/repo', owned, *pg_env(), 'bash', 'scripts/ci/rls-prepare-db.sh'], capture_output=True, text=True, timeout=900)
        (out / 'replay.stdout.log').write_text(replay.stdout)
        (out / 'replay.stderr.log').write_text(replay.stderr)
        require(replay.returncode == 0, 'Exact strict replay failed; no fallback')
        query((HERE / 'ledger-fixture.sql').read_text(), 'ledger-fixture')
        metadata = json.loads(query("SELECT jsonb_build_object('oid',p.oid::bigint,'source',p.prosrc,'definition',pg_get_functiondef(p.oid),'acl',p.proacl::text,'owner',pg_get_userbyid(p.proowner),'config',p.proconfig,'security_definer',p.prosecdef)::text FROM pg_proc p WHERE p.oid='public.aceptar_cotizacion_version(uuid)'::regprocedure;", 'baseline-metadata'))
        require(sha(metadata['source'].encode()) == BODY_BEFORE and sha(metadata['definition'].encode()) == DEFINITION_BEFORE, 'Exact live baseline not reproduced')
        require(metadata['acl'] == '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' and metadata['owner'] == 'postgres'
                and metadata['config'] == ['search_path=public'] and metadata['security_definer'] is True, 'Access metadata drift')
        adapted = adapt_oid(original, metadata['oid'])
        (out / 'original-envelope.sql').write_text(original)
        (out / 'fixture-envelope.sql').write_text(adapted)
        record['oidAdaptation'] = {'original': 100911, 'fixture': metadata['oid'], 'fixtureEnvelopeSha256': sha(adapted.encode()), 'onlyChange': 'v_before.oid guard integer'}
        # Broaden observation, never access, to the synthetic ledger schema.
        catalog_sql = catalog.decode().replace("n.nspname='public'", "n.nspname IN ('public','supabase_migrations')").replace("('public','auth')", "('public','auth','supabase_migrations')")
        catalog_sql = catalog_sql.rstrip().removesuffix(')::text;') + ", 'event_triggers',(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.oid) FROM pg_event_trigger e))::text;"
        tables = json.loads(query("SELECT jsonb_agg(format('%I.%I',n.nspname,c.relname) ORDER BY n.nspname,c.relname)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND c.relkind IN ('r','p');", 'table-inventory'))
        row_sql = 'SELECT jsonb_object_agg(name,state ORDER BY name)::text FROM (' + ' UNION ALL '.join(
            "SELECT '" + t.replace("'", "''") + "'::text AS name,jsonb_build_object('count',count(*),'md5',md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]'))) AS state FROM " + t + ' t' for t in tables) + ') s;'
        ledger_sql = "SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY version),'[]'::jsonb)::text FROM supabase_migrations.schema_migrations t;"
        def snapshot(label, database='postgres'):
            require(database in ('postgres', 'envelope_wrong_database'), 'Unowned snapshot database')
            connect = '\\connect envelope_wrong_database\n' if database != 'postgres' else ''
            state = {'catalog': logical_catalog(json.loads(query(connect + catalog_sql, label + '-catalog'))),
                     'rows': json.loads(query(connect + row_sql, label + '-rows')), 'ledger': json.loads(query(connect + ledger_sql, label + '-ledger'))}
            (out / (label + '.json')).write_text(json.dumps(state, indent=2) + '\n')
            return state
        baseline = snapshot('baseline')
        fk = [c for c in baseline['catalog']['constraints'] if c['contype'] == 'f' and c['confrelid'] == next(c['oid'] for c in baseline['catalog']['relations'] if c['relname'] == 'users')]
        require(len(fk) == 13 and all(c['convalidated'] for c in fk), '13 real auth FK required')
        record['authForeignKeys'] = len(fk)
        record['businessTableCount'] = len(tables)
        def rejected(name, sql=adapted, error='P0001.*', before=None):
            expected = snapshot(name + '-before') if before is None else before
            query(sql, name, error=error)
            require(snapshot(name + '-after') == expected, name + ' leaked source/ACL/business/ledger changes')
            case(name)
        rejected('oid_guard', sql=original, error='Live baseline/owner/ACL/config/source changed')
        query('CREATE DATABASE envelope_wrong_database TEMPLATE postgres;', 'prepare-wrong-database')
        wrong_before = snapshot('wrong-database-before', database='envelope_wrong_database')
        query('\\connect envelope_wrong_database\n' + adapted, 'wrong-database-attempt', error='Unexpected database/session identity or PostgreSQL version')
        require(snapshot('wrong-database-after', database='envelope_wrong_database') == wrong_before, 'Wrong database rejection leaked changes')
        query('DROP DATABASE envelope_wrong_database;', 'remove-wrong-database')
        require(snapshot('wrong-database-source-after') == baseline, 'Wrong database clone changed source')
        case('wrong_database_guard')
        rejected('payload_encoding_guard', sql="SET client_encoding='LATIN1';\n" + adapted, error='Migration payload hash mismatch')
        query(metadata['definition'].replace('DECLARE\n', 'DECLARE\n  -- isolated deliberate source drift\n', 1), 'prepare-source-drift')
        rejected('source_drift', error='Live baseline/owner/ACL/config/source changed')
        query(metadata['definition'], 'restore-source')
        query('REVOKE EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) FROM service_role;', 'prepare-acl-drift')
        rejected('acl_drift', error='Live baseline/owner/ACL/config/source changed')
        query('GRANT EXECUTE ON FUNCTION public.aceptar_cotizacion_version(uuid) TO service_role;', 'restore-acl')
        query('ALTER FUNCTION public.aceptar_cotizacion_version(uuid) SECURITY INVOKER;', 'prepare-security-drift')
        rejected('security_definer_drift', error='Live baseline/owner/ACL/config/source changed')
        query('ALTER FUNCTION public.aceptar_cotizacion_version(uuid) SECURITY DEFINER;', 'restore-security')
        query('CREATE ROLE envelope_ci_owner NOLOGIN; ALTER FUNCTION public.aceptar_cotizacion_version(uuid) OWNER TO envelope_ci_owner;', 'prepare-owner-drift')
        rejected('owner_drift', error='Live baseline/owner/ACL/config/source changed')
        query('ALTER FUNCTION public.aceptar_cotizacion_version(uuid) OWNER TO postgres; DROP ROLE envelope_ci_owner;', 'restore-owner')
        query('ALTER FUNCTION public.aceptar_cotizacion_version(uuid) SET search_path = public, pg_catalog;', 'prepare-configuration-drift')
        rejected('configuration_drift', error='Live baseline/owner/ACL/config/source changed')
        query('ALTER FUNCTION public.aceptar_cotizacion_version(uuid) SET search_path = public;', 'restore-configuration')
        query("INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ('20261012160000','isolated_existing',ARRAY['different historical SQL']);", 'prepare-existing-ledger')
        rejected('duplicate_ledger', error='Migration already recorded')
        query("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261012160000';", 'restore-ledger')
        for name, mode in [('post_execute_rollback','raise'), ('ledger_postcondition_rollback','suppress'), ('deferred_commit_rollback','deferred')]:
            hook = "CREATE FUNCTION public.envelope_ci_failure() RETURNS trigger LANGUAGE plpgsql AS $hook$ BEGIN IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc WHERE oid='public.aceptar_cotizacion_version(uuid)'::regprocedure),'UTF8')),'hex') <> '" + BODY_AFTER + "' THEN RAISE EXCEPTION 'Fixture expected exact candidate before ledger'; END IF; "
            if mode == 'suppress':
                hook += 'RETURN NULL; END $hook$; CREATE TRIGGER envelope_ci_failure BEFORE INSERT ON supabase_migrations.schema_migrations FOR EACH ROW EXECUTE FUNCTION public.envelope_ci_failure();'
                error = 'Ledger postcondition failed'
            elif mode == 'deferred':
                hook += "IF NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261012160000' AND name='aceptacion_prospectos_crm' AND cardinality(statements)=1 AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='" + PAYLOAD_SHA + "') THEN RAISE EXCEPTION 'Fixture expected exact inserted ledger'; END IF; RAISE EXCEPTION 'ENVELOPE_CI_DEFERRED_AFTER_EXACT_LEDGER'; END $hook$; CREATE CONSTRAINT TRIGGER envelope_ci_failure AFTER INSERT ON supabase_migrations.schema_migrations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.envelope_ci_failure();"
                error = 'ENVELOPE_CI_DEFERRED_AFTER_EXACT_LEDGER'
            else:
                hook += "RAISE EXCEPTION 'ENVELOPE_CI_AFTER_EXACT_EXECUTE'; END $hook$; CREATE TRIGGER envelope_ci_failure BEFORE INSERT ON supabase_migrations.schema_migrations FOR EACH ROW EXECUTE FUNCTION public.envelope_ci_failure();"
                error = 'ENVELOPE_CI_AFTER_EXACT_EXECUTE'
            query(hook, name + '-install-hook')
            rejected(name, error=error)
            query('DROP TRIGGER envelope_ci_failure ON supabase_migrations.schema_migrations; DROP FUNCTION public.envelope_ci_failure();', name + '-remove-hook')
        query("CREATE FUNCTION public.envelope_ci_ddl_failure() RETURNS event_trigger LANGUAGE plpgsql AS $hook$ BEGIN ALTER FUNCTION public.aceptar_cotizacion_version(uuid) COST 101; END $hook$; CREATE EVENT TRIGGER envelope_ci_ddl_failure ON ddl_command_end WHEN TAG IN ('CREATE FUNCTION') EXECUTE FUNCTION public.envelope_ci_ddl_failure();", 'install-ddl-hook')
        rejected('metadata_postcondition_rollback', error='Postcondition failed: metadata/ACL altered or source hash unexpected')
        query('DROP EVENT TRIGGER envelope_ci_ddl_failure; DROP FUNCTION public.envelope_ci_ddl_failure();', 'remove-ddl-hook')
        query('VACUUM supabase_migrations.schema_migrations;', 'vacuum-ledger-after-hook-cleanup')
        require(snapshot('restored-after-injections') == baseline, 'Fixture cleanup failed')
        for name, lock_sql, locktype in [('advisory_lock_timeout', 'SELECT pg_advisory_xact_lock(20261012,160000);', 'advisory'),
                                         ('ledger_lock_timeout', 'LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;', 'relation')]:
            holder_app = 'envelope_holder_' + name
            waiter_app = 'envelope_waiter_' + name
            holder_sql = "SET application_name='" + holder_app + "'; BEGIN; SET LOCAL idle_in_transaction_session_timeout='20s'; " + lock_sql + " SELECT pg_backend_pid();\n\\echo HOLDER_READY\n"
            holder = subprocess.Popen(argv(), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
            waiter = None
            try:
                holder.stdin.write(holder_sql); holder.stdin.flush()
                # Observe backend readiness via another connection, not buffered stdout timing.
                pid = None
                for _ in range(60):
                    seen = query("SELECT coalesce(jsonb_agg(jsonb_build_object('pid',a.pid,'state',a.state,'database',a.datname,'locks',l.locktype)),'[]'::jsonb)::text FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid WHERE a.application_name='" + holder_app + "' AND a.datname='postgres' AND a.state='idle in transaction' AND l.granted AND l.locktype='" + locktype + "'" + (" AND l.classid=20261012 AND l.objid=160000 AND l.objsubid=2" if locktype == 'advisory' else " AND l.relation='supabase_migrations.schema_migrations'::regclass AND l.mode='ShareRowExclusiveLock'") + ';', name + '-holder-ready')
                    rows = json.loads(seen)
                    if rows:
                        require(len(rows) == 1, 'Ambiguous holder identity')
                        pid = rows[0]['pid']; break
                    time.sleep(.05)
                require(pid is not None, 'Owned holder did not acquire expected lock')
                waiter_sql = "SET application_name='" + waiter_app + "';\n" + adapted
                waiter = subprocess.Popen(argv(), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                waiter.stdin.write(waiter_sql); waiter.stdin.close(); waiter.stdin = None
                proof = None
                for _ in range(30):
                    rows = json.loads(query("SELECT coalesce(jsonb_agg(jsonb_build_object('pid',a.pid,'application',a.application_name,'database',a.datname,'wait_event_type',a.wait_event_type,'query',a.query,'blockers',pg_blocking_pids(a.pid),'locktype',l.locktype,'mode',l.mode,'relation',l.relation,'classid',l.classid,'objid',l.objid)),'[]'::jsonb)::text FROM pg_stat_activity a JOIN pg_locks l ON l.pid=a.pid WHERE a.application_name='" + waiter_app + "' AND a.datname='postgres' AND NOT l.granted AND l.locktype='" + locktype + "';", name + '-blocking-proof'))
                    if rows:
                        require(len(rows) == 1 and rows[0]['blockers'] == [pid] and rows[0]['wait_event_type'] == 'Lock', 'Wrong live blocking identity')
                        proof = rows[0]; break
                    if waiter.poll() is not None:
                        break
                    time.sleep(.025)
                require(proof is not None, 'No actual two-session blocking evidence')
                output, errors = waiter.communicate(timeout=10)
                result_files(name, waiter_sql, subprocess.CompletedProcess(argv(), waiter.returncode, output, errors))
                require(waiter.returncode != 0 and '55P03' in errors and 'canceling statement due to lock timeout' in errors, 'Expected lock timeout did not occur')
                (out / (name + '-blocking.json')).write_text(json.dumps({'holderPid': pid, 'waiter': proof}, indent=2) + '\n')
            finally:
                if waiter is not None and waiter.poll() is None:
                    waiter.terminate(); waiter.communicate(timeout=10)
                if holder.poll() is None:
                    holder.stdin.write('ROLLBACK;\n\\q\n'); holder.stdin.flush()
                output, errors = holder.communicate(timeout=10)
                result_files(name + '-holder', holder_sql + 'ROLLBACK;\n\\q\n', subprocess.CompletedProcess(argv(), holder.returncode, output, errors))
                require(holder.returncode == 0, 'Holder rollback failed')
            require(snapshot(name + '-after') == baseline, 'Lock timeout changed database state')
            case(name)
        query(adapted, 'exact-apply')
        installed = snapshot('installed')
        assert_only_source_delta(baseline['catalog'], installed['catalog'])
        require(installed['rows'] == baseline['rows'], 'Application changed business rows')
        require(len(installed['ledger']) == 1, 'Exactly one ledger row required')
        ledger = installed['ledger'][0]
        require(ledger['version'] == VERSION and ledger['name'] == 'aceptacion_prospectos_crm' and ledger['statements'] == [payload(original).decode()]
                and all(ledger[k] is None for k in ('created_by','idempotency_key','rollback')), 'Exact ledger values mismatch')
        array_shape = json.loads(query("SELECT jsonb_build_object('cardinality',cardinality(statements),'lower',array_lower(statements,1),'upper',array_upper(statements,1),'dimensions',array_ndims(statements),'element_sha256',encode(sha256(convert_to(statements[1],'UTF8')),'hex'))::text FROM supabase_migrations.schema_migrations WHERE version='20261012160000';", 'ledger-array-shape'))
        require(array_shape == {'cardinality': 1, 'lower': 1, 'upper': 1, 'dimensions': 1, 'element_sha256': PAYLOAD_SHA}, 'Ledger array shape/element mismatch')
        record['ledgerArrayShape'] = array_shape
        case('exact_apply_after_lock_release')
        readback = (HERE / 'readback.sql').read_text()
        require(readback.count('p.oid = 100911') == 1, 'Readback OID guard shape')
        local_readback = readback.replace('p.oid = 100911', 'p.oid = ' + str(metadata['oid']))
        readback_json = 'SELECT row_to_json(r)::text FROM (' + local_readback[local_readback.index('SELECT '):].rstrip().rstrip(';') + ') r;'
        actual = json.loads(query(readback_json, 'separate-readback'))
        require(actual['expected_source'] is True and actual['expected_access'] is True and actual['ledger_rows'] == 1
                and actual['ledger_name'] == 'aceptacion_prospectos_crm' and actual['ledger_sql_sha256'] == PAYLOAD_SHA
                and actual['current_user'] == actual['session_user'] == 'postgres' and actual['server_version_num'] == '170006', 'Readback mismatch')
        record['separateReadback'] = actual
        case('separate_readback')
        rejected('retry_existing_ledger', error='Migration already recorded', before=installed)
        require(len(record['cases']) == len(CASES), 'Incomplete envelope test inventory')
        record.update(status='envelope_pg176_pass', exactPayloadExecuted=True, sourceOnlyCatalogDelta=True,
                      failureRollbackVerified=True, ledgerAtomicityVerified=True, businessRowsUnchanged=True)
    except BaseException as exc:
        record['status'] = 'fail'
        record['error'] = str(exc)
        (out / 'failure.log').write_text(traceback.format_exc())
    finally:
        if owned and re.fullmatch('[0-9a-f]{64}', owned):
            try:
                logs = docker(['exec', owned, 'cat', '/tmp/postgres.log'], text=True, capture_output=True, timeout=10)
                (out / 'postgres.log').write_text(logs.stdout + logs.stderr)
            except Exception as exc:
                record['logCopyError'] = str(exc)
            try:
                removed = docker(['rm', '--force', '--volumes', owned], text=True, capture_output=True, timeout=30)
                (out / 'container-removal.log').write_text(removed.stdout + removed.stderr)
                record['containerRemoved'] = removed.returncode == 0
                absent = docker(['inspect', owned], text=True, capture_output=True, timeout=20)
                (out / 'container-absence.log').write_text(absent.stdout + absent.stderr)
                record['containerAbsenceVerified'] = absent.returncode != 0 and ('No such object' in absent.stderr or 'No such container' in absent.stderr)
            except Exception as exc:
                record['cleanupError'] = str(exc)
        if not record['containerRemoved'] or not record['containerAbsenceVerified']:
            record['status'] = 'fail'
        save(); scratch.cleanup()
    print(json.dumps({k: record[k] for k in ('status','head','cases','containerRemoved','containerAbsenceVerified')}))
    return 0 if record['status'] == 'envelope_pg176_pass' else 1


if __name__ == '__main__':
    raise SystemExit(main())
