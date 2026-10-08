-- Captured expense base, before tax, credit notes and payments. This is not
-- payable debt or P&L: keep the existing capture states, including drafts.
-- Amounts stay in the invoice currency; no nominal MXN/USD addition or FX.
CREATE OR REPLACE FUNCTION public.cxp_por_capturar()
RETURNS TABLE(
  embarque_id uuid, expediente text, cliente_nombre text,
  presupuestado_mxn numeric, presupuestado_usd numeric,
  facturado_mxn numeric, facturado_usd numeric, facturas_capturadas integer,
  ultima_factura_fecha date, dias_desde_ultima_factura integer
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $function$
  WITH presupuesto AS (
    SELECT cc.embarque_id, cc.organization_id,
      coalesce(sum(cc.monto) FILTER (WHERE cc.moneda::text = 'MXN'),0) AS mxn,
      coalesce(sum(cc.monto) FILTER (WHERE cc.moneda::text = 'USD'),0) AS usd,
      coalesce(sum(cc.monto) FILTER (WHERE cc.moneda::text = 'EUR'),0) AS eur
    FROM public.conceptos_costo cc
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id, cc.organization_id
  ), capturadas AS (
    SELECT pf.id, pf.organization_id, pf.embarque_id, pf.moneda, pf.subtotal,
      pf.fecha_emision
    FROM public.proveedor_facturas pf
    WHERE pf.deleted_at IS NULL AND pf.estado::text <> 'Cancelada'
  ), asignaciones AS (
    -- Fiscal rows and cost links describe the same expense. Only positive,
    -- effective links determine membership (audits 124/130/139), never both.
    SELECT pf.id AS factura_id, cc.embarque_id,
      sum(pfc.monto * coalesce(nullif(pfc.cantidad,0),1)) AS monto
    FROM capturadas pf
    JOIN public.proveedor_facturas_conceptos pfc
      ON pfc.proveedor_factura_id = pf.id AND pfc.organization_id = pf.organization_id
    JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.organization_id = pf.organization_id
    JOIN public.embarques e
      ON e.id = cc.embarque_id AND e.organization_id = pf.organization_id
    WHERE cc.deleted_at IS NULL AND cc.origen <> 'ajuste_factura_proveedor'
      AND pfc.monto > 0 AND coalesce(nullif(pfc.cantidad,0),1) > 0
    GROUP BY pf.id, cc.embarque_id
  ), asignado AS (
    SELECT a.factura_id, sum(a.monto) AS total FROM asignaciones a GROUP BY a.factura_id
  ), atribuidas AS (
    SELECT pf.id, pf.organization_id, coalesce(a.embarque_id,pf.embarque_id) AS embarque_id,
      pf.moneda, pf.fecha_emision,
      CASE WHEN s.total IS NULL THEN pf.subtotal
        -- Do not inflate a partial allocation to the full invoice. Multiply
        -- before division only for the cap, avoiding round-trip ratio noise.
        WHEN s.total <= pf.subtotal THEN a.monto
        ELSE pf.subtotal * a.monto / s.total END AS base
    FROM capturadas pf
    LEFT JOIN asignado s ON s.factura_id = pf.id
    LEFT JOIN asignaciones a ON a.factura_id = pf.id
  ), captura AS (
    -- Exactly one row per invoice/shipment feeds amount, count and dates.
    SELECT a.embarque_id, a.organization_id,
      coalesce(sum(a.base) FILTER (WHERE a.moneda::text = 'MXN'),0) AS mxn,
      coalesce(sum(a.base) FILTER (WHERE a.moneda::text = 'USD'),0) AS usd,
      count(*)::integer AS facturas, max(a.fecha_emision) AS ultima
    FROM atribuidas a
    WHERE a.embarque_id IS NOT NULL
    GROUP BY a.embarque_id, a.organization_id
  )
  SELECT e.id, e.expediente, c.nombre, p.mxn, p.usd,
    coalesce(a.mxn,0), coalesce(a.usd,0), coalesce(a.facturas,0),
    a.ultima, (CURRENT_DATE - a.ultima)::integer
  FROM public.embarques e
  JOIN presupuesto p ON p.embarque_id = e.id AND p.organization_id = e.organization_id
  LEFT JOIN public.clientes c ON c.id = e.cliente_id AND c.organization_id = e.organization_id
  LEFT JOIN captura a ON a.embarque_id = e.id AND a.organization_id = e.organization_id
  WHERE e.deleted_at IS NULL AND e.estado::text <> 'Cerrado' AND (p.mxn > 0 OR p.usd > 0 OR p.eur > 0)
  ORDER BY e.created_at DESC
  LIMIT 500;
$function$;
-- CREATE OR REPLACE preserves the existing owner and complete ACL unchanged.
-- Do not add explicit grants: service_role already inherits existing EXECUTE.
