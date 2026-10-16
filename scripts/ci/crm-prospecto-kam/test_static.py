"""Offline assertion/transport simulations only; never executes Docker or SQL."""
import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('crm_kam_actions_test', HERE / 'run-actions.py')
actions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(actions)
m = actions.m
CID = 'a' * 64
FLAGS = {'PATH': os.environ.get('PATH', ''), 'GITHUB_ACTIONS': 'true', 'ISOLATED_QA_DB': '1',
         'CRM_PROSPECTO_KAM_DISPOSABLE': '1', 'CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID': CID,
         'POSTGRES_IMAGE': actions.PIN, 'PGHOST': 'localhost'}


class FinalAssertions(unittest.TestCase):
    def setUp(self):
        self.f = {'org': 'org', 'other_org': 'other', 'actor': 'actor', 'company': 'company'}
        self.before = {key: [] for key in ('companies', 'leads', 'opportunities', 'links', 'history',
                                          'audit', 'notifications', 'memberships', 'roles', 'users', 'clients')}
        self.before['companies'] = [dict(id='company', organization_id='org', created_by='actor',
                                          estado_crm='Lead', lead_origen_id=None, __ctid='(1,1)', __xmin='1'),
                                      dict(id='other-company', organization_id='other')]
        self.after = copy.deepcopy(self.before)
        self.after['companies'][0].update(estado_crm='Prospecto', lead_origen_id='lead', __ctid='(1,2)', __xmin='2')
        row = dict(organization_id='org', vendedor_id='actor', created_by='actor',
                   vendedor_email='actor@test.invalid', deleted_at=None)
        self.after['leads'] = [dict(row, id='lead', estado='Prospecto')]
        self.after['opportunities'] = [dict(row, id='op', lead_id='lead')]
        self.after['links'] = [dict(organization_id='org', oportunidad_id='op', empresa_id='company')]

    def verify(self):
        m.verify_final(self.before, self.after, self.f, 'op')

    def test_correct_transition(self):
        self.verify()

    def test_duplicates_rejected(self):
        for key in ('leads', 'opportunities', 'links'):
            self.after[key].append(copy.deepcopy(self.after[key][0]))
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.verify()
            self.after[key].pop()

    def test_ownership_tenant_deletion_and_lineage_rejected(self):
        mutants = [('leads', 'vendedor_id', 'other'), ('opportunities', 'created_by', None),
                   ('leads', 'organization_id', 'other'), ('opportunities', 'deleted_at', 'today'),
                   ('links', 'organization_id', 'other'), ('opportunities', 'lead_id', 'different'),
                   ('links', 'empresa_id', 'different'), ('leads', 'vendedor_email', '')]
        for table, key, value in mutants:
            original = self.after[table][0][key]
            self.after[table][0][key] = value
            with self.subTest(table=table, key=key), self.assertRaises(RuntimeError):
                self.verify()
            self.after[table][0][key] = original

    def test_company_reassignment_rejected(self):
        self.after['companies'][0]['created_by'] = 'other'
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_other_tenant_mutation_rejected(self):
        self.after['companies'][1]['changed'] = True
        with self.assertRaises(RuntimeError):
            self.verify()

    def test_idempotent_snapshot_tracks_physical_rewrites(self):
        # Equal business values alone must not conceal an unnecessary UPDATE.
        committed = copy.deepcopy(self.after)
        self.after['companies'][0]['__ctid'] = '(2,1)'
        with self.assertRaises(RuntimeError):
            m.require(self.after == committed, 'Idempotent waiter changed persisted state')
        source = (HERE / 'concurrency.py').read_text(encoding='utf-8')
        self.assertIn("'__ctid',t.ctid::text,'__xmin',t.xmin::text", source)

    def test_cleanup_exact_oid_and_owner_only(self):
        self.assertTrue(m.owned_clone_present([{'oid': 12, 'owner': 'postgres'}], 12))
        self.assertFalse(m.owned_clone_present([], 12))
        for row in ({'oid': '12', 'owner': 'postgres'}, {'oid': True, 'owner': 'postgres'},
                    {'oid': 13, 'owner': 'postgres'}, {'oid': 12, 'owner': 'other'}):
            with self.subTest(row=row), self.assertRaises(RuntimeError):
                m.owned_clone_present([row], 12)

    def test_checked_out_postimage_and_numeric_cleanup_oid(self):
        actions.verify_sources()
        self.assertIn("'oid',oid::bigint", actions.clone_identity_sql('crm_prospecto_kam_test'))


