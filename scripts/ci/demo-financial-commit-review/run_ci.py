#!/usr/bin/env python3
"""Owned Actions-only real COMMIT probes in disposable synthetic PostgreSQL17.6."""
import argparse
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import uuid
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
BEHAVIOR = ROOT / 'scripts/ci/demo-financial-behavior-recovery'
AUTHOR = 'a7aff9ff8f92852687c56d3bc05d41150b44b2ae'
EVENT_BASE = '616bff8d454f9de35b6590913d08b7ad0d69b049'
BASE_BRANCH = 'codex/demo-financial-behavior-recovery-20261015'
BRANCH = 'codex/demo-financial-commit-review-20261015'
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
DATABASE = 'demo_financial_compile_recovery_lab'
CASES = ('original_invoker', 'proposed_definer', 'proposed_revoked')
GUARD_HASHES = {'authorize_issuance_deferred':'798520f64eb79590ed9976afff7927df7e9d5627e2a84bbdcf48caa1acf977e9',
                'authorize_deferred':'fe378f19b3b38ed1d50aa750db7cd7853a149f9789d3adf4b204018419bf4dc0'}
TRIGGERS = {'execution_authorized_deferred':('execution_receipts','authorize_issuance_deferred'),
            'demo_authorize_deferred':('receipts','authorize_deferred'),
            'demo_checkpoint_authorize_deferred':('seed_checkpoints','authorize_deferred')}

def require(value, message):
    if not value: raise RuntimeError(message)

def sha(body): return hashlib.sha256(body).hexdigest()

def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec)
    sys.modules[name] = result
    spec.loader.exec_module(result)
    return result

def gate(event, env, head):
    require(env.get('GITHUB_ACTIONS')=='true', 'Actions only; local SQL/Docker forbidden')
    require(env.get('GITHUB_EVENT_NAME')=='pull_request' and env.get('GITHUB_REPOSITORY')==REPOSITORY, 'Owned PR event required')
    require(event['action'] in ('opened','synchronize','reopened') and event['repository']['full_name']==REPOSITORY, 'Event mismatch')
    pr = event['pull_request']
    for side in ('base','head'):
        require(pr[side]['repo']['full_name']==REPOSITORY and pr[side]['repo']['owner']['login']=='jfcaicedoobando-arch', 'Foreign repository')
    require(pr['draft'] is True and pr['head']['ref']==BRANCH, 'Exact draft branch required')
    require(pr['base']['ref']==BASE_BRANCH and pr['base']['sha']==EVENT_BASE, 'Reviewed base changed; explicit review required')
    require(re.fullmatch('[0-9a-f]{40}',head) and head==pr['head']['sha'], 'Exact head required')

def verify_inputs(bm):
    frozen=bm.inventory(HERE,json.loads((HERE/'inputs.json').read_text()))
    require({p.relative_to(HERE).as_posix() for p in HERE.rglob('*') if p.is_file()}==set(frozen)|{'inputs.json'}, 'Incomplete lane inventory')
    require(not any(p.is_symlink() for p in HERE.rglob('*')), 'Symlink member')
    pins=json.loads(frozen['source-pins.json'])
    require(pins['author_fix_head']==AUTHOR and pins['reviewed_event_base']==EVENT_BASE, 'Wrong source provenance')
    external=bm.inventory(ROOT,pins['files'])
    require(len(external)==30 and set(external)=={p.relative_to(ROOT).as_posix() for p in BEHAVIOR.rglob('*') if p.is_file()}, 'Exact historical30 sources required')
    return frozen

def guard_sql():
    return b"""WITH wanted_fn(name) AS (VALUES ('authorize_issuance_deferred'),('authorize_deferred')),
functions AS (SELECT w.name,jsonb_build_object('owner',pg_get_userbyid(p.proowner),'metadata',to_jsonb(p)-'prosrc',
'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
'language',(SELECT lanname FROM pg_language WHERE oid=p.prolang),'return_type',p.prorettype::regtype::text,
'non_owner_execute',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee<>p.proowner AND a.privilege_type='EXECUTE'),
'app_execute',(SELECT jsonb_object_agg(r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')) FROM pg_roles r WHERE r.rolname IN('anon','authenticated','service_role','authenticator'))) evidence
FROM wanted_fn w LEFT JOIN pg_proc p ON p.oid=to_regprocedure(format('demo_flow_writer.%I()',w.name))),
wanted_trigger(name,table_name,function_name) AS (VALUES
('execution_authorized_deferred','execution_receipts','authorize_issuance_deferred'),
('demo_authorize_deferred','receipts','authorize_deferred'),
('demo_checkpoint_authorize_deferred','seed_checkpoints','authorize_deferred')),
triggers AS (SELECT w.name,jsonb_build_object('table_oid',r.oid,'table_name',w.table_name,'function_name',w.function_name,
'metadata',to_jsonb(t),'constraint',to_jsonb(c)) evidence FROM wanted_trigger w
LEFT JOIN pg_class r ON r.oid=to_regclass(format('demo_flow_writer.%I',w.table_name))
LEFT JOIN pg_trigger t ON t.tgrelid=r.oid AND t.tgname=w.name LEFT JOIN pg_constraint c ON c.oid=t.tgconstraint)
SELECT jsonb_build_object('session_replication_role',current_setting('session_replication_role'),
'functions',(SELECT jsonb_object_agg(name,evidence) FROM functions),'triggers',(SELECT jsonb_object_agg(name,evidence) FROM triggers));"""

