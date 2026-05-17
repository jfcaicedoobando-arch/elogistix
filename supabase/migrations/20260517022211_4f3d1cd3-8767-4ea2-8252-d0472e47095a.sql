-- ============================================================
-- C.3 / Bloque 2.4 — RPCs *_listado fase 2
-- ============================================================

-- ---------- cotizaciones_listado ----------
CREATE OR REPLACE FUNCTION public.cotizaciones_listado(
  p_organization_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_modo text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  folio text,
  cliente_id uuid,
  cliente_nombre text,
  modo modo_transporte,
  origen text,
  destino text,
  subtotal numeric,
  moneda moneda,
  estado estado_cotizacion,
  fecha_vigencia date,
  created_at timestamptz,
  descripcion_mercancia text,
  embarques_vinculados bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT c.*
    FROM cotizaciones c
    WHERE c.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR c.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            c.folio ILIKE '%' || p_search || '%' OR
            c.cliente_nombre ILIKE '%' || p_search || '%' OR
            c.descripcion_mercancia ILIKE '%' || p_search || '%' )
      AND ( p_estado IS NULL OR c.estado = p_estado::estado_cotizacion )
      AND ( p_modo IS NULL OR c.modo = p_modo::modo_transporte )
      AND ( p_cliente_id IS NULL OR c.cliente_id = p_cliente_id )
      AND ( p_fecha_desde IS NULL OR c.created_at >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR c.created_at <= (p_fecha_hasta + interval '1 day') )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    OFFSET p_offset LIMIT p_limit
  ),
  emb_agg AS (
    SELECT e.cotizacion_id, count(*)::bigint AS embarques_vinculados
    FROM embarques e
    WHERE e.cotizacion_id IN (SELECT id FROM counted)
    GROUP BY e.cotizacion_id
  )
  SELECT c.id, c.folio, c.cliente_id, c.cliente_nombre, c.modo, c.origen, c.destino,
         c.subtotal, c.moneda, c.estado, c.fecha_vigencia, c.created_at, c.descripcion_mercancia,
         COALESCE(ea.embarques_vinculados, 0),
         c.total_count
  FROM counted c
  LEFT JOIN emb_agg ea ON ea.cotizacion_id = c.id
  ORDER BY c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.cotizaciones_listado(uuid,text,text,text,uuid,date,date,int,int) TO authenticated;


-- ---------- clientes_listado ----------
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
  total_embarques bigint,
  total_cotizaciones bigint,
  deuda_pendiente numeric,
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
  deuda_agg AS (
    SELECT f.cliente_id, COALESCE(sum(f.total),0)::numeric AS deuda_pendiente
    FROM facturas f
    WHERE f.cliente_id IN (SELECT id FROM counted)
      AND f.estado IN ('Emitida'::estado_factura, 'Vencida'::estado_factura)
    GROUP BY f.cliente_id
  )
  SELECT c.id, c.nombre, c.rfc, c.ciudad, c.estado, c.contacto, c.telefono, c.email, c.dias_credito,
         COALESCE(ea.total_embarques, 0),
         COALESCE(ca.total_cotizaciones, 0),
         COALESCE(da.deuda_pendiente, 0),
         c.total_count
  FROM counted c
  LEFT JOIN emb_agg ea ON ea.cliente_id = c.id
  LEFT JOIN cot_agg ca ON ca.cliente_id = c.id
  LEFT JOIN deuda_agg da ON da.cliente_id = c.id
  ORDER BY c.nombre ASC;
$$;

GRANT EXECUTE ON FUNCTION public.clientes_listado(uuid,text,int,int) TO authenticated;


-- ---------- proveedores_listado ----------
CREATE OR REPLACE FUNCTION public.proveedores_listado(
  p_organization_id uuid DEFAULT NULL,
  p_tipo text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  nombre text,
  tipo tipo_proveedor,
  rfc text,
  contacto text,
  moneda_preferida moneda,
  pais text,
  total_operaciones bigint,
  monto_pendiente numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT p.*
    FROM proveedores p
    WHERE ( p_organization_id IS NULL OR p.organization_id = p_organization_id )
      AND ( p_tipo IS NULL OR p.tipo = p_tipo::tipo_proveedor )
      AND ( p_search IS NULL OR p_search = '' OR
            p.nombre ILIKE '%' || p_search || '%' OR
            p.rfc    ILIKE '%' || p_search || '%' )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.nombre ASC
    OFFSET p_offset LIMIT p_limit
  ),
  ops_agg AS (
    SELECT cc.proveedor_id,
           count(*)::bigint AS total_operaciones,
           COALESCE(sum(cc.monto) FILTER (WHERE cc.estado_liquidacion <> 'Pagado'), 0)::numeric AS monto_pendiente
    FROM conceptos_costo cc
    WHERE cc.proveedor_id IN (SELECT id FROM counted)
    GROUP BY cc.proveedor_id
  )
  SELECT c.id, c.nombre, c.tipo, c.rfc, c.contacto, c.moneda_preferida, c.pais,
         COALESCE(oa.total_operaciones, 0),
         COALESCE(oa.monto_pendiente, 0),
         c.total_count
  FROM counted c
  LEFT JOIN ops_agg oa ON oa.proveedor_id = c.id
  ORDER BY c.nombre ASC;
$$;

GRANT EXECUTE ON FUNCTION public.proveedores_listado(uuid,text,text,int,int) TO authenticated;