class AdapterProtocol(unittest.TestCase):
    def simulate(self, flags=None, wrong_image=False, changed_owner=False, fail_race=False):
        self.calls, self.races, self.sql_calls = [], [], []
        databases = {'postgres': 1, 'template1': 2}
        env = dict(FLAGS)
        env.update(flags or {})
        with tempfile.TemporaryDirectory(prefix='crm-kam-offline-') as directory:
            root = Path(directory)
            for relative in (actions.MIGRATION, actions.MIRROR):
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            route = {'body': actions.EXPECTED_BODY_MD5, 'owner': 'postgres', 'definer': True,
                     'language': 'plpgsql', 'config': ['search_path=public'],
                     'acl': ['postgres=X/postgres', 'authenticated=X/postgres', 'service_role=X/postgres'],
                     'metadata': 'reviewed'}

            def fake(argv, **kwargs):
                self.calls.append(argv)
                self.assertEqual(set(kwargs['env']), {'PATH', 'LANG', 'LC_ALL', 'DOCKER_HOST', 'DOCKER_CONFIG'})
                self.assertEqual(kwargs['env']['DOCKER_HOST'], 'unix:///var/run/docker.sock')
                self.assertTrue(Path(kwargs['env']['DOCKER_CONFIG']).is_dir())
                if argv[:2] == ['docker', 'inspect']:
                    self.assertEqual(argv[2], CID)
                    output = json.dumps([{'Id': CID, 'State': {'Running': True},
                                          'Config': {'Image': 'wrong' if wrong_image else actions.PIN}}])
                elif argv[:2] == ['git', 'rev-parse']:
                    output = 'b' * 40
                else:
                    self.assertEqual(argv[:6], ['docker', 'exec', '-i', CID, '/usr/bin/env', '-i'])
                    self.assertIn('PGHOST=/var/run/postgresql', argv)
                    self.assertIn('-X', argv)
                    self.assertIn('-w', argv)
                    database = next(arg.split('=', 1)[1] for arg in argv if arg.startswith('PGDATABASE='))
                    self.assertIn(database, databases)
                    sql = kwargs['input']
                    self.sql_calls.append((database, sql))
                    if sql == actions.CONTEXT_SQL:
                        output = json.dumps({'database': database, 'current_user': 'postgres', 'session_user': 'postgres',
                                             'server_addr': None, 'owner': 'postgres'})
                    elif sql == actions.ROUTE_SQL:
                        output = json.dumps(route)
                    elif sql.startswith('CREATE DATABASE '):
                        self.assertEqual(database, 'template1')
                        name = re.fullmatch(r'CREATE DATABASE (crm_prospecto_kam_[a-f0-9]{32}) TEMPLATE postgres;', sql).group(1)
                        self.assertNotIn(name, databases)
                        databases[name] = 20 + len(databases)
                        output = ''
                    elif sql.startswith('DROP DATABASE '):
                        self.assertEqual(database, 'template1')
                        name = re.fullmatch(r'DROP DATABASE (crm_prospecto_kam_[a-f0-9]{32});', sql).group(1)
                        del databases[name]
                        output = ''
                    elif 'FROM pg_database WHERE datname=' in sql:
                        name = re.search(r"datname='([^']*)'", sql).group(1)
                        if sql.startswith('SELECT count(*)'):
                            output = str(int(name in databases))
                        elif sql.startswith('SELECT oid'):
                            output = str(databases[name])
                        else:
                            output = json.dumps({'rows': [] if name not in databases else [
                                {'oid': databases[name], 'owner': 'other' if changed_owner else 'postgres'}]})
                    else:
                        self.assertRegex(database, m.CLONE_PATTERN)
                        self.assertEqual(sql, (root / actions.MIGRATION).read_text(encoding='utf-8'))
                        output = ''
                return SimpleNamespace(stdout=output, stderr='', returncode=0)

            def race(context):
                self.races.append(context.database)
                self.assertRegex(context.database, m.CLONE_PATTERN)
                self.assertEqual(context.body_md5, actions.EXPECTED_BODY_MD5)
                if fail_race:
                    raise RuntimeError('Simulated race failure')
                return {'status': 'pass', 'both_committed': True}

            self.record = None
            try:
                with patch.object(actions, 'ROOT', root), patch.dict(os.environ, env, clear=True), \
                     patch.object(sys, 'argv', ['run-actions.py']), patch.object(actions.subprocess, 'run', side_effect=fake), \
                     patch.object(m, 'fingerprint', return_value=[{'digest': 'unchanged'}]), \
                     patch.object(m, 'run_concurrency', side_effect=race), contextlib.redirect_stdout(io.StringIO()):
                    actions.main()
            finally:
                file = root / 'reports/crm-prospecto-kam-concurrency/actions-result.json'
                if file.exists():
                    self.record = json.loads(file.read_text())
        return self.record

    def test_two_fresh_clones_replay_race_drop_and_source_unchanged(self):
        result = self.simulate()
        self.assertEqual(result['status'], 'pass')
        self.assertTrue(result['source_preserved'])
        self.assertEqual(len(set(self.races)), 2)
        self.assertTrue(all(row['dropped'] and row['whole_migration_replay'] == 'pass' for row in result['clone_runs']))

    def test_required_opt_ins_before_any_process(self):
        for key in ('GITHUB_ACTIONS', 'ISOLATED_QA_DB', 'CRM_PROSPECTO_KAM_DISPOSABLE',
                    'CRM_PROSPECTO_KAM_POSTGRES_SERVICE_ID', 'POSTGRES_IMAGE'):
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.simulate({key: ''})
            self.assertEqual(self.calls, [])

    def test_ambient_remote_routes_refused_before_any_process(self):
        for key in ('PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR'):
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.simulate({key: 'remote'})
            self.assertEqual(self.calls, [])

    def test_unverified_service_refused_before_clone(self):
        with self.assertRaises(RuntimeError):
            self.simulate(wrong_image=True)
        self.assertEqual(self.races, [])
        self.assertEqual(len(self.calls), 1)

    def test_changed_clone_owner_refuses_drop(self):
        with self.assertRaises(RuntimeError):
            self.simulate(changed_owner=True)
        self.assertEqual(self.record['status'], 'fail')
        self.assertTrue(self.record['source_preserved'])
        self.assertFalse(any(sql.startswith('DROP DATABASE ') for _, sql in self.sql_calls))
        self.assertFalse(self.record['clone_runs'][0]['dropped'])

    def test_failed_race_still_drops_clone_and_checks_source(self):
        with self.assertRaises(RuntimeError):
            self.simulate(fail_race=True)
        self.assertEqual(self.record['status'], 'fail')
        self.assertTrue(self.record['clone_runs'][0]['dropped'])
        self.assertTrue(self.record['source_preserved'])


if __name__ == '__main__':
    unittest.main()
