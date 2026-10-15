\set ON_ERROR_STOP on
-- SYNTHETIC compile-only support. No external identity, claims or fixture rows.
BEGIN;
SET LOCAL check_function_bodies = on;
DO $bootstrap$
BEGIN
 IF current_database() <> 'demo_financial_compile_recovery_lab'
 OR current_setting('server_version_num') <> '170006'
 OR current_user <> 'postgres' OR session_user <> 'postgres'
 OR current_setting('listen_addresses') <> '' OR inet_server_addr() IS NOT NULL
 OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT rolsuper AND rolbypassrls AND NOT rolinherit
   AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_has_role(current_user,'supabase_admin','MEMBER') THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_SYNTHETIC_CANDIDATE_REQUIRED';
 END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role')
   AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
   AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) <> 3 THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_NOLOGIN_COMPATIBILITY_ROLES_REQUIRED';
 END IF;
 IF to_regnamespace('auth') IS NOT NULL
 OR to_regnamespace('financial_compile_fixture') IS NOT NULL
 OR to_regnamespace('extensions') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')) THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_FRESH_DATABASE_REQUIRED';
 END IF;
END $bootstrap$;

CREATE SCHEMA auth;
CREATE SCHEMA financial_compile_fixture;
CREATE SCHEMA extensions;
-- Explicit, bounded model of the columns referenced by the reviewed definitions.
-- The table remains EMPTY and is not a model of Supabase authentication issuance.
CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text,
 deleted_at timestamptz,
 banned_until timestamptz
);
CREATE TABLE financial_compile_fixture.auth_context (
 singleton boolean PRIMARY KEY CHECK (singleton),
 subject_user_id uuid REFERENCES auth.users(id),
 role_name text,
 jwt_claims jsonb NOT NULL CHECK (jsonb_typeof(jwt_claims)='object')
);
CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $uid$
 SELECT subject_user_id FROM financial_compile_fixture.auth_context WHERE singleton
$uid$;
CREATE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $role$
 SELECT role_name FROM financial_compile_fixture.auth_context WHERE singleton
$role$;
CREATE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $jwt$
 SELECT COALESCE((SELECT jwt_claims FROM financial_compile_fixture.auth_context WHERE singleton),'{}'::jsonb)
$jwt$;

-- pg_trgm is requested as the NOSUPERUSER candidate, in the isolated database.
-- No admin fallback or replacement operator class is hidden in this script.
CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
REVOKE ALL ON SCHEMA auth,financial_compile_fixture,extensions FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE auth.users,financial_compile_fixture.auth_context FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION auth.uid(),auth.role(),auth.jwt() FROM PUBLIC,anon,authenticated,service_role;

DO $empty_auth$
BEGIN
 IF EXISTS (SELECT 1 FROM auth.users) OR EXISTS (SELECT 1 FROM financial_compile_fixture.auth_context)
 OR auth.uid() IS NOT NULL OR auth.role() IS NOT NULL OR auth.jwt() IS DISTINCT FROM '{}'::jsonb THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_EMPTY_SYNTHETIC_AUTH_REQUIRED';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
   WHERE e.extname='pg_trgm' AND n.nspname='extensions' AND e.extowner=current_user::regrole::oid)
 OR NOT EXISTS (SELECT 1 FROM pg_opclass o JOIN pg_namespace n ON n.oid=o.opcnamespace
   JOIN pg_am a ON a.oid=o.opcmethod JOIN pg_depend d ON d.objid=o.oid
     AND d.classid='pg_opclass'::regclass AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
   JOIN pg_extension e ON e.oid=d.refobjid
   WHERE n.nspname='extensions' AND o.opcname='gin_trgm_ops' AND a.amname='gin' AND e.extname='pg_trgm') THEN
  RAISE EXCEPTION 'FINANCIAL_COMPILE_REAL_PG_TRGM_EXTENSION_REQUIRED';
 END IF;
END $empty_auth$;
COMMIT;
SELECT 'FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE';
