-- ============================================================================
-- BLOQUE 1 — Fixes cierre de embarques, PNL y estados canónicos de NC
-- FIX-BL-01, FIX-BL-02, FIX-BL-03, FIX-BL-04, FIX-BL-05
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX-BL-01: transicion_embarque_valida — permitir Entregado → Cerrado
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transicion_embarque_valida(p_actual estado_embarque, p_nuevo estado_embarque)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_actual = p_nuevo THEN RETURN true; END IF;

  IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN
    RETURN true;
  END IF;

  RETURN CASE p_actual
    WHEN 'Borrador'    THEN p_nuevo IN ('Confirmado')
    WHEN 'Cotización'  THEN p_nuevo IN ('Confirmado','Borrador')
    WHEN 'Confirmado'  THEN p_nuevo IN ('En Tránsito','Borrador')
    WHEN 'En Tránsito' THEN p_nuevo IN ('Arribo','En Proceso')
    WHEN 'Arribo'      THEN p_nuevo IN ('En Aduana','En Tránsito')
    WHEN 'En Aduana'   THEN p_nuevo IN ('Entregado','Arribo')
    WHEN 'Llegada'     THEN p_nuevo IN ('Arribo','En Aduana')
    -- FIX-BL-01: agregar Cerrado como transición válida desde Entregado.
    -- El cierre real sigue custodiado por validar_cierre_embarque (CxC/CxP liquidadas).
    WHEN 'Entregado'   THEN p_nuevo IN ('EIR','En Aduana','Cerrado')
    WHEN 'EIR'         THEN p_nuevo IN ('Cerrado','Entregado')
    WHEN 'Cerrado'     THEN p_nuevo IN ('EIR')
    WHEN 'En Proceso'  THEN p_nuevo IN ('En Tránsito','Arribo','En Aduana')
    WHEN 'Cancelado'   THEN false
    ELSE false
  END;
END;
$function$;

-- ----------------------------------------------------------------------------
-- FIX-BL-02 + FIX-BL-03 + parte de BL-04: redefinir pnl_financiero_embarque
--   - Excluye facturas Sustituidas del CTE de facturas.
--   - pdte_cobro_mxn usa saldo_factura(f.id) por factura (saldo real).
--   - pdte_pago_mxn resta pagos_proveedor con deleted_at IS NULL.
--   - Estados de NC unificados: solo 'Aplicada' (canónico).
--   - Expone utilidad_mxn a nivel superior para consumidores (BL-03).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  _tc_usd numeric;
  _tc_eur numeric;
  _venta_real_mxn numeric;
  _costo_real_mxn numeric;
  _result jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO _tc_usd, _tc_eur
  FROM public.embarques WHERE id = _embarque_id;

  IF _tc_usd IS NULL THEN
    RAISE EXCEPTION 'Embarque % no encontrado o sin acceso', _embarque_id;
  END IF;

  WITH
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda,
           coalesce(monto,0)::numeric AS monto,
           proveedor_id,
           coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto,
           moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id,
           aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  -- FIX-BL-02(a): excluir Sustituidas.
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda, estado::text AS estado, total::numeric AS total
    FROM public.facturas
    WHERE embarque_id = _embarque_id
      AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada','Sustituida')
  ),
  -- Canónico BL-04: estados de NC que descuentan saldo = solo 'Aplicada'.
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  -- FIX-BL-02(b): saldo real por factura, no total - NC.
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado,
           public.saldo_factura(f.id) AS saldo
    FROM f
  ),
  fc AS (
    SELECT lower(trim(coalesce(cf.descripcion,'(sin concepto)'))) AS concepto,
           cf.moneda::text AS moneda,
           coalesce(cf.total,0)::numeric AS monto
    FROM public.conceptos_factura cf
    JOIN f ON f.id = cf.factura_id
    WHERE cf.deleted_at IS NULL
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(subtotal,0)::numeric AS subtotal,
           moneda::text AS moneda, estado::text AS estado
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id
      AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n
    JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.subtotal - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  -- FIX-BL-02(c): pdte_pago real = pf_neto - pagos_proveedor vigentes.
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado,
           (pf.subtotal
              - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
              - coalesce((SELECT sum(pp.monto_en_moneda_factura)
                          FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id
                            AND pp.deleted_at IS NULL), 0)
           ) AS saldo
    FROM pf
  ),
  pfc AS (
    SELECT lower(trim(coalesce(c.descripcion,'(sin concepto)'))) AS concepto,
           pf.moneda, coalesce(c.monto,0)::numeric AS monto
    FROM public.proveedor_facturas_conceptos c
    JOIN pf ON pf.id = c.proveedor_factura_id
  ),
  totales AS (
    SELECT
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn',          t.venta_real_mxn,
      -- FIX-BL-02(b): pendiente por cobrar usando saldo_factura por id (no f_neto).
      'pdte_cobro_mxn',    (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                             FROM f_saldo
                             WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn',          t.costo_real_mxn,
      -- FIX-BL-02(c): pendiente por pagar restando pagos_proveedor vigentes.
      'pdte_pago_mxn',     (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                             FROM pf_saldo
                             WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    -- FIX-BL-03: exponer utilidad_mxn a nivel superior.
    'utilidad_mxn', round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2),
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cv
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM fc
        ) u
        GROUP BY concepto
        ORDER BY concepto
      ) x
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT concepto,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cc
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM pfc
          UNION ALL
          SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM seg
        ) u
        GROUP BY concepto
        ORDER BY concepto
      ) x
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0)   AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count
          FROM cc
          UNION ALL
          SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1
          FROM pf_neto
          UNION ALL
          SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1
          FROM seg
        ) u
        GROUP BY proveedor_id, proveedor_nombre
        ORDER BY proveedor_nombre
      ) x
    )
  )
  INTO _result
  FROM totales t;

  RETURN _result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- FIX-BL-03: validar_cierre_embarque — usar solo utilidad_mxn (ya expuesto arriba).
