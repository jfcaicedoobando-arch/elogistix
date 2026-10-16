\set ON_ERROR_STOP on
-- SYNTHETIC independent psql observer. No original TEMP input or business writes.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT demo_financial_commit_lab.assert_owner();
SELECT context_id FROM demo_financial_commit_lab.expected_contract WHERE singleton \gset
SELECT 'FINANCIAL_CONNECTION_EVIDENCE='||jsonb_build_object('phase','observe','backend_pid',pg_backend_pid())::text;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.reconcile_context(:'context_id'::uuid)::text AS reconciliation \gset
RESET ROLE;
SELECT demo_financial_commit_lab.assert_observation(:'reconciliation'::jsonb);
SELECT 'FINANCIAL_COMMIT_OBSERVATION='||jsonb_build_object(
 'scope','SYNTHETIC_COMMITTED_ROWS_ONLY','backend_pid',pg_backend_pid(),
 'events',13,'receipts',13,'current_approvals',3,'simulated_payments',1,
 'snapshot_sha256',encode(sha256(convert_to(demo_financial_commit_lab.snapshot()::text,'UTF8')),'hex'),
 'foreign_snapshot_sha256',encode(sha256(convert_to(demo_financial_commit_lab.foreign_snapshot()::text,'UTF8')),'hex'),
 'global_snapshot_sha256',encode(sha256(convert_to(demo_financial_commit_lab.global_snapshot()::text,'UTF8')),'hex'),
 'retry_checked',e.retry_result IS NOT NULL)::text
 FROM demo_financial_commit_lab.expected_contract e WHERE singleton;
COMMIT;
SELECT 'FINANCIAL_COMMIT_OBSERVED';
