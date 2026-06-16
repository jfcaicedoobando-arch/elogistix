
-- 1) Habilitar pg_cron (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Agregar 'Archivada' al enum estado_cotizacion (Vencida ya existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.estado_cotizacion'::regtype
      AND enumlabel = 'Archivada'
  ) THEN
    ALTER TYPE public.estado_cotizacion ADD VALUE 'Archivada';
  END IF;
END$$;

-- 3) Columna estado_anterior para poder reactivar
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS estado_anterior public.estado_cotizacion;

-- 4) Función de housekeeping (SECURITY DEFINER, search_path bloqueado)
CREATE OR REPLACE FUNCTION public.expirar_cotizaciones_job()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_borradores_vencidos int := 0;
  v_enviadas_vencidas   int := 0;
  v_archivadas          int := 0;
BEGIN
  -- 4a) Borradores con >7 días sin movimiento → Vencida
  WITH upd AS (
    UPDATE public.cotizaciones
       SET estado_anterior = estado,
           estado = 'Vencida'::public.estado_cotizacion,
           updated_at = now()
     WHERE estado = 'Borrador'::public.estado_cotizacion
       AND updated_at < now() - interval '7 days'
       AND deleted_at IS NULL
       AND embarque_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_borradores_vencidos FROM upd;

  -- 4b) Enviadas cuya fecha_vigencia ya expiró → Vencida
  WITH upd AS (
    UPDATE public.cotizaciones
       SET estado_anterior = estado,
           estado = 'Vencida'::public.estado_cotizacion,
           updated_at = now()
     WHERE estado = 'Enviada'::public.estado_cotizacion
       AND fecha_vigencia IS NOT NULL
       AND fecha_vigencia < CURRENT_DATE
       AND deleted_at IS NULL
       AND embarque_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_enviadas_vencidas FROM upd;

  -- 4c) Vencidas >90 días sin movimiento → Archivada
  WITH upd AS (
    UPDATE public.cotizaciones
       SET estado_anterior = estado,
           estado = 'Archivada'::public.estado_cotizacion,
           updated_at = now()
     WHERE estado = 'Vencida'::public.estado_cotizacion
       AND updated_at < now() - interval '90 days'
       AND deleted_at IS NULL
       AND embarque_id IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_archivadas FROM upd;

  -- 4d) Registrar resumen en app_logs
  INSERT INTO public.app_logs (level, fn, msg, payload)
  VALUES (
    'info',
    'expirar_cotizaciones_job',
    'Housekeeping de cotizaciones ejecutado',
    jsonb_build_object(
      'borradores_vencidos', v_borradores_vencidos,
      'enviadas_vencidas',   v_enviadas_vencidas,
      'archivadas',          v_archivadas
    )
  );

  RETURN jsonb_build_object(
    'borradores_vencidos', v_borradores_vencidos,
    'enviadas_vencidas',   v_enviadas_vencidas,
    'archivadas',          v_archivadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expirar_cotizaciones_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expirar_cotizaciones_job() TO service_role;

-- 5) Programar ejecución diaria 09:00 UTC (≈03:00 CDMX)
DO $$
BEGIN
  PERFORM cron.unschedule('expirar_cotizaciones_diario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expirar_cotizaciones_diario');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'expirar_cotizaciones_diario',
  '0 9 * * *',
  $cron$ SELECT public.expirar_cotizaciones_job(); $cron$
);
