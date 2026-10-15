#!/usr/bin/env python3
"""Database-free assertion, refusal, and lexical contracts. Not SQL execution."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('demo_guard_static',HERE/'concurrency.py')
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
spec=importlib.util.spec_from_file_location('demo_guard_adapter',HERE/'run-actions.py')
a=importlib.util.module_from_spec(spec);sys.modules[spec.name]=a;spec.loader.exec_module(a)

class Contracts(unittest.TestCase):
 def test_hash_constants(self):
  self.assertRegex(m.EXPECTED_SOURCE_SHA256,r'^[a-f0-9]{64}$')
  self.assertRegex(m.EXPECTED_BODY_SHA256,r'^[a-f0-9]{64}$')
  self.assertRegex(m.EXPECTED_BODY_MD5,r'^[a-f0-9]{32}$')
 def test_good_outcome(self):m.outcome_ok({'ok':True,'value':True})
 def test_wrong_outcomes(self):
  for data in ({'ok':True,'value':False},{'ok':False,'sqlstate':'55P03'},{'ok':None}):
   with self.subTest(data=data),self.assertRaises(RuntimeError):m.outcome_ok(data)
 def test_only_lock_error_counts(self):
  m.outcome_error({'ok':False,'sqlstate':'55P03'},'55P03')
  for state in ('P0001','23503','23502','57014','40P01','42501',None):
   with self.subTest(state=state),self.assertRaises(RuntimeError):m.outcome_error({'ok':False,'sqlstate':state},'55P03')
  with self.assertRaises(RuntimeError):m.outcome_error({'ok':True,'sqlstate':'55P03'},'55P03')
 def test_absent_clone(self):self.assertFalse(m.owned_clone_present([],123))
 def test_owned_integer_oid(self):self.assertTrue(m.owned_clone_present([{'owner':'postgres','oid':123}],123))
 def test_ambiguous_create_reconciliation(self):self.assertTrue(m.owned_clone_present([{'owner':'postgres','oid':123}],None))
 def test_refuse_oid_wire_string_bool_missing_wrong_owner(self):
  for rows in ([{'owner':'postgres','oid':'123'}],[{'owner':'postgres','oid':True}],[{'owner':'postgres','oid':0}],[{'owner':'else','oid':123}],[{'owner':'postgres','oid':124}],[{}],[{'owner':'postgres','oid':123}]*2):
   with self.subTest(rows=rows),self.assertRaises(RuntimeError):m.owned_clone_present(rows,123)
 def test_cleanup_oid_numeric_projection(self):self.assertIn('oid::bigint',a.clone_identity_sql('test'))
 def test_relation_lock_specificity(self):
  proof={'locks':[{'pid':1,'mode':'ShareRowExclusiveLock','granted':True},{'pid':2,'mode':'RowExclusiveLock','granted':False}]}
  self.assertTrue(m.has_lock(proof,1,'ShareRowExclusiveLock'))
  self.assertTrue(m.has_lock(proof,2,'RowExclusiveLock',False))
  for pid,mode,granted in ((2,'RowExclusiveLock',True),(1,'AccessExclusiveLock',True),(3,'ShareRowExclusiveLock',True)):
   self.assertFalse(m.has_lock(proof,pid,mode,granted))
 def test_multiple_json_refused(self):
  with self.assertRaises(RuntimeError):m.one_json('{}\n{}','bad')
 def test_missing_optin_before_connection(self):
  with patch.dict(os.environ,{},clear=True),self.assertRaises(RuntimeError):m.run_concurrency(SimpleNamespace())
 def test_source_database_refused(self):
  with patch.dict(os.environ,{'DEMO_GUARD_DISPOSABLE':'1'},clear=True),self.assertRaises(RuntimeError):m.run_concurrency(SimpleNamespace(database='postgres'))
 def test_adapter_refuses_outside_actions_without_process(self):
  with patch.dict(os.environ,{},clear=True),patch.object(a.subprocess,'run',side_effect=AssertionError('Must not spawn')),self.assertRaises(RuntimeError):a.main()
 def test_adapter_refuses_remote_routing_without_process(self):
  env={'GITHUB_ACTIONS':'true','ISOLATED_QA_DB':'1','DEMO_GUARD_DISPOSABLE':'1','DEMO_GUARD_POSTGRES_SERVICE_ID':'a'*64,'POSTGRES_IMAGE':a.PIN,'DATABASE_URL':'postgres://external.invalid'}
  with patch.dict(os.environ,env,clear=True),patch.object(a.subprocess,'run',side_effect=AssertionError('Must not spawn')),self.assertRaises(RuntimeError):a.main()
 def test_cli_refusal(self):
  p=subprocess.run([sys.executable,str(HERE/'concurrency.py')],capture_output=True,text=True)
  self.assertNotEqual(p.returncode,0);self.assertIn('Standalone database CLI refused',p.stderr)
 def test_fixture_transaction_only(self):
  sql=(HERE/'fixture.sql').read_text()+(HERE/'insert-parents.sql').read_text()
  self.assertNotRegex(sql,r'(?im)^\s*COMMIT\b')
  self.assertNotRegex(sql,r'(?i)DISABLE\s+TRIGGER|DROP\s+CONSTRAINT|session_replication_role')
  self.assertEqual(re.findall(r'CREATE OR REPLACE FUNCTION public\.(\w+)',sql),['seed_demo_organization_core'])
  self.assertEqual(sql.count('FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.demo_forbid_dml()'),4)
  self.assertNotRegex(sql,r'(?i)(INSERT INTO|UPDATE|DELETE FROM|TRIGGER[^;]+ ON)\s+public\.anticipos_aplicaciones')
  self.assertIn("set_config('role','service_role',true)",sql)
  self.assertIn("'DEMO_TEST_UNEXPECTED_CORE'",sql)
  self.assertIn("'DEMO_TEST_UNEXPECTED_DML'",sql)
 def test_customer_fixture_supplies_nonempty_unique_email(self):
  # The real _normalizar_email trigger maps the empty default to NULL, while
  # clientes.email is NOT NULL. Keep the synthetic email UUID-distinct.
  sql=(HERE/'fixture.sql').read_text()
  self.assertIn("INSERT INTO public.clientes(id,organization_id,nombre,email)",sql)
  self.assertIn("'demo-customer-'||customer||'@example.invalid'",sql)
 def test_effective_disabled_suite_never_replaces_protected_functions(self):
  root=HERE.parents[2]
  sql=(root/'supabase/tests/rls/test_rls_demo_seed_disabled.sql').read_text()
  self.assertNotIn('CREATE OR REPLACE FUNCTION public.',sql)
  self.assertIn('count(*)=45',sql)
  self.assertIn('qa_stop_dml_attempts',sql)
  self.assertIn('attempted DML despite eventual rollback',sql)
  self.assertIn('run_disabled_matrix', (HERE/'run-actions.py').read_text())
  self.assertNotIn('result=m.run_concurrency', (HERE/'run-actions.py').read_text())
 def test_final_snapshot_isolation_matrices_are_exact_real_function_contract(self):
  root=HERE.parents[2];base=(root/'supabase/tests/rls/test_rls_demo_seed_disabled.sql').read_text()
  for suffix,level in [('repeatable_read','REPEATABLE READ'),('serializable','SERIALIZABLE')]:
   sql=(root/f'supabase/tests/rls/test_rls_demo_seed_disabled_{suffix}.sql').read_text()
   self.assertEqual(sql,base.replace('BEGIN;\n','BEGIN;\nSET TRANSACTION ISOLATION LEVEL '+level+';\n',1))
   self.assertNotIn('CREATE OR REPLACE FUNCTION public.',sql)
 def test_both_phases_and_persisted_verification_are_required(self):
  final=(HERE/'run-actions.py').read_text()
  self.assertLess(final.index('result=run_disabled_matrix(context)'),final.index("item['persisted']=run_persisted_matrix(context)"))
  self.assertIn("result.get('status')=='pass'",final)
  historical=(HERE/'run-prefreeze-actions.py').read_text()
  self.assertIn('result = m.run_concurrency(',historical)
  self.assertIn("for iteration in (1,2)",historical)
  self.assertIn("checkpoint['executions'] = 1",historical)
  workflow=(HERE.parents[2]/'.github/workflows/rls-tests.yml').read_text()
  self.assertIn("DEMO_PREFREEZE_CI: '1'",workflow)
  self.assertIn('DEMO_GUARD_POSTGRES_SERVICE_ID: ${{ job.services.postgres.id }}',workflow)
  self.assertIn('python3 scripts/ci/demo-guard/test_persisted.py',workflow)
 def test_graph_catalog_discovery(self):
  sql=(HERE/'graph.sql').read_text()
  self.assertIn('WITH RECURSIVE',sql);self.assertIn("fk.contype = 'f'",sql)
  self.assertIn("'auth.users'",sql);self.assertIn("'public.anticipos_aplicaciones'",sql)
  self.assertNotIn('convalidated',sql)
 def test_advisory_key_and_cycle_bounds(self):
  self.assertNotEqual(m.BARRIER,(0,0))
  self.assertIn("SET deadlock_timeout='30s'",m.SESSION_HELPERS)
  self.assertIn("lock_timeout='3s'",(HERE/'concurrency.py').read_text())
  self.assertIn('pg_advisory_xact_lock(190132,210013)',(HERE/'fixture.sql').read_text())
 def test_adapter_no_setup_or_force_teardown(self):
  source=(HERE/'run-actions.py').read_text()
  self.assertNotRegex(source,r'docker.{0,10}(run|pull|create|start)')
  self.assertNotIn('WITH (FORCE)',source);self.assertNotIn('DROP DATABASE postgres',source)
  self.assertIn("for iteration in (1,2)",source)
  self.assertIn('source_before==source_after',source)
  self.assertIn("'source_preserved']=True",source)
 def test_wait_gate_negative_missing_graph_lock(self):
  h=SimpleNamespace(deadline=m.time.monotonic()+10,query=lambda *x:{'blockers':[2],'waiting':True,'held':[10]},events=[])
  with self.assertRaises(RuntimeError):m.wait_gate(h,SimpleNamespace(pid=1),SimpleNamespace(pid=2),[10,11])
 def test_wait_gate_positive_exact_catalog_graph(self):
  h=SimpleNamespace(deadline=m.time.monotonic()+10,query=lambda *x:{'blockers':[2],'waiting':True,'held':[10,11]},events=[])
  m.wait_gate(h,SimpleNamespace(pid=1,pending='marker',lines=SimpleNamespace(empty=lambda:True)),SimpleNamespace(pid=2),[10,11])
  self.assertEqual(len(h.events),1)
 def test_released_rejects_leftover(self):
  with self.assertRaises(RuntimeError):m.assert_released(SimpleNamespace(query=lambda *x:{'remaining':1}),[1,2])
 def test_cleanup_continues_after_first_session_failure(self):
  seen=[]
  def bad():seen.append('bad');raise RuntimeError('cleanup failed')
  errors=m.close_sessions([SimpleNamespace(close=bad),SimpleNamespace(close=lambda:seen.append('good'))])
  self.assertEqual(seen,['bad','good']);self.assertEqual(len(errors),1)
 def test_source_pin_rejects_different_bytes(self):
  from unittest.mock import MagicMock
  root=MagicMock();root.__truediv__.return_value.read_bytes.return_value=b'different function'
  with self.assertRaises(RuntimeError):m.verify_source(root)
 def test_full_app_scope(self):
  for token in ("('public','auth')",'to_jsonb(t)','pg_proc','pg_constraint','pg_trigger','pg_policy','pg_class'):
   self.assertIn(token,m.FINGERPRINT_SQL)

if __name__=='__main__':unittest.main()
