-- =============================================================
-- BUG-12 · Estado 'Vencida' de facturas stale
--
-- Causa raíz: la versión previa de public.marcar_facturas_vencidas()
-- filtraba el UPDATE por contexto de usuario
--   (service_role OR super_admin OR organization_id = current_user_org_id())
-- Bajo pg_cron NO hay sesión (auth.uid()/auth.role() nulos y
-- current_user_org_id() nulo) ⇒ el predicado era falso para toda
-- fila: el job "succeeded" cada día sin marcar nada.
--
-- Correcciones:
--   1) barrido de plataforma sin filtro de tenant (SECURITY DEFINER)
--   2) fecha de negocio MX en vez de CURRENT_DATE (UTC)
--   3) sólo 'Emitida' → 'Vencida' (no pisa 'Parcialmente pagada')
--   4) bitácora del conteo en app_logs
--   5) re-agenda idempotente 06:05 UTC + backfill inmediato
-- =============================================================

CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count     integer := 0;
  v_hoy_mx    date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_prev_flag text;
BEGIN
  -- Bypass del guard `guard_estado_factura`: 'Vencida' es un estado
  -- calculado y sólo el recálculo automático puede fijarlo.
  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE public.facturas
     SET estado = 'Vencida'::estado_factura,
         updated_at = now()
   WHERE estado = 'Emitida'::estado_factura
     AND fecha_vencimiento IS NOT NULL
     AND fecha_vencimiento < v_hoy_mx
     AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  INSERT INTO public.app_logs (level, fn, msg, payload)
  VALUES (
    'info',
    'marcar_facturas_vencidas',
    format('%s factura(s) marcada(s) como Vencida', v_count),
    jsonb_build_object('marcadas', v_count, 'fecha_negocio_mx', v_hoy_mx)
  );

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.marcar_facturas_vencidas() IS
  'BUG-12 · Barrido diario de plataforma: Emitida -> Vencida usando la fecha de negocio MX. Idempotente. Ejecutar sólo vía pg_cron / service_role.';

REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas() FROM anon;
REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_facturas_vencidas() TO service_role;

-- Re-agenda idempotente: 06:05 UTC (00:05 hora MX), después del corte contable.
DO $cron$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'marcar_facturas_vencidas_diario';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'marcar_facturas_vencidas_diario',
    '5 6 * * *',
    $CRON$ SELECT public.marcar_facturas_vencidas(); $CRON$
  );
END
$cron$;

-- Backfill inmediato: deja la cartera al día en el momento del deploy.
DO $backfill$
DECLARE v_n integer;
BEGIN
  SELECT public.marcar_facturas_vencidas() INTO v_n;
  RAISE NOTICE 'BUG-12 backfill: % factura(s) marcada(s) como Vencida', v_n;
END
$backfill$;