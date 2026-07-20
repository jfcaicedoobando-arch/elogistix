-- ============================================================
-- Fase A · Sprint 0 · v13.303.0 — Correcciones críticas
-- ============================================================

-- ─── FIX-02 + FIX-16 · validar_cierre_embarque ──────────────
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_saldo numeric; v_cxc_total numeric; v_cxc_pagado numeric; v_cxc_ncs numeric;
  v_cxp_total numeric; v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_utilidad numeric; v_margen_min numeric;
  v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  IF v_emb.modo = 'Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
      AND (peso_kg IS NULL OR peso_kg <= 0 OR volumen_m3 IS NULL OR volumen_m3 <= 0);
    v_ok := (v_cont_incompletos = 0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_datos_completos','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', v_cont_ids)));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) INTO v_tiene_contenedores;

  IF v_tiene_contenedores THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_cont_sin_fechas, v_cont_fechas_ids
    FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
      AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
    v_ok := (v_cont_sin_fechas = 0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_fechas_completas','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
  END IF;

  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque de
  WHERE de.embarque_id = p_embarque_id AND de.deleted_at IS NULL
    AND (de.archivo IS NULL OR de.archivo = '') AND de.estado <> 'No aplica';
  v_ok := (v_docs_faltantes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  SELECT COUNT(*) INTO v_costos_sin_factura
  FROM conceptos_costo cc
  WHERE cc.embarque_id = p_embarque_id AND cc.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf2 ON pf2.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = cc.id AND pf2.deleted_at IS NULL AND pf2.estado <> 'Cancelada');
  v_ok := (v_costos_sin_factura = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));

  SELECT COALESCE(sum(total),0) INTO v_cxp_total
  FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  -- v13.303.0 (FIX-16): moneda + soft-delete correctos en el bloque CxP.
  SELECT COALESCE(sum(pp.monto_en_moneda_factura),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp
  JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id
    AND pf.deleted_at IS NULL
    AND pp.deleted_at IS NULL
    AND pf.estado <> 'Cancelada';
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)));

  SELECT COUNT(*) FILTER (WHERE estado_facturacion = 'pendiente'),
         COUNT(*) FILTER (WHERE estado_facturacion = 'en_proforma')
    INTO v_venta_pendientes, v_venta_en_proforma
  FROM conceptos_venta WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  v_ok := (v_venta_pendientes = 0 AND v_venta_en_proforma = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes, 'en_proforma', v_venta_en_proforma)));

  SELECT
    COALESCE(SUM(public.saldo_factura(f.id)), 0),
    COALESCE(SUM(f.total), 0)
    INTO v_cxc_saldo, v_cxc_total
  FROM facturas f
  WHERE f.embarque_id = p_embarque_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');

  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_cxc_pagado
  FROM pagos_factura pf
  JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
    AND pf.deleted_at IS NULL;

  SELECT COALESCE(SUM(nc.monto), 0) INTO v_cxc_ncs
  FROM factura_notas_credito nc
  JOIN facturas f ON f.id = nc.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
    AND nc.deleted_at IS NULL
    AND nc.estado = 'Aplicada';

  v_ok := (v_cxc_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado,
      'notas_credito', v_cxc_ncs, 'saldo', v_cxc_saldo)));

  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[])
    INTO v_rep_pendientes, v_rep_ids
  FROM pagos_factura pf
  JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND f.deleted_at IS NULL
    AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
    AND pf.deleted_at IS NULL
    AND f.metodo_pago = 'PPD'
    AND COALESCE(pf.estado_rep, 'Pendiente') NOT IN ('Timbrado', 'No aplica');
  v_ok := (v_rep_pendientes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  SELECT COUNT(*) INTO v_com_count
  FROM comisiones_devengadas
  WHERE embarque_id = p_embarque_id AND definitiva = false;
  v_ok := (v_com_count = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count)));

  SELECT COALESCE((v_emb.pnl->>'utilidad')::numeric, 0) INTO v_utilidad;
  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global WHERE clave='margen_minimo_cierre' LIMIT 1), 0)
    INTO v_margen_min;
  v_ok := (v_utilidad >= v_margen_min);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END;
$function$;


