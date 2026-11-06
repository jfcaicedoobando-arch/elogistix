#!/usr/bin/env python3
"""Verify the final CRM catalog in owned clones; never replay older SQL over it."""
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
EXPECTED_BODY_MD5 = '3f909f4d6d3e426c1e962909b1e55bcf'
EVIDENCE_SUBDIR = 'reports/crm-cliente-final-concurrency'
spec = importlib.util.spec_from_file_location('crm_prospecto_kam_race', HERE.parent / 'crm-prospecto-kam/concurrency.py')
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


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value

catalog = load_module('crm_current_catalog', HERE / 'current-catalog.py')
cases = load_module('crm_current_cases', HERE / 'cases.py')

def verify_sources():
    return catalog.expected_catalog()


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
    expected = verify_sources()
    out = ROOT / EVIDENCE_SUBDIR
    require(not out.exists(), 'Fresh evidence directory required')
    out.mkdir(parents=True)
    record = {'status': 'running', 'container_id': container, 'service_image': PIN,
              'stage': 'final-0034-verify-only',
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
            identity = {}
            for signature, contract in expected.items():
                sql = "SELECT jsonb_build_object('body',prosrc,'owner',pg_get_userbyid(proowner)," \
                      "'definer',prosecdef,'config',proconfig,'acl',proacl,'returns',format_type(prorettype,NULL)," \
                      "'language',(SELECT lanname FROM pg_language WHERE oid=prolang)) FROM pg_proc WHERE oid=" \
                      + m.literal('public.' + signature) + "::regprocedure;"
                row = m.one_json(query(database, sql, label + '-' + signature.split('(')[0]), label)
                catalog.verify_row(signature, row, contract)
                identity[signature] = {**row, 'body': hashlib.sha256(row['body'].encode()).hexdigest()}
            return {'kam': route, 'identity': identity}

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
                    catalog_before = m.fingerprint(clone_context)
                    # Read-only verification of the current catalog. No historical
                    # migration or replacement definition is executed on this clone.
                    require(verify_database(name, f'clone-{iteration}-verified') == route
                            and m.fingerprint(clone_context) == catalog_before,
                            'Final catalog verification changed catalog, rows or security')
                    item['current_catalog_verification'] = 'pass'
                    record['runtime_tested'] = True
                    inspect()
                    result = cases.run(clone_context, m, quote_stage='Borrador')
                    require(result['status'] == 'pass' and result['both_committed'] is True, 'Complete committed race required')
                    require(verify_database(name, f'clone-{iteration}-after-cases') == route,
                            'Final identity security changed during cases')
                    after_cases = m.fingerprint(clone_context)
                    require([row for row in after_cases if 'catalog' in row]
                            == [row for row in catalog_before if 'catalog' in row],
                            'Final clone catalog/security changed during cases')
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

