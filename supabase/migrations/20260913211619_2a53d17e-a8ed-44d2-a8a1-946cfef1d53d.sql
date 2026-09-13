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
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF v_cot.estado NOT IN ('Aceptada'::public.estado_cotizacion, 'En operación'::public.estado_cotizacion) THEN
    PERFORM public.enforce_cotizacion_vigente(p_cotizacion_id);
  END IF;

  v_rev := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  -- v13.823.349 — `mantenida_por_operaciones` NO es una vía para saltarse la
  -- re-aprobación: sólo vale cuando la revalidación no es bloqueante.
  IF p_decision IN ('sin_cambios','mantenida_por_operaciones') THEN
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
       WHERE t.id=p_tarifa_id_aplicada
         AND t.organization_id=v_cot.organization_id
         AND (
           p_decision='refrescada' AND t.id=v_cot.tarifa_id
           OR p_decision='sustituida' AND t.id IS DISTINCT FROM v_cot.tarifa_id
         )
    ) THEN
      RAISE EXCEPTION 'LC_TARIFA_APLICADA_INVALIDA: selecciona una tarifa válida de la organización' USING ERRCODE='P0001';
    END IF;
  END IF;
  v_embarque_id := public.crear_embarque_borrador_core(p_cotizacion_id);

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

    IF p_decision IN ('refrescada','sustituida') THEN
      PERFORM public._embarque_aplicar_tarifa_decidida(
        v_embarque_id, p_cotizacion_id, COALESCE(p_tarifa_id_aplicada, v_cot.tarifa_id));
    END IF;

    -- v13.823.349 — sólo las decisiones que resuelven el bloqueo cierran la
    -- solicitud pendiente; `mantenida_por_operaciones` no.
    IF p_decision IN ('reaprobada_ventas','refrescada','sustituida')
       AND v_cot.estado_revalidacion='pendiente_reaprobacion' THEN
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

CREATE OR REPLACE FUNCTION public.solicitar_reaprobacion_tarifa(p_cotizacion_id uuid, p_delta_jsonb jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot public.cotizaciones%ROWTYPE;
  v_caller_org uuid := current_user_org_id();
  v_is_super boolean := has_role(auth.uid(),'super_admin'::app_role);
  v_operador_id uuid;
  v_revalidacion jsonb;
  v_delta_seguro jsonb;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501'; END IF;

  IF NOT (v_is_super
          OR has_role(auth.uid(), 'admin_org'::app_role)
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'gerente_operaciones'::app_role)
          OR has_role(auth.uid(), 'coordinador_logistico'::app_role)
          OR has_role(auth.uid(), 'operador'::app_role)) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo administración u operación pueden solicitar la re-aprobación de tarifa'
      USING ERRCODE='42501';
  END IF;

  -- v13.823.349 — sólo el flujo operativo y sólo cuando la revalidación bloquea.
  IF v_cot.estado NOT IN ('Aceptada'::public.estado_cotizacion,
                          'En operación'::public.estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_NO_OPERATIVO: sólo una cotización Aceptada o En operación puede pedir re-aprobación de tarifa (estado: %)', v_cot.estado
      USING ERRCODE='P0001';
  END IF;

  v_revalidacion := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF COALESCE(v_revalidacion->>'severidad','') <> 'bloqueante' THEN
    RAISE EXCEPTION 'LC_REVALIDACION_SIN_BLOQUEO: la tarifa vigente no requiere re-aprobación (severidad: %)', COALESCE(v_revalidacion->>'severidad','')
      USING ERRCODE='P0001';
  END IF;

  v_delta_seguro := COALESCE(p_delta_jsonb, '{}'::jsonb)
    || jsonb_build_object('snapshot_economico', v_revalidacion->'snapshot_economico');

  UPDATE public.cotizaciones
     SET estado_revalidacion='pendiente_reaprobacion',
         revalidacion_solicitada_en=now(), revalidacion_resuelta_en=NULL,
         revalidacion_delta_jsonb=v_delta_seguro, updated_at=now()
   WHERE id=p_cotizacion_id;

  BEGIN v_operador_id := v_cot.operador::uuid;
  EXCEPTION WHEN others THEN v_operador_id := NULL; END;
  IF v_operador_id IS NOT NULL THEN
    INSERT INTO public.notificaciones_internas(
      organization_id,usuario_id,tipo,titulo,mensaje,enlace,entidad_tipo,entidad_id)
    VALUES (v_cot.organization_id,v_operador_id,'tarifa_reaprobacion_requerida',
      'Cotización requiere re-aprobación de tarifa',
      'La cotización '||v_cot.folio||' tiene cambios en la tarifa vigente. Revisa y decide.',
      '/cotizaciones/'||v_cot.id::text,'cotizacion',v_cot.id);
  END IF;

  INSERT INTO public.bitacora_actividad(
    organization_id,usuario_id,usuario_email,modulo,accion,entidad_id,entidad_nombre,detalles)
  SELECT v_cot.organization_id,auth.uid(),COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'Cotizaciones','reaprobacion_solicitada',v_cot.id,v_cot.folio,
    jsonb_build_object('delta',v_delta_seguro);
END;
$function$;

REVOKE ALL ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_reaprobacion_tarifa(uuid, jsonb) TO authenticated, service_role;