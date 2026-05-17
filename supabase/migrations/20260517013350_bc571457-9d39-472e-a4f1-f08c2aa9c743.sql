-- ============================================================
-- B.4 — RPCs *_listado / resumen para reducir N+1
-- ============================================================

-- ---------- embarques_listado ----------
CREATE OR REPLACE FUNCTION public.embarques_listado(
  p_organization_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_modo text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_operador text DEFAULT NULL,
  p_proforma text DEFAULT NULL, -- 'con' | 'sin' | NULL
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_sort_by text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  expediente text,
  bl_master text,
  cliente_id uuid,
  cliente_nombre text,
  modo modo_transporte,
  tipo tipo_operacion,
  estado estado_embarque,
  etd date,
  eta date,
  operador text,
  puerto_origen text,
  puerto_destino text,
  aeropuerto_origen text,
  aeropuerto_destino text,
  ciudad_origen text,
  ciudad_destino text,
  contenedor text,
  tipo_contenedor text,
  descripcion_mercancia text,
  created_at timestamptz,
  tipo_cambio_usd numeric,
  tipo_cambio_eur numeric,
  tiene_proforma boolean,
  costos_total bigint,
  costos_pagados bigint,
  docs_total bigint,
  docs_pendientes bigint,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sort text := lower(coalesce(p_sort_by, 'created_at'));
  v_dir text := CASE WHEN lower(coalesce(p_sort_dir,'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_search text := CASE WHEN p_search IS NULL OR p_search = '' THEN NULL ELSE '%' || p_search || '%' END;
BEGIN
  -- whitelist sort
  IF v_sort NOT IN ('created_at','expediente','cliente_nombre','modo','estado','etd','eta','operador') THEN
    v_sort := 'created_at';
  END IF;

  RETURN QUERY EXECUTE format($q$
    WITH filtered AS (
      SELECT e.*
      FROM embarques e
      WHERE ( $1 IS NULL OR e.organization_id = $1 )
        AND ( $2 IS NULL OR (
              e.expediente ILIKE $2 OR e.cliente_nombre ILIKE $2
              OR e.descripcion_mercancia ILIKE $2 OR e.bl_master ILIKE $2
            ))
        AND ( $3 IS NULL OR e.modo = $3::modo_transporte )
        AND ( $4 IS NULL OR e.cliente_id = $4 )
        AND ( $5 IS NULL OR e.operador = $5 )
        AND ( $6 IS NULL OR ($6 = 'con' AND e.tiene_proforma = true) OR ($6 = 'sin' AND e.tiene_proforma = false) )
        AND ( $7 IS NULL OR e.etd >= $7 )
        AND ( $8 IS NULL OR e.eta <= $8 )
    ),
    counted AS (
      SELECT f.*, count(*) OVER ()::bigint AS total_count
      FROM filtered f
      ORDER BY %I %s NULLS LAST, f.created_at DESC
      OFFSET $9 LIMIT $10
    ),
    cost_agg AS (
      SELECT cc.embarque_id,
             count(*)::bigint AS costos_total,
             count(*) FILTER (WHERE cc.estado_liquidacion = 'Pagado')::bigint AS costos_pagados
      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)
      GROUP BY cc.embarque_id
    ),
    docs_agg AS (
      SELECT d.embarque_id,
             count(*)::bigint AS docs_total,
             count(*) FILTER (WHERE d.estado = 'Pendiente')::bigint AS docs_pendientes
      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)
      GROUP BY d.embarque_id
    )
    SELECT c.id, c.expediente, c.bl_master, c.cliente_id, c.cliente_nombre,
           c.modo, c.tipo, c.estado, c.etd, c.eta, c.operador,
           c.puerto_origen, c.puerto_destino, c.aeropuerto_origen, c.aeropuerto_destino,
           c.ciudad_origen, c.ciudad_destino, c.contenedor, c.tipo_contenedor,
           c.descripcion_mercancia, c.created_at, c.tipo_cambio_usd, c.tipo_cambio_eur,
           c.tiene_proforma,
           COALESCE(ca.costos_total, 0),
           COALESCE(ca.costos_pagados, 0),
           COALESCE(da.docs_total, 0),
           COALESCE(da.docs_pendientes, 0),
           c.total_count
    FROM counted c
    LEFT JOIN cost_agg ca ON ca.embarque_id = c.id
    LEFT JOIN docs_agg da ON da.embarque_id = c.id
    ORDER BY c.%I %s NULLS LAST, c.created_at DESC
  $q$, v_sort, v_dir, v_sort, v_dir)
  USING p_organization_id, v_search, p_modo, p_cliente_id, p_operador,
        p_proforma, p_fecha_desde, p_fecha_hasta, p_offset, p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,int,int) TO authenticated;

