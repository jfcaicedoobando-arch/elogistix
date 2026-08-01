-- Fuente canónica de public.validar_cierre_embarque
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.
-- v13.381.1: paso 1 incluye costos sin proveedor; paso 2 falla con buzón vacío + costos sin factura.
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_checks jsonb := '[]'::jsonb; v_puede boolean := true; v_ok boolean;
  v_cxc_saldo numeric := 0; v_cxc_por_moneda jsonb := '[]'::jsonb;
  v_cxp_saldo numeric := 0; v_cxp_por_moneda jsonb := '[]'::jsonb;
  v_docs_faltantes int;
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_ent_pendientes int := 0; v_ent_dias_max int := 0;
  v_ent_total int := 0; v_ent_vacio boolean := false;
  v_prov_sin_evidencia int := 0; v_prov_nombres text[] := ARRAY[]::text[];
  v_caller_org uuid; v_uid uuid; v_is_service boolean;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id=p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();
  v_is_service := (COALESCE(auth.role()::text,'') = 'service_role');
  IF NOT v_is_service AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_emb.organization_id <> v_caller_org THEN
      RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='42501';
    END IF;
  END IF;

  IF v_emb.modo='Marítimo' AND COALESCE(v_emb.tipo_carga,'') ILIKE 'FCL%' THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_incompletos, v_cont_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (peso_kg IS NULL OR peso_kg<=0 OR volumen_m3 IS NULL OR volumen_m3<=0);
    v_ok := (v_cont_incompletos=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_datos_completos','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_incompletos', v_cont_incompletos, 'ids', v_cont_ids)));
  END IF;

  SELECT EXISTS (SELECT 1 FROM embarque_contenedores
    WHERE embarque_id=p_embarque_id AND deleted_at IS NULL) INTO v_tiene_contenedores;
  IF v_tiene_contenedores THEN
    SELECT COUNT(*), COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_cont_sin_fechas, v_cont_fechas_ids
    FROM embarque_contenedores WHERE embarque_id=p_embarque_id AND deleted_at IS NULL
      AND (fecha_descarga IS NULL OR fecha_devolucion IS NULL);
    v_ok := (v_cont_sin_fechas=0); v_puede := v_puede AND v_ok;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','contenedores_fechas_completas','ok',v_ok,
      'detalle', jsonb_build_object('contenedores_sin_fechas', v_cont_sin_fechas, 'ids', v_cont_fechas_ids)));
  END IF;

  SELECT COUNT(*) INTO v_docs_faltantes FROM documentos_embarque de
   WHERE de.embarque_id=p_embarque_id AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo='') AND de.estado<>'No aplica';
  v_ok := (v_docs_faltantes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  SELECT COUNT(*) INTO v_costos_sin_factura FROM conceptos_costo cc
   WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
       JOIN proveedor_facturas pf2 ON pf2.id=pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id=cc.id AND pf2.deleted_at IS NULL AND pf2.estado<>'Cancelada');
  v_ok := (v_costos_sin_factura=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));

  -- Buzón CxP: ningún invoice puede quedar sin capturar.
  SELECT COUNT(*),
         COALESCE(MAX(GREATEST(0, (now()::date - efe.created_at::date))), 0)
    INTO v_ent_pendientes, v_ent_dias_max
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')='por_capturar';
  SELECT COUNT(*) INTO v_ent_total
    FROM embarque_facturas_entrantes efe
   WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
     AND COALESCE(efe.estado,'por_capturar')<>'rechazada';
  v_ent_vacio := (v_ent_total=0 AND v_costos_sin_factura>0);
  v_ok := (v_ent_pendientes=0 AND NOT v_ent_vacio); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_capturadas','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_ent_pendientes, 'dias_max', v_ent_dias_max,
      'buzon_vacio', v_ent_vacio, 'costos_sin_factura', v_costos_sin_factura)));

  -- Evidencia: cada proveedor con costos debe tener al menos un archivo en el buzón.
  SELECT COUNT(*), COALESCE(array_agg(nombre ORDER BY nombre), ARRAY[]::text[])
    INTO v_prov_sin_evidencia, v_prov_nombres
    FROM (
      -- a) Proveedores identificados con costos y sin ningun archivo en el buzon.
      SELECT DISTINCT COALESCE(NULLIF(cc.proveedor_nombre,''), 'Proveedor sin nombre') AS nombre
        FROM conceptos_costo cc
       WHERE cc.embarque_id=p_embarque_id AND cc.deleted_at IS NULL
         AND cc.proveedor_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM embarque_facturas_entrantes efe
            WHERE efe.embarque_id=p_embarque_id AND efe.deleted_at IS NULL
              AND efe.proveedor_id=cc.proveedor_id
              AND COALESCE(efe.estado,'por_capturar')<>'rechazada')
      UNION
      -- b) Costos sin proveedor asignado: imposible acreditar evidencia.
      SELECT 'Costos sin proveedor asignado' AS nombre
       WHERE EXISTS (
         SELECT 1 FROM conceptos_costo cc2
          WHERE cc2.embarque_id=p_embarque_id AND cc2.deleted_at IS NULL
            AND cc2.proveedor_id IS NULL)
    ) faltantes;
  v_ok := (v_prov_sin_evidencia=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','facturas_entrantes_evidencia','ok',v_ok,
    'detalle', jsonb_build_object('proveedores_sin_evidencia', v_prov_sin_evidencia, 'proveedores', v_prov_nombres)));

  WITH agg AS (
    SELECT COALESCE(pf.moneda,'MXN') AS moneda, COALESCE(SUM(pf.total),0) AS total,
      COALESCE(SUM((SELECT COALESCE(SUM(pp.monto),0) FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL)),0) AS pagado,
      COUNT(*) FILTER (WHERE pf.total > COALESCE((
        SELECT SUM(pp.monto) FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL),0) + 0.01) AS facturas_pendientes
    FROM proveedor_facturas pf
    WHERE pf.embarque_id=p_embarque_id AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY COALESCE(pf.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,
      'saldo',GREATEST(total-pagado,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(total-pagado,0)),0)
  INTO v_cxp_por_moneda, v_cxp_saldo FROM agg;
  v_ok := (v_cxp_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxp_por_moneda, 'saldo_total', v_cxp_saldo)));

  SELECT COUNT(*) FILTER (WHERE estado_facturacion='pendiente'),
         COUNT(*) FILTER (WHERE estado_facturacion='en_proforma')
    INTO v_venta_pendientes, v_venta_en_proforma
    FROM conceptos_venta WHERE embarque_id=p_embarque_id AND deleted_at IS NULL;
  v_ok := (v_venta_pendientes=0 AND v_venta_en_proforma=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','venta_conceptos_facturados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_venta_pendientes, 'en_proforma', v_venta_en_proforma)));

  WITH agg AS (
    SELECT COALESCE(f.moneda,'MXN') AS moneda, COALESCE(SUM(f.total),0) AS total,
      COALESCE(SUM(public.saldo_factura(f.id)),0) AS saldo,
      COALESCE(SUM((SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) FROM pagos_factura pf
        WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL)),0) AS pagado,
      COALESCE(SUM((SELECT COALESCE(SUM(nc.monto),0) FROM factura_notas_credito nc
        WHERE nc.factura_id=f.id AND nc.deleted_at IS NULL AND nc.estado='Aplicada')),0) AS notas_credito,
      COUNT(*) FILTER (WHERE public.saldo_factura(f.id) > 0.01) AS facturas_pendientes
    FROM facturas f
    WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
    GROUP BY COALESCE(f.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,'notas_credito',notas_credito,
      'saldo',GREATEST(saldo,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(saldo,0)),0)
  INTO v_cxc_por_moneda, v_cxc_saldo FROM agg;
  v_ok := (v_cxc_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxc_por_moneda, 'saldo_total', v_cxc_saldo)));

  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[]) INTO v_rep_pendientes, v_rep_ids
    FROM pagos_factura pf JOIN facturas f ON f.id=pf.factura_id
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
     AND pf.deleted_at IS NULL AND f.metodo_pago='PPD'
     AND COALESCE(pf.estado_rep,'Pendiente') NOT IN ('Timbrado','No aplica');
  v_ok := (v_rep_pendientes=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas
   WHERE embarque_id=p_embarque_id AND definitiva=false;
  v_ok := (v_com_count=0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count)));

  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
    v_utilidad_mxn := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
    v_venta_mxn := COALESCE(
      (v_pnl->'venta'->>'real_mxn')::numeric,
      (v_pnl->>'venta_mxn')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_utilidad_mxn := 0; v_venta_mxn := 0;
  END;

  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0) INTO v_margen_min;

  v_margen_pct := CASE WHEN v_venta_mxn>0 THEN ROUND(v_utilidad_mxn/v_venta_mxn*100.0,2) ELSE NULL END;
  v_ok := (v_margen_pct IS NOT NULL) AND (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object(
      'utilidad_mxn', v_utilidad_mxn, 'venta_mxn', v_venta_mxn,
      'margen_pct', v_margen_pct, 'minimo_pct', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $function$

;
