-- B-073: persistir el linkage tarifa→cotizacion_costos y revalidar también el flete base.
CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_costos(p_cotizacion_id uuid, p_costos jsonb, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  c jsonb;
  v_count int := 0;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_cotizacion_costos');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  PERFORM public._assert_writer(v_org_id);

  DELETE FROM cotizacion_costos WHERE cotizacion_id = p_cotizacion_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_costos) LOOP
    INSERT INTO cotizacion_costos (
      cotizacion_id, concepto, moneda, proveedor, cantidad,
      costo_unitario, precio_venta, unidad_medida, notas, organization_id,
      costeo_tarifa_id, costeo_tarifa_recargo_id
    ) VALUES (
      p_cotizacion_id,
      c->>'concepto',
      c->>'moneda',
      COALESCE(c->>'proveedor', ''),
      (c->>'cantidad')::numeric,
      (c->>'costo_unitario')::numeric,
      COALESCE((c->>'precio_venta')::numeric, 0),
      COALESCE(c->>'unidad_medida', ''),
      COALESCE(c->>'notas', ''),
      v_org_id,
      NULLIF(c->>'costeo_tarifa_id', '')::uuid,
      NULLIF(c->>'costeo_tarifa_recargo_id', '')::uuid
    );
    v_count := v_count + 1;
  END LOOP;

  v_resp := jsonb_build_object('cotizacion_id', p_cotizacion_id, 'count', v_count);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revalidar_tarifa_cotizacion(p_cotizacion_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id<>v_caller_org THEN
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

  RETURN jsonb_build_object(
    'tarifa_vigente',v_tarifa_vigente,'agente_sin_cupo',FALSE,'severidad',v_severidad,
    'cambios',v_cambios,'umbral_pct',v_umbral_pct,'max_delta_pct',v_max_delta_pct,
    'tarifa_id_vigente',CASE WHEN v_tarifa_vigente THEN v_cot.tarifa_id ELSE NULL END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revalidar_tarifa_cotizacion(uuid) TO authenticated, service_role;
