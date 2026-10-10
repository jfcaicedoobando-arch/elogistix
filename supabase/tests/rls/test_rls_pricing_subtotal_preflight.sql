-- Isolated CI/local only. Reads the actual migration through the psql client;
-- all temporary catalog variants are restored by savepoint and outer rollback.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
CREATE TEMP TABLE _pricing_subtotal_source(encoded text NOT NULL);
\copy pg_temp._pricing_subtotal_source(encoded) FROM PROGRAM 'base64 --wrap=0 supabase/migrations/20261010163000_pricing_subtotal_moneda_canonica.sql'
CREATE TEMP TABLE _pricing_subtotal_catalog_before AS
SELECT (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid='public.trg_cotizacion_subtotal_server()'::regprocedure) AS function_catalog,
       (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE tgrelid='public.cotizaciones'::regclass) AS trigger_catalog;
SAVEPOINT approved_source_variants;
-- Remove only the two newly installed triggers while exercising installation
-- preflight. ROLLBACK TO restores their exact original OIDs and definitions.
DROP TRIGGER trg_cotizaciones_calcular_pricing_tc ON public.cotizaciones;
DROP TRIGGER trg_crm_sync_pricing_tc ON public.cotizaciones;
DO $verify$
DECLARE
  v_baseline text := $baseline_body$
DECLARE
  v_t record;
  v_n int;
BEGIN
  v_n := CASE WHEN jsonb_typeof(NEW.conceptos_venta) = 'array'
              THEN jsonb_array_length(NEW.conceptos_venta) ELSE 0 END;
  IF v_n = 0 THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
  NEW.subtotal := COALESCE(
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_usd ELSE v_t.subtotal_mxn END, 0),
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END, 0),
    0
  );
  RETURN NEW;
END;
$baseline_body$;
  v_live text;
  v_variant text;
  v_encoded text;
  v_source text;
  v_preflight text;
  v_count int;
  v_rejected boolean;
  v_message text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Disposable CI owner required'; END IF;
  SELECT encoded INTO STRICT v_encoded FROM pg_temp._pricing_subtotal_source;
  IF encode(sha256(decode(v_encoded,'base64')),'hex') <> 'c33650b8a8a30bca246af07061e082b96d1018b66121511515d6fb2ee746e8df' THEN
    RAISE EXCEPTION 'Reviewed migration input hash mismatch';
  END IF;
  v_source:=convert_from(decode(v_encoded,'base64'),'UTF8');
  SELECT count(*), min(m[1]) INTO v_count,v_preflight
  FROM regexp_matches(v_source,'(?s)(DO \$preflight\$.*?\$preflight\$;)','g') m;
  IF v_count<>1 THEN RAISE EXCEPTION 'Expected one original preflight block'; END IF;
  IF md5(v_baseline)<>'82eae2e0c69a1800485a9e6d94ad4027' THEN
    RAISE EXCEPTION 'Frozen baseline body mismatch';
  END IF;
  v_live:=replace(v_baseline,
    E'  END IF;\n  SELECT * INTO v_t',E'  END IF;\n\n  SELECT * INTO v_t');
  IF md5(v_live)<>'81b6274494b1a9010efda6c0adf9b4cc' THEN
    RAISE EXCEPTION 'Frozen observed live body mismatch';
  END IF;

  FOREACH v_variant IN ARRAY ARRAY[v_baseline,v_live] LOOP
    EXECUTE format('CREATE OR REPLACE FUNCTION public.trg_cotizacion_subtotal_server() RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS %L',v_variant);
    EXECUTE v_preflight;
    RAISE NOTICE 'PASS approved exact subtotal source %',md5(v_variant);
  END LOOP;

  FOREACH v_variant IN ARRAY ARRAY[
    replace(v_baseline,'NEW.subtotal := COALESCE(','NEW.subtotal := 1 + COALESCE('),
    v_baseline || E'\n'
  ] LOOP
    EXECUTE format('CREATE OR REPLACE FUNCTION public.trg_cotizacion_subtotal_server() RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS %L',v_variant);
    v_rejected:=false;
    BEGIN
      EXECUTE v_preflight;
    EXCEPTION WHEN SQLSTATE '55000' THEN
      GET STACKED DIAGNOSTICS v_message=MESSAGE_TEXT;
      IF v_message <> 'LC_COT_PRICING_SUBTOTAL_SCHEMA_DRIFT' THEN RAISE; END IF;
      v_rejected:=true;
    END;
    IF NOT v_rejected THEN RAISE EXCEPTION 'Unexpected source drift accepted: %',md5(v_variant); END IF;
    RAISE NOTICE 'PASS unapproved semantic or whitespace source rejected %',md5(v_variant);
  END LOOP;
END;
$verify$;
ROLLBACK TO SAVEPOINT approved_source_variants;
RELEASE SAVEPOINT approved_source_variants;
DO $restored$
DECLARE b record;
BEGIN
  SELECT * INTO STRICT b FROM pg_temp._pricing_subtotal_catalog_before;
  IF b.function_catalog IS DISTINCT FROM (SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid='public.trg_cotizacion_subtotal_server()'::regprocedure)
    OR b.trigger_catalog IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE tgrelid='public.cotizaciones'::regclass) THEN
    RAISE EXCEPTION 'Test failed to restore exact original function/trigger catalogs';
  END IF;
  RAISE NOTICE 'PASS exact installed function and trigger catalogs restored';
END;
$restored$;
ROLLBACK;