def validate_guards(value, definer):
    require(value['session_replication_role']=='origin' and set(value['functions'])==set(GUARD_HASHES) and set(value['triggers'])==set(TRIGGERS), 'Guard inventory differs')
    for name, digest in GUARD_HASHES.items():
        f=value['functions'][name];p=f['metadata']
        require(f['owner']=='postgres' and f['language']=='plpgsql' and f['return_type']=='trigger' and f['body_sha256']==digest, 'Guard source/owner differs')
        require(type(p['oid']) in (int,str) and str(p['oid']).isdigit() and int(p['oid'])>0 and p['pronargs']==0 and p['proconfig']==['search_path=pg_catalog']
                and p['prosecdef'] is (definer if name=='authorize_issuance_deferred' else True), 'Guard descriptor differs')
        require(f['non_owner_execute']==[] and set(f['app_execute'])>={'anon','authenticated','service_role'} and all(v is False for v in f['app_execute'].values()), 'Guard EXECUTE expanded')
    for name,(table,fn) in TRIGGERS.items():
        t=value['triggers'][name];m=t['metadata'];c=t['constraint']
        require(t['table_name']==table and t['function_name']==fn and m['tgname']==name and m['tgrelid']==t['table_oid']
                and m['tgfoid']==value['functions'][fn]['metadata']['oid'] and m['tgtype']==5 and m['tgenabled']=='O'
                and m['tgdeferrable'] is True and m['tginitdeferred'] is True and m['tgisinternal'] is False
                and m['tgconstraint']==c['oid'] and c['contype']=='t' and c['conrelid']==t['table_oid']
                and c['condeferrable'] is True and c['condeferred'] is True, 'Deferred binding differs')
    return value

def descriptor_delta(before, after):
    validate_guards(before,False);validate_guards(after,True)
    expected=copy.deepcopy(before)
    expected['functions']['authorize_issuance_deferred']['metadata']['prosecdef']=True
    require(after==expected, 'Descriptor proposal changed additional catalog metadata')

def lines(response): return response.stdout.decode(errors='replace').splitlines()

def marker(response, name): require(lines(response).count(name)==1, 'Missing/duplicate native marker: '+name)

def frame(response, prefix):
    found=[line[len(prefix):] for line in lines(response) if line.startswith(prefix)]
    require(len(found)==1, 'Missing/duplicate native JSON frame: '+prefix)
    return json.loads(found[0])

def connection(response, phase):
    f=frame(response,'FINANCIAL_CONNECTION_EVIDENCE=')
    require(set(f)=={'phase','backend_pid'} and f['phase']==phase and type(f['backend_pid']) is int and f['backend_pid']>0, 'Connection evidence differs')
    return f['backend_pid']

def observation(response, retried):
    marker(response,'FINANCIAL_COMMIT_OBSERVED')
    f=frame(response,'FINANCIAL_COMMIT_OBSERVATION=')
    require(f['scope']=='SYNTHETIC_COMMITTED_ROWS_ONLY' and f['retry_checked'] is retried
            and [f[k] for k in ('events','receipts','current_approvals','simulated_payments')]==[13,13,3,1], 'Committed observation differs')
    for key in ('snapshot_sha256','foreign_snapshot_sha256','global_snapshot_sha256'):
        require(re.fullmatch('[0-9a-f]{64}',f[key]), 'Incomplete snapshot hash')
    require(f['backend_pid']==connection(response,'observe'), 'Observer PID mismatch')
    return f

