
-- ============================================================================
-- 12.51.14 — Refuerzo de seguridad multi-tenant en RPCs y políticas
-- ============================================================================

-- Helper: exige rol de escritura (admin/operador) en la org dada, o super_admin.
CREATE OR REPLACE FUNCTION public._assert_writer(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      p_org = public.current_user_org_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Helper: exige rol interno de lectura (admin/operador) o super_admin.
CREATE OR REPLACE FUNCTION public._assert_internal_reader(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      p_org = public.current_user_org_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================================
-- crear_embarque_completo — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_documentos jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  nuevo_id uuid := gen_random_uuid();
  v_org_id uuid;
  v_resp jsonb;
  cv jsonb; cc jsonb; doc jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'crear_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  v_org_id := current_user_org_id();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'No organization context for caller'; END IF;
  PERFORM public._assert_writer(v_org_id);

  INSERT INTO embarques (
    id, expediente, cliente_id, cliente_nombre, modo, tipo,
    shipper, consignatario, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas,
    puerto_origen, puerto_destino, naviera, agente,
    bl_master, bl_house, tipo_servicio,
    contenedor, tipo_contenedor,
    aeropuerto_origen, aeropuerto_destino, aerolinea,
    mawb, hawb, ciudad_origen, ciudad_destino,
    transportista, carta_porte, etd, eta,
    tipo_cambio_usd, tipo_cambio_eur,
    tipo_carga, msds_archivo, operador, organization_id
  ) VALUES (
    nuevo_id, p_embarque->>'expediente', (p_embarque->>'cliente_id')::uuid,
    COALESCE(p_embarque->>'cliente_nombre', ''),
    (p_embarque->>'modo')::modo_transporte, (p_embarque->>'tipo')::tipo_operacion,
    COALESCE(p_embarque->>'shipper', ''), COALESCE(p_embarque->>'consignatario', ''),
    COALESCE((p_embarque->>'incoterm')::incoterm, 'FOB'),
    COALESCE(p_embarque->>'descripcion_mercancia', ''),
    COALESCE((p_embarque->>'peso_kg')::numeric, 0),
    COALESCE((p_embarque->>'volumen_m3')::numeric, 0),
    COALESCE((p_embarque->>'piezas')::int, 0),
    p_embarque->>'puerto_origen', p_embarque->>'puerto_destino',
    p_embarque->>'naviera', p_embarque->>'agente',
    p_embarque->>'bl_master', p_embarque->>'bl_house',
    CASE WHEN p_embarque->>'tipo_servicio' IS NOT NULL THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE NULL END,
    p_embarque->>'contenedor', p_embarque->>'tipo_contenedor',
    p_embarque->>'aeropuerto_origen', p_embarque->>'aeropuerto_destino',
    p_embarque->>'aerolinea', p_embarque->>'mawb', p_embarque->>'hawb',
    p_embarque->>'ciudad_origen', p_embarque->>'ciudad_destino',
    p_embarque->>'transportista', p_embarque->>'carta_porte',
    CASE WHEN p_embarque->>'etd' IS NOT NULL THEN (p_embarque->>'etd')::date ELSE NULL END,
    CASE WHEN p_embarque->>'eta' IS NOT NULL THEN (p_embarque->>'eta')::date ELSE NULL END,
    COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, 17.5),
    COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, 19.0),
    COALESCE(p_embarque->>'tipo_carga', 'Carga General'),
    p_embarque->>'msds_archivo', COALESCE(p_embarque->>'operador', ''),
    v_org_id
  );

  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta)
  LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (nuevo_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric, (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;

  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo)
  LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (nuevo_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;

  FOR doc IN SELECT * FROM jsonb_array_elements(p_documentos)
  LOOP
    INSERT INTO documentos_embarque (embarque_id, nombre, archivo, estado, organization_id)
    VALUES (
      nuevo_id, doc->>'nombre', NULLIF(doc->>'archivo', ''),
      CASE WHEN NULLIF(doc->>'archivo', '') IS NOT NULL THEN 'Recibido'::estado_documento ELSE 'Pendiente'::estado_documento END,
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

-- ============================================================================
-- actualizar_embarque_completo — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(p_embarque_id uuid, p_embarque jsonb, p_conceptos_venta jsonb DEFAULT '[]'::jsonb, p_conceptos_costo jsonb DEFAULT '[]'::jsonb, p_request_id uuid DEFAULT NULL::uuid)
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
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  UPDATE embarques SET
    cliente_id = COALESCE((p_embarque->>'cliente_id')::uuid, cliente_id),
    cliente_nombre = COALESCE(p_embarque->>'cliente_nombre', cliente_nombre),
    modo = COALESCE((p_embarque->>'modo')::modo_transporte, modo),
    tipo = COALESCE((p_embarque->>'tipo')::tipo_operacion, tipo),
    incoterm = COALESCE((p_embarque->>'incoterm')::incoterm, incoterm),
    bl_master = CASE WHEN p_embarque ? 'bl_master' THEN p_embarque->>'bl_master' ELSE bl_master END,
    bl_house = CASE WHEN p_embarque ? 'bl_house' THEN p_embarque->>'bl_house' ELSE bl_house END,
    naviera = CASE WHEN p_embarque ? 'naviera' THEN p_embarque->>'naviera' ELSE naviera END,
    puerto_origen = CASE WHEN p_embarque ? 'puerto_origen' THEN p_embarque->>'puerto_origen' ELSE puerto_origen END,
    puerto_destino = CASE WHEN p_embarque ? 'puerto_destino' THEN p_embarque->>'puerto_destino' ELSE puerto_destino END,
    aeropuerto_origen = CASE WHEN p_embarque ? 'aeropuerto_origen' THEN p_embarque->>'aeropuerto_origen' ELSE aeropuerto_origen END,
    aeropuerto_destino = CASE WHEN p_embarque ? 'aeropuerto_destino' THEN p_embarque->>'aeropuerto_destino' ELSE aeropuerto_destino END,
    ciudad_origen = CASE WHEN p_embarque ? 'ciudad_origen' THEN p_embarque->>'ciudad_origen' ELSE ciudad_origen END,
    ciudad_destino = CASE WHEN p_embarque ? 'ciudad_destino' THEN p_embarque->>'ciudad_destino' ELSE ciudad_destino END,
    aerolinea = CASE WHEN p_embarque ? 'aerolinea' THEN p_embarque->>'aerolinea' ELSE aerolinea END,
    transportista = CASE WHEN p_embarque ? 'transportista' THEN p_embarque->>'transportista' ELSE transportista END,
    agente = CASE WHEN p_embarque ? 'agente' THEN p_embarque->>'agente' ELSE agente END,
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
    tipo_cambio_usd = COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, tipo_cambio_usd),
    tipo_cambio_eur = COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, tipo_cambio_eur),
    msds_archivo = CASE WHEN p_embarque ? 'msds_archivo' THEN p_embarque->>'msds_archivo' ELSE msds_archivo END,
    updated_at = now()
  WHERE id = p_embarque_id;

  DELETE FROM conceptos_venta WHERE embarque_id = p_embarque_id;
  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    VALUES (p_embarque_id, cv->>'descripcion', (cv->>'cantidad')::int, (cv->>'precio_unitario')::numeric, (cv->>'moneda')::moneda, (cv->>'total')::numeric, v_org_id);
  END LOOP;

  DELETE FROM conceptos_costo WHERE embarque_id = p_embarque_id;
  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    VALUES (p_embarque_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre', ''),
      CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' != '' THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
      (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id);
  END LOOP;

  v_resp := jsonb_build_object('id', p_embarque_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

-- ============================================================================
-- avanzar_estado_embarque — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM embarques WHERE id = p_embarque_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), p_usuario_email, v_org_id);

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

-- ============================================================================
-- actualizar_cotizacion_costos — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_costos(p_cotizacion_id uuid, p_costos jsonb, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  c jsonb;
  v_count int := 0;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_cotizacion_costos');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  PERFORM public._assert_writer(v_org_id);

  DELETE FROM cotizacion_costos WHERE cotizacion_id = p_cotizacion_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_costos) LOOP
    INSERT INTO cotizacion_costos (
      cotizacion_id, concepto, moneda, proveedor, cantidad,
      costo_unitario, precio_venta, unidad_medida, notas, organization_id
    ) VALUES (
      p_cotizacion_id,
      c->>'concepto',
      c->>'moneda',
      COALESCE(c->>'proveedor', ''),
      (c->>'cantidad')::numeric,
      (c->>'costo_unitario')::numeric,
      COALESCE((c->>'precio_venta')::numeric, 0),
      COALESCE(c->>'unidad_medida', ''),
      COALESCE(c->>'notas', ''),
      v_org_id
    );
    v_count := v_count + 1;
  END LOOP;

  v_resp := jsonb_build_object('cotizacion_id', p_cotizacion_id, 'count', v_count);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

-- ============================================================================
-- duplicar_embarque_completo — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.duplicar_embarque_completo(p_embarque_origen_id uuid, p_copias jsonb, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  origen embarques%ROWTYPE;
  copia jsonb;
  nuevo_id uuid;
  creados jsonb := '[]'::jsonb;
  v_resp jsonb;
  v_mapping jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'duplicar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT * INTO origen FROM embarques WHERE id = p_embarque_origen_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque origen no encontrado'; END IF;
  PERFORM public._assert_writer(origen.organization_id);

  FOR copia IN SELECT * FROM jsonb_array_elements(p_copias)
  LOOP
    INSERT INTO embarques (
      expediente, estado, cliente_id, cliente_nombre, modo, tipo, incoterm,
      bl_master, bl_house, naviera, puerto_origen, puerto_destino,
      aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino,
      aerolinea, transportista, agente, shipper, consignatario,
      descripcion_mercancia, tipo_carga, tipo_servicio, operador,
      mawb, hawb, carta_porte, etd, eta,
      tipo_cambio_usd, tipo_cambio_eur,
      contenedor, tipo_contenedor, peso_kg, volumen_m3, piezas, organization_id
    ) VALUES (
      origen.expediente, 'Confirmado', origen.cliente_id, origen.cliente_nombre,
      origen.modo, origen.tipo, origen.incoterm,
      origen.bl_master, origen.bl_house, origen.naviera,
      origen.puerto_origen, origen.puerto_destino,
      origen.aeropuerto_origen, origen.aeropuerto_destino,
      origen.ciudad_origen, origen.ciudad_destino,
      origen.aerolinea, origen.transportista, origen.agente,
      origen.shipper, origen.consignatario,
      origen.descripcion_mercancia, origen.tipo_carga, origen.tipo_servicio,
      origen.operador, origen.mawb, origen.hawb, origen.carta_porte,
      origen.etd, origen.eta,
      origen.tipo_cambio_usd, origen.tipo_cambio_eur,
      NULLIF(copia->>'num_contenedor', ''), NULLIF(copia->>'tipo_contenedor', ''),
      (copia->>'peso_kg')::numeric, (copia->>'volumen_m3')::numeric, (copia->>'piezas')::int,
      origen.organization_id
    ) RETURNING id INTO nuevo_id;

    WITH inserted AS (
      INSERT INTO embarque_contenedores (
        embarque_id, organization_id, numero_contenedor, tipo_contenedor,
        bl_house, peso_kg, volumen_m3, piezas, orden
      )
      SELECT
        nuevo_id, origen.organization_id, numero_contenedor, tipo_contenedor,
        bl_house, peso_kg, volumen_m3, piezas, orden
      FROM embarque_contenedores
      WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL
      RETURNING id, orden
    ),
    paired AS (
      SELECT
        old.id AS old_id,
        new.id AS new_id
      FROM (
        SELECT id, orden FROM embarque_contenedores
        WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL
      ) old
      JOIN inserted new ON new.orden = old.orden
    )
    SELECT COALESCE(jsonb_object_agg(old_id::text, new_id), '{}'::jsonb)
    INTO v_mapping
    FROM paired;

    INSERT INTO conceptos_venta (
      embarque_id, descripcion, cantidad, precio_unitario, moneda, total,
      organization_id, contenedor_id, aplica_iva
    )
    SELECT
      nuevo_id, descripcion, cantidad, precio_unitario, moneda, total,
      origen.organization_id,
      CASE
        WHEN contenedor_id IS NOT NULL AND v_mapping ? contenedor_id::text
          THEN (v_mapping->>contenedor_id::text)::uuid
        ELSE NULL
      END,
      aplica_iva
    FROM conceptos_venta
    WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL;

    INSERT INTO conceptos_costo (
      embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto,
      organization_id, contenedor_id
    )
    SELECT
      nuevo_id, concepto, proveedor_nombre, proveedor_id, moneda, monto,
      origen.organization_id,
      CASE
        WHEN contenedor_id IS NOT NULL AND v_mapping ? contenedor_id::text
          THEN (v_mapping->>contenedor_id::text)::uuid
        ELSE NULL
      END
    FROM conceptos_costo
    WHERE embarque_id = p_embarque_origen_id AND deleted_at IS NULL;

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
    VALUES (nuevo_id, 'Embarque duplicado desde ' || origen.expediente, 'sistema', origen.organization_id);

    creados := creados || jsonb_build_object('id', nuevo_id, 'expediente', origen.expediente);
  END LOOP;

  PERFORM public.idempotency_store(p_request_id, creados);
  RETURN creados;
END;
$function$;

-- ============================================================================
-- consolidar_proformas — fuerza org del caller + chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS proformas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nueva           public.proformas;
  v_cached          jsonb;
  v_numero          text;
  v_count           int;
  v_subtotal_usd    numeric;
  v_iva_usd         numeric;
  v_total_usd       numeric;
  v_subtotal_mxn    numeric;
  v_iva_mxn         numeric;
  v_total_mxn       numeric;
  v_caller_org      uuid;
  v_org_efectiva    uuid;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN
      RETURN v_nueva;
    END IF;
  END IF;

  -- Seguridad: ignorar el organization_id que mande el cliente; usar el del caller.
  -- super_admin puede operar sobre cualquier organización (debe pasar la org real).
  v_caller_org := public.current_user_org_id();
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org_efectiva := p_organization_id;
  ELSE
    v_org_efectiva := v_caller_org;
  END IF;
  PERFORM public._assert_writer(v_org_efectiva);

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_numero := public.generar_numero_proforma(v_org_efectiva);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, v_org_efectiva,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;

  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada
  )
  SELECT
    v_nueva.id,
    cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad)::int, cv.precio_unitario,
    SUM(cv.cantidad * cv.precio_unitario), cv.moneda, cv.aplica_iva,
    CASE WHEN cv.aplica_iva THEN ROUND(SUM(cv.cantidad * cv.precio_unitario) * p_tasa_iva, 2) ELSE 0 END,
    v_org_efectiva, p_tasa_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
  GROUP BY
    cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva;

  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;

