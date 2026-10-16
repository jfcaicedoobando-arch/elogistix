\set ON_ERROR_STOP on
-- SYNTHETIC fresh psql and fresh real TX. Same context/run/checkpoint; no new issue.
SELECT demo_financial_commit_lab.assert_owner();
DO $fresh_connection$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF e.first_result IS NULL OR e.committed_snapshot IS NULL OR e.retry_result IS NOT NULL
 OR e.business_backend_pid IS NULL OR e.retry_backend_pid IS NOT NULL
 OR pg_backend_pid()=e.setup_backend_pid OR pg_backend_pid()=e.business_backend_pid
 OR to_regclass('pg_temp.financial_context') IS NOT NULL
 OR demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.committed_snapshot
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_FRESH_RETRY_CONNECTION_REQUIRED'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $fresh_connection$;
UPDATE demo_financial_commit_lab.expected_contract SET retry_backend_pid=pg_backend_pid()
 WHERE singleton RETURNING context_id \gset
SELECT 'FINANCIAL_CONNECTION_EVIDENCE='||jsonb_build_object('phase','retry','backend_pid',pg_backend_pid())::text;
BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS retry_result \gset
\echo FINANCIAL_COMMIT_PHASE_retry_commit
COMMIT;
\echo FINANCIAL_RETRY_COMMIT_RETURNED
SELECT demo_financial_commit_lab.assert_owner();
UPDATE demo_financial_commit_lab.expected_contract SET retry_result=:'retry_result'::jsonb
 WHERE singleton AND retry_backend_pid=pg_backend_pid() AND retry_result IS NULL;
DO $same_result$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF e.retry_result IS NULL OR e.retry_result IS DISTINCT FROM e.first_result
 OR demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.committed_snapshot
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_RETRY_RESULT_OR_ROWS_CHANGED'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $same_result$;
SELECT 'FINANCIAL_RETRY_RESULT_RECORDED';
