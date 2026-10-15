-- CURRENT TARGET: REVIEW-ONLY single RPC boundary; NO public route or GRANT.
-- The name is private deliberately. A future API exposure/ACL change requires separate
-- review and authority; this file cannot make Supabase .rpc discover the function.
BEGIN;
CREATE FUNCTION demo_flow_writer.assert_rpc_transport() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 -- A real adapter must attest the existing PostgREST channel, invoker owner, original
 -- authenticator LOGIN and server-verified technical service_role authorization.
 -- session_user=authenticator is not service_role; neither identifies the human/job.
 -- request.jwt.claims/SET LOCAL or a caller UUID alone are not authentication evidence.
 RAISE EXCEPTION 'HOLD_POSTGREST_TRANSPORT_ATTESTATION_REQUIRED' USING ERRCODE='42501';
END $$;
-- Historical owner-pool remains a reference in prior proposal history; current target
-- uses the RPC adapter. This changes only private proposed helper, no existing DB role.
CREATE OR REPLACE FUNCTION demo_flow_writer.assert_existing_transport() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM demo_flow_writer.assert_rpc_transport();
END $$;

CREATE FUNCTION demo_flow_writer.prepare_execute_checkpoint(p_context_id uuid,p_skip_ms bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prepared jsonb; result jsonb;
BEGIN
 -- Minimal DEFINER boundary. No caller-controlled principal, actor, run, lineage,
 -- tenant, receipt, manifest or expiry. Existing owner must be verified before install.
 PERFORM demo_flow_writer.assert_rpc_transport();
 IF p_context_id IS NULL OR p_skip_ms IS NULL OR p_skip_ms<0 THEN
  RAISE EXCEPTION 'DEMO_INVALID_RPC_ARGUMENT' USING ERRCODE='22023'; END IF;
 prepared:=demo_flow_writer.prepare_authorized_run(p_context_id);
 result:=demo_flow_writer.execute_and_checkpoint((prepared->>'run_id')::uuid,p_skip_ms);
 -- Authorization receipt maps unique context_id -> run_id in this same transaction.
 -- If anything fails, issuance, business rows, checkpoint and mapping all roll back.
 RETURN result||jsonb_build_object('context_id',p_context_id);
END $$;

CREATE FUNCTION demo_flow_writer.reconcile_context(p_context_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c jsonb; a demo_flow_writer.authorization_receipts; result jsonb;
BEGIN
 PERFORM demo_flow_writer.assert_rpc_transport();
 -- Context lookup must be historical read-only authentication: may permit review of
 -- expired issuance, never mint/renew a context or conflate actor with service_role.
 PERFORM demo_flow_writer.assert_context_read_access(p_context_id);
 IF current_setting('transaction_read_only')<>'on' OR current_setting('transaction_isolation')<>'repeatable read'
  THEN RAISE EXCEPTION 'HOLD_RPC_READONLY_SNAPSHOT_CONFIGURATION_REQUIRED'; END IF;
 SELECT * INTO a FROM demo_flow_writer.authorization_receipts WHERE context_id=p_context_id;
 IF NOT FOUND THEN
  -- RPC may have rolled back including issuance, may be running, or may start later.
  -- Never claim definite absence from empty SELECT, TTL or elapsed timeout.
  RETURN jsonb_build_object('classification','unresolved','context_id',p_context_id);
 END IF;
 result:=demo_flow_writer.reconcile_run(a.run_id);
 IF result->>'classification'='absent' THEN
  result:=result||jsonb_build_object('classification','unresolved');
 END IF;
 IF result ? 'checkpoint' THEN
  result:=jsonb_set(result,'{checkpoint}',result->'checkpoint'||jsonb_build_object('context_id',p_context_id));
 END IF;
 RETURN result||jsonb_build_object('context_id',p_context_id);
END $$;
CREATE FUNCTION demo_flow_writer.assert_context_read_access(p_context_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 -- Independent read authorization including absent attempts; derived from verified
 -- existing server admission, not possession of a UUID or still-live write expiry.
 RAISE EXCEPTION 'HOLD_CONTEXT_HISTORY_AUTHENTICATION_REQUIRED' USING ERRCODE='42501';
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA demo_flow_writer FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
