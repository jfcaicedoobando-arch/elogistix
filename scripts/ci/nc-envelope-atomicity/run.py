#!/usr/bin/env python3
"""Actions-only disposable PostgreSQL17.6 atomicity tests; no hosted connections."""
import hashlib,json,os,re,signal,subprocess,tempfile,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
REPO='jfcaicedoobando-arch/elogistix'
BRANCH='test/nc-envelope-atomicity-pg176-20261012'
TAG='postgres:17.6-bookworm'
MIGRATION='supabase/migrations/20261012010000_nc_publica_paridad_replay.sql'
MIGRATION_HASH='14ac2ab9e561771d2adf10be0b5bf0701b97d91a5955844787301e77f7456825'
ENVELOPE_HASH='7de71cd79af07fa9cf39a98007040ebb496563262fae3351e18f62f40df54c2b'
EXPECTED=['success_exact_ledger_and_noop','duplicate_aborts_unchanged','invalid_hash_aborts_unchanged','forced_after_ddl_total_rollback','forced_after_ledger_total_rollback','settings_restore_after_error_same_session','inherited_long_timeout_rejected','ledger_contention_nowait','implicit_lock_timeout_rollback','transaction_timeout_total_rollback']
def require(ok,message):
    if not ok: raise RuntimeError(message)
def sha(data): return hashlib.sha256(data).hexdigest()
require(os.environ.get('GITHUB_ACTIONS')=='true','Actions only; no local or hosted fallback')
require(os.environ.get('GITHUB_EVENT_NAME')=='pull_request','PR only')
require(os.environ.get('GITHUB_REPOSITORY')==REPO,'Unexpected repository')
event=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
require(event['action'] in ['opened','synchronize','reopened'],'Unexpected event action')
pr=event['pull_request']; head=os.environ.get('REVIEW_COMMIT','')
require(re.fullmatch('[0-9a-f]{40}',head) is not None,'Exact SHA required')
require(pr['head']['sha']==head and pr['head']['ref']==BRANCH and pr['base']['ref']=='main','PR source mismatch')
require(pr['head']['repo']['full_name']==REPO and pr['base']['repo']['full_name']==REPO,'Same-repository PR only')
clean={'PATH':os.environ['PATH'],'LANG':'C','LC_ALL':'C'}
require(subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,env=clean,text=True).strip()==head,'Checkout SHA mismatch')
paths=['.github/workflows/nc-envelope-atomicity-review.yml','scripts/ci/nc-envelope-atomicity/run.py','scripts/ci/nc-envelope-atomicity/envelope.sql','scripts/ci/nc-envelope-atomicity/fixture.sql',MIGRATION]
for relative in paths:
    cursor=ROOT
    for part in Path(relative).parts:
        cursor=cursor/part;require(not cursor.is_symlink(),'Symlink input refused: '+relative)
    require(cursor.is_file(),'Missing regular input: '+relative)
sql=(HERE/'envelope.sql').read_bytes().decode('utf-8');source=(ROOT/MIGRATION).read_bytes().decode('utf-8');fixture=(HERE/'fixture.sql').read_bytes().decode('utf-8')
require(sha(source.encode())==MIGRATION_HASH,'Reviewed migration hash mismatch')
require(sha(sql.encode())==ENVELOPE_HASH,'Reviewed envelope hash mismatch')
require(sql.split('$nc_exact_source_20261012010000$')[1]==source,'Embedded source bytes mismatch')
OUT=ROOT/'reports/nc-envelope-atomicity';require(not OUT.exists(),'Evidence directory must be fresh');OUT.mkdir(parents=True)
(OUT/'envelope.sql').write_text(sql);(OUT/'migration.sql').write_text(source);(OUT/'fixture.sql').write_text(fixture)
record={'format':1,'reviewCommit':head,'repository':REPO,'postgresRequired':'17.6','imageTag':TAG,'status':'running','expectedCases':EXPECTED,'sources':{p:sha((ROOT/p).read_bytes()) for p in paths},'cases':[],'containerRemoved':False,'hostedAccess':False}
def save(): (OUT/'run.json').write_text(json.dumps(record,indent=2)+'\n')
save();scratch=tempfile.TemporaryDirectory(prefix='nc-envelope-docker-');docker_env={**clean,'DOCKER_HOST':'unix:///var/run/docker.sock','DOCKER_CONFIG':scratch.name}
owned=None;holders=[];counter=0
def interrupted(signum,frame): raise KeyboardInterrupt('Runner interrupted: '+str(signum))
signal.signal(signal.SIGTERM,interrupted)
PSQL=['/usr/bin/env','-i','PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin','LANG=C','LC_ALL=C','PGHOST=127.0.0.1','PGPORT=5432','PGUSER=postgres','PGDATABASE=nc_envelope_test','PGSSLMODE=disable','PGCONNECT_TIMEOUT=5','PGPASSFILE=/tmp/nonexistent.pgpass','psql','-X','-w','-A','-t']
def docker(args,**kw):return subprocess.run(['docker',*args],env=docker_env,**kw)
def query(text,label,expected_error=None,continue_on_error=False,timeout=90):
    global counter
    counter+=1;start=time.monotonic();(OUT/f'{counter:03d}-{label}.sql').write_text(text)
    r=docker(['exec','-i',owned,*PSQL,'-v','ON_ERROR_STOP='+('0' if continue_on_error else '1')],input=text,text=True,capture_output=True,timeout=timeout)
    elapsed=time.monotonic()-start
    (OUT/f'{counter:03d}-{label}.stdout.log').write_text(r.stdout);(OUT/f'{counter:03d}-{label}.stderr.log').write_text(r.stderr)
    if expected_error is None: require(r.returncode==0 and 'ERROR:' not in r.stderr and 'FATAL:' not in r.stderr,f'{label} failed: {r.stderr}')
    else: require(expected_error in r.stderr and (r.returncode!=0 or continue_on_error),f'{label} missing expected failure: {r.stderr}')
    return r.stdout.strip(),elapsed
