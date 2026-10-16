\set ON_ERROR_STOP on
-- SYNTHETIC real COMMIT probe. Metadata is owner-only and outside business TX.
SELECT demo_financial_commit_lab.assert_owner();
DO $fresh_connection$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF e.first_result IS NOT NULL OR e.business_backend_pid IS NOT NULL OR pg_backend_pid()=e.setup_backend_pid
 OR to_regclass('pg_temp.financial_context') IS NOT NULL
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_FRESH_BUSINESS_CONNECTION_REQUIRED'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $fresh_connection$;
UPDATE demo_financial_commit_lab.expected_contract SET business_backend_pid=pg_backend_pid()
 WHERE singleton RETURNING context_id \gset
SELECT 'FINANCIAL_CONNECTION_EVIDENCE='||jsonb_build_object('phase','business','backend_pid',pg_backend_pid())::text;
BEGIN;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS business_result \gset
-- SYNTHETIC negative: privileged lab owner legally revokes the just-issued run.
-- Restore the actual technical role before COMMIT. No deferred queue is drained.
SET LOCAL ROLE postgres;
UPDATE demo_flow_writer.runs SET revoked_at=clock_timestamp()
 WHERE id=(SELECT run_id FROM demo_flow_writer.server_admissions WHERE context_id=:'context_id'::uuid)
 RETURNING id AS revoked_run_id \gset
SELECT 'FINANCIAL_COMMIT_REVOCATION_CONFIRMED='||jsonb_build_object(
 'revoked',r.revoked_at IS NOT NULL,'context_bound',a.context_id=:'context_id'::uuid)::text
 FROM demo_flow_writer.runs r JOIN demo_flow_writer.server_admissions a ON a.run_id=r.id
 WHERE r.id=:'revoked_run_id'::uuid;
SET LOCAL ROLE service_role;
\echo FINANCIAL_COMMIT_PHASE_business_commit
COMMIT;
\echo FINANCIAL_BUSINESS_COMMIT_RETURNED
-- Successful COMMIT automatically resets LOCAL ROLE. Never reset/drain before it.
SELECT demo_financial_commit_lab.assert_owner();
UPDATE demo_financial_commit_lab.expected_contract
 SET first_result=:'business_result'::jsonb,committed_snapshot=demo_financial_commit_lab.snapshot()
 WHERE singleton AND business_backend_pid=pg_backend_pid() AND first_result IS NULL;
DO $recorded$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF e.first_result IS NULL OR e.committed_snapshot IS NULL
 OR e.first_result->>'status' IS DISTINCT FROM 'materialized'
 OR e.first_result->>'materialization' IS DISTINCT FROM 'executed'
 OR (e.first_result->>'context_id')::uuid IS DISTINCT FROM e.context_id
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_RESULT_NOT_RECORDED'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $recorded$;
SELECT 'FINANCIAL_BUSINESS_RESULT_RECORDED';
