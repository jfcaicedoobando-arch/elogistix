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
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
  v_emb public.embarques;
  v_min text[];
  v_num_cont integer;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN
    IF v_resp ? '__idempotency_pending' THEN RETURN v_resp; END IF;
    RETURN jsonb_set(COALESCE(v_resp, '{}'::jsonb), '{replay}', 'true'::jsonb, true);
  END IF;

  -- BL-16: misma frase que cerrar_embarque — la papelera no avanza.
  SELECT * INTO v_emb
  FROM embarques WHERE id = p_embarque_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_emb.id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  v_org_id := v_emb.organization_id;
  v_flr := v_emb.fecha_llegada_real;
  v_estado_actual := v_emb.estado;
  v_expediente := v_emb.expediente;
  v_tipo := v_emb.tipo;
  PERFORM public._assert_writer(v_org_id);

  PERFORM set_config('app.via_rpc_estado', '1', true);

  IF p_nuevo_estado = 'Cancelado' THEN
    IF EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.embarque_id = p_embarque_id
        AND f.deleted_at IS NULL
        AND f.estado IN ('Emitida', 'Vencida', 'Parcialmente pagada')
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXC: cancela o sustituye las facturas de cliente antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = p_embarque_id
        AND pf.deleted_at IS NULL
        AND pf.estado <> 'Cancelada'
    ) THEN
      RAISE EXCEPTION 'LC_CANCEL_CON_CXP: cancela las facturas de proveedor antes de cancelar el embarque'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- v13.823.321: mínimos operativos para Confirmado. Misma regla canónica que
  -- `faltantesParaConfirmado` en la UI: si el guard cambia, se cambian ambos.
  IF p_nuevo_estado = 'Confirmado' THEN
    v_min := ARRAY[]::text[];
    SELECT count(*) INTO v_num_cont
      FROM public.embarque_contenedores ec
     WHERE ec.embarque_id = p_embarque_id;
    IF v_num_cont = 0 AND COALESCE(btrim(v_emb.contenedor), '') <> '' THEN
      v_num_cont := 1;
    END IF;

    IF COALESCE(btrim(v_emb.shipper), '') = '' THEN v_min := v_min || 'shipper (exportador)'; END IF;
    IF COALESCE(btrim(v_emb.consignatario), '') = '' THEN v_min := v_min || 'consignatario'; END IF;
    IF v_emb.etd IS NULL THEN v_min := v_min || 'ETD'; END IF;
    IF v_emb.eta IS NULL THEN v_min := v_min || 'ETA'; END IF;
    IF COALESCE(v_emb.peso_kg, 0) <= 0 THEN v_min := v_min || 'peso mayor a 0 kg'; END IF;

    IF v_emb.modo = 'Marítimo' THEN
      IF COALESCE(v_emb.tipo_servicio::text, '') <> 'LCL' AND v_num_cont = 0 THEN
        v_min := v_min || 'al menos un contenedor';
      END IF;
      IF COALESCE(btrim(v_emb.naviera), '') = '' THEN v_min := v_min || 'naviera'; END IF;
      IF COALESCE(btrim(v_emb.bl_master), '') = '' AND COALESCE(btrim(v_emb.bl_house), '') = '' THEN
        v_min := v_min || 'BL master u house';
      END IF;
    ELSIF v_emb.modo = 'Aéreo' THEN
      IF COALESCE(btrim(v_emb.aerolinea), '') = '' THEN v_min := v_min || 'aerolínea'; END IF;
      IF COALESCE(btrim(v_emb.mawb), '') = '' THEN v_min := v_min || 'MAWB'; END IF;
    ELSIF v_emb.modo = 'Terrestre' THEN
      IF COALESCE(btrim(v_emb.transportista), '') = '' THEN v_min := v_min || 'transportista'; END IF;
    END IF;

    IF array_length(v_min, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'LC_CONFIRMADO_INCOMPLETO: %', array_to_string(v_min, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

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
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
       v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', 'Cerrado'));

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
   WHERE id = p_embarque_id
     AND estado = v_estado_actual;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_CONCURRENTE: el embarque cambió de estado durante la transición'
      USING ERRCODE = '40001';
  END IF;

  IF p_nuevo_estado = 'Cancelado' THEN
    PERFORM set_config('app.liberando_papelera', 'on', true);
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = p_embarque_id
       AND organization_id = v_org_id;
    PERFORM set_config('app.liberando_papelera', 'off', true);
  END IF;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES
    (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
     v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', p_nuevo_estado));

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado, 'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avanzar_estado_embarque(uuid, text, text, text, text, uuid) TO authenticated, service_role;