def prove_observers(before, after, pids):
    require(before['retry_checked'] is False and after['retry_checked'] is True, 'Retry observation missing')
    require(len(pids)==5 and len(set(pids))==5 and all(type(p) is int and p>0 for p in pids), 'Five distinct backend PIDs required')
    require(before['backend_pid']==pids[2] and after['backend_pid']==pids[4], 'Observer connection mismatch')
    for key in ('snapshot_sha256','foreign_snapshot_sha256','global_snapshot_sha256'):
        require(before[key]==after[key], 'Retry changed committed/foreign/global rows')

def cleanup_ok(result):
    return result.get('cleanup')=='confirmed_stopped_and_removed' and all(result.get(k) is True for k in ('shutdown_confirmed','pg_status_3_and_no_pid','owned_psql_clients_closed'))

def case_stages(installation, case):
    require(case in CASES,'Unknown native case')
    result=[*installation,'proposed-same-context-retry-correction','synthetic-boundary-privileges','guard-catalog-before']
    if case!='original_invoker':result+=['proposed-deferred-owner-descriptor','guard-catalog-after']
    result+=['setup-observer-metadata','business-transaction']
    result+=['observe-committed','retry-transaction','observe-after-retry'] if case=='proposed_definer' else ['observe-controlled-rollback']
    return [*result,'guard-catalog-final']

def validate_stages(stages, expected, case):
    require([s['stage'] for s in stages]==expected,'Native stage sequence incomplete')
    for s in stages:
        require(s['native_exit']!=0 if s['stage']=='business-transaction' and case!='proposed_definer' else s['native_exit']==0,'Native exit matrix differs')
        require(re.fullmatch('[0-9a-f]{64}',s['stdin_sha256']),'Missing exact stage input hash')

