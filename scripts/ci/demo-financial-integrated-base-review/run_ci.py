#!/usr/bin/env python3
"""Revalidate the exact reviewed integrated main without rewriting historical lanes."""
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
sys.dont_write_bytecode = True
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE='326d981b9d98cae405c42158b66a3960cfe75bd3'
PRIOR_BASE='b66d2c2caa00d7a8d522ed7140b6a15877a0b2aa'
PRIOR_HEAD='3d912148da1fd9b04dceb46b2eb948d99475ebe6'
MAIN_MERGE='55e926484e3ba431ed207530c658d866494e032d'
AUTHOR='a7aff9ff8f92852687c56d3bc05d41150b44b2ae'
BRANCH='codex/demo-financial-behavior-recovery-20261015'
REPOSITORY='jfcaicedoobando-arch/elogistix'
LANES=('author','review-v2','supplement')
BEHAVIOR=ROOT/'scripts/ci/demo-financial-behavior-recovery'
NEGATIVE=ROOT/'scripts/ci/demo-financial-retry-negative-runner'

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
    require(pr['base']['ref']=='main' and pr['base']['sha']==BASE,'Exact reviewed integrated main required')
    require(re.fullmatch('[0-9a-f]{40}',head) and head==pr['head']['sha'],'Exact checkout required')

def verify_inputs(nm):
    frozen=nm.inventory(HERE,json.loads((HERE/'inputs.json').read_text()))
    require({p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()}==set(frozen)|{'inputs.json'},'Incomplete integration inventory')
    require(not any(p.is_symlink() for p in HERE.rglob('*')),'Symlink member')
    pins=json.loads(frozen['source-pins.json'])
    require(pins['reviewed_main']==BASE and pins['prior_accepted_head']==PRIOR_HEAD and pins['prior_accepted_base']==PRIOR_BASE
            and pins['main_merge_commit']==MAIN_MERGE and pins['author_fix_head']==AUTHOR,'Integration provenance differs')
    historical=nm.inventory(ROOT,pins['historical_files'])
    require(len(historical)==92,'Exact92 historical source files required')
    reviewed=nm.inventory(ROOT,pins['reviewed_main_files'])
    require(len(reviewed)==12,'Exact12 reviewed main changes required')
    surface=nm.inventory(ROOT,pins['ci_surface'])
    require(set(surface)=={'.gitleaks.toml','scripts/ci/test_gitleaks_snapshot.py'},'Exact reviewed scanner surface required')
    workflows=nm.inventory(ROOT,pins['workflows'])
    require(set(workflows)=={'.github/workflows/demo-financial-behavior-recovery.yml','.github/workflows/demo-financial-retry-negative-review.yml'},'Exact integrated workflows required')
    return frozen,pins

def verify_historical_modules(bm,nm):
    # The old entry points remain correctly closed to base b66. Do not change
    # globals, replace their gate or fabricate an event to pass an obsolete gate.
    require(bm.EVENT_BASE==PRIOR_BASE and bm.BRANCH==BRANCH and nm.AUTHOR==AUTHOR,'Historical module metadata changed')

def selected_cases(provider,lane,nm):
    require(lane in ('review-v2','supplement'),'Native provider lane required')
    ids=tuple(c['id'] for c in provider.CASES)
    if lane=='review-v2':
        require(ids==nm.CASE_IDS and provider.PROVIDER_VERSION==2,'Exact nine version2 cases required')
        return list(provider.CASES)
    require(ids==nm.SUPPLEMENT_CASE_IDS,'Exact three supplemental cases required')
    return [*provider.CASES,{'id':nm.SEQUENCE_CONTROL_ID,'phase':'materialized','rejection_stage':'calibration'}]

def accepted(results,expected_ids,key):
    return bool(expected_ids) and [r.get(key) for r in results]==list(expected_ids) and all(r.get('status')=='PASS' and r.get('cleanup_verified') is True for r in results)

