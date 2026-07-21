DROP FUNCTION IF EXISTS public.clientes_listado(uuid,text,int,int);

CREATE OR REPLACE FUNCTION public.clientes_listado(
  p_organization_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  nombre text,
  rfc text,
  ciudad text,
  estado text,
  contacto text,
  telefono text,
  email text,
  dias_credito int,
  limite_credito_mxn numeric,
  total_embarques bigint,
  total_cotizaciones bigint,
  deuda_pendiente numeric,
  saldo_pendiente_mxn numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT c.*
    FROM clientes c
    WHERE c.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR c.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            c.nombre ILIKE '%' || p_search || '%' OR
            c.rfc    ILIKE '%' || p_search || '%' )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.nombre ASC
    OFFSET p_offset LIMIT p_limit
  ),
  emb_agg AS (
    SELECT e.cliente_id, count(*)::bigint AS total_embarques
    FROM embarques e
    WHERE e.cliente_id IN (SELECT id FROM counted)
    GROUP BY e.cliente_id
  ),
  cot_agg AS (
    SELECT c.cliente_id, count(*)::bigint AS total_cotizaciones
    FROM cotizaciones c
    WHERE c.cliente_id IN (SELECT id FROM counted)
      AND c.deleted_at IS NULL
    GROUP BY c.cliente_id
  ),
  facturas_vivas AS (
    SELECT
      f.id,
      f.cliente_id,
      f.total,
      f.moneda,
      COALESCE(NULLIF(f.tipo_cambio, 0), 1) AS tc
    FROM facturas f
    WHERE f.cliente_id IN (SELECT id FROM counted)
      AND f.deleted_at IS NULL
      AND f.estado IN ('Emitida'::estado_factura, 'Vencida'::estado_factura, 'Parcialmente pagada'::estado_factura, 'Pagada'::estado_factura)
  ),
  pagos_agg AS (
    SELECT p.factura_id, COALESCE(SUM(p.monto_aplicado_factura),0) AS pagado
    FROM pagos_factura p
    WHERE p.deleted_at IS NULL
      AND p.factura_id IN (SELECT id FROM facturas_vivas)
    GROUP BY p.factura_id
  ),
  nc_agg AS (
    SELECT n.factura_id, COALESCE(SUM(n.monto),0) AS nc_aplicada
    FROM factura_notas_credito n
    WHERE n.deleted_at IS NULL
      AND n.estado = 'Aplicada'
      AND n.factura_id IN (SELECT id FROM facturas_vivas)
    GROUP BY n.factura_id
  ),
  saldo_agg AS (
    SELECT
      fv.cliente_id,
      SUM(
        GREATEST(0, COALESCE(fv.total,0) - COALESCE(pa.pagado,0) - COALESCE(na.nc_aplicada,0))
        * CASE WHEN fv.moneda = 'MXN' THEN 1 ELSE fv.tc END
      ) AS saldo_pendiente_mxn
    FROM facturas_vivas fv
    LEFT JOIN pagos_agg pa ON pa.factura_id = fv.id
    LEFT JOIN nc_agg   na ON na.factura_id = fv.id
    GROUP BY fv.cliente_id
  ),
  deuda_agg AS (
    SELECT f.cliente_id, COALESCE(sum(f.total),0)::numeric AS deuda_pendiente
    FROM facturas f
    WHERE f.cliente_id IN (SELECT id FROM counted)
      AND f.estado IN ('Emitida'::estado_factura, 'Vencida'::estado_factura)
    GROUP BY f.cliente_id
  )
  SELECT
    c.id, c.nombre, c.rfc, c.ciudad, c.estado, c.contacto, c.telefono, c.email,
    c.dias_credito,
    c.limite_credito_mxn,
    COALESCE(ea.total_embarques, 0),
    COALESCE(ca.total_cotizaciones, 0),
    COALESCE(da.deuda_pendiente, 0),
    ROUND(COALESCE(sa.saldo_pendiente_mxn, 0), 2),
    c.total_count
  FROM counted c
  LEFT JOIN emb_agg   ea ON ea.cliente_id = c.id
  LEFT JOIN cot_agg   ca ON ca.cliente_id = c.id
  LEFT JOIN deuda_agg da ON da.cliente_id = c.id
  LEFT JOIN saldo_agg sa ON sa.cliente_id = c.id
  ORDER BY c.nombre ASC;
$$;

GRANT EXECUTE ON FUNCTION public.clientes_listado(uuid,text,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clientes_listado(uuid,text,int,int) TO service_role;
