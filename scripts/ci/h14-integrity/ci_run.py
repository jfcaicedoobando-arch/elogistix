#!/usr/bin/env python3
"""H14 strict regression in the exact PostgreSQL service owned by this Actions job.

Replays pinned Git blobs in an owned empty database, installs the reviewed
candidate over fictional history, and runs the four suites in disposable clones.
No container creation, image pull, remote database, or service-postgres DML.
"""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = 'e302a5a8baee295a5de83adc91265c87cbf45988'
PIN = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
MIGRATION = 'supabase/migrations/20261103100000_h14_baja_embarque_integridad_financiera.sql'
ARCHIVE = 'scripts/ci/drizzle-history/archive/ec96cf2e4bbb4443be463f1496da0189df2d1bef'
SOURCE_FILES = frozenset((
    'scripts/ci/rls-prepare-db.sh', 'scripts/ci/selector148/profile-replay.sh',
    'supabase/tests/rls/_ci_bootstrap.sql', 'supabase/tests/rls/_ci_roles.sql',
    'supabase/schema/squash/cutoff.env', 'supabase/schema/squash/baseline_squash_v13_821_0.sql',
    'supabase/schema/squash/included.txt', 'supabase/schema/squash/data-only.txt',
    'scripts/ci/drizzle-history/control.mjs', 'drizzle/replay.json',
    *('scripts/ci/drizzle-history/' + x for x in (
        '0021_refacturar_proforma_rpc.sql', '0022_cotizacion_comercial.sql', '0023_margen_minimo_utilidad_rpc.sql')),
    *(ARCHIVE + '/' + x for x in ('0022_refacturar_proforma_abre_edicion.sql', 'meta/0022_snapshot.json', 'meta/_journal.json')),
    *('drizzle/migrations/' + x for x in (
        '0021_refacturar_proforma_rpc.sql', '0022_cotizacion_comercial.sql', '0023_margen_minimo_utilidad_rpc.sql')),
))
ACTIVE_EVIDENCE = None
ACTIVE_RECORD = None
RUNTIME_NAMES = frozenset(('serial.sql', 'fixture_helpers.sql', 'auth.sql', 'writers.sql',
                           'capture.sql', 'concurrency.py', 'driver_local.py', 'pre_migration_history.sql', 'scale-equivalence.sql'))


def require(condition, message):
    if condition is not True:
        raise RuntimeError(message)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def permitted_source(name):
    path = PurePosixPath(name)
    sensitive={'.env','.git','.aws','.ssh','.npmrc','.netrc','.pgpass','.pg_service.conf','credentials'}
    if any(part.lower() in sensitive or part.lower().startswith('.env.')
           or any(word in part.lower() for word in ('credential','password','secret')) for part in path.parts):
        return False
    return (not path.is_absolute() and '..' not in path.parts
            and (name in SOURCE_FILES or re.fullmatch(r'supabase/migrations/[A-Za-z0-9_-]+\.sql', name) is not None))


def validate_ci_environment(env):
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('ISOLATED_QA_DB') == '1'
            and env.get('H14_INTEGRITY_DISPOSABLE') == '1', 'Explicit isolated Actions lane required')
    require(env.get('GITHUB_REPOSITORY') == 'jfcaicedoobando-arch/elogistix'
            and env.get('GITHUB_JOB') == 'rls-tests-result'
            and re.fullmatch(r'[0-9]+', env.get('GITHUB_RUN_ID', '')) is not None, 'Unexpected Actions job')
    require(re.fullmatch(r'[a-f0-9]{64}', env.get('H14_POSTGRES_SERVICE_ID', '')) is not None,
            'Exact job.services.postgres.id required')
    require(env.get('POSTGRES_IMAGE') == PIN, 'Pinned Actions service image required')
    require(env.get('PGHOST','localhost') in ('localhost','127.0.0.1')
            and env.get('PGPORT','5432') == '5432' and env.get('PGUSER','postgres') == 'postgres'
            and env.get('PGDATABASE','postgres') == 'postgres', 'Unexpected declared Actions database endpoint')
    require(env.get('DOCKER_HOST', 'unix:///var/run/docker.sock') == 'unix:///var/run/docker.sock'
            and not env.get('DOCKER_CONTEXT'), 'Only the local Docker socket is allowed')
    require(not any(env.get(k) for k in ('DATABASE_URL', 'SUPABASE_DB_URL', 'PGHOSTADDR', 'PGSERVICE',
                                        'PGSERVICEFILE', 'PGOPTIONS', 'PGPASSFILE')),
            'Ambient database routing/options refused')


