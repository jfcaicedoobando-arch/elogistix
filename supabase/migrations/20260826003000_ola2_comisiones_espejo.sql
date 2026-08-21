-- Ola 2 · Comisiones cierran y cierran bien (espejo desde la base, sin parches por texto).
-- O2.1 prorrateo neto del embarque · O2.2 regla de cierre · O2.5 idempotencia de anticipos · O2.6 ciclo de liquidaciones.

ALTER TABLE public.liquidaciones_comision
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'Generada',
  ADD COLUMN IF NOT EXISTS cancelada_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

DO $liq$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'liquidaciones_comision_estado_chk') THEN
    ALTER TABLE public.liquidaciones_comision
      ADD CONSTRAINT liquidaciones_comision_estado_chk
      CHECK (estado IN ('Generada','Pagada','Cancelada'));
  END IF;
END
$liq$;

UPDATE public.liquidaciones_comision
   SET estado = 'Pagada'
 WHERE fecha_pago IS NOT NULL AND estado = 'Generada';

DROP FUNCTION IF EXISTS public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.venta_embarque_mxn_neta(p_embarque_id uuid, p_tc_usd numeric, p_tc_eur numeric)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(public.convertir_a_mxn(cv.total, cv.moneda::text,
                                        NULLIF(p_tc_usd,0), NULLIF(p_tc_eur,0)))
      FROM public.conceptos_venta cv
      WHERE cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL), 0)
    - COALESCE((
      SELECT SUM(public.convertir_a_mxn(
               public.nc_aplicadas_en_moneda_factura(f.id), f.moneda::text,
               NULLIF(p_tc_usd,0), NULLIF(p_tc_eur,0)))
      FROM public.facturas f
      WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
        AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')), 0)
  , 0)::numeric;
$function$
;

CREATE OR REPLACE FUNCTION public.comisiones_sobre_devengadas()
 RETURNS TABLE(embarque_id uuid, facturas bigint, utilidad_prorrateada_mxn numeric, comision_mxn numeric, proporcion_total numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cd.embarque_id,
         COUNT(DISTINCT cd.factura_id) AS facturas,
         ROUND(SUM(cd.utilidad_prorrateada_mxn), 2),
         ROUND(SUM(cd.comision_mxn), 2),
         ROUND(SUM(cd.monto_cobrado_mxn) / NULLIF(
           public.venta_embarque_mxn_neta(cd.embarque_id,
             (SELECT tipo_cambio_usd FROM public.embarques e WHERE e.id = cd.embarque_id),
             (SELECT tipo_cambio_eur FROM public.embarques e WHERE e.id = cd.embarque_id)), 0), 4)
  FROM public.comisiones_devengadas cd
  WHERE cd.embarque_id IS NOT NULL
    AND cd.estado <> 'Cancelada'
    AND cd.deleted_at IS NULL
    AND (cd.organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  GROUP BY cd.embarque_id
  HAVING SUM(cd.monto_cobrado_mxn) > 1.01 * COALESCE(NULLIF(
           public.venta_embarque_mxn_neta(cd.embarque_id,
             (SELECT tipo_cambio_usd FROM public.embarques e WHERE e.id = cd.embarque_id),
             (SELECT tipo_cambio_eur FROM public.embarques e WHERE e.id = cd.embarque_id)), 0), 0)
  ORDER BY 4 DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid;
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric;
  v_tc_factura numeric;
  v_req_usd boolean := false;
  v_req_eur boolean := false;
  v_cliente_id uuid;
  -- Ola 2 · O2.1: denominador del prorrateo = venta del embarque neta de NC.
  v_venta_neta_mxn numeric(14,2);
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;

  IF v_embarque_id IS NOT NULL AND public.resolver_sin_comision(v_embarque_id) THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0,
           nota = 'Embarque excluido de comisión', updated_at = now()
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT vendedora_id, COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO v_vendedora_id, v_tc_usd, v_tc_eur
    FROM embarques WHERE id = v_embarque_id;

  BEGIN
    v_tc_factura := NULLIF(v_factura.tipo_cambio, 0);
    IF v_pago.monto_aplicado_factura IS NOT NULL THEN
      IF v_factura.moneda::text = 'MXN' THEN
        v_cobrado_mxn := v_pago.monto_aplicado_factura;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto_aplicado_factura,
          v_factura.moneda::text,
          COALESCE(v_tc_factura, NULLIF(v_tc_usd, 0)),
          COALESCE(v_tc_factura, NULLIF(v_tc_eur, 0))
        );
      END IF;
    ELSIF v_pago.moneda::text = 'MXN' THEN
      v_cobrado_mxn := v_pago.monto;
    ELSE
      v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
      IF v_tc_pago IS NOT NULL AND v_tc_pago > 1 THEN
        v_cobrado_mxn := v_pago.monto * v_tc_pago;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto,
          v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_cobrado_mxn := 0;
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'cobrado_mxn',
      'No se pudo valuar lo cobrado a MXN', SQLSTATE, SQLERRM);
  END;

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  v_cliente_id := v_factura.cliente_id;
  v_pct := COALESCE(public.resolver_porcentaje_comision(
             v_pago.organization_id, v_vendedora_id, v_cliente_id, v_embarque_id), 0);

  BEGIN
    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cv.total, cv.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_ingresos_mxn
      FROM conceptos_venta cv
     WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cc.monto, cc.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_costos_mxn
      FROM conceptos_costo cc
     WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

    SELECT COALESCE(bool_or(m.moneda::text = 'USD'), false),
           COALESCE(bool_or(m.moneda::text = 'EUR'), false)
      INTO v_req_usd, v_req_eur
      FROM (
        SELECT moneda FROM conceptos_venta
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
        UNION ALL
        SELECT moneda FROM conceptos_costo
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
      ) m;

    v_utilidad := v_ingresos_mxn - v_costos_mxn;

    -- Ola 2 · O2.1: la utilidad es del EMBARQUE, así que la proporción también
    -- debe medirse contra la venta del embarque (neta de notas de crédito).
    -- Antes se dividía entre `factura.total`: dos facturas vivas del mismo
    -- embarque sumaban proporción 2 → comisión doble.
    v_venta_neta_mxn := public.venta_embarque_mxn_neta(
      v_embarque_id, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0));

    IF COALESCE(v_venta_neta_mxn, 0) > 0 THEN
      -- Tope 1: nunca se comisiona más del 100% de la utilidad del embarque.
      v_proporcion := LEAST(v_cobrado_mxn / v_venta_neta_mxn, 1);
    ELSE
      v_proporcion := 0;
    END IF;

    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN (v_req_usd AND v_tc_usd = 0) OR (v_req_eur AND v_tc_eur = 0)
        THEN 'Tipos de cambio del embarque incompletos'
      WHEN COALESCE(v_venta_neta_mxn, 0) <= 0
        THEN 'Venta del embarque pendiente de captura'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := 0;
    v_comision_mxn := 0;
    v_nota := 'Comisión en 0: pendiente de recálculo (ver cola)';
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'utilidad_embarque',
      'No se pudo calcular la utilidad del embarque', SQLSTATE, SQLERRM);
  END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$
