-- C21 — Conversión repetida no debe mutar un embarque existente.
CREATE OR REPLACE FUNCTION public.crear_embarque_borrador_desde_cotizacion(p_cotizacion_id uuid, p_decision text DEFAULT 'sin_cambios'::text, p_tarifa_id_aplicada uuid DEFAULT NULL::uuid, p_delta_jsonb jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_embarque_id UUID; v_cot public.cotizaciones%ROWTYPE; v_ya_decidido BOOLEAN; v_rev jsonb;
        v_existente UUID; v_caller_org UUID; v_is_super BOOLEAN;
BEGIN
  IF p_decision NOT IN ('sin_cambios','mantenida_por_operaciones','refrescada','sustituida','reaprobada_ventas') THEN
    RAISE EXCEPTION 'Decisión de tarifa inválida: %', p_decision USING ERRCODE='P0001';
  END IF;
  -- C21: FOR UPDATE serializa dos llamadas concurrentes sobre la misma cotización.
  SELECT * INTO v_cot FROM public.cotizaciones WHERE id=p_cotizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;

  -- C21 (v13.823.380) — Si la cotización YA está vinculada a un embarque vivo,
  -- esta llamada es un reintento: devolvemos el embarque existente SIN
  -- revalidar tarifa, sin sellar una decisión tardía y sin reaplicar costos
  -- (`_embarque_aplicar_tarifa_decidida` toca conceptos_costo pendientes de una
  -- operación que puede estar Confirmada, En tránsito o Cerrada).
  -- No es un early return "libre": se repiten los mismos controles de acceso
  -- que aplica `crear_embarque_borrador_core`.
  SELECT e.id INTO v_existente
    FROM public.embarques e
   WHERE e.deleted_at IS NULL
     AND (e.id = v_cot.embarque_id OR e.cotizacion_id = v_cot.id)
   ORDER BY e.created_at ASC
   LIMIT 1;

  IF v_existente IS NOT NULL THEN
    v_caller_org := public.current_user_org_id();
    v_is_super := public.has_role(auth.uid(), 'super_admin'::app_role);
    IF NOT v_is_super AND v_cot.organization_id IS DISTINCT FROM v_caller_org THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE='42501';
    END IF;
    IF NOT (v_is_super
            OR public.has_role(auth.uid(), 'admin_org'::app_role)
            OR public.has_role(auth.uid(), 'admin'::app_role)
            OR public.has_role(auth.uid(), 'gerente_operaciones'::app_role)
            OR public.has_role(auth.uid(), 'coordinador_logistico'::app_role)
            OR public.has_role(auth.uid(), 'operador'::app_role)) THEN
      RAISE EXCEPTION 'LC_NO_AUTORIZADO: solo administración u operación pueden crear el borrador' USING ERRCODE='42501';
    END IF;
    RETURN v_existente;
  END IF;

  -- v13.823.316: la vigencia limita la RESPUESTA del cliente, no la ejecución.
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

  -- v13.823.32: repetir la conversión NO debe pisar el snapshot histórico.
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

-- C22 — `aplica_iva = false` nunca debe persistir tasa > 0 (alta y edición).
CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(p_embarque_id uuid, p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  cv jsonb;
  cc jsonb;
  v_incoming_venta_ids uuid[];
  v_incoming_costo_ids uuid[];
  v_new_id uuid;
  v_current_updated_at timestamptz;
  v_cliente_actual uuid;
BEGIN
  SELECT organization_id, updated_at, cliente_id
    INTO v_org_id, v_current_updated_at, v_cliente_actual
    FROM embarques
   WHERE id = p_embarque_id
   FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);
  IF p_expected_updated_at IS NOT NULL
     AND v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: otro usuario modificó este embarque. Recarga y vuelve a intentar.'
      USING ERRCODE = '40001',
            HINT = json_build_object(
              'server_updated_at', v_current_updated_at,
              'client_expected_updated_at', p_expected_updated_at
            )::text;
  END IF;
  PERFORM public._assert_relaciones_embarque(
    v_org_id,
    COALESCE(NULLIF(p_embarque->>'cliente_id','')::uuid, v_cliente_actual),
    NULLIF(p_embarque->>'cotizacion_id','')::uuid,
    p_conceptos_costo
  );
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;
  UPDATE embarques SET
    cliente_id = COALESCE((p_embarque->>'cliente_id')::uuid, cliente_id),
    cliente_nombre = COALESCE(p_embarque->>'cliente_nombre', cliente_nombre),
    modo = COALESCE((p_embarque->>'modo')::modo_transporte, modo),
    tipo = COALESCE((p_embarque->>'tipo')::tipo_operacion, tipo),
    incoterm = COALESCE((p_embarque->>'incoterm')::incoterm, incoterm),
    bl_master = CASE WHEN p_embarque ? 'bl_master' THEN p_embarque->>'bl_master' ELSE bl_master END,
    bl_house = CASE WHEN p_embarque ? 'bl_house' THEN p_embarque->>'bl_house' ELSE bl_house END,
    naviera = CASE WHEN p_embarque ? 'naviera' THEN p_embarque->>'naviera' ELSE naviera END,
    naviera_id = CASE WHEN p_embarque ? 'naviera_id' THEN NULLIF(p_embarque->>'naviera_id','')::uuid ELSE naviera_id END,
    puerto_origen = CASE WHEN p_embarque ? 'puerto_origen' THEN p_embarque->>'puerto_origen' ELSE puerto_origen END,
    puerto_destino = CASE WHEN p_embarque ? 'puerto_destino' THEN p_embarque->>'puerto_destino' ELSE puerto_destino END,
    aeropuerto_origen = CASE WHEN p_embarque ? 'aeropuerto_origen' THEN p_embarque->>'aeropuerto_origen' ELSE aeropuerto_origen END,
    aeropuerto_destino = CASE WHEN p_embarque ? 'aeropuerto_destino' THEN p_embarque->>'aeropuerto_destino' ELSE aeropuerto_destino END,
    ciudad_origen = CASE WHEN p_embarque ? 'ciudad_origen' THEN p_embarque->>'ciudad_origen' ELSE ciudad_origen END,
    ciudad_destino = CASE WHEN p_embarque ? 'ciudad_destino' THEN p_embarque->>'ciudad_destino' ELSE ciudad_destino END,
    aerolinea = CASE WHEN p_embarque ? 'aerolinea' THEN p_embarque->>'aerolinea' ELSE aerolinea END,
    transportista = CASE WHEN p_embarque ? 'transportista' THEN p_embarque->>'transportista' ELSE transportista END,
    agente = CASE WHEN p_embarque ? 'agente' THEN p_embarque->>'agente' ELSE agente END,
    agente_id = CASE WHEN p_embarque ? 'agente_id' THEN NULLIF(p_embarque->>'agente_id','')::uuid ELSE agente_id END,
    shipper = COALESCE(p_embarque->>'shipper', shipper),
    consignatario = COALESCE(p_embarque->>'consignatario', consignatario),
    descripcion_mercancia = COALESCE(p_embarque->>'descripcion_mercancia', descripcion_mercancia),
    tipo_carga = COALESCE(p_embarque->>'tipo_carga', tipo_carga),
    tipo_servicio = CASE WHEN p_embarque ? 'tipo_servicio' THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE tipo_servicio END,
    operador = COALESCE(p_embarque->>'operador', operador),
    contenedor = CASE WHEN p_embarque ? 'contenedor' THEN p_embarque->>'contenedor' ELSE contenedor END,
    tipo_contenedor = CASE WHEN p_embarque ? 'tipo_contenedor' THEN p_embarque->>'tipo_contenedor' ELSE tipo_contenedor END,
    peso_kg = COALESCE((p_embarque->>'peso_kg')::numeric, peso_kg),
    volumen_m3 = COALESCE((p_embarque->>'volumen_m3')::numeric, volumen_m3),
    piezas = COALESCE((p_embarque->>'piezas')::int, piezas),
    mawb = CASE WHEN p_embarque ? 'mawb' THEN p_embarque->>'mawb' ELSE mawb END,
    hawb = CASE WHEN p_embarque ? 'hawb' THEN p_embarque->>'hawb' ELSE hawb END,
    carta_porte = CASE WHEN p_embarque ? 'carta_porte' THEN p_embarque->>'carta_porte' ELSE carta_porte END,
    etd = CASE WHEN p_embarque ? 'etd' THEN (p_embarque->>'etd')::date ELSE etd END,
    eta = CASE WHEN p_embarque ? 'eta' THEN (p_embarque->>'eta')::date ELSE eta END,
    tipo_cambio_usd = COALESCE(NULLIF(NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric, 0), tipo_cambio_usd),
    tipo_cambio_eur = COALESCE(NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0), tipo_cambio_eur),
    msds_archivo = CASE WHEN p_embarque ? 'msds_archivo' THEN p_embarque->>'msds_archivo' ELSE msds_archivo END,
    updated_at = now()
  WHERE id = p_embarque_id;
  v_incoming_venta_ids := ARRAY(
    SELECT (elem->>'id')::uuid
      FROM jsonb_array_elements(p_conceptos_venta) elem
     WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> ''
  );
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    IF cv ? 'id' AND cv->>'id' IS NOT NULL AND cv->>'id' <> '' THEN
      UPDATE conceptos_venta SET
        descripcion = COALESCE(cv->>'descripcion', descripcion),
        cantidad = COALESCE((cv->>'cantidad')::numeric, cantidad),
        precio_unitario = COALESCE((cv->>'precio_unitario')::numeric, precio_unitario),
        moneda = COALESCE((cv->>'moneda')::moneda, moneda),
        total = COALESCE((cv->>'total')::numeric, total),
        aplica_iva = COALESCE((cv->>'aplica_iva')::boolean, aplica_iva),
        -- C22 (v13.823.380): una línea exenta jamás conserva tasa > 0, ni
        -- cuando el payload omite la tasa ni cuando arrastra una legacy (0.16).
        -- La columna es NOT NULL, así que la convención es 0, no NULL.
        tasa_iva_aplicada = CASE
          WHEN COALESCE((cv->>'aplica_iva')::boolean, aplica_iva) = false THEN 0
          ELSE COALESCE((cv->>'tasa_iva_aplicada')::numeric, tasa_iva_aplicada)
        END
      WHERE id = (cv->>'id')::uuid
        AND embarque_id = p_embarque_id
        AND estado_facturacion IN ('pendiente', 'en_proforma');
    ELSE
      INSERT INTO conceptos_venta (
        embarque_id, descripcion, cantidad, precio_unitario, moneda, total, contenedor_id,
        aplica_iva, tasa_iva_aplicada, organization_id
      ) VALUES (
        p_embarque_id,
        cv->>'descripcion',
        COALESCE((cv->>'cantidad')::numeric, 1),
        COALESCE((cv->>'precio_unitario')::numeric, 0),
        COALESCE((cv->>'moneda')::moneda, 'MXN'::moneda),
        COALESCE((cv->>'total')::numeric, 0),
        NULLIF(cv->>'contenedor_id','')::uuid,
        COALESCE((cv->>'aplica_iva')::boolean, false),
        -- C22: alta coherente — exento => 0; gravado => tasa explícita o el
        -- fallback canónico vigente (0.16).
        CASE
          WHEN COALESCE((cv->>'aplica_iva')::boolean, false) = false THEN 0
          ELSE COALESCE((cv->>'tasa_iva_aplicada')::numeric, 0.16)
        END,
        v_org_id
      )
      RETURNING id INTO v_new_id;
      v_incoming_venta_ids := array_append(v_incoming_venta_ids, v_new_id);
    END IF;
  END LOOP;
  UPDATE conceptos_venta
     SET deleted_at = now()
   WHERE embarque_id = p_embarque_id
     AND deleted_at IS NULL
     AND estado_facturacion = 'pendiente'
     AND NOT (id = ANY(v_incoming_venta_ids));
  v_incoming_costo_ids := ARRAY(
    SELECT (elem->>'id')::uuid
      FROM jsonb_array_elements(p_conceptos_costo) elem
     WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> ''
  );
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    IF cc ? 'id' AND cc->>'id' IS NOT NULL AND cc->>'id' <> '' THEN
      UPDATE conceptos_costo SET
        concepto = COALESCE(cc->>'concepto', concepto),
        proveedor_nombre = CASE
          WHEN cc ? 'proveedor_nombre' AND COALESCE(btrim(cc->>'proveedor_nombre'), '') <> ''
            THEN cc->>'proveedor_nombre'
          ELSE proveedor_nombre
        END,
        proveedor_id = CASE
          WHEN cc ? 'proveedor_id' AND cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> ''
            THEN (cc->>'proveedor_id')::uuid
          ELSE proveedor_id
        END,
        moneda = COALESCE((cc->>'moneda')::moneda, moneda),
        monto = COALESCE((cc->>'monto')::numeric, monto)
      WHERE id = (cc->>'id')::uuid
        AND embarque_id = p_embarque_id
        AND COALESCE(estado_liquidacion, 'Pendiente') <> 'Pagado';
    ELSE
      INSERT INTO conceptos_costo (
        embarque_id, concepto, proveedor_id, proveedor_nombre, moneda, monto, contenedor_id, organization_id
      ) VALUES (
        p_embarque_id,
        cc->>'concepto',
        NULLIF(cc->>'proveedor_id','')::uuid,
        COALESCE(cc->>'proveedor_nombre',''),
        COALESCE((cc->>'moneda')::moneda, 'MXN'::moneda),
        COALESCE((cc->>'monto')::numeric, 0),
        NULLIF(cc->>'contenedor_id','')::uuid,
        v_org_id
      )
      RETURNING id INTO v_new_id;
      v_incoming_costo_ids := array_append(v_incoming_costo_ids, v_new_id);
    END IF;
  END LOOP;
  UPDATE conceptos_costo
     SET deleted_at = now()
   WHERE embarque_id = p_embarque_id
     AND deleted_at IS NULL
     AND COALESCE(estado_liquidacion, 'Pendiente') <> 'Pagado'
     AND NOT EXISTS (
       SELECT 1 FROM public.proveedor_facturas_conceptos pfc
        WHERE pfc.concepto_costo_id = conceptos_costo.id
     )
     AND NOT (id = ANY(v_incoming_costo_ids));
  v_resp := jsonb_build_object('ok', true, 'embarque_id', p_embarque_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid, timestamptz) TO authenticated, service_role;

