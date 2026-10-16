#!/usr/bin/env python3
"""Run in the existing RLS Actions service BEFORE _ci_post_migrate.sql.

No service discovery, image pulling, new containers, remote Docker, connection
URLs, or source-database DML. The workflow passes its exact service container ID.
"""
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import uuid

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
PIN='postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae'
spec=importlib.util.spec_from_file_location('demo_guard_race',HERE/'concurrency.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
require=m.require


def clone_identity_sql(name):
    # PostgreSQL JSON encodes the oid type as a string. Project to bigint so
    # the wire value is numeric and preserves the strict integer/OID predicate.
    return ("SELECT jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object("
            "'oid',oid::bigint,'owner',pg_get_userbyid(datdba))),'[]'::jsonb)) "
            "FROM pg_database WHERE datname=" + m.literal(name) + ';')



def run_disabled_matrix(context):
    """Effective release contract: real blocked functions, no core/helper stubs."""
    context.evidence_dir.mkdir(parents=True)
    sql=(ROOT/'supabase/tests/rls/test_rls_demo_seed_disabled.sql').read_text()
    require('CREATE OR REPLACE FUNCTION public.' not in sql,'Never replace protected routes in tests')
    (context.evidence_dir/'matrix.sql').write_text(sql)
    stdout,stderr=context.query(sql,'disabled-real-four-routes',timeout=120)
    (context.evidence_dir/'stdout.log').write_text(stdout)
    (context.evidence_dir/'stderr.log').write_text(stderr)
    rows=[json.loads(line) for line in stdout.splitlines() if line.startswith('{')]
    result=rows[-1] if rows else {}
    require(result.get('calls')==45 and result.get('attempted_DML')==0 and result.get('routes')==4
      and result.get('core_or_helper_stubbed') is False,'All 45 explicit blocks and zero DML are mandatory')
    return {'status':'pass','contract':'disabled-release','result':result}


def run_persisted_matrix(context):
    """Commit fixtures/rejections, then verify from an independent connection."""
    spec=importlib.util.spec_from_file_location('demo_disabled_persisted',HERE/'persisted-disabled.py')
    module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)
    result=module.run_persisted(context)
    require(result.get('status')=='pass','Persisted three-connection verification must pass')
    return result


