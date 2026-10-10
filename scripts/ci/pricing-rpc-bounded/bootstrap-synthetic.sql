-- REVIEW ONLY. Run exclusively against the brand-new private cluster created by
-- bootstrap-synthetic.sh. No passwords, production endpoints or external data.
-- Login is deliberately disabled for all simulated platform/application roles:
-- local tests switch roles from the isolated initdb administrator instead.
-- Platform administrative SUPERUSER flags are not modeled; this is an explicit
-- boundary, not a claim of full Supabase control-plane identity.
CREATE ROLE postgres NOLOGIN NOSUPERUSER INHERIT BYPASSRLS;
CREATE ROLE anon NOLOGIN NOSUPERUSER INHERIT NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER INHERIT NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER INHERIT BYPASSRLS;
CREATE ROLE authenticator NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER INHERIT NOBYPASSRLS;
CREATE ROLE supabase_auth_admin NOLOGIN NOSUPERUSER NOINHERIT NOBYPASSRLS;
CREATE ROLE dashboard_user NOLOGIN NOSUPERUSER INHERIT NOBYPASSRLS;
CREATE ROLE sandbox_exec NOLOGIN NOSUPERUSER INHERIT BYPASSRLS;
CREATE ROLE supabase_privileged_role NOLOGIN NOSUPERUSER INHERIT NOBYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator WITH INHERIT FALSE, SET TRUE;
CREATE SCHEMA auth AUTHORIZATION supabase_admin;
CREATE SCHEMA extensions AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, postgres, dashboard_user;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA extensions TO authenticated, service_role;
-- Secure construction defaults. The reviewed replay bundle must restore observed
-- per-object/default ACLs for existing objects, in the same transaction as final
-- candidate revocations. Nothing is exposed to an HTTP server in this SQL phase.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Accessed auth identity interface only, not a Supabase signup schema.
CREATE TABLE auth.users (id uuid PRIMARY KEY, email varchar(255));
ALTER TABLE auth.users OWNER TO supabase_auth_admin;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON auth.users TO dashboard_user;
GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON auth.users TO postgres;
GRANT SELECT ON auth.users TO postgres WITH GRANT OPTION;
SET LOCAL ROLE postgres;
GRANT SELECT ON auth.users TO sandbox_exec;
RESET ROLE;
-- Synthetic rows are supplied by the reviewed seed bundle; never import users.
