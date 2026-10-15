\set ON_ERROR_STOP on
-- NOT REGISTERED. Requires integrated genuine issued run fixture, not direct run INSERT.
-- Must be invoked as isolated candidate owner NOSUPERUSER, never real DB.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$'
 OR current_setting('demo_flow.test_disposable',true) IS DISTINCT FROM 'true'
 OR current_setting('server_version_num')<>'170006'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'Isolated PG17.6 NOSU required'; END IF;
END $$;
CREATE TEMP TABLE financial_input AS SELECT :'run_id'::uuid AS run_id;
SELECT demo_flow_writer.assert_issued(run_id) FROM financial_input;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts WHERE execution_run_id=(SELECT run_id FROM financial_input))
 THEN RAISE EXCEPTION 'Fresh authorized run required'; END IF;
END $$;
CREATE TEMP TABLE financial_result AS SELECT demo_flow_writer.execute_and_checkpoint(run_id,0) AS result FROM financial_input;
DO $$ DECLARE r jsonb; l uuid; cp uuid; run uuid; again jsonb; before_rows jsonb; after_rows jsonb; BEGIN
 SELECT result INTO r FROM financial_result;
 SELECT run_id INTO run FROM financial_input;
 l:=(r->>'lineage_id')::uuid;cp:=(r->>'checkpoint_id')::uuid;
 IF r->>'status' IS DISTINCT FROM 'materialized' OR r->>'materialization' IS DISTINCT FROM 'executed' THEN RAISE EXCEPTION 'Not newly materialized'; END IF;
 PERFORM demo_flow_writer.verify_materialized(run);
 IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=l)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=l)<>13
 OR (SELECT count(*) FROM demo_flow_writer.current_approvals WHERE lineage_id=l)<>3
 OR (SELECT count(*) FROM demo_flow_writer.simulated_payments WHERE lineage_id=l)<>1
 OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=run)<>1
 OR (SELECT count(*) FROM demo_flow_writer.execution_receipts WHERE execution_run_id=run)<>1
 THEN RAISE EXCEPTION 'Materialization cardinality mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints c JOIN public.demo_seed_state s ON s.id AND s.last_seeded_at=c.checked_at JOIN demo_flow_writer.execution_receipts x ON x.checkpoint_id=c.id AND x.projection_sha256=c.projection_sha256 WHERE c.id=cp AND x.execution_run_id=run AND c.projection_sha256=demo_flow_writer.projection_sha256(l)) THEN RAISE EXCEPTION 'Checkpoint/marker/receipt disagreement'; END IF;
 SELECT jsonb_agg(demo_flow_writer.snapshot(invoice_id) ORDER BY fixture_id) INTO before_rows FROM demo_flow_writer.bindings WHERE lineage_id=l;
 again:=demo_flow_writer.execute_and_checkpoint(run,0);
 SELECT jsonb_agg(demo_flow_writer.snapshot(invoice_id) ORDER BY fixture_id) INTO after_rows FROM demo_flow_writer.bindings WHERE lineage_id=l;
 IF again IS DISTINCT FROM r OR before_rows IS DISTINCT FROM after_rows OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=run)<>1 THEN RAISE EXCEPTION 'Replay mutated data or receipt'; END IF;
END $$;
-- Exercise deferred issuance validation before reporting success.
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
SELECT 'PREPARED_FINANCIAL_HAPPY_ASSERTIONS_COMPLETE';
