import unittest,importlib.util,json,hashlib,re
from pathlib import Path
from unittest.mock import patch
R=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('runner',R/'run_ci.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Contract(unittest.TestCase):
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
