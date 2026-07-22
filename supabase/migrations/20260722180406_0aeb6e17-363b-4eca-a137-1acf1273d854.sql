
-- ============================================================================
-- R3 · Correcciones consolidadas (bugs verificados como reales)
-- ============================================================================

-- ------------------------------------------------------------
-- FIX-R3-02 · Pagos CxP en misma moneda no deben exigir TC
-- ------------------------------------------------------------
ALTER TABLE public.pagos_proveedor ALTER COLUMN tipo_cambio_usd DROP NOT NULL;
-- El CHECK pagos_proveedor_tc_pos ya permite NULL (verificado).
-- El trigger tg_pagos_proveedor_monto_convertido usa convertir_monto_pago_a_factura,
-- que sólo exige TC cuando la moneda del pago difiere de la factura (LC_PAGO_TC_REQUERIDO).

-- ------------------------------------------------------------
-- FIX-R3-03 · Índices únicos de contenedor y BL house
--             (excluyendo la organización demo con duplicados históricos)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS contenedores_numero_unico
  ON public.embarque_contenedores (organization_id, numero_contenedor)
  WHERE numero_contenedor IS NOT NULL
    AND numero_contenedor <> ''
    AND deleted_at IS NULL
    AND organization_id <> '00000000-0000-0000-0000-000000000001'::uuid;

CREATE UNIQUE INDEX IF NOT EXISTS contenedores_bl_house_unico
  ON public.embarque_contenedores (embarque_id, bl_house)
  WHERE bl_house IS NOT NULL
    AND bl_house <> ''
    AND deleted_at IS NULL
    AND organization_id <> '00000000-0000-0000-0000-000000000001'::uuid;

