
CREATE OR REPLACE FUNCTION public.profit_por_cliente(
  _fecha_desde date DEFAULT NULL,
  _fecha_hasta date DEFAULT NULL,
  _modo text DEFAULT NULL
)
RETURNS TABLE(
  cliente_id uuid,
  cliente_nombre text,
  total_embarques bigint,
  venta_usd numeric,
  costo_usd numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.cliente_id,
    e.cliente_nombre,
    COUNT(DISTINCT e.id) AS total_embarques,
    COALESCE(SUM(
      CASE cv.moneda
        WHEN 'USD' THEN cv.total
        WHEN 'MXN' THEN cv.total / e.tipo_cambio_usd
        WHEN 'EUR' THEN (cv.total * e.tipo_cambio_eur) / e.tipo_cambio_usd
        ELSE 0
      END
    ), 0) AS venta_usd,
    COALESCE(SUM(
      CASE cc_agg.moneda
        WHEN 'USD' THEN cc_agg.monto
        WHEN 'MXN' THEN cc_agg.monto / e.tipo_cambio_usd
        WHEN 'EUR' THEN (cc_agg.monto * e.tipo_cambio_eur) / e.tipo_cambio_usd
        ELSE 0
      END
    ), 0) AS costo_usd
  FROM embarques e
  LEFT JOIN conceptos_venta cv ON cv.embarque_id = e.id
  LEFT JOIN conceptos_costo cc_agg ON cc_agg.embarque_id = e.id
  WHERE (_fecha_desde IS NULL OR e.eta >= _fecha_desde)
    AND (_fecha_hasta IS NULL OR e.eta <= _fecha_hasta)
    AND (_modo IS NULL OR e.modo::text = _modo)
  GROUP BY e.cliente_id, e.cliente_nombre;
$$;