def process(argv, env, timeout=60, input_text=None, cwd=None):
    p = subprocess.Popen(argv, env=env, text=True, stdin=subprocess.PIPE if input_text is not None else subprocess.DEVNULL,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True, cwd=cwd)
    try:
        out, err = p.communicate(input=input_text, timeout=timeout)
    except BaseException as error:
        try:
            os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            out, err = p.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            out, err = p.communicate()
        error.h14_response = {'exit_code': p.returncode, 'stdout': out or '', 'stderr': err or ''}
        raise
    return {'exit_code': p.returncode, 'stdout': out, 'stderr': err}


def verify_service(c):
    result = process([c['docker'], 'container', 'inspect', c['container_id']], c['env'], timeout=15)
    require(result['exit_code'] == 0, 'Actions service inspection failed')
    rows = json.loads(result['stdout'])
    require(len(rows) == 1, 'Ambiguous Actions service')
    info = rows[0]
    require(info['Id'] == c['container_id'] and info['State']['Running'] is True
            and info['Config']['Image'] == PIN and info['Image'] == c['image_id'], 'Actions service identity changed')
    require(info['HostConfig']['NetworkMode'] not in ('host', 'none') and not info['HostConfig']['Privileged'],
            'Unexpected service network/privileges')
    ports = info['NetworkSettings']['Ports'].get('5432/tcp') or []
    require(ports and all(x['HostPort'] == '5432' for x in ports)
            and any(x['HostIp'] in ('0.0.0.0','127.0.0.1') for x in ports),
            'Actions PostgreSQL must own the loopback IPv4 port 5432')
    return info


