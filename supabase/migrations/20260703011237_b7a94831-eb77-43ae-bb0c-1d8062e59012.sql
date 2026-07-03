-- v13.146.1: quitar validación fiscal previa a la conversión.
-- FacturAPI valida RFC/CP/régimen al timbrar (facturapi-emitir/helpers.ts).
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[],
  p_serie_id uuid,
  p_metodo_pago text,
  p_forma_pago text,
  p_uso_cfdi text,
  p_dias_credito integer DEFAULT 0,
  p_notas text DEFAULT NULL::text,
  p_request_id uuid DEFAULT NULL::uuid
)
RETURNS facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cached         jsonb;
  v_factura        public.facturas;
  v_count          int;
  v_first          public.proformas;
  v_org            uuid;
  v_caller_org     uuid;
  v_cliente        public.clientes;
  v_serie          public.factura_series;
  v_numero_tmp     text;
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
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_factura FROM public.facturas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_factura; END IF;
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

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

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

  SELECT * INTO v_first
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
  ORDER BY created_at ASC
  LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;
  PERFORM public._assert_writer(v_org);

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND (factura_id IS NOT NULL OR estado_proforma = 'facturada')
  ) THEN
    RAISE EXCEPTION 'Una o más proformas ya están facturadas';
  END IF;

  -- v13.146.1: validaciones fiscales (RFC/CP/régimen) removidas.
  -- FacturAPI las revalida al timbrar; el borrador puede crearse con datos incompletos
  -- y el usuario los completa en la ficha del cliente antes de emitir.
  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;

  SELECT * INTO v_serie FROM public.factura_series
   WHERE id = p_serie_id AND organization_id = v_org AND activa = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serie de facturación inválida para esta organización';
  END IF;

  v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_tipo_cambio := CASE WHEN v_subtotal_usd > 0 THEN ROUND(v_subtotal_mxn / v_subtotal_usd, 4) ELSE 1 END;

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
    v_subtotal_mxn, v_iva_mxn, v_total_mxn, 'MXN', v_tipo_cambio,
    CURRENT_DATE,
    CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
    'Borrador'::estado_factura,
    v_org,
    CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
    p_serie_id, NULL, NULL,
    v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
    p_notas, 'conversion_proforma'
  )
  RETURNING * INTO v_factura;

  INSERT INTO public.conceptos_factura (
    factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
  )
  SELECT
    v_factura.id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
    pcc.moneda, pcc.total, v_org, '78101800'
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = ANY(p_proforma_ids);

  UPDATE public.proformas
     SET factura_id      = v_factura.id,
         estado_proforma = 'facturada',
         fecha_facturacion = CURRENT_DATE,
         updated_at      = now()
   WHERE id = ANY(p_proforma_ids);

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  )
  VALUES (
    v_org, auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    'factura.borrador_generado', 'facturacion', v_factura.id, v_numero_tmp,
    jsonb_build_object(
      'proforma_ids', p_proforma_ids,
      'serie_id', p_serie_id,
      'nota', 'Folio interno se asignará al timbrar (FacturAPI)'
    )
  );

  PERFORM public.idempotency_store(
    p_request_id, 'convertir_proformas_a_factura',
    jsonb_build_object('id', v_factura.id, 'numero', v_factura.numero)
  );

  RETURN v_factura;
END $function$;