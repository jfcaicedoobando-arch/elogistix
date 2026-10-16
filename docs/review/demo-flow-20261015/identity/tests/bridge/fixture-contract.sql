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
ROLLBACK;
