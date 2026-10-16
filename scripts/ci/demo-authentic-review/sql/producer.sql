-- REVIEW-ONLY STAGING. Registry starts EMPTY. No runtime registration, grant,
-- principal, credential, public RPC, seed activation or migration is included.
-- Install atomically AFTER bridge and writer 16-owner-registry.sql.
BEGIN;
DO $$ DECLARE owner_id oid; BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 IF current_user::regrole::oid<>owner_id OR session_user::regrole::oid<>owner_id
 OR (SELECT nspowner FROM pg_namespace WHERE nspname='demo_fixture_identity') IS DISTINCT FROM owner_id
 OR (SELECT nspowner FROM pg_namespace WHERE nspname='demo_flow_writer') IS DISTINCT FROM owner_id THEN
  RAISE EXCEPTION 'DEMO_PREPARER_INSTALL_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;
CREATE TABLE demo_fixture_identity.preparation_admissions (
 id uuid PRIMARY KEY,
 scheduler_approval_id uuid NOT NULL REFERENCES demo_flow_writer.scheduler_approvals,
 scheduler_snapshot jsonb NOT NULL CHECK(jsonb_typeof(scheduler_snapshot)='object'),
 transport_snapshot jsonb NOT NULL CHECK(jsonb_typeof(transport_snapshot)='object'),
 admitted_by_owner oid NOT NULL,
 review_reference text NOT NULL CHECK(length(btrim(review_reference))>0),
 origin_kind text NOT NULL CHECK(origin_kind='owner_reviewed_existing_fixture_ids'),
 category_id uuid NOT NULL REFERENCES public.presupuesto_categorias,
 category_snapshot jsonb NOT NULL,
 client_bindings jsonb NOT NULL CHECK(jsonb_typeof(client_bindings)='array'),
 valid_until timestamptz NOT NULL
);
CREATE TABLE demo_fixture_identity.preparation_bindings (
 admission_id uuid NOT NULL REFERENCES demo_fixture_identity.preparation_admissions,
 fixture_id text NOT NULL CHECK(fixture_id IN('aap-vencida','ofc-parcial','ttn-vigente')),
 supplier_id uuid NOT NULL REFERENCES public.proveedores,
 shipment_id uuid NOT NULL REFERENCES public.embarques,
 supplier_snapshot jsonb NOT NULL,
 shipment_snapshot jsonb NOT NULL,
 PRIMARY KEY(admission_id,fixture_id)
);
CREATE TABLE demo_fixture_identity.preparation_runs (
 id uuid PRIMARY KEY,
 admission_id uuid NOT NULL UNIQUE REFERENCES demo_fixture_identity.preparation_admissions,
 receipt_id uuid NOT NULL UNIQUE REFERENCES demo_fixture_identity.prepared_receipts,
 scheduler_approval_id uuid NOT NULL REFERENCES demo_flow_writer.scheduler_approvals,
 produced_by_owner oid NOT NULL,
 initiator_kind text NOT NULL CHECK(initiator_kind='scheduler'),
 initiator_job_id text NOT NULL,
 organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
 manifest_version text NOT NULL CHECK(manifest_version='seed-core-cxp-v1'),
 manifest_sha256 text NOT NULL,
 source_version text NOT NULL CHECK(source_version='identity-preparer-v1'),
 source_sha256 text NOT NULL,
 client_bindings_sha256 text NOT NULL,
 produced_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER immutable_admission BEFORE UPDATE OR DELETE ON demo_fixture_identity.preparation_admissions
 FOR EACH ROW EXECUTE FUNCTION demo_fixture_identity.reject_rebinding();
CREATE TRIGGER immutable_admission_bindings BEFORE UPDATE OR DELETE ON demo_fixture_identity.preparation_bindings
 FOR EACH ROW EXECUTE FUNCTION demo_fixture_identity.reject_rebinding();
CREATE TRIGGER immutable_preparation_runs BEFORE UPDATE OR DELETE ON demo_fixture_identity.preparation_runs
 FOR EACH ROW EXECUTE FUNCTION demo_fixture_identity.reject_rebinding();


-- Full policy snapshots are explicitly reviewed at admission. Never snapshot a
-- changed delegation for the first time at production or reinterpret its meaning.
CREATE FUNCTION demo_fixture_identity.assert_preparation_admission(p_admission uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE a demo_fixture_identity.preparation_admissions; policy demo_flow_writer.scheduler_approvals;
 transport demo_flow_writer.transport_approvals; owner_id oid; clients jsonb; c jsonb; b record; actual jsonb;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 IF current_user::regrole::oid<>owner_id THEN RAISE EXCEPTION 'DEMO_ORIGIN_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT a FROM demo_fixture_identity.preparation_admissions WHERE id=p_admission FOR SHARE;
 policy:=demo_flow_writer.validated_scheduler(a.scheduler_approval_id);
 SELECT * INTO STRICT transport FROM demo_flow_writer.transport_approvals WHERE id=policy.transport_id FOR SHARE;
 IF a.admitted_by_owner IS DISTINCT FROM owner_id OR clock_timestamp()>=a.valid_until
 OR to_jsonb(policy) IS DISTINCT FROM a.scheduler_snapshot OR to_jsonb(transport) IS DISTINCT FROM a.transport_snapshot THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_ADMISSION_POLICY_DRIFT' USING ERRCODE='42501'; END IF;
 SELECT jsonb_agg(jsonb_build_object('fixture_key',fixture_key,'cliente_id',cliente_id,
 'contacto_id',contacto_id,'empresa_id',empresa_id) ORDER BY fixture_key) INTO clients FROM demo_fixture_identity.registry;
 IF clients IS DISTINCT FROM a.client_bindings OR jsonb_array_length(a.client_bindings)<>3
 OR (SELECT array_agg(value->>'fixture_key' ORDER BY value->>'fixture_key') FROM jsonb_array_elements(a.client_bindings))
 IS DISTINCT FROM ARRAY['cliente.bajio','cliente.monterrey','cliente.pacifico'] THEN
  RAISE EXCEPTION 'DEMO_ADMITTED_CLIENT_BINDINGS_DRIFT' USING ERRCODE='23514'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(a.client_bindings) LOOP
  PERFORM demo_fixture_identity.assert_ids(c->>'fixture_key',(c->>'cliente_id')::uuid,(c->>'contacto_id')::uuid,(c->>'empresa_id')::uuid);
 END LOOP;
 SELECT to_jsonb(t) INTO actual FROM public.presupuesto_categorias t
 WHERE t.id=a.category_id AND t.organization_id=policy.organization_id AND t.activa FOR SHARE;
 IF actual IS NULL OR actual IS DISTINCT FROM a.category_snapshot THEN
  RAISE EXCEPTION 'DEMO_ADMITTED_CATEGORY_DRIFT' USING ERRCODE='23514'; END IF;
 IF (SELECT array_agg(fixture_id ORDER BY fixture_id) FROM demo_fixture_identity.preparation_bindings WHERE admission_id=a.id)
 IS DISTINCT FROM ARRAY['aap-vencida','ofc-parcial','ttn-vigente'] THEN
  RAISE EXCEPTION 'DEMO_ADMISSION_THREE_BINDINGS_REQUIRED' USING ERRCODE='23514'; END IF;
 FOR b IN SELECT * FROM demo_fixture_identity.preparation_bindings WHERE admission_id=a.id ORDER BY fixture_id FOR SHARE LOOP
  SELECT to_jsonb(t) INTO actual FROM public.proveedores t WHERE t.id=b.supplier_id
   AND t.organization_id=policy.organization_id AND t.deleted_at IS NULL AND t.estado_alta='aprobado' FOR SHARE;
  IF actual IS NULL OR actual IS DISTINCT FROM b.supplier_snapshot THEN
   RAISE EXCEPTION 'DEMO_ADMITTED_SUPPLIER_DRIFT' USING ERRCODE='23514'; END IF;
  SELECT to_jsonb(t) INTO actual FROM public.embarques t WHERE t.id=b.shipment_id
   AND t.organization_id=policy.organization_id AND t.deleted_at IS NULL AND t.estado::text<>'Cancelado'
   AND EXISTS(SELECT 1 FROM demo_fixture_identity.registry g WHERE g.cliente_id=t.cliente_id) FOR SHARE;
  IF actual IS NULL OR actual IS DISTINCT FROM b.shipment_snapshot THEN
   RAISE EXCEPTION 'DEMO_ADMITTED_SHIPMENT_DRIFT' USING ERRCODE='23514'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION demo_fixture_identity.verify_preparation_origin(p_receipt uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r demo_fixture_identity.preparation_runs; a demo_fixture_identity.preparation_admissions;
 policy demo_flow_writer.scheduler_approvals; owner_id oid; payload jsonb; clients jsonb; admitted jsonb; received jsonb;
BEGIN
 SELECT proowner INTO STRICT owner_id FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure;
 IF current_user::regrole::oid<>owner_id THEN RAISE EXCEPTION 'DEMO_ORIGIN_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT r FROM demo_fixture_identity.preparation_runs WHERE receipt_id=p_receipt FOR SHARE;
 SELECT * INTO STRICT a FROM demo_fixture_identity.preparation_admissions WHERE id=r.admission_id FOR SHARE;
 policy:=demo_flow_writer.validated_scheduler(a.scheduler_approval_id);
 PERFORM demo_fixture_identity.assert_preparation_admission(a.id);
 IF r.produced_by_owner<>owner_id OR a.admitted_by_owner<>owner_id
 OR clock_timestamp()>=a.valid_until OR r.scheduler_approval_id<>policy.id
 OR r.initiator_kind<>'scheduler' OR r.initiator_job_id<>policy.job_id
 OR r.organization_id<>policy.organization_id OR r.manifest_version<>policy.manifest_version
 OR r.manifest_sha256<>policy.manifest_sha256
 OR r.client_bindings_sha256<>encode(sha256(convert_to(a.client_bindings::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_AUTHENTIC_ORIGIN_INVALID' USING ERRCODE='42501'; END IF;
 SELECT p.payload,p.client_bindings INTO STRICT payload,clients
 FROM demo_fixture_identity.prepared_receipts p WHERE p.receipt_id=p_receipt FOR SHARE;
 SELECT jsonb_agg(jsonb_build_object('fixture_id',b.fixture_id,'supplier_id',b.supplier_id,
 'shipment_id',b.shipment_id,'supplier_snapshot',b.supplier_snapshot,'shipment_snapshot',b.shipment_snapshot)
 ORDER BY b.fixture_id) INTO admitted FROM demo_fixture_identity.preparation_bindings b WHERE b.admission_id=a.id;
 SELECT jsonb_agg(value - ARRAY['invoice_id','concept_ids','payment_id','fixture_sha256'] ORDER BY value->>'fixture_id')
 INTO received FROM jsonb_array_elements(payload->'bindings');
 IF received IS DISTINCT FROM admitted OR clients IS DISTINCT FROM a.client_bindings
 OR payload->>'category_id' IS DISTINCT FROM a.category_id::text
 OR payload->'category_snapshot' IS DISTINCT FROM a.category_snapshot
 OR payload->>'receipt_id' IS DISTINCT FROM r.receipt_id::text
 OR payload->>'source_run_id' IS DISTINCT FROM r.id::text
 OR payload->>'source_version' IS DISTINCT FROM r.source_version
 OR payload->>'organization_id' IS DISTINCT FROM r.organization_id::text
 OR payload->>'manifest_version' IS DISTINCT FROM r.manifest_version
 OR payload->>'manifest_sha256' IS DISTINCT FROM r.manifest_sha256
 OR payload->>'source_sha256' IS DISTINCT FROM r.source_sha256
 OR r.source_sha256 IS DISTINCT FROM encode(sha256(convert_to((payload-'source_sha256')::text,'UTF8')),'hex')
 OR payload->>'bindings_sha256' IS DISTINCT FROM encode(sha256(convert_to((payload->'bindings')::text,'UTF8')),'hex')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'bindings') b WHERE b->>'fixture_sha256'
 IS DISTINCT FROM demo_flow_writer.sha256(demo_flow_writer.fixture_spec(b->>'fixture_id'))) THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_ORIGIN_MAPPING_CONFLICT' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('scheduler_approval_id',policy.id,'scheduler_snapshot',a.scheduler_snapshot,
 'transport_snapshot',a.transport_snapshot,'admission_id',a.id,'receipt_id',r.receipt_id,'source_run_id',r.id,
 'source_version',r.source_version,'source_sha256',r.source_sha256,'client_bindings_sha256',r.client_bindings_sha256);
END $$;

CREATE FUNCTION demo_fixture_identity.prepare_identity_receipt(p_admission uuid) RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE owner_id oid; a demo_fixture_identity.preparation_admissions;
 policy demo_flow_writer.scheduler_approvals; b demo_fixture_identity.preparation_bindings;
 current_row jsonb; bindings jsonb:='[]'; payload jsonb; clients jsonb;
 receipt uuid:=gen_random_uuid(); source_run uuid:=gen_random_uuid(); existing uuid;
 spec jsonb; concept_ids jsonb; payment uuid;
BEGIN
 owner_id:=demo_flow_writer.assert_registry_owner();
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'DEMO_PREPARER_READ_COMMITTED_REQUIRED' USING ERRCODE='25001'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));
 SELECT * INTO STRICT a FROM demo_fixture_identity.preparation_admissions WHERE id=p_admission FOR UPDATE;
 policy:=demo_flow_writer.validated_scheduler(a.scheduler_approval_id);
 PERFORM demo_fixture_identity.assert_preparation_admission(a.id);
 IF a.admitted_by_owner<>owner_id OR clock_timestamp()>=a.valid_until THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_ADMISSION_INVALID' USING ERRCODE='42501'; END IF;
 SELECT receipt_id INTO existing FROM demo_fixture_identity.preparation_runs WHERE admission_id=a.id;
 IF FOUND THEN
  -- Idempotency only before financial materialization. Existing documents are never adopted.
  PERFORM demo_flow_writer.verify_identity_receipt(existing);
  RETURN existing;
 END IF;
 SELECT jsonb_agg(jsonb_build_object('fixture_key',fixture_key,'cliente_id',cliente_id,
 'contacto_id',contacto_id,'empresa_id',empresa_id) ORDER BY fixture_key) INTO clients
 FROM demo_fixture_identity.registry;
 IF clients IS DISTINCT FROM a.client_bindings THEN
  RAISE EXCEPTION 'DEMO_ADMITTED_CLIENT_BINDINGS_DRIFT' USING ERRCODE='23514'; END IF;
 SELECT to_jsonb(t) INTO current_row FROM public.presupuesto_categorias t
 WHERE id=a.category_id AND organization_id=policy.organization_id AND activa FOR SHARE;
 IF current_row IS NULL OR current_row IS DISTINCT FROM a.category_snapshot THEN
  RAISE EXCEPTION 'DEMO_ADMITTED_CATEGORY_DRIFT' USING ERRCODE='23514'; END IF;
 IF (SELECT array_agg(fixture_id ORDER BY fixture_id) FROM demo_fixture_identity.preparation_bindings WHERE admission_id=a.id)
 IS DISTINCT FROM ARRAY['aap-vencida','ofc-parcial','ttn-vigente'] THEN
  RAISE EXCEPTION 'DEMO_ADMISSION_THREE_BINDINGS_REQUIRED' USING ERRCODE='23514'; END IF;
 FOR b IN SELECT * FROM demo_fixture_identity.preparation_bindings WHERE admission_id=a.id ORDER BY fixture_id FOR SHARE LOOP
  SELECT to_jsonb(t) INTO current_row FROM public.proveedores t WHERE id=b.supplier_id
   AND organization_id=policy.organization_id AND deleted_at IS NULL AND estado_alta='aprobado' FOR SHARE;
  IF current_row IS NULL OR current_row IS DISTINCT FROM b.supplier_snapshot THEN
   RAISE EXCEPTION 'DEMO_ADMITTED_SUPPLIER_DRIFT' USING ERRCODE='23514'; END IF;
  SELECT to_jsonb(t) INTO current_row FROM public.embarques t WHERE id=b.shipment_id
   AND organization_id=policy.organization_id AND deleted_at IS NULL AND estado::text<>'Cancelado' FOR SHARE;
  IF current_row IS NULL OR current_row IS DISTINCT FROM b.shipment_snapshot THEN
   RAISE EXCEPTION 'DEMO_ADMITTED_SHIPMENT_DRIFT' USING ERRCODE='23514'; END IF;
  spec:=demo_flow_writer.fixture_spec(b.fixture_id);
  IF spec IS NULL THEN RAISE EXCEPTION 'DEMO_FIXTURE_SPEC_REQUIRED' USING ERRCODE='23514'; END IF;
  concept_ids:=CASE WHEN b.fixture_id='ttn-vigente' THEN jsonb_build_array(gen_random_uuid())
   ELSE jsonb_build_array(gen_random_uuid(),gen_random_uuid()) END;
  payment:=CASE WHEN b.fixture_id='ofc-parcial' THEN gen_random_uuid() ELSE NULL END;
  bindings:=bindings||jsonb_build_array(jsonb_build_object('fixture_id',b.fixture_id,
   'supplier_id',b.supplier_id,'shipment_id',b.shipment_id,'supplier_snapshot',b.supplier_snapshot,
   'shipment_snapshot',b.shipment_snapshot,'invoice_id',gen_random_uuid(),'concept_ids',concept_ids,
   'payment_id',payment,'fixture_sha256',encode(sha256(convert_to(spec::text,'UTF8')),'hex')));
 END LOOP;
 payload:=jsonb_build_object('receipt_id',receipt,'source_run_id',source_run,'source_version','identity-preparer-v1',
  'organization_id',policy.organization_id,'manifest_version',policy.manifest_version,'manifest_sha256',policy.manifest_sha256,
  'category_id',a.category_id,'category_snapshot',a.category_snapshot,'bindings',bindings,
  'bindings_sha256',encode(sha256(convert_to(bindings::text,'UTF8')),'hex'));
 payload:=payload||jsonb_build_object('source_sha256',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
 INSERT INTO demo_fixture_identity.prepared_receipts VALUES(receipt,payload,clients);
 INSERT INTO demo_fixture_identity.preparation_runs(id,admission_id,receipt_id,scheduler_approval_id,produced_by_owner,
  initiator_kind,initiator_job_id,organization_id,manifest_version,manifest_sha256,source_version,source_sha256,client_bindings_sha256)
 VALUES(source_run,a.id,receipt,policy.id,owner_id,'scheduler',policy.job_id,policy.organization_id,
  policy.manifest_version,policy.manifest_sha256,'identity-preparer-v1',payload->>'source_sha256',
  encode(sha256(convert_to(clients::text,'UTF8')),'hex'));
 PERFORM demo_flow_writer.verify_identity_receipt(receipt);
 -- Revalidate delegation/expiry after work; statement failure rolls back every generated record.
 PERFORM demo_fixture_identity.assert_preparation_admission(a.id);
 IF clock_timestamp()>=a.valid_until THEN RAISE EXCEPTION 'DEMO_IDENTITY_ADMISSION_EXPIRED' USING ERRCODE='42501'; END IF;
 RETURN receipt;
END $$;
-- Close inherited default grants on these six NEW objects only, including any
-- non-application role. Owner is the explicit administrative trust boundary.
DO $$ DECLARE o record; g record; recipient text; BEGIN
 FOR o IN
 SELECT c.relowner owner_id,c.relacl acl,'r'::"char" kind,
 'TABLE '||quote_ident(n.nspname)||'.'||quote_ident(c.relname) target
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='demo_fixture_identity' AND c.relname IN('preparation_admissions','preparation_bindings','preparation_runs')
 UNION ALL
 SELECT p.proowner,p.proacl,'f'::"char",'FUNCTION '||p.oid::regprocedure::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='demo_fixture_identity' AND p.proname IN('assert_preparation_admission','prepare_identity_receipt','verify_preparation_origin')
 LOOP
  FOR g IN SELECT DISTINCT grantee FROM aclexplode(coalesce(o.acl,acldefault(o.kind,o.owner_id))) WHERE grantee<>o.owner_id LOOP
   recipient:=CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(g.grantee)) END;
   EXECUTE 'REVOKE ALL PRIVILEGES ON '||o.target||' FROM '||recipient||' CASCADE';
  END LOOP;
 END LOOP;
END $$;
-- PUBLIC/default ACL hardening affects only objects added in this proposal.
REVOKE ALL ON demo_fixture_identity.preparation_admissions,demo_fixture_identity.preparation_bindings,demo_fixture_identity.preparation_runs FROM PUBLIC;
REVOKE ALL ON FUNCTION demo_fixture_identity.assert_preparation_admission(uuid),demo_fixture_identity.verify_preparation_origin(uuid),demo_fixture_identity.prepare_identity_receipt(uuid) FROM PUBLIC;
DO $$ DECLARE app record; obj text; BEGIN
 FOR app IN SELECT oid FROM pg_roles WHERE rolname IN('anon','authenticated','service_role','authenticator') LOOP
  FOREACH obj IN ARRAY ARRAY['preparation_admissions','preparation_bindings','preparation_runs'] LOOP
   IF has_table_privilege(app.oid,'demo_fixture_identity.'||obj,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN
    RAISE EXCEPTION 'DEMO_PREPARER_UNEXPECTED_DEFAULT_ACL' USING ERRCODE='42501'; END IF;
  END LOOP;
  IF has_function_privilege(app.oid,'demo_fixture_identity.assert_preparation_admission(uuid)','EXECUTE')
   OR has_function_privilege(app.oid,'demo_fixture_identity.prepare_identity_receipt(uuid)','EXECUTE')
   OR has_function_privilege(app.oid,'demo_fixture_identity.verify_preparation_origin(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'DEMO_PREPARER_UNEXPECTED_DEFAULT_ACL' USING ERRCODE='42501'; END IF;
 END LOOP;
END $$;
COMMIT;
