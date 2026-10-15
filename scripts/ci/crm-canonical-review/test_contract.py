"""Offline source/manifest contracts. Does not claim PostgreSQL execution."""
import hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
TAG='0021_crm_helpers_owner_only'; MIRROR='20261015194324_crm_helpers_owner_only.sql'
SHA='32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
class Contract(unittest.TestCase):
 def setUp(self): self.sql=(ROOT/'drizzle/migrations'/f'{TAG}.sql').read_text()
 def test_exact_reviewed_payload(self): self.assertEqual(hashlib.sha256(self.sql.encode()).hexdigest(),SHA)
 def test_exact_mirror(self): self.assertEqual(self.sql,(ROOT/'supabase/migrations'/MIRROR).read_text())
 def test_sources(self):
  src=(ROOT/'drizzle/migrations/0017_crm_empresa_no_borrar_cliente.sql').read_text()
  pairs=re.findall(r'CREATE OR REPLACE FUNCTION public\.(\w+)\(\).*?AS \$\$(.*?)\$\$;',src,re.S)
  self.assertEqual(len(pairs),2)
  for name,body in pairs: self.assertIn('"'+name+'": "'+hashlib.sha256(body.encode()).hexdigest()+'"',self.sql)
 def test_two_revokes_no_other_mutations(self):
  s=re.sub(r'--[^\n]*','',self.sql)
  self.assertEqual(len(re.findall(r'\bREVOKE EXECUTE ON FUNCTION public\._crm_empresa_no_\w+\(\) FROM service_role RESTRICT;',s)),2)
  self.assertNotRegex(s,r'(?i)\b(GRANT|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:FUNCTION|TRIGGER|TABLE|INTO|ON|FROM|EXECUTE)\b')
 def test_no_transaction_split(self):
  self.assertEqual(self.sql.count('DO $crm_acl$'),1);self.assertNotIn('COMMIT;',self.sql);self.assertNotIn('BEGIN;',self.sql)
 def test_journal(self):
  e=json.loads((ROOT/'drizzle/migrations/meta/_journal.json').read_text())['entries']
  self.assertEqual(e[-1],dict(idx=21,version='7',when=1792093404000,tag=TAG,breakpoints=True));self.assertGreater(e[-1]['when'],e[-2]['when'])
 def test_replay(self):
  e=json.loads((ROOT/'drizzle/replay.json').read_text())
  self.assertEqual([x for x in e if x['file']==TAG+'.sql'],[dict(file=TAG+'.sql',sha256=SHA,replays=[MIRROR])])
 def test_snapshot_schema_unchanged(self):
  a=json.loads((ROOT/'drizzle/migrations/meta/0020_snapshot.json').read_text());b=json.loads((ROOT/'drizzle/migrations/meta/0021_snapshot.json').read_text())
  self.assertEqual(b.pop('prevId'),a.pop('id'));a.pop('prevId');b.pop('id');self.assertEqual(a,b)
 def test_release_unique(self):
  m=json.loads((ROOT/'supabase/releases/migration-manifest.json').read_text());self.assertEqual(sum(v['migrations'].count(MIRROR) for v in m.values()),1)
 def test_immutable_snapshot(self):
  self.assertIn('FROM jsonb_array_elements(snapshot_rows)',self.sql)
  self.assertIn('jsonb_to_recordset(before_links)',self.sql)
  self.assertIn('before_rows IS DISTINCT FROM after_rows OR before_links IS DISTINCT FROM after_links OR before_aux IS DISTINCT FROM after_aux',self.sql)
 def test_not_private_instance_bound(self):
  self.assertNotRegex(self.sql,r'(?i)\b(xmin|ctid)\b|production-contract|\$contract\$|"oid"\s*:')
  self.assertNotIn('LOCK TABLE pg_catalog.',self.sql)
 def test_role_effective_checks(self):
  for role in ['anon','authenticated','service_role']:self.assertIn("has_function_privilege('"+role+"',p.oid,'EXECUTE')",self.sql)
 def test_limit_disclosed(self): self.assertIn('F2 transient grant-option normalization',self.sql)
if __name__=='__main__': unittest.main()
