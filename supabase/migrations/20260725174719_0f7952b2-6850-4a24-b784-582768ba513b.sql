-- perf: Ola 1 · P9 + P10 — agregaciones acotadas por organización
-- 2026-07-25 · Los CTEs de agregación en aging CxC/CxP y profit_por_embarque
-- escaneaban TODAS las filas de pagos_factura/proveedor/NCs/conceptos y
-- filtraban al final. Al ser SECURITY DEFINER, RLS no poda. Empujamos el
-- filtro por org al inicio de cada CTE. Semántica idéntica.

-- ============================================================
-- P9.1 · cxc_aging_clientes
-- ============================================================
CREATE OR REPLACE FUNCTION public.cxc_aging_clientes(
  p_org uuid DEFAULT NULL::uuid,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  cliente_id uuid, cliente_nombre text, saldo_total numeric,
  vigente numeric, d_1_30 numeric, d_31_60 numeric, d_61_90 numeric,
  mas_90 numeric, num_facturas integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org uuid;
  v_is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN
    v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org <> v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE
    v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT pf.factura_id, COALESCE(SUM(pf.monto_aplicado_factura), 0) AS pagado
    FROM public.pagos_factura pf
    JOIN public.facturas f ON f.id = pf.factura_id
    WHERE pf.deleted_at IS NULL
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY pf.factura_id
  ),
  nc AS (
    SELECT ncf.factura_id, COALESCE(SUM(ncf.monto), 0) AS aplicado
    FROM public.factura_notas_credito ncf
    JOIN public.facturas f ON f.id = ncf.factura_id
    WHERE ncf.estado = 'Aplicada' AND ncf.deleted_at IS NULL
      AND (v_org IS NULL OR f.organization_id = v_org)
    GROUP BY ncf.factura_id
  ),
  saldos AS (
    SELECT
      f.cliente_id,
      f.cliente_nombre,
      f.id AS factura_id,
      GREATEST(f.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
      (p_fecha - COALESCE(f.fecha_vencimiento, f.fecha_emision))::int AS dias_vencido
    FROM public.facturas f
    LEFT JOIN pagado pg ON pg.factura_id = f.id
    LEFT JOIN nc ON nc.factura_id = f.id
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND (v_org IS NULL OR f.organization_id = v_org)
  )
  SELECT
    s.cliente_id,
    MAX(s.cliente_nombre),
    SUM(s.saldo),
    SUM(CASE WHEN s.dias_vencido <= 0 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 1 AND 30 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90 THEN s.saldo ELSE 0 END),
    SUM(CASE WHEN s.dias_vencido > 90 THEN s.saldo ELSE 0 END),
    COUNT(*)::int
  FROM saldos s
  WHERE s.saldo > 0.005
  GROUP BY s.cliente_id
  ORDER BY SUM(s.saldo) DESC;
END;
$function$;

-- ============================================================
-- P9.2 · cxp_aging_proveedores
-- ============================================================
CREATE OR REPLACE FUNCTION public.cxp_aging_proveedores(
  p_org uuid DEFAULT NULL::uuid,
  p_fecha date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  proveedor_id uuid, proveedor_nombre text, moneda text,
  saldo_total numeric, vigente numeric, d_1_30 numeric,
  d_31_60 numeric, d_61_90 numeric, mas_90 numeric, num_facturas integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_org uuid := public.current_user_org_id();
  v_org uuid;
  v_is_super boolean := public.has_role(auth.uid(), 'super_admin'::app_role);
BEGIN
  IF v_caller_org IS NULL AND NOT v_is_super THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organización activa' USING ERRCODE='42501';
  END IF;
  IF v_is_super THEN
    v_org := p_org;
  ELSIF p_org IS NOT NULL AND p_org <> v_caller_org THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: no puedes consultar el aging de otra organización' USING ERRCODE='42501';
  ELSE
    v_org := v_caller_org;
  END IF;

  RETURN QUERY
  WITH pagado AS (
    SELECT pp.proveedor_factura_id,
           COALESCE(SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)), 0) AS pagado
      FROM public.pagos_proveedor pp
      JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
     WHERE pp.deleted_at IS NULL
       AND (v_org IS NULL OR pf.organization_id = v_org)
     GROUP BY pp.proveedor_factura_id
  ), nc AS (
    SELECT pnc.proveedor_factura_id, COALESCE(SUM(pnc.monto), 0) AS aplicado
      FROM public.proveedor_notas_credito pnc
      JOIN public.proveedor_facturas pf ON pf.id = pnc.proveedor_factura_id
     WHERE pnc.estado = 'Aplicada' AND pnc.deleted_at IS NULL
       AND (v_org IS NULL OR pf.organization_id = v_org)
     GROUP BY pnc.proveedor_factura_id
  ), saldos AS (
    SELECT pf.proveedor_id,
           pf.proveedor_nombre,
           COALESCE(pf.moneda, 'MXN')::text AS moneda,
           pf.id AS factura_id,
           GREATEST(pf.total - COALESCE(pg.pagado, 0) - COALESCE(nc.aplicado, 0), 0) AS saldo,
           (p_fecha - COALESCE(pf.fecha_vencimiento, pf.fecha_emision))::int AS dias_vencido
      FROM public.proveedor_facturas pf
      LEFT JOIN pagado pg ON pg.proveedor_factura_id = pf.id
      LEFT JOIN nc       ON nc.proveedor_factura_id = pf.id
     WHERE pf.deleted_at IS NULL
       AND pf.estado <> 'Cancelada'
       AND (v_org IS NULL OR pf.organization_id = v_org)
  )
  SELECT s.proveedor_id,
         MAX(s.proveedor_nombre),
         s.moneda,
         SUM(s.saldo),
         SUM(CASE WHEN s.dias_vencido <= 0                       THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 1  AND 30           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 31 AND 60           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido BETWEEN 61 AND 90           THEN s.saldo ELSE 0 END),
         SUM(CASE WHEN s.dias_vencido > 90                        THEN s.saldo ELSE 0 END),
         COUNT(*)::int
    FROM saldos s
   WHERE s.saldo > 0.005
   GROUP BY s.proveedor_id, s.moneda
   ORDER BY SUM(s.saldo) DESC;
