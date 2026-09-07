-- R179-01 — Persistir el tratamiento fiscal (aplica_iva / tasa_iva_aplicada) de los
-- conceptos de venta en `crear_embarque_completo` y `actualizar_embarque_completo`.
-- Aplicada el 2026-09-07 con autorización explícita del usuario (registro del
-- backend: 20260907082738). Sin backfill, sin cambios de firma, ACL, RLS ni triggers.
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
        tasa_iva_aplicada = COALESCE((cv->>'tasa_iva_aplicada')::numeric, tasa_iva_aplicada)
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
        COALESCE((cv->>'tasa_iva_aplicada')::numeric, 0.16),
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

CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid, p_contenedores jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  v_cot_id uuid;
  cv jsonb; cc jsonb; doc jsonb; ct jsonb;
BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization context for caller'; END IF;
  PERFORM public._assert_writer(v_org_id);
  v_cot_id := NULLIF(p_embarque->>'cotizacion_id','')::uuid;
  PERFORM public._assert_relaciones_embarque(
    v_org_id,
    NULLIF(p_embarque->>'cliente_id','')::uuid,
    v_cot_id,
    p_conceptos_costo
  );
  -- Una cotización sólo puede producir un embarque vivo (bloqueo FOR UPDATE).
  PERFORM public._assert_cotizacion_convertible(v_cot_id, v_org_id);
  v_resp := public.idempotency_claim(p_request_id, 'crear_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;
  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente, naviera_id, agente_id,
    bl_master, bl_house, tipo_servicio, contenedor, tipo_contenedor,
    aeropuerto_origen, aeropuerto_destino, aerolinea,
    mawb, hawb, ciudad_origen, ciudad_destino,
    transportista, carta_porte, etd, eta,
    tipo_cambio_usd, tipo_cambio_eur,
    tipo_carga, msds_archivo, operador, organization_id, cotizacion_id
  ) VALUES (
    nuevo_id, p_embarque->>'expediente', (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre',''),
    (p_embarque->>'modo')::modo_transporte, (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper',''), COALESCE(p_embarque->>'consignatario',''),
    COALESCE((p_embarque->>'incoterm')::incoterm,'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia',''),
    COALESCE((p_embarque->>'peso_kg')::numeric,0),
    COALESCE((p_embarque->>'volumen_m3')::numeric,0),
    COALESCE((p_embarque->>'piezas')::int,0),
    p_embarque->>'puerto_origen', p_embarque->>'puerto_destino',
    p_embarque->>'naviera', p_embarque->>'agente',
    NULLIF(p_embarque->>'naviera_id','')::uuid, NULLIF(p_embarque->>'agente_id','')::uuid,
    p_embarque->>'bl_master', p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo END,
    p_embarque->>'contenedor', p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen', p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea', p_embarque->>'mawb', p_embarque->>'hawb',
    p_embarque->>'ciudad_origen', p_embarque->>'ciudad_destino',
    p_embarque->>'transportista', p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date END,
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_usd','')::numeric, 0),
    NULLIF(NULLIF(p_embarque->>'tipo_cambio_eur','')::numeric, 0),
    COALESCE(p_embarque->>'tipo_carga','Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador',''),
    v_org_id,
    v_cot_id
  );
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total,
                                 aplica_iva, tasa_iva_aplicada, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::numeric, (cv->>'precio_unitario')::numeric,
            (cv->>'moneda')::moneda, (cv->>'total')::numeric,
            COALESCE((cv->>'aplica_iva')::boolean, false),
            COALESCE((cv->>'tasa_iva_aplicada')::numeric, 0.16),
            v_org_id);
  END LOOP;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (nuevo_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre',''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> '' THEN (cc->>'proveedor_id')::uuid END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;
  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos) LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
    VALUES (nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo',''),
      CASE WHEN NULLIF(doc->>'archivo','') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
      v_org_id);
  END LOOP;
  FOR ct IN SELECT * FROM jsonb_array_elements(COALESCE(p_contenedores, '[]'::jsonb)) LOOP
    INSERT INTO embarque_contenedores (
      embarque_id, numero_contenedor, tipo_contenedor, bl_house,
      peso_kg, volumen_m3, piezas, orden, organization_id
    ) VALUES (
      nuevo_id,
      COALESCE(ct->>'numero_contenedor',''),
      COALESCE(ct->>'tipo_contenedor',''),
      NULLIF(ct->>'bl_house',''),
      COALESCE(NULLIF(ct->>'peso_kg','')::numeric, 0),
      COALESCE(NULLIF(ct->>'volumen_m3','')::numeric, 0),
      COALESCE(NULLIF(ct->>'piezas','')::int, 0),
      COALESCE(NULLIF(ct->>'orden','')::int, 1),
      v_org_id
    );
  END LOOP;
  INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
  VALUES (nuevo_id, 'Embarque creado', 'sistema', v_org_id);
  v_resp := jsonb_build_object('id', nuevo_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$$;

REVOKE ALL ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) TO authenticated, service_role;