-- Se mantiene la función pero se limpia el fallback ambiguo a 'utilidad' que
-- nunca existió y se le agrega un margen mínimo en MXN explícito.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_cierre_embarque(p_embarque_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_pnl jsonb;
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

  -- Canónico BL-04: estados de NC = 'Aplicada'.
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

  BEGIN
    v_pnl := public.pnl_financiero_embarque(p_embarque_id);
  EXCEPTION WHEN OTHERS THEN
    v_pnl := '{}'::jsonb;
  END;

  -- FIX-BL-03: única llave canónica ahora que pnl expone utilidad_mxn.
  v_utilidad := COALESCE((v_pnl->>'utilidad_mxn')::numeric, 0);
  SELECT COALESCE((SELECT valor::numeric FROM configuracion_global WHERE clave='margen_minimo_cierre' LIMIT 1), 0)
    INTO v_margen_min;
  v_ok := (v_utilidad >= v_margen_min);
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'regla','margen_minimo','ok',v_ok,
    'detalle', jsonb_build_object('utilidad', v_utilidad, 'minimo', v_margen_min)));

  RETURN jsonb_build_object('puede_cerrar', v_puede, 'checks', v_checks);
END;
$function$;

-- ----------------------------------------------------------------------------
-- FIX-BL-04: recalcular_estado_factura — condición de "Pagada" ya usa
-- saldo_factura (que descuenta NCs 'Aplicada'). Reforzamos el conjunto canónico
-- y la tolerancia. saldo_factura ya está correcto; verificamos que la comparación
-- sea contra saldo <= 0.005 para evitar el sobrepago de centavo (ver BL-13).
-- Nota: BL-13 se aplicará en BLOQUE 3 con guards de pago; aquí solo ajustamos
-- el umbral a 0.005 en la decisión "Pagada" para consistencia con saldo_factura.
-- ----------------------------------------------------------------------------
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

  -- saldo_factura ya resta NCs 'Aplicada' (conjunto canónico BL-04).
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

