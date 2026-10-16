\set ON_ERROR_STOP on
-- SYNTHETIC laboratory regression for the isolated same-context retry proposal.
-- Uses the authentic producer-issued TEMP context and real DEFINER boundary.
-- Assertions then ROLLBACK; no committed business, external identity or ACL proof.
CREATE TEMP TABLE before_retry_security AS SELECT pg_temp.financial_snapshot() body;
BEGIN;
SELECT context_id FROM pg_temp.financial_context \gset
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS first_result \gset
SELECT demo_financial_lab.flush_deferred();
RESET ROLE;
CREATE TEMP TABLE retry_security_result AS SELECT :'first_result'::jsonb result;
DO $materialized$
DECLARE result jsonb; v_run uuid; v_lineage uuid; v_checkpoint uuid;
BEGIN
 SELECT r.result INTO STRICT result FROM pg_temp.retry_security_result r;
 v_run:=(result->>'run_id')::uuid; v_lineage:=(result->>'lineage_id')::uuid;
 v_checkpoint:=(result->>'checkpoint_id')::uuid;
 IF result->>'status' IS DISTINCT FROM 'materialized' OR result->>'materialization' IS DISTINCT FROM 'executed'
 OR v_run IS NULL OR v_lineage IS NULL OR v_checkpoint IS NULL
 OR (result->>'context_id')::uuid IS DISTINCT FROM (SELECT context_id FROM pg_temp.financial_context)
 THEN RAISE EXCEPTION 'Retry security requires genuine initial materialization'; END IF;
 PERFORM demo_flow_writer.verify_materialized(v_run);
 IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage)<>3
 OR (SELECT count(*) FROM demo_flow_writer.current_approvals WHERE lineage_id=v_lineage)<>3
 OR (SELECT count(*) FROM demo_flow_writer.simulated_payments WHERE lineage_id=v_lineage)<>1
 OR (SELECT count(*) FROM demo_flow_writer.runs WHERE lineage_id=v_lineage)<>1
 OR (SELECT count(*) FROM demo_flow_writer.authorization_receipts WHERE run_id=v_run
  AND context_id=(SELECT context_id FROM pg_temp.financial_context))<>1
 OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=v_run)<>1
 OR (SELECT count(*) FROM demo_flow_writer.execution_receipts WHERE execution_run_id=v_run)<>1
 OR (SELECT count(*) FROM public.proveedor_facturas)<>3
 OR (SELECT count(*) FROM public.proveedor_facturas_conceptos)<>5
 OR (SELECT count(*) FROM public.pagos_proveedor)<>1
 THEN RAISE EXCEPTION 'Retry security initial provenance cardinality mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints c
  JOIN public.demo_seed_state s ON s.id AND s.last_seeded_at=c.checked_at
  JOIN demo_flow_writer.execution_receipts x ON x.checkpoint_id=c.id
   AND x.checked_at=c.checked_at AND x.projection_sha256=c.projection_sha256
  WHERE c.id=v_checkpoint AND c.execution_run_id=v_run AND x.execution_run_id=v_run
   AND c.projection_sha256=demo_flow_writer.projection_sha256(v_lineage))
 THEN RAISE EXCEPTION 'Retry security initial checkpoint evidence mismatch'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $materialized$;
\echo FINANCIAL_PHASE_retry_security_materialized

-- Successful same-context retry is a read of the existing result, never a new run.
CREATE TEMP TABLE retry_security_stable AS SELECT pg_temp.financial_snapshot() body;
SET LOCAL ROLE service_role;
SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text AS second_result \gset
SELECT demo_financial_lab.flush_deferred();
RESET ROLE;
CREATE TEMP TABLE retry_security_second AS SELECT :'second_result'::jsonb result;
DO $same_context$
BEGIN
 IF (SELECT result FROM pg_temp.retry_security_second) IS DISTINCT FROM
  (SELECT result FROM pg_temp.retry_security_result)
 THEN RAISE EXCEPTION 'Same context retry changed run/checkpoint/result'; END IF;
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_stable)
 THEN RAISE EXCEPTION 'Same context retry mutated persistent rows'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $same_context$;

-- The initial bridge and owner issuer must still refuse adoption after materialization.
-- Only these exact rejections count; other errors and unexpected success are fatal.
DO $initial_adoption_guards$
DECLARE v_receipt uuid; v_policy uuid; v_message text; v_state text; v_rejected boolean;
BEGIN
 SELECT a.identity_receipt_id,a.scheduler_approval_id INTO STRICT v_receipt,v_policy
 FROM demo_flow_writer.server_admissions a
 WHERE a.context_id=(SELECT context_id FROM pg_temp.financial_context);
 v_rejected:=false;
 BEGIN
  PERFORM demo_flow_writer.verify_identity_receipt(v_receipt);
 EXCEPTION WHEN SQLSTATE '23514' THEN
  GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  IF v_state<>'23514' OR v_message IS DISTINCT FROM 'DEMO_FINANCIAL_ADOPTION_DENIED' THEN RAISE; END IF;
  v_rejected:=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Initial bridge adopted materialized financial IDs'; END IF;
 v_rejected:=false;
 BEGIN
  PERFORM demo_flow_writer.issue_scheduler_context(v_policy,v_receipt,120);
 EXCEPTION WHEN SQLSTATE '23514' THEN
  GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  IF v_state<>'23514' OR v_message IS DISTINCT FROM 'DEMO_FINANCIAL_ADOPTION_DENIED' THEN RAISE; END IF;
  v_rejected:=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Owner issuer adopted a materialized receipt into a new context'; END IF;
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_stable)
 THEN RAISE EXCEPTION 'Initial adoption rejection mutated persistent rows'; END IF;
