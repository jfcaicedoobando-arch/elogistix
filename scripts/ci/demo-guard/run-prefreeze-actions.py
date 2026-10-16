#!/usr/bin/env python3
"""Historical positives from one pre-forward checkpoint, never from final DB.

Only rls-prepare-db.sh may select this phase immediately before the disabling
forward. The exact Actions service is supplied by the workflow. No restore or
old function installation is performed against source postgres or final state.
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PIN = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
FORWARD = '20261015050000_disable_demo_reseed.sql'
HISTORY = 'supabase/tests/rls/history/demo-prefreeze/'
SUITES = {
    HISTORY+'test_rls_demo_seed_core_compatibility.sql': 'e0668c846c41821483303ba5db78bc7c491557e7f294f1544055638f50ef191d',
    HISTORY+'test_rls_demo_seed_tenant_guard.sql': '73f5772584bd7e28da732605217e5917b77661592e1dbf2a7ea0185e5b345e22',
    HISTORY+'test_rls_demo_seed_guard_repeatable_read.sql': 'a27e9238b1689ff8cd47045681f933e03ac758d9b45a16b8b2cf92f2294cf860',
    HISTORY+'test_rls_demo_seed_guard_serializable.sql': 'cd05fcb331c27b34db6554befbf63e783bacac9689d118ce46cf57546d9555d0',
}
SOURCES = {
    'scripts/ci/demo-guard/concurrency.py': '01250f665e0bd3456c9272cc23616f94a296a0244fdf4a20aabc0af1660c87a0',
    'scripts/ci/demo-guard/fixture.sql': 'b69eb72c13c3730a2af7c7a37be51ac8ce7fe05984bf58ec4f70f907b9a1a04e',
    'scripts/ci/demo-guard/insert-parents.sql': '8142ae2d2d224f8bd76b9b976d317392f20dba98aab458e7e8e9fd6a81b96e6a',
    'scripts/ci/demo-guard/graph.sql': '5fe123faaadfed18c834fbd9f2814fafc14cca980fd8e1bfbc0fbc75cf1d9bac',
    'supabase/migrations/20261013210000_guard_demo_cleanup_tenant_graph.sql': '59d7aa84e5cdcfe94d2e34ac5c8c78e0aa68d65e5168178836ba44a9dfe2c1fe',
}
PREIMAGES = {
    'public._seed_demo_limpiar_financiero()': {'70678912656ae05edf2600438ec6a53c70da8e4be57813892f063e9c67efeaeb','cf4d573fc61a6010650c0bae7275e11f4253d32dc0f8e71813ed4b1b9150a917'},
    'public.seed_demo_organization_core()': {'860253905d70567ca445d248001dabd82de97e360aac039bbab820298913eb67'},
    'public.seed_demo_organization()': {'afcaceaa7b93826d5c447750c0bc44b01525d005b531e14ee07279053bd29183','19b1029755c6310d637f7e6045ba0a82c2df13f08ee98e17c6e43749e9607812'},
    'public.seed_demo_organization_guarded(bigint)': {'7d139b609da7020fd178744dda6a48a13de331d21b6c29d0c31f6c39a255f3b7'},
}
spec = importlib.util.spec_from_file_location('demo_guard_prefreeze_original', HERE/'concurrency.py')
m = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = m
spec.loader.exec_module(m)
require = m.require
CONTEXT_SQL = """SELECT jsonb_build_object('database',current_database(),'current_user',current_user,
 'session_user',session_user,'server_addr',inet_server_addr(),
 'owner',(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()));"""
ROUTES_SQL = """SELECT jsonb_build_object('routes',jsonb_agg(jsonb_build_object(
 'signature',p.oid::regprocedure::text,'body',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,
 'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'acl',p.proacl) ORDER BY p.proname))
 FROM pg_proc p WHERE p.oid IN ('public._seed_demo_limpiar_financiero()'::regprocedure,
 'public.seed_demo_organization_core()'::regprocedure,'public.seed_demo_organization()'::regprocedure,
 'public.seed_demo_organization_guarded(bigint)'::regprocedure);"""


def verify_sources():
    for path, digest in {**SUITES, **SOURCES}.items():
        require(hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == digest, 'Historical source drift: '+path)
    for path in SUITES:
        data = (ROOT/path).read_text()
        require(re.search(r'^BEGIN;$', data, re.M) and re.search(r'^ROLLBACK;$', data, re.M)
                and not re.search(r'^COMMIT;', data, re.M), 'Historical suite must remain rollback-only')
    # Original verify_source also verifies the exact graph. Its canonical mirror
    # now describes the final release, so provide a file-only historical view.
    # These bytes are never sent to PostgreSQL as an installer.
    with tempfile.TemporaryDirectory(prefix='demo-prefreeze-source-') as name:
        root = Path(name)
        original = (ROOT/m.MIGRATION).read_bytes()
        for path in (m.MIGRATION, 'supabase/schema/security/seed_demo_organization_guarded.sql'):
            target = root/path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(original)
        m.verify_source(root)


def verify_routes(result):
    rows = result.get('routes')
    require(isinstance(rows, list) and len(rows) == 4, 'Four pre-freeze routes required')
    seen = set()
    for row in rows:
        signature = row['signature']
        if not signature.startswith('public.'):
            signature = 'public.'+signature
        require(signature in PREIMAGES and signature not in seen and row['body'] in PREIMAGES[signature],
                'Original pre-freeze function body required: '+signature)
        seen.add(signature)
        acl = ['postgres=X/postgres','service_role=X/postgres']
        if signature == 'public.seed_demo_organization()':
            acl.append('authenticated=X/postgres')
        config = ['search_path=public']+(['row_security=off'] if signature.endswith('_guarded(bigint)') else [])
        require(row['owner'] == 'postgres' and row['definer'] is True and row['language'] == 'plpgsql'
                and row['config'] == config and sorted(row['acl']) == sorted(acl), 'Historical security drift: '+signature)
    return rows


def clone_identity_sql(name):
    return ("SELECT jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object("
            "'oid',oid::bigint,'owner',pg_get_userbyid(datdba))),'[]'::jsonb)) "
            "FROM pg_database WHERE datname="+m.literal(name)+';')


def main():
    require(len(sys.argv) == 1, 'No alternate phase, suite or connection arguments accepted')
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('ISOLATED_QA_DB') == '1'
            and os.environ.get('DEMO_PREFREEZE_CI') == '1' and os.environ.get('DEMO_GUARD_DISPOSABLE') == '1',
            'Explicit pre-forward disposable Actions opt-in required')
    container = os.environ.get('DEMO_GUARD_POSTGRES_SERVICE_ID','')
    require(re.fullmatch(r'[a-f0-9]{64}', container) is not None, 'Exact Actions service ID required')
    require(os.environ.get('POSTGRES_IMAGE') == PIN, 'Unexpected service image pin')
    require(not any(os.environ.get(k) for k in ('DATABASE_URL','SUPABASE_DB_URL','PGSERVICE','PGSERVICEFILE','PGHOSTADDR')),
            'Ambient remote/database routing refused')
    verify_sources()
    out = ROOT/'reports/demo-guard-prefreeze'
    require(not out.exists(), 'Pre-forward checkpoint/evidence must execute exactly once')
    out.mkdir(parents=True)
    record = {'schemaVersion':1,'phase':'pre-forward','beforeMigration':FORWARD,'status':'running',
              'container_id':container,'service_image':PIN,'sourcePreserved':False,'runtime_tested':False,
              'checkpoint':{'executions':0,'created':False,'dropped':False},'cloneRuns':[],
              'files':[{'path':p,'sha256':h,'status':'pending','exitCode':None,'executions':0,'durationMs':0} for p,h in SUITES.items()],
              'concurrency':{'path':'scripts/ci/demo-guard/concurrency.py','sha256':SOURCES['scripts/ci/demo-guard/concurrency.py'],
                             'status':'pending','exitCode':None,'executions':0,'durationMs':0}}
    def save():
        (out/'actions-result.json').write_text(json.dumps(record,indent=2)+'\n')
    save()
    signal.signal(signal.SIGTERM, lambda signum, frame: (_ for _ in ()).throw(KeyboardInterrupt('Interrupted '+str(signum))))
    with tempfile.TemporaryDirectory(prefix='demo-prefreeze-docker-') as config:
        env = {'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C','LC_ALL':'C',
               'DOCKER_HOST':'unix:///var/run/docker.sock','DOCKER_CONFIG':config}
        def inspect():
            p = subprocess.run(['docker','inspect',container],env=env,text=True,capture_output=True,timeout=15,check=True)
            items = json.loads(p.stdout)
            require(len(items)==1 and items[0]['Id']==container and items[0]['State']['Running'] is True
                    and items[0]['Config']['Image']==PIN, 'Service identity/state/image changed')
        inspect()
        commit = subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,env=env,text=True,capture_output=True,timeout=10,check=True).stdout.strip()
        require(re.fullmatch(r'[a-f0-9]{40}',commit) is not None,'Invalid checked-out source commit')
        record['sha'] = commit
        allowed = {'template1','postgres'}
        def argv(database):
            require(database in allowed,'Unowned database command refused')
            return ['docker','exec','-i',container,'/usr/bin/env','-i',
                    'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin','LANG=C','LC_ALL=C',
                    'PGHOST=/var/run/postgresql','PGUSER=postgres','PGPORT=5432','PGDATABASE='+database,
                    'PGCONNECT_TIMEOUT=5','PGPASSFILE=/tmp/demo-prefreeze-nonexistent.pgpass',
                    'psql','-X','-w','-A','-t','-q','-v','ON_ERROR_STOP=1']
        def query(database,sql,label,timeout=30):
            inspect()
            p = subprocess.run(argv(database),env=env,input=sql,text=True,capture_output=True,timeout=timeout)
            (out/(label+'.stdout.log')).write_text(p.stdout)
            (out/(label+'.stderr.log')).write_text(p.stderr)
            require(p.returncode==0 and not re.search(r'(^|\n)(WARNING|ERROR|FATAL):',p.stderr),label+': '+p.stderr)
            return p.stdout
        def context(database,path):
            return m.Context(argv(database),env,path,database,commit)
        def verify_database(database,label):
            row = m.one_json(query(database,CONTEXT_SQL,label+'-context'),label+'-context')
            require(row == {'database':database,'current_user':'postgres','session_user':'postgres','server_addr':None,'owner':'postgres'},
                    'Owned local-socket database context required')
            return verify_routes(m.one_json(query(database,ROUTES_SQL,label+'-routes'),label+'-routes'))
        def create(item,template,label):
            name = item['database']
            require(template in allowed and name in allowed and name not in ('postgres','template1'), 'Unowned clone creation refused')
            require(query('template1',"SELECT count(*) FROM pg_database WHERE datname="+m.literal(name)+';',label+'-absent').strip()=='0',
                    'Generated database already exists; refusing ownership')
            item['creationAttempted'] = True
            query('template1','CREATE DATABASE '+name+' TEMPLATE '+template+';',label+'-create')
            item['created'] = True
            item['oid'] = int(query('template1',"SELECT oid FROM pg_database WHERE datname="+m.literal(name)+';',label+'-oid').strip())
            save()
        def drop(item,label):
            if not item.get('creationAttempted'):
                return
            name = item['database']
            require(name in allowed and name not in ('postgres','template1'), 'Unowned teardown refused')
            rows = m.one_json(query('template1',clone_identity_sql(name),label+'-owner'),label+'-owner')['rows']
            if m.owned_clone_present(rows,item.get('oid')):
                query('template1','DROP DATABASE '+name+';',label+'-drop')
                require(query('template1',"SELECT count(*) FROM pg_database WHERE datname="+m.literal(name)+';',label+'-absence').strip()=='0',
                        'Owned database remains after DROP')
            item['dropped'] = True
            save()
        source_context = context('postgres',out)
        record['originalFunctions'] = verify_database('postgres','source-before')
        source_before = m.fingerprint(source_context)
        (out/'source-fingerprint-before.json').write_text(json.dumps(source_before,indent=2)+'\n')
        checkpoint = record['checkpoint']
        checkpoint['database'] = 'demo_guard_checkpoint_'+uuid.uuid4().hex
        allowed.add(checkpoint['database'])
        try:
            checkpoint['executions'] = 1
            create(checkpoint,'postgres','checkpoint')
            verify_database(checkpoint['database'],'checkpoint-before')
            checkpoint_context = context(checkpoint['database'],out)
            checkpoint_before = m.fingerprint(checkpoint_context)
            (out/'checkpoint-fingerprint-before.json').write_text(json.dumps(checkpoint_before,indent=2)+'\n')
            for iteration in (1,2):
                item = {'database':'demo_guard_race_'+uuid.uuid4().hex,'status':'running','created':False,'dropped':False}
                allowed.add(item['database']);record['cloneRuns'].append(item);save()
                try:
                    create(item,checkpoint['database'],f'clone-{iteration}')
                    verify_database(item['database'],f'clone-{iteration}-before')
                    ctx = context(item['database'],out/f'run-{iteration}')
                    before = m.fingerprint(ctx)
                    record['runtime_tested'] = True
                    for suite in record['files']:
                        started = time.monotonic()
                        data = (ROOT/suite['path']).read_text()
                        query(item['database'],data,f'run-{iteration}-'+Path(suite['path']).stem,timeout=180)
                        require(m.fingerprint(ctx)==before,'Historical suite did not restore clone data/schema/security')
                        suite.update(status='passed',exitCode=0,executions=suite['executions']+1,
                                     durationMs=suite['durationMs']+int((time.monotonic()-started)*1000))
                        save()
                    started = time.monotonic()
                    inspect()
                    result = m.run_concurrency(context(item['database'],out/f'run-{iteration}'/'concurrency'))
                    require(result['status']=='pass' and len(result['cases'])==2 and all(x['status']=='pass' for x in result['cases']),
                            'Original lock/55P03 concurrency positives required')
                    require(m.fingerprint(ctx)==before,'Original concurrency did not restore clone data/schema/security')
                    c = record['concurrency']
                    c.update(status='passed',exitCode=0,executions=c['executions']+1,durationMs=c['durationMs']+int((time.monotonic()-started)*1000))
                    item['status'] = 'passed';save()
                finally:
                    drop(item,f'clone-{iteration}-cleanup')
            require(m.fingerprint(checkpoint_context)==checkpoint_before,'Pre-freeze checkpoint was modified')
            (out/'checkpoint-fingerprint-after.json').write_text(json.dumps(checkpoint_before,indent=2)+'\n')
            require(all(x['executions']==2 and x['status']=='passed' for x in record['files']) and record['concurrency']['executions']==2,
                    'Two complete positive historical executions required')
            record['status'] = 'passed'
        except BaseException as error:
            record.update(status='failed',error_type=type(error).__name__,error=str(error))
            raise
        finally:
            try:
                drop(checkpoint,'checkpoint-cleanup')
                source_after = m.fingerprint(source_context)
                (out/'source-fingerprint-after.json').write_text(json.dumps(source_after,indent=2)+'\n')
                require(source_after==source_before,'Source app rows/schema/security changed at pre-forward checkpoint')
                verify_database('postgres','source-after')
                record['sourcePreserved'] = True
            except BaseException as error:
                record.update(status='failed',sourcePreserved=False,cleanup_error=str(error))
                raise
            finally:
                save()
    print(json.dumps({'status':record['status'],'checkpoint_count':1,'historical_suites':4,'executions_per_suite':2,'concurrency_runs':2}))


if __name__ == '__main__':
    main()
