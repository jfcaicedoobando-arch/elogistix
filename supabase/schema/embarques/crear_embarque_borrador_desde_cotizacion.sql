-- Fuente canónica de public.crear_embarque_borrador_desde_cotizacion
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios'::text, p_tarifa_id_aplicada uuid DEFAULT NULL::uuid, p_delta_jsonb jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  IF p_decision='sin_cambios' THEN
    PERFORM public.enforce_revalidacion_sin_cambios(p_cotizacion_id);
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  UPDATE public.embarques
     SET tarifa_id_original=v_cot.tarifa_id,
         tarifa_id_aplicada=COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id),
         tarifa_delta_jsonb=p_delta_jsonb,
         tarifa_decision=p_decision,
         tarifa_revalidada_en=now(),
         tarifa_revalidada_por=auth.uid()
   WHERE id=v_embarque_id;
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
  RETURN v_embarque_id;
END;
$function$
 name:crear_embarque_borrador_desde_cotizacion schema:public;