END $initial_adoption_guards$;

-- INVOKER helper retains selected service_role. The real boundary checks transport
-- in its existing owner context; this helper neither impersonates nor bypasses it.
CREATE FUNCTION demo_financial_lab.expect_retry_security_denial(ctx uuid,expected_message text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE v_message text; v_state text; v_rejected boolean:=false;
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab' OR session_user<>'postgres'
 OR current_user<>'service_role' OR current_setting('role')<>'service_role'
 OR expected_message NOT IN('DEMO_RUN_UNAUTHORIZED','DEMO_SCHEDULER_APPROVAL_INVALID')
 OR expected_message IS NULL THEN
  RAISE EXCEPTION 'Synthetic bounded retry denial probe required';
 END IF;
 BEGIN
  PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);
 EXCEPTION WHEN SQLSTATE '42501' THEN
  GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  IF v_state<>'42501' OR v_message IS DISTINCT FROM expected_message THEN RAISE; END IF;
  v_rejected:=true;
 END;
 IF NOT v_rejected THEN RAISE EXCEPTION 'Revoked or disabled authority returned cached success'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION demo_financial_lab.expect_retry_security_denial(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION demo_financial_lab.expect_retry_security_denial(uuid,text) TO service_role;

SAVEPOINT retry_revoked_run;
UPDATE demo_flow_writer.runs SET revoked_at=clock_timestamp()
 WHERE id=(SELECT (result->>'run_id')::uuid FROM pg_temp.retry_security_result);
DO $revoked_setup$
BEGIN
 IF (SELECT count(*) FROM demo_flow_writer.runs WHERE revoked_at IS NOT NULL
  AND id=(SELECT (result->>'run_id')::uuid FROM pg_temp.retry_security_result))<>1
 THEN RAISE EXCEPTION 'Revoked run probe was not configured'; END IF;
END $revoked_setup$;
CREATE TEMP TABLE retry_security_revoked AS SELECT pg_temp.financial_snapshot() body;
SET LOCAL ROLE service_role;
SELECT demo_financial_lab.expect_retry_security_denial(:'context_id'::uuid,'DEMO_RUN_UNAUTHORIZED');
RESET ROLE;
DO $revoked_unchanged$
BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_revoked)
 THEN RAISE EXCEPTION 'Revoked run denial mutated persistent rows'; END IF;
END $revoked_unchanged$;
ROLLBACK TO SAVEPOINT retry_revoked_run;
RELEASE SAVEPOINT retry_revoked_run;
DO $revoked_restored$
BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_stable)
 THEN RAISE EXCEPTION 'Revoked run probe rollback incomplete'; END IF;
END $revoked_restored$;

SAVEPOINT retry_disabled_scheduler;
UPDATE demo_flow_writer.scheduler_approvals SET disabled_at=clock_timestamp()
 WHERE id=(SELECT scheduler_approval_id FROM demo_flow_writer.server_admissions
  WHERE context_id=(SELECT context_id FROM pg_temp.financial_context));
DO $disabled_setup$
BEGIN
 IF (SELECT count(*) FROM demo_flow_writer.scheduler_approvals WHERE disabled_at IS NOT NULL
  AND id=(SELECT scheduler_approval_id FROM demo_flow_writer.server_admissions
   WHERE context_id=(SELECT context_id FROM pg_temp.financial_context)))<>1
 THEN RAISE EXCEPTION 'Disabled scheduler probe was not configured'; END IF;
END $disabled_setup$;
CREATE TEMP TABLE retry_security_disabled AS SELECT pg_temp.financial_snapshot() body;
SET LOCAL ROLE service_role;
SELECT demo_financial_lab.expect_retry_security_denial(:'context_id'::uuid,'DEMO_SCHEDULER_APPROVAL_INVALID');
RESET ROLE;
DO $disabled_unchanged$
BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_disabled)
 THEN RAISE EXCEPTION 'Disabled scheduler denial mutated persistent rows'; END IF;
END $disabled_unchanged$;
ROLLBACK TO SAVEPOINT retry_disabled_scheduler;
RELEASE SAVEPOINT retry_disabled_scheduler;
DO $disabled_restored$
BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.retry_security_stable)
 THEN RAISE EXCEPTION 'Disabled scheduler probe rollback incomplete'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $disabled_restored$;
SELECT 'FINANCIAL_ASSERTIONS_COMPLETE_retry_security';
ROLLBACK;
DO $outer_rollback$
BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM pg_temp.before_retry_security)
 THEN RAISE EXCEPTION 'Retry security outer rollback left persistent rows'; END IF;
END $outer_rollback$;
SELECT pg_temp.assert_manual_sentinels();
SELECT 'FINANCIAL_ROLLBACK_COMPLETE_retry_security';
