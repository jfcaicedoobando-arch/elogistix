-- C5 + A3: el guard de estados de cotización no contemplaba ninguna transición
-- hacia 'Archivada' ni salida de 'Vencida'/'Archivada'. Consecuencias:
--   * el paso 4c del job de housekeeping lanzaba excepción y hacía rollback de
--     TODO el job (las cotizaciones dejaban de vencerse, en silencio);
--   * el botón "Reactivar" fallaba en el 100% de los intentos.
CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_old text := OLD.estado::text;
  v_new text := NEW.estado::text;
BEGIN
  IF v_old IS NULL OR v_new IS NULL OR v_old = v_new THEN
    RETURN NEW;
  END IF;

  -- Vencida siempre puede aplicarse desde cualquier estado no terminal
  IF v_new = 'Vencida' AND v_old IN ('Solicitada','Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;

  -- Housekeeping: Vencida >90 días → Archivada (C5)
  IF v_old = 'Vencida' AND v_new = 'Archivada' THEN
    RETURN NEW;
  END IF;

  -- Reactivación manual desde estados de housekeeping (A3)
  IF v_old IN ('Vencida','Archivada')
     AND v_new IN ('Solicitada','Borrador','Enviada','Aceptada') THEN
    RETURN NEW;
  END IF;

  -- Transiciones válidas
  IF (v_old = 'Solicitada'    AND v_new IN ('Borrador','Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Borrador'      AND v_new IN ('Enviada','Aceptada','Rechazada'))
  OR (v_old = 'Enviada'       AND v_new IN ('Aceptada','Rechazada'))
  OR (v_old = 'Aceptada'      AND v_new IN ('En operación'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'LC_COT_TRANSICION_INVALIDA: no se puede pasar de % a %', v_old, v_new
    USING ERRCODE = 'P0001';
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_estado_cotizacion() FROM anon;
GRANT EXECUTE ON FUNCTION public.guard_estado_cotizacion() TO authenticated, service_role;

-- C5: aislar el paso de archivado para que un fallo suyo no haga rollback de
-- los pasos de vencimiento (defensa en profundidad).
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

  -- 4c) Vencidas >90 días sin movimiento → Archivada (aislado)
  BEGIN
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