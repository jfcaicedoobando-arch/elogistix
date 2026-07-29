-- FIX P-01/P-02: reconciliación de sobrecargas ambiguas (PGRST203)

-- 1) avanzar_estado_embarque: castear el enum a text para poder eliminar la
--    sobrecarga enum de generar_expediente.
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_flr date;
  v_estado_actual public.estado_embarque;
  v_expediente text;
  v_tipo public.tipo_operacion;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id, fecha_llegada_real, estado, expediente, tipo
    INTO v_org_id, v_flr, v_estado_actual, v_expediente, v_tipo
  FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  IF v_estado_actual = 'Borrador'::estado_embarque
     AND p_nuevo_estado = 'Confirmado'
     AND (v_expediente IS NULL OR v_expediente = '') THEN
    v_expediente := public.generar_expediente(v_tipo::text);
    UPDATE embarques SET expediente = v_expediente WHERE id = p_embarque_id;
  END IF;

  IF p_nuevo_estado = 'Cerrado' THEN
    PERFORM public.cerrar_embarque(p_embarque_id);

    PERFORM set_config('app.bypass_cierre','on', true);

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

    PERFORM set_config('app.bypass_cierre','off', true);

    v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Cerrado');
    PERFORM public.idempotency_store(p_request_id, v_resp);
    RETURN v_resp;
  END IF;

  IF p_nuevo_estado = 'Arribo' AND v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado, 'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO service_role;

-- 2) Eliminar sobrecargas ambiguas / legacy
DROP FUNCTION IF EXISTS public.generar_expediente(public.tipo_operacion);
DROP FUNCTION IF EXISTS public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.portal_responder_cotizacion(uuid, text);

-- 3) Reafirmar contratos de ejecución de las versiones canónicas
REVOKE ALL ON FUNCTION public.generar_expediente(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_expediente(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generar_expediente(text) TO service_role;

REVOKE ALL ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.portal_responder_cotizacion(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_cotizacion(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_responder_cotizacion(uuid, text, text) TO service_role;