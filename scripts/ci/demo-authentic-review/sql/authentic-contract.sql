-- NOT RUN. Disposable integration fixture supplement using AUTHENTIC functions.
-- Preconditions: real proposed bridge, writer16, and producer installed; synthetic
-- tenant/client/category/supplier/shipment and real validated scheduler configured
-- by the disposable harness. No verifier/owner/transport doubles permitted.
-- Harness creates pg_temp.identity_producer_input with exactly one row:
-- admission_id uuid, scheduler_approval_id uuid, review_reference text,
-- category_id uuid, category_snapshot jsonb, client_bindings jsonb,
-- bindings jsonb (fixture_id/supplier_id/shipment_id/full snapshots), valid_until timestamptz.
-- UUID mapping must be explicit in that fixture; never select entities by names.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^elogistix_identity_test_[a-z0-9_]+$' THEN
  RAISE EXCEPTION 'Disposable identity-test database required'; END IF;
 IF (SELECT count(*) FROM pg_temp.identity_producer_input)<>1 THEN
  RAISE EXCEPTION 'One explicit synthetic mapping required'; END IF;
END $$;
INSERT INTO demo_fixture_identity.preparation_admissions
 (id,scheduler_approval_id,scheduler_snapshot,transport_snapshot,admitted_by_owner,
 review_reference,origin_kind,category_id,category_snapshot,client_bindings,valid_until)
SELECT i.admission_id,p.id,to_jsonb(p),to_jsonb(t),current_user::regrole::oid,
 i.review_reference,'owner_reviewed_existing_fixture_ids',i.category_id,i.category_snapshot,i.client_bindings,i.valid_until
FROM pg_temp.identity_producer_input i JOIN demo_flow_writer.scheduler_approvals p ON p.id=i.scheduler_approval_id
JOIN demo_flow_writer.transport_approvals t ON t.id=p.transport_id;
INSERT INTO demo_fixture_identity.preparation_bindings
SELECT i.admission_id,b.fixture_id,b.supplier_id,b.shipment_id,b.supplier_snapshot,b.shipment_snapshot
FROM pg_temp.identity_producer_input i CROSS JOIN LATERAL jsonb_to_recordset(i.bindings)
 b(fixture_id text,supplier_id uuid,shipment_id uuid,supplier_snapshot jsonb,shipment_snapshot jsonb);
CREATE TEMP TABLE authentic_producer_result AS
 SELECT demo_fixture_identity.prepare_identity_receipt(admission_id) receipt_id FROM pg_temp.identity_producer_input;
DO $$ DECLARE id uuid; p jsonb; o jsonb; BEGIN
 SELECT receipt_id INTO STRICT id FROM authentic_producer_result;
 p:=demo_flow_writer.verify_identity_receipt(id);
 o:=demo_fixture_identity.verify_preparation_origin(id);
 IF (o->>'scheduler_approval_id')::uuid IS DISTINCT FROM (SELECT scheduler_approval_id FROM pg_temp.identity_producer_input)
 OR p->>'source_sha256' IS DISTINCT FROM o->>'source_sha256'
 OR id IS DISTINCT FROM (SELECT demo_fixture_identity.prepare_identity_receipt(admission_id) FROM pg_temp.identity_producer_input)
 THEN RAISE EXCEPTION 'Authentic producer contract mismatch'; END IF;
