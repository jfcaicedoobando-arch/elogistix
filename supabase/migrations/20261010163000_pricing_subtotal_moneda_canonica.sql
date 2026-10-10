-- Pricing keeps the immutable CRM/header currency. Convert sales buckets using
-- the explicit persisted MXN-per-USD rate; never relabel a foreign amount.
-- No backfill, lineage change, RLS/ACL change, or non-Pricing behavior change.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.cotizaciones IN SHARE ROW EXCLUSIVE MODE;

DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.trg_cotizacion_subtotal_server()'::regprocedure
      -- Reviewed main baseline and observed live differ only by one blank line.
      -- Accept only these exact bodies; do not normalize arbitrary source drift.
      AND md5(p.prosrc) IN ('82eae2e0c69a1800485a9e6d94ad4027',
                           '81b6274494b1a9010efda6c0adf9b4cc')
      AND NOT p.prosecdef AND p.proconfig=ARRAY['search_path=public']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure
      AND md5(p.prosrc)='af74ad66a16484e4549fae3f111a8203'
      AND p.prosecdef AND p.proconfig=ARRAY['search_path=public']::text[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid='public.guard_cotizacion_origen_pricing()'::regprocedure
      AND md5(p.prosrc)='889f47fe407e400437e798fe7a7d4e3c'
      AND NOT p.prosecdef
  ) OR EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid='public.cotizaciones'::regclass
      AND tgname IN ('trg_cotizaciones_calcular_pricing_tc','trg_crm_sync_pricing_tc')
  ) THEN
    RAISE EXCEPTION 'LC_COT_PRICING_SUBTOTAL_SCHEMA_DRIFT' USING ERRCODE='55000';
  END IF;
  IF (SELECT pg_get_triggerdef(oid, false) FROM pg_trigger
      WHERE tgrelid='public.cotizaciones'::regclass AND tgname='trg_cotizaciones_subtotal_server')
       IS DISTINCT FROM 'CREATE TRIGGER trg_cotizaciones_subtotal_server BEFORE INSERT OR UPDATE OF conceptos_venta, moneda ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION trg_cotizacion_subtotal_server()'
     OR (SELECT pg_get_triggerdef(oid, false) FROM pg_trigger
      WHERE tgrelid='public.cotizaciones'::regclass AND tgname='trg_crm_sync_oportunidad_desde_cotizacion')
       IS DISTINCT FROM 'CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id, conceptos_venta ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION _crm_sync_oportunidad_desde_cotizacion()'
     OR (SELECT pg_get_triggerdef(oid, false) FROM pg_trigger
      WHERE tgrelid='public.cotizaciones'::regclass AND tgname='trg_guard_cotizacion_origen_pricing')
       IS DISTINCT FROM 'CREATE TRIGGER trg_guard_cotizacion_origen_pricing BEFORE INSERT OR UPDATE OF pricing_solicitud_id, oportunidad_id, cliente_id, tarifa_id, organization_id, es_prospecto, moneda ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION guard_cotizacion_origen_pricing()'
     OR (SELECT pg_get_triggerdef(oid, false) FROM pg_trigger
      WHERE tgrelid='public.cotizaciones'::regclass AND tgname='trg_cotizaciones_guard_en_operacion')
       IS DISTINCT FROM 'CREATE TRIGGER trg_cotizaciones_guard_en_operacion BEFORE UPDATE ON public.cotizaciones FOR EACH ROW EXECUTE FUNCTION cotizaciones_guard_en_operacion()'
     OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.cotizaciones'::regclass
        AND tgname IN ('trg_cotizaciones_subtotal_server','trg_crm_sync_oportunidad_desde_cotizacion','trg_guard_cotizacion_origen_pricing','trg_cotizaciones_guard_en_operacion')
        AND (tgenabled <> 'O' OR tgisinternal)) THEN
    RAISE EXCEPTION 'LC_COT_PRICING_SUBTOTAL_SCHEMA_DRIFT' USING ERRCODE='55000';
  END IF;
END;
$preflight$;

CREATE TEMP TABLE _pricing_subtotal_security_before ON COMMIT DROP AS
SELECT
  (SELECT jsonb_agg(to_jsonb(p) - 'prosrc' ORDER BY p.oid) FROM pg_proc p
   WHERE p.oid IN ('public.trg_cotizacion_subtotal_server()'::regprocedure,
     'public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure,
     'public.guard_cotizacion_origen_pricing()'::regprocedure)) AS function_security,
  (SELECT jsonb_build_object('owner',relowner,'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity)
     FROM pg_class WHERE oid='public.cotizaciones'::regclass) AS table_security,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p
     WHERE polrelid='public.cotizaciones'::regclass) AS policies,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t
     WHERE tgrelid='public.cotizaciones'::regclass) AS triggers;

