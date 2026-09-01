DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
     WHERE c.conname = 'idempotency_keys_pkey'
       AND c.conrelid = 'public.idempotency_keys'::regclass
       AND (SELECT count(*) FROM unnest(c.conkey)) = 1
  ) THEN
    ALTER TABLE public.idempotency_keys DROP CONSTRAINT idempotency_keys_pkey;
    ALTER TABLE public.idempotency_keys
      ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (key, organization_id, user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.idempotency_claim(_key uuid, _fn text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted boolean;
  v_existing jsonb;
  v_fn_existente text;
  v_org uuid;
  v_user uuid;
BEGIN
  IF _key IS NULL THEN RETURN NULL; END IF;
  v_org := COALESCE(current_user_org_id(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_user := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  INSERT INTO public.idempotency_keys(key, organization_id, user_id, fn, hits)
  VALUES (_key, v_org, v_user, _fn, 0)
  ON CONFLICT (key, organization_id, user_id) DO UPDATE
    SET hits = public.idempotency_keys.hits + 1
  RETURNING (xmax = 0), response, fn INTO v_inserted, v_existing, v_fn_existente;

  IF v_inserted THEN RETURN NULL; END IF;

  IF v_fn_existente IS DISTINCT FROM _fn THEN
    RAISE EXCEPTION 'LC_IDEMPOTENCIA_FN_DISTINTA: el identificador de la operación ya se usó en otra operación (%). Reintenta generando uno nuevo.', v_fn_existente
      USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE(v_existing, jsonb_build_object('__idempotency_pending', true));
END;
$function$;

REVOKE ALL ON FUNCTION public.idempotency_claim(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.idempotency_claim(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.idempotency_store(_key uuid, _response jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_user uuid;
BEGIN
  IF _key IS NULL THEN RETURN; END IF;
  v_org := COALESCE(current_user_org_id(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_user := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  UPDATE public.idempotency_keys
     SET response = _response
   WHERE key = _key
     AND organization_id = v_org
     AND user_id = v_user;
END;
$function$;

REVOKE ALL ON FUNCTION public.idempotency_store(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.idempotency_store(uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON TABLE public.idempotency_keys FROM anon;
REVOKE DELETE ON TABLE public.idempotency_keys FROM authenticated;

CREATE OR REPLACE FUNCTION public.credito_en_uso_mxn(p_cliente_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric := 0;
  v_saldo numeric;
  f record;
BEGIN
  FOR f IN
    SELECT id, COALESCE(total, 0) AS total, moneda::text AS moneda, tipo_cambio AS tc
      FROM public.facturas
     WHERE cliente_id = p_cliente_id
       AND deleted_at IS NULL
       AND estado::text IN ('Emitida', 'Vencida', 'Parcialmente pagada')
  LOOP
    SELECT GREATEST(
             0,
             f.total
               - COALESCE((SELECT SUM(p.monto_aplicado_factura)
                             FROM public.pagos_factura p
                            WHERE p.factura_id = f.id AND p.deleted_at IS NULL), 0)
               - public.nc_aplicadas_en_moneda_factura(f.id)
           )
      INTO v_saldo;

    IF f.moneda = 'MXN' THEN
      v_total := v_total + v_saldo;
    ELSIF v_saldo > 0 THEN
      IF f.tc IS NULL OR f.tc < 5 OR f.tc > 40 THEN
        RAISE EXCEPTION 'LC_CREDITO_TC_INVALIDO: la factura % está en % con un tipo de cambio no válido (%); no se puede calcular el crédito en uso.', f.id, f.moneda, COALESCE(f.tc, 0)
          USING ERRCODE = '22023';
      END IF;
      v_total := v_total + (v_saldo * f.tc);
    END IF;
  END LOOP;

  RETURN ROUND(COALESCE(v_total, 0), 2);
END;
$function$;

REVOKE ALL ON FUNCTION public.credito_en_uso_mxn(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credito_en_uso_mxn(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._assert_relaciones_embarque(p_org uuid, p_cliente_id uuid, p_cotizacion_id uuid, p_conceptos_costo jsonb)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cot record;
  v_prov uuid;
BEGIN
  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clientes c
     WHERE c.id = p_cliente_id AND c.organization_id = p_org AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_EMB_CLIENTE_INVALIDO: el cliente no existe en tu organización o fue eliminado.'
      USING ERRCODE = '42501';
  END IF;

  IF p_cotizacion_id IS NOT NULL THEN
    SELECT id, cliente_id, estado INTO v_cot
      FROM public.cotizaciones
     WHERE id = p_cotizacion_id AND organization_id = p_org AND deleted_at IS NULL;
    IF v_cot.id IS NULL THEN
      RAISE EXCEPTION 'LC_EMB_COTIZACION_INVALIDA: la cotización no existe en tu organización o fue eliminada.'
        USING ERRCODE = '42501';
    END IF;
    IF p_cliente_id IS NOT NULL AND v_cot.cliente_id IS NOT NULL
       AND v_cot.cliente_id <> p_cliente_id THEN
      RAISE EXCEPTION 'LC_EMB_COTIZACION_CLIENTE: la cotización pertenece a otro cliente.'
        USING ERRCODE = '42501';
    END IF;
    IF v_cot.estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
      RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_cot.estado
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  FOR v_prov IN
    SELECT DISTINCT NULLIF(elem->>'proveedor_id', '')::uuid
      FROM jsonb_array_elements(COALESCE(p_conceptos_costo, '[]'::jsonb)) elem
     WHERE NULLIF(elem->>'proveedor_id', '') IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.proveedores pr
       WHERE pr.id = v_prov AND pr.organization_id = p_org AND pr.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'LC_EMB_PROVEEDOR_INVALIDO: un proveedor de los costos no existe en tu organización o fue eliminado.'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_relaciones_embarque(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_relaciones_embarque(uuid, uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid, p_contenedores jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid; v_resp jsonb;
  cv jsonb; cc jsonb; doc jsonb; ct jsonb;
BEGIN
  PERFORM public._assert_medidas_embarque(p_embarque);
  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization context for caller'; END IF;
  PERFORM public._assert_writer(v_org_id);
  PERFORM public._assert_relaciones_embarque(
    v_org_id,
    NULLIF(p_embarque->>'cliente_id','')::uuid,
    NULLIF(p_embarque->>'cotizacion_id','')::uuid,
    p_conceptos_costo
  );
  v_resp := public.idempotency_claim(p_request_id, 'crear_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;
  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente,
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
    CASE WHEN p_embarque->>'cotizacion_id' IS NOT NULL AND p_embarque->>'cotizacion_id' <> '' THEN (p_embarque->>'cotizacion_id')::uuid END
  );
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::numeric, (cv->>'precio_unitario')::numeric,
            (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
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
$function$;

REVOKE ALL ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb, uuid, jsonb) TO authenticated, service_role;

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
        total = COALESCE((cv->>'total')::numeric, total)
      WHERE id = (cv->>'id')::uuid
        AND embarque_id = p_embarque_id
        AND estado_facturacion IN ('pendiente', 'en_proforma');
    ELSE
      INSERT INTO conceptos_venta (
        embarque_id, descripcion, cantidad, precio_unitario, moneda, total, contenedor_id, organization_id
      ) VALUES (
        p_embarque_id,
        cv->>'descripcion',
        COALESCE((cv->>'cantidad')::numeric, 1),
        COALESCE((cv->>'precio_unitario')::numeric, 0),
        COALESCE((cv->>'moneda')::moneda, 'MXN'::moneda),
        COALESCE((cv->>'total')::numeric, 0),
        NULLIF(cv->>'contenedor_id','')::uuid,
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

CREATE OR REPLACE FUNCTION public.reabrir_embarque(p_embarque_id uuid, p_usuario_email text, p_motivo text, p_request_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_estado_actual text;
  v_resp jsonb;
  v_es_admin boolean;
  v_motivo text := NULLIF(trim(COALESCE(p_motivo, '')), '');
  v_actor_id uuid := auth.uid();
  v_actor_email text;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id
     AND deleted_at IS NULL;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  v_es_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role)
             OR public.has_role(auth.uid(), 'admin_org'::app_role);
  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir embarques cerrados';
  END IF;

  PERFORM public._assert_writer(v_org_id);

  IF v_estado_actual <> 'Cerrado' THEN
    RAISE EXCEPTION 'Solo embarques en estado Cerrado pueden reabrirse (estado actual: %)', v_estado_actual;
  END IF;

  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  PERFORM set_config('app.bypass_cierre','on', true);
  PERFORM set_config('app.bypass_transicion','on', true);

  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque,
         cerrado_snapshot = NULL,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  PERFORM set_config('app.bypass_transicion','off', true);

  UPDATE comisiones_devengadas
     SET definitiva = false,
         pnl_base = NULL,
         calculo_snapshot = NULL,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Por liquidar. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), v_actor_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM public.registrar_bitacora(
    'embarques', 'reabrir_embarque', p_embarque_id, '',
    jsonb_build_object('motivo', v_motivo), v_org_id, auth.uid()
  );

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Por liquidar');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(p_liquidacion_id uuid, p_motivo text)
RETURNS public.liquidaciones_comision
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_MOTIVO_REQUERIDO: Captura el motivo de la cancelación.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_row.organization_id) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.comisiones_devengadas
     SET estado = 'Devengada', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Liquidada';

  UPDATE public.comisiones_devengadas
     SET estado = 'Por recuperar', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Cancelada';

  UPDATE public.liquidaciones_comision
     SET estado = 'Cancelada',
         cancelada_at = now(),
         cancelada_por = v_uid,
         motivo_cancelacion = TRIM(p_motivo),
         updated_at = now()
   WHERE id = p_liquidacion_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_liquidacion_comision', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('motivo', TRIM(p_motivo), 'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_liquidacion_comision: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated, service_role;