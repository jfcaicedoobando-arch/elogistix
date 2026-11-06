-- Local-only fixture; includes0037 tenant/ACL regression before monetary cases.
\set ON_ERROR_STOP on
\ir cotizacion-special-permissions.sql
BEGIN;
-- Previous fixture rolled back. Build fresh minimal monetary schema.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE TABLE public.cotizaciones(id uuid PRIMARY KEY, conceptos_venta jsonb,tipo_cambio_usd numeric);
CREATE TABLE public.cotizacion_costos(cotizacion_id uuid,moneda text,costo_total numeric,deleted_at timestamptz);
-- Historical helper literal only (full0031 needs authorization tables).
CREATE OR REPLACE FUNCTION public._cotizacion_margen_pct(p_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_venta numeric := 0; v_costo numeric := 0; v_tc numeric; r record;
BEGIN
  SELECT conceptos_venta, tipo_cambio_usd INTO c FROM cotizaciones WHERE id = p_id;
  v_tc := NULLIF(c.tipo_cambio_usd, 0);
  FOR r IN SELECT coalesce(e->>'moneda', 'USD') AS moneda,
                  coalesce((e->>'cantidad')::numeric, 0) * coalesce((e->>'precio_unitario')::numeric, 0) AS monto
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.conceptos_venta) = 'array' THEN c.conceptos_venta ELSE '[]'::jsonb END) e
  LOOP
    IF r.moneda = 'MXN' THEN
      IF v_tc IS NULL THEN RETURN NULL; END IF;
      v_venta := v_venta + r.monto / v_tc;
    ELSE v_venta := v_venta + r.monto; END IF;
  END LOOP;
  FOR r IN SELECT moneda, coalesce(costo_total, 0) AS monto FROM cotizacion_costos WHERE cotizacion_id = p_id AND deleted_at IS NULL LOOP
    IF r.moneda = 'MXN' THEN
      IF v_tc IS NULL THEN RETURN NULL; END IF;
      v_costo := v_costo + r.monto / v_tc;
    ELSE v_costo := v_costo + r.monto; END IF;
  END LOOP;
  IF v_venta <= 0 THEN RETURN NULL; END IF;
  RETURN round((v_venta - v_costo) / v_venta * 100, 2);
END $$;
REVOKE ALL ON FUNCTION public._cotizacion_margen_pct(uuid) FROM PUBLIC, anon, authenticated;


ALTER FUNCTION public._cotizacion_margen_pct(uuid) SET search_path TO pg_catalog, public, pg_temp;
GRANT EXECUTE ON FUNCTION public._cotizacion_margen_pct(uuid) TO service_role;
INSERT INTO public.cotizaciones VALUES('00000000-0000-0000-0000-000000000001','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]',NULL);
INSERT INTO public.cotizacion_costos VALUES('00000000-0000-0000-0000-000000000001','MXN',100,NULL);
DO $$ BEGIN IF public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'bug not reproduced'; END IF; END $$;
CREATE TEMP TABLE helper_before AS SELECT proowner,proacl,proconfig,prosecdef,provolatile FROM pg_proc WHERE oid='public._cotizacion_margen_pct(uuid)'::regprocedure;
-- Save historical implementation for mixed-currency differential tests only.
DO $$ BEGIN EXECUTE replace(pg_get_functiondef('public._cotizacion_margen_pct(uuid)'::regprocedure),'public._cotizacion_margen_pct(', 'public.historical_margin('); END $$;
REVOKE ALL ON FUNCTION public.historical_margin(uuid) FROM PUBLIC;
\ir ../../../drizzle/migrations/0039_cotizacion_margen_moneda_homogenea.sql
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN helper_before b WHERE p.oid='public._cotizacion_margen_pct(uuid)'::regprocedure AND ROW(p.proowner,p.proacl,p.proconfig,p.prosecdef,p.provolatile) IS DISTINCT FROM ROW(b.proowner,b.proacl,b.proconfig,b.prosecdef,b.provolatile)) THEN RAISE EXCEPTION 'security changed'; END IF; END $$;
CREATE FUNCTION pg_temp.margin_case(label text, sales jsonb, costs jsonb, tc numeric, expected numeric) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual numeric;
BEGIN
 UPDATE public.cotizaciones SET conceptos_venta=sales,tipo_cambio_usd=tc WHERE id='00000000-0000-0000-0000-000000000001';
 DELETE FROM public.cotizacion_costos;
 INSERT INTO public.cotizacion_costos SELECT '00000000-0000-0000-0000-000000000001',e->>'moneda',(e->>'monto')::numeric,CASE WHEN e->>'deleted'='true' THEN now() ELSE NULL END FROM jsonb_array_elements(costs) e;
 actual:=public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000001');
 IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION '% expected%, actual%',label,expected,actual; END IF;