def run_case(output, case, bm, cm, infra, bundle, cf, bf, frozen, variant, correction):
    class CommitRunner(infra.Runner):
        def install(self, body, label, db=DATABASE, user='postgres', required=True):
            require(db in ('postgres',DATABASE) and user in ('postgres','supabase_admin'), 'Nonfixture target')
            self.inspect_owned();self.result['stage']=label;self.save();self.counter+=1
            prefix=self.output/'logs'/f'{self.counter:03d}-{label}';prefix.with_suffix('.sql').write_bytes(body)
            args=['docker','exec','-i',self.cid,'psql','-X','-w','-qAt','-h','/tmp/crm/socket','-p','5432','-U',user,'-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose']
            try: response=subprocess.run(args,input=body,capture_output=True,env=self.env,timeout=180)
            except subprocess.TimeoutExpired:
                self.result['diagnostic']={'phase':label,'exit_code':'timeout'};raise RuntimeError('Owned SQL timeout') from None
            prefix.with_suffix('.stdout').write_bytes(response.stdout);prefix.with_suffix('.stderr').write_bytes(response.stderr)
            self.result['stages'].append({'stage':label,'native_exit':response.returncode,'stdin_sha256':sha(body)})
            if response.returncode:
                self.result['diagnostic']=bm.diagnose(response.stdout,response.stderr,label,response.returncode)
                phases=re.findall(r'^FINANCIAL_COMMIT_PHASE_([a-z_]+)$',response.stdout.decode(errors='replace'),re.M)
                if phases:self.result['diagnostic']['phase']=phases[-1]
            self.save()
            if required:require(response.returncode==0,'Owned SQL failed at '+label)
            return response
    output.mkdir();(output/'logs').mkdir();r=CommitRunner(output,uuid.uuid4().hex)
    r.result.update(stages=[],stage='preflight');accepted=False;evidence={};before=None;after=None
    try:
        r.start()
        r.install(('CREATE ROLE postgres LOGIN NOSUPERUSER BYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
                   'CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
                   'CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
                   'CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION;'
                   'GRANT service_role TO postgres;CREATE DATABASE '+DATABASE+' OWNER postgres TEMPLATE template0;').encode(),'synthetic-infrastructure',db='postgres',user='supabase_admin')
        candidate=json.loads(r.install(b"SELECT jsonb_build_object('user',current_user,'session',session_user,'version',current_setting('server_version_num'),'superuser',rolsuper,'bypassrls',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'inherit',rolinherit,'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen',current_setting('listen_addresses'),'address',inet_server_addr()) FROM pg_roles WHERE rolname=current_user;",'candidate-context').stdout)
        require(candidate=={'user':'postgres','session':'postgres','version':'170006','superuser':False,'bypassrls':True,'createdb':False,'createrole':False,'inherit':False,'admin_member':False,'listen':'','address':None},'Candidate differs')
        r.result['candidate']=candidate
        response=r.install(cf['sql/bootstrap.sql'],'synthetic-auth-bootstrap');marker(response,'FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE')
        r.install(bundle.catalog_sql,'canonical-catalog');r.install(bundle.validation_sql,'canonical-function-revalidation')
        for i,path in enumerate(cm.INSTALL_ORDER):r.install(variant if path=='upstream/flow/sql/02-manifest.sql' else cf[path],'installer-'+str(i+1).zfill(2))
        response=r.install(cm.expected_sql(bundle.manifest)+cf['sql/verify-install.sql'],'verify-install');marker(response,'FINANCIAL_COMPILE_INSTALL_VERIFIED')
        response=r.install(correction,'proposed-same-context-retry-correction');marker(response,'FINANCIAL_PROPOSED_RETRY_CORRECTION_VERIFIED')
        r.install(b'GRANT USAGE ON SCHEMA demo_flow_writer TO service_role;GRANT EXECUTE ON FUNCTION demo_flow_writer.prepare_execute_checkpoint(uuid,bigint),demo_flow_writer.reconcile_context(uuid) TO service_role;','synthetic-boundary-privileges')
        before=validate_guards(json.loads(r.install(guard_sql(),'guard-catalog-before').stdout),False)
        if case!='original_invoker':
            r.install(frozen['sql/deferred-owner-context.sql'],'proposed-deferred-owner-descriptor')
            after=json.loads(r.install(guard_sql(),'guard-catalog-after').stdout);descriptor_delta(before,after)
        response=r.install(bf['sql/fixture.sql']+b'\n'+bf['sql/prepare-context.sql']+b'\n'+frozen['sql/setup-observation.sql'],'setup-observer-metadata')
        marker(response,'FINANCIAL_COMMIT_OBSERVATION_SETUP_COMPLETE');pids=[connection(response,'setup')]
        response=r.install(frozen['sql/revoke-before-commit.sql' if case=='proposed_revoked' else 'sql/business.sql'],'business-transaction',required=False)
        pids.append(connection(response,'business'));marker(response,'FINANCIAL_COMMIT_PHASE_business_commit')
        if case!='proposed_definer':
            diagnostic=r.result.get('diagnostic') or {}
            require(response.returncode!=0 and diagnostic.get('sqlstate')=='42501' and 'FINANCIAL_BUSINESS_COMMIT_RETURNED' not in lines(response), 'Expected original/negative COMMIT rejection missing')
            error=response.stderr.decode(errors='replace')
            if case=='original_invoker':require('permission denied for function assert_issued' in error and 'authorize_issuance_deferred' in error,'Original deferred invoker failure differs')
            else:
                require('DEMO_RUN_UNAUTHORIZED' in error,'Revoked deferred denial differs')
                require(frame(response,'FINANCIAL_COMMIT_REVOCATION_CONFIRMED=')=={'revoked':True,'context_bound':True},'Exact bound revocation not observed')
            observed=r.install(frozen['sql/observe-failed.sql'],'observe-controlled-rollback')
            marker(observed,'FINANCIAL_FAILED_COMMIT_ROLLBACK_OBSERVED');pids.append(connection(observed,'observe_failed'))
            f=frame(observed,'FINANCIAL_FAILED_COMMIT_OBSERVATION=')
            require(f['scope']=='SYNTHETIC_CONTROLLED_TRANSACTION_ROLLBACK_ONLY' and f['canonical_classification']=='unresolved'
                    and f['backend_pid']==pids[-1] and re.fullmatch('[0-9a-f]{64}',f['snapshot_sha256']) and len(set(pids))==3,'Independent failed transaction observation differs')
            evidence={'business_commit':'FAIL_EXPECTED_42501','controlled_rollback':'PASS','observation':f,'connections':pids}
        else:
            require(response.returncode==0,'Proposed actual business COMMIT failed');marker(response,'FINANCIAL_BUSINESS_COMMIT_RETURNED');marker(response,'FINANCIAL_BUSINESS_RESULT_RECORDED')
            observed=r.install(frozen['sql/observe.sql'],'observe-committed');first=observation(observed,False);pids.append(first['backend_pid'])
            retried=r.install(frozen['sql/retry.sql'],'retry-transaction');marker(retried,'FINANCIAL_COMMIT_PHASE_retry_commit');marker(retried,'FINANCIAL_RETRY_COMMIT_RETURNED');marker(retried,'FINANCIAL_RETRY_RESULT_RECORDED');pids.append(connection(retried,'retry'))
            observed=r.install(frozen['sql/observe.sql'],'observe-after-retry');second=observation(observed,True);pids.append(second['backend_pid']);prove_observers(first,second,pids)
            evidence={'business_commit':'PASS_SYNTHETIC_PROPOSED_DESCRIPTOR_ONLY','retry_commit':'PASS_NO_ROW_DELTA','observations':[first,second],'connections':pids}
        final=json.loads(r.install(guard_sql(),'guard-catalog-final').stdout)
        require(final==(after if after is not None else before),'Guards changed during native probes')
        validate_stages(r.result['stages'],case_stages(cm.EXPECTED_STAGES,case),case)
        accepted=True
    except Exception as error:r.result['failure_type']=type(error).__name__;r.result['failure_reason']=str(error)[:250]
    finally:
        try:r.cleanup()
        except Exception as error:r.result.update(cleanup='failed_verification',cleanup_error_type=type(error).__name__)
        finally:r.save()
    return {'case_id':case,'status':'PASS' if accepted and cleanup_ok(r.result) else 'FAIL','evidence':evidence,'diagnostic':r.result.get('diagnostic'),
            'failure_type':r.result.get('failure_type'),'failure_reason':r.result.get('failure_reason'),'cleanup':r.result.get('cleanup'),'cleanup_verified':cleanup_ok(r.result),
            'candidate':r.result.get('candidate'),'guard_before':before,'guard_after':after,'stages':r.result['stages']}

