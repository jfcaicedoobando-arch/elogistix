-- Canonical schema para public.proveedor_estado_cuenta
-- Capturado 1:1 desde la migración 20260813011102 y actualizado en 13.578.0
-- (Ola 12 · Sprint 06 · R3P-04: partida pagada sin factura vigente conserva
--  'Pagado'; R3P-05: prorrata de pagado con base unificada CON IVA).
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
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda,
           c.estado_liquidacion::text AS estado_liquidacion,
           c.fecha_vencimiento, c.created_at,
           e.id AS embarque_id, e.expediente, e.cliente_nombre
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id
    WHERE c.proveedor_id = p_proveedor_id
      AND c.organization_id = v_oid
      AND c.deleted_at IS NULL
  ),
  fact AS (
    SELECT pfc.concepto_costo_id,
           SUM(pfc.monto) AS monto_facturado,
           jsonb_agg(DISTINCT jsonb_build_object(
             'factura_id', pf.id,
             'folio_interno', pf.folio_interno,
             'folio_proveedor', pf.folio_proveedor,
             'estado', pf.estado::text,
             'estado_aprobacion', pf.estado_aprobacion::text,
             'fecha_emision', pf.fecha_emision,
             'fecha_vencimiento', pf.fecha_vencimiento,
             'moneda', pf.moneda::text,
             'total', pf.total
           )) AS facturas
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
    GROUP BY pfc.concepto_costo_id
  ),
  pagos_por_factura AS (
    SELECT pp.proveedor_factura_id, SUM(pp.monto) AS pagado
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
                 -- R3P-05: base unificada CON IVA. pfc.monto es SIN IVA; la
                 -- proporción contra pf.subtotal equivale a repartir el pagado
                 -- (que sí incluye IVA) sobre la misma base.
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
             -- R3P-04: partida pagada cuya factura fue cancelada/eliminada:
             -- nada queda por facturar (el pago ya se aplicó).
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado'
               THEN 0::numeric
             ELSE GREATEST(cc.monto - COALESCE(f.monto_facturado,0), 0)
           END AS por_facturar,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
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

