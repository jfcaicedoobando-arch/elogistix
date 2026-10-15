-- Disposable PostgreSQL 17.6 CI database ONLY. Never run against the ERP.
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF current_database() NOT LIKE 'crm_acl_fixture_%' THEN RAISE EXCEPTION 'fixture database name required'; END IF;
 IF current_setting('server_version_num')::int <> 170006 THEN RAISE EXCEPTION 'PostgreSQL 17.6 required'; END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.clientes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, nombre text NOT NULL, deleted_at timestamptz);
CREATE TABLE public.crm_empresas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, nombre text NOT NULL, cliente_id uuid, estado_crm text DEFAULT 'Prospecto', deleted_at timestamptz, created_at timestamptz DEFAULT now(), created_by uuid);
CREATE TABLE public.costeo_cargos_fob_agente(id int PRIMARY KEY);
CREATE TABLE public.costeo_cargos_locales_naviera(id int PRIMARY KEY);
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
\ir sources/0016_crm_empresa_desde_cliente.sql
\ir sources/0017_crm_empresa_no_borrar_cliente.sql
\ir sources/0018_cargos_tarifario_aplica_iva.sql
COMMENT ON FUNCTION public._crm_empresa_no_borrar_cliente() IS 'synthetic fixture metadata sentinel';
COMMENT ON FUNCTION public._crm_empresa_no_delete_fisico() IS 'synthetic fixture metadata sentinel';
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.crm_empresas TO authenticated;
