\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.financial_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE x record; data jsonb; result jsonb:='{}'; BEGIN
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('public','auth','demo_flow_writer','demo_fixture_identity')
 AND c.relkind IN('r','p') ORDER BY n.nspname,c.relname LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t',x.nspname,x.relname) INTO data;
  result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP; RETURN result;
END $fn$;
CREATE FUNCTION pg_temp.assert_manual_sentinels() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE x record; actual jsonb; BEGIN
 FOR x IN SELECT * FROM pg_temp.financial_manual_sentinels LOOP
  IF x.table_name !~ '^[a-z_]+$' THEN RAISE EXCEPTION 'Unsafe sentinel table'; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',x.table_name) INTO actual USING x.id;
  IF actual IS NULL OR x.preimage IS NULL OR actual->>'organization_id' IS DISTINCT FROM x.organization_id::text OR actual IS DISTINCT FROM x.preimage THEN RAISE EXCEPTION 'Manual sentinel changed: %',x.id; END IF;
 END LOOP;
END $fn$;
SELECT pg_temp.assert_manual_sentinels();

-- Test-only definer preserves the authentic owner + selected technical role while
-- forcing the real deferred trigger. It never returns success around a failure.
CREATE SCHEMA demo_financial_lab;
REVOKE ALL ON SCHEMA demo_financial_lab FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA demo_financial_lab TO service_role;
CREATE FUNCTION demo_financial_lab.flush_deferred() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
BEGIN
 IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$'
 OR current_setting('demo_flow.test_disposable',true) IS DISTINCT FROM 'true'
 OR current_user<>'demo_financial_fixture_owner' OR session_user<>'demo_financial_fixture_owner'
 THEN RAISE EXCEPTION 'Synthetic disposable constraint harness only'; END IF;
 PERFORM demo_flow_writer.assert_rpc_transport();
 SET CONSTRAINTS ALL IMMEDIATE;
END $fn$;
REVOKE ALL ON FUNCTION demo_financial_lab.flush_deferred() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION demo_financial_lab.flush_deferred() TO service_role;
