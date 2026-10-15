-- REVIEW ONLY. Fixed read-only query, separate connection after uncertain COMMIT.
BEGIN;
CREATE FUNCTION demo_flow_writer.reconcile_run(p_run_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE a demo_flow_writer.authorization_receipts; r demo_flow_writer.runs;
 e demo_flow_writer.execution_receipts; cp demo_flow_writer.seed_checkpoints; answer jsonb;
BEGIN
 PERFORM demo_flow_writer.assert_existing_transport();
 IF current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
  THEN RAISE EXCEPTION 'DEMO_RECONCILE_SNAPSHOT_REQUIRED'; END IF;
 SELECT * INTO a FROM demo_flow_writer.authorization_receipts WHERE run_id=p_run_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('classification','unresolved','run_id',p_run_id); END IF;
 SELECT * INTO r FROM demo_flow_writer.runs WHERE id=p_run_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('classification','inconsistent','run_id',p_run_id,'lineage_id',a.lineage_id); END IF;
 IF a.principal IS DISTINCT FROM session_user::name OR a.lineage_id IS DISTINCT FROM r.lineage_id
   OR a.organization_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'::uuid
   THEN RAISE EXCEPTION 'DEMO_RECONCILE_UNAUTHORIZED' USING ERRCODE='42501'; END IF;
 answer:=jsonb_build_object('run_id',p_run_id,'lineage_id',r.lineage_id);
 -- A committed immutable execution receipt proves positive completion independently
 -- of a terminal absence barrier. A newer marker does not erase this historical fact.
 SELECT * INTO e FROM demo_flow_writer.execution_receipts WHERE execution_run_id=p_run_id;
 IF NOT FOUND THEN
  -- A replay can legitimately have the prior lineage's 13 receipts; only original
  -- initial-run absence requires zero lineage effects. Never call a partial initial run absent.
  IF EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=p_run_id)
   OR (r.purpose='initial' AND (
     EXISTS(SELECT 1 FROM demo_flow_writer.events WHERE lineage_id=r.lineage_id)
     OR EXISTS(SELECT 1 FROM demo_flow_writer.receipts WHERE lineage_id=r.lineage_id)
     OR EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims WHERE lineage_id=r.lineage_id)
     OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings b JOIN public.proveedor_facturas f ON f.id=b.invoice_id WHERE b.lineage_id=r.lineage_id)
     OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings b JOIN public.proveedor_facturas_conceptos c ON c.id=ANY(b.concept_ids) WHERE b.lineage_id=r.lineage_id)
     OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings b JOIN public.pagos_proveedor p ON p.id=b.payment_id WHERE b.lineage_id=r.lineage_id)))
   THEN RETURN answer||jsonb_build_object('classification','inconsistent'); END IF;
  -- Missing execution receipt is not definite absence. terminal_barrier stays an
  -- unimplemented durable-admission extension, never a timeout/empty SELECT shortcut.
  RETURN answer||jsonb_build_object('classification','unresolved');
 END IF;
 BEGIN
  SELECT * INTO STRICT cp FROM demo_flow_writer.seed_checkpoints WHERE id=e.checkpoint_id;
  IF (e.lineage_id,e.checked_at,e.projection_sha256) IS DISTINCT FROM (r.lineage_id,cp.checked_at,cp.projection_sha256)
   OR cp.lineage_id IS DISTINCT FROM r.lineage_id
   OR (e.status='materialized' AND cp.execution_run_id IS DISTINCT FROM p_run_id)
   OR (e.status='recent' AND e.materialization IS DISTINCT FROM 'replayed')
   OR (e.status='materialized' AND e.materialization IS DISTINCT FROM cp.materialization_status)
   OR cp.projection_sha256 IS DISTINCT FROM demo_flow_writer.projection_sha256(r.lineage_id)
   OR r.lineage_sha256 IS DISTINCT FROM demo_flow_writer.lineage_sha256(r.lineage_id)
   OR a.lineage_sha256 IS DISTINCT FROM r.lineage_sha256
   OR a.manifest_sha256 IS DISTINCT FROM demo_flow_writer.manifest_sha256()
   OR NOT EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts issued WHERE issued.run_id=cp.execution_run_id
      AND issued.lineage_id=cp.lineage_id AND cp.checked_at>=issued.not_before AND cp.checked_at<issued.expires_at)
   OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings b JOIN public.bbva_movimientos m ON m.pago_proveedor_id=b.payment_id WHERE b.lineage_id=r.lineage_id)
   OR (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=r.lineage_id)<>13
   OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=r.lineage_id)<>13
   OR (SELECT count(*) FROM demo_flow_writer.fixture_claims WHERE lineage_id=r.lineage_id)<>3
   THEN RAISE EXCEPTION 'DEMO_RECONCILE_EVIDENCE_CONFLICT'; END IF;
  PERFORM demo_flow_writer.verify_identity_readonly(r.lineage_id);
  PERFORM demo_flow_writer.verify_fixture_readonly(r.lineage_id,'aap-vencida',4);
  PERFORM demo_flow_writer.verify_fixture_readonly(r.lineage_id,'ttn-vigente',4);
  PERFORM demo_flow_writer.verify_fixture_readonly(r.lineage_id,'ofc-parcial',5);
 EXCEPTION WHEN raise_exception OR no_data_found OR too_many_rows OR SQLSTATE 'PT409' OR SQLSTATE '42501' OR SQLSTATE '23514' OR SQLSTATE '22023' THEN
  RETURN answer||jsonb_build_object('classification','inconsistent');
 END;
 RETURN answer||jsonb_build_object('classification','complete','checkpoint',jsonb_build_object(
  'run_id',p_run_id,'lineage_id',r.lineage_id,'checkpoint_id',cp.id,'checked_at',cp.checked_at,
  'status',e.status,'materialization',e.materialization));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
