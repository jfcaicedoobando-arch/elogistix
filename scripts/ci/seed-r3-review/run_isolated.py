#!/usr/bin/env python3
"""Opt-in standalone PG17.6 regression. Never accepts a DSN or external socket."""
import argparse, copy, hashlib, json, os, pathlib, re, shutil, subprocess, tempfile
ROOT=pathlib.Path(__file__).resolve().parent
EXPECTED_R3='7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86'
SIGS=['_seed_demo_limpiar_financiero()','seed_demo_organization_core()','seed_demo_organization()','seed_demo_organization_guarded(bigint)']
def digest(s): return hashlib.sha256(s.encode()).hexdigest()
def extract_hashes(sql,tag):
    m=re.search(r'\$'+tag+r'\$(.*?)\$'+tag+r'\$',sql,re.S)
    assert m,tag
    return json.loads(m.group(1))
def logical(s):
    s=copy.deepcopy(s)
    for item in s['functions']: item.pop('xmin');item.pop('ctid')
    return s

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--pg-bin',type=pathlib.Path,required=True)
    ap.add_argument('--pg-share',type=pathlib.Path,help='Optional local initdb share directory')
    ap.add_argument('--pg-lib',type=pathlib.Path,help='Optional local dynamic_library_path directory')
    ap.add_argument('--r3',type=pathlib.Path,required=True)
    ap.add_argument('--output',type=pathlib.Path,required=True)
    ap.add_argument('--run-disposable-only',action='store_true')
    a=ap.parse_args()
    if not a.run_disposable_only: ap.error('Explicit --run-disposable-only required; nothing started')
    if os.geteuid()==0: ap.error('Run as an unprivileged OS user; do not run initdb as root')
    sqls={'R2':(ROOT/'fixtures/R2.sql').read_text(),'R3':a.r3.read_text()}
    assert digest(sqls['R3'])==EXPECTED_R3,'R3 input hash mismatch; re-review changed candidate'
    for path in (a.pg_bin,a.pg_share,a.pg_lib):
        if path is not None:
            assert path.is_dir(),('Missing local PostgreSQL directory',str(path))
            assert re.fullmatch(r'[A-Za-z0-9_./-]+',str(path.resolve())),('Unsupported local directory characters',str(path))
    a.output.mkdir(parents=True,exist_ok=False)
    logs=a.output/'logs';logs.mkdir()
    result={'status':'running','checks':[],'R3_sha256':digest(sqls['R3']),'historical_seed_invocations':0}
    def save(): (a.output/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    save()
    env={'PATH':str(a.pg_bin.resolve())+':/usr/bin:/bin','LANG':'C','LC_ALL':'C','HOME':str(a.output.resolve()),'PGCONNECT_TIMEOUT':'5','PGPASSFILE':'/nonexistent-fixture-password'}
    counter=0
    def run(args,label,source=None,expected=0):
        nonlocal counter
        counter+=1; name=f'{counter:03d}-{label}'
        if source is not None:(logs/(name+'.sql')).write_text(source)
        try:
            p=subprocess.run(args,input=source,text=True,capture_output=True,env=env,timeout=60)
        except subprocess.TimeoutExpired as exc:
            def as_text(v): return v.decode(errors='replace') if isinstance(v,bytes) else (v or '')
            (logs/(name+'.stdout')).write_text(as_text(exc.stdout))
            (logs/(name+'.stderr')).write_text(as_text(exc.stderr))
            (logs/(name+'.timeout.json')).write_text(json.dumps({'command':args,'timeout_seconds':exc.timeout})+'\n')
            raise
        (logs/(name+'.stdout')).write_text(p.stdout);(logs/(name+'.stderr')).write_text(p.stderr)
        if source is not None:(logs/(name+'.sql')).write_text(source)
        if expected is not None: assert p.returncode==expected,(label,p.returncode,p.stderr)
        return p
    try:
        td=tempfile.mkdtemp(prefix='seed-r3-',dir='/tmp')
    except BaseException as exc:
        result.update(status='failed',error='Cluster directory creation failed: '+str(exc),cleanup='no_cluster_created');save();raise
    t=pathlib.Path(td); data=t/'data';socket=t/'socket'
    pgctl=str(a.pg_bin.resolve()/'pg_ctl'); start_attempted=False
    result['cluster_directory']=str(t);result['cleanup']='pending';save()
    def query(sql,label,db='postgres',user='postgres',expected=0):
        # Explicit private socket and db/user arguments override all PG environment settings.
        return run([str(a.pg_bin.resolve()/'psql'),'-X','-w','-qAt','-h',str(socket),'-p','5432','-U',user,'-d',db,'-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],label,sql,expected)
    def snap(db,label):
        d=json.loads(query((ROOT/'snapshot.sql').read_text(),label,db).stdout)
        (a.output/(label+'.json')).write_text(json.dumps(d,indent=2)+'\n');return d
    def check(name,**details): result['checks'].append({'case':name,'status':'pass',**details});save()
    try:
        socket.mkdir(mode=0o700)
        version=run([str(a.pg_bin.resolve()/'postgres'),'--version'],'binary-version').stdout
        assert re.search(r'\b17\.6\b',version),version
        initdb_extra=['-L',str(a.pg_share.resolve())] if a.pg_share else []
        server_extra=' -c dynamic_library_path='+str(a.pg_lib.resolve()) if a.pg_lib else ''
        run([str(a.pg_bin.resolve()/'initdb'),'-D',str(data),'-U','supabase_admin','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']+initdb_extra,'initdb')
        # Record before pg_ctl: a timeout/nonzero exit can leave a live postmaster.
        start_attempted=True
        run([pgctl,'-D',str(data),'-l',str(a.output.resolve()/'server.log'),'-o',f'-h "" -k {socket} -p 5432 -F -c unix_socket_permissions=0700 -c shared_preload_libraries='+server_extra,'-w','-t','20','start'],'start')
        query("CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;GRANT CREATE ON DATABASE postgres TO postgres;GRANT USAGE,CREATE ON SCHEMA public TO postgres;",'roles',user='supabase_admin')
        context=json.loads(query("SELECT jsonb_build_object('version',current_setting('server_version_num'),'user',current_user,'session',session_user,'superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'select',has_table_privilege(current_user,'pg_proc','SELECT'),'write',has_table_privilege(current_user,'pg_proc','INSERT,UPDATE,DELETE,TRUNCATE,MAINTAIN'),'admin_member',pg_has_role(current_user,'supabase_admin','MEMBER'),'listen_addresses',current_setting('listen_addresses'));",'context').stdout)
        assert context=={'version':'170006','user':'postgres','session':'postgres','superuser':False,'select':True,'write':False,'admin_member':False,'listen_addresses':''},context
        result['context']=context
        query("CREATE SCHEMA auth;CREATE TYPE public.app_role AS ENUM('super_admin');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;",'minimal-inert-dependencies')
        query('SET check_function_bodies=off;'+(ROOT/'fixtures/TEST_ONLY_initial_functions.sql').read_text(),'install-historical-definitions-only')
        query((ROOT/'fixtures/dependencies.sql').read_text(),'dependency-fixtures')
        query((ROOT/'fixtures/event_drift.sql').read_text(),'admin-event-fixture',user='supabase_admin')
        historical=extract_hashes(sqls['R2'],'atomic_historical_hashes');stopped=extract_hashes(sqls['R2'],'atomic_stopped_hashes')
        def body_hashes(s):return {x['row']['proname']+('(bigint)' if x['row']['proname']=='seed_demo_organization_guarded' else '()'):digest(x['row']['prosrc']) for x in s['functions'] if x['row']['proname'] in [z.split('(')[0] for z in SIGS]}
        template=snap('postgres','template-historical')
        assert body_hashes(template)==historical
        control=template['control'][0]['row']
        targets=sorted([x['row'] for x in template['functions'] if x['row']['proname'] in [z.split('(')[0] for z in SIGS]],key=lambda x:x['oid'])
        assert len(targets)==4 and targets[0]['proname']=='seed_demo_organization_core',targets
        assert control['first_oid']==targets[0]['oid'] and control['last_oid']==targets[-1]['oid']
        assert control['tracked']==[x['oid'] for x in targets]
        assert control['renames']==0 and not control['armed'] and not control['fired']
        def clone(name):query('CREATE DATABASE '+name+' TEMPLATE postgres OWNER postgres;','clone-'+name,user='supabase_admin')
        for version in ('R2','R3'):
            for state in ('historical','terminal'):
                for mutation in ('cost','prosrc'):
                    db=f'qa_{version.lower()}_{state}_{mutation}';clone(db)
                    if state=='terminal':query(sqls['R3'],'establish-terminal-'+db,db)
                    query("UPDATE qa_fixture.control SET armed=true,mutation='"+mutation+"';",'arm-'+db,db,user='supabase_admin')
                    before=snap(db,'before-'+db)
                    bug=(version=='R2' and state=='terminal')
                    p=query(sqls[version],'admission-'+db,db,expected=0 if bug else 3)
                    after=snap(db,'after-'+db)
                    if bug:
                        assert after['control'][0]['row']['fired'] and after['control'][0]['row']['renames']==8
                        target=after['control'][0]['row']['first_oid']
                        row=next(x['row'] for x in after['functions'] if x['row']['oid']==target)
                        assert row['procost']==101 if mutation=='cost' else 'QA_EVENT_DRIFT_MARKER' in row['prosrc']
                        assert after!=before
                        check(db,expected_R2_defect_reproduced=True)
                    else:
                        phase='admission_terminal' if state=='terminal' else 'admission_0'
                        first_oid=before['control'][0]['row']['first_oid']
                        first_name=next(x['row']['proname'] for x in before['functions'] if x['row']['oid']==first_oid)
                        signature=first_name+('(bigint)' if first_name=='seed_demo_organization_guarded' else '()')
                        expected_message='ATOMIC_DEMO_POSTCHECK_'+phase+': body or complete metadata drift for '+signature
                        # Exact primary ERROR + SQLSTATE; a string in CONTEXT cannot pass.
                        assert re.search(r'^ERROR:\s+P0001: '+re.escape(expected_message)+r'$',p.stderr,re.M),p.stderr
                        assert after==before,'Rollback must restore all snapshotted rows, xmin/ctid and event fixture state'
                        check(db,complete_rollback=True)
        db='qa_clean';clone(db)
        before=snap(db,'before-clean')
        query(sqls['R3'],'clean-historical-to-stopped',db)
        after=snap(db,'after-clean-transition');assert body_hashes(after)==stopped
        # Non-body fields and original OIDs/ACL must match for all four targets.
        def metadata(s):return [{k:v for k,v in x['row'].items() if k not in ('prosrc','proconfig')} for x in s['functions']]
        assert metadata(after)==metadata(before)
        for old,new in zip(before['functions'],after['functions']):
            name=old['row']['proname']
            expected_config=['search_path=public','row_security=off'] if name=='seed_demo_organization_guarded' else old['row']['proconfig']
            assert new['row']['proconfig']==expected_config,(name,'unexpected proconfig change')
            if name not in [z.split('(')[0] for z in SIGS]:assert new==old,('unrelated function changed',name)
        # Every observed non-function object, including rewrite/triggers, is unchanged.
        for section in before:
            if section!='functions': assert after[section]==before[section],('changed snapshot section',section)
        query(sqls['R3'],'clean-terminal-retry',db)
        retry=snap(db,'after-clean-retry');assert logical(retry)==logical(after)
        changed=[x['row']['proname'] for x,y in zip(after['functions'],retry['functions']) if (x['xmin'],x['ctid'])!=(y['xmin'],y['ctid'])]
        assert set(changed)==set(z.split('(')[0] for z in SIGS),changed
        check('clean historical transition and terminal retry',physical_tuple_versions_changed=changed,logical_metadata_preserved=True)
        dep=json.loads(query("SELECT jsonb_build_object('view_guard_dependency',EXISTS(SELECT 1 FROM pg_depend d JOIN pg_rewrite r ON d.classid='pg_rewrite'::regclass AND d.objid=r.oid WHERE r.ev_class='qa_owned.guard_view'::regclass AND d.refclassid='pg_proc'::regclass AND d.refobjid='public.seed_demo_organization_guarded(bigint)'::regprocedure),'trigger_bridge_dependency',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='qa_owned.bridge_target'::regclass AND tgfoid='qa_owned.guard_bridge()'::regprocedure));",'verify-oid-dependencies',db).stdout)
        assert all(dep.values()),dep
        # These invocations occur ONLY after verified stopped body hashes.
        for label,statement in [('view','SELECT * FROM qa_owned.guard_view;'),('bridge','INSERT INTO qa_owned.bridge_target VALUES(1);')]:
            p=query("SET request.jwt.claims='{\"role\":\"service_role\"}';"+statement,'stopped-'+label,db,expected=3)
            assert '55000: LC_SEED_DEMO_CONSERVACION_PENDIENTE' in p.stderr,p.stderr
        assert snap(db,'after-dependency-checks')==retry
        check('existing view OID and RETURNS trigger bridge fail closed after R3',**dep)
        result['status']='checks_pass_cleanup_pending';save()
    except BaseException as exc:
        result['status']='failed';result['error']=str(exc);save();raise
    finally:
        try:
            # Only the data directory created by this invocation is ever inspected/stopped.
            # Do not use TemporaryDirectory: its unconditional deletion could remove live data.
            if start_attempted:
                status=run([pgctl,'-D',str(data),'status'],'cleanup-status-before',expected=None)
                assert status.returncode in (0,3),('Cannot establish owned cluster status',status.returncode)
                stop_exit_code=0
                if status.returncode==0:
                    stop=run([pgctl,'-D',str(data),'-m','immediate','-w','-t','20','stop'],'cleanup-stop',expected=None)
                    stop_exit_code=stop.returncode
                    result['cleanup_stop_exit_code']=stop.returncode
                status=run([pgctl,'-D',str(data),'status'],'cleanup-status-after',expected=None)
                assert status.returncode==3,('Owned cluster shutdown NOT confirmed',status.returncode)
                assert not (data/'postmaster.pid').exists(),'PID file remains; preserve cluster conservatively'
                result['shutdown_confirmed']=True
                assert stop_exit_code==0,('pg_ctl stop failed; preserve directory for review',stop_exit_code)
            result['shutdown_confirmed']=True
            shutil.rmtree(t)
            result['cleanup']='confirmed_stopped_and_removed';save()
        except BaseException as cleanup_exc:
            result['status']='failed'
            result['cleanup']='unconfirmed_or_failed_directory_preserved'
            result['cleanup_error']=str(cleanup_exc)
            result['cluster_directory']=str(t);save()
            raise RuntimeError('Cleanup failed; do not delete the preserved cluster directory: '+str(t)) from cleanup_exc
    # PASS is emitted only after successful tests AND confirmed cleanup.
    result['status']='pass';save()
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
