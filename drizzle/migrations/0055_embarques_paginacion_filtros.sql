CREATE OR REPLACE FUNCTION public.embarques_listado_pagina(
  p_organization_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_modo text DEFAULT NULL,
  p_cliente_id uuid DEFAULT NULL,
  p_operador text DEFAULT NULL,
  p_proforma text DEFAULT NULL,
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_sort_by text DEFAULT 'expediente_num',
  p_sort_dir text DEFAULT 'desc',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50,
  p_estado text DEFAULT NULL,
  p_alerta text DEFAULT NULL,
  p_agrupar boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.org_requerida(p_organization_id);
  v_search text := CASE WHEN NULLIF(p_search, '') IS NOT NULL THEN '%' || p_search || '%' END;
  v_sort text := lower(coalesce(p_sort_by, 'expediente_num'));
  v_dir text := CASE WHEN lower(p_sort_dir) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_nulls text := CASE WHEN v_dir = 'ASC' THEN 'NULLS FIRST' ELSE 'NULLS LAST' END;
  v_group boolean := coalesce(p_agrupar, true);
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), CASE WHEN v_group THEN 500 ELSE 1000 END));
  v_order text;
  v_payload jsonb;
BEGIN
  v_order := CASE
    WHEN v_sort IN ('cliente_nombre', 'modo', 'operador', 'estado') THEN
      format('%I::text COLLATE "C" %s %s', v_sort, v_dir, v_nulls)
    WHEN v_sort IN ('created_at', 'etd', 'eta') THEN
      format('%I %s %s', v_sort, v_dir, v_nulls)
    ELSE format('expediente_num %s', v_dir)
  END;
  v_order := v_order || ', expediente_num DESC, expediente COLLATE "C" DESC NULLS LAST, created_at DESC, id DESC';

  EXECUTE format($query$
    WITH alertas AS MATERIALIZED (
      SELECT a.embarque_id
      FROM public.embarques_alertas_ids() a
      WHERE $10 IS NOT NULL AND a.tipo = $10
    ),
    base AS (
      -- El invocador sólo tiene SELECT de columnas públicas.
      SELECT e.id, e.expediente, e.bl_master, e.cliente_id, e.cliente_nombre,
             e.modo, e.tipo, e.estado, e.etd, e.eta, e.fecha_llegada_real, e.operador,
             e.puerto_origen, e.puerto_destino, e.aeropuerto_origen, e.aeropuerto_destino,
             e.ciudad_origen, e.ciudad_destino, e.contenedor, e.tipo_contenedor,
             e.tipo_carga, e.descripcion_mercancia, e.created_at,
             e.tipo_cambio_usd, e.tipo_cambio_eur, e.tiene_proforma,
             coalesce(nullif(regexp_replace(e.expediente, '\D', '', 'g'), '')::numeric, 0) AS expediente_num,
             CASE WHEN e.estado = 'En Tránsito' AND e.modo = 'Marítimo' AND e.tipo = 'Importación'
                        AND e.etd IS NOT NULL AND e.fecha_llegada_real IS NOT NULL
                        AND e.eta <= (now() AT TIME ZONE 'UTC')::date
                  THEN 'Arribo' ELSE e.estado::text END AS estado_visible
      FROM public.embarques e
      WHERE e.organization_id = $1 AND e.deleted_at IS NULL
        AND ($2 IS NULL OR e.expediente ILIKE $2 OR e.cliente_nombre ILIKE $2
          OR e.descripcion_mercancia ILIKE $2 OR e.bl_master ILIKE $2)
        AND ($3 IS NULL OR e.modo = $3::public.modo_transporte)
        AND ($4 IS NULL OR e.cliente_id = $4)
        AND ($5 IS NULL OR e.operador = $5)
        AND ($6 IS NULL OR ($6 = 'con' AND e.tiene_proforma) OR ($6 = 'sin' AND NOT e.tiene_proforma))
        AND ($7 IS NULL OR e.etd >= $7)
        AND ($8 IS NULL OR e.eta <= $8)
        AND ($10 IS NULL OR EXISTS (SELECT 1 FROM alertas a WHERE a.embarque_id = e.id))
    ),
    agrupados AS (
      SELECT base.*,
        count(*) OVER (PARTITION BY CASE WHEN $11 THEN coalesce(expediente, id::text) ELSE id::text END) AS filas_expediente,
        row_number() OVER (
          PARTITION BY CASE WHEN $11 THEN coalesce(expediente, id::text) ELSE id::text END
          ORDER BY created_at DESC, id DESC
        ) AS fila_expediente
      FROM base
      WHERE $9 IS NULL OR estado_visible = $9
    ),
    visibles AS MATERIALIZED (
      SELECT * FROM agrupados WHERE fila_expediente = 1
    ),
    pagina AS MATERIALIZED (
      SELECT *
      FROM visibles
      ORDER BY %1$s
      OFFSET $12 LIMIT $13
    ),
    extras AS (
      SELECT pagina.*,
        coalesce(c.total, 0) AS costos_total, coalesce(c.pagados, 0) AS costos_pagados,
        coalesce(d.total, 0) AS docs_total, coalesce(d.pendientes, 0) AS docs_pendientes
      FROM pagina
      LEFT JOIN LATERAL (
        SELECT count(*) AS total, count(*) FILTER (WHERE estado_liquidacion = 'Pagado') AS pagados
        FROM public.conceptos_costo
        WHERE $11 AND embarque_id = pagina.id AND deleted_at IS NULL
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS total, count(*) FILTER (WHERE estado = 'Pendiente') AS pendientes
        FROM public.documentos_embarque
        WHERE $11 AND embarque_id = pagina.id AND deleted_at IS NULL
      ) d ON true
    )
    SELECT jsonb_build_object(
      'rows', coalesce((
        SELECT jsonb_agg(to_jsonb(extras) - ARRAY['fila_expediente', 'expediente_num', 'estado_visible'] ORDER BY %1$s)
        FROM extras
      ), '[]'::jsonb),
      'count', count(*),
      'filas_total', coalesce(sum(filas_expediente), 0)
    )
    FROM visibles
  $query$, v_order)
  INTO v_payload
  USING v_org, v_search, p_modo, p_cliente_id, p_operador, p_proforma, p_fecha_desde, p_fecha_hasta,
    p_estado, p_alerta, v_group, greatest(coalesce(p_offset, 0), 0), v_limit;
  RETURN v_payload;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.embarques_listado_pagina(uuid, text, text, uuid, text, text, date, date, text, text, integer, integer, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarques_listado_pagina(uuid, text, text, uuid, text, text, date, date, text, text, integer, integer, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.embarques_alertas_conteos()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'demora', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'demora'),
    'garantia', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'garantia'),
    'cierre_operativo', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'cierre_operativo'),
    'admin_pendiente', count(DISTINCT embarque_id) FILTER (WHERE tipo = 'admin_pendiente')
  )
  FROM public.embarques_alertas_ids();
$function$;

REVOKE EXECUTE ON FUNCTION public.embarques_alertas_conteos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarques_alertas_conteos() TO authenticated, service_role;
