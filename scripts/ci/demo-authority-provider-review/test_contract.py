"""Offline checks are source/contract evidence only, not native PG authority."""
import importlib.util, json, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('authority_runner',HERE/'run_ci.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
SQL17=(r.SQL/'17-protected-occurrence.sql').read_text();SQL18=(r.SQL/'18-authority-reader.sql').read_text()
class ContractTests(unittest.TestCase):
 def test_upstream_pins_are_exact(self):self.assertEqual(len(r.verify_inputs()['sources']),13)
 def test_run_gate_precedes_every_subprocess(self):
  with patch.dict(os.environ,{},clear=True),patch.object(r,'command') as c:
   with self.assertRaises(ValueError):r.run(Path('/tmp/authority-never-created'),True)
   c.assert_not_called()
 def test_gate_requires_exact_draft(self):
  with tempfile.TemporaryDirectory() as directory:
   event=Path(directory)/'event.json';data={'pull_request':{'draft':True,'head':{'sha':'a'*40,'ref':r.BRANCH,'repo':{'full_name':r.REPOSITORY}},'base':{'ref':'main','sha':'3a7c71fba35c9e7af509a8217a193929da21db9c'}}};event.write_text(json.dumps(data))
   env=dict(GITHUB_ACTIONS='true',DEMO_AUTHORITY_ISOLATED='1',GITHUB_EVENT_NAME='pull_request',GITHUB_REPOSITORY=r.REPOSITORY,GITHUB_HEAD_REF=r.BRANCH,GITHUB_EVENT_PATH=str(event))
   self.assertEqual(r.guard(env,True),'a'*40)
   for key in env:
    bad=dict(env);bad.pop(key)
    with self.subTest(key=key),self.assertRaises((ValueError,KeyError)):r.guard(bad,True)
   data['pull_request']['draft']=False;event.write_text(json.dumps(data))
   with self.assertRaises(ValueError):r.guard(env,True)
 def test_no_environment_database_or_network(self):
  source=(HERE/'run_ci.py').read_text()
  self.assertIn("'--network', 'none'",source);self.assertIn("'-c', 'listen_addresses='",source)
  for value in ['DATABASE_URL','PGPASSWORD','PGHOST','docker.sock','--publish','--privileged']:
   self.assertNotIn(value,source)
 def test_semantic_natural_key_excludes_runtime_identifiers(self):
  self.assertIn('UNIQUE(deployment,organization_id,manifest_identity,scheduler_job,authorized_occurrence)',SQL17)
  self.assertIn('authority_id uuid PRIMARY KEY REFERENCES',SQL17);self.assertIn('context_id uuid NOT NULL UNIQUE REFERENCES',SQL17)
 def test_revocation_and_reader_share_same_lock(self):
  trigger=SQL17.split('CREATE FUNCTION demo_flow_writer.lock_occurrence_revocation()',1)[1].split('END $$;',1)[0]
  reader=SQL17.split('CREATE FUNCTION demo_flow_writer.checked_occurrence',1)[1].split('END $$;',1)[0]
  self.assertIn('WHERE id=NEW.authority_id FOR UPDATE',trigger)
  self.assertIn('WHERE id=p_authority FOR UPDATE',reader)
  self.assertIn('BEFORE INSERT ON demo_flow_writer.occurrence_revocations',SQL17)
 def test_fence_stopped_empty_and_no_activation(self):
  self.assertIn('stopped boolean NOT NULL DEFAULT true',SQL17)
  self.assertNotIn('INSERT INTO demo_flow_writer.authority_fences',SQL17)
  self.assertNotIn('SET stopped=false',SQL17+SQL18)
 def test_source_bound_precision_is_rejected(self):
  self.assertIn("p_value<>date_trunc('milliseconds',p_value)",SQL17)
  self.assertIn('DEMO_AUTHORITY_TIMESTAMP_PRECISION',SQL17)
  self.assertIn('NOT isfinite(p_value)',SQL17)
  self.assertNotIn('date_trunc(\'milliseconds\',p.valid_until)',SQL18)
  self.assertNotIn('date_trunc(\'milliseconds\',u.expires_at)',SQL18)
 def test_read_api_has_only_context_parameter(self):
  self.assertIn('read_authority(p_context uuid) RETURNS jsonb',SQL18)
  self.assertNotIn('p_snapshot',SQL17+SQL18)
  self.assertIn('u:=demo_flow_writer.checked_occurrence(aid)',SQL18)
 def test_original_validators_not_replaced(self):
  for function in ['validated_scheduler','verify_preparation_origin','verify_identity_receipt']:
   self.assertIn(function+'(',SQL17)
   self.assertNotIn('CREATE FUNCTION demo_flow_writer.'+function,SQL17+SQL18)
  self.assertNotIn('CREATE OR REPLACE',SQL17+SQL18)
 def test_no_implicit_execution_or_acl_expansion(self):
  import re
  executable='\n'.join(line for line in (SQL17+SQL18).splitlines() if not line.lstrip().startswith('--'))
  self.assertNotRegex(executable,r'(?i)\b(GRANT|CREATE ROLE|ALTER ROLE)\b')
  self.assertNotIn('SECURITY DEFINER',executable)
  self.assertNotIn('execute_financial',executable)
 def test_new_context_is_explicit_and_existing_context_not_refreshed(self):
  self.assertIn('issue_bound_context(p_authority uuid)',SQL18)
  self.assertIn('issued_by_owner,issued_at,not_before,expires_at)',SQL18)
  self.assertIn('RETURN ctx; -- An expired/revoked binding fails.',SQL18)
  self.assertNotIn('UPDATE demo_flow_writer.server_admissions',SQL18)
 def test_native_result_not_emulated(self):
  code=(HERE/'run_ci.py').read_text()
  self.assertIn("'native-authority.json'",code);self.assertIn('mapDeclaredVerifiedSnapshots',code)
  self.assertIn("wait_activity('authority_revoke_lock', 'Lock:')",code)
  self.assertIn("'restore_durability': 'NOT_ESTABLISHED'",code)
if __name__=='__main__':unittest.main()