def run(output,lane):
    require(os.environ.get('GITHUB_ACTIONS')=='true','Actions only; local SQL/Docker forbidden')
    require(lane in LANES,'Unknown integration lane')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    gate(event,os.environ,head)
    for ancestor in (BASE,MAIN_MERGE,PRIOR_HEAD):
        require(subprocess.run(['git','merge-base','--is-ancestor',ancestor,head],cwd=ROOT,capture_output=True).returncode==0,'Integrated ancestry missing')
    nm=module('integrated_negative',NEGATIVE/'run_ci.py');frozen,pins=verify_inputs(nm)
    bm=module('integrated_author',BEHAVIOR/'run_ci.py');verify_historical_modules(bm,nm)
    nm.verify_inputs();bf,bp=bm.verify_inputs();cm=module('integrated_compile',bm.COMPILE/'run_ci.py');cf=cm.verify_inputs()
    require(sha(bm.file_bytes(bm.INFRA))==bm.INFRA_SHA,'Golden infrastructure changed');infra=module('integrated_golden',bm.INFRA)
    catalog=module('integrated_catalog',bm.COMPILE/'catalog.py');baseline=subprocess.check_output(['git','show',head+':supabase/schema/baseline.sql'],cwd=ROOT)
    bundle=catalog.build_catalog(baseline);require(sha(bundle.catalog_sql)==bp['catalog_sha256'] and sha(bundle.validation_sql)==bp['validation_sha256'],'Exact catalog differs')
    variant,variant_evidence=bm.laboratory_manifest(cf['upstream/flow/sql/02-manifest.sql']);correction,correction_evidence=bm.correction_input(bf,cf)
    output=Path(output);output.mkdir(parents=True,exist_ok=False);public=output/'public';public.mkdir()
    summary={'scope':'EXACT_INTEGRATED_MAIN_SYNTHETIC_REVALIDATION_ONLY','status':'FAIL','lane':lane,'workflow_commit':head,'event_base':BASE,
             'main_merge_commit':MAIN_MERGE,'prior_accepted_head':PRIOR_HEAD,'prior_accepted_base':PRIOR_BASE,'author_fix_head':AUTHOR,
             'historical_sources_unchanged':'PASS','historical_file_count':92,'reviewed_main_file_count':12,'integrated_ancestry':'PASS',
             'source_inventory_sha256':sha(frozen['source-pins.json']),'catalog_sha256':sha(bundle.catalog_sql),'validation_sha256':sha(bundle.validation_sql),
             'cases':[],'complete':False,'canonical_closure_complete':False,'fixtures_complete':False,'business_commit':'NOT_RUN','sequence_rollback':'NOT_ESTABLISHED',
             'real_identity':'NOT_RUN','runtime_acl_rls':'NOT_RUN','operational_wire':'UNBOUND','configuration':'EMPTY','demo':'DISABLED','live_database_actions':0,
             'limits':['Integrated base acceptance requires fresh native suites; prior PASS is not inferred for this base','All rows/roles/grants are synthetic in disposable network-none clusters; no real issuer, identity or ACL acceptance','Rollback and separate sequence observations do not prove business COMMIT, sequence rollback, crash durability or physical HTTP continuity','PR359 acceptance remains its own head99/eventbase616; future integration revalidation is separate']}
    for name,value in [('catalog-manifest',bundle.manifest),('laboratory-manifest-variant',variant_evidence),('proposed-retry-correction',correction_evidence)]:
        (public/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
    def save():(public/'result.json').write_text(json.dumps(summary,indent=2)+'\n')
    save()
    if lane=='author':
        expected=bm.SUITES;key='suite'
        for suite in expected:
            if summary['cases'] and not bm.fault_probes_allowed(summary['cases'][0]):
                summary['cases'].append({'suite':suite,'status':'NOT_RUN','cleanup_verified':False,'reason':'materialization/deferred prerequisite failed'})
            else:summary['cases'].append(bm.run_case(output/suite,suite,bf,cf,bundle,cm,infra,variant,'retry-corrected',correction))
            save()
    else:
        provider=module('integrated_native_provider',nm.REVIEW/('suite_v2.py' if lane=='review-v2' else 'supplemental_suite.py'))
        cases=selected_cases(provider,lane,nm);expected=tuple(c['id'] for c in cases);key='case_id'
        for case in cases:
            summary['cases'].append(nm.run_case(output/case['id'],case,provider,bm,cm,infra,bundle,cf,bf,variant,correction));save()
    verify_historical_modules(bm,nm)
    summary['status']='PASS_INTEGRATED_BASE_SYNTHETIC_'+{'author':'AUTHOR_ROLLBACK_ONLY','review-v2':'REVIEW_V2_ROLLBACK_ONLY','supplement':'SUPPLEMENT_ONLY'}[lane] if accepted(summary['cases'],expected,key) else 'FAIL'
    save();print(json.dumps(summary));require(summary['status'].startswith('PASS_'),'Integrated native assertions or cleanup incomplete')
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--lane',choices=LANES,required=True);args=parser.parse_args()
    def interrupted(number,frame):raise RuntimeError('Interrupted by signal '+str(number))
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,interrupted)
    run(args.output,args.lane)

if __name__=='__main__':main()