-- ─── FIX-03 · convertir_proformas_a_factura ────────────────
CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[], p_serie_id uuid, p_metodo_pago text,
  p_forma_pago text, p_uso_cfdi text,
  p_dias_credito integer DEFAULT NULL, p_notas text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS SETOF facturas
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb; v_count int; v_first public.proformas;
  v_org uuid; v_caller_org uuid; v_cliente public.clientes;
  v_serie public.factura_series;
  v_subtotal_usd numeric := 0; v_iva_usd numeric := 0; v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0; v_iva_mxn numeric := 0; v_total_mxn numeric := 0;
  v_distinct_cli int; v_distinct_org int;
  v_factura_ids uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid; v_factura_usd_id uuid;
  v_numero_tmp text; v_embarque_ids uuid[];
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
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

  -- v13.303.0 (FIX-03): lock explícito para serializar caller concurrentes.
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
    RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas';
  END IF;

  SELECT * INTO v_first FROM public.proformas
    WHERE id = ANY(p_proforma_ids) ORDER BY created_at ASC LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

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
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_mxn_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
      )
      SELECT v_factura_mxn_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800'),
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN 'exento'
               WHEN COALESCE(pcc.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
               ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
             END,
             p.embarque_id, pcc.proforma_id
      FROM public.proforma_conceptos_consolidados pcc
      JOIN public.proformas p ON p.id = pcc.proforma_id
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'MXN'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
      )
      SELECT v_factura_mxn_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800'),
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN 'exento'
               WHEN COALESCE(cv.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
               ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
             END,
             p.embarque_id, cv.proforma_id
      FROM public.conceptos_venta cv
      JOIN public.proformas p ON p.id = cv.proforma_id
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'MXN'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0),
      COALESCE(SUM(cantidad * precio_unitario * COALESCE(tasa_iva_aplicada, 0)), 0)
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
      0, 0, 0, 'USD'::public.moneda, 1,
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_usd_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
      )
      SELECT v_factura_usd_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800'),
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN 'exento'
               WHEN COALESCE(pcc.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN pcc.tasa_iva_aplicada IS NULL AND pcc.aplica_iva = false THEN NULL
               ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16)
             END,
             p.embarque_id, pcc.proforma_id
      FROM public.proforma_conceptos_consolidados pcc
      JOIN public.proformas p ON p.id = pcc.proforma_id
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'USD'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
        tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
      )
      SELECT v_factura_usd_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800'),
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN 'exento'
               WHEN COALESCE(cv.tasa_iva_aplicada, 0.16) = 0 THEN 'tasa_0'
               ELSE 'gravado_16'
             END,
             CASE
               WHEN cv.tasa_iva_aplicada IS NULL AND cv.aplica_iva = false THEN NULL
               ELSE COALESCE(cv.tasa_iva_aplicada, 0.16)
             END,
             p.embarque_id, cv.proforma_id
      FROM public.conceptos_venta cv
      JOIN public.proformas p ON p.id = cv.proforma_id
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'USD'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    SELECT
      COALESCE(SUM(cantidad * precio_unitario), 0),
      COALESCE(SUM(cantidad * precio_unitario * COALESCE(tasa_iva_aplicada, 0)), 0)
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

  -- v13.303.0 (FIX-03): marca proformas como facturadas en la misma tx.
  IF array_length(v_factura_ids, 1) > 0 THEN
    UPDATE public.proformas
    SET estado_proforma = 'facturada', fecha_facturacion = CURRENT_DATE
    WHERE id = ANY(p_proforma_ids) AND estado_proforma <> 'facturada';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_commit(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;


-- ─── FIX-04 · Índice único anti doble-timbrado CFDI ─────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_facturapi_id
  ON public.facturas (facturapi_id) WHERE facturapi_id IS NOT NULL;


-- ─── FIX-05 · Folios de cotización atómicos ─────────────────
-- 1) Deduplicar folios existentes: renombrar los duplicados (excepto el
--    más antiguo por created_at) con sufijo `-DUP-<n>`.
WITH dup AS (
  SELECT id, folio, organization_id,
         row_number() OVER (
           PARTITION BY organization_id, folio ORDER BY created_at ASC
         ) AS rn
  FROM public.cotizaciones
)
UPDATE public.cotizaciones c
SET folio = dup.folio || '-DUP-' || dup.rn::text
FROM dup
WHERE dup.id = c.id AND dup.rn > 1;

-- 2) RPC atómica de folio.
CREATE OR REPLACE FUNCTION public.siguiente_folio_cotizacion(p_org_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_num bigint;
  v_anio text := to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY');
  v_tipo text := 'cotizacion_' || v_anio;
BEGIN
  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (p_org_id, v_tipo, 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;
  RETURN 'COT-' || v_anio || '-' || lpad(v_num::text, 4, '0');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.siguiente_folio_cotizacion(uuid) TO authenticated;

-- 3) Sembrar `folio_secuencias` con el máximo actual por org+año para no
--    reiniciar la numeración de cotizaciones existentes.
INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
SELECT
  organization_id,
  'cotizacion_' || substring(folio from 5 for 4) AS tipo,
  MAX(NULLIF(regexp_replace(substring(folio from 10), '\D.*$', '', 'g'), '')::bigint) AS ultimo_numero
FROM public.cotizaciones
WHERE folio ~ '^COT-[0-9]{4}-[0-9]+'
  AND organization_id IS NOT NULL
GROUP BY organization_id, substring(folio from 5 for 4)
ON CONFLICT (organization_id, tipo)
DO UPDATE SET ultimo_numero = GREATEST(folio_secuencias.ultimo_numero, EXCLUDED.ultimo_numero),
              updated_at = now();

-- 4) Índice único por org+folio.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cotizaciones_org_folio
  ON public.cotizaciones (organization_id, folio);


-- ─── FIX-07/21 · Anti doble conversión cotización → embarque ─
CREATE UNIQUE INDEX IF NOT EXISTS uq_cotizaciones_embarque_id
  ON public.cotizaciones (embarque_id) WHERE embarque_id IS NOT NULL;