#!/usr/bin/env python3
"""Actions-only canonical installation experiment. No business acceptance or live DB mode."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import subprocess
import sys
import uuid

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BASE = '025270cadcee0cedef64aab31be93eb0ff3f0288'
EVENT_BASE = 'd778b7f5a19ec61e6dccaeab32f06d990e880ef8'
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
BRANCH = 'codex/demo-financial-compile-recovery-20261015'
INFRA = ROOT / 'scripts/ci/crm-acl-review/run_ci.py'
INFRA_SHA256 = 'a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816'
DATABASE = 'demo_financial_compile_recovery_lab'
INSTALL_ORDER = (
    'upstream/authentic/core-owner-fixture.sql',
    'upstream/flow/sql/01-private.sql', 'upstream/flow/sql/02-manifest.sql',
    'upstream/flow/sql/04-engine.sql', 'upstream/authentic/identity.sql',
    *('upstream/flow/issuer/' + name for name in (
        '10-issuer.sql', '11-atomic-entry.sql', '12-approval-main.sql',
        '13-readonly-verifiers.sql', '14-reconcile.sql', '15-rpc-boundary.sql', '16-owner-registry.sql')),
    'upstream/authentic/bridge.sql', 'upstream/authentic/producer.sql',
    'upstream/flow/sql/06-simulation-guards.sql',
)
EXPECTED_STAGES = ['synthetic-infrastructure', 'candidate-context', 'synthetic-auth-bootstrap',
                   'canonical-catalog', 'canonical-function-revalidation',
                   *('installer-' + str(index + 1).zfill(2) for index in range(len(INSTALL_ORDER))), 'verify-install']


def require(value, message):
    if not value:
        raise RuntimeError(message)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def gate(event, env, head):
    require(env.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only; local SQL/Docker forbidden')
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY, 'Repository mismatch')
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unsupported event')
    require(event['repository']['full_name'] == REPOSITORY, 'Event repository mismatch')
    p = event['pull_request']
    for side in ('head', 'base'):
        require(p[side]['repo']['full_name'] == REPOSITORY
                and p[side]['repo']['owner']['login'] == 'jfcaicedoobando-arch', 'Foreign repository/owner')
    require(p['draft'] is True and p['head']['ref'] == BRANCH, 'Exact draft recovery branch required')
    require(p['base']['ref'] == 'main' and p['base']['sha'] == EVENT_BASE, 'Event base changed: explicit review required')
    require(re.fullmatch('[0-9a-f]{40}', head) and head == p['head']['sha'], 'Exact head checkout required')
    return head


def file_bytes(path):
    body = path.read_bytes()
    # Windows checkout expansion only; Actions uses the exact LF Git input.
    return body.replace(b'\r\n', b'\n') if os.name == 'nt' else body


def verify_inputs(directory=HERE):
    directory = Path(directory).resolve()
    manifest = directory / 'inputs.json'
    require(not manifest.is_symlink(), 'Symlink manifest rejected')
    rows = json.loads(manifest.read_text(encoding='utf-8'))
    require(isinstance(rows, list) and rows, 'Nonempty complete input manifest required')
    frozen = {}
    for row in rows:
        require(isinstance(row, dict) and set(row) == {'path', 'bytes', 'sha256'}, 'Malformed input record')
        rel = row['path']
        require(isinstance(rel, str) and rel and '\\' not in rel and ':' not in rel
                and not PurePosixPath(rel).is_absolute() and all(p not in ('', '.', '..') for p in rel.split('/'))
                and rel != 'inputs.json' and rel not in frozen, 'Escaping or duplicate input')
        path = directory / rel
        require(path.is_file() and directory in path.resolve().parents
                and not any(p.is_symlink() for p in [path, *path.parents] if p != directory and directory in p.parents), 'Missing or symlink input')
        body = file_bytes(path)
        require(type(row['bytes']) is int and len(body) == row['bytes'] and sha(body) == row['sha256'], 'Input hash drift: ' + rel)
        frozen[rel] = body
    actual = set()
    for path in directory.rglob('*'):
        require(not path.is_symlink(), 'Symlink package member rejected')
        if path.is_file():
            actual.add(path.relative_to(directory).as_posix())
    require(actual == set(frozen) | {'inputs.json'}, 'Complete package inventory differs')
    require(set(INSTALL_ORDER) | {'catalog.py', 'sql/bootstrap.sql', 'sql/verify-install.sql', 'run_ci.py'} <= frozen.keys(), 'Required source missing')
    upstream = json.loads(frozen['upstream-sources.json'])
    require(upstream['source_commit'] == 'e8d45165216403478f144f75437fa8c4c6116b5b'
            and upstream['recovery_base'] == BASE, 'Public source provenance differs')
    for row in upstream['files']:
        body = frozen[row['local_path']]
        require(len(body) == row['bytes'] and sha(body) == row['sha256'], 'Upstream public bytes drift')
    return frozen


def module_from_file(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def expected_sql(manifest):
    """Public canonical metadata only, in the verifier's same psql session."""
    def literal(value):
        return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"
    sql = 'CREATE TEMP TABLE financial_compile_expected_functions(schema_name text,name text,language text,body_sha256 text);\n'
    sql += 'CREATE TEMP TABLE financial_compile_expected_objects(kind text,schema_name text,name text,parent_name text);\n'
    require(manifest['functions'] and manifest['objects'], 'Nonempty canonical expectations required')
    for row in manifest['functions']:
        sql += 'INSERT INTO financial_compile_expected_functions VALUES(' + ','.join(literal(row[key]) for key in ('schema_name', 'name', 'language', 'body_sha256')) + ');\n'
    for row in manifest['objects']:
        sql += 'INSERT INTO financial_compile_expected_objects VALUES(' + ','.join(literal(row[key]) for key in ('kind', 'schema_name', 'name', 'parent_name')) + ');\n'
    return sql.encode('utf-8')


