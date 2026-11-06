-- Synthetic local-only authorization fixture; permissive RLS deliberately tests the column guard.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TYPE public.app_role AS ENUM ('super_admin','gerente_operaciones','admin','admin_org','operador','contador','coordinador_logistico');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
CREATE FUNCTION public.org_scope() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.org',true),'')::uuid$$;
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT COALESCE(current_setting('test.super',true),'false')='true'$$;
CREATE TABLE public.organization_members(organization_id uuid,user_id uuid,role public.app_role,created_at timestamptz DEFAULT now());
CREATE TABLE public.clientes(id uuid PRIMARY KEY,organization_id uuid,tipo_cliente text CHECK(tipo_cliente IN ('general','especial')),nombre text);
CREATE TABLE public.cotizaciones(id uuid PRIMARY KEY,organization_id uuid,cliente_id uuid,created_by uuid,autorizada_at timestamptz,oportunidad_id uuid,cliente_nombre text,prospecto_empresa text,modo text,incoterm text,origen text,destino text,descripcion_mercancia text,tipo_contenedor text,num_contenedores int,peso_kg numeric,volumen_m3 numeric,seguro boolean,folio text);
CREATE TABLE public.cotizacion_handovers(organization_id uuid,cotizacion_id uuid,coordinador_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE public.notificaciones_internas(organization_id uuid,usuario_id uuid,tipo text,titulo text,mensaje text,enlace text,entidad_tipo text,entidad_id uuid);
CREATE TABLE public.crm_leads(id uuid,fuente text);
CREATE TABLE public.crm_oportunidades(id uuid,lead_id uuid);
\ir ../../../drizzle/migrations/0038_coordinador_fijo_por_cliente.sql
CREATE TRIGGER trg_cotizacion_crear_handover AFTER UPDATE ON public.cotizaciones FOR EACH ROW WHEN (OLD.autorizada_at IS NULL AND NEW.autorizada_at IS NOT NULL) EXECUTE FUNCTION public._cotizacion_crear_handover();
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_permissive ON public.clientes FOR ALL TO authenticated USING(true) WITH CHECK(true);
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
(md5('A')::uuid,md5('operator')::uuid,'operador'),(md5('A')::uuid,md5('accountant')::uuid,'contador'),
(md5('A')::uuid,md5('ops')::uuid,'gerente_operaciones'),(md5('A')::uuid,md5('admin')::uuid,'admin'),
(md5('A')::uuid,md5('adminorg')::uuid,'admin_org'),(md5('A')::uuid,md5('coordA')::uuid,'coordinador_logistico'),
(md5('B')::uuid,md5('coordB')::uuid,'coordinador_logistico'),(md5('B')::uuid,md5('ops')::uuid,'gerente_operaciones');
INSERT INTO public.clientes(id,organization_id,tipo_cliente) VALUES(md5('clientA')::uuid,md5('A')::uuid,'general'),(md5('clientB')::uuid,md5('B')::uuid,'general');
INSERT INTO public.cotizaciones(id,organization_id,cliente_id,created_by) VALUES(md5('quoteA')::uuid,md5('A')::uuid,md5('clientA')::uuid,md5('operator')::uuid),(md5('quoteB')::uuid,md5('B')::uuid,md5('clientB')::uuid,md5('operator')::uuid);
SELECT set_config('test.uid',md5('operator'),true),set_config('test.org',md5('A'),true);
-- Prove preimage flaw under actual authenticated role before applying correction.
SET LOCAL ROLE authenticated;
UPDATE public.clientes SET coordinador_logistico_id=md5('coordA')::uuid WHERE id=md5('clientA')::uuid;
RESET ROLE;
UPDATE public.clientes SET coordinador_logistico_id=NULL;
CREATE TEMP TABLE acl_before AS SELECT oid,proacl,proowner FROM pg_proc WHERE oid IN ('public._puede_asignar_coordinador(uuid)'::regprocedure,'public.asignar_coordinador_cliente(uuid,uuid)'::regprocedure,'public.reasignar_coordinador_handover(uuid,uuid)'::regprocedure);
\ir ../../../drizzle/migrations/0040_coordinador_permission_boundary.sql
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN acl_before b USING(oid) WHERE p.proacl IS DISTINCT FROM b.proacl OR p.proowner<>b.proowner) THEN RAISE EXCEPTION 'RPC ACL/owner changed'; END IF;
 IF EXISTS(SELECT 1 FROM (VALUES('authenticated'),('anon'),('service_role')) r(role) WHERE has_function_privilege(r.role,'public._cliente_coordinador_guard()','EXECUTE') OR has_function_privilege(r.role,'public._cotizacion_crear_handover()','EXECUTE')) THEN RAISE EXCEPTION 'trigger EXECUTE exposed'; END IF;
