
-- 1. Server-side profit aggregation function
CREATE OR REPLACE FUNCTION public.profit_por_embarque()
RETURNS TABLE(embarque_id uuid, venta_usd numeric, costo_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    e.id AS embarque_id,
    COALESCE(v.total_venta, 0) AS venta_usd,
    COALESCE(c.total_costo, 0) AS costo_usd
  FROM embarques e
  LEFT JOIN (
    SELECT cv.embarque_id, SUM(cv.total) AS total_venta
    FROM conceptos_venta cv WHERE cv.moneda = 'USD'
    GROUP BY cv.embarque_id
  ) v ON v.embarque_id = e.id
  LEFT JOIN (
    SELECT cc.embarque_id, SUM(cc.monto) AS total_costo
    FROM conceptos_costo cc WHERE cc.moneda = 'USD'
    GROUP BY cc.embarque_id
  ) c ON c.embarque_id = e.id
  WHERE COALESCE(v.total_venta, 0) > 0 OR COALESCE(c.total_costo, 0) > 0;
$$;

-- 2. Distinct operators function
CREATE OR REPLACE FUNCTION public.operadores_distintos()
RETURNS TABLE(operador text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT e.operador
  FROM embarques e
  WHERE e.operador IS NOT NULL AND e.operador != ''
  ORDER BY e.operador;
$$;

-- 3. Global search consolidation
CREATE OR REPLACE FUNCTION public.busqueda_global(termino text, limite int DEFAULT 5)
RETURNS TABLE(id uuid, label text, sublabel text, tipo text, url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  (SELECT e.id, e.expediente AS label, e.cliente_nombre AS sublabel,
          'embarque'::text AS tipo, '/embarques/' || e.id AS url
   FROM embarques e WHERE e.expediente ILIKE '%' || termino || '%'
   LIMIT limite)
  UNION ALL
  (SELECT cl.id, cl.nombre AS label, cl.rfc AS sublabel,
          'cliente'::text AS tipo, '/clientes/' || cl.id AS url
   FROM clientes cl WHERE cl.nombre ILIKE '%' || termino || '%' OR cl.rfc ILIKE '%' || termino || '%'
   LIMIT limite)
  UNION ALL
  (SELECT p.id, p.nombre AS label, p.rfc AS sublabel,
          'proveedor'::text AS tipo, '/proveedores/' || p.id AS url
   FROM proveedores p WHERE p.nombre ILIKE '%' || termino || '%' OR p.rfc ILIKE '%' || termino || '%'
   LIMIT limite)
  UNION ALL
  (SELECT f.id, f.numero AS label, f.cliente_nombre AS sublabel,
          'factura'::text AS tipo, '/facturacion' AS url
   FROM facturas f WHERE f.numero ILIKE '%' || termino || '%' OR f.cliente_nombre ILIKE '%' || termino || '%'
   LIMIT limite);
$$;
