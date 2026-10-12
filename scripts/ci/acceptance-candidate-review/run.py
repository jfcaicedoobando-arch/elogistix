#!/usr/bin/env python3
"""Exact reviewed candidate in owned offline PostgreSQL; no remote connection route.

Strict behavior and compatibility baseline clones are deliberately separate.
A generated PG17.9 baseline is an artifact until its exact bytes are committed.
"""
import argparse
import difflib
import hashlib
import importlib.util
import io
import json
import os
import re
import signal
import stat
import sys
import subprocess
import tarfile
import tempfile
import time
import traceback
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PREFIX = 'scripts/ci/acceptance-candidate-review/'
REPO = 'jfcaicedoobando-arch/elogistix'
STRICT = 'acceptance_review'
OWNED_DATABASES = {STRICT, 'acceptance_baseline_base', 'acceptance_baseline_candidate', 'acceptance_concurrency'}


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


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


def logical_catalog(text):
    value = json.loads(text)
    for relation in value['relations'] or []:
        # Vacuum may advance physical transaction horizons after a rolled-back
        # fixture. These are storage bookkeeping, never an ACL/FK/RLS exception.
        for physical in ('relpages', 'reltuples', 'relallvisible', 'relallfrozen', 'relfrozenxid', 'relminmxid'):
            relation.pop(physical, None)
    return value


def assert_candidate_delta(before, after, contract):
    b, a = logical_catalog(before), logical_catalog(after)
    original = next(p for p in b['procs'] if p['proname'] == 'aceptar_cotizacion_version')
    changed = next(p for p in a['procs'] if p['oid'] == original['oid'])
    require(sha(original['prosrc'].encode()) == contract['original_acceptance_body_sha256'], 'Original acceptance body drift')
    require(sha(changed['prosrc'].encode()) == contract['candidate_acceptance_body_sha256'], 'Candidate body mismatch')
    changed['prosrc'] = original['prosrc']
    require(a == b, 'Candidate changed something besides the approved acceptance function body')
    conversion = next(p for p in a['procs'] if p['proname'] == 'convertir_prospecto_a_cliente_rpc')
    require(sha(conversion['prosrc'].encode()) == contract['original_conversion_body_sha256'], 'Original conversion changed')


def strip_acceptance_definition(text):
    # pg_dump 17.x emits exactly one complete CREATE FUNCTION block. The
    # accepted function has a $$ body and no other dollar terminator. Fail closed
    # if its dump representation differs; never use a broad regex replacement.
    prefix = 'CREATE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid) RETURNS jsonb\n'
    require(text.count(prefix) == 1, 'One dumped acceptance definition required')
    start = text.index(prefix)
    body_start = text.index('AS $$', start) + len('AS $$')
    end = text.index('$$;', body_start) + len('$$;')
    require(text.find('\nCREATE ', start + 1, body_start) < 0, 'Unexpected dump function shape')
    return text[:start] + '<REVIEWED_ACCEPTANCE_FUNCTION>' + text[end:]


def static_check():
    contract = json.loads((HERE / 'review-contract.json').read_text())
    require(contract['repository'] == REPO, 'Repository mismatch')
    require(contract['review_state'] == 'draft_ci_only_not_merge_approval', 'Explicit draft-only review state required')
    index = json.loads((HERE / 'replay-source-index.json').read_text())
    require(index['base'] == contract['backend_base_sha'], 'Backend index mismatch')
    paths = [f['path'] for f in index['files']]
    require(len(paths) == 1528 and len(paths) == len(set(paths)), 'Replay source inventory mismatch')
    require('supabase/tests/rls/_ci_post_migrate.sql' not in paths, 'Strict replay cannot include relaxed preparation')
    require(sha((HERE / 'candidate.sql').read_bytes()) == contract['reviewed_candidate_sha256'], 'Candidate exact bytes differ')
    neutral = re.findall(r"RAISE NOTICE 'ACCEPTANCE_CASE:([a-z_]+)'", (HERE / 'neutral-cases.sql').read_text())
    require(neutral == contract['baseline_neutral_cases'], 'Neutral inventory mismatch')
    semantic = contract['semantic_cases']
    concurrency = contract['concurrency_cases']
    require(isinstance(semantic, list) and len(semantic) > 10 and len(semantic) == len(set(semantic)), 'Semantic suite not prepared')
    require(isinstance(concurrency, list) and len(concurrency) > 3 and len(concurrency) == len(set(concurrency)), 'Concurrency suite not prepared')
    require(all(re.fullmatch('[a-z0-9_]+', case) for case in semantic + concurrency), 'Case inventory must contain bare marker IDs')
    require((HERE / 'semantic-cases.sql').is_file() and (HERE / 'concurrency.py').is_file(), 'Required suites absent')
    return contract, index


