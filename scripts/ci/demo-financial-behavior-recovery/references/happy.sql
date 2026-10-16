\set ON_ERROR_STOP on
CREATE TEMP TABLE before_happy AS SELECT pg_temp.financial_snapshot() body;
BEGIN;
SELECT context_id FROM financial_context \gset
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS outcome \gset
RESET ROLE;
CREATE TEMP TABLE financial_result AS SELECT :'outcome'::jsonb result;
DO $$ DECLARE r jsonb; l uuid; cp uuid; run uuid; BEGIN
 SELECT result INTO STRICT r FROM financial_result;
 run:=(r->>'run_id')::uuid; l:=(r->>'lineage_id')::uuid; cp:=(r->>'checkpoint_id')::uuid;
 IF r->>'status' IS DISTINCT FROM 'materialized' OR r->>'materialization' IS DISTINCT FROM 'executed'
 THEN RAISE EXCEPTION 'Not newly materialized'; END IF;
 PERFORM demo_flow_writer.verify_materialized(run);
 IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=l)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=l)<>13
 OR (SELECT count(*) FROM demo_flow_writer.current_approvals WHERE lineage_id=l)<>3
 OR (SELECT count(*) FROM demo_flow_writer.simulated_payments WHERE lineage_id=l)<>1
 OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=run)<>1
 OR (SELECT count(*) FROM demo_flow_writer.execution_receipts WHERE execution_run_id=run)<>1
 OR NOT EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts WHERE run_id=run
  AND context_id=(SELECT context_id FROM financial_context))
 THEN RAISE EXCEPTION 'Authentic materialization cardinality mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints c JOIN public.demo_seed_state s
  ON s.id AND s.last_seeded_at=c.checked_at JOIN demo_flow_writer.execution_receipts x
  ON x.checkpoint_id=c.id AND x.projection_sha256=c.projection_sha256 WHERE c.id=cp
  AND x.execution_run_id=run AND c.projection_sha256=demo_flow_writer.projection_sha256(l))
 THEN RAISE EXCEPTION 'Projection/checkpoint/marker/receipt mismatch'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $$;
CREATE TEMP TABLE before_replay AS SELECT pg_temp.financial_snapshot() body;
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS replay \gset
RESET ROLE;
SELECT :'replay'::jsonb IS NOT DISTINCT FROM :'outcome'::jsonb AS same_result \gset
DO $$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM before_replay)
 THEN RAISE EXCEPTION 'Replay mutated persistent rows'; END IF;
END $$;
\if :same_result
\else
\quit 1
\endif
-- Deferred issuance is a required behavioral gate; unexpected transport/role errors
-- here FAIL. No trigger is disabled and no unrelated error counts as success.
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
