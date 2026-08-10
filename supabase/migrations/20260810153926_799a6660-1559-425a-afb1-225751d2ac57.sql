CREATE OR REPLACE FUNCTION public.profit_por_cliente(
  _fecha_desde date DEFAULT NULL::date,
  _fecha_hasta date DEFAULT NULL::date,
  _modo text DEFAULT NULL::text
)
RETURNS TABLE(cliente_id uuid, cliente_nombre text, total_embarques bigint, venta_usd numeric, costo_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT e.id, e.cliente_id, e.cliente_nombre, e.tipo_cambio_usd, e.tipo_cambio_eur
    FROM embarques e
    WHERE e.deleted_at IS NULL
      AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)
      AND (_fecha_hasta IS NULL OR e.eta <= _fecha_hasta)
      AND (_modo IS NULL OR e.modo::text = _modo)
      AND (e.organization_id = public.org_scope())
  ),
  ventas AS (
    SELECT cv.embarque_id,
      SUM(CASE cv.moneda WHEN 'USD' THEN cv.total WHEN 'MXN' THEN cv.total / b.tipo_cambio_usd WHEN 'EUR' THEN (cv.total * b.tipo_cambio_eur) / b.tipo_cambio_usd ELSE 0 END) AS venta_usd
    FROM conceptos_venta cv
    JOIN base b ON b.id = cv.embarque_id
    WHERE cv.deleted_at IS NULL
    GROUP BY cv.embarque_id
  ),
  costos AS (
    SELECT cc.embarque_id,
      SUM(CASE cc.moneda WHEN 'USD' THEN cc.monto WHEN 'MXN' THEN cc.monto / b.tipo_cambio_usd WHEN 'EUR' THEN (cc.monto * b.tipo_cambio_eur) / b.tipo_cambio_usd ELSE 0 END) AS costo_usd
    FROM conceptos_costo cc
    JOIN base b ON b.id = cc.embarque_id
    WHERE cc.deleted_at IS NULL
    GROUP BY cc.embarque_id
  )
  SELECT
    b.cliente_id,
    b.cliente_nombre,
    COUNT(DISTINCT b.id) AS total_embarques,
    COALESCE(SUM(v.venta_usd), 0) AS venta_usd,
    COALESCE(SUM(c.costo_usd), 0) AS costo_usd
  FROM base b
  LEFT JOIN ventas v ON v.embarque_id = b.id
  LEFT JOIN costos c ON c.embarque_id = b.id
  GROUP BY b.cliente_id, b.cliente_nombre;
$function$;