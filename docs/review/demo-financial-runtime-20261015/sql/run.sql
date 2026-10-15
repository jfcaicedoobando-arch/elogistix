\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() !~ '^demo_flow_disposable_[a-z0-9_]+$' OR current_setting('server_version_num')<>'170006'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 THEN RAISE EXCEPTION 'Isolated PG17.6 NOSU fixture owner required'; END IF;
END $$;
BEGIN;
\ir 01-types.sql
\ir 02-synthetic-schema.sql
\ir 03-canonical-dependencies.sql
\ir 04-validator.sql
\ir 05-human-helper.sql
DO $$ BEGIN
 IF (SELECT encode(sha256(convert_to(btrim(prosrc,E' \n\r\t'),'UTF8')),'hex') FROM pg_proc WHERE oid='demo_flow_writer.human_approval_main(uuid,boolean,text,timestamptz)'::regprocedure) IS DISTINCT FROM 'd1327ae0f1cdf0135ce5d11599921c261d17b948c524b426f6deb97553d279c0'
 THEN RAISE EXCEPTION 'Human helper body drift'; END IF;
END $$;
\ir 06-behavior.sql
ROLLBACK;
DO $$ BEGIN
 IF to_regnamespace('financial_fixture') IS NOT NULL OR to_regclass('public.proveedor_facturas') IS NOT NULL THEN RAISE EXCEPTION 'Outer rollback failed'; END IF;
END $$;
SELECT 'SYNTHETIC_HUMAN_ROLLBACK_COMPLETE';
