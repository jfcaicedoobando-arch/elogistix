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
  v_promovido boolean := false;
  v_estado_final text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Por liquidar','Cerrado'];
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id, fecha_llegada_real, estado, expediente, tipo
    INTO v_org_id, v_flr, v_estado_actual, v_expediente, v_tipo
  FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- v13.303.42: al confirmar un borrador sin folio, reservar expediente ahora.
  -- v13.399.4: cast explícito enum → text; sin él Postgres no resuelve
  -- generar_expediente(text) y lanza 42883.
  IF v_estado_actual = 'Borrador'::estado_embarque
     AND p_nuevo_estado = 'Confirmado'
     AND (v_expediente IS NULL OR v_expediente = '') THEN
    v_expediente := public.generar_expediente(coalesce(v_tipo::text, ''));
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

  -- Cierre operativo automático: si al llegar a EIR ya está todo lo operativo,
  -- el embarque avanza solo a "Por liquidar".
  IF p_nuevo_estado = 'EIR' THEN
    BEGIN
      v_promovido := public.promover_embarque_por_liquidar(p_embarque_id);
    EXCEPTION WHEN OTHERS THEN
      v_promovido := false;
    END;
  END IF;

  v_estado_final := CASE WHEN v_promovido THEN 'Por liquidar' ELSE p_nuevo_estado END;

  v_resp := jsonb_build_object(
    'id', p_embarque_id,
    'estado', v_estado_final,
    'promovido_por_liquidar', v_promovido,
    'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;