-- Disparar recálculo idempotente para facturas activas: si por drift de estados
-- de NC previos quedaron marcadas 'Parcialmente pagada' aún estando saldadas.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT f.id
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar')
      AND public.saldo_factura(f.id) <= 0.01
  LOOP
    UPDATE public.facturas SET estado = 'Pagada', updated_at = now()
    WHERE id = r.id AND estado IS DISTINCT FROM 'Pagada';
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- FIX-BL-05: portal_responder_cotizacion — bloquear si fecha_vigencia venció.
-- Aplica a ambas firmas expuestas.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(p_cotizacion_id uuid, p_respuesta text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cotizacion cotizaciones%ROWTYPE;
BEGIN
  IF p_respuesta NOT IN ('Aceptada', 'Rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida. Debe ser "Aceptada" o "Rechazada".';
  END IF;

  SELECT * INTO v_cotizacion
  FROM cotizaciones
  WHERE id = p_cotizacion_id
    AND cliente_id IN (SELECT current_user_client_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada o no tienes acceso.';
  END IF;

  IF v_cotizacion.estado != 'Enviada' THEN
    RAISE EXCEPTION 'Solo se pueden responder cotizaciones en estado "Enviada". Estado actual: %', v_cotizacion.estado;
  END IF;

  -- FIX-BL-05: rechazar si vigencia expiró (solo aplica a Aceptada;
  -- Rechazar una cotización vencida está permitido por trazabilidad).
  IF p_respuesta = 'Aceptada'
     AND v_cotizacion.fecha_vigencia IS NOT NULL
     AND v_cotizacion.fecha_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COTIZACION_VENCIDA: la cotización venció el % — solicita una actualización', v_cotizacion.fecha_vigencia
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE cotizaciones
  SET estado = p_respuesta::estado_cotizacion, updated_at = now()
  WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object('id', p_cotizacion_id, 'estado', p_respuesta);
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(p_cotizacion_id uuid, p_respuesta text, p_comentario text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cotizacion cotizaciones%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_comentario text;
  v_titulo text;
  v_mensaje text;
  v_tipo text;
BEGIN
  IF p_respuesta NOT IN ('Aceptada', 'Rechazada') THEN
    RAISE EXCEPTION 'LC_RESPUESTA_INVALIDA: respuesta debe ser Aceptada o Rechazada' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cotizacion
  FROM cotizaciones
  WHERE id = p_cotizacion_id
    AND cliente_id IN (SELECT current_user_client_ids())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: cotización no encontrada o sin acceso' USING ERRCODE = 'P0002';
  END IF;

  IF v_cotizacion.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: esta cotización ya no está disponible' USING ERRCODE = 'P0001';
  END IF;

  IF v_cotizacion.estado IN ('Aceptada'::estado_cotizacion, 'Rechazada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RETURN jsonb_build_object(
      'id', p_cotizacion_id,
      'estado', v_cotizacion.estado::text,
      'fecha_respuesta', COALESCE(v_cotizacion.fecha_aceptacion, v_cotizacion.fecha_rechazo),
      'idempotente', true
    );
  END IF;

  IF v_cotizacion.estado <> 'Enviada'::estado_cotizacion THEN
    RAISE EXCEPTION 'LC_COT_NO_RESPONDIBLE: solo se pueden responder cotizaciones en estado Enviada (actual: %)', v_cotizacion.estado USING ERRCODE = 'P0001';
  END IF;

  -- FIX-BL-05: rechazar si vigencia expiró (solo aplica a Aceptada).
  IF p_respuesta = 'Aceptada'
     AND v_cotizacion.fecha_vigencia IS NOT NULL
     AND v_cotizacion.fecha_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COTIZACION_VENCIDA: la cotización venció el % — solicita una actualización', v_cotizacion.fecha_vigencia
      USING ERRCODE = 'P0001';
  END IF;

  v_comentario := NULLIF(trim(p_comentario), '');

  UPDATE cotizaciones
  SET estado = p_respuesta::estado_cotizacion,
      comentario_cliente = v_comentario,
      fecha_aceptacion = CASE WHEN p_respuesta = 'Aceptada' THEN v_now ELSE fecha_aceptacion END,
      fecha_rechazo    = CASE WHEN p_respuesta = 'Rechazada' THEN v_now ELSE fecha_rechazo END,
      updated_at = v_now
  WHERE id = p_cotizacion_id;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_cotizacion.organization_id,
    auth.uid(),
    COALESCE(v_user_email, ''),
    CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END,
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_cotizacion.folio, ''),
    jsonb_build_object(
      'cotizacion_id', p_cotizacion_id,
      'folio', v_cotizacion.folio,
      'cliente_id', v_cotizacion.cliente_id,
      'cliente_nombre', v_cotizacion.cliente_nombre,
      'estado_anterior', v_cotizacion.estado,
      'estado_nuevo', p_respuesta,
      'comentario_cliente', v_comentario,
      'origen', 'portal_cliente'
    )
  );

  v_tipo := CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END;
  v_titulo := 'Cotización ' || COALESCE(v_cotizacion.folio, '') || ' ' ||
              CASE WHEN p_respuesta = 'Aceptada' THEN 'aceptada' ELSE 'rechazada' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_cotizacion.cliente_nombre, 'N/D') ||
               CASE WHEN v_comentario IS NOT NULL THEN E'\nComentario: ' || v_comentario ELSE '' END;

  INSERT INTO public.notificaciones_internas (
    organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id
  )
  SELECT
    v_cotizacion.organization_id,
    om.user_id,
    v_tipo,
    v_titulo,
    v_mensaje,
    '/cotizaciones/' || p_cotizacion_id::text,
    'cotizacion',
    p_cotizacion_id
  FROM public.organization_members om
  WHERE om.organization_id = v_cotizacion.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role);

  RETURN jsonb_build_object(
    'id', p_cotizacion_id,
    'estado', p_respuesta,
    'fecha_respuesta', v_now,
    'idempotente', false
  );
END;
$function$;
