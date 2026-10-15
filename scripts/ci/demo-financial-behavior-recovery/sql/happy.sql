\set ON_ERROR_STOP on
-- Authentic engine behavior with SYNTHETIC identity fixtures; assertions then
-- ROLLBACK. This does not prove a committed transaction or durable delivery.
CREATE TEMP TABLE before_happy AS SELECT pg_temp.financial_snapshot() body;
BEGIN;
SELECT context_id FROM pg_temp.financial_context \gset
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS outcome \gset
RESET ROLE;
CREATE TEMP TABLE financial_result AS SELECT :'outcome'::jsonb result;
DO $$ DECLARE r jsonb; v_lineage uuid; v_checkpoint uuid; v_run uuid; BEGIN
 SELECT result INTO STRICT r FROM financial_result;
 v_run:=(r->>'run_id')::uuid; v_lineage:=(r->>'lineage_id')::uuid; v_checkpoint:=(r->>'checkpoint_id')::uuid;
 IF r->>'status' IS DISTINCT FROM 'materialized' OR r->>'materialization' IS DISTINCT FROM 'executed'
 OR v_run IS NULL OR v_lineage IS NULL OR v_checkpoint IS NULL
 THEN RAISE EXCEPTION 'Not newly materialized'; END IF;
 PERFORM demo_flow_writer.verify_materialized(v_run);
 IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.current_approvals WHERE lineage_id=v_lineage)<>3
 OR (SELECT count(*) FROM demo_flow_writer.simulated_payments WHERE lineage_id=v_lineage)<>1
 OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=v_run)<>1
 OR (SELECT count(*) FROM demo_flow_writer.execution_receipts WHERE execution_run_id=v_run)<>1
 OR (SELECT count(*) FROM demo_flow_writer.authorization_receipts WHERE run_id=v_run
  AND context_id=(SELECT context_id FROM pg_temp.financial_context))<>1
 THEN RAISE EXCEPTION 'Authentic materialization cardinality mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints c JOIN public.demo_seed_state s
  ON s.id AND s.last_seeded_at=c.checked_at JOIN demo_flow_writer.execution_receipts x
  ON x.checkpoint_id=c.id AND x.projection_sha256=c.projection_sha256 WHERE c.id=v_checkpoint
  AND x.execution_run_id=v_run AND c.projection_sha256=demo_flow_writer.projection_sha256(v_lineage))
 THEN RAISE EXCEPTION 'Projection/checkpoint/marker/receipt mismatch'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $$;
\echo FINANCIAL_PHASE_happy_materialized
CREATE TEMP TABLE before_replay AS SELECT pg_temp.financial_snapshot() body;
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS replay \gset
RESET ROLE;
CREATE TEMP TABLE replay_result AS SELECT :'replay'::jsonb result;
DO $$ BEGIN
 IF (SELECT result FROM replay_result) IS DISTINCT FROM (SELECT result FROM financial_result)
 THEN RAISE EXCEPTION 'Replay changed execution result'; END IF;
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM before_replay)
 THEN RAISE EXCEPTION 'Replay mutated persistent rows'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $$;
-- Unexpected deferred authorization or transport failures are fatal.
SET LOCAL ROLE service_role;
SELECT demo_financial_lab.flush_deferred();
RESET ROLE;
SELECT 'FINANCIAL_ASSERTIONS_COMPLETE_happy';
ROLLBACK;
DO $$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM before_happy)
 THEN RAISE EXCEPTION 'Happy path rollback left persistent rows'; END IF;
END $$;
SELECT pg_temp.assert_manual_sentinels();
SELECT 'FINANCIAL_ROLLBACK_COMPLETE_happy';
