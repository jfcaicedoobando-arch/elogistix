from pathlib import Path
import json,re,hashlib,unittest
P=Path(__file__).parent
SQL={p.name:p.read_text() for p in P.glob('*.sql')}
class Contract(unittest.TestCase):
 def test_no_public_replacement(self):
  self.assertNotRegex('\n'.join(SQL.values()),r'(?i)CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.')
 def test_no_access_expansion(self):
  self.assertNotRegex('\n'.join(SQL.values()),r'(?im)^\s*(GRANT|CREATE ROLE|ALTER ROLE|ALTER POLICY|CREATE POLICY)\b')
 def test_no_on_switch(self):
  self.assertNotRegex('\n'.join(SQL.values()),r"(?i)(UPDATE|INSERT INTO)\s+demo_flow_writer.control")
 def test_no_singleton_dispatch(self):
  self.assertNotRegex(SQL['11-atomic-entry.sql'],r'(?i)(FROM|INTO|UPDATE)\s+demo_flow_writer.active_command')
 def test_explicit_atomic_order(self):
  s=SQL['11-atomic-entry.sql']; self.assertLess(s.index('result:=demo_flow_writer.execute(p_run_id)'),s.index('INSERT INTO demo_flow_writer.seed_checkpoints')); self.assertLess(s.index('INSERT INTO demo_flow_writer.seed_checkpoints'),s.index('INSERT INTO public.demo_seed_state')); self.assertIn('INSERT INTO demo_flow_writer.execution_receipts',s)
 def test_human_source_exact(self):
  source=(P.parent/'evidence/main-aprobar_factura_proveedor.sql').read_text().split('AS $$',1)[1].split('$$;',1)[0]
  actual=SQL['12-approval-main.sql'].split('SET search_path=public AS $$',1)[1].split('$$;',1)[0]
  self.assertEqual(source,actual); self.assertIn('v_puede_autoaprobar_cxp',actual); self.assertNotIn('v_es_admin',actual)
 def test_human_pin(self):
  pin=json.loads((P/'source-pins.json').read_text()); self.assertIn(pin['human_body_sha256'],SQL['12-approval-main.sql'])
 def test_demo_audit_required(self):
  s=SQL['12-approval-main.sql'].split('CREATE FUNCTION demo_flow_writer.demo_approval_main',1)[1].split('CREATE FUNCTION demo_flow_writer.common_approval',1)[0]
  self.assertIn("record_action(p_run,p_fixture,'approved')",s); self.assertNotIn('WHEN OTHERS',s)
 def test_readonly_no_writes_locks_live_authorize(self):
  for name in ['13-readonly-verifiers.sql','14-reconcile.sql']:
   for body in re.findall(r'AS \$\$(.*?)\$\$;',SQL[name],re.S):
    self.assertNotRegex(body,r'(?i)\b(INSERT INTO|UPDATE\s+public|DELETE FROM|FOR UPDATE|FOR SHARE|set_config|demo_flow_writer.authorize\()')
 def test_unknown_terminal_fail_closed(self):
  self.assertIn('AS $$ SELECT false $$',SQL['10-issuer.sql']); self.assertIn("'classification','unresolved'",SQL['14-reconcile.sql']); self.assertNotIn("'classification','absent'",SQL['14-reconcile.sql'])
 def test_authority_fail_closed(self):
  for error in ['HOLD_EXISTING_AUTHORIZED_TRANSPORT_UNVERIFIED','HOLD_SERVER_AUTHENTICATION_ADAPTER_REQUIRED','HOLD_IDENTITY_ORIGIN_ADAPTER_REQUIRED','HOLD_REPLAY_ORIGIN_ADAPTER_REQUIRED']: self.assertIn(error,SQL['10-issuer.sql'])
 def test_thirteen_and_claims(self):
  s=SQL['14-reconcile.sql']; self.assertEqual(s.count(')<>13'),2); self.assertIn(')<>3',s)
 def test_no_retry_or_reissue_reconcile(self):
  s=SQL['14-reconcile.sql']; self.assertNotIn('prepare_authorized_run(',s); self.assertNotIn('execute_and_checkpoint(',s)
 def test_receipt_immutable(self):
  self.assertIn('immutable_execution_receipts BEFORE UPDATE OR DELETE',SQL['11-atomic-entry.sql']); self.assertIn('immutable_authorizations BEFORE UPDATE OR DELETE',SQL['10-issuer.sql'])
 def test_no_constraint_mode_change(self):
  self.assertNotRegex('\n'.join(SQL.values()),r'(?im)^\s*SET CONSTRAINTS')
 def test_rpc_single_transaction_boundary(self):
  s=SQL['15-rpc-boundary.sql']; self.assertIn('SECURITY DEFINER',s)
  self.assertLess(s.index('prepared:=demo_flow_writer.prepare_authorized_run'),s.index('result:=demo_flow_writer.execute_and_checkpoint'))
  self.assertIn('HOLD_POSTGREST_TRANSPORT_ATTESTATION_REQUIRED',s)
  self.assertIn('HOLD_CONTEXT_HISTORY_AUTHENTICATION_REQUIRED',s)
 def test_rpc_missing_unresolved(self):
  self.assertIn("'classification','unresolved','context_id',p_context_id",SQL['15-rpc-boundary.sql'])
 def test_committed_history_independent_marker(self):
  self.assertNotIn('SELECT last_seeded_at FROM public.demo_seed_state',SQL['14-reconcile.sql'])
 def test_empty_approval_registries(self):
  s=SQL['16-owner-registry.sql']
  self.assertNotRegex(s,r'(?i)INSERT INTO demo_flow_writer\.(transport_approvals|scheduler_approvals)')
 def test_registry_issuer_owner_only(self):
  s=SQL['16-owner-registry.sql']; self.assertIn('owner_id:=demo_flow_writer.assert_registry_owner()',s)
  self.assertIn('session_user::regrole::oid<>owner_id',s)
 def test_registry_checks_existing_actor(self):
  s=SQL['16-owner-registry.sql']
  for fragment in ['auth.users','public.organization_members','public.user_roles',"account->>'deleted_at'", "account->>'banned_until'",'FOR SHARE']: self.assertIn(fragment,s)
 def test_registry_separates_scheduler_and_sponsor(self):
  s=SQL['16-owner-registry.sql']; self.assertIn("'initiator_kind','scheduler'",s); self.assertIn("'initiator_user_id',NULL",s)
 def test_registry_transport_catalog_binding(self):
  s=SQL['16-owner-registry.sql']
  for fragment in ['t.login_role_oid=session_user::regrole::oid','selected_role=technical.oid','current_user::regrole::oid<>owner_id']: self.assertIn(fragment,s)
 def test_registry_receipt_origin_required(self):
  self.assertIn('i:=demo_flow_writer.verify_identity_receipt(p_identity_receipt)',SQL['16-owner-registry.sql'])
if __name__=='__main__':unittest.main(verbosity=2)
