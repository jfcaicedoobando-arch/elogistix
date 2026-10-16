\set ON_ERROR_STOP on
-- SYNTHETIC laboratory helpers only. No external identity, ACL certification,
-- transaction commit, or durable claim is asserted by these suites.
DO $$ BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')<>'170006'
 THEN RAISE EXCEPTION 'Synthetic disposable financial laboratory only'; END IF;
 IF (SELECT count(*) FROM pg_temp.financial_context)<>1
 OR EXISTS(SELECT 1 FROM pg_temp.financial_context WHERE context_id IS NULL)
 THEN RAISE EXCEPTION 'Exactly one issued financial context required'; END IF;
END $$;

CREATE FUNCTION pg_temp.financial_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE x record; data jsonb; result jsonb:='{}'; BEGIN
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('public','auth','demo_flow_writer','demo_fixture_identity','financial_compile_fixture')
 AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t',x.nspname,x.relname) INTO data;
  result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP; RETURN result;
END $fn$;

CREATE FUNCTION pg_temp.assert_manual_sentinels() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE x record; actual jsonb; BEGIN
 IF (SELECT count(*) FROM pg_temp.financial_manual_sentinels)<2
 OR (SELECT count(DISTINCT organization_id) FROM pg_temp.financial_manual_sentinels)<>2
 THEN RAISE EXCEPTION 'Two-tenant manual sentinels required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_temp.financial_manual_sentinels
  GROUP BY schema_name,table_name,row_id HAVING count(*)<>1)
 THEN RAISE EXCEPTION 'Duplicate manual sentinel'; END IF;
 FOR x IN SELECT * FROM pg_temp.financial_manual_sentinels LOOP
  IF x.schema_name IS DISTINCT FROM 'public' OR x.table_name IS NULL
  OR x.table_name !~ '^[a-z_]+$' OR x.row_id IS NULL OR x.organization_id IS NULL
  OR x.snapshot IS NULL OR jsonb_typeof(x.snapshot)<>'object'
  THEN RAISE EXCEPTION 'Unsafe or incomplete manual sentinel'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM %I.%I t WHERE id=$1',x.schema_name,x.table_name)
   INTO actual USING x.row_id;
  IF actual IS NULL OR actual->>'id' IS DISTINCT FROM x.row_id::text
  OR actual->>'organization_id' IS DISTINCT FROM x.organization_id::text
  OR actual IS DISTINCT FROM x.snapshot
  THEN RAISE EXCEPTION 'Manual sentinel changed: %',x.row_id; END IF;
 END LOOP;
END $fn$;
SELECT pg_temp.assert_manual_sentinels();

-- Ephemeral test definer forces the REAL deferred issuance trigger under the
-- same selected technical role and owner as the canonical boundary.
CREATE SCHEMA demo_financial_lab;
REVOKE ALL ON SCHEMA demo_financial_lab FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA demo_financial_lab TO service_role;
CREATE FUNCTION demo_financial_lab.flush_deferred() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('role')<>'service_role'
 THEN RAISE EXCEPTION 'Synthetic disposable constraint harness only'; END IF;
 PERFORM demo_flow_writer.assert_rpc_transport();
 SET CONSTRAINTS ALL IMMEDIATE;
END $fn$;
REVOKE ALL ON FUNCTION demo_financial_lab.flush_deferred() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION demo_financial_lab.flush_deferred() TO service_role;
