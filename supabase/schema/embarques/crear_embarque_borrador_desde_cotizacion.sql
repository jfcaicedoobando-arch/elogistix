-- Fuente canónica. Espejo 1:1 de la migración R201-COT-01/02 (cotización→embarque).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios'::text, p_tarifa_id_aplicada uuid DEFAULT NULL::uuid, p_delta_jsonb jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE; v_ya_decidido BOOLEAN; v_rev jsonb;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  v_rev := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF p_decision='sin_cambios' THEN
    IF v_rev->>'severidad' = 'bloqueante' THEN
      RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION: la tarifa cambió antes de crear el embarque' USING ERRCODE='P0001';
    END IF;
  ELSIF p_decision='reaprobada_ventas' THEN
    IF COALESCE((v_rev->>'reaprobacion_vigente')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'LC_REAPROBACION_NO_VIGENTE: la aprobación de ventas no corresponde al estado económico actual' USING ERRCODE='P0001';
    END IF;
  ELSIF p_decision IN ('refrescada','sustituida') THEN
    IF p_tarifa_id_aplicada IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.costeo_tarifas t
       WHERE t.id=p_tarifa_id_aplicada AND t.organization_id=v_cot.organization_id
    ) THEN
      RAISE EXCEPTION 'LC_TARIFA_APLICADA_INVALIDA: selecciona una tarifa válida de la organización' USING ERRCODE='P0001';
    END IF;
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);

  -- v13.823.32: repetir la conversión (el core devuelve el embarque ya
  -- existente) NO debe pisar el snapshot/decisión histórica de tarifa.
  SELECT tarifa_decision IS NOT NULL INTO v_ya_decidido
    FROM public.embarques WHERE id = v_embarque_id;

  IF NOT COALESCE(v_ya_decidido, false) THEN
    UPDATE public.embarques
       SET tarifa_id_original=v_cot.tarifa_id,
           tarifa_id_aplicada=COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
           tarifa_delta_jsonb=p_delta_jsonb,
           tarifa_decision=p_decision,
           tarifa_revalidada_en=now(),
           tarifa_revalidada_por=auth.uid()
     WHERE id=v_embarque_id;

    -- R201-COT-01: refrescar o sustituir la tarifa debe reflejarse en el COSTO
    -- del embarque; antes sólo se guardaba la etiqueta de la decisión y el
    -- embarque nacía con los importes viejos. El histórico de la cotización y
    -- el precio de venta aceptado no se tocan.
    IF p_decision IN ('refrescada','sustituida') THEN
      PERFORM public._embarque_aplicar_tarifa_decidida(
        v_embarque_id, p_cotizacion_id, COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id));
    END IF;

    IF p_decision <> 'sin_cambios' AND v_cot.estado_revalidacion='pendiente_reaprobacion' THEN
      UPDATE public.cotizaciones
         SET estado_revalidacion='reaprobada', revalidacion_resuelta_en=now(), updated_at=now()
       WHERE id=p_cotizacion_id;
    END IF;

    INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
      SELECT v_cot.organization_id, auth.uid(),
        COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
        'Embarques','tarifa_decision_aplicada', v_embarque_id, v_cot.folio,
        jsonb_build_object('decision',p_decision,
          'tarifa_id_original',v_cot.tarifa_id,
          'tarifa_id_aplicada',COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
          'delta',p_delta_jsonb);
  END IF;

  RETURN v_embarque_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_borrador_desde_cotizacion(uuid, text, uuid, jsonb) TO authenticated, service_role;