-- ============================================================================
-- marcar_proforma_facturada — añade chequeo de rol
-- ============================================================================
CREATE OR REPLACE FUNCTION public.marcar_proforma_facturada(p_id uuid, p_folio text, p_fecha date, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb;
  v_org_id uuid;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'marcar_proforma_facturada');
  IF v_cached IS NOT NULL THEN RETURN; END IF;

  SELECT organization_id INTO v_org_id FROM public.proformas WHERE id = p_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Proforma no encontrada'; END IF;
  PERFORM public._assert_writer(v_org_id);

  UPDATE public.proformas
  SET estado = 'Facturada'::estado_proforma,
      factura_externa_folio = p_folio,
      fecha_facturacion = p_fecha,
      updated_at = now()
  WHERE id = p_id;

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('ok', true));
END;
$function$;

-- ============================================================================
-- auditoria_embarques_org() — variante sin parámetro: exige rol interno
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid;
BEGIN
  v_caller_org := public.current_user_org_id();
  IF v_caller_org IS NULL THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  PERFORM public._assert_internal_reader(v_caller_org);
  -- Delegar a la variante con parámetro (que ahora también valida).
  RETURN public.auditoria_embarques_org(v_caller_org);
END;
$function$;

-- ============================================================================
-- auditoria_embarques_org(uuid) — variante con parámetro: exige rol interno + org propia
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auditoria_embarques_org(p_organization_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_margen_min_pct numeric;
  v_dias_prof_venc int;
  v_dias_huerfano int;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'p_organization_id es obligatorio';
  END IF;

  -- Guard de seguridad: sólo super_admin o admin/operador de la misma org.
  PERFORM public._assert_internal_reader(p_organization_id);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::numeric, 5)
  INTO v_margen_min_pct
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'margen_minimo_pct'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_margen_min_pct := COALESCE(v_margen_min_pct, 5);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 30)
  INTO v_dias_prof_venc
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_proforma_vencida'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_dias_prof_venc := COALESCE(v_dias_prof_venc, 30);

  SELECT COALESCE(NULLIF((valor #>> '{}'), '')::int, 5)
  INTO v_dias_huerfano
  FROM configuracion
  WHERE categoria = 'auditoria' AND clave = 'dias_huerfano'
    AND organization_id = p_organization_id
  LIMIT 1;
  v_dias_huerfano := COALESCE(v_dias_huerfano, 5);

  WITH
  emb AS (
    SELECT id, expediente, cliente_nombre, modo, estado, etd, eta,
           fecha_llegada_real, tipo_servicio, operador,
           tipo_cambio_usd, tipo_cambio_eur, fecha_creacion
    FROM embarques
    WHERE estado <> 'Cancelado'
      AND organization_id = p_organization_id
  ),
  docs_existentes AS (
    SELECT embarque_id, nombre,
           bool_or(archivo IS NOT NULL OR estado = 'No aplica') AS satisfecho
    FROM documentos_embarque
    WHERE embarque_id IN (SELECT id FROM emb)
    GROUP BY embarque_id, nombre
  ),
  exigidos AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta,
           d.doc_nombre
    FROM emb e
    CROSS JOIN LATERAL (
      VALUES
        ('Confirmado'::text, ARRAY['Factura Comercial','Packing List']),
        ('En Tránsito',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)']
          END),
        ('En Aduana',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Llegada',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Arribo',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('En Proceso',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Entregado',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END),
        ('Cerrado',
          CASE WHEN e.modo::text = 'Aéreo'
            THEN ARRAY['Factura Comercial','Packing List','Air Waybill (AWB)','Certificado de Origen','Ficha Técnica']
            ELSE ARRAY['Factura Comercial','Packing List','Bill of Lading (BL Master)','Bill of Lading (BL House)','Certificado de Origen','Ficha Técnica']
          END)
    ) AS m(estado_match, docs_required)
    CROSS JOIN LATERAL unnest(m.docs_required) AS d(doc_nombre)
    WHERE e.estado::text = m.estado_match
  ),
  faltantes AS (
    SELECT x.embarque_id, x.expediente, x.cliente_nombre, x.modo::text AS modo,
           x.estado::text AS estado, x.eta,
           array_agg(x.doc_nombre ORDER BY x.doc_nombre) AS docs_faltantes
    FROM exigidos x
    LEFT JOIN docs_existentes de
      ON de.embarque_id = x.embarque_id
     AND de.nombre = x.doc_nombre
     AND de.satisfecho = true
    WHERE de.embarque_id IS NULL
    GROUP BY x.embarque_id, x.expediente, x.cliente_nombre, x.modo, x.estado, x.eta
  ),
  hall_docs_faltantes AS (
    SELECT jsonb_build_object(
      'embarque_id', f.embarque_id, 'expediente', f.expediente,
      'cliente_nombre', f.cliente_nombre, 'modo', f.modo, 'estado', f.estado, 'eta', f.eta,
      'regla', 'docs_faltantes',
      'severidad', CASE WHEN f.estado IN ('Confirmado') THEN 'medio' ELSE 'alto' END,
      'detalle', 'Faltan ' || array_length(f.docs_faltantes,1) || ' documento(s) para estado "' || f.estado || '"',
      'documentos_faltantes', to_jsonb(f.docs_faltantes)
    ) AS h
    FROM faltantes f
  ),
  hall_docs_pendientes AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'docs_pendientes_avanzado', 'severidad', 'critico',
      'detalle', 'Hay ' || COUNT(d.id) || ' documento(s) en estado Pendiente con embarque ya en "' || e.estado::text || '"',
      'documentos_faltantes', jsonb_agg(d.nombre ORDER BY d.nombre)
    ) AS h
    FROM emb e
    JOIN documentos_embarque d ON d.embarque_id = e.id
    WHERE e.estado IN ('En Aduana','Llegada','Arribo','Entregado','Cerrado')
      AND d.estado = 'Pendiente'
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  hall_fechas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'fechas', 'severidad', 'medio',
      'detalle', detalle, 'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM (
      SELECT e.*,
        CASE
          WHEN e.estado = 'En Tránsito' AND e.etd IS NULL
            THEN 'Embarque En Tránsito sin ETD registrado'
          WHEN e.estado = 'En Tránsito' AND e.etd > CURRENT_DATE
            THEN 'Embarque En Tránsito con ETD futura ('|| to_char(e.etd,'DD/MM/YYYY') ||')'
          WHEN e.estado IN ('Llegada','Arribo') AND e.fecha_llegada_real IS NULL
            THEN 'Estado "' || e.estado::text || '" sin fecha de llegada real'
          WHEN e.estado = 'Confirmado' AND e.eta IS NOT NULL AND e.eta < CURRENT_DATE - INTERVAL '3 days'
            THEN 'ETA vencida ('|| to_char(e.eta,'DD/MM/YYYY') ||') y embarque sigue en Confirmado'
          WHEN e.estado IN ('Entregado','Cerrado') AND e.fecha_llegada_real IS NULL
            THEN 'Embarque ' || e.estado::text || ' sin fecha de llegada real'
        END AS detalle
      FROM emb e
    ) e
    WHERE detalle IS NOT NULL
  ),
  hall_ventas AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'ventas_sin_facturar', 'severidad', 'critico',
      'detalle', COUNT(cv.id) || ' concepto(s) de venta pendientes de facturar (' || to_char(SUM(cv.total),'FM999,999,990.00') || ' ' || COALESCE(MAX(cv.moneda::text),'MXN') || ')',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN conceptos_venta cv ON cv.embarque_id = e.id
    WHERE e.estado IN ('Entregado','Cerrado')
      AND cv.estado_facturacion = 'pendiente'
    GROUP BY e.id, e.expediente, e.cliente_nombre, e.modo, e.estado, e.eta
  ),
  ventas_mxn AS (
    SELECT cv.embarque_id,
           SUM(cv.total * CASE
             WHEN cv.moneda::text = 'USD' THEN COALESCE(NULLIF(e.tipo_cambio_usd,0), 17.5)
             WHEN cv.moneda::text = 'EUR' THEN COALESCE(NULLIF(e.tipo_cambio_eur,0), 19.0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n
    FROM conceptos_venta cv
    JOIN emb e ON e.id = cv.embarque_id
    GROUP BY cv.embarque_id
  ),
  costos_mxn AS (
    SELECT cc.embarque_id,
           SUM(cc.monto * CASE
             WHEN cc.moneda::text = 'USD' THEN COALESCE(NULLIF(e.tipo_cambio_usd,0), 17.5)
             WHEN cc.moneda::text = 'EUR' THEN COALESCE(NULLIF(e.tipo_cambio_eur,0), 19.0)
             ELSE 1
           END) AS total_mxn,
           COUNT(*) AS n
    FROM conceptos_costo cc
    JOIN emb e ON e.id = cc.embarque_id
    GROUP BY cc.embarque_id
  ),
  margenes AS (
    SELECT e.id AS embarque_id, e.expediente, e.cliente_nombre, e.modo::text AS modo,
           e.estado::text AS estado, e.eta,
           COALESCE(v.total_mxn, 0) AS venta_mxn,
           COALESCE(c.total_mxn, 0) AS costo_mxn,
           COALESCE(v.total_mxn, 0) - COALESCE(c.total_mxn, 0) AS utilidad_mxn,
           CASE WHEN COALESCE(v.total_mxn, 0) = 0 THEN NULL
                ELSE ((COALESCE(v.total_mxn,0) - COALESCE(c.total_mxn,0)) / v.total_mxn) * 100
           END AS margen_pct,
           COALESCE(v.n, 0) AS n_ventas,
           COALESCE(c.n, 0) AS n_costos
    FROM emb e
    LEFT JOIN ventas_mxn v ON v.embarque_id = e.id
    LEFT JOIN costos_mxn c ON c.embarque_id = e.id
    WHERE e.estado IN ('Entregado','Cerrado','En Proceso','Llegada','Arribo')
  ),
  hall_margen_neg AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'margen_negativo', 'severidad', 'critico',
      'detalle', 'Margen negativo: ' || to_char(m.utilidad_mxn,'FM999,999,990.00') || ' MXN',
      'monto_mxn', m.utilidad_mxn,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.utilidad_mxn < 0
  ),
  hall_margen_bajo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'margen_bajo', 'severidad', 'medio',
      'detalle', 'Margen ' || to_char(m.margen_pct,'FM990.0') || '% por debajo del mínimo (' || v_margen_min_pct || '%)',
      'monto_mxn', m.utilidad_mxn,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.margen_pct IS NOT NULL
      AND m.margen_pct >= 0
      AND m.margen_pct < v_margen_min_pct
  ),
  hall_venta_sin_costo AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'venta_sin_costo', 'severidad', 'alto',
      'detalle', 'Embarque tiene ventas pero ningún costo registrado',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.n_ventas > 0 AND m.n_costos = 0
  ),
  hall_costo_sin_venta AS (
    SELECT jsonb_build_object(
      'embarque_id', m.embarque_id, 'expediente', m.expediente,
      'cliente_nombre', m.cliente_nombre, 'modo', m.modo, 'estado', m.estado, 'eta', m.eta,
      'regla', 'costo_sin_venta', 'severidad', 'alto',
      'detalle', 'Embarque tiene costos pero ninguna venta registrada',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM margenes m
    WHERE m.n_costos > 0 AND m.n_ventas = 0
  ),
  proforma_pend AS (
    SELECT p.embarque_id, p.id AS proforma_id, p.numero, p.created_at
    FROM proformas p
    WHERE p.embarque_id IN (SELECT id FROM emb)
      AND p.estado_proforma = 'pendiente'
      AND p.created_at < (now() - (v_dias_prof_venc || ' days')::interval)
  ),
  hall_proforma_vencida AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'proforma_vencida', 'severidad', 'alto',
      'detalle', 'Proforma ' || pp.numero || ' lleva más de ' || v_dias_prof_venc || ' días sin facturar',
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    JOIN proforma_pend pp ON pp.embarque_id = e.id
  ),
  ult_evento AS (
    SELECT embarque_id, MAX(fecha) AS ult
    FROM eventos_embarque
    WHERE embarque_id IN (SELECT id FROM emb)
    GROUP BY embarque_id
  ),
  hall_huerfano AS (
    SELECT jsonb_build_object(
      'embarque_id', e.id, 'expediente', e.expediente,
      'cliente_nombre', e.cliente_nombre, 'modo', e.modo::text, 'estado', e.estado::text, 'eta', e.eta,
      'regla', 'embarque_huerfano', 'severidad', 'medio',
      'detalle', CASE
        WHEN COALESCE(e.operador,'') = ''
          THEN 'Embarque sin operador asignado'
        ELSE 'Embarque sin movimientos en los últimos ' || v_dias_huerfano || ' días'
      END,
      'documentos_faltantes', '[]'::jsonb
    ) AS h
    FROM emb e
    LEFT JOIN ult_evento u ON u.embarque_id = e.id
    WHERE e.estado IN ('Confirmado','En Tránsito','En Aduana','Llegada','Arribo','En Proceso')
      AND (
        COALESCE(e.operador,'') = ''
        OR COALESCE(u.ult, e.fecha_creacion) < (now() - (v_dias_huerfano || ' days')::interval)
      )
  ),
  todos AS (
    SELECT h FROM hall_docs_faltantes
    UNION ALL SELECT h FROM hall_docs_pendientes
    UNION ALL SELECT h FROM hall_fechas
    UNION ALL SELECT h FROM hall_ventas
    UNION ALL SELECT h FROM hall_margen_neg
    UNION ALL SELECT h FROM hall_margen_bajo
    UNION ALL SELECT h FROM hall_venta_sin_costo
    UNION ALL SELECT h FROM hall_costo_sin_venta
    UNION ALL SELECT h FROM hall_proforma_vencida
    UNION ALL SELECT h FROM hall_huerfano
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'total_hallazgos', COUNT(*),
    'por_severidad', jsonb_build_object(
      'critico', COUNT(*) FILTER (WHERE h->>'severidad' = 'critico'),
      'alto',    COUNT(*) FILTER (WHERE h->>'severidad' = 'alto'),
      'medio',   COUNT(*) FILTER (WHERE h->>'severidad' = 'medio')
    ),
    'por_regla', jsonb_build_object(
      'docs_faltantes',           COUNT(*) FILTER (WHERE h->>'regla' = 'docs_faltantes'),
      'docs_pendientes_avanzado', COUNT(*) FILTER (WHERE h->>'regla' = 'docs_pendientes_avanzado'),
      'fechas',                   COUNT(*) FILTER (WHERE h->>'regla' = 'fechas'),
      'ventas_sin_facturar',      COUNT(*) FILTER (WHERE h->>'regla' = 'ventas_sin_facturar'),
      'margen_negativo',          COUNT(*) FILTER (WHERE h->>'regla' = 'margen_negativo'),
      'margen_bajo',              COUNT(*) FILTER (WHERE h->>'regla' = 'margen_bajo'),
      'venta_sin_costo',          COUNT(*) FILTER (WHERE h->>'regla' = 'venta_sin_costo'),
      'costo_sin_venta',          COUNT(*) FILTER (WHERE h->>'regla' = 'costo_sin_venta'),
      'proforma_vencida',         COUNT(*) FILTER (WHERE h->>'regla' = 'proforma_vencida'),
      'embarque_huerfano',        COUNT(*) FILTER (WHERE h->>'regla' = 'embarque_huerfano')
    ),
    'umbrales', jsonb_build_object(
      'margen_minimo_pct', v_margen_min_pct,
      'dias_proforma_vencida', v_dias_prof_venc,
      'dias_huerfano', v_dias_huerfano
    ),
    'hallazgos', COALESCE(jsonb_agg(h ORDER BY
      CASE h->>'severidad' WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 ELSE 3 END,
      h->>'expediente'
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM todos;

  RETURN v_result;
END;
$function$;

-- ============================================================================
-- configuracion_global — restringir lectura a personal interno (excluye cliente)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated read configuracion_global" ON public.configuracion_global;
CREATE POLICY "Internal roles read configuracion_global"
  ON public.configuracion_global
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'viewer'::app_role)
  );

-- ============================================================================
-- Tablas de respaldo: política de lectura sólo super_admin
-- ============================================================================
DROP POLICY IF EXISTS "Super admin read backup embarques" ON public._backup_merge_embarques_20260602;
CREATE POLICY "Super admin read backup embarques"
  ON public._backup_merge_embarques_20260602
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Super admin read backup fk remap" ON public._backup_merge_fk_remap_20260602;
CREATE POLICY "Super admin read backup fk remap"
  ON public._backup_merge_fk_remap_20260602
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));
