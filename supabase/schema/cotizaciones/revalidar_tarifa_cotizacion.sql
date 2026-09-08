-- Fuente canónica de public.revalidar_tarifa_cotizacion (R201-COT-02).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.
--
-- R201-COT-02: cuando ventas ya re-aprobó la tarifa, la revalidación deja de
-- devolver `bloqueante` (que dejaba a operaciones en un bucle pidiendo la misma
-- re-aprobación) y expone `estado_revalidacion` + `reaprobacion_vigente`. La
-- aprobación sólo vale para el delta que ventas vio: si la tarifa vuelve a
-- cambiar, el resultado regresa a `bloqueante`.

CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot             public.cotizaciones%ROWTYPE;
  v_caller_org      UUID := current_user_org_id();
  v_is_super        BOOLEAN := has_role(auth.uid(),'super_admin'::app_role);
  v_umbral_pct      NUMERIC;
  v_bloquea_vencida BOOLEAN;
  v_tarifa_vigente  BOOLEAN := FALSE;
  v_tarifa_vig_rec  RECORD;
  v_cambios         JSONB := '[]'::jsonb;
  v_max_delta_pct   NUMERIC := 0;
  v_severidad       TEXT;
  v_costo           RECORD;
  v_monto_actual    NUMERIC;
  v_delta_abs       NUMERIC;
  v_delta_pct       NUMERIC;
  v_reaprob_vigente BOOLEAN := FALSE;
  v_delta_aprobado  NUMERIC;
  v_vig_aprobada    BOOLEAN;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;
  SELECT COALESCE((valor#>>'{}')::numeric,5) INTO v_umbral_pct
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_umbral_pct';
  v_umbral_pct := COALESCE(v_umbral_pct,5);
  SELECT COALESCE((valor#>>'{}')::boolean,TRUE) INTO v_bloquea_vencida
    FROM public.configuracion
    WHERE categoria='operaciones' AND clave='tarifa_revalidacion_bloquea_si_vencida';
  v_bloquea_vencida := COALESCE(v_bloquea_vencida,TRUE);
  IF v_cot.tarifa_id IS NULL THEN
    RETURN jsonb_build_object(
      'tarifa_vigente',TRUE,'agente_sin_cupo',FALSE,'severidad','sin_cambios',
      'cambios','[]'::jsonb,'umbral_pct',v_umbral_pct,'max_delta_pct',0,
      'estado_revalidacion',v_cot.estado_revalidacion,'reaprobacion_vigente',FALSE,
      'motivo','sin_tarifa_vinculada');
  END IF;
  SELECT * INTO v_tarifa_vig_rec FROM public.costeo_tarifas_vigentes_v WHERE id=v_cot.tarifa_id LIMIT 1;
  v_tarifa_vigente := FOUND;
  FOR v_costo IN
    SELECT cc.concepto, cc.moneda, cc.costo_unitario AS monto_anterior,
           cc.costeo_tarifa_id, cc.costeo_tarifa_recargo_id
    FROM public.cotizacion_costos cc
    WHERE cc.cotizacion_id=v_cot.id AND cc.deleted_at IS NULL
      AND (cc.costeo_tarifa_recargo_id IS NOT NULL OR cc.costeo_tarifa_id IS NOT NULL)
  LOOP
    IF v_costo.costeo_tarifa_recargo_id IS NOT NULL THEN
      SELECT monto INTO v_monto_actual FROM public.costeo_tarifa_recargos WHERE id=v_costo.costeo_tarifa_recargo_id;
    ELSE
      SELECT flete_base INTO v_monto_actual FROM public.costeo_tarifas WHERE id=v_costo.costeo_tarifa_id;
    END IF;
    IF v_monto_actual IS NULL THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',NULL,
        'delta_abs',NULL,'delta_pct',NULL,'motivo','eliminado');
      v_max_delta_pct := 100;
      CONTINUE;
    END IF;
    v_delta_abs := v_monto_actual - v_costo.monto_anterior;
    v_delta_pct := CASE WHEN v_costo.monto_anterior=0
                     THEN CASE WHEN v_delta_abs=0 THEN 0 ELSE 100 END
                     ELSE ROUND(ABS(v_delta_abs)/v_costo.monto_anterior*100,2) END;
    IF ABS(v_delta_abs) > 0.001 THEN
      v_cambios := v_cambios || jsonb_build_object(
        'concepto',v_costo.concepto,'moneda',v_costo.moneda,
        'monto_anterior',v_costo.monto_anterior,'monto_actual',v_monto_actual,
        'delta_abs',v_delta_abs,'delta_pct',v_delta_pct);
      IF v_delta_pct > v_max_delta_pct THEN v_max_delta_pct := v_delta_pct; END IF;
    END IF;
  END LOOP;
  IF NOT v_tarifa_vigente AND v_bloquea_vencida THEN v_severidad := 'bloqueante';
  ELSIF jsonb_array_length(v_cambios)=0 AND v_tarifa_vigente THEN v_severidad := 'sin_cambios';
  ELSIF v_max_delta_pct > v_umbral_pct THEN v_severidad := 'bloqueante';
  ELSE v_severidad := 'informativa';
  END IF;

  -- R201-COT-02: la re-aprobación de ventas consume el bloqueo, pero SÓLO si
  -- corresponde al mismo delta que ventas autorizó.
  IF v_severidad = 'bloqueante' AND v_cot.estado_revalidacion = 'reaprobada' THEN
    BEGIN
      v_delta_aprobado := (v_cot.revalidacion_delta_jsonb->>'max_delta_pct')::numeric;
    EXCEPTION WHEN others THEN v_delta_aprobado := NULL; END;
    BEGIN
      v_vig_aprobada := (v_cot.revalidacion_delta_jsonb->>'tarifa_vigente')::boolean;
    EXCEPTION WHEN others THEN v_vig_aprobada := NULL; END;
    IF v_delta_aprobado IS NOT NULL
       AND ABS(ROUND(v_delta_aprobado,2) - ROUND(v_max_delta_pct,2)) <= 0.01
       AND COALESCE(v_vig_aprobada, v_tarifa_vigente) IS NOT DISTINCT FROM v_tarifa_vigente THEN
      v_severidad := 'informativa';
      v_reaprob_vigente := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'estado_revalidacion',v_cot.estado_revalidacion,
    'reaprobacion_vigente',v_reaprob_vigente,
    'motivo',CASE WHEN v_reaprob_vigente THEN 'reaprobada_por_ventas' ELSE NULL END,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$function$;

REVOKE ALL ON FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id uuid) TO service_role;