SNAP="SELECT jsonb_agg(to_jsonb(p) ORDER BY p.proname)::text FROM pg_proc p WHERE p.oid IN ('public.nc_aplicadas_en_moneda_factura(uuid)'::regprocedure,'public._saldo_factura_calc(uuid)'::regprocedure,'public._nc_aplicadas_moneda_factura(uuid)'::regprocedure);"
LEDGER="SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY version),'[]'::jsonb)::text FROM supabase_migrations.schema_migrations m;"
CONFIG="jsonb_build_object('transaction_timeout',current_setting('transaction_timeout'),'lock_timeout',current_setting('lock_timeout'))::text"
def snap():return query(SNAP,'catalog')[0]
def ledger():return query(LEDGER,'ledger')[0]
def state_ok():require(snap()==before and ledger()=='[]','Partial catalog/ledger state');require(query("SELECT to_regclass('public.nc_atomic_rollback_probe') IS NULL;",'probe-absent')[0]=='t','Rollback probe leaked')
def passed(name,**facts):record['cases'].append({'name':name,'passed':True,**facts});save()
def injected(anchor,extra):
    require(sql.count(anchor)==1,'Injection anchor not unique');value=sql.replace(anchor,anchor+'\n'+extra,1);require(value.split('$nc_exact_source_20261012010000$')[1]==source,'Injection modified reviewed source');return value
