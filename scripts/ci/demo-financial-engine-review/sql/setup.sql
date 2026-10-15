\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$'
 OR current_setting('demo_flow.test_disposable',true) IS DISTINCT FROM 'true'
 OR current_setting('server_version_num')<>'170006'
 OR current_user<>'demo_financial_fixture_owner'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper
   AND rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN('r','p'))
 THEN RAISE EXCEPTION 'Fresh PG17.6 synthetic NOSUPERUSER BYPASSRLS owner required'; END IF;
END $$;
-- This models owner authority only inside a disposable container. It proves
-- neither application RLS nor real identity. The production installer stays exact.
\ir catalog.sql
\ir ../upstream/authentic/core-owner-fixture.sql
\ir ../upstream/flow/sql/01-private.sql
\ir ../upstream/flow/sql/02-manifest.sql
\ir ../upstream/flow/sql/04-engine.sql
\ir ../upstream/authentic/identity.sql
\ir ../upstream/flow/issuer/10-issuer.sql
\ir ../upstream/flow/issuer/11-atomic-entry.sql
\ir ../upstream/flow/issuer/12-approval-main.sql
\ir ../upstream/flow/issuer/13-readonly-verifiers.sql
\ir ../upstream/flow/issuer/14-reconcile.sql
\ir ../upstream/flow/issuer/15-rpc-boundary.sql
\ir ../upstream/flow/issuer/16-owner-registry.sql
\ir ../upstream/authentic/bridge.sql
\ir ../upstream/authentic/producer.sql
\ir ../upstream/flow/sql/06-simulation-guards.sql
\ir canonical-fixture.sql
-- Only this laboratory's ephemeral role receives this private boundary.
GRANT USAGE ON SCHEMA demo_flow_writer TO service_role;
GRANT EXECUTE ON FUNCTION demo_flow_writer.prepare_execute_checkpoint(uuid,bigint) TO service_role;
\ir producer-and-context.sql
