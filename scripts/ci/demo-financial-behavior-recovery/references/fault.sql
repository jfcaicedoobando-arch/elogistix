\set ON_ERROR_STOP on
BEGIN;
SELECT context_id FROM financial_context \gset
CREATE TEMP TABLE financial_fault_input AS SELECT :'fault_target'::text target;
CREATE TEMP TABLE financial_before AS SELECT pg_temp.financial_snapshot() body;
CREATE FUNCTION pg_temp.inject_financial_fault() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN RAISE EXCEPTION 'FINANCIAL_INJECTED_%',TG_TABLE_NAME USING ERRCODE='P0T01'; END $fn$;
DO $$ DECLARE target text; BEGIN
 target:=(SELECT target FROM financial_fault_input);
 CASE target
 WHEN 'event' THEN CREATE TRIGGER financial_fault BEFORE INSERT ON demo_flow_writer.events FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_financial_fault();
 WHEN 'receipt' THEN CREATE TRIGGER financial_fault BEFORE INSERT ON demo_flow_writer.receipts FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_financial_fault();
 WHEN 'checkpoint' THEN CREATE TRIGGER financial_fault BEFORE INSERT ON demo_flow_writer.seed_checkpoints FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_financial_fault();
 WHEN 'marker' THEN CREATE TRIGGER financial_fault BEFORE INSERT OR UPDATE ON public.demo_seed_state FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_financial_fault();
 WHEN 'execution_receipt' THEN CREATE TRIGGER financial_fault BEFORE INSERT ON demo_flow_writer.execution_receipts FOR EACH ROW EXECUTE FUNCTION pg_temp.inject_financial_fault();
 ELSE RAISE EXCEPTION 'Unknown fault target';
 END CASE;
END $$;
CREATE FUNCTION demo_financial_lab.expect_financial_fault(ctx uuid, expected text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $fn$
DECLARE state text; msg text; rejected boolean:=false; BEGIN
 BEGIN PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
  IF state<>'P0T01' OR msg IS DISTINCT FROM expected THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Required injected fault not reached'; END IF;
END $fn$;
REVOKE ALL ON FUNCTION demo_financial_lab.expect_financial_fault(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION demo_financial_lab.expect_financial_fault(uuid,text) TO service_role;
SELECT 'FINANCIAL_INJECTED_'||CASE target WHEN 'event' THEN 'events' WHEN 'receipt' THEN 'receipts'
 WHEN 'checkpoint' THEN 'seed_checkpoints' WHEN 'marker' THEN 'demo_seed_state'
 ELSE 'execution_receipts' END AS expected FROM financial_fault_input \gset
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SET LOCAL ROLE service_role;
SELECT demo_financial_lab.expect_financial_fault(:'context_id'::uuid,:'expected');
RESET ROLE;
DO $$ BEGIN
 IF pg_temp.financial_snapshot() IS DISTINCT FROM (SELECT body FROM financial_before)
 THEN RAISE EXCEPTION 'Issuance/business/provenance/checkpoint rollback incomplete'; END IF;
 PERFORM pg_temp.assert_manual_sentinels();
END $$;
SELECT 'FINANCIAL_ASSERTIONS_COMPLETE_'||target FROM financial_fault_input;
ROLLBACK;
SELECT pg_temp.assert_manual_sentinels();
SELECT 'FINANCIAL_ROLLBACK_COMPLETE_'||:'fault_target';
