#!/usr/bin/env python3
"""Clone only the exact pinned Actions PostgreSQL service; never seed its source."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PIN = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
MIGRATION = 'supabase/migrations/20261016060000_crm_empresa_prospecto_kam_propio.sql'
MIRROR = 'supabase/schema/crm/crm_empresa_pasar_a_prospecto.sql'
EXPECTED_BODY_MD5 = '3f909f4d6d3e426c1e962909b1e55bcf'
EVIDENCE_SUBDIR = 'reports/crm-prospecto-kam-concurrency'
spec = importlib.util.spec_from_file_location('crm_prospecto_kam_race', HERE / 'concurrency.py')
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
require = m.require
CONTEXT_SQL = """SELECT jsonb_build_object('database',current_database(),'current_user',current_user,
 'session_user',session_user,'server_addr',inet_server_addr(),
 'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()));"""
ROUTE_SQL = """SELECT jsonb_build_object('body',md5(prosrc),'owner',pg_get_userbyid(proowner),
 'definer',prosecdef,'language',(SELECT lanname FROM pg_language WHERE oid=prolang),
 'config',proconfig,'acl',proacl,'metadata',md5(to_jsonb(p)::text))
 FROM pg_proc p WHERE oid='public.crm_empresa_pasar_a_prospecto(uuid)'::regprocedure;"""


def verify_sources():
    migration = (ROOT / MIGRATION).read_text(encoding='utf-8')
    mirror = (ROOT / MIRROR).read_text(encoding='utf-8')
    bodies = []
    for text in (migration, mirror):
        match = re.search(r'CREATE OR REPLACE FUNCTION public\.crm_empresa_pasar_a_prospecto\(p_empresa_id uuid\).*?AS \$\$(.*?)\$\$;', text, re.S)
        require(match is not None, 'Complete reviewed RPC definition required')
        bodies.append(match.group(1))
    require(bodies[0] == bodies[1] and hashlib.md5(bodies[0].encode()).hexdigest() == EXPECTED_BODY_MD5,
            'Checked-out migration/mirror differ from reviewed function postimage')
    require('BEGIN;' in migration and migration.rstrip().endswith('COMMIT;'), 'Whole migration transaction required')
    return migration


def clone_identity_sql(name):
    return ("SELECT jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object("
            "'oid',oid::bigint,'owner',pg_get_userbyid(datdba))),'[]'::jsonb)) "
            'FROM pg_database WHERE datname=' + m.literal(name) + ';')


def main():
    require(len(sys.argv) == 1, 'No alternate connection, database or suite arguments accepted')
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('ISOLATED_QA_DB') == '1'
            and os.environ.get('CRM_PROSPECTO_KAM_DISPOSABLE') == '1', 'Explicit isolated GitHub Actions service required')
    container = os.environ.get('CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID', '')
    require(re.fullmatch(r'[a-f0-9]{64}', container) is not None, 'Exact Actions service container ID required')
    require(os.environ.get('POSTGRES_IMAGE') == PIN, 'Unexpected service image pin')
    require(os.environ.get('PGHOST', '') in ('', 'localhost', '127.0.0.1', '::1'), 'Ambient non-loopback host refused')
    require(not any(os.environ.get(key) for key in ('DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR')),
            'Ambient remote/database routing refused')
    migration = verify_sources()
    out = ROOT / EVIDENCE_SUBDIR
    require(not out.exists(), 'Fresh evidence directory required')
    out.mkdir(parents=True)
    record = {'status': 'running', 'container_id': container, 'service_image': PIN,
              'source_preserved': False, 'runtime_tested': False, 'clone_runs': []}

    def save():
        (out / 'actions-result.json').write_text(json.dumps(record, indent=2) + '\n')

    save()
    signal.signal(signal.SIGTERM, lambda signum, frame: (_ for _ in ()).throw(KeyboardInterrupt('Interrupted ' + str(signum))))
    with tempfile.TemporaryDirectory(prefix='crm-kam-docker-') as config:
        # Ignore user Docker contexts, connection strings, passwords and psqlrc.
        env = {'PATH': os.environ.get('PATH', '/usr/bin:/bin'), 'LANG': 'C', 'LC_ALL': 'C',
               'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': config}

        def inspect():
            process = subprocess.run(['docker', 'inspect', container], env=env, text=True,
                                     capture_output=True, timeout=15, check=True)
            items = json.loads(process.stdout)
            require(len(items) == 1 and items[0]['Id'] == container and items[0]['State']['Running'] is True
                    and items[0]['Config']['Image'] == PIN, 'Service identity/state/image changed')

        inspect()
        commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, env=env, text=True,
                                capture_output=True, timeout=10, check=True).stdout.strip()
        require(re.fullmatch(r'[a-f0-9]{40}', commit) is not None, 'Invalid checked-out source commit')
        record['source_commit'] = commit
        allowed = {'template1', 'postgres'}

        def argv(database):
            require(database in allowed, 'Unowned database command refused')
            # A private socket inside the verified service is stricter than
            # loopback TCP and requires no credentials, even synthetic ones.
            return ['docker', 'exec', '-i', container, '/usr/bin/env', '-i',
                    'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
                    'PGHOST=/var/run/postgresql', 'PGUSER=postgres', 'PGPORT=5432', 'PGDATABASE=' + database,
                    'PGCONNECT_TIMEOUT=5', 'PGPASSFILE=/tmp/crm-kam-nonexistent.pgpass',
                    'psql', '-X', '-w', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1']

        def query(database, sql, label, timeout=30):
            inspect()
            process = subprocess.run(argv(database), env=env, input=sql, text=True,
                                     capture_output=True, timeout=timeout)
            (out / (label + '.stdout.log')).write_text(process.stdout)
            (out / (label + '.stderr.log')).write_text(process.stderr)
            require(process.returncode == 0 and not re.search(r'(^|\n)(WARNING|ERROR|FATAL):', process.stderr),
                    label + ': ' + process.stderr)
            return process.stdout

        def context(database, evidence):
            require(database in allowed, 'Unowned context refused')
            return m.Context(argv(database), env, evidence, database, commit, EXPECTED_BODY_MD5)

        def verify_database(database, label):
            identity = m.one_json(query(database, CONTEXT_SQL, label + '-context'), label + '-context')
            require(identity == {'database': database, 'current_user': 'postgres', 'session_user': 'postgres',
                                 'server_addr': None, 'owner': 'postgres'}, 'Private local-socket database context required')
            route = m.one_json(query(database, ROUTE_SQL, label + '-route'), label + '-route')
            require(route['body'] == EXPECTED_BODY_MD5 and route['owner'] == 'postgres' and route['definer'] is True
                    and route['language'] == 'plpgsql' and route['config'] == ['search_path=public']
                    and sorted(route['acl']) == ['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres'],
                    'Exact production function body/security/ACL required before CI grants')
            return route

        source_context = context('postgres', out)
        record['source_function'] = verify_database('postgres', 'source-before')
        before = m.fingerprint(source_context)
        (out / 'source-fingerprint-before.json').write_text(json.dumps(before, indent=2) + '\n')
        try:
            for iteration in (1, 2):
                name = 'crm_prospecto_kam_' + uuid.uuid4().hex
                require(re.fullmatch(m.CLONE_PATTERN, name) is not None, 'Invalid generated clone name')
                allowed.add(name)
                item = {'iteration': iteration, 'database': name, 'status': 'running',
                        'creation_attempted': False, 'created': False, 'dropped': False}
                record['clone_runs'].append(item)
                save()
                try:
                    require(query('template1', 'SELECT count(*) FROM pg_database WHERE datname=' + m.literal(name) + ';',
                                  f'clone-{iteration}-absent').strip() == '0', 'Generated clone already exists; refusing ownership')
                    item['creation_attempted'] = True
                    query('template1', 'CREATE DATABASE ' + name + ' TEMPLATE postgres;', f'clone-{iteration}-create')
                    item['created'] = True
                    item['oid'] = int(query('template1', 'SELECT oid FROM pg_database WHERE datname=' + m.literal(name) + ';',
                                            f'clone-{iteration}-oid').strip())
                    route = verify_database(name, f'clone-{iteration}-before')
                    clone_context = context(name, out / f'run-{iteration}')
                    replay_before = m.fingerprint(clone_context)
                    # Execute the entire reviewed forward, including preflight,
                    # DDL, postcheck and COMMIT, only inside this owned clone.
                    query(name, migration, f'clone-{iteration}-whole-migration-replay')
                    require(verify_database(name, f'clone-{iteration}-replayed') == route
                            and m.fingerprint(clone_context) == replay_before,
                            'Postimage replay changed catalog, rows or security')
                    item['whole_migration_replay'] = 'pass'
                    record['runtime_tested'] = True
                    inspect()
                    result = m.run_concurrency(clone_context)
                    require(result['status'] == 'pass' and result['both_committed'] is True, 'Complete committed race required')
                    item['status'] = 'pass'
                finally:
                    # Only the generated, prechecked name is eligible. Reconcile
                    # uncertain CREATE by its owner/OID; no blind retry or FORCE.
                    if item['creation_attempted']:
                        require(name in allowed and re.fullmatch(m.CLONE_PATTERN, name) is not None, 'Unowned teardown refused')
                        rows = m.one_json(query('template1', clone_identity_sql(name), f'clone-{iteration}-cleanup-owner'), 'cleanup-owner')['rows']
                        if m.owned_clone_present(rows, item.get('oid')):
                            query('template1', 'DROP DATABASE ' + name + ';', f'clone-{iteration}-drop')
                            require(query('template1', 'SELECT count(*) FROM pg_database WHERE datname=' + m.literal(name) + ';',
                                          f'clone-{iteration}-absence').strip() == '0', 'Clone remains after DROP')
                        item['dropped'] = True
                        save()
            require(len(record['clone_runs']) == 2 and all(item['status'] == 'pass' and item['dropped']
                                                         for item in record['clone_runs']), 'Both fresh-clone runs and removals required')
            record['status'] = 'pass'
        except BaseException as error:
            record.update(status='fail', error_type=type(error).__name__, error=str(error))
            raise
        finally:
            try:
                after = m.fingerprint(source_context)
                (out / 'source-fingerprint-after.json').write_text(json.dumps(after, indent=2) + '\n')
                require(after == before and verify_database('postgres', 'source-after') == record['source_function'],
                        'Source app rows, sequence values, schema or security changed')
                record['source_preserved'] = True
            except BaseException as error:
                record.update(status='fail', source_preserved=False, source_verification_error=str(error))
                raise
            finally:
                save()
    print(json.dumps({'status': record['status'], 'fresh_clone_runs': 2, 'committed_races': 2,
                      'source_preserved': record['source_preserved']}))


if __name__ == '__main__':
    main()

