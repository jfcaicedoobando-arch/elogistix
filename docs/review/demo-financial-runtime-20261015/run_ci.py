#!/usr/bin/env python3
"""Opt-in future Actions lane. No subprocess runs on import or --plan."""
import argparse,hashlib,json,os,re,subprocess,sys,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parent
READY_COMMAND='i=0; until [ "$(cat /proc/1/comm)" = postgres ] && pg_isready -h /var/run/postgresql -U supabase_admin; do i=$((i+1)); [ "$i" -lt 60 ] || exit 1; sleep 1; done'
IMAGE='postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'
SUITES=[('human_logic','sql/run.sql','EXACT_HUMAN_HELPER_SYNTHETIC_AUTH_REDUCED_FINANCIAL_SCHEMA')]
UNIMPLEMENTED=['durable_dispatch','postgrest_authenticated_transport','full_main_schema_equivalence','atomic_financial_execute_checkpoint','commit_ack_reconciliation','human_authenticated_regression','multi_session_concurrency']
def verify_inputs():
 for row in json.loads((ROOT/'inputs.json').read_text()):
  p=ROOT/row['path']
  if p.is_symlink() or ROOT not in p.resolve().parents: raise ValueError('input escapes package')
  b=p.read_bytes()
  if len(b)!=row['bytes'] or hashlib.sha256(b).hexdigest()!=row['sha256']: raise ValueError('input hash drift: '+row['path'])
def guard_execution(env,optin):
 if not optin or env.get('GITHUB_ACTIONS')!='true' or env.get('DEMO_ACCEPTANCE_ISOLATED')!='1':
  raise ValueError('Only explicitly opted-in isolated GitHub Actions execution is supported')
def command(args,stdin=None,timeout=90,check=True):
 # No .env, connection string, inherited PG config or Docker remote accepted.
 env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'LANG':'C.UTF-8','HOME':'/tmp'}
 return subprocess.run(args,input=stdin,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout,check=check,env=env)
def inspect_owned(cid,token):
 r=command(['docker','inspect',cid]); obj=json.loads(r.stdout)[0]
 if obj['Config'].get('Image')!=IMAGE or obj['Config']['Labels'].get('demo.acceptance.owner')!=token or obj['HostConfig']['NetworkMode']!='none' or obj['HostConfig'].get('PortBindings') or obj.get('Mounts') and any(m.get('Type')=='bind' for m in obj['Mounts']) or obj['HostConfig'].get('Privileged'):
  raise RuntimeError('Container ownership/isolation mismatch')
 return obj

def resolve_created_container(name,token):
 obj=inspect_owned(name,token)
 if obj.get('Name')!='/'+name: raise RuntimeError('Unexpected inspected container name')
 cid=obj.get('Id','')
 if not re.fullmatch('[0-9a-f]{64}',cid): raise RuntimeError('Unexpected inspected container ID')
 return cid