END$$;
CREATE FUNCTION pg_temp.denied(stmt text, code text DEFAULT '42501') RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 BEGIN EXECUTE stmt; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=code THEN RETURN; END IF; RAISE; END;
 RAISE EXCEPTION 'unexpectedly allowed: %',stmt;
END$$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=md5('coordA')::uuid WHERE id=md5('clientA')::uuid$q$);
SELECT pg_temp.denied($q$INSERT INTO public.clientes(id,organization_id,coordinador_logistico_id) VALUES(md5('injected')::uuid,md5('A')::uuid,md5('coordA')::uuid)$q$);
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,md5('coordA')::uuid)$q$);
-- Unrelated edit and coordinator no-op remain legal for ordinary writers.
UPDATE public.clientes SET nombre='normal edit',coordinador_logistico_id=coordinador_logistico_id WHERE id=md5('clientA')::uuid;
SELECT set_config('test.uid',md5('accountant'),true);
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=md5('coordA')::uuid WHERE id=md5('clientA')::uuid$q$);
-- Privileged scoped roles work through RPC and direct writes.
SELECT set_config('test.uid',md5('ops'),true);
SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,md5('coordA')::uuid);
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=md5('coordB')::uuid WHERE id=md5('clientA')::uuid$q$,'P0001');
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientB')::uuid,md5('coordB')::uuid)$q$,'P0001');
SELECT set_config('test.uid',md5('admin'),true);
UPDATE public.clientes SET coordinador_logistico_id=NULL WHERE id=md5('clientA')::uuid;
SELECT set_config('test.uid',md5('adminorg'),true);
UPDATE public.clientes SET coordinador_logistico_id=md5('coordA')::uuid WHERE id=md5('clientA')::uuid;
SELECT set_config('test.uid',md5('operator'),true);
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=NULL WHERE id=md5('clientA')::uuid$q$);
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=md5('coordB')::uuid WHERE id=md5('clientA')::uuid$q$);
SELECT pg_temp.denied($q$UPDATE public.clientes SET organization_id=md5('B')::uuid WHERE id=md5('clientA')::uuid$q$);
-- Superadmin is constrained to active organization, even with permissive fixture RLS.
SELECT set_config('test.super','true',true);
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientB')::uuid,md5('coordB')::uuid)$q$,'P0001');
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=md5('coordB')::uuid WHERE id=md5('clientB')::uuid$q$);
SELECT set_config('test.org','',true);
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,md5('coordA')::uuid)$q$);
SELECT set_config('test.org',md5('A'),true),set_config('test.uid','',true);
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,md5('coordA')::uuid)$q$);
RESET ROLE;
-- Temp relations cannot shadow trusted handover relations.
CREATE TEMP TABLE clientes(LIKE public.clientes INCLUDING ALL);
CREATE TEMP TABLE organization_members(LIKE public.organization_members INCLUDING ALL);
CREATE TEMP TABLE cotizacion_handovers(LIKE public.cotizacion_handovers INCLUDING ALL);
-- Automatic handover under owner context must still work with an ordinary actor.
UPDATE public.clientes SET coordinador_logistico_id=NULL WHERE id=md5('clientA')::uuid;
SELECT set_config('test.super','false',true),set_config('test.uid',md5('operator'),true);
SET LOCAL ROLE authenticated;
UPDATE public.cotizaciones SET autorizada_at=now() WHERE id=md5('quoteA')::uuid;
RESET ROLE;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=md5('clientA')::uuid AND coordinador_logistico_id=md5('coordA')::uuid) OR NOT EXISTS(SELECT 1 FROM public.cotizacion_handovers WHERE cotizacion_id=md5('quoteA')::uuid AND coordinador_id=md5('coordA')::uuid) THEN RAISE EXCEPTION 'automatic assignment broken'; END IF; END$$;
INSERT INTO public.cotizacion_handovers(organization_id,cotizacion_id,coordinador_id) VALUES(md5('B')::uuid,md5('quoteB')::uuid,md5('coordB')::uuid);
SELECT set_config('test.uid',md5('ops'),true);
SET LOCAL ROLE authenticated;
SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordA')::uuid);
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteB')::uuid,md5('coordB')::uuid)$q$,'P0001');
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordB')::uuid)$q$,'P0001');
SELECT set_config('test.super','true',true);
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteB')::uuid,md5('coordB')::uuid)$q$,'P0001');
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT set_config('test.uid','',true);
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,NULL)$q$);
SELECT pg_temp.denied($q$UPDATE public.clientes SET coordinador_logistico_id=NULL WHERE id=md5('clientA')::uuid$q$);
RESET ROLE;
SELECT set_config('test.super','false',true),set_config('test.uid',md5('coordA'),true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,NULL)$q$);
SELECT set_config('test.uid',md5('ops'),true),set_config('test.org','',true);
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordA')::uuid)$q$);
SELECT set_config('test.org',md5('A'),true),set_config('test.uid','',true);
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordA')::uuid)$q$);
RESET ROLE;
-- Corrupt cross-tenant linkage must not be accepted by the definer join.
UPDATE public.cotizaciones SET organization_id=md5('B')::uuid WHERE id=md5('quoteA')::uuid;
SELECT set_config('test.uid',md5('ops'),true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordA')::uuid)$q$,'P0001');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.denied($q$SELECT public.asignar_coordinador_cliente(md5('clientA')::uuid,NULL)$q$);
SELECT pg_temp.denied($q$SELECT public.reasignar_coordinador_handover(md5('quoteA')::uuid,md5('coordA')::uuid)$q$);
RESET ROLE;
-- Even a privileged test installation on a forged relation cannot reuse owner trigger.
CREATE TEMP TABLE forged_quote(LIKE public.cotizaciones INCLUDING ALL);
CREATE TRIGGER forged_handover AFTER UPDATE ON forged_quote FOR EACH ROW EXECUTE FUNCTION public._cotizacion_crear_handover();
INSERT INTO forged_quote(id,organization_id) VALUES(md5('forged')::uuid,md5('A')::uuid);
SELECT pg_temp.denied($q$UPDATE forged_quote SET autorizada_at=now()$q$);
DO $$ BEGIN
 IF pg_has_role('authenticated',(SELECT relowner FROM pg_class WHERE oid='public.clientes'::regclass),'MEMBER') THEN RAISE EXCEPTION 'authenticated can assume owner'; END IF;
 IF (SELECT proowner FROM pg_proc WHERE oid='public._cotizacion_crear_handover()'::regprocedure) <> (SELECT relowner FROM pg_class WHERE oid='public.clientes'::regclass) THEN RAISE EXCEPTION 'owner context mismatch'; END IF;
END $$;
ROLLBACK;
\echo 'PASS: direct column writes, scoped RPCs, role matrix, owner handover, unchanged RPC ACLs'
