#!/usr/bin/env python3
"""Exact mainECC revalidation of the frozen head99 synthetic COMMIT proposal."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE='ecc53750c5d920d898ca2b00a2f717371dc19cf5'
PRIOR_HEAD='99cd0f6ee9db3a83fa1eb90e2828db4eb4713021'
PRIOR_BASE='616bff8d454f9de35b6590913d08b7ad0d69b049'
MAIN_MERGE='1c8e5437ede1279b490318fac9814fde65cfd504'
AUTHOR='a7aff9ff8f92852687c56d3bc05d41150b44b2ae'
BRANCH='codex/demo-financial-commit-review-20261015'
REPOSITORY='jfcaicedoobando-arch/elogistix'
WORKFLOW='.github/workflows/demo-financial-commit-review.yml'
COMMIT=ROOT/'scripts/ci/demo-financial-commit-review'
BEHAVIOR=ROOT/'scripts/ci/demo-financial-behavior-recovery'
CASES=('original_invoker','proposed_definer','proposed_revoked')

def require(value,message):
    if not value:raise RuntimeError(message)

def sha(body):return hashlib.sha256(body).hexdigest()

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);sys.modules[name]=value;spec.loader.exec_module(value)
    return value

def gate(event,env,head):
    require(env.get('GITHUB_ACTIONS')=='true','Actions only; local SQL/Docker forbidden')
    require(env.get('GITHUB_EVENT_NAME')=='pull_request' and env.get('GITHUB_REPOSITORY')==REPOSITORY,'Owned PR event required')
    require(event['action'] in ('opened','synchronize','reopened') and event['repository']['full_name']==REPOSITORY,'Event mismatch')
    pr=event['pull_request']
    for side in ('base','head'):
        require(pr[side]['repo']['full_name']==REPOSITORY and pr[side]['repo']['owner']['login']=='jfcaicedoobando-arch','Foreign repository')
    require(pr['draft'] is True and pr['head']['ref']==BRANCH,'Exact draft branch required')
    require(pr['base']['ref']=='main' and pr['base']['sha']==BASE,'Exact reviewed mainECC required')
    require(re.fullmatch('[0-9a-f]{40}',head) and head==pr['head']['sha'],'Exact checkout required')

def verify_inputs(bm):
    frozen=bm.inventory(HERE,json.loads((HERE/'inputs.json').read_text()))
    require({p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()}==set(frozen)|{'inputs.json'},'Incomplete integration inventory')
    require(not any(p.is_symlink() for p in HERE.rglob('*')),'Symlink member')
    pins=json.loads(frozen['source-pins.json'])
    require(pins['reviewed_main']==BASE and pins['prior_accepted_head']==PRIOR_HEAD and pins['prior_accepted_base']==PRIOR_BASE
            and pins['main_merge_commit']==MAIN_MERGE and pins['author_fix_head']==AUTHOR,'Integration provenance differs')
    old=bm.inventory(ROOT,pins['historical_files']);require(len(old)==73,'Exact73 historical sources required')
    current=bm.inventory(ROOT,pins['main_surface']);require(len(current)==6,'Exact6 main CI surfaces required')
    workflow=bm.inventory(ROOT,pins['workflow']);require(set(workflow)=={WORKFLOW},'Exact integrated COMMIT workflow required')
    return frozen,pins

def verify_historical_modules(cp,bm):
    require(cp.EVENT_BASE==PRIOR_BASE and cp.BASE_BRANCH=='codex/demo-financial-behavior-recovery-20261015'
            and cp.BRANCH==BRANCH and cp.AUTHOR==AUTHOR and cp.CASES==CASES
            and bm.EVENT_BASE=='b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa','Historical module metadata changed')

def validate_added_paths(changes,expected_paths):
    require(bool(expected_paths) and len(set(expected_paths))==len(expected_paths),'Invalid owned addition census')
    require(len(changes)==len(expected_paths) and all(status=='A' for status,path in changes),'Main files modified/deleted/renamed')
    actual=[path for status,path in changes]
    require(len(set(actual))==len(actual) and set(actual)==set(expected_paths),'Unexpected integrated diff')

def accepted(results):
    return [r.get('case_id') for r in results]==list(CASES) and all(r.get('status')=='PASS' and r.get('cleanup_verified') is True for r in results)

def run(output):
    require(os.environ.get('GITHUB_ACTIONS')=='true','Actions only; local SQL/Docker forbidden')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    gate(event,os.environ,head)
    for ancestor in (BASE,MAIN_MERGE,PRIOR_HEAD):
        require(subprocess.run(['git','merge-base','--is-ancestor',ancestor,head],cwd=ROOT,capture_output=True).returncode==0,'Integrated ancestry missing')
    bm=module('commit_integrated_author',BEHAVIOR/'run_ci.py');frozen,pins=verify_inputs(bm)
    cp=module('commit_integrated_frozen',COMMIT/'run_ci.py');verify_historical_modules(cp,bm)
    old=cp.verify_inputs(bm);bf,bp=bm.verify_inputs();cm=module('commit_integrated_compile',bm.COMPILE/'run_ci.py');cf=cm.verify_inputs()
    expected=[r['path'] for r in pins['historical_files'] if r['path'].startswith(COMMIT.relative_to(ROOT).as_posix()+'/')]
    expected += [HERE.relative_to(ROOT).as_posix()+'/'+p for p in (*frozen,'inputs.json')]+[WORKFLOW]
    raw=subprocess.check_output(['git','diff','--name-status','-z',BASE,head],cwd=ROOT).decode().split('\0');require(raw.pop()=='' and len(raw)%2==0,'Malformed integrated diff')
    validate_added_paths(list(zip(raw[::2],raw[1::2])),expected)
    require(len(expected)==21,'Exact21 owned additions required')
    require(sha(bm.file_bytes(bm.INFRA))==bm.INFRA_SHA,'Golden infrastructure changed');infra=module('commit_integrated_golden',bm.INFRA)
    catalog=module('commit_integrated_catalog',bm.COMPILE/'catalog.py');baseline=subprocess.check_output(['git','show',head+':supabase/schema/baseline.sql'],cwd=ROOT)
    bundle=catalog.build_catalog(baseline);require(sha(bundle.catalog_sql)==bp['catalog_sha256'] and sha(bundle.validation_sql)==bp['validation_sha256'],'Exact catalog differs')
    variant,variant_evidence=bm.laboratory_manifest(cf['upstream/flow/sql/02-manifest.sql']);correction,correction_evidence=bm.correction_input(bf,cf)
    output=Path(output);output.mkdir(parents=True,exist_ok=False);public=output/'public';public.mkdir()
    summary={'scope':'EXACT_INTEGRATED_MAIN_SYNTHETIC_COMMIT_PROPOSAL_ONLY','status':'FAIL','workflow_commit':head,'event_base':BASE,
             'main_merge_commit':MAIN_MERGE,'prior_accepted_head':PRIOR_HEAD,'prior_accepted_base':PRIOR_BASE,'author_fix_head':AUTHOR,
             'historical_sources_unchanged':'PASS','historical_file_count':73,'main_surface_file_count':6,'integrated_ancestry':'PASS',
             'main_diff':'OWNED_ADDITIONS_ONLY','owned_added_file_count':21,'source_inventory_sha256':sha(frozen['source-pins.json']),
             'canonical_catalog_sha256':sha(bundle.catalog_sql),'validation_sha256':sha(bundle.validation_sql),'cases':[],
             'complete':False,'canonical_closure_complete':False,'fixtures_complete':False,'real_identity':'NOT_RUN','runtime_acl_rls':'NOT_RUN',
             'crash_wal_durability':'NOT_RUN','sequence_rollback':'NOT_ESTABLISHED','operational_wire':'UNBOUND','configuration':'EMPTY','demo':'DISABLED','live_database_actions':0,
             'limits':['Acceptance requires three fresh native cases for this exact integrated head/base; head99/base616 remains separate historical evidence',
                       'Successful business COMMIT requires the isolated SECURITY DEFINER descriptor proposal; original INVOKER failure is preserved',
                       'All roles/grants/rows are disposable synthetic fixtures; no real identity, issuer, ACL or HTTP driver acceptance',
                       'tmpfs/fsync-off does not certify crash/WAL durability; no real privilege changes, merge or deployment']}
    for name,value in [('catalog-manifest',bundle.manifest),('laboratory-manifest-variant',variant_evidence),('proposed-retry-correction',correction_evidence)]:
        (public/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
    def save():(public/'result.json').write_text(json.dumps(summary,indent=2)+'\n')
    save()
    for case in CASES:
        value=cp.run_case(output/case,case,bm,cm,infra,bundle,cf,bf,old,variant,correction)
        private=json.loads((output/case/'result.json').read_text())
        value['cleanup_evidence']={key:private.get(key) for key in ('cleanup','shutdown_confirmed','pg_status_3_and_no_pid','owned_psql_clients_closed')}
        value['cleanup_verified']=value['cleanup_verified'] is True and cp.cleanup_ok(private)
        summary['cases'].append(value);save()
    verify_historical_modules(cp,bm)
    summary['status']='PASS_INTEGRATED_MAIN_SYNTHETIC_COMMIT_PROPOSAL_ONLY' if accepted(summary['cases']) else 'FAIL'
    save();print(json.dumps(summary));require(summary['status'].startswith('PASS_'),'Integrated COMMIT evidence or owned cleanup incomplete')
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    def interrupted(number,frame):raise RuntimeError('Interrupted by signal '+str(number))
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,interrupted)
    run(args.output)

if __name__=='__main__':main()
