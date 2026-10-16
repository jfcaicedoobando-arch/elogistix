\set ON_ERROR_STOP on
-- SYNTHETIC controlled failed-TX rollback observation. No successful COMMIT proof,
-- no definite absence inference about future attempts or external executions.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT demo_financial_commit_lab.assert_owner();
SELECT context_id FROM demo_financial_commit_lab.expected_contract WHERE singleton \gset
SELECT 'FINANCIAL_CONNECTION_EVIDENCE='||jsonb_build_object('phase','observe_failed','backend_pid',pg_backend_pid())::text;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.reconcile_context(:'context_id'::uuid)::text AS reconciliation \gset
RESET ROLE;
SELECT demo_financial_commit_lab.assert_failed_observation(:'reconciliation'::jsonb);
SELECT 'FINANCIAL_FAILED_COMMIT_OBSERVATION='||jsonb_build_object(
 'scope','SYNTHETIC_CONTROLLED_TRANSACTION_ROLLBACK_ONLY','backend_pid',pg_backend_pid(),
 'canonical_classification','unresolved',
 'snapshot_sha256',encode(sha256(convert_to(demo_financial_commit_lab.snapshot()::text,'UTF8')),'hex'))::text;
COMMIT;
SELECT 'FINANCIAL_FAILED_COMMIT_ROLLBACK_OBSERVED';
