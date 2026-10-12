#!/usr/bin/env python3
"""Read-only-source Actions diagnostic; owned offline PostgreSQL 17.6 only.

No remote connection options, host mounts, repository writes or SQL mutation of
business function definitions. The pending semantic candidate is NOT loaded.
"""
import argparse
import hashlib
import io
import json
import os
import re
import signal
import stat
import subprocess
import tarfile
import tempfile
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
REPO = 'jfcaicedoobando-arch/elogistix'
TAG = 'postgres:17.6-bookworm'
DB = 'acceptance_review'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def regular(root, relative):
    p = Path(relative)
    require(not p.is_absolute() and '..' not in p.parts, 'Unsafe relative input')
    current = root
    for part in p.parts:
        current = current / part
        require(not current.is_symlink(), 'Symlink input refused: ' + relative)
    require(current.is_file() and stat.S_ISREG(current.stat().st_mode), 'Missing regular file: ' + relative)
    return current


def static_check():
    contract = json.loads((HERE / 'review-contract.json').read_text())
    require(contract['repository'] == REPO, 'Repository mismatch')
    index = json.loads((HERE / 'replay-source-index.json').read_text())
    require(index['base'] == contract['backend_base_sha'], 'Baseline index mismatch')
    paths = [f['path'] for f in index['files']]
    require(len(paths) == len(set(paths)) and len(paths) > 100, 'Incomplete/duplicate replay index')
    require('supabase/tests/rls/_ci_post_migrate.sql' not in paths, 'Relaxed fixture must not be copied')
    cases = re.findall(r"RAISE NOTICE 'ACCEPTANCE_CASE:([a-z_]+)'", (HERE / 'neutral-cases.sql').read_text())
    require(cases == contract['baseline_neutral_cases'], 'Neutral case inventory differs')
    require(len(cases) == len(set(cases)), 'Duplicate case marker')
    # Absence of a reviewed candidate is an explicit blocked state, never an
    # empty array of cases that would be silently interpreted as success.
    require(contract['approved_candidate'] is None and contract['semantic_suite'] is None
            and contract['concurrency_suite'] is None, 'Candidate support needs separate implementation/review')
    return contract, index


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--static-only', action='store_true')
    parser.add_argument('--characterize-baseline', action='store_true')
    args = parser.parse_args()
    contract, index = static_check()
    if args.static_only:
        print(json.dumps({'static': 'pass', 'candidate': contract['state'], 'sqlExecuted': False}))
        return 0
    require(args.characterize_baseline, 'Candidate execution is blocked until v2 semantic/concurrency suites are reviewed')
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Actions only; no local/hosted fallback')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(os.environ.get('GITHUB_REPOSITORY') == REPO, 'Wrong repository')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unexpected action')
    pr = event['pull_request']
    head = os.environ.get('REVIEW_COMMIT', '')
    require(re.fullmatch('[0-9a-f]{40}', head) is not None and pr['head']['sha'] == head, 'Exact head SHA required')
    require(pr['head']['repo']['full_name'] == REPO and pr['base']['repo']['full_name'] == REPO, 'No fork execution')
    require(pr['head']['ref'] == contract['review_branch'] and pr['base']['ref'] == 'main', 'Wrong review branch')
    require(pr['base']['sha'] == contract['base_sha'], 'Base moved: re-review/re-pin source index explicitly')
    clean = {'PATH': os.environ['PATH'], 'LANG': 'C', 'LC_ALL': 'C'}
    actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, env=clean, text=True).strip()
    require(actual == head, 'Checkout differs from reviewed head')
    # Confirm exact baseline replay bytes independently of the checkout commit.
    inputs = {}
    for f in index['files']:
        data = regular(ROOT, f['path']).read_bytes()
        require(len(data) == f['bytes'] and blob(data) == f['git_blob_sha'], 'Replay drift: ' + f['path'])
        inputs[f['path']] = data
    helper = 'supabase/tests/rls/_helpers.sql'
    helper_bytes = regular(ROOT, helper).read_bytes()
    require(blob(helper_bytes) == 'c282e9f5d9edb2a05e9a3f8c2f88ee43af7bd4f8', 'Helper drift')
    inputs[helper] = helper_bytes
    for name in ('preconditions.sql', 'platform-failclosed.sql', 'neutral-cases.sql'):
        relative = 'scripts/ci/acceptance-review/' + name
        inputs[relative] = regular(ROOT, relative).read_bytes()
    out = ROOT / 'reports/acceptance-review'
    require(not out.exists(), 'Evidence directory must be fresh')
    out.mkdir(parents=True)
    record = {'format': 1, 'repository': REPO, 'head': head, 'base': contract['base_sha'], 'backendSourceBase': contract['backend_base_sha'],
              'status': 'running', 'scope': 'baseline neutral diagnostic only; not v2 acceptance approval',
              'postgresRequired': '17.6', 'baselineParityVersion': '17.9', 'candidateExecuted': False,
              'remoteDatabaseAccess': False, 'fkRelaxation': False, 'aclExpansion': False,
              'cases': [], 'containerRemoved': False, 'sources': {
                  p: hashlib.sha256(data).hexdigest() for p, data in inputs.items()}}

    def save():
        (out / 'run.json').write_text(json.dumps(record, indent=2) + '\n')

    save()
    scratch = tempfile.TemporaryDirectory(prefix='acceptance-review-docker-')
    docker_env = {**clean, 'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': scratch.name}
    owned = None
    counter = 0

    def interrupted(signum, frame):
        raise KeyboardInterrupt('Interrupted ' + str(signum))

    signal.signal(signal.SIGTERM, interrupted)

    def docker(arguments, **kwargs):
        return subprocess.run(['docker', *arguments], env=docker_env, **kwargs)

    pg_env = ['/usr/bin/env', '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
              'PGHOST=127.0.0.1', 'PGPORT=5432', 'PGUSER=postgres', 'PGDATABASE=' + DB,
              'PGCONNECT_TIMEOUT=5', 'PGSSLMODE=disable', 'PGPASSFILE=/tmp/nonexistent.pgpass']

    def query(sql, label, timeout=60):
        nonlocal counter
        counter += 1
        result = docker(['exec', '-i', '-w', '/tmp/repo', owned, *pg_env,
                         'psql', '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
                        input=sql, text=True, capture_output=True, timeout=timeout)
        (out / f'{counter:03}-{label}.stdout.log').write_text(result.stdout)
        (out / f'{counter:03}-{label}.stderr.log').write_text(result.stderr)
        require(result.returncode == 0 and not re.search(r'(^|\n)(?:ERROR|FATAL):', result.stderr), label + ' failed')
        return result.stdout.strip(), result.stderr

    catalog = """SELECT jsonb_build_object(
      'procs',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
      'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
      'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'),
      'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
    )::text;"""
    # Row contents, not sequences or pg_class physical counters: sequence values
    # are intentionally not transactional in PostgreSQL. Both snapshots use
    # identical stable relation lists and ID ordering where these tables have IDs.
    business_tables = ['organizations', 'organization_members', 'user_roles', 'clientes', 'cotizaciones',
                       'crm_oportunidades', 'crm_historial_etapas', 'crm_etapas_pipeline', 'crm_leads', 'crm_empresas', 'bitacora_actividad', 'crm_notificaciones',
                       'embarques', 'facturas']
    row_sql = 'SELECT jsonb_build_object(' + ','.join(
        "'" + t + "',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public." + t + ' t)'
        for t in business_tables) + ", 'auth.users',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY id),'[]'::jsonb) FROM auth.users u))::text;"
    try:
        pulled = docker(['pull', TAG], text=True, capture_output=True, timeout=180)
        (out / 'image-pull.log').write_text(pulled.stdout + pulled.stderr)
        require(pulled.returncode == 0, 'Official PostgreSQL image unavailable')
        inspected = docker(['image', 'inspect', TAG, '--format', '{{json .RepoDigests}}'], text=True, capture_output=True, timeout=20)
        require(inspected.returncode == 0, 'Cannot inspect image')
        image = next((d for d in json.loads(inspected.stdout) if re.fullmatch(r'postgres@sha256:[0-9a-f]{64}', d)), None)
        require(image is not None, 'Official digest required')
        record['imageDigest'] = image
        boot = """set -euo pipefail
export PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin
test "$(id -un)" = postgres
initdb -D /tmp/pgdata -U postgres --no-locale -E UTF8 --auth=trust
printf "\\nlisten_addresses='127.0.0.1'\\nunix_socket_directories='/tmp'\\n" >> /tmp/pgdata/postgresql.conf
pg_ctl -D /tmp/pgdata -l /tmp/postgres.log -w start
createdb -h 127.0.0.1 -U postgres acceptance_review
mkdir -p /tmp/repo
exec sleep infinity"""
        created = docker(['create', '--network=none', '--user=postgres', '--read-only', '--cap-drop=ALL',
                          '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,mode=1777,size=2g',
                          '--tmpfs', '/var/lib/postgresql/data:rw,mode=1777', '--shm-size=256m',
                          '--memory=3g', '--cpus=2', '--pids-limit=256', '--entrypoint=/usr/bin/env', image,
                          '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C', 'bash', '-c', boot],
                         text=True, capture_output=True, timeout=30)
        require(created.returncode == 0, 'Container creation failed')
        owned = created.stdout.strip()
        require(re.fullmatch('[0-9a-f]{64}', owned) is not None, 'Exact owned container ID required')
        record['containerId'] = owned
        info = docker(['inspect', owned], text=True, capture_output=True, timeout=20)
        require(info.returncode == 0, 'Container inspection failed')
        ci = json.loads(info.stdout)[0]
        hc = ci['HostConfig']
        isolation = {'network': hc['NetworkMode'], 'portBindings': hc['PortBindings'], 'binds': hc['Binds'],
                     'readOnlyRoot': hc['ReadonlyRootfs'], 'user': ci['Config']['User'],
                     'privileged': hc['Privileged'], 'mounts': ci['Mounts'], 'capDrop': hc['CapDrop'],
                     'securityOpt': hc['SecurityOpt']}
        require(isolation['network'] == 'none' and not isolation['portBindings'] and not isolation['binds']
                and isolation['readOnlyRoot'] and isolation['user'] == 'postgres' and not isolation['privileged']
                and 'ALL' in isolation['capDrop'] and 'no-new-privileges:true' in isolation['securityOpt']
                and all(m['Type'] == 'tmpfs' and m['Destination'] in ('/tmp', '/var/lib/postgresql/data') for m in isolation['mounts']),
                'Container isolation mismatch')
        record['isolation'] = isolation
        save()
        require(docker(['start', owned], capture_output=True, timeout=20).returncode == 0, 'Start failed')
        for _ in range(150):
            ready = docker(['exec', owned, *pg_env, 'psql', '-X', '-w', '-Atc', 'SELECT 1'], capture_output=True, timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Owned PostgreSQL did not become ready')
        # Only hash-verified SQL/replay sources are copied. No bind mount, .git,
        # entire checkout, socket, .env, auth token or production configuration.
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            for path, data in inputs.items():
                member = tarfile.TarInfo(path)
                member.size = len(data)
                member.mode = 0o600
                archive.addfile(member, io.BytesIO(data))
        copied = docker(['exec', '-i', owned, 'tar', '-xf', '-', '-C', '/tmp/repo'], input=stream.getvalue(), capture_output=True, timeout=60)
        require(copied.returncode == 0, 'Copying allowlisted sources failed')
        version, _ = query("SELECT current_database()||':'||current_setting('server_version_num')||':'||current_user;", 'version')
        require(version == DB + ':170006:postgres', 'Runtime differs from exact PostgreSQL 17.6')
        record['runtime'] = version
        replay = docker(['exec', '-w', '/tmp/repo', owned, *pg_env, 'bash', 'scripts/ci/rls-prepare-db.sh'],
                        text=True, capture_output=True, timeout=900)
        (out / 'replay.stdout.log').write_text(replay.stdout)
        (out / 'replay.stderr.log').write_text(replay.stderr)
        require(replay.returncode == 0, 'Full real-schema replay failed; no mock fallback')
        query(inputs['scripts/ci/acceptance-review/platform-failclosed.sql'].decode(), 'platform-boundary')
        query(inputs['scripts/ci/acceptance-review/preconditions.sql'].decode(), 'preconditions')
        before_catalog, _ = query(catalog, 'catalog-before')
        before_rows, _ = query(row_sql, 'rows-before')
        _, stderr = query(inputs['scripts/ci/acceptance-review/neutral-cases.sql'].decode(), 'neutral-cases', timeout=180)
        cases = re.findall(r'ACCEPTANCE_CASE:([a-z_]+)', stderr)
        require(cases == contract['baseline_neutral_cases'], 'Missing, reordered or duplicate neutral case evidence')
        require(not re.search(r'(^|\n).*\bSKIP\b', stderr), 'Skipped case is not a pass')
        after_rows, _ = query(row_sql, 'rows-after')
        after_catalog, _ = query(catalog, 'catalog-after')
        require(after_rows == before_rows, 'Neutral ROLLBACK leaked business rows')
        # pg_class may acquire physical tuple/statistics counters as a result of
        # ordinary inserts. Compare all logical ACL/RLS attributes; retain raw
        # snapshots in the evidence rather than suppressing catalog details.
        b = json.loads(before_catalog)
        a = json.loads(after_catalog)
        for catalog_rows in (b['relations'], a['relations']):
            for relation in catalog_rows or []:
                for physical in ('relpages', 'reltuples', 'relallvisible', 'relallfrozen'):
                    relation.pop(physical, None)
        require(a == b, 'Neutral suite changed functions, triggers, constraints, ACL/RLS or logical relations')
        record['cases'] = [{'id': case, 'status': 'pass'} for case in cases]
        record['rollbackVerified'] = True
        record['status'] = 'baseline_diagnostic_pass_candidate_blocked'
    except BaseException as exc:
        record['status'] = 'fail'
        record['error'] = str(exc)
        (out / 'failure.log').write_text(traceback.format_exc())
    finally:
        if owned and re.fullmatch('[0-9a-f]{64}', owned):
            try:
                logs = docker(['logs', owned], text=True, capture_output=True, timeout=10)
                (out / 'container.log').write_text(logs.stdout + logs.stderr)
                logs = docker(['exec', owned, 'cat', '/tmp/postgres.log'], text=True, capture_output=True, timeout=10)
                (out / 'postgres.log').write_text(logs.stdout + logs.stderr)
            except Exception as exc:
                record['logCopyError'] = str(exc)
            try:
                removed = docker(['rm', '--force', '--volumes', owned], capture_output=True, timeout=30)
                record['containerRemoved'] = removed.returncode == 0
            except Exception as exc:
                record['cleanupError'] = str(exc)
        if not record['containerRemoved']:
            record['status'] = 'fail'
        save()
        scratch.cleanup()
    print(json.dumps({key: record[key] for key in ('status', 'head', 'candidateExecuted', 'containerRemoved')}))
    return 0 if record['status'] == 'baseline_diagnostic_pass_candidate_blocked' else 1


if __name__ == '__main__':
    raise SystemExit(main())
