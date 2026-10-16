-- TEST-ONLY PROPOSAL. No migration, grants, public RPC, issuer or preparer.
-- Requires existing private identity registry and writer schema owned by caller.
-- An independently reviewed preparer must implement verify_preparation_origin(uuid).
-- Without that dependency every receipt remains HOLD. Test doubles are not provenance.
DO $$ BEGIN
 IF (SELECT nspowner FROM pg_namespace WHERE nspname='demo_fixture_identity') IS DISTINCT FROM current_user::regrole::oid
 OR (SELECT nspowner FROM pg_namespace WHERE nspname='demo_flow_writer') IS DISTINCT FROM current_user::regrole::oid THEN
  RAISE EXCEPTION 'DEMO_BRIDGE_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;
CREATE TABLE demo_fixture_identity.prepared_receipts (
 receipt_id uuid PRIMARY KEY,
 payload jsonb NOT NULL,
 client_bindings jsonb NOT NULL,
 CHECK(jsonb_typeof(payload)='object'),
 CHECK(jsonb_typeof(client_bindings)='array')
);
REVOKE ALL ON demo_fixture_identity.prepared_receipts FROM PUBLIC;
CREATE TRIGGER immutable_preparation_receipt BEFORE UPDATE OR DELETE
 ON demo_fixture_identity.prepared_receipts FOR EACH ROW
 EXECUTE FUNCTION demo_fixture_identity.reject_rebinding();

