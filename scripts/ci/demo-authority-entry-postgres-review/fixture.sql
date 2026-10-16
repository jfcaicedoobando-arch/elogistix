\set ON_ERROR_STOP on
-- OWNED AUTHORITY FIXTURE ONLY. All rows below are created in an empty isolated database. The fixed
-- historical UUID is a synthetic copy, never a connection to that organization.
SELECT * FROM demo_fixture_identity.ensure('cliente.pacifico');
SELECT * FROM demo_fixture_identity.ensure('cliente.monterrey');
SELECT * FROM demo_fixture_identity.ensure('cliente.bajio');
INSERT INTO auth.users VALUES('10000000-0000-4000-8000-000000000001',NULL,NULL);
INSERT INTO public.organization_members VALUES('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','admin');
INSERT INTO public.user_roles VALUES('10000000-0000-4000-8000-000000000001','admin');
INSERT INTO demo_flow_writer.transport_approvals
 (id,owner_oid,login_role_oid,technical_role_oid,organization_id,approved_by_owner,valid_until)
VALUES('20000000-0000-4000-8000-000000000001',current_user::regrole::oid,current_user::regrole::oid,
 'service_role'::regrole::oid,'00000000-0000-4000-8000-000000000001',current_user::regrole::oid,date_trunc('milliseconds',clock_timestamp())+interval '1 hour');
INSERT INTO demo_flow_writer.scheduler_approvals
 (id,transport_id,job_id,sponsor_user_id,organization_id,manifest_version,manifest_sha256,approved_by_owner,valid_until)
VALUES('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','synthetic_owner_job',
 '10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','seed-core-cxp-v1',
 demo_flow_writer.manifest_sha256(),current_user::regrole::oid,date_trunc('milliseconds',clock_timestamp())+interval '1 hour');
INSERT INTO public.presupuesto_categorias VALUES('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',true,'Synthetic test category');
INSERT INTO public.proveedores VALUES
 ('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',NULL,'aprobado','Synthetic supplier A'),
 ('50000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',NULL,'aprobado','Synthetic supplier B'),
 ('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001',NULL,'aprobado','Synthetic supplier C');
INSERT INTO public.embarques SELECT x.id::uuid,'00000000-0000-4000-8000-000000000001',NULL,'Activo',g.cliente_id,x.expediente
FROM (VALUES
 ('60000000-0000-4000-8000-000000000001','cliente.pacifico','SYNTHETIC-1'),
 ('60000000-0000-4000-8000-000000000002','cliente.monterrey','SYNTHETIC-2'),
 ('60000000-0000-4000-8000-000000000003','cliente.bajio','SYNTHETIC-3')) x(id,fixture_key,expediente)
JOIN demo_fixture_identity.registry g ON g.fixture_key=x.fixture_key;
CREATE TEMP TABLE identity_producer_input AS
SELECT '70000000-0000-4000-8000-000000000001'::uuid admission_id,
 '30000000-0000-4000-8000-000000000001'::uuid scheduler_approval_id,
 'isolated-synthetic-mapping-v1'::text review_reference,c.id category_id,to_jsonb(c) category_snapshot,
 (SELECT jsonb_agg(jsonb_build_object('fixture_key',fixture_key,'cliente_id',cliente_id,'contacto_id',contacto_id,'empresa_id',empresa_id) ORDER BY fixture_key) FROM demo_fixture_identity.registry) client_bindings,
 (SELECT jsonb_agg(jsonb_build_object('fixture_id',m.fixture_id,'supplier_id',s.id,'shipment_id',e.id,'supplier_snapshot',to_jsonb(s),'shipment_snapshot',to_jsonb(e)) ORDER BY m.fixture_id)
  FROM (VALUES
   ('aap-vencida','50000000-0000-4000-8000-000000000001'::uuid,'60000000-0000-4000-8000-000000000001'::uuid),
   ('ofc-parcial','50000000-0000-4000-8000-000000000002'::uuid,'60000000-0000-4000-8000-000000000002'::uuid),
   ('ttn-vigente','50000000-0000-4000-8000-000000000003'::uuid,'60000000-0000-4000-8000-000000000003'::uuid)) m(fixture_id,supplier_id,shipment_id)
  JOIN public.proveedores s ON s.id=m.supplier_id JOIN public.embarques e ON e.id=m.shipment_id) bindings,
 date_trunc('milliseconds',clock_timestamp())+interval '30 minutes' valid_until
FROM public.presupuesto_categorias c WHERE c.id='40000000-0000-4000-8000-000000000001';


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
CREATE TABLE public.authority_test_receipt AS
 SELECT demo_fixture_identity.prepare_identity_receipt(admission_id) receipt_id FROM pg_temp.identity_producer_input;
INSERT INTO demo_flow_writer.authority_fences(deployment,generation,fence,stopped,reviewed_by_owner,review_reference)
 VALUES('SYNTHETIC_WIRE_LAB',1,'SYNTHETIC_FENCE_1',false,current_user::regrole::oid,'FIXTURE ONLY');

-- Independent entry integration instrumentation. No business entrypoint is installed.
CREATE SCHEMA authority_entry_fixture;
CREATE TABLE authority_entry_fixture.insert_observations (
 context_id uuid NOT NULL, backend_pid integer NOT NULL, transaction_id text NOT NULL,
 isolation text NOT NULL, synchronous_commit text NOT NULL
);
CREATE FUNCTION authority_entry_fixture.observe_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO authority_entry_fixture.insert_observations
 VALUES(NEW.context_id,pg_backend_pid(),pg_current_xact_id()::text,
 current_setting('transaction_isolation'),current_setting('synchronous_commit'));
 RETURN NEW;
END $$;
CREATE TRIGGER entry_fixture_observer AFTER INSERT ON demo_owner_review.issuer_obligations
FOR EACH ROW EXECUTE FUNCTION authority_entry_fixture.observe_insert();
CREATE FUNCTION authority_entry_fixture.new_context(p_label text,p_ttl_ms integer DEFAULT 60000)
RETURNS TABLE(authority_id uuid,context_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE aid uuid; ctx uuid; tick timestamptz;
BEGIN
 IF p_label !~ '^[a-z0-9_-]{1,80}$' OR p_ttl_ms NOT BETWEEN 500 AND 120000 THEN
  RAISE EXCEPTION 'ENTRY_FIXTURE_INPUT'; END IF;
 tick:=date_trunc('milliseconds',clock_timestamp());
 aid:=demo_flow_writer.register_occurrence('SYNTHETIC_WIRE_LAB','SYNTHETIC_SEMANTIC_FAMILY',
 p_label,'70000000-0000-4000-8000-000000000001',
 (SELECT receipt_id FROM public.authority_test_receipt),0,tick-interval '1 minute',
 tick+p_ttl_ms*interval '1 millisecond','ENTRY INTEGRATION FIXTURE ONLY');
 ctx:=demo_flow_writer.issue_bound_context(aid);
 RETURN QUERY SELECT aid,ctx;
END $$;
SELECT 'AUTHORITY_ENTRY_FIXTURE_READY';
