CREATE OR REPLACE FUNCTION public.proveedores_listado(p_organization_id uuid DEFAULT NULL::uuid, p_tipo text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50, p_origen text DEFAULT NULL::text, p_categoria text DEFAULT NULL::text, p_subtipo_gasto text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, nombre text, tipo tipo_proveedor, rfc text, contacto text, moneda_preferida moneda, pais text, origen_proveedor text, categoria categoria_proveedor, subtipo_gasto subtipo_gasto_operativo, total_operaciones bigint, monto_pendiente numeric, total_count bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT p.*
    FROM proveedores p
    WHERE p.deleted_at IS NULL
      AND ( p_organization_id IS NULL OR p.organization_id = p_organization_id )
      AND ( p_tipo IS NULL OR p_tipo = '' OR p.tipo = p_tipo::tipo_proveedor )
      AND ( p_origen IS NULL OR p_origen = '' OR p_origen = 'todos' OR p.origen_proveedor::text = p_origen )
      AND ( p_categoria IS NULL OR p_categoria = '' OR p_categoria = 'todos' OR p.categoria::text = p_categoria )
      AND ( p_subtipo_gasto IS NULL OR p_subtipo_gasto = '' OR p.subtipo_gasto::text = p_subtipo_gasto )
      AND ( p_search IS NULL OR p_search = '' OR
            p.nombre   ILIKE '%' || p_search || '%' OR
            p.rfc      ILIKE '%' || p_search || '%' OR
            p.contacto ILIKE '%' || p_search || '%' OR
            p.email    ILIKE '%' || p_search || '%' )
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
         c.origen_proveedor::text,
         c.categoria, c.subtipo_gasto,
         COALESCE(oa.total_operaciones, 0),
         COALESCE(oa.monto_pendiente, 0),
         c.total_count
  FROM counted c
  LEFT JOIN ops_agg oa ON oa.proveedor_id = c.id
  ORDER BY c.nombre ASC;
$function$;