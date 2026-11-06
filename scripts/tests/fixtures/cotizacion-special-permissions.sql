-- Run only in a fresh disposable PostgreSQL database (no project connections).
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.org_scope() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.org',true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('super_admin');
CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE public.organization_members (organization_id uuid,user_id uuid,role text);
CREATE TABLE public.clientes (id uuid PRIMARY KEY, organization_id uuid,tipo_cliente text);
CREATE TABLE public.cotizaciones (
 id uuid PRIMARY KEY,organization_id uuid,cliente_id uuid,estado text,
 conceptos_venta jsonb, tipo_cambio_usd numeric,moneda text,subtotal numeric
);
CREATE TABLE public.cotizacion_costos(cotizacion_id uuid,moneda text,costo_total numeric,deleted_at timestamptz);
\ir ../../../drizzle/migrations/0031_cotizacion_autorizacion.sql
-- Isolate the permission guard from unrelated handover integrations.
CREATE TABLE public.test_handovers (cotizacion_id uuid);
CREATE OR REPLACE FUNCTION public._cotizacion_crear_handover() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$ BEGIN INSERT INTO public.test_handovers VALUES (NEW.id); RETURN NEW; END $$;
\ir ../../../drizzle/migrations/0032_cliente_especial_sin_autorizacion.sql
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
GRANT SELECT,UPDATE,INSERT ON public.cotizaciones TO authenticated;
GRANT SELECT ON public.clientes,public.cotizacion_costos TO authenticated;
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoped ON public.cotizaciones TO authenticated USING (organization_id=public.org_scope()) WITH CHECK (organization_id=public.org_scope());
-- Fixture-only super-admin visibility to test the privileged boundary directly.
CREATE POLICY fixture_super ON public.cotizaciones TO authenticated USING (current_setting('test.super',true)='1') WITH CHECK (current_setting('test.super',true)='1');
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoped ON public.clientes TO authenticated USING (organization_id=public.org_scope());
ALTER TABLE public.cotizacion_costos ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoped ON public.cotizacion_costos TO authenticated USING (EXISTS(SELECT 1 FROM public.cotizaciones c WHERE c.id=cotizacion_id));
INSERT INTO public.clientes VALUES
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','especial'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','normal'),
 ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','especial');
INSERT INTO public.cotizaciones SELECT ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001',
 CASE WHEN i=103 THEN '00000000-0000-0000-0000-000000000012' WHEN i=104 THEN '00000000-0000-0000-0000-000000000021' ELSE '00000000-0000-0000-0000-000000000011' END::uuid,
 'Borrador','[{"moneda":"USD","cantidad":1,"precio_unitario":100}]',20,'USD',100 FROM generate_series(101,110) i;
INSERT INTO public.cotizaciones VALUES ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000021','Borrador','[]',20,'USD',100,NULL,NULL,NULL,NULL,NULL);
INSERT INTO public.cotizacion_costos SELECT id,'USD',60,NULL FROM public.cotizaciones;
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000099',true),set_config('test.org','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
 UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000101';
 RAISE EXCEPTION 'Historical bug did not reproduce';
 EXCEPTION WHEN insufficient_privilege THEN
 IF SQLERRM NOT LIKE '%_cotizacion_margen_pct%' THEN RAISE; END IF;
 END;
END $$;
RESET ROLE;
\ir ../../../drizzle/migrations/0037_cotizacion_especial_trigger_permissions.sql
DO $$ BEGIN
 IF has_function_privilege('authenticated','public._cotizacion_margen_pct(uuid)','EXECUTE')
 OR has_function_privilege('anon','public._cotizacion_margen_pct(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','public._cotizacion_autorizacion_guard()','EXECUTE')
 OR has_function_privilege('service_role','public._cotizacion_autorizacion_guard()','EXECUTE')
 THEN RAISE EXCEPTION 'Privileged helper exposed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
