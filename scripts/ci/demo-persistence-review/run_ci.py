#!/usr/bin/env python3
"""Actions-only owned PG17.6 fixture; no DSN, real database or wire binding."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import sys
import uuid

from sources import ROOT, SOURCE, SOURCE_BASE, STORE_SHA256, verify_sources

REPOSITORY = 'jfcaicedoobando-arch/elogistix'
BRANCH = 'codex/persistence-pg176-quarantine'
INFRA = ROOT / 'scripts/ci/crm-acl-review/run_ci.py'
INFRA_SHA256 = 'a364f833851080d9b290fca35fa7925514dc898979359e55c411f0eef57e7816'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def gate(event, env, head):
    require(env.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only; no local SQL/Docker execution')
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'PR event required')
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY, 'Repository mismatch')
    require(event['action'] in ('opened', 'synchronize', 'reopened'), 'Unsupported PR action')
    require(event['repository']['full_name'] == REPOSITORY, 'Event repository mismatch')
    p = event['pull_request']
    for side in ('head', 'base'):
        require(p[side]['repo']['full_name'] == REPOSITORY
                and p[side]['repo']['owner']['login'] == 'jfcaicedoobando-arch', 'Foreign repository/owner')
    require(p['draft'] is True, 'Draft PR required')
    require(p['base']['ref'] == 'main' and p['base']['sha'] == SOURCE_BASE, 'Base changed: review required')
    require(p['head']['ref'] == BRANCH, 'Head branch mismatch')
    require(re.fullmatch(r'[0-9a-f]{40}', head) and head == p['head']['sha'], 'Checkout SHA mismatch')
    return head


def load_infrastructure():
    require(hashlib.sha256(INFRA.read_bytes()).hexdigest() == INFRA_SHA256, 'Reviewed infrastructure bytes changed')
    spec = importlib.util.spec_from_file_location('persistence_review_infrastructure', INFRA)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def query_contract():
    node = shutil.which('node')
    require(node is not None, 'Node runtime required for exact store.mjs query export')
    script = "import {SQL} from './docs/review/demo-durable-owner-adapter-20261015/store.mjs';process.stdout.write(JSON.stringify(SQL));"
    node_env = {'PATH': str(Path(node).parent), 'LANG': 'C'}
    if os.name == 'nt' and 'SystemRoot' in os.environ:
        node_env['SystemRoot'] = os.environ['SystemRoot']
    response = subprocess.run([node, '--input-type=module', '-e', script], cwd=ROOT,
                              env=node_env,
                              check=True, capture_output=True, text=True, timeout=10)
    value = json.loads(response.stdout)
    require(set(value) == {'begin', 'durable', 'dispatch', 'ingress', 'commit', 'business'}, 'Store query contract changed')
    require('unbound_business_entrypoint' in value['business'], 'Business must remain unbound')
    return value


def runner_class(infrastructure):
    class PersistenceRunner(infrastructure.CRMRunner):
        def compile_exact_store(self, db):
            self.inspect_owned()
            source = (SOURCE / 'store.sql').read_bytes()
            require(hashlib.sha256(source).hexdigest() == STORE_SHA256, 'Store bytes changed before execution')
            self.counter += 1
            prefix = self.output / 'logs' / f'{self.counter:03d}-exact-store'
            prefix.with_suffix('.sql').write_bytes(source)
            # Binary stdin: this exact object is sent, with no fixture, SET or transaction text prepended.
            try:
                response = subprocess.run(self.psql_args(db), input=source, capture_output=True,
                                          env=self.env, timeout=30)
            except subprocess.TimeoutExpired as error:
                prefix.with_suffix('.stdout').write_bytes(error.stdout or b'')
                prefix.with_suffix('.stderr').write_bytes(error.stderr or b'')
                raise
            prefix.with_suffix('.stdout').write_bytes(response.stdout)
            prefix.with_suffix('.stderr').write_bytes(response.stderr)
            require(response.returncode == 0, 'Exact store compilation failed: ' + response.stdout.decode(errors='replace'))
            logged = prefix.with_suffix('.sql').read_bytes()
            require(logged == source, 'Exact store log differs from stdin bytes')
            self.result.update(store_file_sha256=STORE_SHA256,
                               store_stdin_sha256=hashlib.sha256(source).hexdigest(),
                               store_log_sha256=hashlib.sha256(logged).hexdigest(), exact_store_bytes=True)
            self.check('exact-store-compilation', synthetic_database=True, transformed=False)

        def prepare(self):
            self.database = 'crm_acl_fixture_persistence'
            self.store_sql = query_contract()
            self.query('CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;'
                       'CREATE DATABASE ' + self.database + ' OWNER postgres;', 'fixture-role-and-database', user='supabase_admin')
            context = json.loads(self.query("SELECT jsonb_build_object('version',current_setting('server_version_num'),"
                "'user',current_user,'session',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),"
                "'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),"
                "'catalog_write',has_table_privilege(current_user,'pg_proc','INSERT,UPDATE,DELETE,TRUNCATE'),"
                "'address',inet_server_addr(),'sync_commit',current_setting('synchronous_commit'),'fsync',current_setting('fsync'));",
                'candidate-context', self.database).stdout)
            require(context == {'version': '170006', 'user': 'postgres', 'session': 'postgres', 'superuser': False,
                                'admin_member': False, 'listen': '', 'catalog_write': False, 'address': None,
                                'sync_commit': 'on', 'fsync': 'off'}, 'Candidate context mismatch: ' + str(context))
            self.result['context'] = context
            self.result['postgres_version'] = self.query('SELECT version();', 'server-version', self.database).stdout.strip()
            self.compile_exact_store(self.database)
            absent = self.query("SELECT to_regprocedure('demo_owner_review.unbound_business_entrypoint(uuid,bigint)') IS NULL;",
                                'business-wire-absent', self.database).stdout.strip()
            require(absent == 't', 'Unbound business entrypoint unexpectedly exists')
            self.check('business-entrypoint-remains-unbound')
    return PersistenceRunner


def main():
    from sql_cases import CASES, run_sql_cases
    require(bool(CASES) and len(CASES) == len(set(CASES)), 'Nonempty unique SQL case matrix required')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    env = os.environ
    require(env.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only; no local SQL/Docker execution')
    event = json.loads(Path(env['GITHUB_EVENT_PATH']).read_text())
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True, cwd=ROOT).strip()
    gate(event, env, head)
    manifest = verify_sources()
    infrastructure = load_infrastructure()
    require(not args.output.exists(), 'Fresh evidence directory required')
    args.output.mkdir(parents=True)
    (args.output / 'logs').mkdir()
    r = runner_class(infrastructure)(args.output, uuid.uuid4().hex)
    r.result.update(workflow_commit=head, event_base_sha=event['pull_request']['base']['sha'],
                    run_url='https://github.com/' + REPOSITORY + '/actions/runs/' + env['GITHUB_RUN_ID'],
                    input_manifest=manifest, infrastructure_sha256=INFRA_SHA256,
                    sql_lane='NOT_RUN', wire='UNBOUND', configuration='EMPTY', synthetic_business=True,
                    limits=['Disposable SQL store/claim behavior only; not an operational wire, real issuer or identity',
                            'Synthetic business fixture does not certify authentic engine or financial checkpoints',
                            'At-most-once with quarantine; no exactly-once or availability guarantee',
                            'Inherited harness uses fsync=off and ephemeral tmpfs: committed visibility/rollback only, not crash/WAL/failover or restore durability'])
    def interrupted(number, frame):
        raise RuntimeError('Interrupted by signal ' + str(number))
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    r.save()
    try:
        r.start()
        r.prepare()
        run_sql_cases(r, r.database)
        require(r.query("SELECT to_regprocedure('demo_owner_review.unbound_business_entrypoint(uuid,bigint)') IS NULL;",
                        'business-wire-still-absent', r.database).stdout.strip() == 't', 'Business boundary changed')
        r.result['unbound_entrypoint_absent_after_cases'] = True
        expected = ['exact-store-compilation', 'business-entrypoint-remains-unbound', *CASES]
        require([case['case'] for case in r.result['checks']] == expected, 'Incomplete or duplicate SQL case matrix')
        require(all(case['status'] == 'pass' for case in r.result['checks']), 'SQL case failed')
        r.result.update(status='checks_pass_cleanup_pending', sql_lane='CHECKS_PASS_CLEANUP_PENDING')
        r.save()
    except BaseException as error:
        r.result.update(status='failed', sql_lane='FAIL', error_type=type(error).__name__, error=str(error))
        r.save()
        raise
    finally:
        try:
            r.cleanup()
        except BaseException as error:
            r.result.update(status='failed', sql_lane='FAIL', cleanup='failed', cleanup_error=str(error))
            raise
        finally:
            r.save()
    require(r.result['status'] == 'checks_pass_cleanup_pending'
            and r.result['cleanup'] == 'confirmed_stopped_and_removed', 'Tests or owned cleanup incomplete')
    r.result.update(status='pass', sql_lane='PASS_SYNTHETIC_ONLY')
    r.save()
    print(json.dumps(r.result, indent=2))


if __name__ == '__main__':
    main()