-- C23/C24 — Sincronización de contenedores: validar IDs antes de mutar y no
-- soft-borrar un hijo con conceptos vivos.
CREATE OR REPLACE FUNCTION public.sincronizar_contenedores_embarque(p_embarque_id uuid, p_contenedores jsonb)
 RETURNS SETOF embarque_contenedores
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_input record;
  v_ids_conservados uuid[];
  v_orden integer := 0;
  v_ajenos integer;
  v_dups integer;
  v_bloqueados text;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM public.embarques
  WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado: %', p_embarque_id;
  END IF;

  PERFORM public._assert_writer(v_org_id);

  SELECT COALESCE(array_agg((elem->>'id')::uuid), ARRAY[]::uuid[]) INTO v_ids_conservados
  FROM jsonb_array_elements(p_contenedores) AS elem
  WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> '';

  -- C23 (v13.823.380): un id repetido o que no sea hijo VIVO de este embarque
  -- hacía que el borrado lógico barriera todos los contenedores activos y el
  -- UPDATE posterior no afectara ninguna fila, sin error. Se valida ANTES de
  -- cualquier mutación.
  SELECT count(*) INTO v_dups
  FROM (SELECT t.id FROM unnest(v_ids_conservados) AS t(id) GROUP BY t.id HAVING count(*) > 1) d;
  IF v_dups > 0 THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_ID_DUPLICADO: la lista de contenedores repite el mismo registro; revisa la captura'
      USING ERRCODE='P0001';
  END IF;

  SELECT count(*) INTO v_ajenos
  FROM unnest(v_ids_conservados) AS t(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.embarque_contenedores c
     WHERE c.id = t.id AND c.embarque_id = p_embarque_id AND c.deleted_at IS NULL
  );
  IF v_ajenos > 0 THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_ID_INVALIDO: uno o más contenedores de la lista no pertenecen a este embarque o ya fueron eliminados; recarga el embarque e intenta de nuevo'
      USING ERRCODE='P0001';
  END IF;

  -- C24 (v13.823.380): quitar un contenedor con costos o ventas vivos dejaba
  -- conceptos apuntando a un contenedor eliminado. Se bloquea toda la
  -- operación (atómica) y se nombra el contenedor a resolver primero.
  SELECT string_agg(DISTINCT COALESCE(NULLIF(btrim(c.numero_contenedor), ''), 'sin número'), ', ')
    INTO v_bloqueados
  FROM public.embarque_contenedores c
  WHERE c.embarque_id = p_embarque_id
    AND c.deleted_at IS NULL
    AND NOT (c.id = ANY(v_ids_conservados))
    AND (
      EXISTS (SELECT 1 FROM public.conceptos_costo cc
               WHERE cc.contenedor_id = c.id AND cc.deleted_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.conceptos_venta cv
                  WHERE cv.contenedor_id = c.id AND cv.deleted_at IS NULL)
    );
  IF v_bloqueados IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONTENEDOR_CON_CONCEPTOS: el contenedor % tiene costos o ventas activos; reasigna o elimina esos conceptos antes de quitarlo', v_bloqueados
      USING ERRCODE='P0001';
  END IF;

  UPDATE public.embarque_contenedores
  SET deleted_at = now()
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
    AND NOT (id = ANY(v_ids_conservados));

  FOR v_input IN
    SELECT
      (elem->>'id') AS id_str,
      (elem->>'numero_contenedor') AS numero_contenedor,
      (elem->>'tipo_contenedor') AS tipo_contenedor,
      NULLIF(elem->>'bl_house', '') AS bl_house,
      NULLIF(elem->>'peso_kg', '')::numeric AS peso_kg,
      NULLIF(elem->>'volumen_m3', '')::numeric AS volumen_m3,
      NULLIF(elem->>'piezas', '')::integer AS piezas,
      COALESCE(NULLIF(elem->>'orden', '')::integer, 0) AS orden,
      ord.rn AS pos
    FROM jsonb_array_elements(p_contenedores) WITH ORDINALITY AS ord(elem, rn)
    ORDER BY ord.rn
  LOOP
    v_orden := COALESCE(NULLIF(v_input.orden, 0), v_input.pos::integer);

    IF v_input.id_str IS NOT NULL AND v_input.id_str <> '' THEN
      UPDATE public.embarque_contenedores
      SET numero_contenedor = v_input.numero_contenedor,
          tipo_contenedor = v_input.tipo_contenedor,
          bl_house = v_input.bl_house,
          peso_kg = v_input.peso_kg,
          volumen_m3 = v_input.volumen_m3,
          piezas = v_input.piezas,
          orden = v_orden
      WHERE id = v_input.id_str::uuid
        AND embarque_id = p_embarque_id;
    ELSE
      INSERT INTO public.embarque_contenedores (
        embarque_id, numero_contenedor, tipo_contenedor, bl_house,
        peso_kg, volumen_m3, piezas, orden
      ) VALUES (
        p_embarque_id, v_input.numero_contenedor, v_input.tipo_contenedor, v_input.bl_house,
        v_input.peso_kg, v_input.volumen_m3, v_input.piezas, v_orden
      );
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT *
  FROM public.embarque_contenedores
  WHERE embarque_id = p_embarque_id
    AND deleted_at IS NULL
  ORDER BY orden ASC, created_at ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.sincronizar_contenedores_embarque(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sincronizar_contenedores_embarque(uuid, jsonb) TO authenticated, service_role;

-- C25 — Fusión de proformas: rechazar fuentes consolidadas, lotes mezclados y
-- plazos de crédito incompatibles ANTES de crear la factura.
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(p_proforma_ids uuid[], p_serie_id uuid, p_metodo_pago text, p_forma_pago text, p_uso_cfdi text, p_dias_credito integer DEFAULT NULL::integer, p_notas text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb; v_count int; v_first public.proformas;
  v_org uuid; v_caller_org uuid; v_cliente public.clientes;
  v_serie public.factura_series;
  v_subtotal_usd numeric := 0; v_iva_usd numeric := 0; v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0; v_iva_mxn numeric := 0; v_total_mxn numeric := 0;
  v_distinct_cli int; v_distinct_org int; v_distinct_tipo int; v_distinct_dias int;
  v_factura_ids uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid; v_factura_usd_id uuid;
  v_numero_tmp text; v_embarque_ids uuid[];
  v_dias int;
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL AND (v_cached ? 'factura_ids') THEN
    RETURN QUERY SELECT * FROM public.facturas
      WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_cached->'factura_ids'))::uuid[])
        AND deleted_at IS NULL;
    RETURN;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  PERFORM public.convertir_proformas_a_factura_check_embarque_vivo(p_proforma_ids);

  v_caller_org := public.current_user_org_id();

  IF NOT (
    public.es_escritor_financiero(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL FOR UPDATE;

  SELECT count(*), count(DISTINCT organization_id), count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND estado_proforma = 'facturada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas' USING ERRCODE='P0002';
  END IF;

  -- v13.823.279 — Candado de aceptación del cliente.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND deleted_at IS NULL
      AND coalesce(estado_cliente, 'pendiente') <> 'aceptada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_REQUIERE_ACEPTACION: una o más proformas no están aceptadas por el cliente (pendiente o rechazada)' USING ERRCODE='P0002';
  END IF;

  -- C25 (v13.823.380) — Una proforma FUENTE ya consolidada repuntó sus
  -- conceptos a la proforma consolidada: facturarla emitiría una factura sin
  -- líneas y la marcaría facturada.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL
      AND estado_revision = 'consolidada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_FUENTE_CONSOLIDADA: una o más proformas ya fueron consolidadas; factura la proforma consolidada, no sus fuentes' USING ERRCODE='P0002';
  END IF;

  -- C25 — La rama de conceptos (consolidados vs conceptos_venta) se elegía con
  -- `v_first.es_consolidada` para TODO el lote: mezclar tipos podía omitir
  -- líneas y marcar todas las proformas como facturadas.
  SELECT count(DISTINCT es_consolidada) INTO v_distinct_tipo
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  IF COALESCE(v_distinct_tipo, 1) > 1 THEN
    RAISE EXCEPTION 'LC_PROFORMA_MEZCLA_CONSOLIDADA: no puedes fusionar proformas consolidadas con proformas individuales; convierte cada tipo por separado' USING ERRCODE='P0001';
  END IF;

  -- C25 — Condiciones de pago: sin plazo explícito, una fusión con plazos
  -- distintos elegía en silencio el de la proforma más antigua.
  IF array_length(p_proforma_ids, 1) > 1 AND COALESCE(NULLIF(p_dias_credito, 0), NULL) IS NULL THEN
    SELECT count(DISTINCT COALESCE(dias_credito, -1)) INTO v_distinct_dias
    FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;
    IF COALESCE(v_distinct_dias, 1) > 1 THEN
      RAISE EXCEPTION 'LC_PROFORMA_DIAS_CREDITO_DISTINTOS: las proformas tienen plazos de crédito distintos; iguala el plazo o indica el plazo de la factura' USING ERRCODE='P0001';
    END IF;
  END IF;

  SELECT * INTO v_first FROM public.proformas
    WHERE id = ANY(p_proforma_ids) ORDER BY created_at ASC LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

  v_dias := COALESCE(NULLIF(p_dias_credito, 0), v_first.dias_credito, v_cliente.dias_credito, p_dias_credito, 0);

  SELECT array_agg(DISTINCT embarque_id) INTO v_embarque_ids
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND embarque_id IS NOT NULL;

  IF v_first.es_consolidada THEN
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN total ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN total ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.proforma_conceptos_consolidados
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.conceptos_venta
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  IF v_subtotal_mxn > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'MXN'::public.moneda, 1,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_mxn_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_mxn_id, p_proforma_ids, v_org, v_first.es_consolidada, 'MXN'::public.moneda
    );

    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_mxn, v_iva_mxn
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_mxn_id AND deleted_at IS NULL;
    v_subtotal_mxn := round(v_subtotal_mxn, 2);
    v_iva_mxn := round(v_iva_mxn, 2);
    v_total_mxn := v_subtotal_mxn + v_iva_mxn;

    UPDATE public.facturas
    SET subtotal = v_subtotal_mxn, iva = v_iva_mxn, total = v_total_mxn
    WHERE id = v_factura_mxn_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_mxn_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF v_subtotal_usd > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'USD'::public.moneda, NULL,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_usd_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_usd_id, p_proforma_ids, v_org, v_first.es_consolidada, 'USD'::public.moneda
    );

    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_usd, v_iva_usd
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_usd_id AND deleted_at IS NULL;
    v_subtotal_usd := round(v_subtotal_usd, 2);
    v_iva_usd := round(v_iva_usd, 2);
    v_total_usd := v_subtotal_usd + v_iva_usd;

    UPDATE public.facturas
    SET subtotal = v_subtotal_usd, iva = v_iva_usd, total = v_total_usd
    WHERE id = v_factura_usd_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_usd_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF array_length(v_factura_ids, 1) > 0 THEN
    UPDATE public.proformas
    SET estado_proforma = 'facturada', fecha_facturacion = v_hoy_mx
    WHERE id = ANY(p_proforma_ids) AND estado_proforma <> 'facturada';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_store(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;

REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated, service_role;