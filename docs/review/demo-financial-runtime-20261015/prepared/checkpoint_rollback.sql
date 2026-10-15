\set ON_ERROR_STOP on
-- PREPARED, NOT REGISTERED: requires fully integrated, genuinely authorized run fixture.
-- No fake adapter, auth claims, role grants or run insertion provided here.
-- Invocation variables: run_id, fault_target in checkpoint|marker|execution_receipt|event|receipt.
BEGIN;
DO $$ BEGIN
 IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$'
 OR current_setting('demo_flow.test_disposable',true) IS DISTINCT FROM 'true'
 OR current_setting('server_version_num')<>'170006'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'Disposable integration database required'; END IF;
END $$;
CREATE TEMP TABLE test_input AS SELECT :'run_id'::uuid AS run_id, :'fault_target'::text AS fault_target;
-- If adapter is still HOLD this fails BEFORE adding fault trigger: NOT_IMPLEMENTED,
-- never misreported as a successful rollback test.
SELECT demo_flow_writer.assert_issued(run_id) FROM test_input;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts WHERE execution_run_id=(SELECT run_id FROM test_input))
 THEN RAISE EXCEPTION 'Fresh authorized unexecuted run required'; END IF;
END $$;
CREATE FUNCTION pg_temp.business_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE x record; data jsonb; result jsonb:='{}';
BEGIN
 -- All rows in BOTH schemas, including sentinels, rather than only chosen UUIDs.
 FOR x IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN ('public','demo_flow_writer','demo_fixture_identity') AND c.relkind IN ('r','p')
 ORDER BY n.nspname,c.relname LOOP
 EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM %I.%I t',x.nspname,x.relname) INTO data;
 result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data);
 END LOOP;
 RETURN result;
END $$;
CREATE TEMP TABLE preimage AS SELECT pg_temp.business_snapshot() AS body;
CREATE FUNCTION pg_temp.inject_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ACCEPTANCE_FAULT_%',TG_TABLE_NAME USING ERRCODE='P0T01'; END $$;
DO $$ DECLARE target text; BEGIN
 target:=(SELECT fault_target FROM test_input);
 CASE target
 WHEN 'event' THEN CREATE TRIGGER acceptance_fault BEFORE INSERT ON demo_flow_writer.events FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_failure();
 WHEN 'receipt' THEN CREATE TRIGGER acceptance_fault BEFORE INSERT ON demo_flow_writer.receipts FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_failure();
 WHEN 'checkpoint' THEN CREATE TRIGGER acceptance_fault BEFORE INSERT ON demo_flow_writer.seed_checkpoints FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_failure();
 WHEN 'marker' THEN CREATE TRIGGER acceptance_fault BEFORE INSERT OR UPDATE ON public.demo_seed_state FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_failure();
 WHEN 'execution_receipt' THEN CREATE TRIGGER acceptance_fault BEFORE INSERT ON demo_flow_writer.execution_receipts FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_failure();
 ELSE RAISE EXCEPTION 'Unknown fault target';
 END CASE;
END $$;
DO $$ DECLARE s text;msg text;expected text;rejected boolean:=false; BEGIN
 expected:='ACCEPTANCE_FAULT_'||CASE (SELECT fault_target FROM test_input)
 WHEN 'event' THEN 'events' WHEN 'receipt' THEN 'receipts' WHEN 'checkpoint' THEN 'seed_checkpoints' WHEN 'marker' THEN 'demo_seed_state' ELSE 'execution_receipts' END;
 BEGIN
 PERFORM demo_flow_writer.execute_and_checkpoint((SELECT run_id FROM test_input),0);
 EXCEPTION WHEN OTHERS THEN
 GET STACKED DIAGNOSTICS s=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
 IF s<>'P0T01' OR msg<>expected THEN RAISE; END IF;
 rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Fault was not reached'; END IF;
 IF pg_temp.business_snapshot() IS DISTINCT FROM (SELECT body FROM preimage)
 THEN RAISE EXCEPTION 'Partial persistent state after transactional failure'; END IF;
END $$;
-- Trigger, fixture writes and temp objects disappear; test never commits finances.
ROLLBACK;
