#!/usr/bin/env python3
"""Protocol/ownership/order simulations only; no Docker or SQL execution."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('prefreeze_actions_test', HERE/'run-prefreeze-actions.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
CID = 'a'*64
FLAGS = {'GITHUB_ACTIONS':'true','ISOLATED_QA_DB':'1','DEMO_PREFREEZE_CI':'1',
         'DEMO_GUARD_DISPOSABLE':'1','DEMO_GUARD_POSTGRES_SERVICE_ID':CID,
         'POSTGRES_IMAGE':p.PIN,'PATH':os.environ['PATH']}


def routes():
    result = []
    for signature, bodies in p.PREIMAGES.items():
        acl = ['postgres=X/postgres','service_role=X/postgres']
        if signature == 'public.seed_demo_organization()':
            acl.append('authenticated=X/postgres')
        result.append({'signature':signature,'body':sorted(bodies)[0],'owner':'postgres',
                       'definer':True,'language':'plpgsql','acl':acl,
                       'config':['search_path=public']+(['row_security=off'] if signature.endswith('_guarded(bigint)') else [])})
    return {'routes':result}


class Protocol(unittest.TestCase):
    def simulate(self, flags=None, inspect_change=None, route_change=None, fail_suite=False, changed_owner=False):
        self.calls = []
        self.concurrency_databases = []
        self.databases = {'postgres':1,'template1':2}
        self.next_oid = 10
        self.historical_calls = []
        env = dict(FLAGS);env.update(flags or {})
        with tempfile.TemporaryDirectory(prefix='prefreeze-simulated-') as directory:
            root = Path(directory)
            for file in {**p.SUITES,**p.SOURCES}:
                target = root/file;target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(ROOT/file,target)
            self.record = None
            def fake(argv, **kw):
                self.calls.append((argv,kw))
                self.assertEqual(kw['env']['DOCKER_HOST'],'unix:///var/run/docker.sock')
                self.assertEqual(set(kw['env']),{'PATH','LANG','LC_ALL','DOCKER_HOST','DOCKER_CONFIG'})
                self.assertTrue(Path(kw['env']['DOCKER_CONFIG']).is_dir())
                if argv[:2] == ['docker','inspect']:
                    self.assertEqual(argv[2],CID)
                    item = {'Id':CID,'State':{'Running':True},'Config':{'Image':p.PIN}}
                    item.update(inspect_change or {})
                    return SimpleNamespace(stdout=json.dumps([item]),stderr='',returncode=0)
                if argv[:2] == ['git','rev-parse']:
                    return SimpleNamespace(stdout='b'*40+'\n',stderr='',returncode=0)
                self.assertEqual(argv[:6],['docker','exec','-i',CID,'/usr/bin/env','-i'])
                self.assertIn('PGHOST=/var/run/postgresql',argv)
                self.assertIn('-X',argv);self.assertIn('-w',argv)
                database = next(arg.split('=',1)[1] for arg in argv if arg.startswith('PGDATABASE='))
                self.assertIn(database,self.databases)
                sql = kw['input']
                if sql == p.CONTEXT_SQL:
                    data = {'database':database,'current_user':'postgres','session_user':'postgres','server_addr':None,'owner':'postgres'}
                elif sql == p.ROUTES_SQL:
                    data = routes()
                    if route_change:
                        data['routes'][0].update(route_change)
                elif sql.startswith('CREATE DATABASE '):
                    self.assertEqual(database,'template1')
                    name,template = re.fullmatch(r'CREATE DATABASE (\w+) TEMPLATE (\w+);',sql).groups()
                    self.assertIn(template,self.databases);self.assertNotIn(name,self.databases)
                    self.databases[name] = self.next_oid;self.next_oid += 1
                    data = ''
                elif sql.startswith('DROP DATABASE '):
                    self.assertEqual(database,'template1')
                    name = re.fullmatch(r'DROP DATABASE (\w+);',sql).group(1)
                    self.assertNotIn(name,('postgres','template1'));del self.databases[name];data = ''
                elif "FROM pg_database WHERE datname=" in sql:
                    name = re.search(r"datname='([^']*)'",sql).group(1)
                    if sql.startswith('SELECT count(*)'):
                        data = str(int(name in self.databases))
                    elif sql.startswith('SELECT oid '):
                        data = str(self.databases[name])
                    else:
                        data = {'rows':[] if name not in self.databases else [{'owner':'other' if changed_owner else 'postgres','oid':self.databases[name]}]}
                else:
                    self.assertRegex(database,r'^demo_guard_race_[a-f0-9]{32}$')
                    suite = next((name for name in p.SUITES if (root/name).read_text()==sql),None)
                    self.assertIsNotNone(suite,'Only pinned historical SQL may reach clone')
                    self.historical_calls.append((database,suite))
                    if fail_suite:
                        return SimpleNamespace(stdout='',stderr='ERROR: simulated historical assertion',returncode=3)
                    data = ''
                return SimpleNamespace(stdout=json.dumps(data)+'\n' if isinstance(data,dict) else data,stderr='',returncode=0)
            def race(context):
                self.concurrency_databases.append(context.database)
                self.assertRegex(context.database,r'^demo_guard_race_[a-f0-9]{32}$')
                return {'status':'pass','cases':[{'status':'pass'},{'status':'pass'}]}
            try:
                with patch.object(p,'ROOT',root),patch.dict(os.environ,env,clear=True),patch.object(sys,'argv',['run-prefreeze-actions.py']), \
                     patch.object(p.subprocess,'run',side_effect=fake),patch.object(p.m,'fingerprint',return_value=[{'digest':'unchanged'}]), \
                     patch.object(p.m,'run_concurrency',side_effect=race),contextlib.redirect_stdout(io.StringIO()):
                    p.main()
            finally:
                evidence = root/'reports/demo-guard-prefreeze/actions-result.json'
                if evidence.exists():
                    self.record = json.loads(evidence.read_text())
        return self.record

    def test_explicit_opt_in_and_remote_refusal_before_process(self):
        for key in ['GITHUB_ACTIONS','ISOLATED_QA_DB','DEMO_PREFREEZE_CI','DEMO_GUARD_DISPOSABLE','DEMO_GUARD_POSTGRES_SERVICE_ID','POSTGRES_IMAGE']:
            with self.subTest(key=key),self.assertRaises(RuntimeError):
                self.simulate({key:''})
            self.assertEqual(self.calls,[])
        for key in ['DATABASE_URL','SUPABASE_DB_URL','PGSERVICE','PGSERVICEFILE','PGHOSTADDR']:
            with self.subTest(key=key),self.assertRaises(RuntimeError):
                self.simulate({key:'remote'})
            self.assertEqual(self.calls,[])

    def test_service_identity_mismatch_before_any_sql(self):
        for change in [{'Id':'b'*64},{'State':{'Running':False}},{'Config':{'Image':'postgres:17'}}]:
            with self.subTest(change=change),self.assertRaises(RuntimeError):
                self.simulate(inspect_change=change)
            self.assertEqual(len(self.calls),1)

    def test_incorrect_body_owner_acl_and_config_refused_before_clone(self):
        for change in [{'body':'0'*64},{'owner':'other'},{'acl':['postgres=X/postgres']},{'config':['search_path=public','row_security=off']}]:
            with self.subTest(change=change),self.assertRaises(RuntimeError):
                self.simulate(route_change=change)
            self.assertFalse(any('CREATE DATABASE ' in str(kw.get('input','')) for _,kw in self.calls))

    def test_checkpoint_once_two_clones_all_historical_positives_and_cleanup(self):
        record = self.simulate(flags={'DOCKER_HOST':'tcp://untrusted:2375','DOCKER_CONFIG':'/untrusted','PGDATABASE':'production'})
        self.assertEqual(record['status'],'passed')
        self.assertTrue(record['sourcePreserved'])
        self.assertEqual(record['checkpoint']['executions'],1)
        self.assertTrue(record['checkpoint']['created'] and record['checkpoint']['dropped'])
        self.assertEqual(len(record['cloneRuns']),2)
        self.assertEqual(len(self.historical_calls),8)
        self.assertEqual(len(self.concurrency_databases),2)
        self.assertTrue(all(r['executions']==2 and r['exitCode']==0 for r in record['files']))
        self.assertEqual(record['concurrency']['executions'],2)
        self.assertEqual(self.databases,{'postgres':1,'template1':2})
        create = [kw['input'] for _,kw in self.calls if str(kw.get('input','')).startswith('CREATE DATABASE ')]
        self.assertEqual(sum(sql.endswith('TEMPLATE postgres;') for sql in create),1)
        self.assertEqual(sum('TEMPLATE demo_guard_checkpoint_' in sql for sql in create),2)
        self.assertFalse(any('CREATE OR REPLACE FUNCTION public.seed_demo_organization_guarded' in str(kw.get('input','')) for _,kw in self.calls))

    def test_suite_failure_stops_positive_claim_and_cleans_owned_databases(self):
        with self.assertRaises(RuntimeError):
            self.simulate(fail_suite=True)
        self.assertEqual(self.record['status'],'failed')
        self.assertEqual(self.record['concurrency']['executions'],0)
        self.assertEqual(self.databases,{'postgres':1,'template1':2})

    def test_owner_drift_prevents_drop_and_green(self):
        with self.assertRaises(RuntimeError):
            self.simulate(changed_owner=True)
        self.assertEqual(self.record['status'],'failed')
        self.assertFalse(any(str(kw.get('input','')).startswith('DROP DATABASE ') for _,kw in self.calls))

    def test_original_pins_and_unknown_schema_cannot_be_substituted(self):
        p.verify_sources()
        for signature in p.PREIMAGES:
            altered = routes()
            altered['routes'].append(dict(altered['routes'][0]))
            with self.assertRaises(RuntimeError):
                p.verify_routes(altered)


class ReplayOrder(unittest.TestCase):
    def simulate(self, forward=True, flag='1'):
        with tempfile.TemporaryDirectory(prefix='prefreeze-replay-order-') as directory:
            root = Path(directory)
            for path in ['supabase/schema/squash','supabase/migrations','scripts/ci/selector148','supabase/tests/rls','bin']:
                (root/path).mkdir(parents=True)
            (root/'supabase/schema/squash/cutoff.env').write_text('SQUASH_FILE=supabase/schema/squash/base.sql\nSQUASH_INCLUDED=supabase/schema/squash/included.txt\n')
            (root/'supabase/schema/squash/included.txt').write_text('already-squashed.sql\n')
            (root/'supabase/schema/squash/base.sql').write_text('-- bootstrap baseline\n')
            (root/'supabase/tests/rls/_ci_bootstrap.sql').write_text('-- bootstrap\n')
            for name in ['20261015040000_before.sql','20261015060000_after.sql']+([p.FORWARD] if forward else []):
                (root/'supabase/migrations'/name).write_text('-- '+name+'\n')
            (root/'scripts/ci/selector148/profile-replay.sh').write_text('replay_profile_init(){ :; }\nreplay_profile_begin(){ :; }\nreplay_profile_finish(){ :; }\n')
            scripts = {
                'psql': '#!/bin/bash\nif [[ "$*" == *"count(*)"* ]]; then echo 0; elif [[ "$*" != *" -f "* ]]; then while IFS= read -r line; do printf "%s\\n" "$line" >> "$TRACE"; done; fi\n',
                'python3': '#!/bin/bash\nprintf "checkpoint:%s\\n" "$*" >> "$TRACE"\n',
                'node': '#!/bin/bash\nprintf "verify:%s\\n" "$*" >> "$TRACE"\n',
            }
            for name,source in scripts.items():
                file = root/'bin'/name;file.write_text(source);file.chmod(0o700)
            env = dict(os.environ,PATH=str(root/'bin')+':'+os.environ['PATH'],PGHOST='localhost',PGUSER='postgres',PGDATABASE='postgres',
                       DEMO_PREFREEZE_CI=flag,TRACE=str(root/'trace'))
            for key in ['AUD54_CI','SELECTOR148_ISOLATED_CI','FINANCIAL49_CI','PRICING_CONTAINER_CI','LEADS_SCOPE_CI','DATABASE_URL','SUPABASE_DB_URL','PGHOSTADDR','PGSERVICE','PGSERVICEFILE']:
                env.pop(key,None)
            process = subprocess.run(['bash',str(ROOT/'scripts/ci/rls-prepare-db.sh')],cwd=root,env=env,text=True,capture_output=True)
            trace = (root/'trace').read_text().splitlines() if (root/'trace').exists() else []
            return process,trace

    def test_exactly_once_between_prior_replay_and_forward(self):
        process,trace = self.simulate()
        self.assertEqual(process.returncode,0,process.stdout+process.stderr)
        checkpoint = 'checkpoint:scripts/ci/demo-guard/run-prefreeze-actions.py'
        verification = 'verify:scripts/ci/test-catalog.mjs --verify-prefreeze reports/demo-guard-prefreeze/actions-result.json'
        self.assertEqual(trace.count(checkpoint),1)
        before = trace.index('-- 20261015040000_before.sql');gate = trace.index(checkpoint);verify = trace.index(verification)
        frozen = trace.index('-- '+p.FORWARD);after = trace.index('-- 20261015060000_after.sql')
        self.assertEqual([before,gate,verify,frozen,after],sorted([before,gate,verify,frozen,after]))
        self.assertEqual(frozen,verify+1)

    def test_missing_forward_fails_closed(self):
        process,trace = self.simulate(forward=False)
        self.assertNotEqual(process.returncode,0)
        self.assertIn('not executed before the freeze',process.stdout+process.stderr)
        self.assertFalse(any(line.startswith('checkpoint:') for line in trace))


if __name__ == '__main__':
    unittest.main(verbosity=2)
