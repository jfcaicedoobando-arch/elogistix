-- REVIEW ONLY, UNAPPLIED. Requires reviewed 01/02/04 engine; never historical 03/05.
BEGIN;
-- No real adapter, transport principal, credential or permission is invented here.
CREATE FUNCTION demo_flow_writer.assert_existing_transport() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 RAISE EXCEPTION 'HOLD_EXISTING_AUTHORIZED_TRANSPORT_UNVERIFIED' USING ERRCODE='42501';
END $$;
CREATE FUNCTION demo_flow_writer.read_server_context(p_context_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 RAISE EXCEPTION 'HOLD_SERVER_AUTHENTICATION_ADAPTER_REQUIRED' USING ERRCODE='42501';
END $$;
CREATE FUNCTION demo_flow_writer.verify_identity_receipt(p_receipt_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 RAISE EXCEPTION 'HOLD_IDENTITY_ORIGIN_ADAPTER_REQUIRED' USING ERRCODE='42501';
END $$;
CREATE FUNCTION demo_flow_writer.verify_replay_identity_receipt(p_receipt_id uuid,p_lineage_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 RAISE EXCEPTION 'HOLD_REPLAY_ORIGIN_ADAPTER_REQUIRED' USING ERRCODE='42501';
END $$;
CREATE FUNCTION demo_flow_writer.terminal_barrier(p_run_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT false $$;

CREATE TABLE demo_flow_writer.authorization_receipts (
 run_id uuid PRIMARY KEY REFERENCES demo_flow_writer.runs,
 context_id uuid NOT NULL UNIQUE,
 lineage_id uuid NOT NULL REFERENCES demo_flow_writer.lineages,
 organization_id uuid NOT NULL CHECK(organization_id='00000000-0000-4000-8000-000000000001'),
 identity_receipt_id uuid NOT NULL, identity_version text NOT NULL,
 origin_identity_sha256 text NOT NULL CHECK(origin_identity_sha256 ~ '^[0-9a-f]{64}$'),
 manifest_sha256 text NOT NULL, bindings_sha256 text NOT NULL,
 lineage_sha256 text NOT NULL, principal name NOT NULL,
 issued_at timestamptz NOT NULL, not_before timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 initiator_kind text NOT NULL, initiator_user_id uuid, initiator_job_id text,
 FOREIGN KEY(run_id,lineage_id) REFERENCES demo_flow_writer.runs(id,lineage_id),
 CHECK(expires_at>not_before)
);
CREATE TRIGGER immutable_authorizations BEFORE UPDATE OR DELETE ON demo_flow_writer.authorization_receipts
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();

-- Adapter contract: obtain + lock verified server context, validate current human account,
-- membership and role OR registered job authority, exact existing DB principal and identity
-- receipt origin. Repeated context gives same run; cannot accept arbitrary caller-supplied facts.
-- No context producer is supplied. Failure auditing belongs to trusted server telemetry,
-- since an exception rolls back all local audit rows; never claim durable denial logs here.
CREATE FUNCTION demo_flow_writer.prepare_authorized_run(p_context_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c jsonb; i jsonb; b jsonb; r demo_flow_writer.runs;
 l demo_flow_writer.lineages; ident demo_flow_writer.identity_receipts; existing demo_flow_writer.authorization_receipts;
 now_at timestamptz:=clock_timestamp();
BEGIN
 PERFORM demo_flow_writer.assert_existing_transport();
 IF NOT demo_flow_writer.entry_gate() THEN RAISE EXCEPTION 'DEMO_DISABLED'; END IF;
 c:=demo_flow_writer.read_server_context(p_context_id);
 IF c IS NULL OR (c->>'context_id')::uuid IS DISTINCT FROM p_context_id
   OR (c->>'organization_id')::uuid IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'::uuid
   OR c->>'session_principal' IS DISTINCT FROM session_user::text
   OR c->>'manifest_version' IS DISTINCT FROM 'seed-core-cxp-v1'
   OR c->>'manifest_sha256' IS DISTINCT FROM demo_flow_writer.manifest_sha256()
   OR c->>'purpose' IS NULL OR c->>'purpose' NOT IN ('initial','replay')
   OR c->>'not_before' IS NULL OR c->>'expires_at' IS NULL
   OR now_at<(c->>'not_before')::timestamptz OR now_at>=(c->>'expires_at')::timestamptz THEN
   RAISE EXCEPTION 'DEMO_TRUSTED_CONTEXT_CONFLICT' USING ERRCODE='42501'; END IF;
 IF c->>'purpose'='initial' THEN
  i:=demo_flow_writer.verify_identity_receipt((c->>'identity_receipt_id')::uuid);
 ELSE
  i:=demo_flow_writer.verify_replay_identity_receipt((c->>'identity_receipt_id')::uuid,(c->>'lineage_id')::uuid);
 END IF;
 IF i IS NULL OR (i->>'receipt_id')::uuid IS DISTINCT FROM (c->>'identity_receipt_id')::uuid
  OR i->>'organization_id' IS DISTINCT FROM c->>'organization_id'
  OR i->>'manifest_version' IS DISTINCT FROM c->>'manifest_version'
  OR i->>'manifest_sha256' IS DISTINCT FROM c->>'manifest_sha256'
  OR i->>'source_sha256' IS DISTINCT FROM c->>'identity_sha256'
  OR i->>'source_version' IS DISTINCT FROM c->>'identity_version'
  OR jsonb_array_length(i->'bindings') IS DISTINCT FROM 3 THEN
   RAISE EXCEPTION 'DEMO_IDENTITY_ORIGIN_CONFLICT' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM demo_flow_writer.authorization_receipts WHERE context_id=p_context_id;
 IF FOUND THEN
  IF existing.run_id IS DISTINCT FROM (c->>'run_id')::uuid
    OR existing.lineage_id IS DISTINCT FROM (c->>'lineage_id')::uuid
    OR existing.identity_receipt_id IS DISTINCT FROM (i->>'receipt_id')::uuid
    OR existing.origin_identity_sha256 IS DISTINCT FROM i->>'source_sha256'
    OR existing.principal IS DISTINCT FROM session_user::name THEN RAISE EXCEPTION 'DEMO_CONTEXT_REUSED'; END IF;
  PERFORM demo_flow_writer.authorize(existing.run_id);
  RETURN to_jsonb(existing)||jsonb_build_object('run_id',existing.run_id,'purpose',c->>'purpose',
   'session_principal',existing.principal,'manifest_version',c->>'manifest_version',
   'identity_sha256',existing.origin_identity_sha256);
 END IF;
 r.id:=(c->>'run_id')::uuid; r.lineage_id:=(c->>'lineage_id')::uuid;
 r.purpose:=c->>'purpose'; r.organization_id:=(c->>'organization_id')::uuid;
 r.manifest_version:=c->>'manifest_version'; r.manifest_sha256:=c->>'manifest_sha256';
 r.session_principal:=session_user; r.initiator_kind:=c->>'initiator_kind';
 r.initiator_user_id:=(c->>'initiator_user_id')::uuid; r.initiator_job_id:=c->>'initiator_job_id';
 r.not_before:=(c->>'not_before')::timestamptz; r.issued_expires_at:=(c->>'expires_at')::timestamptz;
 r.expires_at:=r.issued_expires_at; r.expected_projection_sha256:=c->>'expected_projection_sha256';
 IF r.purpose='initial' THEN
  l.id:=r.lineage_id; l.organization_id:=r.organization_id; l.manifest_version:=r.manifest_version;
  l.manifest_sha256:=r.manifest_sha256; l.business_date:=public.fecha_negocio_mx();
  l.source_session_principal:=session_user; l.initial_run_id:=r.id;
  l.initiator_kind:=r.initiator_kind; l.initiator_user_id:=r.initiator_user_id; l.initiator_job_id:=r.initiator_job_id;
  INSERT INTO demo_flow_writer.lineages SELECT l.*;
  ident.lineage_id:=l.id; ident.source_run_id:=(i->>'source_run_id')::uuid;
  ident.source_version:=i->>'source_version'; ident.category_id:=(i->>'category_id')::uuid;
  ident.category_snapshot:=i->'category_snapshot';
  -- External bridge binds its own canonical envelope. Legacy writer seals full typed
  -- rows including lineage_id; never equate these different serialization domains.
  SELECT demo_flow_writer.sha256(jsonb_agg(to_jsonb(x) ORDER BY x.fixture_id)) INTO ident.bindings_sha256
   FROM jsonb_populate_recordset(NULL::demo_flow_writer.bindings,
    (SELECT jsonb_agg(value||jsonb_build_object('lineage_id',l.id)) FROM jsonb_array_elements(i->'bindings'))) x;
  -- Legacy row seal differs deliberately from the externally attested origin hash.
  ident.source_sha256:=demo_flow_writer.sha256(to_jsonb(ident)-'source_sha256');
  INSERT INTO demo_flow_writer.identity_receipts SELECT ident.*;
  FOR b IN SELECT value FROM jsonb_array_elements(i->'bindings') LOOP
   INSERT INTO demo_flow_writer.bindings(lineage_id,fixture_id,supplier_id,shipment_id,supplier_snapshot,
    shipment_snapshot,invoice_id,concept_ids,payment_id,fixture_sha256)
   VALUES(l.id,b->>'fixture_id',(b->>'supplier_id')::uuid,(b->>'shipment_id')::uuid,b->'supplier_snapshot',
    b->'shipment_snapshot',(b->>'invoice_id')::uuid,
    ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(b->'concept_ids')),
    (b->>'payment_id')::uuid,b->>'fixture_sha256');
  END LOOP;
 ELSE
  SELECT * INTO STRICT l FROM demo_flow_writer.lineages WHERE id=r.lineage_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts a
    WHERE a.run_id=l.initial_run_id AND a.identity_receipt_id=(i->>'receipt_id')::uuid
      AND a.origin_identity_sha256=i->>'source_sha256') THEN RAISE EXCEPTION 'DEMO_REPLAY_ORIGIN_CONFLICT'; END IF;
 END IF;
 r.lineage_sha256:=demo_flow_writer.lineage_sha256(r.lineage_id);
 INSERT INTO demo_flow_writer.runs SELECT r.*;
 PERFORM demo_flow_writer.authorize(r.id);
 PERFORM demo_flow_writer.verify_identity(r.id);
 INSERT INTO demo_flow_writer.authorization_receipts VALUES(r.id,p_context_id,r.lineage_id,r.organization_id,
  (i->>'receipt_id')::uuid,i->>'source_version',i->>'source_sha256',r.manifest_sha256,i->>'bindings_sha256',
  r.lineage_sha256,r.session_principal,now_at,r.not_before,r.expires_at,r.initiator_kind,r.initiator_user_id,r.initiator_job_id);
 RETURN jsonb_build_object('run_id',r.id,'lineage_id',r.lineage_id,'purpose',r.purpose,
  'organization_id',r.organization_id,'manifest_version',r.manifest_version,'manifest_sha256',r.manifest_sha256,
  'identity_receipt_id',i->>'receipt_id','identity_version',i->>'source_version','identity_sha256',i->>'source_sha256',
  'bindings_sha256',i->>'bindings_sha256','lineage_sha256',r.lineage_sha256,
  'session_principal',r.session_principal,'not_before',r.not_before,'expires_at',r.expires_at);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
