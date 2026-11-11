-- Forward UX fix based on facturas_listado read from production on 2026-11-11.
-- Keep the existing RPC available for older clients. RLS remains authoritative.
CREATE OR REPLACE FUNCTION public.facturas_listado_v2(p_org_id uuid DEFAULT NULL::uuid, p_search text DEFAULT NULL::text, p_estado text DEFAULT NULL::text, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date, p_offset integer DEFAULT 0, p_limit integer DEFAULT 50, p_cliente_nombre text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, numero text, cliente_nombre text, expediente text, total numeric, moneda moneda, fecha_emision date, fecha_vencimiento date, estado estado_factura, proforma_id uuid, proforma_numero text, factura_pdf_url text, factura_xml_url text, ambiente ambiente_facturapi, acuse_cancelacion_status text, cancellation_status text, enviada_cliente_at timestamp with time zone, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  WITH filtered AS (
    SELECT f.*
    FROM public.facturas f
    WHERE f.deleted_at IS NULL                -- FIX C5
      AND f.organization_id = public.org_requerida(p_org_id)
      AND ( p_search IS NULL OR p_search = '' OR
            f.numero ILIKE '%' || p_search || '%' OR
            f.cliente_nombre ILIKE '%' || p_search || '%' OR
            f.expediente ILIKE '%' || p_search || '%' )
      AND ( p_cliente_nombre IS NULL OR f.cliente_nombre = p_cliente_nombre )
      AND ( p_estado IS NULL OR f.estado = p_estado::estado_factura )
      AND ( p_fecha_desde IS NULL OR f.fecha_emision >= p_fecha_desde )
      AND ( p_fecha_hasta IS NULL OR f.fecha_emision <= p_fecha_hasta )
  ),
  counted AS (
    SELECT f.*, count(*) OVER ()::bigint AS total_count
    FROM filtered f
    ORDER BY f.fecha_emision DESC NULLS LAST, f.id DESC
    OFFSET greatest(coalesce(p_offset, 0), 0)
    LIMIT least(greatest(coalesce(p_limit, 50), 1), 1000)
  )
  SELECT c.id, c.numero, c.cliente_nombre, c.expediente, c.total, c.moneda,
         c.fecha_emision, c.fecha_vencimiento, c.estado, c.proforma_id,
         p.numero AS proforma_numero,
         c.factura_pdf_url, c.factura_xml_url,
         c.ambiente,
         c.acuse_cancelacion_status,
         c.cancellation_status,
         c.enviada_cliente_at,
         c.total_count
  FROM counted c
  LEFT JOIN public.proformas p ON p.id = c.proforma_id AND p.organization_id = c.organization_id
  ORDER BY c.fecha_emision DESC NULLS LAST, c.id DESC;
$function$;

REVOKE ALL ON FUNCTION public.facturas_listado_v2(uuid,text,text,date,date,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturas_listado_v2(uuid,text,text,date,date,integer,integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.facturas_clientes_listado(
  p_org_id uuid DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 500
)
RETURNS TABLE(cliente_nombre text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT f.cliente_nombre COLLATE "C" AS cliente_nombre
  FROM public.facturas f
  WHERE f.deleted_at IS NULL
    AND f.organization_id = public.org_requerida(p_org_id)
    AND f.cliente_nombre IS NOT NULL AND f.cliente_nombre <> ''
  ORDER BY 1
  OFFSET greatest(coalesce(p_offset, 0), 0)
  LIMIT least(greatest(coalesce(p_limit, 500), 1), 1000);
$function$;

REVOKE ALL ON FUNCTION public.facturas_clientes_listado(uuid,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.facturas_clientes_listado(uuid,integer,integer) TO authenticated, service_role;