;

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
  v_cxc_pagadas_sin_pago int := 0;
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

  -- N-BL-01: el pagado CxP se convierte a la moneda de la factura con
  -- monto_pago_en_moneda_factura (antes sumaba pp.monto en crudo: una factura
  -- USD pagada en MXN inflaba el pagado ~19x y permitía cerrar con CxP
  -- pendiente). Fail-closed consistente con saldo_factura_proveedor: un pago
  -- sin tipo de cambio con moneda distinta se EXCLUYE del pagado (nunca 1:1
  -- silencioso) y se reporta en pagos_sin_tipo_cambio.
  WITH agg AS (
    SELECT COALESCE(pf.moneda,'MXN') AS moneda, COALESCE(SUM(pf.total),0) AS total,
      COALESCE(SUM((SELECT COALESCE(SUM(public.monto_pago_en_moneda_factura(
          pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)),0)
        FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL)),0) AS pagado,
      COUNT(*) FILTER (WHERE pf.total > COALESCE((
        SELECT SUM(public.monto_pago_en_moneda_factura(
          pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text))
        FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL),0) + 0.01) AS facturas_pendientes,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM pagos_proveedor pp
        WHERE pp.proveedor_factura_id=pf.id AND pp.deleted_at IS NULL
          AND pp.moneda::text <> COALESCE(pf.moneda::text,'MXN')
          AND COALESCE(pp.tipo_cambio_usd, 0) <= 0)) AS pagos_sin_tipo_cambio
    FROM proveedor_facturas pf
    WHERE pf.embarque_id=p_embarque_id AND pf.deleted_at IS NULL AND pf.estado<>'Cancelada'
    GROUP BY COALESCE(pf.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,
      'saldo',GREATEST(total-pagado,0),'facturas_pendientes',facturas_pendientes,
      'pagos_sin_tipo_cambio',pagos_sin_tipo_cambio
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(total-pagado,0)),0)
  INTO v_cxp_por_moneda, v_cxp_saldo FROM agg;
  -- BUG-13: el umbral se evalúa POR moneda; sumar saldos de monedas distintas
  -- mezcla unidades y puede pasar con USD pendiente compensado con MXN.
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxp_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01);
  v_puede := v_puede AND v_ok;
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

  -- CxC: una factura con estado 'Pagada' se considera saldo 0 aunque no tenga
  -- pagos capturados (facturas históricas conciliadas fuera del sistema).
  SELECT COUNT(*) INTO v_cxc_pagadas_sin_pago
    FROM facturas f
   WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL AND f.estado='Pagada'
     AND public.saldo_factura(f.id) > 0.01;

  WITH agg AS (
    SELECT COALESCE(f.moneda,'MXN') AS moneda, COALESCE(SUM(f.total),0) AS total,
      COALESCE(SUM(CASE WHEN f.estado='Pagada' THEN 0
                        ELSE public.saldo_factura(f.id) END),0) AS saldo,
      COALESCE(SUM((SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) FROM pagos_factura pf
        WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL)),0) AS pagado,
      COALESCE(SUM((SELECT COALESCE(SUM(nc.monto),0) FROM factura_notas_credito nc
        WHERE nc.factura_id=f.id AND nc.deleted_at IS NULL AND nc.estado='Aplicada')),0) AS notas_credito,
      COUNT(*) FILTER (WHERE f.estado<>'Pagada' AND public.saldo_factura(f.id) > 0.01) AS facturas_pendientes
    FROM facturas f
    WHERE f.embarque_id=p_embarque_id AND f.deleted_at IS NULL
      AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')
    GROUP BY COALESCE(f.moneda,'MXN'))
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'moneda',moneda,'total',total,'pagado',pagado,'notas_credito',notas_credito,
      'saldo',GREATEST(saldo,0),'facturas_pendientes',facturas_pendientes
    ) ORDER BY moneda),'[]'::jsonb), COALESCE(SUM(GREATEST(saldo,0)),0)
  INTO v_cxc_por_moneda, v_cxc_saldo FROM agg;
  -- BUG-13: el umbral se evalúa POR moneda; sumar saldos de monedas distintas
  -- mezcla unidades y puede pasar con USD pendiente compensado con MXN.
  v_ok := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_cxc_por_moneda) m
    WHERE (m->>'saldo')::numeric > 0.01);
  v_puede := v_puede AND v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','cxc_cobrada','ok',v_ok,
    'detalle', jsonb_build_object('por_moneda', v_cxc_por_moneda, 'saldo_total', v_cxc_saldo,
      'pagadas_sin_pago_registrado', v_cxc_pagadas_sin_pago)));

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

  -- Ola 2 · O2.2: se bloquea por pendientes REALES (nota de pendiente o
  -- cola de recálculo), no por la bandera `definitiva` que sólo se marca al
  -- cerrar (círculo vicioso que obligaba a "forzar" todos los cierres).
  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas cd
   WHERE cd.embarque_id=p_embarque_id
     AND cd.estado='Devengada' AND cd.deleted_at IS NULL
     AND cd.nota IS NOT NULL;
  IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
               JOIN pagos_factura pf2 ON pf2.id = crp.pago_factura_id
               JOIN facturas f2 ON f2.id = pf2.factura_id
              WHERE f2.embarque_id = p_embarque_id
                AND crp.resuelto_at IS NULL) THEN
    v_com_count := v_com_count + 1;
  END IF;
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

