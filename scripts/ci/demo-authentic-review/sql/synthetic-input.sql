\set ON_ERROR_STOP on
-- All rows below are created only inside the empty isolated database. The fixed
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
 'service_role'::regrole::oid,'00000000-0000-4000-8000-000000000001',current_user::regrole::oid,clock_timestamp()+interval '1 hour');
INSERT INTO demo_flow_writer.scheduler_approvals
 (id,transport_id,job_id,sponsor_user_id,organization_id,manifest_version,manifest_sha256,approved_by_owner,valid_until)
VALUES('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','synthetic_owner_job',
 '10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','seed-core-cxp-v1',
 demo_flow_writer.manifest_sha256(),current_user::regrole::oid,clock_timestamp()+interval '1 hour');
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
 clock_timestamp()+interval '30 minutes' valid_until
FROM public.presupuesto_categorias c WHERE c.id='40000000-0000-4000-8000-000000000001';
