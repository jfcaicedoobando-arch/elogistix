-- ============================================================================
-- HOTFIX R3-01 · /embarques 42501 "permission denied for table embarques"
-- Causa: `embarques_listado` NO es SECURITY DEFINER y hacía `SELECT e.*`, lo
-- que exige SELECT a nivel TABLA. La migración FIX2 B-1 (20260824033552)
-- revocó ese SELECT de tabla a authenticated/anon y lo re-otorgó columna por
-- columna, excluyendo 4 columnas internas. Solución: nombrar columnas
-- explícitas en el CTE `filtered` (sin reabrir las columnas internas).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.embarques_listado(
  p_organization_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT NULL::text,
  p_modo text DEFAULT NULL::text,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_operador text DEFAULT NULL::text,
  p_proforma text DEFAULT NULL::text,
  p_fecha_desde date DEFAULT NULL::date,
  p_fecha_hasta date DEFAULT NULL::date,
  p_sort_by text DEFAULT 'expediente_num'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, expediente text, bl_master text, cliente_id uuid, cliente_nombre text,
  modo modo_transporte, tipo tipo_operacion, estado estado_embarque, etd date, eta date,
  operador text, puerto_origen text, puerto_destino text, aeropuerto_origen text,
  aeropuerto_destino text, ciudad_origen text, ciudad_destino text, contenedor text,
  tipo_contenedor text, tipo_carga text, descripcion_mercancia text,
  created_at timestamp with time zone, tipo_cambio_usd numeric, tipo_cambio_eur numeric,
  tiene_proforma boolean, costos_total bigint, costos_pagados bigint,
  docs_total bigint, docs_pendientes bigint, total_count bigint
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_sort text := lower(coalesce(p_sort_by, 'expediente_num'));
  v_dir text := CASE WHEN lower(coalesce(p_sort_dir,'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_search text := CASE WHEN p_search IS NULL OR p_search = '' THEN NULL ELSE '%' || p_search || '%' END;
  v_order_expr text;
BEGIN
  IF v_sort NOT IN ('created_at','expediente','expediente_num','cliente_nombre','modo','estado','etd','eta','operador') THEN
    v_sort := 'expediente_num';
  END IF;

  IF v_sort IN ('expediente','expediente_num') THEN
    v_order_expr := format(
      'NULLIF(regexp_replace(coalesce(expediente,''''), ''\D'', '''', ''g''), '''')::bigint %s NULLS LAST, expediente %s NULLS LAST',
      v_dir, v_dir
    );
  ELSE
    v_order_expr := format('%I %s NULLS LAST', v_sort, v_dir);
  END IF;

  RETURN QUERY EXECUTE format($q$
    WITH filtered AS (
      -- HOTFIX R3-01: columnas explícitas (nunca e.*) para respetar el grant
      -- por columna que mantiene cerradas las 4 columnas internas.
      SELECT e.id, e.expediente, e.bl_master, e.cliente_id, e.cliente_nombre,
             e.modo, e.tipo, e.estado, e.etd, e.eta, e.operador,
             e.puerto_origen, e.puerto_destino, e.aeropuerto_origen, e.aeropuerto_destino,
             e.ciudad_origen, e.ciudad_destino, e.contenedor, e.tipo_contenedor,
             e.tipo_carga, e.descripcion_mercancia, e.created_at,
             e.tipo_cambio_usd, e.tipo_cambio_eur, e.tiene_proforma
      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND e.organization_id = public.org_requerida($1)
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
      ORDER BY %s, f.created_at DESC, f.id DESC
      OFFSET $9 LIMIT $10
    ),
    cost_agg AS (
      SELECT cc.embarque_id,
             count(*)::bigint AS costos_total,
             count(*) FILTER (WHERE cc.estado_liquidacion = 'Pagado')::bigint AS costos_pagados
      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)
        AND cc.deleted_at IS NULL             -- FIX C5
      GROUP BY cc.embarque_id
    ),
    docs_agg AS (
      SELECT d.embarque_id,
             count(*)::bigint AS docs_total,
             count(*) FILTER (WHERE d.estado = 'Pendiente')::bigint AS docs_pendientes
      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)
        AND d.deleted_at IS NULL              -- FIX C5
      GROUP BY d.embarque_id
    )
    SELECT c.id, c.expediente, c.bl_master, c.cliente_id, c.cliente_nombre,
           c.modo, c.tipo, c.estado, c.etd, c.eta, c.operador,
           c.puerto_origen, c.puerto_destino, c.aeropuerto_origen, c.aeropuerto_destino,
           c.ciudad_origen, c.ciudad_destino, c.contenedor, c.tipo_contenedor,
           c.tipo_carga,
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
    ORDER BY %s, c.created_at DESC, c.id DESC
  $q$,
    v_order_expr,
    CASE WHEN v_sort IN ('expediente','expediente_num')
      THEN format('NULLIF(regexp_replace(coalesce(c.expediente,''''), ''\D'', '''', ''g''), '''')::bigint %s NULLS LAST, c.expediente %s NULLS LAST', v_dir, v_dir)
      ELSE format('c.%I %s NULLS LAST', v_sort, v_dir)
    END
  )
  USING p_organization_id, v_search, p_modo, p_cliente_id, p_operador,
        p_proforma, p_fecha_desde, p_fecha_hasta, p_offset, p_limit;
END;
$function$;

COMMENT ON FUNCTION public.embarques_listado(uuid, text, text, uuid, text, text, date, date, text, text, integer, integer) IS
  'Listado paginado de embarques por organización. HOTFIX R3-01: columnas explícitas (sin e.*) para no requerir SELECT a nivel tabla sobre public.embarques.';