CREATE OR REPLACE FUNCTION demo_flow_writer.verify_identity_receipt(p_receipt_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE
 r demo_fixture_identity.prepared_receipts; p jsonb; b jsonb; c jsonb; origin jsonb;
 origin_oid oid; expected_owner oid; actual jsonb; linked_client uuid;
 org constant uuid:='00000000-0000-4000-8000-000000000001'; app record; ids uuid[];
BEGIN
 SELECT nspowner INTO STRICT expected_owner FROM pg_namespace WHERE nspname='demo_fixture_identity';
 IF current_user::regrole::oid<>expected_owner THEN
  RAISE EXCEPTION 'DEMO_BRIDGE_OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 origin_oid:=to_regprocedure('demo_fixture_identity.verify_preparation_origin(uuid)');
 IF origin_oid IS NULL THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_PROVENANCE_HOLD: authentic preparer is not installed' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=origin_oid AND proowner=expected_owner
   AND NOT prosecdef AND prorettype='jsonb'::regtype) THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_PROVENANCE_HOLD: unexpected origin verifier' USING ERRCODE='55000'; END IF;
 FOR app IN SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','authenticator') LOOP
  IF has_function_privilege(app.oid,origin_oid,'EXECUTE')
   OR has_table_privilege(app.oid,'demo_fixture_identity.prepared_receipts','INSERT,UPDATE,DELETE,TRUNCATE') THEN
   RAISE EXCEPTION 'DEMO_IDENTITY_PROVENANCE_HOLD: application access to provenance' USING ERRCODE='55000'; END IF;
 END LOOP;
 SELECT * INTO r FROM demo_fixture_identity.prepared_receipts WHERE receipt_id=p_receipt_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_IDENTITY_RECEIPT_MISSING' USING ERRCODE='55000'; END IF;
 p:=r.payload;
 IF (p->>'receipt_id')::uuid IS DISTINCT FROM p_receipt_id
 OR (p->>'organization_id')::uuid IS DISTINCT FROM org
 OR p->>'manifest_version' IS DISTINCT FROM 'seed-core-cxp-v1'
 OR coalesce(p->>'source_version','')=''
 OR (p->>'source_run_id')::uuid IS NULL
 OR coalesce(p->>'manifest_sha256','') !~ '^[0-9a-f]{64}$'
 OR coalesce(p->>'source_sha256','') !~ '^[0-9a-f]{64}$'
 OR p->>'source_sha256' IS DISTINCT FROM encode(sha256(convert_to((p-'source_sha256')::text,'UTF8')),'hex')
 OR p->>'bindings_sha256' IS DISTINCT FROM encode(sha256(convert_to((p->'bindings')::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_RECEIPT_CONFLICT' USING ERRCODE='23514'; END IF;
 EXECUTE 'SELECT demo_fixture_identity.verify_preparation_origin($1)' INTO origin USING p_receipt_id;
 IF origin IS NULL OR origin->>'receipt_id' IS DISTINCT FROM p->>'receipt_id'
 OR origin->>'source_run_id' IS DISTINCT FROM p->>'source_run_id'
 OR origin->>'source_version' IS DISTINCT FROM p->>'source_version'
 OR origin->>'source_sha256' IS DISTINCT FROM p->>'source_sha256'
 OR origin->>'client_bindings_sha256' IS DISTINCT FROM encode(sha256(convert_to(r.client_bindings::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION 'DEMO_IDENTITY_ORIGIN_CONFLICT' USING ERRCODE='23514'; END IF;
 IF jsonb_array_length(r.client_bindings)<>3
 OR (SELECT array_agg(value->>'fixture_key' ORDER BY value->>'fixture_key') FROM jsonb_array_elements(r.client_bindings))
 IS DISTINCT FROM ARRAY['cliente.bajio','cliente.monterrey','cliente.pacifico'] THEN
  RAISE EXCEPTION 'DEMO_CLIENT_LINEAGE_INCOMPLETE' USING ERRCODE='23514'; END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(r.client_bindings) LOOP
  IF NOT EXISTS(SELECT 1 FROM demo_fixture_identity.registry g WHERE g.fixture_key=c->>'fixture_key'
   AND g.cliente_id=(c->>'cliente_id')::uuid AND g.contacto_id IS NOT DISTINCT FROM (c->>'contacto_id')::uuid
   AND g.empresa_id=(c->>'empresa_id')::uuid) THEN
   RAISE EXCEPTION 'DEMO_CLIENT_LINEAGE_CONFLICT' USING ERRCODE='23514'; END IF;
  PERFORM demo_fixture_identity.assert_ids(c->>'fixture_key',(c->>'cliente_id')::uuid,(c->>'contacto_id')::uuid,(c->>'empresa_id')::uuid);
 END LOOP;
 IF jsonb_typeof(p->'bindings') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'bindings')<>3
 OR (SELECT array_agg(value->>'fixture_id' ORDER BY value->>'fixture_id') FROM jsonb_array_elements(p->'bindings'))
 IS DISTINCT FROM ARRAY['aap-vencida','ofc-parcial','ttn-vigente']
 OR p->'bindings' IS DISTINCT FROM (SELECT jsonb_agg(value ORDER BY value->>'fixture_id') FROM jsonb_array_elements(p->'bindings')) THEN
  RAISE EXCEPTION 'DEMO_FINANCIAL_BINDINGS_INCOMPLETE' USING ERRCODE='23514'; END IF;
 SELECT to_jsonb(t) INTO actual FROM public.presupuesto_categorias t WHERE id=(p->>'category_id')::uuid
 AND organization_id=org AND activa FOR SHARE;
 IF actual IS NULL OR actual IS DISTINCT FROM p->'category_snapshot' THEN
  RAISE EXCEPTION 'DEMO_CATEGORY_PROVENANCE_CONFLICT' USING ERRCODE='23514'; END IF;
 FOR b IN SELECT value FROM jsonb_array_elements(p->'bindings') LOOP
  SELECT to_jsonb(t) INTO actual FROM public.proveedores t WHERE id=(b->>'supplier_id')::uuid
   AND organization_id=org AND deleted_at IS NULL AND estado_alta='aprobado' FOR SHARE;
  IF actual IS NULL OR actual IS DISTINCT FROM b->'supplier_snapshot' THEN
   RAISE EXCEPTION 'DEMO_SUPPLIER_PROVENANCE_CONFLICT' USING ERRCODE='23514'; END IF;
  SELECT to_jsonb(t),t.cliente_id INTO actual,linked_client FROM public.embarques t
   WHERE id=(b->>'shipment_id')::uuid AND organization_id=org AND deleted_at IS NULL AND estado::text<>'Cancelado' FOR SHARE;
  IF actual IS NULL OR actual IS DISTINCT FROM b->'shipment_snapshot'
   OR NOT EXISTS(SELECT 1 FROM demo_fixture_identity.registry WHERE cliente_id=linked_client) THEN
   RAISE EXCEPTION 'DEMO_SHIPMENT_PROVENANCE_CONFLICT' USING ERRCODE='23514'; END IF;
  IF (b->>'invoice_id')::uuid IS NULL OR coalesce(b->>'fixture_sha256','') !~ '^[0-9a-f]{64}$'
   OR jsonb_typeof(b->'concept_ids') IS DISTINCT FROM 'array'
   OR jsonb_array_length(b->'concept_ids')<>(CASE WHEN b->>'fixture_id'='ttn-vigente' THEN 1 ELSE 2 END)
   OR ((b->>'fixture_id'='ofc-parcial') IS DISTINCT FROM ((b->>'payment_id')::uuid IS NOT NULL)) THEN
   RAISE EXCEPTION 'DEMO_FINANCIAL_ID_SHAPE_CONFLICT' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.proveedor_facturas WHERE id=(b->>'invoice_id')::uuid)
   OR EXISTS(SELECT 1 FROM public.proveedor_facturas_conceptos WHERE id IN(SELECT value::uuid FROM jsonb_array_elements_text(b->'concept_ids')))
   OR EXISTS(SELECT 1 FROM public.pagos_proveedor WHERE id=(b->>'payment_id')::uuid) THEN
   RAISE EXCEPTION 'DEMO_FINANCIAL_ADOPTION_DENIED' USING ERRCODE='23514'; END IF;
 END LOOP;
 SELECT array_agg(id) INTO ids FROM(
 SELECT (value->>'invoice_id')::uuid id FROM jsonb_array_elements(p->'bindings')
 UNION ALL SELECT (value->>'payment_id')::uuid FROM jsonb_array_elements(p->'bindings') WHERE value->>'payment_id' IS NOT NULL
 UNION ALL SELECT x.value::uuid FROM jsonb_array_elements(p->'bindings') b CROSS JOIN LATERAL jsonb_array_elements_text(b.value->'concept_ids') x) all_ids;
 IF cardinality(ids)<>9 OR array_position(ids,NULL) IS NOT NULL
 OR (SELECT count(DISTINCT id) FROM unnest(ids) id)<>9 THEN
  RAISE EXCEPTION 'DEMO_FINANCIAL_ID_COLLISION' USING ERRCODE='23514'; END IF;
 RETURN p;
END $$;
REVOKE ALL ON FUNCTION demo_flow_writer.verify_identity_receipt(uuid) FROM PUBLIC;