def psql_argv(c, database):
    require(database in c['allowed_databases'], 'Unowned database refused')
    return [c['docker'], 'exec', '-i', '--user', 'postgres', c['container_id'], '/usr/bin/env', '-i',
            'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
            'PGHOST=/var/run/postgresql', 'PGPORT=5432', 'PGUSER=postgres', 'PGDATABASE=' + database,
            'PGCONNECT_TIMEOUT=5', 'PGOPTIONS=-c statement_timeout=60000 -c lock_timeout=20000 -c idle_in_transaction_session_timeout=60000 -c idle_session_timeout=120000',
            'PGPASSFILE=/tmp/h14-no-password-file', 'psql', '-X', '-w', '-q', '-A', '-t',
            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-P', 'pager=off']


def connection_prelude(c, database):
    require(database in c['allowed_databases'], 'Unowned connection prelude')
    return ("DO $h14$ BEGIN IF current_database() <> '" + database + "' OR current_user <> 'postgres' "
            "OR session_user <> 'postgres' OR inet_server_addr() IS NOT NULL "
            "OR (SELECT system_identifier::text FROM pg_control_system()) <> '" + c['system_id'] + "' "
            "THEN RAISE EXCEPTION 'H14_CI_CONNECTION_MISMATCH'; END IF; END $h14$;\n")


def expand_file(path, files, stack=()):
    path = Path(path).resolve(strict=True)
    require(str(path) in files and not path.is_symlink() and path not in stack, 'Unreviewed/cyclic SQL include')
    require(digest(path) == files[str(path)], 'Reviewed SQL changed')
    result = []
    for line in path.read_text().splitlines(keepends=True):
        match = re.fullmatch(r'\s*\\ir\s+([A-Za-z0-9_./-]+)\s*\n?', line)
        if match:
            result.append(expand_file(path.parent / match.group(1), files, stack + (path,)))
        else:
            require(not re.match(r'\s*\\(?:i\b|ir\b|!|o\b|copy\b|connect\b|c\b)', line), 'Unsafe SQL meta-command')
            result.append(line)
    return ''.join(result)


def replay_psql(control_path, arguments):
    """Narrow psql adapter for the immutable preparer; file mode never drains its loop stdin."""
    control = Path(control_path).resolve(strict=True)
    require(control.name == 'replay-transport.json' and re.fullmatch(r'[a-f0-9]{32}', control.parent.name) is not None
            and control.parent.parent == ROOT / 'reports/h14-integrity-ci', 'Private replay control required')
    c = json.loads(control.read_text())
    verify_service(c)
    database = c['base_database']
    require(database == 'h14_base_' + c['run_id'], 'Owned base identity required')
    sql = None
    flags = []
    index = 0
    while index < len(arguments):
        flag = arguments[index]
        if flag in ('-X', '-q', '-A', '-t', '--single-transaction'):
            flags.append(flag)
            index += 1
            continue
        require(flag in ('-v', '-f', '-c') and index + 1 < len(arguments), 'Unexpected replay psql argument')
        value = arguments[index + 1]
        if flag == '-v':
            require(value == 'ON_ERROR_STOP=1', 'Unexpected psql variable')
        else:
            require(sql is None, 'Only one replay input is allowed')
            if flag == '-f':
                require(value in c['source_paths'], 'Unreviewed replay SQL path')
                sql = expand_file(Path(c['source_bundle']) / value, c['source_files'])
            else:
                sql = value
        index += 2
    if sql is None:
        sql = sys.stdin.read()
    response = process(psql_argv(c, database) + flags + ['-f','-'], c['env'], timeout=150,
                       input_text=connection_prelude(c, database) + sql)
    sys.stdout.write(response['stdout'])
    sys.stderr.write(response['stderr'])
    return response['exit_code']


def load_contract():
    path = HERE / 'runtime-contract.json'
    require(path.is_file() and not path.is_symlink(), 'Reviewed runtime-contract.json required')
    content=path.read_bytes()
    c = json.loads(content)
    require(c['schema_version'] == 1 and c['base_commit'] == BASE, 'Unexpected H14 baseline contract')
    require(c['candidate_migration']['path'] == MIGRATION
            and re.fullmatch(r'[a-f0-9]{32}', c['candidate_rpc_md5']) is not None, 'Reviewed candidate identity required')
    require(c['candidate_post_migrate']['path'] == 'supabase/tests/rls/_ci_post_migrate.sql', 'Unexpected post-migrate companion')
    require(set(c['expected_case_ids']) == {'finance', 'auth', 'writers', 'races'}, 'Exactly four suites required')
    for ids in c['expected_case_ids'].values():
        require(ids and len(ids) == len(set(ids)) and all(isinstance(x, str) and x for x in ids), 'Explicit unique IDs required')
    required = {'scripts/ci/h14-integrity/' + x for x in RUNTIME_NAMES}
    require(required <= set(c['files']) and set(c['bundle_paths']) == required, 'Exact H14 runtime bindings required')
    companions={MIGRATION,c['candidate_post_migrate']['path'],
                'scripts/ci/h14-integrity/ci_run.py','scripts/ci/h14-integrity/test_static.py'}
    require(set(c['files']) <= required | companions, 'Unknown runtime companion')
    for relative, expected in c['files'].items():
        p = PurePosixPath(relative)
        require(not p.is_absolute() and '..' not in p.parts
                and (relative in required or relative in companions), 'Unreviewed runtime file path')
        actual = ROOT / relative
        require(actual.resolve(strict=True) == actual and actual.is_file() and not actual.is_symlink()
                and re.fullmatch(r'[a-f0-9]{64}', expected) is not None and digest(actual) == expected,
                'Runtime file changed: ' + relative)
    for item in (c['candidate_migration'], c['candidate_post_migrate']):
        require(digest(ROOT / item['path']) == item['sha256'], 'Candidate companion hash changed')
    return c, hashlib.sha256(content).hexdigest()


def parse_rows(stdout, expected, evidence=None):
    rows, malformed = [], []
    for line in stdout.splitlines():
        if not line.startswith('H14_RESULT '):
            continue
        try:
            rows.append(json.loads(line[len('H14_RESULT '):]))
        except ValueError:
            malformed.append(line)
    if evidence is not None:
        Path(evidence).write_text(json.dumps(rows,indent=2)+'\n')
        if malformed:
            Path(str(evidence)+'.malformed.json').write_text(json.dumps(malformed,indent=2)+'\n')
    require(not malformed, 'Malformed partial H14_RESULT JSON')
    require(all(isinstance(row, dict) and isinstance(row.get('case_id'), str)
                and 'expected_by_code' in row and 'observed' in row for row in rows), 'Malformed case evidence')
    ids = [row['case_id'] for row in rows]
    require(len(ids) == len(set(ids)) and set(ids) == set(expected), 'Missing, duplicate or unexpected cases')
    require(all(row['reproduction_complete'] is True if 'reproduction_complete' in row
                else row.get('execution_status') == 'OBSERVED' for row in rows), 'Unmatched H14 case')
    return rows


def main():
    global ACTIVE_EVIDENCE, ACTIVE_RECORD
    require(sys.flags.isolated == 1, 'Invoke this entrypoint with python3 -I')
    validate_ci_environment(os.environ)
    contract, contract_sha = load_contract()
    tools = {name: shutil.which(name) for name in ('docker', 'git', 'bash', 'node', 'psql')}
    require(all(tools.values()), 'Actions tools missing')
    run_id = uuid.uuid4().hex
    out = ROOT / 'reports/h14-integrity-ci' / run_id
    out.mkdir(parents=True, exist_ok=False)
    require(out.resolve(strict=True) == out, 'Symlinked evidence directory refused')
    record = {'run_id': run_id, 'status': 'running', 'contract_sha256': contract_sha, 'base_commit': BASE,
              'candidate_migration':contract['candidate_migration'], 'candidate_rpc_md5':contract['candidate_rpc_md5'],
              'candidate_post_migrate':contract['candidate_post_migrate'],
              'post_migrate_executed': False, 'databases': [], 'suites': [], 'errors': [], 'cleanup_errors': []}
    ACTIVE_EVIDENCE, ACTIVE_RECORD = out / 'result.json', record
    def save():
        (out / 'result.json').write_text(json.dumps(record, indent=2) + '\n')
    save()
    def interrupt(signum, frame):
        raise KeyboardInterrupt('Actions lab interrupted: ' + str(signum))
    signal.signal(signal.SIGTERM, interrupt)
    with tempfile.TemporaryDirectory(prefix='h14-ci-docker-') as config:
        env = {'PATH': os.pathsep.join(dict.fromkeys(str(Path(x).parent) for x in tools.values())) + ':/usr/bin:/bin',
               'LANG': 'C', 'LC_ALL': 'C', 'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': config}
        def checked(argv, timeout=60, input_text=None):
            result = process(argv, env, timeout, input_text)
            require(result['exit_code'] == 0, 'Command failed: ' + result['stderr'][-3000:])
            return result['stdout']
        head = checked([tools['git'], '-C', str(ROOT), 'rev-parse', 'HEAD']).strip()
        require(head == os.environ.get('GITHUB_SHA') and re.fullmatch(r'[a-f0-9]{40}', head) is not None, 'Checkout/event mismatch')
        record['checkout_commit'] = head
        raw = json.loads(checked([tools['docker'], 'container', 'inspect', os.environ['H14_POSTGRES_SERVICE_ID']]))
        require(len(raw) == 1, 'Ambiguous Actions service')
        c = {'docker': tools['docker'], 'container_id': os.environ['H14_POSTGRES_SERVICE_ID'], 'image_id': raw[0]['Image'],
             'env': env, 'allowed_databases': ['postgres', 'template1'], 'run_id': run_id}
        verify_service(c)
        image = json.loads(checked([tools['docker'], 'image', 'inspect', c['image_id']]))[0]
        require(PIN in image.get('RepoDigests', []), 'Service image digest mismatch')
        require(checked([tools['psql'], '--version']).startswith('psql (PostgreSQL) 17.'), 'Host PostgreSQL17 client required')
        local_env = {**env, 'PGHOST': '127.0.0.1', 'PGPORT': '5432', 'PGUSER': 'postgres', 'PGDATABASE': 'postgres',
                     'PGPASSWORD': 'postgres', 'PGCONNECT_TIMEOUT': '5', 'PGSSLMODE': 'disable'}
        identity_sql = 'SELECT system_identifier::text FROM pg_control_system();'
        host = process([tools['psql'], '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', identity_sql], local_env, timeout=15)
        require(host['exit_code'] == 0 and re.fullmatch(r'[0-9]+', host['stdout'].strip()) is not None, 'Loopback identity check failed')
        inside = checked(psql_argv(c, 'postgres'), input_text=identity_sql).strip()
        require(host['stdout'].strip() == inside, 'Loopback endpoint is not the exact Actions service')
        c['system_id'] = inside
        record.update(container_id=c['container_id'], system_identifier=inside, loopback_identity_verified=True)

        def query(database, sql, label, timeout=90):
            verify_service(c)
            require(not re.search(r'(?m)^\s*\\',sql), 'Unreviewed psql meta-command in SQL observation/install')
            if database == 'postgres':
                require(sql.lstrip().upper().startswith('SELECT'), 'Service postgres accepts read-only observations only')
            response = process(psql_argv(c, database), env, timeout, connection_prelude(c, database) + sql)
            (out / (label + '.stdout.log')).write_text(response['stdout'])
            (out / (label + '.stderr.log')).write_text(response['stderr'])
            require(response['exit_code'] == 0, label + ': ' + response['stderr'][-3000:])
            return response['stdout'].strip()

        def schema(database, label):
            verify_service(c)
            require(database in c['allowed_databases'], 'Unowned schema snapshot')
            text = checked([tools['docker'], 'exec', '--user', 'postgres', c['container_id'], '/usr/bin/env', '-i',
                'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'PGHOST=/var/run/postgresql', 'PGUSER=postgres',
                'PGDATABASE=' + database, 'pg_dump', '--schema-only', '--no-comments'])
            normalized = '\n'.join(line for line in text.splitlines() if not re.match(r'^\\(?:un)?restrict(?:\s|$)', line)) + '\n'
            (out / (label + '.sql')).write_text(normalized)
            return hashlib.sha256(normalized.encode()).hexdigest()

        def data(database, label):
            tables = json.loads(query(database, "SELECT coalesce(jsonb_agg(jsonb_build_array(schemaname,tablename) ORDER BY schemaname,tablename),'[]'::jsonb) FROM pg_tables WHERE schemaname IN ('public','auth');", label + '-tables'))
            parts = []
            for namespace, table in tables:
                q = lambda value: '"' + value.replace('"', '""') + '"'
                name = (namespace + '.' + table).replace("'", "''")
                parts.append("SELECT '" + name + "'::text AS name,count(*) AS rows,md5(coalesce(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),'')) AS digest FROM " + q(namespace) + '.' + q(table) + ' t')
            rows = json.loads(query(database, "SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY name),'[]'::jsonb) FROM (" + ' UNION ALL '.join(parts) + ') x;', label))
            (out / (label + '.json')).write_text(json.dumps({'tables': rows, 'sequences_covered': False}, indent=2) + '\n')
            return hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()

        roles_sql = "SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY rolname) FROM pg_roles r),'memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor),'[]'::jsonb) FROM pg_auth_members m));"
        source_before = None
        roles_before = None
        try:
            require(query('postgres', "SELECT count(*) FROM pg_constraint WHERE confrelid='auth.users'::regclass;", 'strict-source-fks') != '0', 'Actions source is already relaxed by post-migrate')
            source_before = (schema('postgres', 'service-schema-before'), data('postgres', 'service-data-before'))
            roles_before = query('postgres', roles_sql, 'roles-before')
            source_bundle = out / 'source-bundle'
            source_bundle.mkdir()
            tree = checked([tools['git'], '-C', str(ROOT), 'ls-tree', '-r', '-z', BASE])
            files = {}
            source_paths = []
            for entry in tree.split('\0'):
                if not entry:
                    continue
                meta, relative = entry.split('\t', 1)
                if not permitted_source(relative):
                    continue
                mode, kind, oid = meta.split()
                require(kind == 'blob' and mode in ('100644', '100755'), 'Nonregular pinned source')
                content = subprocess.check_output([tools['git'], '-C', str(ROOT), 'cat-file', 'blob', oid], env=env, timeout=15)
                target = source_bundle / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(content)
                target.chmod(0o444)
                files[str(target)] = digest(target)
                source_paths.append(relative)
            require(SOURCE_FILES <= set(source_paths) and len(source_paths) == 1559, 'Incomplete pinned source bundle')
            record['source_file_count']=len(source_paths)
            (out / 'source-manifest.json').write_text(json.dumps(files, indent=2) + '\n')
            runtime_files = {}
            for relative, binding in contract['bundle_paths'].items():
                b = PurePosixPath(binding)
                require(not b.is_absolute() and '..' not in b.parts and len(b.parts) == 2
                        and b.parts[0] in ('finance', 'auth', 'writers', 'races', 'prep'), 'Unexpected fixture binding')
                target = out / 'test-bundle' / binding
                require(str(target) not in runtime_files, 'Duplicate runtime binding')
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes((ROOT / relative).read_bytes())
                target.chmod(0o444)
                require(digest(target) == contract['files'][relative], 'Runtime snapshot changed')
                runtime_files[str(target)] = digest(target)

            def create(database, template):
                require(re.fullmatch(r'h14_(?:base|finance|auth|writers|races)_[a-f0-9]{32}', database) is not None, 'Unowned generated name')
                item = {'database': database, 'create_attempted': False, 'oid': None, 'removed': False}
                record['databases'].append(item)
                c['allowed_databases'].append(database)
                require(query('template1', "SELECT count(*) FROM pg_database WHERE datname='" + database + "';", database + '-absent') == '0', 'Generated database already exists')
                item['create_attempted'] = True
                save()
                query('template1', 'CREATE DATABASE "' + database + '" TEMPLATE "' + template + '";', database + '-create')
                identity = json.loads(query('template1', "SELECT jsonb_build_object('oid',oid::bigint,'owner',pg_get_userbyid(datdba)) FROM pg_database WHERE datname='" + database + "';", database + '-owner'))
                require(identity['owner'] == 'postgres', 'Owned clone owner mismatch')
                item['oid'] = identity['oid']
                save()

            base = 'h14_base_' + run_id
            create(base, 'template0')
            c.update(base_database=base, source_bundle=str(source_bundle), source_paths=source_paths, source_files=files)
            control = out / 'replay-transport.json'
            control.write_text(json.dumps(c, indent=2) + '\n')
            control.chmod(0o400)
            bin_dir = out / 'bin'
            bin_dir.mkdir()
            wrapper = bin_dir / 'psql'
            wrapper.write_text('#!' + sys.executable + ' -I\nimport importlib.util,sys\nspec=importlib.util.spec_from_file_location("h14_ci_adapter",' + repr(str(Path(__file__).resolve())) + ')\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nraise SystemExit(m.replay_psql(' + repr(str(control)) + ',sys.argv[1:]))\n')
            wrapper.chmod(0o700)
            replay_env = {**env, 'PATH': str(bin_dir) + os.pathsep + env['PATH'], 'PGHOST': '127.0.0.1',
                          'PGPORT': '5432', 'PGUSER': 'postgres', 'PGDATABASE': base, 'PGCONNECT_TIMEOUT': '5'}
            try:
                replay = process([tools['bash'], 'scripts/ci/rls-prepare-db.sh'], replay_env,
                                 timeout=1800, cwd=source_bundle)
            except BaseException as error:
                partial=getattr(error,'h14_response',{'stdout':'','stderr':''})
                (out / 'replay.stdout.log').write_text(partial['stdout'])
                (out / 'replay.stderr.log').write_text(partial['stderr'])
                raise
            (out / 'replay.stdout.log').write_text(replay['stdout'])
            (out / 'replay.stderr.log').write_text(replay['stderr'])
            require(replay['exit_code'] == 0, 'Pinned strict replay failed')
            included = set((source_bundle / 'supabase/schema/squash/included.txt').read_text().splitlines())
            omitted = set((source_bundle / 'supabase/schema/squash/data-only.txt').read_text().splitlines())
            expected = sorted(Path(p).name for p in source_paths if p.startswith('supabase/migrations/') and Path(p).name not in included | omitted)
            # control.mjs uses cwd for its exact immutable inputs.
            history = subprocess.check_output([tools['node'], 'scripts/ci/drizzle-history/control.mjs', 'list'], cwd=source_bundle, env=env, text=True, timeout=30).splitlines()
            actual = re.findall(r'^▶ ([0-9][^\s]*\.sql)$', replay['stdout'], re.M)
            actual_history = re.findall(r'^▶ Isolated Drizzle history: (.+)$', replay['stdout'], re.M)
            require(expected == actual and len(actual) == 346 and history == actual_history and len(history) == 4, 'Replay incomplete/duplicated/out of order')
            record['replay'] = {'migrations': len(actual), 'drizzle': len(history), 'complete': True}
            fixtures = out / 'test-bundle/finance/fixture_helpers.sql'
            prehistory = out / 'test-bundle/prep/pre_migration_history.sql'
            query(base, expand_file(fixtures, runtime_files) + '\n' + expand_file(prehistory, runtime_files), 'fictional-history')
            history_before = data(base, 'history-before-candidate')
            require(digest(ROOT / MIGRATION) == contract['candidate_migration']['sha256'], 'Candidate changed during replay')
            query(base, (ROOT / MIGRATION).read_text(), 'candidate-install', timeout=180)
            history_after = data(base, 'history-after-candidate')
            require(history_before == history_after, 'Candidate changed existing fictional history')
            record['history_unchanged'] = True
            rpc = query(base, "SELECT md5(prosrc) FROM pg_proc WHERE oid='public.eliminar_embarque_completo(uuid)'::regprocedure;", 'candidate-rpc')
            require(rpc == contract['candidate_rpc_md5'], 'Candidate RPC postimage mismatch')
            base_before = (schema(base, 'owned-base-schema-before'), data(base, 'owned-base-data-before'))
            for slot in ('finance', 'auth', 'writers', 'races'):
                database = 'h14_' + slot + '_' + run_id
                create(database, base)
                item = {'slot': slot, 'database': database, 'status': 'running'}
                record['suites'].append(item)
                save()
                before = schema(database, slot + '-schema-before')
                serial_before = data(database, slot + '-data-before') if slot in ('finance', 'auth') else None
                response = None
                try:
                    if slot == 'races':
                        spec = importlib.util.spec_from_file_location('h14_ci_concurrency', out / 'test-bundle/races/concurrency.py')
                        module = importlib.util.module_from_spec(spec)
                        sys.modules[spec.name] = module
                        spec.loader.exec_module(module)
                        stream = io.StringIO()
                        try:
                            with contextlib.redirect_stdout(stream):
                                result = module.run_concurrency(module.Context(
                                    psql_argv(c, database) + ['-c', connection_prelude(c,database), '-f', '-'],
                                    env, out / 'races-driver', database, run_id, BASE, rpc, fixtures.read_text(),
                                    (out / 'test-bundle/races/capture.sql').read_text()))
                        finally:
                            response = {'exit_code': 1, 'stdout': stream.getvalue(), 'stderr': ''}
                        response['exit_code'] = 0 if result['status'] == 'pass' else 1
                    else:
                        entry = out / 'test-bundle' / slot / ('serial.sql' if slot == 'finance' else slot + '.sql')
                        response = process(psql_argv(c, database), env, timeout=300,
                                           input_text=connection_prelude(c, database) + expand_file(entry, runtime_files))
                    (out / (slot + '.stdout.log')).write_text(response['stdout'])
                    (out / (slot + '.stderr.log')).write_text(response['stderr'])
                    rows = parse_rows(response['stdout'], contract['expected_case_ids'][slot], out / (slot + '-cases.json'))
                    require(response['exit_code'] == 0, 'Suite exited nonzero')
                    item.update(status='pass', cases=len(rows), exit_code=response['exit_code'])
                except BaseException as error:
                    partial = getattr(error, 'h14_response', response)
                    if partial:
                        (out / (slot + '.stdout.log')).write_text(partial['stdout'])
                        (out / (slot + '.stderr.log')).write_text(partial['stderr'])
                        try:
                            parse_rows(partial['stdout'],contract['expected_case_ids'][slot],out / (slot+'-cases.json'))
                        except Exception as parse_error:
                            item['case_parse_error']=str(parse_error)
                    item.update(status='fail', error_type=type(error).__name__, error=str(error))
                    record['errors'].append({'slot': slot, 'error': str(error)})
                    if isinstance(error, KeyboardInterrupt):
                        raise
                finally:
                    item['schema_unchanged'] = before == schema(database, slot + '-schema-after')
                    require(item['schema_unchanged'], 'Suite modified persistent schema/ACL/RLS')
                    if serial_before is not None:
                        item['logical_rollback'] = serial_before == data(database, slot + '-data-after')
                        require(item['logical_rollback'], 'Serial suite left logical data changes')
                    save()
            require(base_before == (schema(base, 'owned-base-schema-after'), data(base, 'owned-base-data-after')), 'Test suites modified the owned template')
            record['owned_base_unchanged'] = True
            require(not record['errors'] and len(record['suites']) == 4, 'H14 suites failed; inspect evidence')
            record['status'] = 'pass_cleanup_pending'
        except BaseException as error:
            record.update(status='fail', error_type=type(error).__name__, error=str(error))
            record['errors'].append({'phase': 'lab', 'error': str(error)})
        finally:
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
            for item in reversed(record['databases']):
                if not item['create_attempted']:
                    continue
                name = item['database']
                try:
                    rows = json.loads(query('template1', "SELECT coalesce(jsonb_agg(jsonb_build_object('oid',oid::bigint,'owner',pg_get_userbyid(datdba))),'[]'::jsonb) FROM pg_database WHERE datname='" + name + "';", name + '-cleanup-identity'))
                    require(len(rows) <= 1 and (not rows or (rows[0]['owner'] == 'postgres' and (item['oid'] is None or rows[0]['oid'] == item['oid']))), 'Uncertain database ownership; no DROP')
                    if rows:
                        query('template1', 'DROP DATABASE "' + name + '" WITH (FORCE);', name + '-drop')
                    require(query('template1', "SELECT count(*) FROM pg_database WHERE datname='" + name + "';", name + '-removed') == '0', 'Owned database still present')
                    item['removed'] = True
                except BaseException as error:
                    record['cleanup_errors'].append({'database': name, 'error': str(error)})
                save()
            try:
                require(source_before is not None and roles_before is not None, 'Source invariants were not captured')
                record['service_unchanged'] = source_before == (schema('postgres', 'service-schema-after'), data('postgres', 'service-data-after'))
                record['cluster_roles_unchanged'] = roles_before == query('postgres', roles_sql, 'roles-after')
                require(record['service_unchanged'] and record['cluster_roles_unchanged'], 'Actions source/global roles changed')
            except BaseException as error:
                record['cleanup_errors'].append({'phase': 'invariants', 'error': str(error)})
            if record['cleanup_errors']:
                record['status'] = 'fail_cleanup_or_invariants'
            elif record['status'] == 'pass_cleanup_pending':
                record['status'] = 'pass'
            save()
    print(json.dumps({'status': record['status'], 'evidence': str(out), 'suites': record['suites']}))
    return 0 if record['status'] == 'pass' else 1


if __name__ == '__main__':
    try:
        status=main()
    except BaseException as error:
        if ACTIVE_EVIDENCE is not None and ACTIVE_RECORD.get('status') == 'running':
            ACTIVE_RECORD.update(status='fail_before_lab',error_type=type(error).__name__,error=str(error))
            ACTIVE_EVIDENCE.write_text(json.dumps(ACTIVE_RECORD,indent=2)+'\n')
        raise
    raise SystemExit(status)
