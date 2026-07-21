-- ============================================================================
-- Fase 2 · FIX-21 + FIX-25: Guards de estado en RPCs de conversión
-- ============================================================================

-- FIX-21: crear_embarque_borrador_core — guards contra soft delete, estados
-- inválidos y embarques huérfanos duplicados. Preserva la lógica de inserción
-- completa; sólo cambia validación de entrada + idempotencia extendida.
CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_core(p_cotizacion_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cot           public.cotizaciones%ROWTYPE;
  v_caller_org    uuid := current_user_org_id();
  v_is_super      boolean := has_role(auth.uid(), 'super_admin'::app_role);
  v_can_write     boolean;
  v_embarque_id   uuid;
  v_orphan_id     uuid;
  v_num           integer;
  v_peso_each     numeric;
  v_vol_each      numeric;
  v_piezas_base   integer;
  v_piezas_rest   integer;
  v_piezas_este   integer;
  v_first_hijo_id uuid;
  v_user_email    text;
  i               integer;
  v_costo         public.cotizacion_costos%ROWTYPE;
  v_target_ids    uuid[];
  v_cid           uuid;
  v_venta         jsonb;
  v_origen_code   text;
  v_destino_code  text;
  v_puerto_o      text;
  v_puerto_d      text;
  v_aero_o        text;
  v_aero_d        text;
  v_ciudad_o      text;
  v_ciudad_d      text;
  v_tipo_cont_code text;
  v_agente_id     uuid;
  v_naviera_id    uuid;
  v_agente_nombre text;
  v_naviera_nombre text;
BEGIN
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id = p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización % no existe', p_cotizacion_id USING ERRCODE = 'P0002';
  END IF;

  -- FIX-21: rechazar cotizaciones borradas (soft delete).
  IF v_cot.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización % está eliminada', p_cotizacion_id USING ERRCODE = 'P0001';
  END IF;

  IF NOT v_is_super AND v_cot.organization_id <> v_caller_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;

  v_can_write := v_is_super
                 OR has_role(auth.uid(), 'admin'::app_role)
                 OR has_role(auth.uid(), 'operador'::app_role);
  IF NOT v_can_write THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo admin u operador pueden crear el borrador' USING ERRCODE = '42501';
  END IF;

  -- FIX-21: aceptar 'Aceptada' y 'En operación' (esta última implica que ya
  -- hay un embarque; el bloque de idempotencia devuelve el existente).
  IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_cot.cliente_id IS NULL OR v_cot.es_prospecto THEN
    RAISE EXCEPTION 'LC_COT_SIN_CLIENTE: convierte el prospecto a cliente antes de crear el borrador' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotencia (link directo): la cotización ya apunta a un embarque.
  IF v_cot.embarque_id IS NOT NULL THEN
    -- Sólo devolver si el embarque sigue vivo; si fue eliminado, se limpia el link
    -- y se crea uno nuevo (permite re-generar tras borrar).
    SELECT id INTO v_orphan_id FROM public.embarques WHERE id = v_cot.embarque_id AND deleted_at IS NULL;
    IF FOUND THEN
      RETURN v_orphan_id;
    END IF;
    UPDATE public.cotizaciones SET embarque_id = NULL WHERE id = v_cot.id;
  END IF;

  -- FIX-21: idempotencia extendida — embarque huérfano (con cotizacion_id
  -- pero sin link inverso). Devolverlo en vez de duplicar.
  SELECT id INTO v_orphan_id
  FROM public.embarques
  WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;
  IF v_orphan_id IS NOT NULL THEN
    RETURN v_orphan_id;
  END IF;

  -- v13.303.42: no reservar expediente aquí. Se asigna en avanzar_estado_embarque
  -- cuando el borrador pasa a Confirmado.

  v_origen_code := COALESCE(
    NULLIF(substring(v_cot.origen  FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.origen),  ''),
    NULL
  );
  v_destino_code := COALESCE(
    NULLIF(substring(v_cot.destino FROM '\(([^)]+)\)'), ''),
    NULLIF(trim(v_cot.destino), ''),
    NULL
  );

  IF v_cot.modo = 'Marítimo' THEN
    v_puerto_o := v_origen_code;
    v_puerto_d := v_destino_code;
  ELSIF v_cot.modo = 'Aéreo' THEN
    v_aero_o := v_origen_code;
    v_aero_d := v_destino_code;
  ELSIF v_cot.modo = 'Terrestre' THEN
    v_ciudad_o := v_origen_code;
    v_ciudad_d := v_destino_code;
  END IF;

  v_tipo_cont_code := v_cot.tipo_contenedor;
  IF v_tipo_cont_code IS NOT NULL AND v_tipo_cont_code ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    SELECT code INTO v_tipo_cont_code FROM public.tipos_contenedor WHERE id = v_cot.tipo_contenedor::uuid;
    v_tipo_cont_code := COALESCE(v_tipo_cont_code, v_cot.tipo_contenedor);
  END IF;

  v_agente_id  := v_cot.agente_id;
  v_naviera_id := v_cot.naviera_id;
  IF (v_agente_id IS NULL OR v_naviera_id IS NULL) AND v_cot.tarifa_id IS NOT NULL THEN
    SELECT COALESCE(v_agente_id, t.agente_id), COALESCE(v_naviera_id, t.naviera_id)
      INTO v_agente_id, v_naviera_id
    FROM public.costeo_tarifas t WHERE t.id = v_cot.tarifa_id;
  END IF;

  IF v_agente_id  IS NOT NULL THEN SELECT nombre INTO v_agente_nombre  FROM public.costeo_agentes WHERE id = v_agente_id; END IF;
  IF v_naviera_id IS NOT NULL THEN SELECT name   INTO v_naviera_nombre FROM public.navieras       WHERE id = v_naviera_id; END IF;

  INSERT INTO public.embarques (
    cotizacion_id, expediente, cliente_id, cliente_nombre,
    estado, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, operador, tipo_carga, tipo_contenedor,
    organization_id,
    puerto_origen, puerto_destino,
    aeropuerto_origen, aeropuerto_destino,
    ciudad_origen, ciudad_destino,
    tarifa_id, tarifa_id_original, tarifa_id_aplicada,
    carta_garantia, dias_libres_destino,
    seguro, valor_seguro_usd,
    agente_id, naviera_id, agente, naviera
  )
  VALUES (
    v_cot.id, NULL, v_cot.cliente_id, v_cot.cliente_nombre,
    'Borrador'::estado_embarque, v_cot.modo, v_cot.tipo, v_cot.incoterm, v_cot.descripcion_mercancia,
    COALESCE(v_cot.peso_kg, 0), COALESCE(v_cot.volumen_m3, 0), COALESCE(v_cot.piezas, 0),
    v_cot.operador, v_cot.tipo_carga, v_tipo_cont_code,
    v_cot.organization_id,
    v_puerto_o, v_puerto_d,
    v_aero_o, v_aero_d,
    v_ciudad_o, v_ciudad_d,
    v_cot.tarifa_id, v_cot.tarifa_id, v_cot.tarifa_id,
    v_cot.carta_garantia, v_cot.dias_libres_destino,
    v_cot.seguro, v_cot.valor_seguro_usd,
    v_agente_id, v_naviera_id, v_agente_nombre, v_naviera_nombre
  )
  RETURNING id INTO v_embarque_id;

  v_num := GREATEST(1, COALESCE(v_cot.num_contenedores, 1));
  v_peso_each := COALESCE(v_cot.peso_kg, 0) / v_num;
  v_vol_each := COALESCE(v_cot.volumen_m3, 0) / v_num;
  v_piezas_base := COALESCE(v_cot.piezas, 0) / v_num;
  v_piezas_rest := COALESCE(v_cot.piezas, 0);

  v_target_ids := ARRAY[]::uuid[];
  FOR i IN 1..v_num LOOP
    IF i = v_num THEN v_piezas_este := v_piezas_rest;
    ELSE v_piezas_este := v_piezas_base; END IF;
    v_piezas_rest := v_piezas_rest - v_piezas_este;

    INSERT INTO public.embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden
    )
    VALUES (
      v_embarque_id, '', COALESCE(v_tipo_cont_code, ''), '',
      v_peso_each, v_vol_each, v_piezas_este, i
    )
    RETURNING id INTO v_cid;

    v_target_ids := array_append(v_target_ids, v_cid);
    IF i = 1 THEN v_first_hijo_id := v_cid; END IF;
  END LOOP;

  FOR v_costo IN SELECT * FROM public.cotizacion_costos WHERE cotizacion_id = v_cot.id AND deleted_at IS NULL LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
      VALUES (v_embarque_id, NULL, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              COALESCE(v_costo.proveedor, ''), v_cot.organization_id);
    ELSE
      FOREACH v_cid IN ARRAY v_target_ids LOOP
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
        VALUES (v_embarque_id, v_cid, v_costo.concepto, COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                COALESCE(v_costo.proveedor, ''), v_cot.organization_id);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(v_cot.conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(v_cot.conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        INSERT INTO public.conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id)
        VALUES (v_embarque_id, v_venta->>'descripcion',
                COALESCE((v_venta->>'cantidad')::integer, 1),
                COALESCE((v_venta->>'precio_unitario')::numeric, 0),
                CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                COALESCE((v_venta->>'aplica_iva')::boolean, false),
                COALESCE((v_venta->>'total')::numeric, 0),
                v_cot.organization_id);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.cotizaciones
  SET embarque_id = v_embarque_id, estado = 'En operación'::estado_cotizacion, updated_at = now()
  WHERE id = v_cot.id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES (v_cot.organization_id, auth.uid(), COALESCE(v_user_email, ''),
          'Cotizaciones', 'Borrador de embarque creado', v_cot.id, v_cot.folio,
          jsonb_build_object('embarque_id', v_embarque_id, 'expediente', NULL));

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace)
  SELECT v_cot.organization_id, om.user_id, 'cotizacion_borrador_embarque',
         'Borrador de embarque creado',
         'Se generó un borrador de embarque desde la cotización ' || v_cot.folio,
         '/embarques/' || v_embarque_id::text
  FROM public.organization_members om
  WHERE om.organization_id = v_cot.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role)
    AND om.user_id <> auth.uid();

  RETURN v_embarque_id;