def run(output):
    require(os.environ.get('GITHUB_ACTIONS')=='true','Actions only; local SQL/Docker forbidden')
    event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text());head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();gate(event,os.environ,head)
    bm=module('commit_author',BEHAVIOR/'run_ci.py');frozen=verify_inputs(bm);bf,bp=bm.verify_inputs()
    cm=module('commit_compile',bm.COMPILE/'run_ci.py');cf=cm.verify_inputs()
    require(sha(bm.file_bytes(bm.INFRA))==bm.INFRA_SHA,'Golden infrastructure changed');infra=module('commit_golden',bm.INFRA)
    catalog=module('commit_catalog',bm.COMPILE/'catalog.py');baseline=subprocess.check_output(['git','show',head+':supabase/schema/baseline.sql'],cwd=ROOT);bundle=catalog.build_catalog(baseline)
    require(sha(bundle.catalog_sql)==bp['catalog_sha256'] and sha(bundle.validation_sql)==bp['validation_sha256'],'Exact compiled catalog differs')
    variant,variant_evidence=bm.laboratory_manifest(cf['upstream/flow/sql/02-manifest.sql']);correction,correction_evidence=bm.correction_input(bf,cf)
    output=Path(output);output.mkdir(parents=True,exist_ok=False);public=output/'public';public.mkdir()
    summary={'scope':'SYNTHETIC_ACTUAL_COMMIT_WITH_ISOLATED_DESCRIPTOR_PROPOSAL','status':'FAIL','workflow_commit':head,'event_base':EVENT_BASE,'author_fix_head':AUTHOR,
             'canonical_catalog_sha256':sha(bundle.catalog_sql),'validation_sha256':sha(bundle.validation_sql),'cases':[],
             'complete':False,'canonical_closure_complete':False,'fixtures_complete':False,'real_identity':'NOT_RUN','runtime_acl_rls':'NOT_RUN',
             'crash_wal_durability':'NOT_RUN','sequence_rollback':'NOT_ESTABLISHED','operational_wire':'UNBOUND','configuration':'EMPTY','demo':'DISABLED','live_database_actions':0,
             'limits':['PostgreSQL tmpfs/fsync-off; visible committed synthetic rows do not prove crash durability','Invoker historical source preserved; accepted COMMIT requires separate descriptor proposal','Synthetic owner/technical-role fixture does not certify real issuer, identity, runtime ACL/RLS or HTTP driver continuity']}
    def save():(public/'result.json').write_text(json.dumps(summary,indent=2)+'\n')
    for name,value in [('laboratory-manifest-variant',variant_evidence),('proposed-retry-correction',correction_evidence),('catalog-manifest',bundle.manifest)]:
        (public/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
    save()
    for case in CASES:summary['cases'].append(run_case(output/case,case,bm,cm,infra,bundle,cf,bf,frozen,variant,correction));save()
    summary['status']='PASS_SYNTHETIC_PROPOSED_COMMIT_AND_NEGATIVE_CONTROLS_ONLY' if len(summary['cases'])==3 and all(c['status']=='PASS' for c in summary['cases']) else 'FAIL'
    save();print(json.dumps(summary));require(summary['status'].startswith('PASS_'),'Native COMMIT evidence or owned cleanup incomplete')
    return summary

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
    def interrupted(number,frame):raise RuntimeError('Interrupted by signal '+str(number))
    for sig in (signal.SIGINT,signal.SIGTERM):signal.signal(sig,interrupted)
    run(args.output)

if __name__=='__main__':main()
