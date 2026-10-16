\set ON_ERROR_STOP on
-- SYNTHETIC LAB ONLY. Real producer/registry code; synthetic owner-reviewed inputs.
-- Keep this and the suite in the SAME psql session so TEMP inputs survive COMMIT.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR current_setting('transaction_isolation')<>'read committed'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper
  AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolbypassrls AND NOT rolinherit AND NOT rolcreatedb
  AND NOT rolcreaterole AND NOT rolreplication)
 OR (SELECT count(*) FROM pg_temp.financial_fixture_ids)<>3
 OR (SELECT count(*) FROM pg_temp.financial_client_bindings)<>3
 OR (SELECT count(*) FROM pg_temp.financial_manual_sentinels)<>2
 OR (SELECT count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels)<>2
 OR auth.uid() IS NOT NULL OR auth.role() IS DISTINCT FROM 'service_role'
 OR auth.jwt()->>'fixture' IS DISTINCT FROM 'SYNTHETIC' THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_SYNTHETIC_PREPARATION_REQUIRED';
 END IF;
END $guard$;
INSERT INTO demo_flow_writer.transport_approvals
 (id,owner_oid,login_role_oid,technical_role_oid,organization_id,approved_by_owner,valid_until)
 VALUES('60000000-0000-4000-8000-000000000001',current_user::regrole::oid,session_user::regrole::oid,
  'service_role'::regrole::oid,'00000000-0000-4000-8000-000000000001',
  current_user::regrole::oid,clock_timestamp()+interval '30 minutes');
INSERT INTO demo_flow_writer.scheduler_approvals
 (id,transport_id,job_id,sponsor_user_id,organization_id,manifest_version,manifest_sha256,approved_by_owner,valid_until)
 VALUES('70000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',
  'SYNTHETIC_financial_behavior_lab','40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001','seed-core-cxp-v1',demo_flow_writer.manifest_sha256(),
  current_user::regrole::oid,clock_timestamp()+interval '30 minutes');

CREATE TEMP TABLE identity_producer_input AS
 SELECT '80000000-0000-4000-8000-000000000001'::uuid admission_id,
  '70000000-0000-4000-8000-000000000001'::uuid scheduler_approval_id,
  'SYNTHETIC_behavior_owner_reviewed_explicit_UUIDs'::text review_reference,
  category.id category_id,to_jsonb(category) category_snapshot,
  (SELECT jsonb_agg(jsonb_build_object('fixture_key',c.fixture_key,'cliente_id',c.cliente_id,
   'contacto_id',c.contacto_id,'empresa_id',c.empresa_id) ORDER BY c.fixture_key)
   FROM pg_temp.financial_client_bindings c) client_bindings,
  (SELECT jsonb_agg(jsonb_build_object('fixture_id',x.fixture_id,'supplier_id',x.supplier_id,
   'shipment_id',x.shipment_id,'supplier_snapshot',to_jsonb(p),'shipment_snapshot',to_jsonb(e)) ORDER BY x.fixture_id)
   FROM pg_temp.financial_fixture_ids x
   JOIN public.proveedores p ON p.id=x.supplier_id
   JOIN public.embarques e ON e.id=x.shipment_id) bindings,
  clock_timestamp()+interval '20 minutes' valid_until
 FROM public.presupuesto_categorias category
 WHERE category.id='20000000-0000-4000-8000-000000000001';
DO $input$
BEGIN
 IF (SELECT count(*) FROM pg_temp.identity_producer_input)<>1
 OR EXISTS(SELECT 1 FROM pg_temp.identity_producer_input
  WHERE jsonb_array_length(client_bindings)<>3 OR jsonb_array_length(bindings)<>3)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.lineages)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints) THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_OWNER_REVIEWED_INPUT_REQUIRED';
 END IF;
END $input$;

-- Same admission shape as PR348; no inserted financial IDs, source run or receipt.
INSERT INTO demo_fixture_identity.preparation_admissions
 (id,scheduler_approval_id,scheduler_snapshot,transport_snapshot,admitted_by_owner,
 review_reference,origin_kind,category_id,category_snapshot,client_bindings,valid_until)
 SELECT i.admission_id,p.id,to_jsonb(p),to_jsonb(t),current_user::regrole::oid,
  i.review_reference,'owner_reviewed_existing_fixture_ids',i.category_id,i.category_snapshot,i.client_bindings,i.valid_until
 FROM pg_temp.identity_producer_input i
 JOIN demo_flow_writer.scheduler_approvals p ON p.id=i.scheduler_approval_id
 JOIN demo_flow_writer.transport_approvals t ON t.id=p.transport_id;
INSERT INTO demo_fixture_identity.preparation_bindings
 SELECT i.admission_id,b.fixture_id,b.supplier_id,b.shipment_id,b.supplier_snapshot,b.shipment_snapshot
 FROM pg_temp.identity_producer_input i CROSS JOIN LATERAL jsonb_to_recordset(i.bindings)
 b(fixture_id text,supplier_id uuid,shipment_id uuid,supplier_snapshot jsonb,shipment_snapshot jsonb);
CREATE TEMP TABLE financial_context AS
 SELECT demo_flow_writer.issue_scheduler_context(i.scheduler_approval_id,
  demo_fixture_identity.prepare_identity_receipt(i.admission_id),120) context_id
 FROM pg_temp.identity_producer_input i;
DO $produced$
DECLARE ctx uuid; receipt uuid;
BEGIN
 SELECT context_id INTO STRICT ctx FROM pg_temp.financial_context;
 IF ctx IS NULL THEN RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_AUTHENTIC_CONTEXT_REQUIRED'; END IF;
 SELECT identity_receipt_id INTO STRICT receipt FROM demo_flow_writer.server_admissions WHERE context_id=ctx;
 PERFORM demo_fixture_identity.verify_preparation_origin(receipt);
 IF (SELECT count(*) FROM demo_fixture_identity.preparation_runs)<>1
 OR (SELECT count(*) FROM demo_fixture_identity.prepared_receipts)<>1
 OR (SELECT count(*) FROM demo_flow_writer.server_admissions)<>1
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.lineages)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints)
 OR EXISTS(SELECT 1 FROM public.proveedor_facturas)
 OR EXISTS(SELECT 1 FROM public.pagos_proveedor) THEN
  RAISE EXCEPTION 'FINANCIAL_BEHAVIOR_PRODUCER_ONLY_NO_MATERIALIZATION_REQUIRED';
 END IF;
END $produced$;
COMMIT;
SELECT 'FINANCIAL_BEHAVIOR_AUTHENTIC_CONTEXT_PREPARED_SYNTHETIC';