END $$;
-- Every mutation is rolled back by the exception subtransaction. Unexpected pass
-- or rejection is a test failure; matching generic 42501 alone is insufficient.
CREATE FUNCTION pg_temp.expect_origin_reject(mutation text,prefix text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE msg text; rejected boolean:=false; BEGIN
 BEGIN
  EXECUTE mutation;
  PERFORM demo_fixture_identity.verify_preparation_origin((SELECT receipt_id FROM pg_temp.authentic_producer_result));
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF left(msg,length(prefix))<>prefix THEN RAISE EXCEPTION 'Wrong rejection: %',msg; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Expected rejection: %',prefix; END IF;
END $$;
SELECT pg_temp.expect_origin_reject(format('UPDATE demo_flow_writer.scheduler_approvals SET job_id=%L WHERE id=%L',
 'tampered_job',scheduler_approval_id),'DEMO_IDENTITY_ADMISSION_POLICY_DRIFT') FROM pg_temp.identity_producer_input;
SELECT pg_temp.expect_origin_reject(format('UPDATE public.proveedores SET organization_id=%L WHERE id=%L',
 '00000000-0000-4000-8000-000000000099',bindings->0->>'supplier_id'),'DEMO_ADMITTED_SUPPLIER_DRIFT') FROM pg_temp.identity_producer_input;
SELECT pg_temp.expect_origin_reject(format('UPDATE public.embarques SET organization_id=%L WHERE id=%L',
 '00000000-0000-4000-8000-000000000099',bindings->0->>'shipment_id'),'DEMO_ADMITTED_SHIPMENT_DRIFT') FROM pg_temp.identity_producer_input;
SELECT pg_temp.expect_origin_reject(format('UPDATE public.presupuesto_categorias SET nombre=%L WHERE id=%L',
 'tampered',category_id),'DEMO_ADMITTED_CATEGORY_DRIFT') FROM pg_temp.identity_producer_input;
SELECT pg_temp.expect_origin_reject(format('UPDATE demo_fixture_identity.preparation_admissions SET review_reference=%L WHERE id=%L',
 'tampered',admission_id),'LC_DEMO_FIXTURE_IMMUTABLE') FROM pg_temp.identity_producer_input;
SELECT pg_temp.expect_origin_reject(format('UPDATE demo_fixture_identity.prepared_receipts SET payload=payload||%L::jsonb WHERE receipt_id=%L',
 '{"source_sha256":"forged"}',receipt_id),'LC_DEMO_FIXTURE_IMMUTABLE') FROM pg_temp.authentic_producer_result;
-- Cross-tenant UUID must exist in the synthetic harness when actual schema has FK.
-- Consumer should also test wrong sponsor/transport expiry and A-receipt/B-policy
-- through the integrated issue_scheduler_context (this producer creates no context).
CREATE FUNCTION pg_temp.expect_exact(q text,expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE msg text; BEGIN
 BEGIN EXECUTE q; EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS msg=MESSAGE_TEXT;
  IF msg=expected THEN RETURN; END IF;
  RAISE EXCEPTION 'Wrong rejection [%], expected [%]',msg,expected;
 END;
 RAISE EXCEPTION 'Missing rejection [%]',expected;
END $$;
CREATE TEMP TABLE issued_context AS SELECT demo_flow_writer.issue_scheduler_context(
 '30000000-0000-4000-8000-000000000001',(SELECT receipt_id FROM authentic_producer_result),120) id;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM issued_context i JOIN demo_flow_writer.server_admissions a ON a.context_id=i.id
 JOIN demo_flow_writer.scheduler_approvals s ON s.id=a.scheduler_approval_id
 JOIN demo_flow_writer.transport_approvals t ON t.id=a.transport_id
 WHERE a.scheduler_snapshot=to_jsonb(s) AND a.transport_snapshot=to_jsonb(t)) THEN
 RAISE EXCEPTION 'Missing exact context snapshots'; END IF;
END $$;
INSERT INTO demo_flow_writer.scheduler_approvals SELECT
 '30000000-0000-4000-8000-000000000002',transport_id,'other_synthetic_job',sponsor_user_id,
 organization_id,manifest_version,manifest_sha256,approved_by_owner,valid_until,disabled_at
 FROM demo_flow_writer.scheduler_approvals WHERE id='30000000-0000-4000-8000-000000000001';
SELECT pg_temp.expect_exact(format('SELECT demo_flow_writer.issue_scheduler_context(%L,%L,120)',
 '30000000-0000-4000-8000-000000000002',receipt_id),'DEMO_REGISTRY_IDENTITY_ORIGIN_CONFLICT') FROM authentic_producer_result;
SELECT pg_temp.expect_origin_reject('UPDATE auth.users SET deleted_at=clock_timestamp() WHERE id=''10000000-0000-4000-8000-000000000001''','DEMO_SPONSOR_ACCOUNT_DISABLED_OR_SCHEMA_UNKNOWN');
SELECT pg_temp.expect_origin_reject('UPDATE auth.users SET banned_until=clock_timestamp()+interval ''1 hour'' WHERE id=''10000000-0000-4000-8000-000000000001''','DEMO_SPONSOR_ACCOUNT_DISABLED_OR_SCHEMA_UNKNOWN');
SELECT pg_temp.expect_origin_reject('DELETE FROM public.organization_members WHERE user_id=''10000000-0000-4000-8000-000000000001''','DEMO_SPONSOR_MEMBERSHIP_REQUIRED');
SELECT pg_temp.expect_origin_reject('DELETE FROM public.user_roles WHERE user_id=''10000000-0000-4000-8000-000000000001''','DEMO_SPONSOR_ROLE_REQUIRED');
SELECT pg_temp.expect_origin_reject('UPDATE demo_flow_writer.transport_approvals SET valid_until=clock_timestamp()-interval ''1 second''','DEMO_SCHEDULER_APPROVAL_INVALID');
SELECT pg_temp.expect_origin_reject('UPDATE public.organizations SET activo=false WHERE id=''00000000-0000-4000-8000-000000000001''','DEMO_ORGANIZATION_INACTIVE');
-- Owner issuance is tested; successful HTTP/session transport is not impersonated.
SELECT pg_temp.expect_exact('SELECT demo_flow_writer.assert_rpc_transport()','DEMO_REGISTERED_RPC_TRANSPORT_REQUIRED');
DO $$ BEGIN
 IF (SELECT count(*) FROM public.proveedor_facturas)<>0 OR
 (SELECT count(*) FROM public.proveedor_facturas_conceptos)<>0 OR
 (SELECT count(*) FROM public.pagos_proveedor)<>0 THEN RAISE EXCEPTION 'Producer wrote financial rows'; END IF;
 IF (SELECT count(*) FROM demo_fixture_identity.preparation_runs)<>1 THEN RAISE EXCEPTION 'Unexpected producer run count'; END IF;
 IF to_regprocedure('auth.uid()') IS NOT NULL THEN RAISE EXCEPTION 'Authentication double unexpectedly installed'; END IF;
END $$;
SELECT 'AUTHENTIC_PRODUCER_REGISTRY_ASSERTIONS_COMPLETE';
ROLLBACK;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM demo_fixture_identity.prepared_receipts) OR
 EXISTS(SELECT 1 FROM demo_fixture_identity.preparation_runs) OR
 EXISTS(SELECT 1 FROM demo_flow_writer.server_admissions) THEN RAISE EXCEPTION 'Rollback left provenance'; END IF;
END $$;
SELECT 'AUTHENTIC_PRODUCER_ROLLBACK_COMPLETE';
