import ast,hashlib,json,re,tempfile,unittest
from pathlib import Path
from adapter import fixture_sql,verify_inputs
from canonical_cases import witness
ROOT=Path(__file__).parent
class CanonicalLane(unittest.TestCase):
 def test_inputs(self): self.assertEqual(len(verify_inputs()['files']),4)
 def test_historical_bytes_match_repository(self):
  entries=json.loads((ROOT.parents[2]/'drizzle/replay.json').read_text());expected={x['file']:x['sha256'] for x in entries}
  for path in (ROOT/'inputs/sources').glob('*.sql'):self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(),expected[path.name])
 def test_fixture_has_real_history(self):
  sql=fixture_sql()
  for name in ['_crm_empresa_desde_cliente','_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico','aplica_iva']:self.assertIn(name,sql)
  self.assertNotIn('\\ir ',sql)
 def test_witness_exact_payload_once(self):
  candidate='DO $x$ BEGIN NULL; END $x$;\n';sql=witness(candidate)
  self.assertEqual(sql.count(candidate),1);self.assertTrue(sql.startswith('BEGIN;'));self.assertTrue(sql.endswith('COMMIT;'))
  self.assertLess(sql.index('statement_timeout'),sql.index(candidate));self.assertIn(hashlib.sha256(candidate.encode()).hexdigest(),sql)
 def test_abort_after_mutation_and_registry(self):
  sql=witness('EXACT_CANONICAL_SENTINEL;',True)
  self.assertLess(sql.index('EXACT_CANONICAL_SENTINEL'),sql.index('INSERT INTO public.synthetic_registry'));self.assertLess(sql.index('INSERT INTO public.synthetic_registry'),sql.index('SYNTHETIC_ROLLBACK_WITNESS'))
 def test_registry_references_are_schema_qualified_after_canonical_search_path(self):
  sql=witness("DO $$ BEGIN PERFORM set_config('search_path','pg_catalog',true); END $$;",True)
  self.assertIn('LOCK TABLE public.synthetic_registry',sql)
  self.assertIn('INSERT INTO public.synthetic_registry',sql)
  self.assertNotRegex(sql,r'(?<![\w.])synthetic_registry\b')
 def test_no_rebinding(self):
  sql=(ROOT/'run_ci.py').read_text();self.assertNotIn('bind_candidate',sql);self.assertIn("candidate_transformations']=[]",sql)
 def test_matrix_count(self):
  tree=ast.parse((ROOT/'cases.py').read_text());d=next(n.value for n in ast.walk(tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='mutations' for t in n.targets))
  self.assertEqual(3+1+len(d.keys)+4+2+2+8,52)
 def test_scope_is_honest(self):
  s=(ROOT/'run_ci.py').read_text();self.assertIn('NOT full ERP migration replay',s);self.assertIn('NOT_RUN_CANONICAL_LANE',s);self.assertIn('NOT operational direct wrapper',s)
 def test_candidate_pin(self):
  candidate=(ROOT.parents[2]/'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes();self.assertIn(hashlib.sha256(candidate).hexdigest(),(ROOT/'run_ci.py').read_text())
if __name__=='__main__':unittest.main()
