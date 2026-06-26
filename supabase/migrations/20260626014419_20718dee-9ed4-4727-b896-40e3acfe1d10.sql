
-- ============================================================
-- Fase 1: Vista de trazabilidad
-- ============================================================
CREATE OR REPLACE VIEW public.v_proforma_factura_link AS
SELECT
  p.id                AS proforma_id,
  p.numero            AS proforma_numero,
  p.organization_id,
  p.cliente_id,
  p.estado_proforma,
  p.estado_revision,
  p.factura_id,
  f.numero            AS factura_numero,
  f.estado            AS factura_estado,
  f.uuid_fiscal,
  f.timbrado_en,
  p.es_consolidada,
  p.proformas_origen
FROM public.proformas p
LEFT JOIN public.facturas f ON f.id = p.factura_id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON public.v_proforma_factura_link TO authenticated;

COMMENT ON COLUMN public.proformas.factura_id IS
  'FK a la factura generada al convertir esta proforma. Una factura puede agrupar varias proformas (fusion N:1).';
COMMENT ON COLUMN public.facturas.proforma_id IS
  'FK a la proforma origen (caso 1:1). Para fusion N:1 mirar public.proformas.factura_id = facturas.id.';

-- ============================================================
-- Fase 2: RPC de conversión Proforma(s) → Factura
-- ============================================================
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids   uuid[],
  p_serie_id       uuid,
  p_metodo_pago    text,            -- 'PUE' | 'PPD'
  p_forma_pago     text,            -- código SAT (ej. '03')
  p_uso_cfdi       text,            -- código SAT (ej. 'G03')
  p_dias_credito   integer DEFAULT 0,
  p_notas          text    DEFAULT NULL,
  p_request_id     uuid    DEFAULT NULL
)
RETURNS public.facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cached         jsonb;
  v_factura        public.facturas;
  v_count          int;
  v_first          public.proformas;
  v_org            uuid;
  v_caller_org     uuid;
  v_cliente        public.clientes;
  v_serie          public.factura_series;
  v_folio          bigint;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_tipo_cambio    numeric;
  v_distinct_cli   int;
  v_distinct_org   int;
BEGIN
  -- Idempotencia
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_factura FROM public.facturas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_factura; END IF;
  END IF;

  -- Validar input
  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  -- Caller / org
  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

  -- Cargar proformas y validar
  SELECT count(*),
         count(DISTINCT organization_id),
         count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
    AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  SELECT * INTO v_first
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
  ORDER BY created_at ASC
  LIMIT 1;

  v_org := v_first.organization_id;

  -- Seguridad
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;
  PERFORM public._assert_writer(v_org);

  -- Validar que ninguna ya esté facturada
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND (factura_id IS NOT NULL OR estado_proforma = 'facturada')
  ) THEN
    RAISE EXCEPTION 'Una o más proformas ya están facturadas';
  END IF;

  -- Validar que estén aprobadas
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND coalesce(estado_revision, '') <> 'aprobada'
  ) THEN
    RAISE EXCEPTION 'Todas las proformas deben estar en estado aprobada';
  END IF;

  -- Cliente y datos fiscales mínimos
  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente.rfc IS NULL OR length(v_cliente.rfc) < 12 THEN
    RAISE EXCEPTION 'Cliente sin RFC válido';
  END IF;
  IF v_cliente.codigo_postal IS NULL OR v_cliente.codigo_postal !~ '^\d{5}$' THEN
    RAISE EXCEPTION 'Cliente sin código postal válido';
  END IF;
  IF v_cliente.regimen_fiscal IS NULL OR v_cliente.regimen_fiscal = '' THEN
    RAISE EXCEPTION 'Cliente sin régimen fiscal';
  END IF;

  -- Serie + folio
  SELECT * INTO v_serie FROM public.factura_series
   WHERE id = p_serie_id AND organization_id = v_org AND activa = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serie de facturación inválida para esta organización';
  END IF;
  SELECT folio, numero INTO v_folio, v_numero FROM public.reservar_folio_factura(p_serie_id);

  -- Sumar totales (ya prorrateados por la(s) proforma(s))
  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_tipo_cambio := CASE WHEN v_subtotal_usd > 0 THEN ROUND(v_subtotal_mxn / v_subtotal_usd, 4) ELSE 1 END;

  -- Insertar factura en borrador
  INSERT INTO public.facturas (
    numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, tipo_cambio,
    fecha_emision, fecha_vencimiento, estado,
    organization_id, proforma_id,
    serie_id, folio_fiscal, serie,
    rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
    notas, origen
  ) VALUES (
    v_numero, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
    v_subtotal_mxn, v_iva_mxn, v_total_mxn, 'MXN', v_tipo_cambio,
    CURRENT_DATE,
    CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
    'Borrador'::estado_factura,
    v_org,
    CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
    p_serie_id, v_folio, v_serie.prefijo,
    v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
    p_notas, 'conversion_proforma'
  )
  RETURNING * INTO v_factura;

  -- Copiar conceptos
  INSERT INTO public.conceptos_factura (
    factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
  )
  SELECT
    v_factura.id,
    pcc.descripcion,
    pcc.cantidad,
    pcc.precio_unitario,
    pcc.moneda,
    pcc.total,
    v_org,
    '78101800' -- clave SAT genérica para servicios de transporte de carga; el usuario puede editarla antes de timbrar
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = ANY(p_proforma_ids);

  -- Marcar proformas como facturadas
  UPDATE public.proformas
     SET factura_id      = v_factura.id,
         estado_proforma = 'facturada',
         fecha_facturacion = CURRENT_DATE,
         updated_at      = now()
   WHERE id = ANY(p_proforma_ids);

  -- Bitácora
  INSERT INTO public.bitacora_actividad (organization_id, user_id, accion, entidad, entidad_id, detalle)
  VALUES (
    v_org, auth.uid(), 'proforma_convertida_a_factura', 'factura', v_factura.id,
    jsonb_build_object(
      'proforma_ids', to_jsonb(p_proforma_ids),
      'factura_numero', v_factura.numero,
      'metodo_pago', p_metodo_pago,
      'fusion', array_length(p_proforma_ids, 1) > 1
    )
  );

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_factura.id));
  RETURN v_factura;
END;
$$;

GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated;