def run(output):
 verify_inputs(); output.mkdir(parents=True,exist_ok=False)
 token=uuid.uuid4().hex; cid=None; created=False; clean=False; reports=[]
 # Fixed generated name permits cleanup after uncertain create response; never reused.
 name='demo-acceptance-'+token
 try:
  # --network none and no publish/mount: no application cluster can be reached.
  r=command(['docker','create','--name',name,'--label','demo.acceptance.owner='+token,'--network','none',
    '-e','POSTGRES_USER=supabase_admin','-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE,'-c','listen_addresses=','-c','unix_socket_directories=/var/run/postgresql'],timeout=180)
  created=True
  (output/'docker-create.log').write_text(r.stdout)
  # create can pull an uncached image; stderr progress is combined in command().
  # Resolve identity from the unique name plus verified ownership/isolation, never
  # from informational output or an arbitrary hex line inside it.
  cid=resolve_created_container(name,token)
  inspect_owned(cid,token); command(['docker','start',cid])
  # The image first runs a temporary initialization server, then shuts it down.
  # Require PID 1 to be the final postgres exec before checking the socket;
  # this is a precondition wait, never a retry of candidate SQL or bootstrap DML.
  command(['docker','exec',cid,'sh','-c',READY_COMMAND],timeout=75)
  def sql(db,text,user='postgres'):
   inspect_owned(cid,token)
   r=command(['docker','exec','-i',cid,'psql','-X','-h','/var/run/postgresql','-U',user,'-d',db,'-v','ON_ERROR_STOP=1','-At'],text,120,check=False)
   with (output/'psql.log').open('a') as log: log.write('\nDATABASE '+db+'\n'+r.stdout)
   if r.returncode: raise RuntimeError('SQL stage failed; see psql.log')
   return r.stdout
  version=sql('postgres',"SELECT current_setting('server_version_num')||':'||current_user||':'||(SELECT rolsuper FROM pg_roles WHERE rolname=current_user);\n",user='supabase_admin')
  if version.strip()!='170006:supabase_admin:true': raise RuntimeError('Version/bootstrap identity mismatch: '+version)
  sql('postgres',"CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN;\n",user='supabase_admin')
  inspect_owned(cid,token); command(['docker','cp',str(ROOT/'sql'),cid+':/tmp/sql'])
  for key,rel,coverage in SUITES:
   db='demo_flow_disposable_'+key+'_'+token[:12]
   sql('postgres','CREATE DATABASE '+db+' OWNER postgres;\n',user='supabase_admin')
   role=sql(db,"SELECT current_user||':'||rolsuper||':'||rolbypassrls||':'||rolcreaterole||':'||rolcreatedb FROM pg_roles WHERE rolname=current_user;\n")
   if role.strip()!='postgres:false:false:false:false': raise RuntimeError('Candidate owner privilege mismatch: '+role)
   marker='CASE_COMPLETE_'+key+'_'+token
   script="\\i /tmp/"+rel+"\nSELECT '"+marker+"';\n"
   log=sql(db,script); (output/(key+'.log')).write_text(log)
   if log.splitlines().count(marker)!=1 or log.splitlines().count('SYNTHETIC_HUMAN_24_ASSERTIONS_COMPLETE')!=1 or log.splitlines().count('SYNTHETIC_HUMAN_ROLLBACK_COMPLETE')!=1 or 'PENDING:' in log: raise RuntimeError('Incomplete or skipped suite '+key)
   reports.append({'suite':key,'status':'PASS','coverage':coverage,'authentic_origin_contract_tested':False,'real_user_authority_certified':False})
 finally:
  # Creation can succeed even if output is interrupted; resolve exact unique name.
  lookup=command(['docker','inspect',name],check=False)
  if lookup.returncode==0:
   obj=inspect_owned(name,token); cid=obj['Id']
   volumes=[m['Name'] for m in obj.get('Mounts',[]) if m.get('Type')=='volume']
   if obj['State']['Running']:
    command(['docker','stop','--time','10',cid],timeout=30)
   if inspect_owned(cid,token)['State']['Running']: raise RuntimeError('Container still running')
   command(['docker','rm','-v',cid])
   remaining_volumes=command(['docker','volume','ls','--format','{{.Name}}']).stdout.splitlines()
   if any(v in remaining_volumes for v in volumes): raise RuntimeError('Owned anonymous volume remains')
  elif created:
   raise RuntimeError('Owned container vanished before cleanup was established')
  remaining=command(['docker','ps','-a','--filter','label=demo.acceptance.owner='+token,'--format','{{.ID}}'])
  if remaining.stdout.strip(): raise RuntimeError('Owned container remains')
  clean=True
  result={'suites':reports,'cleanup_verified':clean,'integration':'PARTIAL_SYNTHETIC_HUMAN_LOGIC_ONLY',
    'unimplemented':UNIMPLEMENTED,'demo':'BLOCKED','overall':'PARTIAL' if len(reports)==len(SUITES) else 'FAIL'}
  (output/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 return result

def main():
 p=argparse.ArgumentParser();p.add_argument('--execute-disposable',action='store_true');p.add_argument('--output',type=Path);a=p.parse_args()
 verify_inputs()
 if not a.execute_disposable:
  print(json.dumps({'prepared_suites':SUITES,'not_implemented':UNIMPLEMENTED,'runtime':'NOT_RUN'}));return
 guard_execution(os.environ,a.execute_disposable)
 if not a.output: p.error('--output must be a new directory')
 print(json.dumps(run(a.output)))
if __name__=='__main__': main()
