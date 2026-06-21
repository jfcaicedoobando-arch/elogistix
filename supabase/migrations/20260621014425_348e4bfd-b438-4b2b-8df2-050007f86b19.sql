
CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_concepto(p_concepto_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pagado boolean; v_fecha date;
BEGIN
  IF p_concepto_id IS NULL THEN RETURN; END IF;
  SELECT
    EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada')
    AND NOT EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        AND COALESCE(pf.total, 0) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0) + 0.01)
  INTO v_pagado;

  SELECT MAX(pp.fecha_pago) INTO v_fecha
  FROM proveedor_facturas_conceptos pfc
  JOIN pagos_proveedor pp ON pp.proveedor_factura_id = pfc.proveedor_factura_id
  WHERE pfc.concepto_costo_id = p_concepto_id AND pp.deleted_at IS NULL;

  UPDATE conceptos_costo
     SET estado_liquidacion = CASE WHEN v_pagado THEN 'Pagado' ELSE 'Pendiente' END::estado_liquidacion,
         fecha_pago = CASE WHEN v_pagado THEN v_fecha ELSE NULL END
   WHERE id = p_concepto_id;
END $$;

CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_factura(p_factura_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF p_factura_id IS NULL THEN RETURN; END IF;
  FOR r IN
    SELECT DISTINCT concepto_costo_id FROM proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NOT NULL
  LOOP
    PERFORM recalcular_estado_liquidacion_concepto(r.concepto_costo_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.tg_pagos_proveedor_recalc_liq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') THEN
    PERFORM recalcular_estado_liquidacion_factura(NEW.proveedor_factura_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_estado_liquidacion_factura(OLD.proveedor_factura_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.proveedor_factura_id IS DISTINCT FROM NEW.proveedor_factura_id THEN
    PERFORM recalcular_estado_liquidacion_factura(OLD.proveedor_factura_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_pagos_proveedor_recalc_liq ON public.pagos_proveedor;
CREATE TRIGGER trg_pagos_proveedor_recalc_liq
AFTER INSERT OR UPDATE OR DELETE ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public.tg_pagos_proveedor_recalc_liq();

CREATE OR REPLACE FUNCTION public.tg_pfc_recalc_liq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.concepto_costo_id IS NOT NULL THEN
    PERFORM recalcular_estado_liquidacion_concepto(NEW.concepto_costo_id);
  END IF;
  IF TG_OP = 'DELETE' AND OLD.concepto_costo_id IS NOT NULL THEN
    PERFORM recalcular_estado_liquidacion_concepto(OLD.concepto_costo_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.concepto_costo_id IS NOT NULL
        AND OLD.concepto_costo_id IS DISTINCT FROM NEW.concepto_costo_id THEN
    PERFORM recalcular_estado_liquidacion_concepto(OLD.concepto_costo_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_pfc_recalc_liq ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_pfc_recalc_liq
AFTER INSERT OR UPDATE OR DELETE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public.tg_pfc_recalc_liq();

CREATE OR REPLACE FUNCTION public.tg_proveedor_facturas_recalc_liq()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.estado IS DISTINCT FROM OLD.estado)
     OR (NEW.total IS DISTINCT FROM OLD.total)
     OR (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) THEN
    PERFORM recalcular_estado_liquidacion_factura(NEW.id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_proveedor_facturas_recalc_liq ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_recalc_liq
AFTER UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public.tg_proveedor_facturas_recalc_liq();

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT cc.id FROM conceptos_costo cc
    JOIN embarques e ON e.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL
      AND e.estado IS DISTINCT FROM 'Cerrado'::estado_embarque
  LOOP
    PERFORM recalcular_estado_liquidacion_concepto(r.id);
  END LOOP;
END $$;

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
  v_venta_pendientes int; v_venta_en_proforma int;
  v_costos_sin_factura int;
BEGIN
  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;

  SELECT COALESCE(sum(total),0) INTO v_cxc_total
  FROM facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pf.monto),0) INTO v_cxc_pagado
  FROM pagos_factura pf JOIN facturas f ON f.id = pf.factura_id
  WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada';
  v_ok := (v_cxc_total <= v_cxc_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxc_total, 'pagado', v_cxc_pagado)));

  SELECT COALESCE(sum(total),0) INTO v_cxp_total
  FROM proveedor_facturas WHERE embarque_id = p_embarque_id AND deleted_at IS NULL AND estado <> 'Cancelada';
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp JOIN proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';
  v_ok := (v_cxp_total <= v_cxp_pagado + 0.01); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxp_pagada','ok',v_ok,
    'detalle', jsonb_build_object('total', v_cxp_total, 'pagado', v_cxp_pagado)));

  SELECT COUNT(*) INTO v_docs_faltantes
  FROM documentos_embarque de
  WHERE de.embarque_id = p_embarque_id AND de.deleted_at IS NULL
    AND (de.archivo IS NULL OR de.archivo = '') AND de.estado <> 'No aplica';
  v_ok := (v_docs_faltantes = 0); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','docs_completos','ok',v_ok,
    'detalle', jsonb_build_object('faltantes', v_docs_faltantes)));

  BEGIN v_pnl := pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN v_pnl := '{}'::jsonb; END;
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric, (v_pnl->>'utilidad')::numeric, 0);
  SELECT COALESCE((valor)::text::numeric, 0) INTO v_margen_min
  FROM configuracion_global WHERE categoria='cierre' AND clave='cierre_margen_minimo';
  v_ok := (v_utilidad >= COALESCE(v_margen_min, 0)); v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','pnl_margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)));

  SELECT count(*) INTO v_com_count FROM comisiones_devengadas cd WHERE cd.embarque_id = p_embarque_id;
  v_ok := true;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','comision_calculada','ok',v_ok,
    'detalle', jsonb_build_object('count', v_com_count)));

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

  RETURN jsonb_build_object(
    'embarque_id', p_embarque_id,
    'puede_cerrar', v_puede,
    'checks', v_checks);
END;
$function$;
