CREATE OR REPLACE FUNCTION public.profit_por_embarque()
 RETURNS TABLE(embarque_id uuid, venta_mxn numeric, costo_mxn numeric, venta_mxn_from_usd numeric, costo_mxn_from_usd numeric, venta_mxn_from_eur numeric, costo_mxn_from_eur numeric, venta_mxn_native numeric, costo_mxn_native numeric, venta_usd numeric, costo_usd numeric, tipo_cambio_usd numeric, tipo_cambio_eur numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH orgs AS (
    SELECT current_user_org_id() AS org,
           has_role(auth.uid(), 'super_admin'::app_role) AS is_super
  ),
  facturada AS (
    SELECT v.embarque_id,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'USD') AS venta_usd_raw,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'EUR') AS venta_eur_raw,
      SUM(v.venta_doc) FILTER (WHERE v.moneda = 'MXN') AS venta_mxn_raw,
      SUM(v.venta_mxn) FILTER (WHERE v.moneda = 'USD') AS venta_usd_mxn,
      SUM(v.venta_mxn) FILTER (WHERE v.moneda = 'EUR') AS venta_eur_mxn
    FROM public._venta_facturada_por_embarque(public.org_scope()) v
    GROUP BY v.embarque_id
  ),
  pactada AS (
    SELECT cv.embarque_id,
      SUM(cv.total) FILTER (WHERE cv.moneda::text = 'USD') AS venta_usd_raw,
      SUM(cv.total) FILTER (WHERE cv.moneda::text = 'EUR') AS venta_eur_raw,
      SUM(cv.total) FILTER (WHERE cv.moneda::text = 'MXN') AS venta_mxn_raw,
      SUM(cv.total * COALESCE(e1.tipo_cambio_usd, 0)) FILTER (WHERE cv.moneda::text = 'USD') AS venta_usd_mxn,
      SUM(cv.total * COALESCE(e1.tipo_cambio_eur, 0)) FILTER (WHERE cv.moneda::text = 'EUR') AS venta_eur_mxn
    FROM conceptos_venta cv
    JOIN embarques e1 ON e1.id = cv.embarque_id
    WHERE cv.deleted_at IS NULL
      AND e1.organization_id = public.org_scope()
      AND NOT EXISTS (SELECT 1 FROM facturada f WHERE f.embarque_id = cv.embarque_id)
    GROUP BY cv.embarque_id
  ),
  ventas AS (
    SELECT * FROM facturada
    UNION ALL
    SELECT * FROM pactada
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
    COALESCE(v.venta_usd_mxn, 0) + COALESCE(v.venta_eur_mxn, 0) + COALESCE(v.venta_mxn_raw, 0) AS venta_mxn,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0)
      + COALESCE(c.costo_eur_raw, 0) * COALESCE(e.tipo_cambio_eur, 0)
      + COALESCE(c.costo_mxn_raw, 0) AS costo_mxn,
    COALESCE(v.venta_usd_mxn, 0) AS venta_mxn_from_usd,
    COALESCE(c.costo_usd_raw, 0) * COALESCE(e.tipo_cambio_usd, 0) AS costo_mxn_from_usd,
    COALESCE(v.venta_eur_mxn, 0) AS venta_mxn_from_eur,
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
    AND (e.organization_id = public.org_scope())
    AND (
      COALESCE(v.venta_usd_raw, 0) > 0 OR COALESCE(v.venta_eur_raw, 0) > 0 OR COALESCE(v.venta_mxn_raw, 0) > 0
      OR COALESCE(c.costo_usd_raw, 0) > 0 OR COALESCE(c.costo_eur_raw, 0) > 0 OR COALESCE(c.costo_mxn_raw, 0) > 0
    );
$function$;

REVOKE ALL ON FUNCTION public.profit_por_embarque() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profit_por_embarque() FROM anon;
GRANT EXECUTE ON FUNCTION public.profit_por_embarque() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profit_por_embarque() TO service_role;