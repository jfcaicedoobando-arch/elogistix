#!/usr/bin/env python3
"""Exact draft-only authority entry integration in the owned PG17.6 golden fixture."""
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
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
BRANCH = 'review/authority-entry-postgres-20261016'
BASE = '6674a1b9b80982ba7bc9f566ab5f7473bfe7d0a3'
DATABASE = 'crm_acl_fixture_persistence'
GOLDEN = 'scripts/ci/demo-wire-lab/'
OWNER = 'docs/review/demo-durable-owner-adapter-20261015/'
SQL_ROOT = 'scripts/ci/demo-authentic-review/sql/'
INSTALL = [SQL_ROOT + name + '.sql' for name in ('synthetic-schema', 'core-owner-fixture',
    'writer-dependencies', 'manifest', 'identity', 'registry', 'bridge', 'producer')]
INSTALL += ['docs/review/demo-authority-provider-20261016/issuer/17-protected-occurrence.sql',
            'docs/review/demo-authority-provider-20261016/issuer/18-authority-reader.sql', OWNER + 'store.sql']
CASES = ('empty_configuration_zero_transport', 'authentic_issuance_commit_same_socket_transaction',
    'identical_committed_record_only_no_execution', 'conflict_binding_mismatch_no_commit',
    'conflict_obligation_id_mismatch_no_commit', 'revoked_authority_terminal_quarantine',
    'expired_authority_terminal_quarantine', 'insert_rollback_after_transport_close',
    'uncertain_commit_ack_terminal_no_second_wire', 'cancelled_native_read_terminal_no_second_wire',
    'revocation_serializes_until_entry_commit')


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def gate(event, env, head=None):
    # This gate must run before ALL subprocesses, even git/docker inspection.
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('AUTHORITY_ENTRY_ISOLATED') == '1', 'Explicit Actions opt-in required')
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request' and env.get('GITHUB_REPOSITORY') == REPOSITORY, 'PR repository required')
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unsupported PR action')
    require(event['repository']['full_name'] == REPOSITORY, 'Event repository mismatch')
    pr = event['pull_request']
    for side in ('head', 'base'):
        require(pr[side]['repo']['full_name'] == REPOSITORY
                and pr[side]['repo']['owner']['login'] == 'jfcaicedoobando-arch', 'Foreign repository or owner')
    require(pr['draft'] is True and pr['head']['ref'] == BRANCH, 'Exact draft branch required')
    require(pr['base']['ref'] == 'main' and pr['base']['sha'] == BASE, 'Reviewed base changed')
    require(re.fullmatch('[0-9a-f]{40}', pr['head']['sha']), 'Invalid head')
    if head is not None:
        require(head == pr['head']['sha'], 'Checkout differs from exact PR head')
    return pr['head']['sha']


def verify_sources(root=ROOT):
    root = Path(root).resolve()
    manifest_path = root / 'scripts/ci/demo-authority-entry-postgres-review/source-pins.json'
    require(not manifest_path.is_symlink(), 'Symlink manifest')
    manifest = json.loads(manifest_path.read_text())
    require(manifest['base'] == BASE and manifest['admission'] == 'NOT_ADMITTED', 'Source provenance mismatch')
    frozen = {}
    for row in manifest['sources']:
        relative = row['path']; parts = PurePosixPath(relative).parts
        require(relative and not relative.startswith('/') and '\\' not in relative and ':' not in relative
                and all(p not in ('', '.', '..') for p in relative.split('/')) and relative not in frozen, 'Unsafe source path')
        path = root / relative
        require(path.is_file() and root in path.resolve().parents
                and not any((root.joinpath(*parts[:n])).is_symlink() for n in range(1, len(parts) + 1)), 'Missing or symlink source')
        data = path.read_bytes()
        require(len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256']
            and hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == row['gitBlobSha1'], 'Source drift: ' + relative)
        frozen[relative] = data
    required = {*INSTALL, *(OWNER + n for n in ('driver.mjs', 'issuer.mjs', 'owner.mjs', 'store.mjs',
                'authority-provider.mjs', 'issuer-entry.mjs')), 'scripts/ci/demo-authority-bridge-review/contract.mjs',
                *(GOLDEN + n for n in ('lab_wire.mjs', 'runtime.mjs', 'run_ci.py', 'stage.py', 'deps/package.json', 'deps/package-lock.json')),
                'scripts/ci/demo-persistence-review/run_ci.py', 'scripts/ci/demo-persistence-review/sources.py',
                'scripts/ci/crm-acl-review/run_ci.py'}
    require(set(frozen) == required, 'Exact source inventory required')
    return frozen


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def parse_report(stdout, golden, token=None):
    value = json.loads(stdout); golden.public_payload(value, token)
    require(value.get('admission') == 'NOT_ADMITTED' and value.get('endpoint') == 'DISABLED', 'Unsafe runtime admission')
    require(value.get('status') in ('PASS_ISOLATED_INTEGRATION_ONLY', 'FAIL'), 'Unknown runtime status')
    names = [case.get('case') for case in value['cases']]
    require(names == list(CASES[:len(names)]) and all(case.get('status') == 'PASS' for case in value['cases']), 'Invalid case prefix')
    require(isinstance(value.get('timeline'), list) and isinstance(value.get('physicalWire'), dict), 'Runtime evidence missing')
    if value['status'] == 'FAIL':
        failure = value['failure']
        require(set(failure) == {'case', 'code', 'sourceLine'} and re.fullmatch('[a-z0-9_]{1,96}', failure['case'])
                and re.fullmatch('[A-Z0-9_]{1,80}', failure['code'])
                and type(failure['sourceLine']) is int and 0 <= failure['sourceLine'] <= 1000, 'Unsafe failure detail')
    else:
        require(names == list(CASES) and value['physicalWire']['allOwnedTransportsCloseConfirmed'] is True, 'Incomplete integration or wire cleanup')
        require(value['timeline'] and value['physicalWire'].get('identities'), 'Physical protocol/identity evidence absent')
        require(value['physicalWire']['version'] == '8.23.1' and value['physicalWire']['nodeVersion'] == 'v24.19.0', 'Runtime version drift')
        require(value['claims'] == 0 and value['business'] == 'NOT_RUN' and value['rpcAuthentication'] == 'NOT_RUN'
            and value['operationalAcl'] == value['restoreDurability'] == value['crossProcessQuarantine'] == 'NOT_ESTABLISHED', 'Unsupported success claim')
    return value