-- ---------- facturas_listado ----------
CREATE OR REPLACE FUNCTION public.facturas_listado(
  p_organization_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  numero text,
  cliente_nombre text,
  expediente text,
  total numeric,
  moneda moneda,
  fecha_emision date,
  fecha_vencimiento date,
  estado estado_factura,
  proforma_id uuid,
  proforma_numero text,
  factura_pdf_url text,
  factura_xml_url text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT f.*
    FROM facturas f
    WHERE ( p_organization_id IS NULL OR f.organization_id = p_organization_id )
      AND ( p_search IS NULL OR p_search = '' OR
            f.numero ILIKE '%' || p_search || '%' OR
            f.cliente_nombre ILIKE '%' || p_search || '%' OR
            f.expediente ILIKE '%' || p_search || '%' )
      AND ( p_estado IS NULL OR f.estado = p_estado::estado_factura )
      AND ( p_fecha_desde IS NULL OR f.fecha_emision >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR f.fecha_emision <= p_fecha_hasta )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.created_at DESC
    OFFSET p_offset LIMIT p_limit
  )
  SELECT c.id, c.numero, c.cliente_nombre, c.expediente, c.total, c.moneda,
         c.fecha_emision, c.fecha_vencimiento, c.estado, c.proforma_id,
         p.numero AS proforma_numero,
         c.factura_pdf_url, c.factura_xml_url, c.total_count
  FROM counted c
  LEFT JOIN proformas p ON p.id = c.proforma_id
  ORDER BY c.fecha_emision DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.facturas_listado(uuid,text,text,date,date,int,int) TO authenticated;

-- ---------- reportes_resumen ----------
CREATE OR REPLACE FUNCTION public.reportes_resumen(
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_modo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_kpis jsonb;
BEGIN
  WITH base AS (
    SELECT * FROM public.profit_por_cliente(p_fecha_desde, p_fecha_hasta, p_modo)
  ),
  calc AS (
    SELECT
      cliente_id,
      cliente_nombre,
      total_embarques,
      venta_usd,
      costo_usd,
      (venta_usd - costo_usd) AS profit_usd,
      CASE WHEN venta_usd > 0
           THEN ((venta_usd - costo_usd) / venta_usd) * 100
           ELSE 0
      END AS margen
    FROM base
  )
  SELECT
    jsonb_agg(to_jsonb(c.*) ORDER BY c.profit_usd DESC),
    jsonb_build_object(
      'totalClientes', count(*),
      'revenue', COALESCE(sum(c.venta_usd), 0),
      'profit', COALESCE(sum(c.profit_usd), 0),
      'margenProm',
        CASE WHEN COALESCE(sum(c.venta_usd),0) > 0
             THEN ((sum(c.venta_usd) - sum(c.costo_usd)) / sum(c.venta_usd)) * 100
             ELSE 0
        END
    )
  INTO v_rows, v_kpis
  FROM calc c;

  RETURN jsonb_build_object(
    'clientes', COALESCE(v_rows, '[]'::jsonb),
    'kpis', v_kpis
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reportes_resumen(date,date,text) TO authenticated;