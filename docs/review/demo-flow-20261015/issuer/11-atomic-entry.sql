-- REVIEW ONLY. This replaces NO public function and never touches active_command.
BEGIN;
CREATE TABLE demo_flow_writer.seed_checkpoints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), execution_run_id uuid NOT NULL,
 lineage_id uuid NOT NULL, actor_key text NOT NULL DEFAULT 'demo_generator' CHECK(actor_key='demo_generator'),
 previous_seeded_at timestamptz, checked_at timestamptz NOT NULL, skip_ms bigint NOT NULL CHECK(skip_ms>=0),
 materialization_status text NOT NULL CHECK(materialization_status IN ('executed','replayed')),
 projection_sha256 text NOT NULL,
 FOREIGN KEY(execution_run_id,lineage_id) REFERENCES demo_flow_writer.runs(id,lineage_id)
);
CREATE TABLE demo_flow_writer.execution_receipts (
 execution_run_id uuid PRIMARY KEY REFERENCES demo_flow_writer.authorization_receipts(run_id),
 lineage_id uuid NOT NULL, checkpoint_id uuid NOT NULL REFERENCES demo_flow_writer.seed_checkpoints,
 checked_at timestamptz NOT NULL, status text NOT NULL CHECK(status IN ('materialized','recent')),
 materialization text NOT NULL CHECK(materialization IN ('executed','replayed')),
 projection_sha256 text NOT NULL,
 FOREIGN KEY(execution_run_id,lineage_id) REFERENCES demo_flow_writer.runs(id,lineage_id)
);
CREATE TRIGGER immutable_checkpoints BEFORE UPDATE OR DELETE ON demo_flow_writer.seed_checkpoints
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE TRIGGER immutable_execution_receipts BEFORE UPDATE OR DELETE ON demo_flow_writer.execution_receipts
 FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.immutable();
CREATE FUNCTION demo_flow_writer.assert_issued(p_run uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE a demo_flow_writer.authorization_receipts; r demo_flow_writer.runs;
BEGIN
 PERFORM demo_flow_writer.assert_existing_transport();
 SELECT * INTO STRICT a FROM demo_flow_writer.authorization_receipts WHERE run_id=p_run;
 SELECT * INTO STRICT r FROM demo_flow_writer.runs WHERE id=p_run;
 IF (a.lineage_id,a.organization_id,a.manifest_sha256,a.lineage_sha256,a.principal,a.not_before,a.expires_at,
     a.initiator_kind,a.initiator_user_id,a.initiator_job_id)
   IS DISTINCT FROM (r.lineage_id,r.organization_id,r.manifest_sha256,r.lineage_sha256,r.session_principal,
     r.not_before,r.issued_expires_at,r.initiator_kind,r.initiator_user_id,r.initiator_job_id)
   OR a.principal IS DISTINCT FROM session_user::name THEN RAISE EXCEPTION 'DEMO_ISSUANCE_CONFLICT'; END IF;
 PERFORM demo_flow_writer.authorize(p_run);
END $$;
CREATE FUNCTION demo_flow_writer.execute_and_checkpoint(p_run_id uuid,p_skip_ms bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE l demo_flow_writer.lineages; cp demo_flow_writer.seed_checkpoints;
 previous_at timestamptz; result jsonb; receipt demo_flow_writer.execution_receipts; mode text;
BEGIN
 IF p_skip_ms IS NULL OR p_skip_ms<0 THEN RAISE EXCEPTION 'DEMO_INVALID_SKIP'; END IF;
 PERFORM demo_flow_writer.assert_issued(p_run_id);
 l:=demo_flow_writer.authorize(p_run_id);
 -- authorize holds shared policy locks and exclusive seed advisory lock until COMMIT.
 SELECT last_seeded_at INTO previous_at FROM public.demo_seed_state WHERE id=true FOR UPDATE;
 SELECT * INTO receipt FROM demo_flow_writer.execution_receipts WHERE execution_run_id=p_run_id;
 IF FOUND THEN
  PERFORM demo_flow_writer.verify_materialized(p_run_id);
  SELECT * INTO STRICT cp FROM demo_flow_writer.seed_checkpoints WHERE id=receipt.checkpoint_id;
  IF cp.checked_at IS DISTINCT FROM previous_at OR cp.projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(l.id)
   THEN RAISE EXCEPTION 'DEMO_RETRY_CHECKPOINT_CONFLICT'; END IF;
  RETURN jsonb_build_object('run_id',p_run_id,'lineage_id',l.id,'checkpoint_id',cp.id,'checked_at',cp.checked_at,
   'status',receipt.status,'materialization',receipt.materialization);
 END IF;
 IF previous_at IS NOT NULL AND previous_at<=clock_timestamp()
   AND extract(epoch FROM clock_timestamp()-previous_at)*1000<p_skip_ms THEN
  SELECT * INTO cp FROM demo_flow_writer.seed_checkpoints WHERE lineage_id=l.id AND checked_at=previous_at;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMO_RECENT_NOT_VERIFIED'; END IF;
  PERFORM demo_flow_writer.verify_materialized(p_run_id);
  IF cp.projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(l.id)
    OR NOT EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts a WHERE a.run_id=cp.execution_run_id
      AND a.lineage_id=l.id AND cp.checked_at>=a.not_before AND cp.checked_at<a.expires_at)
    THEN RAISE EXCEPTION 'DEMO_RECENT_CHECKPOINT_CONFLICT'; END IF;
  mode:='recent';
 ELSE
  result:=demo_flow_writer.execute(p_run_id);
  IF result->>'status' IS NULL OR result->>'status' NOT IN ('executed','replayed') THEN RAISE EXCEPTION 'DEMO_EXECUTION_FAILED'; END IF;
  PERFORM demo_flow_writer.verify_materialized(p_run_id);
  INSERT INTO demo_flow_writer.seed_checkpoints(execution_run_id,lineage_id,previous_seeded_at,checked_at,skip_ms,
    materialization_status,projection_sha256)
   VALUES(p_run_id,l.id,previous_at,clock_timestamp(),p_skip_ms,result->>'status',demo_flow_writer.projection_sha256(l.id))
   RETURNING * INTO cp;
  INSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,cp.checked_at)
   ON CONFLICT(id) DO UPDATE SET last_seeded_at=EXCLUDED.last_seeded_at;
  mode:='materialized';
 END IF;
 INSERT INTO demo_flow_writer.execution_receipts VALUES(p_run_id,l.id,cp.id,cp.checked_at,mode,
  CASE WHEN mode='recent' THEN 'replayed' ELSE cp.materialization_status END,cp.projection_sha256)
 RETURNING * INTO receipt;
 PERFORM demo_flow_writer.assert_issued(p_run_id);
 RETURN jsonb_build_object('run_id',p_run_id,'lineage_id',l.id,'checkpoint_id',cp.id,'checked_at',cp.checked_at,
  'status',mode,'materialization',receipt.materialization);
END $$;
CREATE FUNCTION demo_flow_writer.authorize_issuance_deferred() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM demo_flow_writer.assert_issued(NEW.execution_run_id); RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER execution_authorized_deferred AFTER INSERT ON demo_flow_writer.execution_receipts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION demo_flow_writer.authorize_issuance_deferred();
-- Use original 06 guards after this file (checkpoint table is compatible); no 05 route.
REVOKE ALL ON ALL TABLES IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
