-- ISOLATED REVIEW PROPOSAL; NOT WIRED INTO THE RUNNER BY THIS FILE.
-- Historical replay failure 23514 DEMO_FINANCIAL_ADOPTION_DENIED is retained.
-- Same context + completed INITIAL authorization retries the SAME run/checkpoint.
-- New contexts retain the original initial anti-adoption path; purpose=replay
-- still reaches HOLD_REPLAY_ORIGIN_ADAPTER_REQUIRED (no adapter implemented).
-- No grants, roles, registrations, activation, business DML, or transport change.
-- CREATE OR REPLACE preserves the existing function owner and ACL; INVOKER remains.
-- Apply only after source/owner/descriptor pins are verified in an isolated lab.
-- No SQL execution or production correctness is certified by offline checks.
--
-- Derivation: compile milestone c3a593c94f236aab01c887728c07748eb6912cae.
-- upstream/flow/issuer/10-issuer.sql SHA256:
-- 8c739036ea948163d83617d6f59068f5b414a641c251c7ac4115be82b3d0a81e
-- Original prepare_authorized_run statement SHA256 (LF, no trailing newline):
-- fa7f2186dff8847f265148380b5726f6a02cf27709c79b2b39f633edb377194c
-- Original pg_proc.prosrc SHA256:
-- 7714ae2d6814df546d30c9abfcab3a4eaa51176b5887e4d5f1b2e169788664b1
-- Only CREATE OR REPLACE, declarations, and the marked early branch differ.
-- Original fallback below the branch is retained, including its historical
-- existing-authorization branch. INITIAL existing rows return only through the
-- stricter early branch; no existing row still runs original initial verification.
-- Payload source/bindings digests are external. Typed writer identity/lineage seals
-- stay internal and are checked by assert_issued/verify_materialized, not equated.
-- A changed/expired policy, current marker/projection drift, partial issuance, or
-- inconsistent origin rejects retry; this patch promises no retry availability.
CREATE OR REPLACE FUNCTION demo_flow_writer.prepare_authorized_run(p_context_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c jsonb; i jsonb; b jsonb; r demo_flow_writer.runs;
 l demo_flow_writer.lineages; ident demo_flow_writer.identity_receipts; existing demo_flow_writer.authorization_receipts;
 now_at timestamptz:=clock_timestamp();
 retry_origin jsonb; retry_clients jsonb; retry_bindings jsonb; retry_ids uuid[];
 retry_owner oid; retry_origin_oid oid; retry_app record;
 retry_execution demo_flow_writer.execution_receipts; retry_checkpoint demo_flow_writer.seed_checkpoints;
 retry_marker timestamptz;
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
 -- BEGIN SAME_CONTEXT_RETRY_CORRECTION
 -- A repeated INITIAL context is the same authorization, not a new replay run.
 -- Without an existing authorization this branch does nothing: original initial
 -- anti-adoption verification below remains mandatory and unchanged.
 IF c->>'purpose'='initial' THEN
  SELECT a.* INTO existing FROM demo_flow_writer.authorization_receipts a
   WHERE a.context_id=p_context_id FOR SHARE;
  IF FOUND THEN
   IF (existing.context_id,existing.run_id,existing.lineage_id,existing.organization_id,
       existing.identity_receipt_id,existing.identity_version,existing.origin_identity_sha256,
       existing.manifest_sha256,existing.principal,existing.not_before,existing.expires_at,
       existing.initiator_kind,existing.initiator_user_id,existing.initiator_job_id)
    IS DISTINCT FROM
      (p_context_id,(c->>'run_id')::uuid,(c->>'lineage_id')::uuid,(c->>'organization_id')::uuid,
       (c->>'identity_receipt_id')::uuid,c->>'identity_version',c->>'identity_sha256',
       c->>'manifest_sha256',session_user::name,(c->>'not_before')::timestamptz,(c->>'expires_at')::timestamptz,
       c->>'initiator_kind',(c->>'initiator_user_id')::uuid,c->>'initiator_job_id') THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_AUTHORIZATION_CONFLICT' USING ERRCODE='42501'; END IF;
   -- Real issuance/authorization rechecks owner, active policy, expiry, revocation,
   -- lineage seal and locks. A UUID or old row alone grants no retry authority.
   PERFORM demo_flow_writer.assert_issued(existing.run_id);
   SELECT x.* INTO STRICT r FROM demo_flow_writer.runs x WHERE x.id=existing.run_id FOR SHARE;
   SELECT x.* INTO STRICT l FROM demo_flow_writer.lineages x WHERE x.id=existing.lineage_id FOR SHARE;
   IF r.purpose IS DISTINCT FROM 'initial'
    OR (l.id,l.initial_run_id,l.organization_id,l.manifest_version,l.manifest_sha256,
        l.source_session_principal,l.initiator_kind,l.initiator_user_id,l.initiator_job_id)
      IS DISTINCT FROM
       (existing.lineage_id,existing.run_id,existing.organization_id,c->>'manifest_version',existing.manifest_sha256,
        existing.principal,existing.initiator_kind,existing.initiator_user_id,existing.initiator_job_id) THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_RUN_LINEAGE_CONFLICT' USING ERRCODE='42501'; END IF;
   -- Preserve the bridge's descriptor/access gate; this is the real private
   -- preparer verifier, never a success fixture or the unimplemented replay adapter.
   retry_owner:=current_user::regrole::oid;
   retry_origin_oid:=to_regprocedure('demo_fixture_identity.verify_preparation_origin(uuid)');
   IF (SELECT nspowner FROM pg_namespace WHERE nspname='demo_fixture_identity') IS DISTINCT FROM retry_owner
    OR (SELECT nspowner FROM pg_namespace WHERE nspname='demo_flow_writer') IS DISTINCT FROM retry_owner
    OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=retry_origin_oid AND proowner=retry_owner
      AND NOT prosecdef AND prorettype='jsonb'::regtype) THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_ORIGIN_VERIFIER_HOLD' USING ERRCODE='55000'; END IF;
   FOR retry_app IN SELECT oid FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','authenticator') LOOP
    IF has_function_privilege(retry_app.oid,retry_origin_oid,'EXECUTE')
     OR has_table_privilege(retry_app.oid,'demo_fixture_identity.prepared_receipts','INSERT,UPDATE,DELETE,TRUNCATE') THEN
     RAISE EXCEPTION 'DEMO_SAME_CONTEXT_ORIGIN_ACCESS_HOLD' USING ERRCODE='55000'; END IF;
   END LOOP;
   retry_origin:=demo_fixture_identity.verify_preparation_origin(existing.identity_receipt_id);
   SELECT p.payload,p.client_bindings INTO STRICT i,retry_clients
    FROM demo_fixture_identity.prepared_receipts p WHERE p.receipt_id=existing.identity_receipt_id FOR SHARE;
   IF i IS NULL OR jsonb_typeof(i) IS DISTINCT FROM 'object' OR retry_origin IS NULL
    OR (i->>'receipt_id')::uuid IS DISTINCT FROM existing.identity_receipt_id
    OR (i->>'organization_id')::uuid IS DISTINCT FROM existing.organization_id
    OR i->>'manifest_version' IS DISTINCT FROM c->>'manifest_version'
    OR i->>'manifest_sha256' IS DISTINCT FROM existing.manifest_sha256
    OR i->>'source_version' IS DISTINCT FROM existing.identity_version
    OR i->>'source_sha256' IS DISTINCT FROM existing.origin_identity_sha256
    OR i->>'source_sha256' IS DISTINCT FROM demo_flow_writer.sha256(i-'source_sha256')
    OR i->>'bindings_sha256' IS DISTINCT FROM existing.bindings_sha256
    OR i->>'bindings_sha256' IS DISTINCT FROM demo_flow_writer.sha256(i->'bindings')
    OR retry_origin->>'receipt_id' IS DISTINCT FROM i->>'receipt_id'
    OR retry_origin->>'source_run_id' IS DISTINCT FROM i->>'source_run_id'
    OR retry_origin->>'source_version' IS DISTINCT FROM i->>'source_version'
    OR retry_origin->>'source_sha256' IS DISTINCT FROM i->>'source_sha256'
    OR retry_origin->>'client_bindings_sha256' IS DISTINCT FROM demo_flow_writer.sha256(retry_clients)
    OR NOT EXISTS(SELECT 1 FROM demo_flow_writer.server_admissions a WHERE a.context_id=p_context_id
      AND retry_origin->>'scheduler_approval_id'=a.scheduler_approval_id::text
      AND retry_origin->'scheduler_snapshot'=a.scheduler_snapshot
      AND retry_origin->'transport_snapshot'=a.transport_snapshot) THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_ORIGIN_CONFLICT' USING ERRCODE='42501'; END IF;
   SELECT x.* INTO STRICT ident FROM demo_flow_writer.identity_receipts x WHERE x.lineage_id=existing.lineage_id FOR SHARE;
   IF (ident.source_run_id,ident.source_version,ident.category_id,ident.category_snapshot)
      IS DISTINCT FROM
       ((i->>'source_run_id')::uuid,i->>'source_version',(i->>'category_id')::uuid,i->'category_snapshot') THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_IDENTITY_CONFLICT' USING ERRCODE='42501'; END IF;
   SELECT jsonb_agg(to_jsonb(w)-'lineage_id' ORDER BY w.fixture_id) INTO retry_bindings
    FROM demo_flow_writer.bindings w WHERE w.lineage_id=existing.lineage_id;
   -- External binding seals exclude lineage_id; internal identity seals include it.
   -- Compare full typed records in their own serialization domain, not unlike hashes.
   IF jsonb_typeof(i->'bindings') IS DISTINCT FROM 'array' OR i->'bindings' IS DISTINCT FROM retry_bindings THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_BINDINGS_CONFLICT' USING ERRCODE='42501'; END IF;
   SELECT array_agg(q.id) INTO retry_ids FROM(
    SELECT (v.value->>'invoice_id')::uuid AS id FROM jsonb_array_elements(i->'bindings') v
    UNION ALL SELECT (v.value->>'payment_id')::uuid FROM jsonb_array_elements(i->'bindings') v WHERE v.value->>'payment_id' IS NOT NULL
    UNION ALL SELECT x.value::uuid FROM jsonb_array_elements(i->'bindings') v
     CROSS JOIN LATERAL jsonb_array_elements_text(v.value->'concept_ids') x) q;
   IF cardinality(retry_ids) IS DISTINCT FROM 9 OR array_position(retry_ids,NULL) IS NOT NULL
    OR (SELECT count(DISTINCT u.id) FROM unnest(retry_ids) u(id))<>9 THEN
    RAISE EXCEPTION 'DEMO_FINANCIAL_ID_COLLISION' USING ERRCODE='23514'; END IF;
   -- Full authentic live snapshots/history/claims and internal seals must match.
   -- No partial issuance is resumed or converted to a materialized success here.
   PERFORM demo_flow_writer.verify_materialized(existing.run_id);
   SELECT x.* INTO STRICT retry_execution FROM demo_flow_writer.execution_receipts x
    WHERE x.execution_run_id=existing.run_id FOR SHARE;
   SELECT x.* INTO STRICT retry_checkpoint FROM demo_flow_writer.seed_checkpoints x
    WHERE x.id=retry_execution.checkpoint_id FOR SHARE;
   SELECT s.last_seeded_at INTO STRICT retry_marker FROM public.demo_seed_state s WHERE s.id=true FOR SHARE;
   IF (retry_execution.lineage_id,retry_execution.checked_at,retry_execution.projection_sha256)
      IS DISTINCT FROM (existing.lineage_id,retry_checkpoint.checked_at,retry_checkpoint.projection_sha256)
    OR retry_execution.status IS DISTINCT FROM 'materialized'
    OR retry_execution.materialization IS DISTINCT FROM retry_checkpoint.materialization_status
    OR retry_checkpoint.execution_run_id IS DISTINCT FROM existing.run_id
    OR retry_checkpoint.lineage_id IS DISTINCT FROM existing.lineage_id
    OR retry_checkpoint.projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(existing.lineage_id)
    OR retry_checkpoint.checked_at IS DISTINCT FROM retry_marker
    OR retry_checkpoint.checked_at<existing.not_before OR retry_checkpoint.checked_at>=existing.expires_at
    OR retry_checkpoint.checked_at>clock_timestamp() THEN
    RAISE EXCEPTION 'DEMO_SAME_CONTEXT_CHECKPOINT_CONFLICT' USING ERRCODE='42501'; END IF;
   PERFORM demo_flow_writer.assert_issued(existing.run_id);
   RETURN to_jsonb(existing)||jsonb_build_object('run_id',existing.run_id,'purpose',c->>'purpose',
    'session_principal',existing.principal,'manifest_version',c->>'manifest_version',
    'identity_sha256',existing.origin_identity_sha256);
  END IF;
 END IF;
 -- END SAME_CONTEXT_RETRY_CORRECTION
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