def final_result(result, successful):
    cleanup = (result.get('cleanup') == 'confirmed_stopped_and_removed' and result.get('shutdown_confirmed') is True
               and result.get('pg_status_3_and_no_pid') is True and result.get('owned_psql_clients_closed') is True)
    stages = result.get('stages', [])
    complete_stages = [row.get('stage') for row in stages] == EXPECTED_STAGES and all(row.get('status') == 'PASS' for row in stages)
    accepted = successful and cleanup and complete_stages and result.get('verification_marker') is True
    return {
        'scope': 'SYNTHETIC_BOOTSTRAP_CANONICAL_INSTALL_AND_COMPILE_ONLY',
        'status': 'PASS_COMPILE_ONLY' if accepted else 'FAIL',
        'catalog_compile': 'PASS' if accepted else 'FAIL',
        'complete': False, 'canonical_closure_complete': False, 'fixtures_complete': False,
        'financial_engine': 'NOT_RUN', 'financial_behavior': 'NOT_RUN', 'real_identity': 'NOT_RUN',
        'real_authentication': 'NOT_RUN', 'runtime_acl_rls': 'NOT_RUN', 'operational_wire': 'UNBOUND',
        'configuration': 'EMPTY', 'demo': 'DISABLED', 'live_database_actions': 0,
        'source_base': BASE, 'event_base': EVENT_BASE, 'workflow_commit': result.get('workflow_commit'),
        'stage': 'complete_owned_cleanup_confirmed' if accepted else result.get('stage'), 'stages': result.get('stages', []),
        'failure_type': result.get('error_type'),
        'diagnostic': result.get('diagnostic'), 'cleanup': result.get('cleanup'),
        'cleanup_verified': cleanup, 'catalog_sha256': result.get('catalog_sha256'),
        'candidate': result.get('candidate'), 'limits': [
            'No financial fixture or business operation executed; installation is not behavioral acceptance',
            'Auth helpers read empty synthetic tables; not external authentication or deployed ACL proof',
            'Owner is synthetic NOSUPERUSER BYPASSRLS; not application RLS acceptance',
            'Golden infrastructure uses fsync off/tmpfs; no crash/WAL/failover/restore durability proof',
        ],
    }


