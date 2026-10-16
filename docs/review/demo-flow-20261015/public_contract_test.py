"""Offline assertions for the sanitized review copy; never executes SQL."""
from pathlib import Path
import unittest,json,re,hashlib
R=Path(__file__).resolve().parent
class PublicContract(unittest.TestCase):
 def test_review_order_resolves(self):
  for path in json.loads((R/'review-order.json').read_text()):self.assertTrue((R/path).is_file())
 def test_manifest_declared_hash_matches_exact_json(self):
  s=(R/'sql/02-manifest.sql').read_text();raw=re.search(r'\$manifest\$(.*?)\$manifest\$',s)[1]
  self.assertEqual(json.loads(raw),json.loads((R/'fixtures/manifest.json').read_text()))
  self.assertIn("SELECT '"+hashlib.sha256(raw.encode()).hexdigest()+"'::text",s)
 def test_synthetic_customer_catalog(self):
  s=(R/'identity/proposals/demo-fixture-identity.sql.proposed').read_text()
  catalog=[json.loads(m[1]) for m in re.finditer(r"'({\"nombre\":.+?})'::jsonb",s)]
  self.assertEqual(len(catalog),3)
  for n,c in enumerate(catalog,1):
   self.assertEqual(c['nombre'],f'Synthetic Customer {n}');self.assertEqual(c['contacto'],f'Synthetic Contact {n}')
   self.assertEqual(c['email'],f'customer{n}@example.invalid');self.assertEqual(c['telefono'],'');self.assertEqual(c['rfc'],'')
 def test_synthetic_financial_catalog(self):
  c=json.loads((R/'fixtures/manifest.json').read_text());self.assertEqual(c['organizationId'],'00000000-0000-4000-8000-000000000001')
  for n,f in enumerate(c['fixtures'],1):
   self.assertEqual(f['supplierName'],f'Synthetic Supplier {n}');self.assertEqual(f['supplierRFC'],'');self.assertEqual(f['rfc'],'')
   self.assertEqual(f['folio'],f'SYNTHETIC-INVOICE-{n}')
 def test_current_policy_snapshots(self):
  s=(R/'issuer/16-owner-registry.sql').read_text()
  self.assertIn('VALUES(a.id,t.id,to_jsonb(a),to_jsonb(t),p_identity_receipt,',s)
  for field,v in [('scheduler_snapshot','a'),('transport_snapshot','t')]:
   self.assertIn('c.'+field+' IS DISTINCT FROM to_jsonb(',s)
   self.assertIn("origin->'"+field+"' IS DISTINCT FROM to_jsonb("+v+")",s)
  self.assertIn("origin->>'scheduler_approval_id' IS DISTINCT FROM a.id::text",s)
 def test_pins_match_export(self):
  p=json.loads((R/'issuer/source-pins.json').read_text())
  for key,path in [('human_file_sha256','evidence/main-aprobar_factura_proveedor.sql'),('engine_file_sha256','sql/04-engine.sql')]:
   self.assertEqual(hashlib.sha256((R/path).read_bytes()).hexdigest(),p[key])
 def test_no_automatic_discovery_paths(self):
  for path in ['.github','supabase','drizzle','src','runtime']:
   self.assertFalse((R/path).exists())
 def test_no_private_paths_or_unreserved_emails_in_sources(self):
  for p in R.rglob('*'):
   if not p.is_file() or p.suffix not in ('.sql','.proposed','.ts','.json'):continue
   s=p.read_text();self.assertNotRegex(s,r'/(?:workspace|home|root)/')
   self.assertNotRegex(s,r'[A-Za-z0-9._%+-]+@(?!example\.invalid)[A-Za-z0-9.-]+')
if __name__=='__main__':unittest.main(verbosity=2)
