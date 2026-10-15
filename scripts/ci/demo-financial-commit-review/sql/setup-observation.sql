\set ON_ERROR_STOP on
-- SYNTHETIC observer metadata only. Concatenate after pinned fixture + preparation
-- in their original psql session. This schema never issues business authority.
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper
  AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER')
 OR (SELECT proowner FROM pg_proc WHERE oid='public.seed_demo_organization_core()'::regprocedure)
  IS DISTINCT FROM current_user::regrole::oid
 OR to_regnamespace('demo_financial_commit_lab') IS NOT NULL
 OR (SELECT count(*) FROM pg_temp.financial_context)<>1
 OR EXISTS(SELECT 1 FROM pg_temp.financial_context WHERE context_id IS NULL)
 OR (SELECT count(*) FROM pg_temp.financial_manual_sentinels)<>2
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM public.proveedor_facturas)
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_FRESH_SYNTHETIC_SETUP_REQUIRED'; END IF;
END $guard$;
CREATE SCHEMA demo_financial_commit_lab;
REVOKE ALL ON SCHEMA demo_financial_commit_lab FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE demo_financial_commit_lab.expected_contract (
 singleton boolean PRIMARY KEY CHECK(singleton),
 scope text NOT NULL CHECK(scope='SYNTHETIC_COMMIT_OBSERVER_METADATA_ONLY'),
 context_id uuid NOT NULL UNIQUE,
 baseline_snapshot jsonb NOT NULL CHECK(jsonb_typeof(baseline_snapshot)='object'),
 foreign_snapshot jsonb NOT NULL CHECK(jsonb_typeof(foreign_snapshot)='object'),
 global_snapshot jsonb NOT NULL CHECK(jsonb_typeof(global_snapshot)='object'),
 manual_sentinels jsonb NOT NULL CHECK(jsonb_typeof(manual_sentinels)='array'),
 first_result jsonb CHECK(first_result IS NULL OR jsonb_typeof(first_result)='object'),
 committed_snapshot jsonb CHECK(committed_snapshot IS NULL OR jsonb_typeof(committed_snapshot)='object'),
 retry_result jsonb CHECK(retry_result IS NULL OR jsonb_typeof(retry_result)='object'),
 setup_backend_pid integer NOT NULL,
 business_backend_pid integer,
 retry_backend_pid integer
);
REVOKE ALL ON TABLE demo_financial_commit_lab.expected_contract FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION demo_financial_commit_lab.assert_owner() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper
  AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER')
 OR (SELECT nspowner FROM pg_namespace WHERE nspname='demo_financial_commit_lab')
  IS DISTINCT FROM current_user::regrole::oid
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_SYNTHETIC_OBSERVER_OWNER_REQUIRED'; END IF;
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE x record; data jsonb; result jsonb:='{}';
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 -- Explicitly excludes demo_financial_commit_lab metadata and all pg_temp tables.
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('public','auth','demo_flow_writer','demo_fixture_identity','financial_compile_fixture')
 AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t',x.nspname,x.relname) INTO data;
  result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP;
 RETURN result;
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.foreign_snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE x record; data jsonb; result jsonb:='{}';
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 -- Every organization-scoped table, including empty arrays, protects tenant 2.
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN('r','p')
 AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id'
  AND a.attnum>0 AND NOT a.attisdropped) ORDER BY c.relname LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t WHERE organization_id=$1',x.nspname,x.relname)
   INTO data USING '00000000-0000-4000-8000-000000000002'::uuid;
  result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP;
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) INTO data
 FROM public.organizations t WHERE id='00000000-0000-4000-8000-000000000002';
 RETURN result||jsonb_build_object('public.organizations',data);
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.global_snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE x record; data jsonb; result jsonb:='{}';
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 -- Protect complete unscoped catalogs, all organizations, and synthetic auth rows.
 -- demo_seed_state is the one intentional global business marker.
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN('r','p') AND (
  n.nspname IN('auth','financial_compile_fixture') OR
  (n.nspname='public' AND c.relname<>'demo_seed_state'
   AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attname='organization_id'
    AND a.attnum>0 AND NOT a.attisdropped))) ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t',x.nspname,x.relname) INTO data;
  result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP;
 RETURN result;
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.assert_manual_sentinels() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE sentinels jsonb; x record; actual jsonb;
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 SELECT e.manual_sentinels INTO STRICT sentinels FROM demo_financial_commit_lab.expected_contract e WHERE singleton;
 IF jsonb_array_length(sentinels)<>2
 OR (SELECT count(DISTINCT v->>'organization_id') FROM jsonb_array_elements(sentinels) v)<>2
 OR EXISTS(SELECT 1 FROM jsonb_to_recordset(sentinels) s(schema_name text,table_name text,row_id uuid)
  GROUP BY s.schema_name,s.table_name,s.row_id HAVING count(*)<>1)
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_TWO_TENANT_SENTINELS_REQUIRED'; END IF;
 FOR x IN SELECT * FROM jsonb_to_recordset(sentinels)
  s(schema_name text,table_name text,row_id uuid,organization_id uuid,snapshot jsonb) LOOP
  IF x.schema_name IS DISTINCT FROM 'public' OR x.table_name IS NULL OR x.table_name !~ '^[a-z_]+$'
  OR x.row_id IS NULL OR x.organization_id IS NULL OR jsonb_typeof(x.snapshot) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_INVALID_SYNTHETIC_SENTINEL'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM %I.%I t WHERE id=$1',x.schema_name,x.table_name) INTO actual USING x.row_id;
  IF actual IS NULL OR actual->>'organization_id' IS DISTINCT FROM x.organization_id::text
  OR actual IS DISTINCT FROM x.snapshot THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_MANUAL_SENTINEL_CHANGED'; END IF;
 END LOOP;
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.assert_invariants() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF e.scope IS DISTINCT FROM 'SYNTHETIC_COMMIT_OBSERVER_METADATA_ONLY'
 OR demo_financial_commit_lab.foreign_snapshot() IS DISTINCT FROM e.foreign_snapshot
 OR demo_financial_commit_lab.global_snapshot() IS DISTINCT FROM e.global_snapshot
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_FOREIGN_OR_GLOBAL_ROWS_CHANGED'; END IF;
 PERFORM demo_financial_commit_lab.assert_manual_sentinels();
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.assert_observation(reconciliation jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE e demo_financial_commit_lab.expected_contract; v_run uuid; v_lineage uuid; v_checkpoint uuid;
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
 OR pg_backend_pid()=e.setup_backend_pid OR e.business_backend_pid IS NULL
 OR pg_backend_pid()=e.business_backend_pid OR pg_backend_pid()=e.retry_backend_pid
 OR to_regclass('pg_temp.financial_context') IS NOT NULL
 OR e.first_result IS NULL OR e.committed_snapshot IS NULL
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_INDEPENDENT_READONLY_OBSERVER_REQUIRED'; END IF;
 IF reconciliation->>'classification' IS DISTINCT FROM 'complete'
 OR (reconciliation->>'context_id')::uuid IS DISTINCT FROM e.context_id
 OR reconciliation->'checkpoint' IS DISTINCT FROM e.first_result
 OR e.first_result->>'status' IS DISTINCT FROM 'materialized'
 OR e.first_result->>'materialization' IS DISTINCT FROM 'executed'
 OR (e.first_result->>'context_id')::uuid IS DISTINCT FROM e.context_id
 OR (e.retry_result IS NOT NULL AND e.retry_result IS DISTINCT FROM e.first_result)
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_RESULT_RECONCILIATION_CONFLICT'; END IF;
 v_run:=(e.first_result->>'run_id')::uuid; v_lineage:=(e.first_result->>'lineage_id')::uuid;
 v_checkpoint:=(e.first_result->>'checkpoint_id')::uuid;
 IF v_run IS NULL OR v_lineage IS NULL OR v_checkpoint IS NULL THEN
  RAISE EXCEPTION 'FINANCIAL_COMMIT_MATERIALIZATION_IDS_REQUIRED'; END IF;
 PERFORM demo_flow_writer.verify_identity_readonly(v_lineage);
 PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'aap-vencida',4);
 PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'ttn-vigente',4);
 PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'ofc-parcial',5);
 IF (SELECT count(*) FROM demo_flow_writer.events WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.receipts WHERE lineage_id=v_lineage)<>13
 OR (SELECT count(*) FROM demo_flow_writer.fixture_claims WHERE lineage_id=v_lineage)<>3
 OR (SELECT count(*) FROM demo_flow_writer.current_approvals WHERE lineage_id=v_lineage)<>3
 OR (SELECT count(*) FROM demo_flow_writer.simulated_payments WHERE lineage_id=v_lineage)<>1
 OR (SELECT count(*) FROM demo_flow_writer.runs)<>1
 OR (SELECT count(*) FROM demo_flow_writer.lineages)<>1
 OR (SELECT count(*) FROM demo_flow_writer.authorization_receipts WHERE run_id=v_run AND context_id=e.context_id)<>1
 OR (SELECT count(*) FROM demo_flow_writer.seed_checkpoints WHERE execution_run_id=v_run AND id=v_checkpoint)<>1
 OR (SELECT count(*) FROM demo_flow_writer.execution_receipts WHERE execution_run_id=v_run AND checkpoint_id=v_checkpoint)<>1
 OR (SELECT count(*) FROM public.proveedor_facturas)<>3
 OR (SELECT count(*) FROM public.proveedor_facturas_conceptos)<>5
 OR (SELECT count(*) FROM public.pagos_proveedor)<>1
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_OBSERVED_CARDINALITY_CONFLICT'; END IF;
 IF demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.committed_snapshot
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_COMMITTED_SNAPSHOT_CHANGED'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $fn$;