def run(output):
    # No subprocess, including Docker inspection, precedes the opt-in/provenance gates.
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'Actions-only compilation')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    gate(event, os.environ, head)
    frozen = verify_inputs()
    require(sha(file_bytes(INFRA)) == INFRA_SHA256, 'Golden CRM infrastructure bytes changed')
    infrastructure = module_from_file('financial_compile_golden_infrastructure', INFRA)
    catalog = module_from_file('financial_compile_catalog', HERE / 'catalog.py')
    # Read the immutable Git blob, never rewrite a working-tree SQL dump to fit.
    baseline = subprocess.check_output(['git', 'show', head + ':supabase/schema/baseline.sql'], cwd=ROOT)
    bundle = catalog.build_catalog(baseline)
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    (output / 'logs').mkdir()
    public = output / 'public'
    public.mkdir()
    generated = output / 'generated'
    generated.mkdir()
    (generated / 'catalog.sql').write_bytes(bundle.catalog_sql)
    (generated / 'validate-functions.sql').write_bytes(bundle.validation_sql)
    (public / 'catalog-manifest.json').write_text(json.dumps(bundle.manifest, indent=2) + '\n')
    (public / 'dependency-report.json').write_text(json.dumps(bundle.report, indent=2) + '\n')

    class CompileRunner(infrastructure.Runner):
        def install(self, body, label, db=DATABASE, user='postgres'):
            require(db in ('postgres', DATABASE) and user in ('postgres', 'supabase_admin'), 'Non-fixture target rejected')
            self.inspect_owned()
            self.result['stage'] = label
            self.save()
            self.counter += 1
            prefix = self.output / 'logs' / f'{self.counter:03d}-{label}'
            prefix.with_suffix('.sql').write_bytes(body)
            args = ['docker', 'exec', '-i', self.cid, 'psql', '-X', '-w', '-qAt',
                    '-h', '/tmp/crm/socket', '-p', '5432', '-U', user, '-d', db,
                    '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
            response = subprocess.run(args, input=body, capture_output=True, env=self.env, timeout=180)
            prefix.with_suffix('.stdout').write_bytes(response.stdout)
            prefix.with_suffix('.stderr').write_bytes(response.stderr)
            if response.returncode:
                error = (response.stdout + response.stderr).decode('utf-8', errors='replace')
                lines = [line[:500] for line in error.splitlines() if re.search(r'ERROR:|LINE [0-9]+:|CONTEXT:', line)]
                self.result['diagnostic'] = {'exit_code': response.returncode, 'sqlstate': next(iter(re.findall(r'ERROR:\s+([0-9A-Z]{5}):', error)), None), 'lines': lines[:8]}
                raise RuntimeError('Canonical compilation failed in stage ' + label)
            self.result['stages'].append({'stage': label, 'status': 'PASS', 'stdin_sha256': sha(body)})
            self.save()
            return response.stdout.decode('utf-8')

    r = CompileRunner(output, uuid.uuid4().hex)
    r.result.update(workflow_commit=head, stage='preflight', stages=[], catalog_sha256=sha(bundle.catalog_sql))
    successful = False
    def interrupted(number, frame):
        raise RuntimeError('Interrupted by signal ' + str(number))
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    r.save()
    try:
        r.start()
        r.install((
            'CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
            'CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
            'CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
            'CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
            'CREATE DATABASE ' + DATABASE + ' OWNER postgres TEMPLATE template0;').encode(), 'synthetic-infrastructure', db='postgres', user='supabase_admin')
        context = r.install(b"SELECT jsonb_build_object('user',current_user,'session',session_user,'version',current_setting('server_version_num'),'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),'address',inet_server_addr()) FROM pg_roles WHERE rolname=current_user;", 'candidate-context')
        candidate = json.loads(context)
        require(candidate == {'user': 'postgres', 'session': 'postgres', 'version': '170006', 'superuser': False, 'bypassrls': True, 'createdb': False, 'createrole': False, 'inherit': False, 'admin_member': False, 'listen': '', 'address': None}, 'Candidate context mismatch')
        r.result['candidate'] = candidate
        bootstrap_output = r.install(frozen['sql/bootstrap.sql'], 'synthetic-auth-bootstrap')
        require(bootstrap_output.splitlines().count('FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE') == 1, 'Bootstrap marker missing or duplicated')
        r.install(bundle.catalog_sql, 'canonical-catalog')
        r.install(bundle.validation_sql, 'canonical-function-revalidation')
        for index, path in enumerate(INSTALL_ORDER):
            r.install(frozen[path], 'installer-' + str(index + 1).zfill(2))
        verified = r.install(expected_sql(bundle.manifest) + frozen['sql/verify-install.sql'], 'verify-install')
        require(verified.splitlines().count('FINANCIAL_COMPILE_INSTALL_VERIFIED') == 1, 'Install verifier marker missing or duplicated')
        r.result['verification_marker'] = True
        successful = True
        r.result['stage'] = 'compile_checks_pass_cleanup_pending'
        r.save()
    except BaseException as error:
        r.result.update(status='failed', error_type=type(error).__name__, error=str(error))
        r.save()
        raise
    finally:
        try:
            r.cleanup()
        finally:
            r.save()
            summary = final_result(r.result, successful)
            (public / 'result.json').write_text(json.dumps(summary, indent=2) + '\n')
            print(json.dumps(summary))
    require(summary['status'] == 'PASS_COMPILE_ONLY', 'Compilation or owned cleanup incomplete')
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.output)


if __name__ == '__main__':
    main()
