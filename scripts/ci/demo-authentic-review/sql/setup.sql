\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() !~ '^elogistix_identity_test_[a-z0-9_]+$'
 OR current_setting('server_version_num')<>'170006'
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p'))
 THEN RAISE EXCEPTION 'Fresh isolated PostgreSQL 17.6 test database required'; END IF;
END $$;
-- Compatibility roles were created by bootstrap infrastructure. This session is
-- postgres NOSUPERUSER/NOBYPASSRLS; no candidate execution uses bootstrap authority.
DO $$ BEGIN
 IF current_user<>'postgres' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
 RAISE EXCEPTION 'Candidate must run under non-superuser owner'; END IF;
END $$;
\ir synthetic-schema.sql
-- Fail-closed ownership metadata fixture only; NEVER invoked.
\ir core-owner-fixture.sql
\ir writer-dependencies.sql
\ir manifest.sql
\ir identity.sql
\ir registry.sql
\ir bridge.sql
\ir producer.sql
-- No control flag, endpoint, financial engine or R3 replacement is installed.