CREATE FUNCTION demo_financial_commit_lab.assert_failed_observation(reconciliation jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $fn$
DECLARE e demo_financial_commit_lab.expected_contract;
BEGIN
 PERFORM demo_financial_commit_lab.assert_owner();
 SELECT * INTO STRICT e FROM demo_financial_commit_lab.expected_contract WHERE singleton;
 IF current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
 OR pg_backend_pid()=e.setup_backend_pid OR e.business_backend_pid IS NULL OR pg_backend_pid()=e.business_backend_pid
 OR to_regclass('pg_temp.financial_context') IS NOT NULL
 OR e.first_result IS NOT NULL OR e.committed_snapshot IS NOT NULL OR e.retry_result IS NOT NULL
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_INDEPENDENT_FAILED_OBSERVER_REQUIRED'; END IF;
 -- Canonical absence remains unresolved. Equality proves rollback of this controlled
 -- failed transaction only; it never proves absence of a future/external execution.
 IF reconciliation->>'classification' IS DISTINCT FROM 'unresolved'
 OR (reconciliation->>'context_id')::uuid IS DISTINCT FROM e.context_id OR reconciliation ? 'checkpoint'
 OR demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.baseline_snapshot
 OR EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.runs) OR EXISTS(SELECT 1 FROM demo_flow_writer.lineages)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.identity_receipts) OR EXISTS(SELECT 1 FROM demo_flow_writer.bindings)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.events) OR EXISTS(SELECT 1 FROM demo_flow_writer.receipts)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.fixture_claims) OR EXISTS(SELECT 1 FROM demo_flow_writer.current_approvals)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.simulated_payments)
 OR EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints) OR EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts)
 OR EXISTS(SELECT 1 FROM public.proveedor_facturas) OR EXISTS(SELECT 1 FROM public.proveedor_facturas_conceptos)
 OR EXISTS(SELECT 1 FROM public.pagos_proveedor) OR EXISTS(SELECT 1 FROM public.demo_seed_state)
 THEN RAISE EXCEPTION 'FINANCIAL_COMMIT_FAILED_TRANSACTION_ROLLBACK_CONFLICT'; END IF;
 PERFORM demo_financial_commit_lab.assert_invariants();
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_financial_commit_lab FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO demo_financial_commit_lab.expected_contract
 (singleton,scope,context_id,baseline_snapshot,foreign_snapshot,global_snapshot,manual_sentinels,setup_backend_pid)
 SELECT true,'SYNTHETIC_COMMIT_OBSERVER_METADATA_ONLY',c.context_id,
  demo_financial_commit_lab.snapshot(),demo_financial_commit_lab.foreign_snapshot(),demo_financial_commit_lab.global_snapshot(),
  (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.schema_name,s.table_name,s.row_id) FROM pg_temp.financial_manual_sentinels s),pg_backend_pid()
 FROM pg_temp.financial_context c;
SELECT demo_financial_commit_lab.assert_invariants();
COMMIT;
SELECT 'FINANCIAL_CONNECTION_EVIDENCE='||jsonb_build_object('phase','setup','backend_pid',pg_backend_pid())::text;
SELECT 'FINANCIAL_COMMIT_OBSERVATION_SETUP_COMPLETE';
