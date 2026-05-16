
-- =========================================================
-- A.3 IDEMPOTENCY INFRASTRUCTURE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  fn text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_idem_user_created
  ON public.idempotency_keys(user_id, created_at DESC);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read own idempotency_keys"
  ON public.idempotency_keys
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Tenant insert own idempotency_keys"
  ON public.idempotency_keys
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Claim helper: returns previously stored response if duplicate, NULL on fresh claim.
CREATE OR REPLACE FUNCTION public.idempotency_claim(_key uuid, _fn text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing jsonb;
  v_org uuid;
BEGIN
  IF _key IS NULL THEN RETURN NULL; END IF;
  v_org := current_user_org_id();
  INSERT INTO public.idempotency_keys(key, organization_id, user_id, fn)
  VALUES (_key, COALESCE(v_org, '00000000-0000-0000-0000-000000000000'::uuid), auth.uid(), _fn)
  ON CONFLICT (key) DO NOTHING;
  IF FOUND THEN
    RETURN NULL; -- fresh claim
  END IF;
  -- duplicate: return stored response (may be null if previous run still pending)
  SELECT response INTO v_existing
  FROM public.idempotency_keys
  WHERE key = _key;
  RETURN COALESCE(v_existing, jsonb_build_object('__idempotency_pending', true));
END;
$$;

CREATE OR REPLACE FUNCTION public.idempotency_store(_key uuid, _response jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.idempotency_keys SET response = _response WHERE key = _key;
$$;

-- =========================================================
-- WRAPPED RPC: crear_embarque_completo
-- =========================================================
DROP FUNCTION IF EXISTS public.crear_embarque_completo(jsonb, jsonb, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.crear_embarque_completo(
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb,
  p_documentos jsonb DEFAULT '[]'::jsonb,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- =========================================================
-- WRAPPED RPC: duplicar_embarque_completo
-- =========================================================
DROP FUNCTION IF EXISTS public.duplicar_embarque_completo(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.duplicar_embarque_completo(
  p_embarque_origen_id uuid,
  p_copias jsonb,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  origen embarques%ROWTYPE;
  copia jsonb;
  nuevo_id uuid;
  creados jsonb := '[]'::jsonb;
  v_resp jsonb;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'duplicar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT * INTO origen FROM embarques WHERE id = p_embarque_origen_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque origen no encontrado'; END IF;
  IF origen.organization_id <> current_user_org_id() AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: cross-organization access denied';
  END IF;

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

    INSERT INTO conceptos_venta (embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id)
    SELECT nuevo_id, descripcion, cantidad, precio_unitario, moneda, total, origen.organization_id
    FROM conceptos_venta WHERE embarque_id = p_embarque_origen_id;

    INSERT INTO conceptos_costo (embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id)
    SELECT nuevo_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, origen.organization_id
    FROM conceptos_costo WHERE embarque_id = p_embarque_origen_id;

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, organization_id)
    VALUES (nuevo_id, 'Embarque duplicado desde ' || origen.expediente, 'sistema', origen.organization_id);

    creados := creados || jsonb_build_object('id', nuevo_id, 'expediente', origen.expediente);
  END LOOP;

  PERFORM public.idempotency_store(p_request_id, creados);
  RETURN creados;
END;
$function$;

-- =========================================================
-- WRAPPED RPC: consolidar_proformas
-- =========================================================
DROP FUNCTION IF EXISTS public.consolidar_proformas(uuid, uuid[], uuid, uuid, text, text, text, text, integer, numeric);
CREATE OR REPLACE FUNCTION public.consolidar_proformas(
  p_organization_id uuid,
  p_proforma_ids uuid[],
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_operador text,
  p_dias_credito integer,
  p_tasa_iva numeric,
  p_request_id uuid DEFAULT NULL
)
RETURNS proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count int;
  v_numero text;
  v_nueva public.proformas%ROWTYPE;
  v_subtotal_usd numeric := 0; v_iva_usd numeric := 0; v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0; v_iva_mxn numeric := 0; v_total_mxn numeric := 0;
  v_cached jsonb;
  v_cached_id uuid;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    v_cached_id := (v_cached->>'id')::uuid;
    IF v_cached_id IS NOT NULL THEN
      SELECT * INTO v_nueva FROM public.proformas WHERE id = v_cached_id;
      RETURN v_nueva;
    END IF;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = p_organization_id;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_numero := public.generar_numero_proforma(p_organization_id);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, p_organization_id,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;

  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada
  )
  SELECT
    v_nueva.id, cv.embarque_id, e.contenedor, e.tipo_contenedor,
    cv.descripcion, SUM(cv.cantidad)::int, cv.precio_unitario,
    SUM(cv.cantidad * cv.precio_unitario), cv.moneda, cv.aplica_iva,
    CASE WHEN cv.aplica_iva THEN ROUND(SUM(cv.cantidad * cv.precio_unitario) * p_tasa_iva, 2) ELSE 0 END,
    p_organization_id, p_tasa_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
  GROUP BY cv.embarque_id, e.contenedor, e.tipo_contenedor,
           cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva;

  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;

-- =========================================================
-- WRAPPED RPC: marcar_proforma_facturada
-- =========================================================
DROP FUNCTION IF EXISTS public.marcar_proforma_facturada(uuid, text, date);
CREATE OR REPLACE FUNCTION public.marcar_proforma_facturada(
  p_id uuid,
  p_folio text,
  p_fecha date,
  p_request_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_cached jsonb;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'marcar_proforma_facturada');
  IF v_cached IS NOT NULL THEN RETURN; END IF;

  UPDATE public.proformas
  SET estado = 'Facturada'::estado_proforma,
      factura_externa_folio = p_folio,
      fecha_facturacion = p_fecha,
      updated_at = now()
  WHERE id = p_id
    AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('ok', true));
END;
$function$;