END;
$function$;

-- ============================================================
-- P10 · profit_por_embarque
-- ============================================================
-- Ventas y costos se agregaban globalmente y se filtraban al final. Ahora
-- las agregaciones incluyen JOIN a embarques con el filtro por org al frente,
-- preservando la homologación a MXN (migración 20260518213041) tal cual.
CREATE OR REPLACE FUNCTION public.profit_por_embarque()
RETURNS TABLE(
  embarque_id uuid,
  venta_mxn numeric, costo_mxn numeric,
  venta_mxn_from_usd numeric, costo_mxn_from_usd numeric,
  venta_mxn_from_eur numeric, costo_mxn_from_eur numeric,
  venta_mxn_native numeric, costo_mxn_native numeric,
  venta_usd numeric, costo_usd numeric,
  tipo_cambio_usd numeric, tipo_cambio_eur numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH orgs AS (
    SELECT current_user_org_id() AS org,
           has_role(auth.uid(), 'super_admin'::app_role) AS is_super
  ),
  ventas AS (
    SELECT
      cv.embarque_id,
      SUM(CASE WHEN cv.moneda = 'USD' THEN cv.total ELSE 0 END) AS venta_usd_raw,
      SUM(CASE WHEN cv.moneda = 'EUR' THEN cv.total ELSE 0 END) AS venta_eur_raw,
      SUM(CASE WHEN cv.moneda = 'MXN' THEN cv.total ELSE 0 END) AS venta_mxn_raw
    FROM conceptos_venta cv
    JOIN embarques e0 ON e0.id = cv.embarque_id
    CROSS JOIN orgs
    WHERE cv.deleted_at IS NULL
      AND (orgs.is_super OR e0.organization_id = orgs.org)
    GROUP BY cv.embarque_id
  ),
  costos AS (
    SELECT
      cc.embarque_id,
      SUM(CASE WHEN cc.moneda = 'USD' THEN cc.monto ELSE 0 END) AS costo_usd_raw,
      SUM(CASE WHEN cc.moneda = 'EUR' THEN cc.monto ELSE 0 END) AS costo_eur_raw,
      SUM(CASE WHEN cc.moneda = 'MXN' THEN cc.monto ELSE 0 END) AS costo_mxn_raw
    FROM conceptos_costo cc
    JOIN embarques e0 ON e0.id = cc.embarque_id
    CROSS JOIN orgs
    WHERE cc.deleted_at IS NULL
      AND (orgs.is_super OR e0.organization_id = orgs.org)
    GROUP BY cc.embarque_id
  )
  SELECT
    e.id AS embarque_id,
    COALESCE(v.venta_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)
      + COALESCE(v.venta_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)
      + COALESCE(v.venta_mxn_raw, 0) AS venta_mxn,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)
      + COALESCE(c.costo_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)
      + COALESCE(c.costo_mxn_raw, 0) AS costo_mxn,
    COALESCE(v.venta_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0) AS venta_mxn_from_usd,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0) AS costo_mxn_from_usd,
    COALESCE(v.venta_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0) AS venta_mxn_from_eur,
    COALESCE(c.costo_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0) AS costo_mxn_from_eur,
    COALESCE(v.venta_mxn_raw, 0) AS venta_mxn_native,
    COALESCE(c.costo_mxn_raw, 0) AS costo_mxn_native,
    COALESCE(v.venta_usd_raw, 0) AS venta_usd,
    COALESCE(c.costo_usd_raw, 0) AS costo_usd,
    COALESCE(e.tipo_cambio_usd, 0) AS tipo_cambio_usd,
    COALESCE(e.tipo_cambio_eur, 0) AS tipo_cambio_eur
  FROM embarques e
  LEFT JOIN ventas v ON v.embarque_id = e.id
  LEFT JOIN costos c ON c.embarque_id = e.id
  WHERE e.deleted_at IS NULL
    AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (
      COALESCE(v.venta_usd_raw, 0) > 0 OR COALESCE(v.venta_eur_raw, 0) > 0 OR COALESCE(v.venta_mxn_raw, 0) > 0
      OR COALESCE(c.costo_usd_raw, 0) > 0 OR COALESCE(c.costo_eur_raw, 0) > 0 OR COALESCE(c.costo_mxn_raw, 0) > 0
    );
$function$;