-- ------------------------------------------------------------
-- FIX-R3-07 · Margen mínimo como porcentaje + propagar errores del PNL
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
  v_utilidad_mxn numeric; v_venta_mxn numeric; v_margen_min numeric; v_margen_pct numeric;
  v_pnl jsonb; v_pnl_error text;
  v_com_count int;
  v_cont_incompletos int := 0; v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_cont_sin_fechas int := 0; v_cont_fechas_ids uuid[] := ARRAY[]::uuid[];
  v_tiene_contenedores boolean := false;
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
  v_rep_pendientes int := 0; v_rep_ids uuid[] := ARRAY[]::uuid[];
  v_caller_org uuid;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  v_caller_org := public.current_user_org_id();
  IF v_caller_org IS NOT NULL
     AND v_emb.organization_id <> v_caller_org
     AND NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: sin acceso al embarque' USING ERRCODE='P0001';
  END IF;

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

  SELECT EXISTS (SELECT 1 FROM embarque_contenedores
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL) INTO v_tiene_contenedores;
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

  SELECT COUNT(*) INTO v_docs_faltantes FROM documentos_embarque de
   WHERE de.embarque_id = p_embarque_id AND de.deleted_at IS NULL
     AND (de.archivo IS NULL OR de.archivo = '') AND de.estado <> 'No aplica';
  v_ok := (v_docs_faltantes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  SELECT COUNT(*) INTO v_costos_sin_factura FROM conceptos_costo cc
   WHERE cc.embarque_id = p_embarque_id AND cc.deleted_at IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM proveedor_facturas_conceptos pfc
       JOIN proveedor_facturas pf2 ON pf2.id = pfc.proveedor_factura_id
       WHERE pfc.concepto_costo_id = cc.id AND pf2.deleted_at IS NULL AND pf2.estado <> 'Cancelada');
  v_ok := (v_costos_sin_factura = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','costo_conceptos_con_factura','ok',v_ok,
    'detalle', jsonb_build_object('sin_factura', v_costos_sin_factura)));

  SELECT COALESCE(sum(total),0) INTO v_cxp_total FROM proveedor_facturas
   WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
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

  SELECT COALESCE(SUM(public.saldo_factura(f.id)), 0), COALESCE(SUM(f.total), 0)
    INTO v_cxc_saldo, v_cxc_total FROM facturas f
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador');
  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_cxc_pagado
    FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador') AND pf.deleted_at IS NULL;
  SELECT COALESCE(SUM(nc.monto), 0) INTO v_cxc_ncs
    FROM factura_notas_credito nc JOIN facturas f ON f.id = nc.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
     AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';
  v_ok := (v_cxc_saldo <= 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado,
      'notas_credito', v_cxc_ncs, 'saldo', v_cxc_saldo)));

  SELECT COUNT(*), COALESCE(array_agg(pf.id), ARRAY[]::uuid[])
    INTO v_rep_pendientes, v_rep_ids
    FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
   WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
     AND f.estado NOT IN ('Cancelada', 'Sustituida', 'Borrador')
     AND pf.deleted_at IS NULL AND f.metodo_pago = 'PPD'
     AND COALESCE(pf.estado_rep, 'Pendiente') NOT IN ('Timbrado', 'No aplica');
  v_ok := (v_rep_pendientes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','rep_timbrados','ok',v_ok,
    'detalle', jsonb_build_object('pendientes', v_rep_pendientes, 'ids', v_rep_ids)));

  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas
   WHERE embarque_id = p_embarque_id AND definitiva = false;
  v_ok := (v_com_count = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comisiones_definitivas','ok',v_ok,
    'detalle', jsonb_build_object('no_definitivas', v_com_count)));

  -- FIX-R3-07: capturar utilidad Y venta desde el PNL; propagar errores en el check.
  v_pnl_error := NULL;
  v_utilidad_mxn := 0;
  v_venta_mxn := 0;
  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
    v_utilidad_mxn := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
    v_venta_mxn := COALESCE((v_pnl->>'venta_mxn')::numeric, 0);
  EXCEPTION WHEN OTHERS THEN
    v_pnl_error := SQLERRM;
  END;

  IF v_pnl_error IS NOT NULL THEN
    v_puede := v_puede AND false;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'regla','pnl_error','ok',false,
      'detalle', jsonb_build_object('error', v_pnl_error)));
  END IF;

  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global
     WHERE categoria='fiscal' AND clave='pnl_margen_minimo_cierre' LIMIT 1), 0)
    INTO v_margen_min;

  -- Margen como PORCENTAJE (antes: comparación absoluta).
  v_margen_pct := CASE WHEN v_venta_mxn > 0
                       THEN ROUND(v_utilidad_mxn / v_venta_mxn * 100.0, 2)
                       ELSE 0 END;
  v_ok := (v_venta_mxn <= 0) OR (v_margen_pct >= v_margen_min);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object(
      'utilidad_mxn', v_utilidad_mxn,
      'venta_mxn', v_venta_mxn,
      'margen_pct', v_margen_pct,
      'minimo_pct', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END $function$;

-- ------------------------------------------------------------
-- FIX-R3-08 · Bloquear UPDATE directo a 'Cerrado' (sólo cerrar_embarque)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_embarque_transicion_valida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Bypass controlado para backfills / migraciones legítimas.
  IF current_setting('app.bypass_transicion', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- FIX-R3-08: la transición a 'Cerrado' sólo puede ejecutarla cerrar_embarque(),
  -- que corre validar_cierre_embarque() y setea app.bypass_cierre='on'.
  IF NEW.estado = 'Cerrado'
     AND (OLD.estado IS DISTINCT FROM 'Cerrado')
     AND COALESCE(current_setting('app.bypass_cierre', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'LC_CIERRE_SOLO_RPC: use cerrar_embarque() para cerrar embarques' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.assert_transicion_embarque(OLD.estado, NEW.estado, NEW.expediente);
  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------
-- FIX-R3-09 · Soft delete de pagos vía RPC SECURITY DEFINER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_pago_factura(p_pago_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.pagos_factura WHERE id = p_pago_id;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO' USING ERRCODE='P0002';
  END IF;
  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(auth.uid(),'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN' USING ERRCODE='P0001';
  END IF;
  IF NOT public.es_escritor_financiero(auth.uid()) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO' USING ERRCODE='P0001';
  END IF;

  UPDATE public.pagos_factura
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_pago_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_pago_factura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_pago_factura(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.soft_delete_pago_proveedor(p_pago_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_deleted timestamptz;
BEGIN
  SELECT organization_id, deleted_at INTO v_org, v_deleted
    FROM public.pagos_proveedor WHERE id = p_pago_id;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO' USING ERRCODE='P0002';
  END IF;
  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(auth.uid(),'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN' USING ERRCODE='P0001';
  END IF;
  IF NOT public.es_escritor_financiero(auth.uid()) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO' USING ERRCODE='P0001';
  END IF;

  UPDATE public.pagos_proveedor
    SET deleted_at = now(), updated_at = now()
    WHERE id = p_pago_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_pago_proveedor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_pago_proveedor(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- FIX-R3-20 · Integridad menor (NOT VALID para no romper histórico)
-- ------------------------------------------------------------
ALTER TABLE public.conceptos_venta
  DROP CONSTRAINT IF EXISTS conceptos_venta_total_calc;
ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_total_calc
  CHECK (ABS(total - ROUND(cantidad * precio_unitario, 2)) <= 0.01) NOT VALID;

ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_total_escala;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_total_escala
  CHECK (total IS NULL OR total = ROUND(total, 2)) NOT VALID;