def runner_class(golden):
    base = golden.runner_class(golden.load_persistence())
    class EntryRunner(base):
        def install_exact(self, body, label):
            self.inspect_owned(); self.counter += 1
            prefix = self.output / 'logs' / f'{self.counter:03d}-{label}'
            prefix.with_suffix('.sql').write_bytes(body)
            response = subprocess.run(self.psql_args(self.database), input=body, capture_output=True,
                                      env=self.env, timeout=60)
            prefix.with_suffix('.stdout').write_bytes(response.stdout)
            prefix.with_suffix('.stderr').write_bytes(response.stderr)
            require(response.returncode == 0, 'INSTALL_FAILED_' + label)
            self.result['installed'].append({'stage': label, 'stdin_sha256': hashlib.sha256(body).hexdigest()})
            return response.stdout.decode()

        def prepare(self, frozen):
            # Do not call the old prepare: it installs a synthetic business function.
            self.database = DATABASE
            self.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;'
                       'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;'
                       'CREATE DATABASE ' + DATABASE + ' OWNER postgres TEMPLATE template0;', 'bootstrap', user='supabase_admin')
            context = json.loads(self.query("SELECT jsonb_build_object('version',current_setting('server_version_num'),"
                "'database',current_database(),'user',current_user,'session',session_user,'superuser',rolsuper,"
                "'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,"
                "'listen',current_setting('listen_addresses'),'address',inet_server_addr(),"
                "'fsync',current_setting('fsync'),'public_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n"
                " ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')))"
                " FROM pg_roles WHERE rolname=current_user;", 'preflight', self.database).stdout)
            require(context == {'version': '170006', 'database': DATABASE, 'user': 'postgres', 'session': 'postgres',
                'superuser': False, 'bypassrls': False, 'createdb': False, 'createrole': False, 'inherit': False,
                'listen': '', 'address': None, 'fsync': 'off', 'public_tables': 0}, 'Fixture preflight mismatch')
            self.result['context'] = context
            for index, path in enumerate(INSTALL):
                self.install_exact(frozen[path], 'authentic-' + str(index + 1).zfill(2))
            installed = self.install_exact((HERE / 'fixture.sql').read_bytes(), 'entry-fixture')
            require(installed.splitlines().count('AUTHORITY_ENTRY_FIXTURE_READY') == 1, 'Fixture marker missing')
            require(self.query("SELECT to_regprocedure('demo_owner_review.unbound_business_entrypoint(uuid,bigint)') IS NULL;",
                'unbound-business', self.database).stdout.strip() == 't', 'Business must remain absent')

        def run_entry_cases(self):
            self.inspect_owned()
            args = ['docker', 'exec', '-i', '--user', 'postgres', self.cid, '/usr/bin/env', '-i',
                    'PATH=/usr/bin:/bin', 'LANG=C', 'GITHUB_ACTIONS=true', 'HOME=' + golden.CONTAINER_ROOT,
                    golden.CONTAINER_ROOT + '/node', golden.CONTAINER_ROOT + '/authority-runtime.mjs']
            pending = []; watched = (signal.SIGTERM, signal.SIGINT)
            previous = {sig: signal.getsignal(sig) for sig in watched}
            try:
                for sig in watched: signal.signal(sig, lambda number, frame: pending.append(number))
                process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                           text=True, encoding='utf-8', env=self.env)
                self.sessions.append(process); process._crm_label = 'wire-lab-node'
            finally:
                for sig, handler in previous.items(): signal.signal(sig, handler)
            require(not pending, 'Interrupted during Node registration')
            try:
                stdout, stderr = process.communicate(input='', timeout=180)
            except subprocess.TimeoutExpired:
                process.kill(); stdout, stderr = process.communicate(timeout=10)
                (self.output / 'logs/runtime.stdout').write_text(stdout)
                (self.output / 'logs/runtime.stderr').write_text(stderr)
                raise RuntimeError('ENTRY_RUNTIME_TIMEOUT') from None
            (self.output / 'logs/runtime.stdout').write_text(stdout)
            (self.output / 'logs/runtime.stderr').write_text(stderr)
            report = parse_report(stdout, golden, self.token); self.physical_report = report
            self.result['node_process_exit_code'] = process.returncode
            require(process.returncode == 0 and report['status'] == 'PASS_ISOLATED_INTEGRATION_ONLY', 'ENTRY_RUNTIME_FAILED')
            self.result['case_count'] = len(report['cases'])
            self.inspect_owned()
    return EntryRunner


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--execute-disposable', action='store_true')
    parser.add_argument('--output', type=Path); args = parser.parse_args()
    if not args.execute_disposable:
        verify_sources(); print(json.dumps({'runtime': 'NOT_RUN', 'admission': 'NOT_ADMITTED'})); return
    require(args.output is not None, 'Output directory required')
    env = os.environ
    require(env.get('GITHUB_ACTIONS') == 'true' and env.get('AUTHORITY_ENTRY_ISOLATED') == '1', 'Explicit Actions opt-in required')
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text()); gate(event, env)
    frozen = verify_sources()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(); gate(event, env, head)
    golden = load_module('authority_entry_golden', ROOT / GOLDEN / 'run_ci.py')
    golden_stage = load_module('authority_entry_golden_stage', ROOT / GOLDEN / 'stage.py')
    stage = load_module('authority_entry_stage', HERE / 'stage.py')
    require(not args.output.exists(), 'Fresh evidence directory required')
    private, public = args.output / 'private', args.output / 'public'
    (private / 'logs').mkdir(parents=True); public.mkdir()
    runner = runner_class(golden)(private, uuid.uuid4().hex)
    runner.result.update(workflow_commit=head, event_base_sha=BASE, installed=[], case_count=0,
        admission='NOT_ADMITTED', endpoint='DISABLED', wire='UNBOUND', configuration='EMPTY', integration='NOT_RUN',
        business='NOT_RUN', rpc_authentication='NOT_RUN', operational_acl='NOT_ESTABLISHED',
        restore_durability='NOT_ESTABLISHED', cross_process_quarantine='NOT_ESTABLISHED',
        limits=['Authentic code/SQL against synthetic owned catalog; not deployed authentication or ACL proof',
                'Golden fsync-off/tmpfs: commit visibility/rollback only, no crash/WAL/failover/restore durability',
                'Deterministic COMMIT ACK injection only; quarantine latch is in-process, not restart-persistent'])
    def interrupted(number, frame): raise RuntimeError('Interrupted')
    for sig in (signal.SIGTERM, signal.SIGINT): signal.signal(sig, interrupted)
    started = False; runner.save()
    try:
        archive, manifest = stage.stage_runtime(private / 'stage', golden_stage, frozen)
        started = True; runner.start(); runner.prepare(frozen)
        runner.install_runtime(archive, manifest); runner.run_entry_cases()
        runner.result.update(status='checks_pass_cleanup_pending', integration='CHECKS_PASS_CLEANUP_PENDING')
    except BaseException as error:
        runner.result.update(status='failed', integration='FAIL', error_type=type(error).__name__)
        raise
    finally:
        try:
            if started: runner.cleanup()
            else:
                runner.close_sessions(); runner.result['cleanup'] = 'no_container_created'
        except BaseException as error:
            runner.result.update(status='failed', integration='FAIL', cleanup='failed', cleanup_error_type=type(error).__name__)
            raise
        finally:
            runner.save(); golden.publish(public, runner)
    require(runner.result['status'] == 'checks_pass_cleanup_pending'
        and runner.result['cleanup'] == 'confirmed_stopped_and_removed'
        and runner.result.get('shutdown_confirmed') is True and runner.result.get('pg_status_3_and_no_pid') is True
        and runner.result.get('owned_node_clients_reaped') is True and runner.result.get('owned_psql_clients_closed') is True,
        'Integration or cleanup incomplete')
    runner.result.update(status='pass', integration='PASS_ISOLATED_INTEGRATION_ONLY', phase='complete_owned_cleanup_confirmed')
    runner.save(); golden.publish(public, runner)
    print(json.dumps({'integration': runner.result['integration'], 'cases': runner.result['case_count'],
                      'cleanup': runner.result['cleanup'], 'admission': 'NOT_ADMITTED'}))

if __name__ == '__main__': main()