END;
$function$;

-- ============================================================================
-- FIX-25: portal_responder_cotizacion — idempotencia + guard de soft delete +
-- tokens LC_* estables. Si el cliente ya respondió (Aceptada/Rechazada), se
-- devuelve la respuesta previa sin sobreescribir ni fallar.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(
  p_cotizacion_id uuid,
  p_respuesta text,
  p_comentario text DEFAULT ''::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cotizacion cotizaciones%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_comentario text;
  v_titulo text;
  v_mensaje text;
  v_tipo text;
BEGIN
  IF p_respuesta NOT IN ('Aceptada', 'Rechazada') THEN
    RAISE EXCEPTION 'LC_RESPUESTA_INVALIDA: respuesta debe ser Aceptada o Rechazada' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cotizacion
  FROM cotizaciones
  WHERE id = p_cotizacion_id
    AND cliente_id IN (SELECT current_user_client_ids())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización no encontrada o sin acceso' USING ERRCODE = 'P0002';
  END IF;

  -- FIX-25: rechazar cotizaciones borradas.
  IF v_cotizacion.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: esta cotización ya no está disponible' USING ERRCODE = 'P0001';
  END IF;

  -- FIX-25: idempotencia — si ya respondió, devolver estado actual sin tocar.
  IF v_cotizacion.estado IN ('Aceptada'::estado_cotizacion, 'Rechazada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RETURN jsonb_build_object(
      'id', p_cotizacion_id,
      'estado', v_cotizacion.estado::text,
      'fecha_respuesta', COALESCE(v_cotizacion.fecha_aceptacion, v_cotizacion.fecha_rechazo),
      'idempotente', true
    );
  END IF;

  IF v_cotizacion.estado <> 'Enviada'::estado_cotizacion THEN
    RAISE EXCEPTION 'LC_COT_NO_RESPONDIBLE: solo se pueden responder cotizaciones en estado Enviada (actual: %)', v_cotizacion.estado USING ERRCODE = 'P0001';
  END IF;

  v_comentario := NULLIF(trim(p_comentario), '');

  UPDATE cotizaciones
  SET estado = p_respuesta::estado_cotizacion,
      comentario_cliente = v_comentario,
      fecha_aceptacion = CASE WHEN p_respuesta = 'Aceptada' THEN v_now ELSE fecha_aceptacion END,
      fecha_rechazo    = CASE WHEN p_respuesta = 'Rechazada' THEN v_now ELSE fecha_rechazo END,
      updated_at = v_now
  WHERE id = p_cotizacion_id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_cotizacion.organization_id,
    auth.uid(),
    COALESCE(v_user_email, ''),
    CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END,
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_cotizacion.folio, ''),
    jsonb_build_object(
      'cotizacion_id', p_cotizacion_id,
      'folio', v_cotizacion.folio,
      'cliente_id', v_cotizacion.cliente_id,
      'cliente_nombre', v_cotizacion.cliente_nombre,
      'estado_anterior', v_cotizacion.estado,
      'estado_nuevo', p_respuesta,
      'comentario_cliente', v_comentario,
      'origen', 'portal_cliente'
    )
  );

  v_tipo := CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END;
  v_titulo := 'Cotización ' || COALESCE(v_cotizacion.folio, '') || ' ' ||
              CASE WHEN p_respuesta = 'Aceptada' THEN 'aceptada' ELSE 'rechazada' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_cotizacion.cliente_nombre, 'N/D') ||
               CASE WHEN v_comentario IS NOT NULL THEN E'\nComentario: ' || v_comentario ELSE '' END;

  INSERT INTO public.notificaciones_internas (
    organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id
  )
  SELECT
    v_cotizacion.organization_id,
    om.user_id,
    v_tipo,
    v_titulo,
    v_mensaje,
    '/cotizaciones/' || p_cotizacion_id::text,
    'cotizacion',
    p_cotizacion_id
  FROM public.organization_members om
  WHERE om.organization_id = v_cotizacion.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role);

  RETURN jsonb_build_object(
    'id', p_cotizacion_id,
    'estado', p_respuesta,
    'fecha_respuesta', v_now,
    'idempotente', false
  );
END;
$function$;