DDL='  EXECUTE v_sql;';INSERT="  VALUES ('20261012010000','nc_publica_paridad_replay',ARRAY[v_sql]::text[]);"
def hold(table,app):
    text=f"SET application_name='{app}'; BEGIN; LOCK TABLE {table} IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(120); ROLLBACK;"
    child=subprocess.Popen(['docker','exec','-i',owned,*PSQL,'-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=docker_env)
    child.stdin.write(text);child.stdin.close();child.stdin=None;holders.append((child,app))
    for _ in range(100):
        ready=query("SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='"+app+"' AND l.relation='"+table+"'::regclass AND l.granted AND l.mode='AccessExclusiveLock');",'holder-ready')[0]
        if ready=='t':return
        time.sleep(.1)
    raise RuntimeError('Owned lock holder did not become ready')
def release(app):
    query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='"+app+"' AND pid<>pg_backend_pid();",'release-owned-holder')
    for child,name in holders:
        if name==app:
            out,err=child.communicate(timeout=10);(OUT/(app+'.log')).write_text(out+err)
try:
    pull=docker(['pull',TAG],text=True,capture_output=True,timeout=180);(OUT/'image-pull.log').write_text(pull.stdout+pull.stderr);require(pull.returncode==0,'Official image pull failed')
    inspect=docker(['image','inspect',TAG,'--format','{{json .RepoDigests}}'],text=True,capture_output=True,timeout=20);require(inspect.returncode==0,'Image digest missing')
    digests=json.loads(inspect.stdout);image=next((d for d in digests if d.startswith('postgres@sha256:')),None);require(image is not None,'Official image digest required');record['imageDigest']=image
    # Inline bootstrap contains no credentials or checkout references. Cluster is
    # created only in this container's tmpfs; no host ports, mounts or sockets.
    boot="""set -euo pipefail
export PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin
test "$(id -un)" = postgres
postgres --version
initdb -D /tmp/pgdata -U postgres --no-locale -E UTF8 --auth=trust
printf "\\nlisten_addresses = '127.0.0.1'\\nport=5432\\nunix_socket_directories='/tmp'\\n" >> /tmp/pgdata/postgresql.conf
pg_ctl -D /tmp/pgdata -l /tmp/postgres.log -w start
createdb -h 127.0.0.1 -U postgres nc_envelope_test
exec sleep infinity"""
    create=docker(['create','--network=none','--user=postgres','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--tmpfs','/tmp:rw,mode=1777','--tmpfs','/var/lib/postgresql/data:rw,mode=1777','--shm-size=128m','--memory=512m','--cpus=2','--entrypoint=/usr/bin/env',image,'-i','PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin','LANG=C','LC_ALL=C','bash','-c',boot],text=True,capture_output=True,timeout=30)
    require(create.returncode==0,'Container create failed');owned=create.stdout.strip();require(re.fullmatch('[0-9a-f]{64}',owned) is not None,'Owned container ID required');record['containerId']=owned;save()
    info=docker(['inspect',owned],text=True,capture_output=True,timeout=20);require(info.returncode==0,'Owned container inspection failed');ci=json.loads(info.stdout)[0];hc=ci['HostConfig']
    isolation={'network':hc['NetworkMode'],'portBindings':hc['PortBindings'],'readonlyRootfs':hc['ReadonlyRootfs'],'capDrop':hc['CapDrop'],'securityOpt':hc['SecurityOpt'],'user':ci['Config']['User'],'mounts':ci['Mounts'],'privileged':hc['Privileged']}
    require(isolation['network']=='none' and not isolation['portBindings'] and isolation['readonlyRootfs'] and isolation['user']=='postgres' and all(m.get('Type')=='tmpfs' and m.get('Destination') in ['/tmp','/var/lib/postgresql/data'] for m in isolation['mounts']) and not isolation['privileged'] and 'ALL' in isolation['capDrop'] and 'no-new-privileges:true' in isolation['securityOpt'],'Unexpected container isolation');record['isolation']=isolation;save()
    require(docker(['start',owned],capture_output=True,timeout=20).returncode==0,'Container start failed')
    for _ in range(100):
        ready=docker(['exec',owned,'/usr/lib/postgresql/17/bin/pg_isready','-h','127.0.0.1','-U','postgres','-d','nc_envelope_test'],capture_output=True,timeout=5)
        if ready.returncode==0:break
        time.sleep(.2)
    # createdb can finish just after readiness; require its existence separately.
    for _ in range(50):
        r=docker(['exec',owned,*PSQL,'-c','SELECT 1'],capture_output=True,timeout=5)
        if r.returncode==0:break
        time.sleep(.1)
    actual=query("SELECT current_database()||':'||current_setting('server_version_num')||':'||current_user;",'version')[0];require(actual=='nc_envelope_test:170006:postgres','Runtime must be exact17.6');record['runtime']=actual
    query(fixture,'fixture');before=snap();(OUT/'catalog-before.json').write_text(before+'\n')
    combined="SET lock_timeout='13s'; SET transaction_timeout='30s'; SELECT 'CONFIG_BEFORE:'||"+CONFIG+';\n'+sql+"\nSELECT 'CONFIG_AFTER:'||"+CONFIG+';'
    output,_=query(combined,'success-same-session');configs=[line.split(':',1)[1] for line in output.splitlines() if line.startswith(('CONFIG_BEFORE:','CONFIG_AFTER:'))];require(len(configs)==2 and configs[0]==configs[1],'Local settings leaked after success')
    require(snap()==before,'Successful migration changed catalog')
    require(query("SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version='20261012010000' AND name='nc_publica_paridad_replay' AND cardinality(statements)=1 AND encode(sha256(convert_to(statements[1],'UTF8')),'hex')='"+MIGRATION_HASH+"';",'exact-ledger')[0]=='1','Ledger not exact');saved=ledger();(OUT/'ledger-success.json').write_text(saved+'\n');passed(EXPECTED[0],settingsRestoredSameSession=True)
    query(sql,'duplicate','NC_ENVELOPE_ALREADY_RECORDED');require(snap()==before and ledger()==saved,'Duplicate changed state');passed(EXPECTED[1]);query("DELETE FROM supabase_migrations.schema_migrations WHERE version='20261012010000';",'reset-owned-fixture-ledger')
    invalid=sql.replace("<> '"+MIGRATION_HASH+"'","<> '"+'0'*64+"'",1);require(invalid!=sql,'Hash injection missing');query(invalid,'hash-mismatch','NC_ENVELOPE_HASH');state_ok();passed(EXPECTED[2])
    for label,anchor in [('after_ddl',DDL),('after_ledger',INSERT)]:
        changed=injected(anchor,"  CREATE TABLE public.nc_atomic_rollback_probe(id integer);\n  INSERT INTO public.nc_atomic_rollback_probe VALUES (1);\n  RAISE EXCEPTION 'NC_TEST_FORCED_"+label+"';")
        query(changed,label,'NC_TEST_FORCED_'+label);state_ok();passed('forced_'+label+'_total_rollback')
    combined="SET lock_timeout='13s'; SET transaction_timeout='30s'; SELECT 'CONFIG_BEFORE:'||"+CONFIG+';\n'+invalid+"\nSELECT 'CONFIG_AFTER:'||"+CONFIG+';'
    output,_=query(combined,'error-same-session','NC_ENVELOPE_HASH',continue_on_error=True);configs=[line.split(':',1)[1] for line in output.splitlines() if line.startswith(('CONFIG_BEFORE:','CONFIG_AFTER:'))];require(len(configs)==2 and configs[0]==configs[1],'Local settings leaked after error');state_ok();passed(EXPECTED[5])
    output,_=query("SET transaction_timeout='120s';\n"+sql+"\nSELECT 'INHERITED:'||current_setting('transaction_timeout')::interval;",'inherited-timeout','NC_ENVELOPE_INHERITED_TIMEOUT',continue_on_error=True);require('INHERITED:00:02:00' in output,'Inherited setting changed');state_ok();passed(EXPECTED[6])
    hold('supabase_migrations.schema_migrations','nc_envelope_ledger_holder')
    try:
        _,elapsed=query(sql,'ledger-nowait','could not obtain lock on relation');require(elapsed<5,'NOWAIT did not fail promptly')
    finally:release('nc_envelope_ledger_holder')
    state_ok();passed(EXPECTED[7],elapsedSeconds=elapsed)
    query('CREATE TABLE public.nc_lock_probe(id integer);','lock-probe-create');hold('public.nc_lock_probe','nc_envelope_probe_holder')
    try:
        changed=injected(INSERT,'  INSERT INTO public.nc_lock_probe VALUES (2);')
        _,elapsed=query(changed,'lock-timeout','canceling statement due to lock timeout');require(4<=elapsed<=15,'Lock timeout duration unexpected')
    finally:release('nc_envelope_probe_holder')
    state_ok();require(query('SELECT count(*) FROM public.nc_lock_probe;','lock-probe-empty')[0]=='0','Contended probe write survived rollback');query('DROP TABLE public.nc_lock_probe;','lock-probe-cleanup');passed(EXPECTED[8],elapsedSeconds=elapsed)
    changed=injected(INSERT,'  CREATE TABLE public.nc_atomic_rollback_probe(id integer);\n  INSERT INTO public.nc_atomic_rollback_probe VALUES (1);\n  PERFORM pg_sleep(120);')
    _,elapsed=query(changed,'transaction-timeout','terminating connection due to transaction timeout',timeout=85);require(45<=elapsed<=80,'Transaction timeout duration unexpected');state_ok();passed(EXPECTED[9],elapsedSeconds=elapsed)
    require([r['name'] for r in record['cases']]==EXPECTED,'Case coverage mismatch');record['status']='pass';(OUT/'catalog-after.json').write_text(snap()+'\n');(OUT/'ledger-final.json').write_text(ledger()+'\n')
except BaseException as exc:
    record['status']='fail';record['error']=str(exc);(OUT/'failure.log').write_text(traceback.format_exc())
finally:
    if owned and re.fullmatch('[0-9a-f]{64}',owned):
        try:
            logs=docker(['logs',owned],text=True,capture_output=True,timeout=10);(OUT/'container.log').write_text(logs.stdout+logs.stderr)
            logs=docker(['exec',owned,'cat','/tmp/postgres.log'],text=True,capture_output=True,timeout=10);(OUT/'postgres.log').write_text(logs.stdout+logs.stderr)
        except Exception as exc:record['logCopyError']=str(exc)
        try:
            removed=docker(['rm','--force','--volumes',owned],capture_output=True,timeout=30);record['containerRemoved']=removed.returncode==0
        except Exception as exc:record['cleanupError']=str(exc)
    if not record['containerRemoved']:record['status']='fail'
    for child,app in holders:
        if child.poll() is None:
            child.terminate()
            try:child.communicate(timeout=5)
            except subprocess.TimeoutExpired:child.kill();child.communicate()
    save();scratch.cleanup()
print(json.dumps({'status':record['status'],'cases':len(record['cases']),'head':head,'evidence':str(OUT.relative_to(ROOT))}))
raise SystemExit(0 if record['status']=='pass' else 1)