def require_candidate_ready(contract):
    require(contract.get('candidate_binding_ready') is True
            and contract.get('candidate_revision', 0) >= 3
            and contract.get('accessory_client_fix_reviewed') is True,
            'Blocked: exact independently reviewed candidate revision 3 with accessory-company fix is required; v2 is reference only')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--static-only', action='store_true')
    parser.add_argument('--postgres', choices=('17.9', '17.6'), default='17.9')
    args = parser.parse_args()
    contract, index = static_check()
    if args.static_only:
        print(json.dumps({'static': 'pass', 'candidate': contract['review_state'],
                          'candidateBindingReady': contract.get('candidate_binding_ready', False), 'sqlExecuted': False}))
        return 0
    require_candidate_ready(contract)
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Actions only; no local/hosted fallback')
    require(os.environ.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(os.environ.get('GITHUB_REPOSITORY') == REPO, 'Wrong repository')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unexpected event action')
    pr = event['pull_request']
    head = os.environ.get('REVIEW_COMMIT', '')
    require(re.fullmatch('[0-9a-f]{40}', head) is not None and pr['head']['sha'] == head, 'Exact PR head SHA required')
    require(pr['head']['repo']['full_name'] == REPO and pr['base']['repo']['full_name'] == REPO, 'No fork execution')
    require(pr['head']['ref'] == contract['review_branch'] and pr['base']['ref'] == 'main', 'Wrong review branch')
    require(pr['base']['sha'] == contract['base_sha'], 'PR base moved; re-review admission explicitly')
    clean = {'PATH': os.environ['PATH'], 'LANG': 'C', 'LC_ALL': 'C'}
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, env=clean, text=True).strip() == head, 'Checkout mismatch')
    runtime = contract['postgres'][args.postgres]
    inputs = {}
    source_classes = {}
    for inventory, kind in ((index, 'strict_replay'), (json.loads((HERE / 'compatibility-source-index.json').read_text()), 'compatibility_clone_only')):
        for f in inventory['files']:
            data = regular(ROOT, f['path']).read_bytes()
            require(len(data) == f['bytes'] and blob(data) == f['git_blob_sha'], 'Source drift: ' + f['path'])
            inputs[f['path']] = data
            source_classes[f['path']] = kind
    # Root integrates the independently reviewed product manifest separately.
    # Require every reviewed product file to match it; unrelated types.ts is
    # not listed or edited. Generated baseline is checked by runtime below.
    for f in json.loads((HERE / 'reviewed-product-inputs.json').read_text()):
        data = regular(ROOT, f['path']).read_bytes()
        require(len(data) == f['bytes'] and sha(data) == f['sha256'], 'Reviewed product input changed: ' + f['path'])
    guard_path = 'supabase/tests/cotizacion_aceptar_cliente_candado.sql'
    inputs[guard_path] = regular(ROOT, guard_path).read_bytes()
    source_classes[guard_path] = 'reviewed_candidate_catalog_guard'
    candidate = (HERE / 'candidate.sql').read_bytes()
    for path in ('supabase/migrations/20261012160000_aceptacion_prospectos_crm.sql', 'supabase/schema/cotizaciones/aceptar_cotizacion_version.sql'):
        require(regular(ROOT, path).read_bytes() == candidate, 'Candidate/migration/mirror bytes differ')
    helper = 'supabase/tests/rls/_helpers.sql'
    helper_bytes = regular(ROOT, helper).read_bytes()
    require(blob(helper_bytes) == 'c282e9f5d9edb2a05e9a3f8c2f88ee43af7bd4f8', 'Test helper drift')
    inputs[helper] = helper_bytes
    source_classes[helper] = 'strict_test_helper'
    for path in HERE.iterdir():
        if path.is_file() and path.suffix == '.sql':
            relative = PREFIX + path.name
            inputs[relative] = regular(ROOT, relative).read_bytes()
            source_classes[relative] = 'candidate_review_fixture_or_exact_source'
    expected_baseline = regular(ROOT, 'supabase/schema/baseline.sql').read_bytes()
    out = ROOT / ('reports/acceptance-candidate-review/pg' + args.postgres.replace('.', ''))
    require(not out.exists(), 'Evidence directory must be fresh')
    out.mkdir(parents=True)
    record = {'format': 2, 'repository': REPO, 'head': head, 'base': contract['base_sha'],
              'backendSourceBase': contract['backend_base_sha'], 'status': 'running',
              'postgresRequired': args.postgres, 'runtimeRole': runtime['role'], 'candidateExecuted': False,
              'candidateSha256': sha(candidate), 'remoteDatabaseAccess': False,
              'strictFkRelaxation': False, 'strictAclExpansion': False, 'cases': [],
              'databases': {STRICT: {'role': 'strict_original_acl_fk_behavior', 'source': 'hash_pinned_full_replay'}},
              'containerRemoved': False, 'containerAbsenceVerified': False,
              'sources': {p: {'sha256': sha(data), 'bytes': len(data), 'use': source_classes[p]} for p, data in inputs.items()},
              'baselineFileSha256': sha(expected_baseline)}
    (out / 'candidate.sql').write_bytes(candidate)

    def save():
        (out / 'run.json').write_text(json.dumps(record, indent=2) + '\n')

    save()
    scratch = tempfile.TemporaryDirectory(prefix='acceptance-candidate-docker-')
    docker_env = {**clean, 'DOCKER_HOST': 'unix:///var/run/docker.sock', 'DOCKER_CONFIG': scratch.name}
    owned = None
    counter = 0

    def interrupted(signum, frame):
        raise KeyboardInterrupt('Interrupted ' + str(signum))

    signal.signal(signal.SIGTERM, interrupted)

    def docker(arguments, **kwargs):
        return subprocess.run(['docker', *arguments], env=docker_env, **kwargs)

    def pg_env(database):
        require(database in OWNED_DATABASES, 'Unowned database refused')
        return ['/usr/bin/env', '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C',
                'PGHOST=127.0.0.1', 'PGPORT=5432', 'PGUSER=postgres', 'PGDATABASE=' + database,
                'PGCONNECT_TIMEOUT=5', 'PGSSLMODE=disable', 'PGPASSFILE=/tmp/nonexistent.pgpass']

    def psql_argv(database):
        return ['docker', 'exec', '-i', '-w', '/tmp/repo', owned, *pg_env(database),
                'psql', '-X', '-w', '-A', '-t', '-v', 'ON_ERROR_STOP=1']

    def query(sql, label, timeout=60, database=STRICT):
        nonlocal counter
        require(re.fullmatch(r'[A-Za-z0-9_.-]+', label) is not None, 'Unsafe evidence label')
        counter += 1
        result = subprocess.run(psql_argv(database), env=docker_env, input=sql, text=True, capture_output=True, timeout=timeout)
        (out / f'{counter:03}-{label}.stdout.log').write_text(result.stdout)
        (out / f'{counter:03}-{label}.stderr.log').write_text(result.stderr)
        require(result.returncode == 0, label + ' failed: ' + result.stderr[-1500:])
        require(not re.search(r'(^|\n)(?:ERROR|FATAL):', result.stderr), label + ' emitted an error')
        return result.stdout.strip(), result.stderr

    catalog = (HERE / 'catalog.sql').read_text()
    business_tables = ['organizations', 'organization_members', 'user_roles', 'clientes', 'cotizaciones', 'cotizacion_versiones',
                       'crm_oportunidades', 'crm_historial_etapas', 'crm_etapas_pipeline', 'crm_leads', 'crm_empresas',
                       'crm_oportunidad_empresa', 'bitacora_actividad', 'crm_notificaciones', 'embarques', 'facturas']
    row_sql = 'SELECT jsonb_build_object(' + ','.join(
        "'" + t + "',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM public." + t + ' t)'
        for t in business_tables) + ", 'auth.users',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY id),'[]'::jsonb) FROM auth.users u))::text;"

    def clone_database(name, label):
        require(name in OWNED_DATABASES and name != STRICT and name not in record['databases'], 'Unowned/reused clone target')
        query('CREATE DATABASE ' + name + ' TEMPLATE ' + STRICT + ';', label)
        record['databases'][name] = {'source': STRICT, 'role': 'compatibility_baseline_only' if 'baseline' in name else 'strict_concurrency', 'droppedWithOwnedContainer': False}
        save()

    def compatibility_dump(name, label):
        clone_database(name, label + '-clone')
        # Exact existing repository preparation is allowed ONLY in this clone.
        # This is not evidence that authenticated runtime preserved production ACL.
        query('\\i supabase/tests/rls/_ci_check_service_role_only.sql\n\\i supabase/tests/rls/_ci_post_migrate.sql\n\\i supabase/tests/rls/_ci_verify_rls.sql\n', label + '-repo-preparation', database=name)
        integrity, _ = query('\\i scripts/db/integrity-guard.sql\n', label + '-integrity', database=name)
        require(integrity == '', 'Compatibility clone integrity guard returned findings')
        dump = docker(['exec', '-w', '/tmp/repo', owned, *pg_env(name), 'bash', 'scripts/db/schema-snapshot.sh'], text=True, capture_output=True, timeout=120)
        (out / (label + '.stderr.log')).write_text(dump.stderr)
        require(dump.returncode == 0, 'PG17.9 repository baseline dump failed')
        data = dump.stdout.encode()
        (out / (label + '.sql')).write_bytes(data)
        record['databases'][name].update({'dumpSha256': sha(data), 'normalizer': 'scripts/db/schema-snapshot.sh', 'purpose': 'workflow compatibility only, never security evidence'})
        save()
        return data

    try:
        image = runtime['image']
        require(re.fullmatch(r'postgres@sha256:[0-9a-f]{64}', image), 'Pinned official digest required')
        pulled = docker(['pull', image], text=True, capture_output=True, timeout=180)
        (out / 'image-pull.log').write_text(pulled.stdout + pulled.stderr)
        require(pulled.returncode == 0, 'Pinned official PostgreSQL image unavailable')
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
                          '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,mode=1777,size=3g',
                          '--tmpfs', '/var/lib/postgresql/data:rw,mode=1777', '--shm-size=256m',
                          '--memory=4g', '--cpus=2', '--pids-limit=256', '--entrypoint=/usr/bin/env', image,
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
                     'readOnlyRoot': hc['ReadonlyRootfs'], 'user': ci['Config']['User'], 'privileged': hc['Privileged'],
                     'mounts': ci['Mounts'], 'capDrop': hc['CapDrop'], 'securityOpt': hc['SecurityOpt']}
        require(isolation['network'] == 'none' and not isolation['portBindings'] and not isolation['binds']
                and isolation['readOnlyRoot'] and isolation['user'] == 'postgres' and not isolation['privileged']
                and 'ALL' in isolation['capDrop'] and 'no-new-privileges:true' in isolation['securityOpt']
                and all(m['Type'] == 'tmpfs' and m['Destination'] in ('/tmp', '/var/lib/postgresql/data') for m in isolation['mounts']), 'Container isolation mismatch')
        record['isolation'] = isolation
        save()
        require(docker(['start', owned], capture_output=True, timeout=20).returncode == 0, 'Start failed')
        for _ in range(150):
            ready = docker(['exec', owned, *pg_env(STRICT), 'psql', '-X', '-w', '-Atc', 'SELECT 1'], capture_output=True, timeout=5)
            if ready.returncode == 0:
                break
            time.sleep(.2)
        else:
            raise RuntimeError('Owned PostgreSQL did not become ready')
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            for path, data in inputs.items():
                member = tarfile.TarInfo(path)
                member.size = len(data)
                member.mode = 0o600
                archive.addfile(member, io.BytesIO(data))
        source_archive = stream.getvalue()
        (out / 'verified-source-inputs.tar').write_bytes(source_archive)
        record['sourceArchiveSha256'] = sha(source_archive)
        record['sourceArchiveFileCount'] = len(inputs)
        save()
        copied = docker(['exec', '-i', owned, 'tar', '-xf', '-', '-C', '/tmp/repo'], input=source_archive, capture_output=True, timeout=60)
        require(copied.returncode == 0, 'Copying allowlisted sources failed')
        version, _ = query("SELECT current_database()||':'||current_setting('server_version_num')||':'||current_user;", 'version')
        require(version == STRICT + ':' + runtime['version_num'] + ':postgres', 'Server version mismatch')
        record['runtime'] = version
        replay = docker(['exec', '-w', '/tmp/repo', owned, *pg_env(STRICT), 'bash', 'scripts/ci/rls-prepare-db.sh'], text=True, capture_output=True, timeout=900)
        (out / 'replay.stdout.log').write_text(replay.stdout)
        (out / 'replay.stderr.log').write_text(replay.stderr)
        require(replay.returncode == 0, 'Full exact baseline replay failed; no mock fallback')
        before, _ = query(catalog, 'strict-catalog-before-candidate')
        if args.postgres == '17.9':
            base_dump = compatibility_dump('acceptance_baseline_base', 'baseline-base-pg179')
            require(blob(base_dump) == contract['base_baseline_git_blob'], 'Replayed PG17.9 base baseline differs from known repository baseline')
            after_clone, _ = query(catalog, 'strict-catalog-after-base-clone')
            require(logical_catalog(after_clone) == logical_catalog(before), 'Compatibility clone changed strict catalog')
        query(candidate.decode(), 'apply-exact-candidate')
        after, _ = query(catalog, 'strict-catalog-after-candidate')
        assert_candidate_delta(before, after, contract)
        record['candidateExecuted'] = True
        record['catalogPreservationVerified'] = True
        query('\\i supabase/tests/cotizacion_aceptar_cliente_candado.sql\n', 'reviewed-candidate-catalog-guard')
        if args.postgres == '17.9':
            candidate_dump = compatibility_dump('acceptance_baseline_candidate', 'baseline-candidate-pg179')
            require(strip_acceptance_definition(base_dump.decode()) == strip_acceptance_definition(candidate_dump.decode()), 'Generated baseline changes more than approved function definition')
            (out / 'baseline.diff').write_text(''.join(difflib.unified_diff(base_dump.decode().splitlines(True), candidate_dump.decode().splitlines(True), fromfile='baseline-base.sql', tofile='baseline-candidate.sql')))
            record['candidateBaselineSha256'] = sha(candidate_dump)
            record['baselineFileMatchesCandidate'] = expected_baseline == candidate_dump
            post_clones, _ = query(catalog, 'strict-catalog-after-candidate-clone')
            require(logical_catalog(post_clones) == logical_catalog(after), 'Candidate baseline clone changed strict catalog')
            record['strictCatalogUnaffectedByCompatibilityClones'] = True
        # Neither business test has run before both PG17.9 dumps above.
        query(inputs[PREFIX + 'platform-failclosed.sql'].decode(), 'platform-boundary')
        query(inputs[PREFIX + 'preconditions.sql'].decode(), 'strict-preconditions')
        start_catalog, _ = query(catalog, 'strict-catalog-before-tests')
        start_rows, _ = query(row_sql, 'strict-rows-before-tests')
        for suite, marker, expected in [('neutral-cases.sql', 'ACCEPTANCE_CASE', contract['baseline_neutral_cases']),
                                         ('semantic-cases.sql', 'ACCEPTANCE_V2_CASE', contract['semantic_cases'])]:
            _, stderr = query(inputs[PREFIX + suite].decode(), suite.replace('.sql', ''), timeout=240)
            actual = re.findall(marker + r':([a-z0-9_]+)', stderr)
            require(actual == expected, 'Missing/reordered/duplicate case markers: ' + suite)
            require(not re.search(r'(^|\n).*\bSKIP\b', stderr), 'Skipped assertion is not a pass')
            final_rows, _ = query(row_sql, suite.replace('.sql', '') + '-rows-after')
            require(final_rows == start_rows, suite + ' ROLLBACK leaked business rows')
            final_catalog, _ = query(catalog, suite.replace('.sql', '') + '-catalog-after')
            require(logical_catalog(final_catalog) == logical_catalog(start_catalog), suite + ' changed strict catalog')
            record['cases'].extend({'id': case, 'suite': suite, 'status': 'pass'} for case in actual)
            save()
        clone_database('acceptance_concurrency', 'strict-concurrency-clone')
        spec = importlib.util.spec_from_file_location('candidate_concurrency', HERE / 'concurrency.py')
        module = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)
        context = SimpleNamespace(query=lambda sql, label, timeout=60: query(sql, label, timeout, database='acceptance_concurrency'),
                                  psql_argv=psql_argv('acceptance_concurrency'), env=docker_env, evidence_dir=out)
        concurrency_results = module.run_concurrency(context)
        require([case['id'] for case in concurrency_results] == contract['concurrency_cases'], 'Concurrency inventory mismatch')
        require(all(case['status'] == 'pass' for case in concurrency_results), 'Concurrency case failed')
        record['cases'].extend(concurrency_results)
        final_catalog, _ = query(catalog, 'strict-catalog-final')
        final_rows, _ = query(row_sql, 'strict-rows-final')
        require(logical_catalog(final_catalog) == logical_catalog(start_catalog) and final_rows == start_rows, 'Concurrency clone affected strict source')
        record['strictRollbackVerified'] = True
        if args.postgres == '17.9' and not record['baselineFileMatchesCandidate']:
            record['status'] = 'behavior_pass_baseline_artifact_requires_commit'
        else:
            record['status'] = 'candidate_pg179_gate_pass' if args.postgres == '17.9' else 'candidate_pg176_diagnostic_pass'
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
                removed = docker(['rm', '--force', '--volumes', owned], text=True, capture_output=True, timeout=30)
                (out / 'container-removal.log').write_text(removed.stdout + removed.stderr)
                record['containerRemoved'] = removed.returncode == 0
                absence = docker(['inspect', owned], text=True, capture_output=True, timeout=20)
                (out / 'container-absence.log').write_text(absence.stdout + absence.stderr)
                record['containerAbsenceVerified'] = absence.returncode != 0 and ('No such object' in absence.stderr or 'No such container' in absence.stderr)
                for database in record['databases'].values():
                    database['droppedWithOwnedContainer'] = record['containerRemoved'] and record['containerAbsenceVerified']
            except Exception as exc:
                record['cleanupError'] = str(exc)
        if not record['containerRemoved'] or not record['containerAbsenceVerified']:
            record['status'] = 'fail'
        save()
        scratch.cleanup()
    print(json.dumps({key: record[key] for key in ('status', 'head', 'candidateExecuted', 'containerRemoved', 'containerAbsenceVerified')}))
    return 0 if record['status'] in ('candidate_pg179_gate_pass', 'candidate_pg176_diagnostic_pass') else 1


if __name__ == '__main__':
    raise SystemExit(main())