END $$;
SELECT pg_temp.margin_case('MXN150/100 NULL TC','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"MXN","monto":100}]',NULL,33.33);
SELECT pg_temp.margin_case('MXN1000/700 zero TC','[{"moneda":"MXN","cantidad":1,"precio_unitario":1000}]','[{"moneda":"MXN","monto":700}]',0,30);
SELECT pg_temp.margin_case('MXN no costs','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[]',NULL,100);
SELECT pg_temp.margin_case('MXN zero sale','[{"moneda":"MXN","cantidad":1,"precio_unitario":0}]','[{"moneda":"MXN","monto":100}]',NULL,NULL);
SELECT pg_temp.margin_case('MXN negative sale','[{"moneda":"MXN","cantidad":1,"precio_unitario":-150}]','[{"moneda":"MXN","monto":100}]',NULL,NULL);
SELECT pg_temp.margin_case('MXN negative margin','[{"moneda":"MXN","cantidad":1,"precio_unitario":100}]','[{"moneda":"MXN","monto":150}]',NULL,-50);
SELECT pg_temp.margin_case('USD pure','[{"moneda":"USD","cantidad":1,"precio_unitario":150}]','[{"moneda":"USD","monto":100}]',NULL,33.33);
SELECT pg_temp.margin_case('MXN sale USD cost missing TC','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"USD","monto":5}]',NULL,NULL);
SELECT pg_temp.margin_case('MXN sale USD cost TC20','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"USD","monto":5}]',20,33.33);
SELECT pg_temp.margin_case('USD sale MXN cost missing TC','[{"moneda":"USD","cantidad":1,"precio_unitario":150}]','[{"moneda":"MXN","monto":2000}]',NULL,NULL);
SELECT pg_temp.margin_case('USD sale MXN cost TC20','[{"moneda":"USD","cantidad":1,"precio_unitario":150}]','[{"moneda":"MXN","monto":2000}]',20,33.33);
SELECT pg_temp.margin_case('zero USD neutral','[{"moneda":"MXN","cantidad":1,"precio_unitario":150},{"moneda":"USD","cantidad":1,"precio_unitario":0}]','[{"moneda":"MXN","monto":100},{"moneda":"USD","monto":0}]',NULL,33.33);
SELECT pg_temp.margin_case('deleted USD ignored','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"MXN","monto":100},{"moneda":"USD","monto":500,"deleted":true}]',NULL,33.33);
SELECT pg_temp.margin_case('unknown nonzero still nonMXN','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"EUR","monto":100}]',NULL,NULL);
SELECT pg_temp.margin_case('missing currency preservesUSD','[{"cantidad":1,"precio_unitario":150}]','[{"monto":100}]',NULL,33.33);
SELECT pg_temp.margin_case('fractional numeric','[{"moneda":"MXN","cantidad":0.5,"precio_unitario":300.01}]','[{"moneda":"MXN","monto":100.003}]',NULL,33.33);
SELECT pg_temp.margin_case('pureMXN negative TC ignored','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"MXN","monto":100}]',-20,33.33);
SELECT pg_temp.margin_case('nonarray sales','{}','[{"moneda":"MXN","monto":100}]',NULL,NULL);
SELECT pg_temp.margin_case('rounding half cent percent','[{"moneda":"MXN","cantidad":1,"precio_unitario":100}]','[{"moneda":"MXN","monto":99.995}]',NULL,0.01);
SELECT pg_temp.margin_case('rounding below half cent percent','[{"moneda":"MXN","cantidad":1,"precio_unitario":100}]','[{"moneda":"MXN","monto":99.99500001}]',NULL,0.00);
SELECT pg_temp.margin_case('mixed zero TC','[{"moneda":"MXN","cantidad":1,"precio_unitario":150}]','[{"moneda":"USD","monto":5}]',0,NULL);
SELECT pg_temp.margin_case('zero MXN neutral USD','[{"moneda":"USD","cantidad":1,"precio_unitario":150},{"moneda":"MXN","cantidad":1,"precio_unitario":0}]','[{"moneda":"USD","monto":100}]',NULL,33.33);
SELECT pg_temp.margin_case('pureMXN extreme TC must not convert','[{"moneda":"MXN","cantidad":1,"precio_unitario":"1e120000"}]','[]',1e-16000,100);
SELECT pg_temp.margin_case('mixed extreme avoids raw overflow',
 (SELECT jsonb_agg(jsonb_build_object('moneda','MXN','cantidad',1,'precio_unitario','1e131071')) FROM generate_series(1,10)) || '[{"moneda":"USD","cantidad":1,"precio_unitario":1}]'::jsonb,'[]',100,100);
DO $$ DECLARE i int; tc numeric; old numeric; actual numeric; BEGIN
 FOR i IN 1..500 LOOP
  tc:=(i::numeric/7)+0.000001;
  UPDATE public.cotizaciones SET tipo_cambio_usd=tc,conceptos_venta=jsonb_build_array(jsonb_build_object('moneda','MXN','cantidad',3,'precio_unitario',i*0.123456789::numeric),jsonb_build_object('moneda','USD','cantidad',1,'precio_unitario',i*0.987654321::numeric));
  DELETE FROM public.cotizacion_costos;
  INSERT INTO public.cotizacion_costos VALUES('00000000-0000-0000-0000-000000000001','MXN',i*0.2456789,NULL),('00000000-0000-0000-0000-000000000001','USD',i*0.54321,NULL);
  old:=public.historical_margin('00000000-0000-0000-0000-000000000001'); actual:=public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000001');
  IF old IS DISTINCT FROM actual THEN RAISE EXCEPTION 'mixed precision drift at%',i; END IF;
 END LOOP;
 IF public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000099') IS NOT NULL THEN RAISE EXCEPTION 'missing quote'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM public._cotizacion_margen_pct('00000000-0000-0000-0000-000000000001'); RAISE EXCEPTION 'helper exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
ROLLBACK;
\echo 'PASS: MXN NULL TC reproduction, monetary matrix,500 mixed differential cases, security unchanged'
