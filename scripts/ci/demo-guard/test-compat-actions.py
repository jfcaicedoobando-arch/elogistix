#!/usr/bin/env python3
"""Fail-closed transport controls; no Docker or database is contacted."""
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('compat_actions', HERE / 'run-compat-actions.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
CID = 'a' * 64
FLAGS = {'GITHUB_ACTIONS': 'true', 'ISOLATED_QA_DB': '1', 'DEMO_COMPAT_DISPOSABLE': '1',
         'DEMO_COMPAT_POSTGRES_SERVICE_ID': CID, 'POSTGRES_IMAGE': m.PIN, 'PATH': os.environ['PATH']}
CONTEXT = {'database': 'postgres', 'current_user': 'postgres', 'session_user': 'postgres',
           'server_addr': None, 'owner': 'postgres'}


class Transport(unittest.TestCase):
    def invoke(self, change=None, inspect_change=None, context_change=None, sql_exit=0, inspect_payload=None):
        env = dict(FLAGS)
        env.update(change or {})
        calls = []
        self.calls = calls
        def fake(argv, **kw):
            calls.append((argv, kw))
            self.assertEqual(kw['env']['DOCKER_HOST'], 'unix:///var/run/docker.sock')
            self.assertEqual(set(kw['env']), {'PATH', 'LANG', 'LC_ALL', 'DOCKER_HOST', 'DOCKER_CONFIG'})
            self.assertTrue(Path(kw['env']['DOCKER_CONFIG']).is_dir())
            if argv[1] == 'inspect':
                item = {'Id': CID, 'State': {'Running': True}, 'Config': {'Image': m.PIN}}
                item.update(inspect_change or {})
                return SimpleNamespace(stdout=json.dumps([item] if inspect_payload is None else inspect_payload).encode(), returncode=0)
            self.assertEqual(argv[:6], ['docker', 'exec', '-i', CID, '/usr/bin/env', '-i'])
            self.assertIn('PGDATABASE=postgres', argv)
            self.assertIn('PGHOST=/var/run/postgresql', argv)
            self.assertIn('-X', argv)
            self.assertIn('-w', argv)
            self.assertEqual(argv[-2:], ['-f', '-'])
            if kw['input'] == m.PREFLIGHT:
                context = dict(CONTEXT)
                context.update(context_change or {})
                return SimpleNamespace(stdout=json.dumps(context).encode(), returncode=0)
            self.assertEqual(kw['input'], m.SUITE.read_bytes())
            return SimpleNamespace(stdout=b'suite output', stderr=b'suite error', returncode=sql_exit)
        with patch.dict(os.environ, env, clear=True), patch.object(sys, 'argv', [str(HERE / 'run-compat-actions.py')]), \
             patch.object(m.subprocess, 'run', side_effect=fake), \
             patch.object(sys, 'stdout', SimpleNamespace(buffer=io.BytesIO())), \
             patch.object(sys, 'stderr', SimpleNamespace(buffer=io.BytesIO())):
            return m.main(), calls

    def test_missing_opt_in_id_image_and_remote_routing_fail_before_subprocess(self):
        invalid = {key: '' for key in FLAGS if key != 'PATH'}
        invalid.update(GITHUB_ACTIONS='false', ISOLATED_QA_DB='0', DEMO_COMPAT_DISPOSABLE='0',
                       DEMO_COMPAT_POSTGRES_SERVICE_ID='postgres', POSTGRES_IMAGE='postgres:17')
        for key, value in invalid.items():
            with self.subTest(key=key):
                with self.assertRaises(RuntimeError): self.invoke({key: value})
                self.assertEqual(self.calls, [])
        for key in ['DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR']:
            with self.subTest(key=key):
                with self.assertRaises(RuntimeError): self.invoke({key: 'remote'})
                self.assertEqual(self.calls, [])

    def test_wrong_container_state_or_image_never_reaches_sql(self):
        for item in [{'Id': 'b' * 64}, {'State': {'Running': False}}, {'Config': {'Image': 'postgres:17'}}]:
            with self.subTest(item=item):
                with self.assertRaises(RuntimeError): self.invoke(inspect_change=item)
                self.assertEqual(len(self.calls), 1)
        for items in [[], [{}, {}], [None]]:
            with self.subTest(items=items):
                with self.assertRaises((RuntimeError, TypeError)): self.invoke(inspect_payload=items)
                self.assertEqual(len(self.calls), 1)

    def test_wrong_database_user_session_address_or_owner_is_rejected(self):
        for key in CONTEXT:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.invoke(context_change={key: '172.18.0.2' if key == 'server_addr' else 'other'})
            self.assertEqual(len(self.calls), 2)

    def test_clean_docker_environment_exact_sql_reinspection_and_sql_exit(self):
        status, calls = self.invoke({'DOCKER_HOST': 'tcp://remote:2375', 'DOCKER_CONTEXT': 'remote',
                                    'DOCKER_CONFIG': '/untrusted', 'PGHOST': 'remote', 'PGDATABASE': 'production'})
        self.assertEqual(status, 0)
        self.assertEqual([a[0][1] for a in calls], ['inspect', 'exec', 'inspect', 'exec'])
        status, _ = self.invoke(sql_exit=3)
        self.assertEqual(status, 3)

    def test_runner_routes_one_inventory_entry_without_fallback(self):
        runner = HERE.parent / 'run-rls-suites.sh'
        with tempfile.TemporaryDirectory(prefix='compat-routing-') as temp:
            root = Path(temp)
            suites = root / 'supabase/tests/rls'
            suites.mkdir(parents=True)
            for name in ['demo_seed_disabled', 'ordinary']:
                (suites / ('test_rls_' + name + '.sql')).write_text('BEGIN;\nROLLBACK;\n')
            adapter = root / 'scripts/ci/demo-guard/run-compat-actions.py'
            adapter.parent.mkdir(parents=True)
            adapter.write_text('import os,sys\nopen(os.environ["TRACE"],"a").write("adapter\\n")\nsys.exit(int(os.environ.get("ADAPTER_EXIT","0")))\n')
            tools = root / 'bin'
            tools.mkdir()
            psql = tools / 'psql'
            psql.write_text('#!/bin/sh\nprintf "psql %s\\n" "$*" >> "$TRACE"\n')
            psql.chmod(0o700)
            for actions, exit_code in [('true', '0'), ('true', '3'), ('false', '0')]:
                trace = root / 'trace'
                trace.write_text('')
                env = dict(os.environ, PATH=str(tools) + ':' + os.environ['PATH'], GITHUB_ACTIONS=actions,
                           LOG_DIR=str(root / 'logs'), TRACE=str(trace), ADAPTER_EXIT=exit_code,
                           GITHUB_STEP_SUMMARY=str(root / 'summary'))
                p = subprocess.run(['bash', str(runner)], cwd=root, env=env, capture_output=True, text=True)
                calls = trace.read_text().splitlines()
                self.assertEqual(sum(c == 'adapter' for c in calls), 1 if actions == 'true' else 0)
                self.assertEqual(sum(c.startswith('psql ') for c in calls), 1 if actions == 'true' else 2)
                ledger = (root / 'logs/execution.tsv').read_text().splitlines()
                self.assertEqual(len(ledger), 3)
                self.assertEqual(len({line.split('\t')[0] for line in ledger[1:]}), 2)
                self.assertEqual(p.returncode, 1 if actions == 'true' and exit_code == '3' else 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