CREATE OR REPLACE FUNCTION public.trg_cotizacion_subtotal_server()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_t record;
  v_n int;
  v_extranjero numeric;
BEGIN
  IF NEW.pricing_solicitud_id IS NOT NULL THEN
    IF NEW.moneda IS NULL OR NEW.moneda::text NOT IN ('USD', 'MXN') THEN
      RAISE EXCEPTION 'LC_COT_PRICING_MONEDA_INVALIDA' USING ERRCODE='22023';
    END IF;

    -- Existing canonical helper validates concepts and rounds each sales line
    -- before summing each currency. IVA never enters the header subtotal.
    SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
    IF v_t.subtotal_usd::text IN ('NaN','Infinity','-Infinity')
       OR v_t.subtotal_mxn::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: subtotal no finito'
        USING ERRCODE='23514';
    END IF;
    v_extranjero := CASE WHEN NEW.moneda::text='USD'
      THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END;

    IF v_extranjero <> 0 AND (NEW.tipo_cambio_usd IS NULL
       OR NEW.tipo_cambio_usd <= 0
       OR NEW.tipo_cambio_usd::text IN ('NaN','Infinity','-Infinity')) THEN
      RAISE EXCEPTION 'LC_COT_PRICING_TC_REQUERIDO' USING ERRCODE='22023';
    END IF;

    NEW.subtotal := ROUND(CASE WHEN NEW.moneda::text='USD'
      THEN v_t.subtotal_usd + CASE WHEN v_extranjero=0 THEN 0
                                 ELSE v_t.subtotal_mxn / NEW.tipo_cambio_usd END
      ELSE v_t.subtotal_mxn + CASE WHEN v_extranjero=0 THEN 0
                                 ELSE v_t.subtotal_usd * NEW.tipo_cambio_usd END
    END, 2);
    RETURN NEW;
  END IF;

  -- Unchanged legacy behavior for quotations without Pricing lineage.
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
$function$;

-- Keep the legacy event unchanged: a TC-only edit must not affect non-Pricing.
-- Run before trg_cotizaciones_guard_en_operacion so it sees the new amount
-- and still rejects monetary edits to accepted/in-operation quotations. Also
-- run before zz_crm_cerrar_oportunidad_desde_cotizacion for acceptance + TC.
CREATE TRIGGER trg_cotizaciones_calcular_pricing_tc
BEFORE UPDATE OF tipo_cambio_usd ON public.cotizaciones
FOR EACH ROW WHEN (NEW.pricing_solicitud_id IS NOT NULL
  AND NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd)
EXECUTE FUNCTION public.trg_cotizacion_subtotal_server();

-- UPDATE OF uses the original SET list, not columns changed by BEFORE triggers.
-- Reuse the reviewed CRM function; its value-change WHERE makes an overlapping
-- concepts + TC save idempotent (no second opportunity UPDATE).
CREATE TRIGGER trg_crm_sync_pricing_tc
AFTER UPDATE OF tipo_cambio_usd ON public.cotizaciones
FOR EACH ROW WHEN (NEW.pricing_solicitud_id IS NOT NULL
  AND NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd)
EXECUTE FUNCTION public._crm_sync_oportunidad_desde_cotizacion();

DO $postcheck$
DECLARE b record;
BEGIN
  SELECT * INTO STRICT b FROM pg_temp._pricing_subtotal_security_before;
  IF b.function_security IS DISTINCT FROM (
    SELECT jsonb_agg(to_jsonb(p) - 'prosrc' ORDER BY p.oid) FROM pg_proc p
    WHERE p.oid IN ('public.trg_cotizacion_subtotal_server()'::regprocedure,
      'public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure,
      'public.guard_cotizacion_origen_pricing()'::regprocedure))
    OR b.table_security IS DISTINCT FROM (
      SELECT jsonb_build_object('owner',relowner,'acl',relacl,'rls',relrowsecurity,'force_rls',relforcerowsecurity)
      FROM pg_class WHERE oid='public.cotizaciones'::regclass)
    OR b.policies IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)
      FROM pg_policy p WHERE polrelid='public.cotizaciones'::regclass)
    OR b.triggers IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid)
      FROM pg_trigger t WHERE tgrelid='public.cotizaciones'::regclass
        AND tgname NOT IN ('trg_cotizaciones_calcular_pricing_tc','trg_crm_sync_pricing_tc'))
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.guard_cotizacion_origen_pricing()'::regprocedure)
      <> '889f47fe407e400437e798fe7a7d4e3c'
    OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public._crm_sync_oportunidad_desde_cotizacion()'::regprocedure)
      <> 'af74ad66a16484e4549fae3f111a8203' THEN
    RAISE EXCEPTION 'LC_COT_PRICING_SUBTOTAL_SECURITY_CHANGED' USING ERRCODE='55000';
  END IF;
END;
$postcheck$;
COMMIT;
