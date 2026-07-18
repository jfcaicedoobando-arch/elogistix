
-- Fase D (v13.301.73) — Definición única de "factura viva" + NCs en saldo

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total numeric;
  v_estado estado_factura;
  v_pagos numeric;
  v_ncs numeric;
BEGIN
  SELECT total, estado INTO v_total, v_estado
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id
    AND deleted_at IS NULL
    AND estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

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
  SELECT COALESCE(sum(pp.monto),0) INTO v_cxp_pagado
  FROM pagos_proveedor pp JOIN proveedor_facturas pf ON pf.id = pp.factura_id
  WHERE pf.embarque_id = p_embarque_id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';
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

  -- 6) CxC cobrada — v13.301.73: saldo_factura + excluye Sustituida/Borrador + resta NCs
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
      'total', v_cxc_total,
      'pagado', v_cxc_pagado,
      'notas_credito', v_cxc_ncs,
      'saldo', v_cxc_saldo)));

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

  RETURN jsonb_build_object(
    'puede_cerrar', v_puede,
    'checks', v_checks);
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_cobro_embarques(p_embarque_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emb uuid;
  v_total int;
  v_pagadas int;
  v_parciales int;
  v_nuevo text;
BEGIN
  IF p_embarque_ids IS NULL OR array_length(p_embarque_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_cierre', 'on', true);

  FOREACH v_emb IN ARRAY p_embarque_ids LOOP
    SELECT
      count(*) FILTER (WHERE f.estado NOT IN ('Cancelada','Sustituida','Borrador')),
      count(*) FILTER (WHERE f.estado = 'Pagada'::estado_factura),
      count(*) FILTER (WHERE f.estado = 'Parcialmente pagada'::estado_factura)
    INTO v_total, v_pagadas, v_parciales
    FROM public.factura_embarques fe
    JOIN public.facturas f ON f.id = fe.factura_id AND f.deleted_at IS NULL
    WHERE fe.embarque_id = v_emb;

    IF v_total = 0 THEN
      v_nuevo := 'pendiente';
    ELSIF v_pagadas = v_total THEN
      v_nuevo := 'pagado';
    ELSIF v_pagadas > 0 OR v_parciales > 0 THEN
      v_nuevo := 'parcial';
    ELSE
      v_nuevo := 'pendiente';
    END IF;

    UPDATE public.embarques
    SET cobro_cliente_status = v_nuevo,
        cobro_cliente_actualizado_at = now()
    WHERE id = v_emb
      AND cobro_cliente_status IS DISTINCT FROM v_nuevo;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_saldo numeric;
  v_vencimiento date;
  v_estado_actual estado_factura;
  v_nuevo_estado estado_factura;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_saldo := public.saldo_factura(v_factura_id);

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  UPDATE facturas
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = v_factura_id
    AND estado IS DISTINCT FROM v_nuevo_estado;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalcular_estado_factura_nc ON public.factura_notas_credito;
CREATE TRIGGER trg_recalcular_estado_factura_nc
AFTER INSERT OR UPDATE OF estado, monto, deleted_at ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.recalcular_estado_factura();

-- Backfill idempotente: facturas cubiertas al 100% por NC quedan Pagada
DO $backfill$
DECLARE
  v_actualizadas int := 0;
BEGIN
  WITH candidatas AS (
    SELECT f.id
    FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND public.saldo_factura(f.id) <= 0.01
  )
  UPDATE facturas SET estado = 'Pagada', updated_at = now()
  WHERE id IN (SELECT id FROM candidatas);
  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RAISE NOTICE 'Fase D backfill: % facturas re-marcadas como Pagada por NCs', v_actualizadas;
END;
$backfill$;
