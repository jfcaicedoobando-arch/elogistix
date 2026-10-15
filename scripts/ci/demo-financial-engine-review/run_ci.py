#!/usr/bin/env python3
"""Isolated financial-engine lab. Import and plan never launch subprocesses."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import uuid

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
SOURCE_COMMIT = '5d1f00d27628100a58ab166367a067ea90068b84'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
OWNER = 'demo_financial_fixture_owner'
LABEL = 'demo.financial.owner'
SUITES = ('happy', 'checkpoint', 'marker', 'execution_receipt', 'event', 'receipt')
PGDATA = '/var/lib/postgresql/data'
TMPFS_OPTIONS = 'rw,noexec,nosuid,nodev,size=536870912'
PG_COMMAND = ['-c', 'listen_addresses=', '-c', 'unix_socket_directories=/var/run/postgresql']
READY_COMMAND = ('i=0; until [ "$(cat /proc/1/comm)" = postgres ] && '
                 'pg_isready -h /var/run/postgresql -U supabase_admin; do '
                 'i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done')


def verify_inputs(root=None):
    """Freeze validated bytes, including the complete executable package inventory."""
    root = Path(root or ROOT).resolve()
    manifest_path = root / 'inputs.json'
    if manifest_path.is_symlink():
        raise ValueError('Symlink manifest rejected')
    manifest = manifest_path.read_bytes()
    rows = json.loads(manifest)
    if not isinstance(rows, list) or not rows:
        raise ValueError('Nonempty inputs.json list required')
    frozen = {}
    for row in rows:
        if not isinstance(row, dict) or set(row) != {'path', 'bytes', 'sha256'}:
            raise ValueError('Invalid input declaration')
        rel = row['path']
        if (not isinstance(rel, str) or not rel or '\\' in rel or ':' in rel
                or PurePosixPath(rel).is_absolute() or any(x in ('', '.', '..') for x in rel.split('/'))
                or rel == 'inputs.json' or rel in frozen):
            raise ValueError('Duplicate or escaping input path')
        if (type(row['bytes']) is not int or row['bytes'] < 0
                or not isinstance(row['sha256'], str)
                or not re.fullmatch('[0-9a-f]{64}', row['sha256'])):
            raise ValueError('Invalid input hash/size')
        path = root / rel
        if any(p.is_symlink() for p in (path, *path.parents) if p != root and root in p.parents):
            raise ValueError('Symlink input rejected')
        if root not in path.resolve().parents or not path.is_file():
            raise ValueError('Missing or escaping input: ' + rel)
        body = path.read_bytes()
        if len(body) != row['bytes'] or hashlib.sha256(body).hexdigest() != row['sha256']:
            raise ValueError('Input hash drift: ' + rel)
        frozen[rel] = body
    actual = set()
    for path in root.rglob('*'):
        if path.is_symlink():
            raise ValueError('Symlink package member rejected')
        if path.is_file():
            actual.add(path.relative_to(root).as_posix())
    if actual != set(frozen) | {'inputs.json'}:
        raise ValueError('Package file inventory differs from inputs.json')
    required = {'catalog-status.json', 'run_ci.py', 'sql/setup.sql'} | {'sql/' + key + '.sql' for key in SUITES}
    if not required <= frozen.keys():
        raise ValueError('Required runtime inputs missing')
    frozen['inputs.json'] = manifest
    return frozen


def verify_catalog(frozen):
    catalog = json.loads(frozen['catalog-status.json'])
    required = ('complete', 'canonical_closure_complete', 'fixtures_complete')
    if not isinstance(catalog, dict) or any(catalog.get(key) is not True for key in required):
        raise ValueError('Canonical catalog closure incomplete: engine NOT_RUN')
    return catalog


def guard_execution(env, optin):
    if not optin or env.get('GITHUB_ACTIONS') != 'true' or env.get('DEMO_ACCEPTANCE_ISOLATED') != '1':
        raise ValueError('Explicit isolated GitHub Actions opt-in required')


def command(args, stdin=None, timeout=90, check=True):
    # No shell, PG*, DSN, Docker remote/context/config, secrets or host credentials.
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C.UTF-8', 'HOME': '/tmp', 'DOCKER_CONFIG': '/tmp/demo-financial-no-config'}
    process_args = ['docker', '--host=unix:///var/run/docker.sock', *args[1:]] if args[0] == 'docker' else args
    return subprocess.run(process_args, input=stdin, text=True, stdout=subprocess.PIPE,
                          stderr=subprocess.STDOUT, timeout=timeout, check=check, env=env)


def environment(values):
    result = {}
    for row in values or []:
        key, sep, value = row.partition('=')
        if not sep or not key or key in result:
            raise RuntimeError('Invalid or duplicate container environment')
        result[key] = value
    return result


def inspect_image():
    obj = json.loads(command(['docker', 'image', 'inspect', IMAGE]).stdout)[0]
    digest = IMAGE.split('@', 1)[1]
    if (not re.fullmatch('sha256:[0-9a-f]{64}', obj.get('Id', ''))
            or not any(x.endswith('@' + digest) for x in obj.get('RepoDigests', []))
            or obj.get('Os') != 'linux' or obj.get('Architecture') != 'amd64'):
        raise RuntimeError('Pinned local linux/amd64 image required; no implicit image pull')
    base_env = environment(obj['Config'].get('Env'))
    if base_env.get('PGDATA') != PGDATA:
        raise RuntimeError('Unexpected pinned image PGDATA')
    return obj


def inspect_owned(identity, token, image):
    objects = json.loads(command(['docker', 'inspect', identity]).stdout)
    if len(objects) != 1:
        raise RuntimeError('Exactly one owned container required')
    obj = objects[0]
    config, host = obj['Config'], obj['HostConfig']
    expected_env = environment(image['Config'].get('Env'))
    expected_env.update(POSTGRES_USER='supabase_admin', POSTGRES_HOST_AUTH_METHOD='trust')
    invalid = (
        not re.fullmatch('[0-9a-f]{64}', obj.get('Id', ''))
        or obj.get('Name') != '/demo-financial-' + token
        or config.get('Image') != IMAGE or obj.get('Image') != image['Id']
        or config.get('Labels', {}).get(LABEL) != token
        or config.get('Entrypoint') != image['Config'].get('Entrypoint')
        or config.get('Cmd') != PG_COMMAND or environment(config.get('Env')) != expected_env
        or host.get('NetworkMode') != 'none' or host.get('PortBindings')
        or host.get('PublishAllPorts') or host.get('Privileged')
        or host.get('Binds') or host.get('Mounts') or host.get('VolumesFrom')
        or host.get('Links') or host.get('ExtraHosts') or host.get('CapAdd')
        or host.get('Devices') or host.get('DeviceRequests')
        or host.get('PidMode') not in ('', None) or host.get('UTSMode') not in ('', None)
        or host.get('IpcMode') not in ('private', '', None)
        or host.get('CgroupnsMode') not in ('private', '', None)
        or host.get('Tmpfs') != {PGDATA: TMPFS_OPTIONS}
        or host.get('SecurityOpt') != ['no-new-privileges']
        or host.get('Memory') != 1073741824 or host.get('NanoCpus') != 2000000000
        or host.get('PidsLimit') != 128
    )
    networks = obj.get('NetworkSettings', {})
    if set(networks.get('Networks', {})) != {'none'}:
        invalid = True
    if any(value for value in networks.get('Ports', {}).values()):
        invalid = True
    # PGDATA is a bounded container tmpfs. No persistent Docker or host volume exists.
    for mount in obj.get('Mounts', []):
        if mount.get('Type') != 'tmpfs' or mount.get('Destination') != PGDATA:
            invalid = True
    if invalid:
        raise RuntimeError('Container ownership/isolation mismatch')
    return obj


def owned_listing(name, token):
    """Both successful daemon queries are required; inspect failure is not absence."""
    by_name = command(['docker', 'ps', '-a', '--no-trunc', '--filter', 'name=^/' + name + '$', '--format', '{{.ID}}'])
    by_token = command(['docker', 'ps', '-a', '--no-trunc', '--filter', 'label=' + LABEL + '=' + token, '--format', '{{.ID}}'])
    ids = set(by_name.stdout.split()) | set(by_token.stdout.split())
    if any(not re.fullmatch('[0-9a-f]{64}', value) for value in ids):
        raise RuntimeError('Malformed cleanup container listing')
    return ids


def cleanup(name, token, image, created):
    ids = owned_listing(name, token)
    if not ids:
        if created:
            raise RuntimeError('Created container vanished before verified cleanup')
        return {'verified': True, 'removed_container': False, 'persistent_volumes': False}
    if len(ids) != 1 or image is None:
        raise RuntimeError('Ambiguous cleanup ownership; no deletion attempted')
    cid = next(iter(ids))
    obj = inspect_owned(cid, token, image)
    if obj['State']['Running']:
        command(['docker', 'stop', '--time', '10', cid], timeout=30)
    if inspect_owned(cid, token, image)['State']['Running']:
        raise RuntimeError('Owned container still running')
    command(['docker', 'rm', '-v', cid])
    if owned_listing(name, token):
        raise RuntimeError('Owned container remains after removal')
    return {'verified': True, 'removed_container': True, 'persistent_volumes': False}


def write_result(output, reports, cleanup_result, failure, catalog_complete):
    engine_pass = (catalog_complete and failure is None and tuple(x['suite'] for x in reports) == SUITES
                   and all(x['status'] == 'PASS' for x in reports) and cleanup_result.get('verified') is True)
    result = {
        'overall': 'PASS' if engine_pass else ('BLOCKED' if not catalog_complete else 'FAIL'),
        'financial_engine': 'PASS' if engine_pass else ('NOT_RUN' if not catalog_complete else 'FAIL'),
        'synthetic_auth': 'NOT_RUN', 'synthetic_auth_scope': 'SEPARATE_EXISTING_LANE',
        'real_transport': 'NOT_RUN', 'real_identity': 'NOT_RUN', 'rls': 'NOT_RUN',
        'owner_fixture': OWNER + ' NOSUPERUSER BYPASSRLS; SYNTHETIC LAB IDENTITY',
        'source_commit': SOURCE_COMMIT, 'image': IMAGE, 'expected_postgres_version_num': '170006',
        'demo': 'DISABLED', 'suites': reports, 'cleanup_verified': cleanup_result.get('verified') is True,
        'cleanup': cleanup_result, 'failure': failure,
    }
    (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    return result


def run(output):
    frozen = verify_inputs()  # Before any subprocess, including Docker inspection.
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    try:
        verify_catalog(frozen)
    except Exception as error:
        write_result(output, [], {'verified': False, 'status': 'NOT_RUN', 'container_not_created': True}, str(error), False)
        raise
    token = uuid.uuid4().hex
    name = 'demo-financial-' + token
    image, created, attempted = None, False, False
    reports, failure = [], None
    cleanup_result = {'verified': False, 'not_run': True}
    try:
        image = inspect_image()
        # Copy only frozen, hash-validated bytes, never a mutable source directory.
        with tempfile.TemporaryDirectory(prefix='financial-sealed-') as temp:
            sealed = Path(temp) / 'financial'
            for rel, body in frozen.items():
                target = sealed / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
            attempted = True
            r = command(['docker', 'create', '--pull=never', '--platform', 'linux/amd64', '--name', name,
                         '--label', LABEL + '=' + token, '--network', 'none', '--security-opt', 'no-new-privileges',
                         '--pids-limit', '128', '--memory', '1g', '--cpus', '2',
                         '--tmpfs', PGDATA + ':' + TMPFS_OPTIONS,
                         '-e', 'POSTGRES_USER=supabase_admin', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
                         IMAGE, *PG_COMMAND], timeout=180)
            created = True
            (output / 'docker-create.log').write_text(r.stdout, encoding='utf-8')
            cid = inspect_owned(name, token, image)['Id']
            command(['docker', 'start', cid])
            command(['docker', 'exec', cid, 'sh', '-c', READY_COMMAND], timeout=75)

            def sql(db, body, user=OWNER):
                inspect_owned(cid, token, image)
                response = command(['docker', 'exec', '-i', cid, 'psql', '-X', '-h', '/var/run/postgresql',
                                    '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-At'],
                                   body, timeout=180, check=False)
                with (output / 'psql.log').open('a', encoding='utf-8') as log:
                    log.write('\nDATABASE ' + db + '\n' + response.stdout)
                if response.returncode:
                    raise RuntimeError('SQL stage failed; see psql.log')
                return response.stdout

            version = sql('postgres', "SELECT current_setting('server_version_num')||':'||current_user||':'||rolsuper FROM pg_roles WHERE rolname=current_user;\n", 'supabase_admin')
            if version.strip() != '170006:supabase_admin:true':
                raise RuntimeError('Version/bootstrap fixture identity mismatch')
            sql('postgres', 'CREATE ROLE ' + OWNER + ' LOGIN NOSUPERUSER BYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;\n'
                + ''.join('CREATE ROLE ' + role + ' NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;\n'
                          for role in ('anon', 'authenticated', 'service_role')) + 'GRANT service_role TO ' + OWNER + ';\n', 'supabase_admin')
            inspect_owned(cid, token, image)
            command(['docker', 'cp', str(sealed), cid + ':/tmp/financial'])
            for key in SUITES:
                db = 'demo_flow_disposable_' + key + '_' + token[:12]
                sql('postgres', 'CREATE DATABASE ' + db + ' OWNER ' + OWNER + ' TEMPLATE template0;\n', 'supabase_admin')
                role = sql(db, "SELECT current_user||':'||rolsuper||':'||rolbypassrls||':'||rolcreaterole||':'||rolcreatedb||':'||rolreplication||':'||rolinherit FROM pg_roles WHERE rolname=current_user;\n")
                if role.strip() != OWNER + ':false:true:false:false:false:false':
                    raise RuntimeError('Synthetic owner privileges differ from lab contract')
                marker = 'FINANCIAL_SUITE_COMPLETE_' + key
                body = "SET demo_flow.test_disposable='true';\n" + (
                    "DO $$ BEGIN IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$' "
                    "OR current_setting('server_version_num')<>'170006' "
                    "OR current_user<>'" + OWNER + "' "
                    "OR current_setting('demo_flow.test_disposable',true) IS DISTINCT FROM 'true' "
                    "THEN RAISE EXCEPTION 'Disposable fixture session required'; END IF; END $$;\n")
                body += '\\i /tmp/financial/sql/setup.sql\n\\i /tmp/financial/sql/' + key + '.sql\n'
                body += "SELECT '" + marker + "';\n"
                log = sql(db, body)
                (output / (key + '.log')).write_text(log, encoding='utf-8')
                required = (marker, 'FINANCIAL_ASSERTIONS_COMPLETE_' + key, 'FINANCIAL_ROLLBACK_COMPLETE_' + key)
                if any(log.splitlines().count(m) != 1 for m in required) or 'PENDING:' in log or 'NOT_IMPLEMENTED' in log:
                    raise RuntimeError('Missing/duplicate assertion or rollback marker: ' + key)
                reports.append({'suite': key, 'status': 'PASS', 'synthetic_lab': True})
    except BaseException as error:
        failure = type(error).__name__ + ': ' + str(error)
        raise
    finally:
        try:
            if attempted:
                cleanup_result = cleanup(name, token, image, created)
            else:
                cleanup_result = {'verified': True, 'not_created': True, 'persistent_volumes': False}
        except BaseException as error:
            cleanup_result = {'verified': False, 'error': type(error).__name__ + ': ' + str(error)}
            if failure is None:
                failure = 'Cleanup verification failed'
            raise
        finally:
            result = write_result(output, reports, cleanup_result, failure, True)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--execute-disposable', action='store_true')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    frozen = verify_inputs()
    if not args.execute_disposable:
        catalog = json.loads(frozen['catalog-status.json'])
        print(json.dumps({'runtime': 'NOT_RUN', 'suites': SUITES,
                          'catalog_gate': {key: catalog.get(key) is True for key in
                                           ('complete', 'canonical_closure_complete', 'fixtures_complete')},
                          'image': IMAGE, 'demo': 'DISABLED'}))
        return
    guard_execution(os.environ, args.execute_disposable)
    if not args.output:
        parser.error('--output must be a new directory')
    print(json.dumps(run(args.output)))


if __name__ == '__main__':
    main()
