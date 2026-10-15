import unittest,importlib.util,json,hashlib,re
from pathlib import Path
from unittest.mock import patch
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('runner',R/'run_ci.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Contract(unittest.TestCase):
 def test_created_id_comes_from_inspected_owned_name(self):
  with patch.object(runner,'inspect_owned',return_value={'Id':'a'*64,'Name':'/unique-name'}) as inspect:
   self.assertEqual(runner.resolve_created_container('unique-name','owner-token'),'a'*64)
   inspect.assert_called_once_with('unique-name','owner-token')
 def test_malformed_inspected_id_rejected(self):
  for value in ['', 'a'*63, 'image progress\n'+'a'*64]:
   with patch.object(runner,'inspect_owned',return_value={'Id':value,'Name':'/unique-name'}):
    with self.assertRaises(RuntimeError):runner.resolve_created_container('unique-name','owner-token')
 def test_create_output_is_diagnostic_not_identity(self):
  s=(R/'run_ci.py').read_text();self.assertNotIn('cid=r.stdout.strip()',s)
  self.assertIn("(output/'docker-create.log').write_text(r.stdout)",s)
 def test_wrong_owner_or_image_rejected(self):
  from types import SimpleNamespace
  base={'Id':'a'*64,'Name':'/unique-name','Config':{'Labels':{'demo.acceptance.owner':'owner-token'},'Image':runner.IMAGE},'HostConfig':{'NetworkMode':'none','PortBindings':{},'Privileged':False},'Mounts':[]}
  for kind in ['label','image','network','bind']:
   obj=json.loads(json.dumps(base))
   if kind=='label':obj['Config']['Labels']['demo.acceptance.owner']='other'
   if kind=='image':obj['Config']['Image']='untrusted:latest'
   if kind=='network':obj['HostConfig']['NetworkMode']='host'
   if kind=='bind':obj['Mounts']=[{'Type':'bind'}]
   with patch.object(runner,'command',return_value=SimpleNamespace(stdout=json.dumps([obj]))):
    with self.assertRaises(RuntimeError):runner.resolve_created_container('unique-name','owner-token')
 def test_wrong_inspected_name_rejected(self):
  with patch.object(runner,'inspect_owned',return_value={'Id':'a'*64,'Name':'/other'}):
   with self.assertRaises(RuntimeError):runner.resolve_created_container('unique-name','owner-token')
 def test_uncertain_create_cleans_exact_owned_container_without_retry(self):
  import tempfile,subprocess
  from types import SimpleNamespace
  token='b'*32;name='demo-acceptance-'+token;calls=[]
  obj={'Id':'a'*64,'Name':'/'+name,'Config':{'Labels':{'demo.acceptance.owner':token},'Image':runner.IMAGE},'HostConfig':{'NetworkMode':'none','PortBindings':{},'Privileged':False},'Mounts':[],'State':{'Running':False}}
  def cmd(args,*a,**kw):
   calls.append(args)
   if args[:2]==['docker','create']:raise subprocess.TimeoutExpired(args,180,output='pull progress\n')
   if args[:2]==['docker','inspect']:return SimpleNamespace(stdout=json.dumps([obj]),returncode=0)
   return SimpleNamespace(stdout='',returncode=0)
  with tempfile.TemporaryDirectory() as tmp,patch.object(runner.uuid,'uuid4',return_value=SimpleNamespace(hex=token)),patch.object(runner,'command',side_effect=cmd):
   output=Path(tmp)/'evidence'
   with self.assertRaises(subprocess.TimeoutExpired):runner.run(output)
   result=json.loads((output/'result.json').read_text());self.assertTrue(result['cleanup_verified']);self.assertEqual(result['overall'],'FAIL')
  self.assertEqual(sum(c[:2]==['docker','create'] for c in calls),1)
  self.assertIn(['docker','rm','-v','a'*64],calls)
  self.assertFalse(any(c[:2]==['docker','start'] for c in calls))
 def test_mixed_create_output_uses_verified_identity(self):
  import tempfile
  from types import SimpleNamespace
  token='b'*32;name='demo-acceptance-'+token;calls=[]
  obj={'Id':'a'*64,'Name':'/'+name,'Config':{'Labels':{'demo.acceptance.owner':token},'Image':runner.IMAGE},'HostConfig':{'NetworkMode':'none','PortBindings':{},'Privileged':False},'Mounts':[],'State':{'Running':False}}
  def cmd(args,*a,**kw):
   calls.append(args)
   if args[:2]==['docker','create']:return SimpleNamespace(stdout='Unable to find image locally\nPull complete\n'+'c'*64+'\n',returncode=0)
   if args[:2]==['docker','inspect']:return SimpleNamespace(stdout=json.dumps([obj]),returncode=0)
   if args[:2]==['docker','start']:raise RuntimeError('stop_after_identity')
   return SimpleNamespace(stdout='',returncode=0)
  with tempfile.TemporaryDirectory() as tmp,patch.object(runner.uuid,'uuid4',return_value=SimpleNamespace(hex=token)),patch.object(runner,'command',side_effect=cmd):
   output=Path(tmp)/'evidence'
   with self.assertRaisesRegex(RuntimeError,'stop_after_identity'):runner.run(output)
   self.assertIn('Pull complete',(output/'docker-create.log').read_text())
  self.assertIn(['docker','start','a'*64],calls)
  self.assertEqual(sum(c[:2]==['docker','create'] for c in calls),1)
 def test_readiness_excludes_temporary_entrypoint_server(self):
  self.assertIn('[ "$(cat /proc/1/comm)" = postgres ] && pg_isready',runner.READY_COMMAND)
  self.assertIn('-h /var/run/postgresql -U supabase_admin',runner.READY_COMMAND)
  self.assertIn('[ "$i" -lt 60 ] || exit 1',runner.READY_COMMAND)
  s=(R/'run_ci.py').read_text()
  self.assertLess(s.index("'sh','-c',READY_COMMAND"),s.index('version=sql('))
  self.assertEqual(s.count('CREATE ROLE postgres LOGIN NOSUPERUSER'),1)
 def test_frozen_inputs(self):runner.verify_inputs()
 def test_no_execution_without_both_real_actions_and_optin(self):
  for env,opt in [({},True),({'GITHUB_ACTIONS':'true'},True),({'GITHUB_ACTIONS':'true','DEMO_ACCEPTANCE_ISOLATED':'1'},False)]:
   with self.assertRaises(ValueError):runner.guard_execution(env,opt)
 def test_runner_plan_has_no_subprocess(self):
  with patch.object(runner.subprocess,'run',side_effect=AssertionError('unexpected execution')):
   runner.verify_inputs()
 def test_no_source_authentication_doubles(self):
  text='\n'.join(p.read_text() for p in (R/'sql').glob('*.sql'))
  self.assertNotRegex(text,r'(?i)CREATE (?:OR REPLACE )?FUNCTION auth\.uid')
  self.assertNotIn('SELECT NULL::uuid',text)
  self.assertNotIn('identity-test sentinel',text)
 def test_producer_and_registry_exact(self):
  for x in json.loads((R/'source-pins.json').read_text()):
   if 'sha256' in x:self.assertEqual(hashlib.sha256((R/x['path']).read_bytes()).hexdigest(),x['sha256'])
 def test_no_core_call(self):
  for name in ['setup.sql','synthetic-input.sql','authentic-contract.sql']:
   self.assertNotRegex((R/'sql'/name).read_text(),r'(?i)(?:SELECT|PERFORM|CALL)\s+(?:public\.)?seed_demo_organization_core\(')
 def test_compatibility_roles_are_disposable_nologin(self):
  s=(R/'run_ci.py').read_text();self.assertEqual(len(re.findall(r'CREATE ROLE \w+ NOLOGIN;',s)),3)
  self.assertIn('CREATE ROLE postgres LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',s)
  self.assertIn('postgres:false:false:false:false',s)
  self.assertNotRegex(s,r'(?im)^\s*GRANT\b')
 def test_every_sql_include_exists(self):
  for p in (R/'sql').glob('*.sql'):
   for rel in re.findall(r'^\\ir (.+)$',p.read_text(),re.M):self.assertTrue((p.parent/rel).is_file(),rel)
 def test_exact_success_markers_required(self):
  s=(R/'run_ci.py').read_text()
  for m in ['AUTHENTIC_PRODUCER_REGISTRY_ASSERTIONS_COMPLETE','AUTHENTIC_PRODUCER_ROLLBACK_COMPLETE']:
   self.assertIn("count('"+m+"')!=1",s)
 def test_network_and_environment_isolation(self):
  s=(R/'run_ci.py').read_text()
  for x in ["'--network','none'","'listen_addresses='","'unix_socket_directories=/var/run/postgresql'","'170006:supabase_admin:true'","cid+':/tmp/sql'","check=False"]:self.assertIn(x,s)
  self.assertNotIn('--publish',s);self.assertNotIn('--mount',s)
 def test_partial_never_global_pass(self):
  s=(R/'run_ci.py').read_text();self.assertIn("'overall':'PARTIAL'",s);self.assertIn("'real_user_authority_certified':False",s)
 def test_exact_rejections_and_cross_policy(self):
  s=(R/'sql/authentic-contract.sql').read_text()
  for x in ['DEMO_REGISTRY_IDENTITY_ORIGIN_CONFLICT','DEMO_SPONSOR_ACCOUNT_DISABLED_OR_SCHEMA_UNKNOWN','DEMO_SPONSOR_MEMBERSHIP_REQUIRED','DEMO_SPONSOR_ROLE_REQUIRED','DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED','Rollback left provenance']:self.assertIn(x,s)
if __name__=='__main__':unittest.main(verbosity=2)
