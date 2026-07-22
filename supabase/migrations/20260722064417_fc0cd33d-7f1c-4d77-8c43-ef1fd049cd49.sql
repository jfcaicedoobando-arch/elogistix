
-- ============================================================
-- FIX-R2 BLOQUE A (P0) — 4 fixes críticos de release
-- ============================================================

-- ------------------------------------------------------------
-- FIX-R2-01 · validar_cierre_embarque: JOIN correcto, utilidad
-- desde pnl_financiero_embarque(), clave config real
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_saldo numeric; v_cxc_total numeric; v_cxc_pagado numeric; v_cxc_ncs numeric;
  v_cxp_total numeric; v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_margen_min numeric;
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

  -- FIX-R2-01(1): JOIN correcto es pp.proveedor_factura_id, NO pp.factura_id
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp
  JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
    AND pp.deleted_at IS NULL;

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
    'detalle', jsonb_build_object(
      'total', v_cxc_total, 'pagado', v_cxc_pagado,
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

  -- FIX-R2-01(2,3): utilidad EN VIVO desde pnl_financiero_embarque, en MXN
  BEGIN
    SELECT COALESCE((public.pnl_financiero_embarque(p_embarque_id)->>'utilidad_mxn')::numeric, 0)
      INTO v_utilidad_mxn;
  EXCEPTION WHEN OTHERS THEN
    v_utilidad_mxn := 0;
  END;

  -- FIX-R2-01(4): clave real es pnl_margen_minimo_cierre
  SELECT COALESCE((
    SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1
  ), 0) INTO v_margen_min;

  v_ok := (v_utilidad_mxn >= v_margen_min);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad_mxn', v_utilidad_mxn, 'minimo', v_margen_min)));

  RETURN jsonb_build_object(
    'puede_cerrar', v_puede,
    'checks', v_checks);
END;
$function$;


-- ------------------------------------------------------------
-- FIX-R2-02 · convertir_proformas_a_factura: gate unificado
-- (es_escritor_financiero + super_admin). Drop overloads viejos.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.convertir_proformas_a_factura(uuid);
DROP FUNCTION IF EXISTS public.convertir_proformas_a_factura(uuid, uuid);

CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[],
  p_serie_id uuid,
  p_metodo_pago text,
  p_forma_pago text,
  p_uso_cfdi text,
  p_dias_credito integer DEFAULT NULL::integer,
  p_notas text DEFAULT NULL::text,
  p_request_id uuid DEFAULT NULL::uuid
) RETURNS SETOF facturas
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

  -- FIX-R2-02: gate unificado (admin org/contador vía es_escritor_financiero, o super_admin)
  IF NOT (
    public.es_escritor_financiero(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas';
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

  IF array_length(v_factura_ids, 1) > 0 THEN
    UPDATE public.proformas
    SET estado_proforma = 'facturada', fecha_facturacion = CURRENT_DATE
    WHERE id = ANY(p_proforma_ids) AND estado_proforma <> 'facturada';
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_store(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;


-- ------------------------------------------------------------
-- FIX-R2-03 · check_no_sobrepago_proveedor: calcular conversión
-- DENTRO del guard, con FOR UPDATE del padre. Rechaza cruces
-- no soportados y usa TOTAL (con IVA) como tope.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_no_sobrepago_proveedor()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fac public.proveedor_facturas%ROWTYPE;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_monto_factura numeric;
  v_tc numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.monto IS NULL OR NEW.monto <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_MONTO_INVALIDO: el monto debe ser mayor a cero'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Lock del padre para serializar pagos concurrentes.
  SELECT * INTO v_fac
    FROM public.proveedor_facturas
   WHERE id = NEW.proveedor_factura_id
   FOR UPDATE;

  IF v_fac.id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_INEXISTENTE';
  END IF;

  IF v_fac.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_NO_VIVA: la factura de proveedor está cancelada'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Convertir monto del pago a la moneda de la factura (independiente del orden de triggers).
  v_tc := COALESCE(NULLIF(NEW.tipo_cambio_usd, 0), NULLIF(v_fac.tipo_cambio_usd, 0));
  v_monto_factura := CASE
    WHEN NEW.moneda = v_fac.moneda THEN NEW.monto
    WHEN NEW.moneda = 'MXN' AND v_fac.moneda = 'USD' THEN NEW.monto / NULLIF(v_tc, 0)
    WHEN NEW.moneda = 'USD' AND v_fac.moneda = 'MXN' THEN NEW.monto * v_tc
    ELSE NULL
  END;

  IF v_monto_factura IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_CRUCE_NO_SOPORTADO: pago en % contra factura en % sin TC válido',
      NEW.moneda, v_fac.moneda
      USING ERRCODE = 'check_violation';
  END IF;

  -- Fijar el campo calculado; el trigger separado de conversión queda redundante y no rompe nada.
  NEW.monto_en_moneda_factura := ROUND(v_monto_factura, 2);

  -- FIX-R2-08 · Diferencial cambiario CxP (solo pago MXN sobre factura USD)
  IF NEW.moneda = 'MXN' AND v_fac.moneda = 'USD'
     AND NEW.tipo_cambio_usd IS NOT NULL AND v_fac.tipo_cambio_usd IS NOT NULL THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fac.tipo_cambio_usd), 2);
  END IF;

  -- Sumar pagos VIVOS previos + NCs aplicadas y validar contra TOTAL con IVA.
  SELECT COALESCE(SUM(pp.monto_en_moneda_factura), 0) INTO v_pagos_otros
    FROM public.pagos_proveedor pp
   WHERE pp.proveedor_factura_id = NEW.proveedor_factura_id
     AND pp.deleted_at IS NULL
     AND pp.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
    FROM public.proveedor_notas_credito
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND estado = 'Aplicada';

  IF v_pagos_otros + v_ncs + NEW.monto_en_moneda_factura > COALESCE(v_fac.total, 0) + 0.01 THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT = json_build_object(
              'saldo_disponible', GREATEST(COALESCE(v_fac.total,0) - v_pagos_otros - v_ncs, 0),
              'monto_intentado', NEW.monto_en_moneda_factura
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;


-- ------------------------------------------------------------
-- FIX-R2-04 · is_org_member + guard estado_proveedor_factura
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.current_user_org_id() = p_org
      OR public.has_role(auth.uid(), 'super_admin'::app_role);
$function$;

CREATE OR REPLACE FUNCTION public.guard_estado_proveedor_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- Solo se permite pasar a Cancelada vía cancelar_factura_proveedor()
  IF NEW.estado = 'Cancelada'::public.estado_proveedor_factura
     AND current_setting('app.cancelando_cxp', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'LC_CXP_CANCEL_DIRECTA: use cancelar_factura_proveedor()'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_CXP_REAPERTURA: una factura cancelada no puede reabrirse'
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.estado = 'Pagada'::public.estado_proveedor_factura
     AND NEW.estado <> 'Pagada'::public.estado_proveedor_factura
     AND current_setting('app.recalc_cxp', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'LC_CXP_PAGADA_INMUTABLE: factura pagada; ajuste vía flujo de pagos'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_estado_proveedor_factura ON public.proveedor_facturas;
CREATE TRIGGER trg_guard_estado_proveedor_factura
  BEFORE UPDATE OF estado ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public.guard_estado_proveedor_factura();

-- Envolver el UPDATE de cancelar_factura_proveedor con la marca de sesión.
CREATE OR REPLACE FUNCTION public.cancelar_factura_proveedor(p_factura_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado public.estado_proveedor_factura;
  v_deleted timestamptz;
  v_org uuid;
  v_pagado numeric;
  v_ncs_canceladas int;
  v_uid uuid := auth.uid();
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debes indicar un motivo de cancelación.' USING ERRCODE = '22023';
  END IF;

  SELECT estado, deleted_at, organization_id
    INTO v_estado, v_deleted, v_org
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes de cancelarla.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta factura.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'No puedes cancelar la factura: tiene pagos aplicados por %. Elimina o anula los pagos primero.', v_pagado
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.proveedor_notas_credito
     SET estado = 'Cancelada'::public.estado_nota_credito_proveedor,
         updated_at = now()
   WHERE proveedor_factura_id = p_factura_id
     AND deleted_at IS NULL
     AND estado <> 'Cancelada'::public.estado_nota_credito_proveedor;
  GET DIAGNOSTICS v_ncs_canceladas = ROW_COUNT;

  -- Marca de sesión para permitir la transición a Cancelada.
  PERFORM set_config('app.cancelando_cxp','1', true);

  UPDATE public.proveedor_facturas
     SET estado = 'Cancelada'::public.estado_proveedor_factura,
         fecha_cancelacion = now(),
         motivo_cancelacion = btrim(p_motivo),
         cancelada_por = v_uid,
         updated_at = now()
   WHERE id = p_factura_id;

  PERFORM set_config('app.cancelando_cxp','0', true);

  IF to_regclass('public.bitacora_actividad') IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org, v_uid, 'cxp.cancelada', 'compras', p_factura_id, NULL,
       jsonb_build_object('motivo', btrim(p_motivo), 'ncs_canceladas', v_ncs_canceladas));
  END IF;
END;
$function$;
