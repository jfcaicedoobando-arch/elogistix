CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb;
  v_puede boolean := true;
  v_ok boolean;
  v_cxc_total numeric; v_cxc_pagado numeric;
  v_cxp_total numeric; v_cxp_pagado numeric;
  v_docs_faltantes int;
  v_pnl jsonb; v_utilidad numeric; v_margen_min numeric;
  v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  -- 1) Operación: datos de contenedores (solo FCL marítimo)
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

    -- 1b) Operación: fechas de descarga y devolución capturadas
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

  -- 2) Documentación
  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque de
  WHERE de.embarque_id = p_embarque_id AND de.deleted_at IS NULL
    AND (de.archivo IS NULL OR de.archivo = '') AND de.estado <> 'No aplica';
  v_ok := (v_docs_faltantes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  -- 3) Costos: facturas de proveedor recibidas
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

  -- 4) Costos: cuentas por pagar pagadas
  SELECT COALESCE(sum(total),0) INTO v_cxp_total
  FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)));

  -- 5) Venta: conceptos facturados
  SELECT
    COUNT(*) FILTER (WHERE cv.estado_facturacion = 'pendiente' AND cv.proforma_id IS NULL),
    COUNT(*) FILTER (WHERE cv.estado_facturacion = 'en_proforma'
                       AND COALESCE(p.estado_proforma, 'pendiente') <> 'facturada')
    INTO v_venta_pendientes, v_venta_en_proforma
  FROM conceptos_venta cv
  LEFT JOIN proformas p ON p.id = cv.proforma_id AND p.deleted_at IS NULL
  WHERE cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL;
  v_ok := (v_venta_pendientes = 0 AND v_venta_en_proforma = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes, 'en_proforma', v_venta_en_proforma)));

  -- 6) Venta: cuentas por cobrar cobradas
  SELECT COALESCE(sum(total),0) INTO v_cxc_total
  FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pf.monto),0) INTO v_cxc_pagado
  FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada';
  v_ok := (v_cxc_total <= v_cxc_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado)));

  -- 7) Fiscal: REPs pendientes
  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[])
    INTO v_rep_pendientes, v_rep_ids
  FROM pagos_factura pf
  JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id
    AND pf.estado_rep = 'Pendiente'
    AND pf.deleted_at IS NULL;
  v_ok := (v_rep_pendientes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_pendientes','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  -- 8) Cierre financiero: margen mínimo
  BEGIN v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN v_pnl := '{}'::jsonb; END;
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric, (v_pnl->>'utilidad')::numeric, 0);
  SELECT COALESCE((valor)::text::numeric, 0) INTO v_margen_min
  FROM configuracion_global WHERE categoria='cierre' AND clave='cierre_margen_minimo';
  v_ok := (v_utilidad >= COALESCE(v_margen_min, 0)); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','pnl_margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)));

  -- 9) Cierre financiero: comisión devengada
  SELECT count(*) INTO v_com_count FROM comisiones_devengadas cd WHERE cd.embarque_id = p_embarque_id;
  v_ok := true;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comision_calculada','ok',v_ok,
    'detalle', jsonb_build_object('count', v_com_count)));

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'puede_cerrar', v_puede,
    'checks', v_checks);
END;
$function$;