-- Authenticated transition succeeds and the original margin is preserved.
UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000101';
UPDATE public.cotizaciones SET estado='Aceptada' WHERE id='00000000-0000-0000-0000-000000000102';
DO $$ DECLARE n int; BEGIN
 SELECT count(*) INTO n FROM public.cotizaciones WHERE id IN ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102') AND autorizada_at IS NOT NULL AND margen_autorizado_pct=40 AND autorizada_por=auth.uid();
 IF n<>2 THEN RAISE EXCEPTION 'Auto-authorization mismatch'; END IF;
 BEGIN PERFORM public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000201'); RAISE EXCEPTION 'Direct helper was callable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000103'; RAISE EXCEPTION 'Normal client bypass'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM NOT LIKE 'LC_COT_SIN_AUTORIZACION:%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000104'; RAISE EXCEPTION 'Cross-tenant client bypass'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM NOT LIKE 'LC_COT_SIN_AUTORIZACION:%' THEN RAISE; END IF; END;
 BEGIN UPDATE public.cotizaciones SET autorizada_at=now() WHERE id='00000000-0000-0000-0000-000000000105'; RAISE EXCEPTION 'Forged authorization'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'LC_COT_AUTORIZACION_SOLO_RPC' THEN RAISE; END IF; END;
 BEGIN UPDATE public.cotizaciones SET estado='Enviada',id='00000000-0000-0000-0000-000000000999' WHERE id='00000000-0000-0000-0000-000000000105'; RAISE EXCEPTION 'Changed identity accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000201'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant update'; END IF;
END $$;
-- Even fixture super-admin visibility cannot authorize a different tenant.
SELECT set_config('test.super','1',true);
DO $$ BEGIN
 BEGIN UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000201'; RAISE EXCEPTION 'Super cross-tenant transition'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'LC_COT_NO_ENCONTRADA' THEN RAISE; END IF; END;
 BEGIN UPDATE public.cotizaciones SET estado='Enviada',organization_id='00000000-0000-0000-0000-000000000002' WHERE id='00000000-0000-0000-0000-000000000105'; RAISE EXCEPTION 'Changed tenant accepted'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'LC_COT_NO_ENCONTRADA' THEN RAISE; END IF; END;
END $$;
SELECT set_config('test.org','',true);
DO $$ BEGIN BEGIN UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000105'; RAISE EXCEPTION 'Super missing scope'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'LC_COT_NO_ENCONTRADA' THEN RAISE; END IF; END; END $$;
SELECT set_config('test.super','',true),set_config('test.org','00000000-0000-0000-0000-000000000001',true),set_config('test.uid','',true);
DO $$ BEGIN BEGIN UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000105'; RAISE EXCEPTION 'Missing user accepted'; EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'LC_COT_NO_ENCONTRADA' THEN RAISE; END IF; END; END $$;
SELECT set_config('test.uid','00000000-0000-0000-0000-000000000099',true);
-- pg_temp cannot shadow the helper's trusted tables.
CREATE TEMP TABLE cotizaciones (id uuid,conceptos_venta jsonb,tipo_cambio_usd numeric);
CREATE TEMP TABLE cotizacion_costos (cotizacion_id uuid,moneda text,costo_total numeric,deleted_at timestamptz);
UPDATE public.cotizaciones SET estado='Enviada' WHERE id='00000000-0000-0000-0000-000000000106';
DO $$ BEGIN IF (SELECT margen_autorizado_pct FROM public.cotizaciones WHERE id='00000000-0000-0000-0000-000000000106') IS DISTINCT FROM 40 THEN RAISE EXCEPTION 'Temporary relation shadowing'; END IF; END $$;
SELECT set_config('test.org','',true);
DO $$ DECLARE n int; BEGIN UPDATE public.cotizaciones SET estado='Enviada'; GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Missing tenant scope'; END IF; END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN BEGIN UPDATE public.cotizaciones SET estado='Enviada'; RAISE EXCEPTION 'Anon write'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
DO $$ BEGIN IF (SELECT count(*) FROM public.test_handovers)<>3 THEN RAISE EXCEPTION 'Handover trigger regression'; END IF; END $$;
ROLLBACK;
\echo 'PASS: historical reproduction, authenticated send/accept, private ACL, tenant isolation, forgery, identity, temp shadowing, anon, handover'
