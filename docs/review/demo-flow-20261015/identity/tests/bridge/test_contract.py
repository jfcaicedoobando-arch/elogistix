"""Offline source-contract assertions, not PostgreSQL execution evidence."""
import re, unittest
from pathlib import Path
S=Path(__file__).with_name('prepare_identity_receipt.sql').read_text()
class Contract(unittest.TestCase):
 def test_empty_policy(self):
  self.assertNotRegex(S,r'(?i)INSERT\s+INTO\s+demo_fixture_identity\.preparation_(?:admissions|bindings)\b')
 def test_no_external_authority_or_finance_mutation(self):
  self.assertNotRegex(S,r'(?im)^\s*(?:GRANT|CREATE ROLE|ALTER ROLE)\b')
  self.assertNotRegex(S,r'(?i)(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.')
 def test_owner_and_no_definer(self):
  self.assertNotIn('SECURITY DEFINER',S)
  self.assertIn('session_user::regrole::oid<>owner_id',S)
 def test_full_snapshots(self):
  for field in ('scheduler_snapshot','transport_snapshot'):
   self.assertIn(field+' jsonb NOT NULL',S)
  self.assertIn('to_jsonb(policy) IS DISTINCT FROM a.scheduler_snapshot',S)
  self.assertIn('to_jsonb(transport) IS DISTINCT FROM a.transport_snapshot',S)
 def test_immutable(self):
  for name in ('admission','admission_bindings','preparation_runs'):
   self.assertIn('CREATE TRIGGER immutable_'+name+' BEFORE UPDATE OR DELETE',S)
 def test_uuid_mapping_not_names(self):
  self.assertNotRegex(S,r'(?i)WHERE\s+(?:t\.)?(?:nombre|rfc|expediente)\s*=')
  for field in ('category_id','supplier_id','shipment_id'):
   self.assertIn(field+' uuid NOT NULL REFERENCES public.',S)
 def test_current_tenant_rows(self):
  self.assertGreaterEqual(S.count('organization_id=policy.organization_id'),6)
  self.assertIn('g.cliente_id=t.cliente_id',S)
  self.assertIn('demo_fixture_identity.assert_ids(',S)
 def test_independent_origin(self):
  self.assertIn('FROM demo_fixture_identity.preparation_runs WHERE receipt_id=p_receipt',S)
  self.assertIn('received IS DISTINCT FROM admitted',S)
  self.assertIn("'scheduler_approval_id',policy.id",S)
  self.assertIn("payload->>'source_run_id' IS DISTINCT FROM r.id::text",S)
 def test_origin_hash_separate(self):
  self.assertIn("(payload-'source_sha256')::text",S)
  self.assertNotIn('INSERT INTO demo_flow_writer.identity_receipts',S)
  self.assertNotIn("'lineage_id'",S)
 def test_atomic_private_only(self):
  self.assertTrue(S.rstrip().endswith('COMMIT;'))
  self.assertIn('PERFORM demo_flow_writer.verify_identity_receipt(receipt);',S)
  self.assertIn('PERFORM demo_flow_writer.verify_identity_receipt(existing);',S)
  self.assertIn('DEMO_PREPARER_UNEXPECTED_DEFAULT_ACL',S)
  self.assertIn('aclexplode(coalesce(o.acl,acldefault(o.kind,o.owner_id)))',S)
if __name__=='__main__': unittest.main(verbosity=2)