def main():
    require(os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('ISOLATED_QA_DB')=='1'
            and os.environ.get('DEMO_GUARD_DISPOSABLE')=='1','Explicit isolated GitHub Actions service required')
    container=os.environ.get('DEMO_GUARD_POSTGRES_SERVICE_ID','')
    require(re.fullmatch(r'[a-f0-9]{64}',container) is not None,'Exact Actions service container ID required')
    require(os.environ.get('POSTGRES_IMAGE')==PIN,'Unexpected service image pin')
    require(not any(os.environ.get(k) for k in ('DATABASE_URL','SUPABASE_DB_URL','PGSERVICE','PGSERVICEFILE','PGHOSTADDR')),
            'Ambient remote/database routing refused')
    expected_source='0265f9e21ae1063b60ea8954d478989aa4543e4c4b3ee8351f07ea3e931897a0'
    require(__import__('hashlib').sha256((ROOT/'supabase/schema/security/seed_demo_organization_guarded.sql').read_bytes()).hexdigest()==expected_source,'Disabled guard source drift')
    out=ROOT/'reports/demo-guard-concurrency'
    require(not out.exists(),'Fresh evidence directory required')
    out.mkdir(parents=True)
    record={'status':'preflight','container_id':container,'service_image':PIN,'source_mutated':False,
            'clone_runs':[],'runtime_tested':False}
    def save(): (out/'actions-result.json').write_text(json.dumps(record,indent=2)+'\n')
    save()
    def interrupted(signum,frame): raise KeyboardInterrupt('Interrupted '+str(signum))
    signal.signal(signal.SIGTERM,interrupted)
    with tempfile.TemporaryDirectory(prefix='demo-guard-docker-') as config:
        env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C','LC_ALL':'C',
             'DOCKER_HOST':'unix:///var/run/docker.sock','DOCKER_CONFIG':config}
        def inspect():
            p=subprocess.run(['docker','inspect',container],env=env,text=True,capture_output=True,timeout=15,check=True)
            items=json.loads(p.stdout)
            require(len(items)==1 and items[0]['Id']==container and items[0]['State']['Running'] is True
                    and items[0]['Config']['Image']==PIN,'Service identity/image changed')
            return items[0]
        inspect()
        # CI checkout has no credentials; this is read-only source identification.
        commit=subprocess.run(['git','rev-parse','HEAD'],cwd=ROOT,env=env,text=True,capture_output=True,timeout=10,check=True).stdout.strip()
        require(re.fullmatch(r'[a-f0-9]{40}',commit) is not None,'Invalid checked-out source commit')
        record['source_commit']=commit
        allowed={'template1','postgres'}
        def argv(database):
            require(database in allowed,'Unowned database command refused')
            return ['docker','exec','-i',container,'/usr/bin/env','-i',
                    'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin','LANG=C','LC_ALL=C',
                    'PGHOST=/var/run/postgresql','PGUSER=postgres','PGPORT=5432','PGDATABASE='+database,
                    'PGCONNECT_TIMEOUT=5','PGPASSFILE=/tmp/demo-guard-nonexistent.pgpass',
                    'psql','-X','-w','-A','-t','-q','-v','ON_ERROR_STOP=1']
        def query(database,sql,label):
            p=subprocess.run(argv(database),env=env,input=sql,text=True,capture_output=True,timeout=30)
            (out/(label+'.stdout.log')).write_text(p.stdout)
            (out/(label+'.stderr.log')).write_text(p.stderr)
            require(p.returncode==0 and not re.search(r'(^|\n)(WARNING|ERROR|FATAL):',p.stderr),label+': '+p.stderr)
            return p.stdout
        fingerprint_sql="SELECT jsonb_build_object('body',md5(prosrc),'metadata',md5(to_jsonb(p)::text)) FROM pg_proc p WHERE oid='public.seed_demo_organization_guarded(bigint)'::regprocedure;"
        baseline=m.one_json(query('postgres',fingerprint_sql,'source-before'),'source-before')
        require(baseline['body']=='d008dcf3ccc43874c0c9aaa5a9a89c09','Reviewed demo guard migration postimage is not applied')
        record['source_function']=baseline
        source_context=m.Context(argv('postgres'),env,out,'postgres',commit)
        source_before=m.fingerprint(source_context)
        (out/'source-fingerprint-before.json').write_text(json.dumps(source_before,indent=2)+'\n')
        try:
            for iteration in (1,2):
                name='demo_guard_race_'+uuid.uuid4().hex
                allowed.add(name)
                item={'iteration':iteration,'database':name,'status':'running','created':False,'dropped':False}
                record['clone_runs'].append(item);save()
                created_oid=None
                creation_attempted=False
                try:
                    inspect()
                    # Control connection uses template1 so source postgres has no
                    # connection opened by this adapter during template cloning.
                    absent=query('template1',"SELECT count(*) FROM pg_database WHERE datname="+m.literal(name)+';',f'clone-{iteration}-preexisting').strip()
                    require(absent=='0','Generated clone name already exists; refusing ownership')
                    creation_attempted=True
                    query('template1','CREATE DATABASE '+name+' TEMPLATE postgres;',f'clone-{iteration}-create')
                    item['created']=True
                    created_oid=int(query('template1',"SELECT oid FROM pg_database WHERE datname="+m.literal(name)+';',f'clone-{iteration}-oid').strip())
                    item['oid']=created_oid
                    record.update(status='running',runtime_tested=True);save()
                    context=m.Context(argv(name),env,out/f'run-{iteration}',name,commit)
                    result=run_disabled_matrix(context)
                    item['persisted']=run_persisted_matrix(context)
                    item['status']=result['status']
                finally:
                    # Only the random name allocated above is eligible for
                    # teardown. An uncertain CREATE is reconciled, never retried.
                    if creation_attempted:
                        inspect()
                        row=m.one_json(query('template1',clone_identity_sql(name),f'clone-{iteration}-cleanup-owner'),'cleanup-owner')['rows']
                        if m.owned_clone_present(row,created_oid):
                            query('template1','DROP DATABASE '+name+';',f'clone-{iteration}-drop')
                            remaining=query('template1',"SELECT count(*) FROM pg_database WHERE datname="+m.literal(name)+';',f'clone-{iteration}-absence').strip()
                            require(remaining=='0','Clone remains after DROP')
                        item['dropped']=True
                        save()
            after=m.one_json(query('postgres',fingerprint_sql,'source-after'),'source-after')
            require(after==baseline,'Source function metadata changed during isolated tests')
            require(len(record['clone_runs'])==2 and all(x['status']=='pass' and x['dropped'] for x in record['clone_runs']),
                    'Both fresh-clone runs must pass and be removed')
            record['status']='pass'
        except BaseException as error:
            record.update(status='fail',error_type=type(error).__name__,error=str(error))
            raise
        finally:
            try:
                source_after=m.fingerprint(source_context)
                (out/'source-fingerprint-after.json').write_text(json.dumps(source_after,indent=2)+'\n')
                require(source_before==source_after,'Source app rows/schema/security changed')
                record['source_preserved']=True
            except BaseException as error:
                record.update(status='fail',source_preserved=False,source_verification_error=str(error))
                raise
            finally: save()
    print(json.dumps({'status':record['status'],'fresh_clone_runs':2,'cases_per_run':2,'clones_removed':True}))


if __name__=='__main__':main()