CREATE OR REPLACE FUNCTION public.registrar_anticipo_proveedor(p_proveedor_id uuid, p_monto numeric, p_moneda moneda, p_fecha_anticipo date DEFAULT CURRENT_DATE, p_tipo_cambio_usd numeric DEFAULT NULL::numeric, p_metodo_pago text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_cuenta_bancaria_id uuid DEFAULT NULL::uuid, p_notas text DEFAULT NULL::text, p_embarque_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS anticipos_proveedor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_autorizado boolean;
  v_metodo text := COALESCE(NULLIF(TRIM(p_metodo_pago), ''), 'Transferencia');
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_emb_org uuid;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- O2.5: reclamo atómico de la llave (patrón bl05/bl08). Doble submit del
  -- diálogo ya no crea dos anticipos ni dos cargos bancarios conciliados.
  v_cached := public.idempotency_claim(p_request_id, 'registrar_anticipo_proveedor');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Este anticipo ya se está registrando; espera unos segundos y verifica el listado antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_row FROM public.anticipos_proveedor
    WHERE id = (v_cached->>'anticipo_id')::uuid;
    IF v_row.id IS NOT NULL THEN
      RETURN v_row;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto debe ser mayor a cero.';
  END IF;

  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org IS DISTINCT FROM public.current_user_org_id() AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  IF p_embarque_id IS NOT NULL THEN
    SELECT organization_id INTO v_emb_org FROM public.embarques WHERE id = p_embarque_id;
    IF v_emb_org IS NULL OR v_emb_org <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EMBARQUE_INVALIDO: El embarque no existe o pertenece a otra organización.';
    END IF;
  END IF;

  -- Sin cuenta bancaria el anticipo no genera movimiento conciliable.
  IF p_cuenta_bancaria_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el anticipo (sólo Efectivo puede omitirla).';
  END IF;

  IF p_cuenta_bancaria_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> p_moneda THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_DIVISA: La cuenta está en % y el anticipo en %.', v_cuenta.moneda, p_moneda;
    END IF;
  END IF;

  INSERT INTO public.anticipos_proveedor
    (organization_id, proveedor_id, fecha_anticipo, monto, moneda, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas,
     estado, saldo_disponible, created_by, embarque_id)
  VALUES
    (v_org, p_proveedor_id, p_fecha_anticipo, p_monto, p_moneda, p_tipo_cambio_usd,
     v_metodo, p_referencia, p_cuenta_bancaria_id, p_notas,
     'disponible', p_monto, v_uid, p_embarque_id)
  RETURNING * INTO v_row;

  -- Cargo bancario conciliado (el saldo de la cuenta baja de inmediato).
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       anticipo_proveedor_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, p_cuenta_bancaria_id, p_fecha_anticipo,
       'Anticipo — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       COALESCE(p_referencia, ''),
       p_monto, 0, 'anticipo-' || v_row.id::text, 'Conciliado',
       v_row.id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('proveedor_id', p_proveedor_id, 'monto', p_monto, 'moneda', p_moneda,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id, 'metodo_pago', v_metodo,
                               'embarque_id', p_embarque_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('anticipo_id', v_row.id, 'monto', p_monto));

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.registrar_pago_liquidacion(p_liquidacion_id uuid, p_fecha_pago date, p_metodo_pago text, p_referencia text DEFAULT NULL::text, p_notas text DEFAULT NULL::text)
 RETURNS liquidaciones_comision
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden pagar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_CANCELADA: La liquidación está cancelada; genera una nueva.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.fecha_pago IS NOT NULL OR v_row.estado = 'Pagada' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado el %.', v_row.fecha_pago
      USING ERRCODE = '42501';
  END IF;

  IF p_fecha_pago IS NULL OR p_fecha_pago > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.liquidaciones_comision
     SET fecha_pago = p_fecha_pago,
         metodo_pago = p_metodo_pago,
         referencia = COALESCE(p_referencia, referencia),
         notas = COALESCE(p_notas, notas),
         estado = 'Pagada',
         updated_at = now()
   WHERE id = p_liquidacion_id
     AND fecha_pago IS NULL
     AND estado = 'Generada'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado.'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'registrar_pago_liquidacion', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('fecha_pago', p_fecha_pago, 'metodo_pago', p_metodo_pago,
                               'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_liquidacion: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(p_liquidacion_id uuid, p_motivo text)
 RETURNS liquidaciones_comision
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_MOTIVO_REQUERIDO: Captura el motivo de la cancelación.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.comisiones_devengadas
     SET estado = 'Devengada', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id;

  UPDATE public.liquidaciones_comision
     SET estado = 'Cancelada',
         cancelada_at = now(),
         cancelada_por = v_uid,
         motivo_cancelacion = TRIM(p_motivo),
         updated_at = now()
   WHERE id = p_liquidacion_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_liquidacion_comision', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('motivo', TRIM(p_motivo), 'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_liquidacion_comision: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$

;

REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.comisiones_sobre_devengadas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comisiones_sobre_devengadas() TO authenticated, service_role;
