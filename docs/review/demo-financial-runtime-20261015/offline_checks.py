#!/usr/bin/env python3
"""Offline contract checks ONLY. Never execute SQL or Docker."""
import hashlib,importlib.util,json,re,unittest,sys
sys.dont_write_bytecode=True
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('financial_run_ci',ROOT/'run_ci.py')
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class Contracts(unittest.TestCase):
 def test_readiness_excludes_temporary_initdb_server(self):
  self.assertIn('[ "$(cat /proc/1/comm)" = postgres ] && pg_isready',runner.READY_COMMAND)
  self.assertIn('-h /var/run/postgresql -U supabase_admin',runner.READY_COMMAND)
  self.assertIn('[ "$i" -lt 60 ] || exit 1',runner.READY_COMMAND)
  source=(ROOT/'run_ci.py').read_text()
  self.assertLess(source.index("'sh','-c',READY_COMMAND"),source.index('version=sql('))
  self.assertEqual(source.count('CREATE ROLE postgres LOGIN NOSUPERUSER'),1)
 def test_other_creator_is_existing_distinct_user(self):
  source=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn("INSERT INTO auth.users VALUES(other_u,'other-creator@example.invalid')",source)
  self.assertIn('SET created_by=other_u',source)
 def test_rejection_linked_cost_and_incoming(self):
  source=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn('SET concepto_costo_id=cost_id',source)
  self.assertIn('INSERT INTO public.embarque_facturas_entrantes',source)
  self.assertIn("detalles->>'entrantes_rechazados'='1'",source)
 def test_workflow_draft_exact_head_readonly(self):
  text=(ROOT/'workflow/demo-human-approval-review.yml').read_text()
  for required in ["github.event.pull_request.draft == true", "github.event.pull_request.head.repo.full_name == github.repository", "fix/demo-human-approval-review-20261015", "ref: ${{ github.event.pull_request.head.sha }}", "persist-credentials: false", "contents: read", "cancel-in-progress: false"]:self.assertIn(required,text)
  self.assertNotIn('pull_request_target',text)
  self.assertNotIn('secrets.',text)
  self.assertNotIn('write-all',text)
 def test_conditional_expression_is_parenthesized(self):
  source=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn("IS DISTINCT FROM (CASE WHEN approve THEN 'aprobada' ELSE 'rechazada' END) THEN",source)
  self.assertNotIn('IS DISTINCT FROM CASE WHEN',source)
 def test_inputs(self): runner.verify_inputs()
 def test_no_runtime_on_plan(self):
  with patch.object(runner,'command',side_effect=AssertionError('unexpected process')),patch('sys.argv',['run_ci.py']):runner.main()
 def test_local_refused(self):
  for env,optin in [({},True),({'GITHUB_ACTIONS':'true'},True),({'GITHUB_ACTIONS':'true','DEMO_ACCEPTANCE_ISOLATED':'1'},False)]:
   with self.assertRaises(ValueError):runner.guard_execution(env,optin)
 def test_explicit_actions_guard(self):runner.guard_execution({'GITHUB_ACTIONS':'true','DEMO_ACCEPTANCE_ISOLATED':'1'},True)
 def test_body_exact(self):
  text=(ROOT/'sql/05-human-helper.sql').read_text();body=text.split(' AS $$',1)[1].rsplit('$$;',1)[0].strip()
  self.assertEqual(hashlib.sha256(body.encode()).hexdigest(),'d1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0')
 def test_canonical_dependencies(self):
  pins=json.loads((ROOT/'evidence/extraction-hashes.json').read_text())
  for rel,digest in pins.items():self.assertEqual(hashlib.sha256((ROOT/rel).read_bytes()).hexdigest(),digest)
 def test_no_financial_registration(self):self.assertEqual([x[0] for x in runner.SUITES],['human_logic'])
 def test_human_role_cases(self):
  text=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn("ARRAY['contador','admin','admin_org','super_admin']",text)
  self.assertIn("ARRAY['viewer','operador','auxiliar_contable','tesorero']",text)
  self.assertIn('GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT',text)
  self.assertIn('SYNTHETIC_HUMAN_24_ASSERTIONS_COMPLETE',text)
 def test_no_assert_disabled(self):self.assertNotRegex((ROOT/'sql/06-behavior.sql').read_text(),r'\bASSERT\s')
 def test_expected_failures_no_swallow(self):
  text=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn('IF p_error IS NULL OR code<>p_state OR left(msg,length(p_error))<>p_error THEN RAISE',text)
  self.assertIn('IF p_error IS NOT NULL AND NOT caught THEN RAISE',text)
 def test_snapshot_rollback(self):
  text=(ROOT/'sql/06-behavior.sql').read_text()
  self.assertIn('IS DISTINCT FROM before_call',text);self.assertIn('IS DISTINCT FROM before_all',text)
  self.assertIn('ROLLBACK;', (ROOT/'sql/run.sql').read_text())
 def test_nosu(self):
  self.assertIn('NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',(ROOT/'run_ci.py').read_text())
  self.assertIn("rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb",(ROOT/'sql/run.sql').read_text())
 def test_canonical_validator_not_success_stub(self):
  text=(ROOT/'sql/04-validator.sql').read_text()
  for e in ['LC_CXP_DESCUADRE','LC_CXP_SIN_CONCEPTOS','LC_CXP_IVA_IMPLAUSIBLE','LC_CXP_SOBRECOSTO','LC_CXP_EMBARQUE_ORG_MISMATCH']:self.assertIn(e,text)
 def test_fault_targets(self):
  text=(ROOT/'prepared/checkpoint_rollback.sql').read_text()
  for target in ['checkpoint','marker','execution_receipt','event','receipt']:self.assertIn("WHEN '"+target+"'",text)
  self.assertIn("IF s<>'P0T01' OR msg<>expected THEN RAISE",text)
 def test_engine_requires_issued(self):
  for name in ['happy_path.sql','checkpoint_rollback.sql']:
   text=(ROOT/'prepared'/name).read_text();self.assertIn('demo_flow_writer.assert_issued',text)
   self.assertNotIn('INSERT INTO demo_flow_writer.runs',text)
 def test_auth_explicitly_synthetic(self):self.assertIn('NOT externally authenticated identity',(ROOT/'sql/02-synthetic-schema.sql').read_text())
 def test_engine_dependency_gap(self):
  data=json.loads((ROOT/'evidence/engine-dependencies.json').read_text());self.assertEqual(len(data['canonical_baseline_triggers_for_engine_tables']),85)
 def test_status_honest(self):
  s=json.loads((ROOT/'evidence/status.json').read_text());self.assertEqual(s['sql_runtime'],'NOT_RUN');self.assertEqual(s['financial_engine'],'BLOCKED_NOT_RUN')
if __name__=='__main__':unittest.main(verbosity=2)
