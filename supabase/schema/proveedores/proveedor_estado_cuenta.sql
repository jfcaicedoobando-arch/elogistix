-- Canónico: proveedor_estado_cuenta
-- Migración vigente: Ola 12 · Sprint 07 (R3BD-05 + R3BD-06), acumulativa
-- sobre el Sprint 06 (R3P-04 + R3P-05).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_partidas jsonb;
  v_huerfanas jsonb;
  -- Ola 12 · R3BD-06: TC DOF vigente (patrón proveedor_inteligencia).
  v_usd numeric;
  v_eur numeric;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda,
           c.estado_liquidacion::text AS estado_liquidacion,
           c.fecha_vencimiento, c.created_at,
           e.id AS embarque_id, e.expediente, e.cliente_nombre
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id AND e.deleted_at IS NULL
    WHERE c.proveedor_id = p_proveedor_id
      AND c.organization_id = v_oid
      AND c.deleted_at IS NULL
  ),
  pfc_conv AS (
    SELECT pfc.concepto_costo_id,
           pfc.monto,
           pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.estado::text AS estado, pf.estado_aprobacion::text AS estado_aprobacion,
           pf.fecha_emision, pf.fecha_vencimiento, pf.moneda::text AS moneda,
           pf.total,
           cc2.moneda::text AS moneda_concepto,
           CASE pf.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN COALESCE(NULLIF(pf.tipo_cambio_usd, 0), v_usd)
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_factura,
           CASE cc2.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN v_usd
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_concepto
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    JOIN public.conceptos_costo cc2
      ON cc2.id = pfc.concepto_costo_id AND cc2.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  fact AS (
    SELECT c.concepto_costo_id,
           SUM(CASE
                 WHEN c.moneda = c.moneda_concepto THEN c.monto
                 WHEN c.tc_factura IS NOT NULL AND c.tc_concepto IS NOT NULL
                      AND c.tc_concepto > 0
                   THEN c.monto * c.tc_factura / c.tc_concepto
                 ELSE NULL
               END) AS monto_facturado,
           COALESCE(bool_or(
             c.moneda <> c.moneda_concepto
             AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
           ), false) AS moneda_mixta_sin_tc,
           SUM(CASE
                 WHEN c.moneda <> c.moneda_concepto
                      AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
                 THEN c.monto
               END) AS monto_sin_tc,
           jsonb_agg(DISTINCT jsonb_build_object(
             'factura_id', c.factura_id,
             'folio_interno', c.folio_interno,
             'folio_proveedor', c.folio_proveedor,
             'estado', c.estado,
             'estado_aprobacion', c.estado_aprobacion,
             'fecha_emision', c.fecha_emision,
             'fecha_vencimiento', c.fecha_vencimiento,
             'moneda', c.moneda,
             'total', c.total
           )) AS facturas
    FROM pfc_conv c
    GROUP BY c.concepto_costo_id
  ),
  pagos_por_factura AS (
    -- Ola 12 · R3P-01: pagos convertidos a la moneda de la factura con el TC
    -- del pago; los cross-moneda sin TC quedan fuera (SUM ignora NULL).
    SELECT pp.proveedor_factura_id,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND pp.deleted_at IS NULL
    GROUP BY pp.proveedor_factura_id
  ),
  pag AS (
    SELECT pfc.concepto_costo_id,
           SUM(
             COALESCE(ppf.pagado, 0)
             * CASE
                 WHEN COALESCE(pf.subtotal, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.subtotal, 1)
                 WHEN COALESCE(pf.total, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) / pf.total, 1)
                 ELSE 0
               END
           ) AS pagado_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    LEFT JOIN pagos_por_factura ppf ON ppf.proveedor_factura_id = pf.id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
    GROUP BY pfc.concepto_costo_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_partidas
  FROM (
    SELECT cc.id AS concepto_costo_id,
           cc.embarque_id, COALESCE(cc.expediente,'') AS expediente,
           COALESCE(cc.cliente_nombre,'') AS cliente_nombre,
           cc.concepto, cc.monto AS comprometido, cc.moneda,
           cc.estado_liquidacion, cc.fecha_vencimiento, cc.created_at,
           COALESCE(f.monto_facturado, 0) AS facturado,
           COALESCE(f.facturas, '[]'::jsonb) AS facturas,
           ROUND(COALESCE(p.pagado_factura, 0), 2) AS pagado,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado'
               THEN 0::numeric
             ELSE GREATEST(cc.monto - COALESCE(f.monto_facturado,0), 0)
           END AS por_facturar,
           COALESCE(f.moneda_mixta_sin_tc, false) AS moneda_mixta_sin_tc,
           ROUND(COALESCE(f.monto_sin_tc, 0), 2) AS monto_sin_tc,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             WHEN COALESCE(f.moneda_mixta_sin_tc, false) THEN 'Moneda mixta'
             WHEN COALESCE(f.monto_facturado,0) <= 0 THEN 'Por facturar'
             WHEN COALESCE(f.monto_facturado,0) > cc.monto * 1.01 THEN 'Sobrefacturado'
             WHEN COALESCE(f.monto_facturado,0) < cc.monto * 0.99 THEN 'Facturado parcial'
             WHEN cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             ELSE 'Facturado'
           END AS estado_conciliacion
    FROM cc
    LEFT JOIN fact f ON f.concepto_costo_id = cc.id
    LEFT JOIN pag p ON p.concepto_costo_id = cc.id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.fecha_emision DESC), '[]'::jsonb)
  INTO v_huerfanas
  FROM (
    SELECT pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.fecha_emision, pf.moneda::text AS moneda,
           SUM(pfc.monto) AS monto_sin_vincular,
           COUNT(*) AS partidas
    FROM public.proveedor_facturas pf
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
    LEFT JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND cc.id IS NULL
    GROUP BY pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision, pf.moneda
  ) h;

  RETURN jsonb_build_object(
    'partidas', v_partidas,
    'facturas_huerfanas', v_huerfanas
  );
END;
$function$;

