\set ON_ERROR_STOP on
-- canonical-fixture.sql must provide exactly one explicit mapping in the
-- PR344 input shape, plus labelled two-tenant manual sentinel rows.
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_temp.identity_producer_input)<>1 THEN
  RAISE EXCEPTION 'One labelled synthetic mapping required'; END IF;
 IF (SELECT count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels)<>2 THEN
  RAISE EXCEPTION 'Two-tenant manual sentinels required'; END IF;
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
CREATE TEMP TABLE financial_context AS
 SELECT demo_flow_writer.issue_scheduler_context(i.scheduler_approval_id,
  demo_fixture_identity.prepare_identity_receipt(i.admission_id),120) context_id
 FROM pg_temp.identity_producer_input i;
-- No run, authorization receipt, identity receipt, checkpoint or financial row
-- is inserted by the harness. Authentic producer/registry/issuer own those writes.
\ir assertions.sql
