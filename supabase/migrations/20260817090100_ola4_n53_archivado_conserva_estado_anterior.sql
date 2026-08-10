-- Ola 4 · N53: el paso 4c (Vencida -> Archivada) hacía estado_anterior =
-- estado (= 'Vencida'), destruyendo el estado real ('Enviada'/'Borrador')
-- que 4a/4b acababan de preservar -> reactivar_cotizacion_rpc (RG12) siempre
-- caía a 'Borrador' y la prórroga de vigencia (+7 días al volver a
-- 'Enviada') era letra muerta para archivadas.
--
-- Base: 20260809054454 (íntegra); sólo cambia el SET estado_anterior de 4c.
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
  v_error_archivado     text := NULL;
BEGIN
  -- 4a) Borradores con >7 días sin movimiento -> Vencida
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

  -- 4b) Enviadas cuya fecha_vigencia ya expiró -> Vencida
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

  -- 4c) Vencidas >90 días sin movimiento -> Archivada (aislado)
  BEGIN
    WITH upd AS (
      UPDATE public.cotizaciones
         -- Ola 4 · N53: conservar el estado_anterior real (p. ej. 'Enviada',
         -- puesto por 4b) y sólo caer a 'Vencida' si no había nada previo.
         SET estado_anterior = CASE
               WHEN estado = 'Vencida'::public.estado_cotizacion
                 THEN COALESCE(estado_anterior, estado)
               ELSE estado
             END,
             estado = 'Archivada'::public.estado_cotizacion,
             updated_at = now()
       WHERE estado = 'Vencida'::public.estado_cotizacion
         AND updated_at < now() - interval '90 days'
         AND deleted_at IS NULL
         AND embarque_id IS NULL
      RETURNING 1
    )
    SELECT count(*) INTO v_archivadas FROM upd;
  EXCEPTION WHEN OTHERS THEN
    v_archivadas := 0;
    v_error_archivado := SQLERRM;
  END;

  -- 4d) Registrar resumen en app_logs
  INSERT INTO public.app_logs (level, fn, msg, payload)
  VALUES (
    CASE WHEN v_error_archivado IS NULL THEN 'info' ELSE 'error' END,
    'expirar_cotizaciones_job',
    'Housekeeping de cotizaciones ejecutado',
    jsonb_build_object(
      'borradores_vencidos', v_borradores_vencidos,
      'enviadas_vencidas',   v_enviadas_vencidas,
      'archivadas',          v_archivadas,
      'error_archivado',     v_error_archivado
    )
  );

  RETURN jsonb_build_object(
    'borradores_vencidos', v_borradores_vencidos,
    'enviadas_vencidas',   v_enviadas_vencidas,
    'archivadas',          v_archivadas,
    'error_archivado',     v_error_archivado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.expirar_cotizaciones_job() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expirar_cotizaciones_job() FROM anon;
GRANT EXECUTE ON FUNCTION public.expirar_cotizaciones_job() TO service_role;
