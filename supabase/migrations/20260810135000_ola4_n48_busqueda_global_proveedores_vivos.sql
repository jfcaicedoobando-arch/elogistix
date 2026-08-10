-- Ola 4 · N48: la rama `proveedores` era la única sin filtro deleted_at →
-- la búsqueda global devolvía proveedores soft-eliminados con URL muerta.
-- Base: 20260728035544 (íntegra); sólo cambia la rama proveedores.
CREATE OR REPLACE FUNCTION public.busqueda_global(termino text, limite integer DEFAULT 5)
 RETURNS TABLE(id uuid, label text, sublabel text, tipo text, url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
   (SELECT DISTINCT ON (e.expediente)
           e.id, e.expediente AS label,
           (e.cliente_nombre
             || CASE
                  WHEN e.bl_master IS NOT NULL AND e.bl_master ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/M ' || e.bl_master
                  WHEN e.bl_house IS NOT NULL AND e.bl_house ILIKE '%' || termino || '%' AND e.expediente NOT ILIKE '%' || termino || '%'
                    THEN ' · BL/H ' || e.bl_house
                  WHEN COUNT(*) OVER (PARTITION BY e.expediente) > 1
                    THEN ' · ' || COUNT(*) OVER (PARTITION BY e.expediente) || ' contenedores'
                  ELSE ''
                END) AS sublabel,
           'embarque'::text AS tipo,
           '/embarques/' || e.id AS url
    FROM embarques e
    WHERE (e.expediente ILIKE '%' || termino || '%'
           OR e.bl_master ILIKE '%' || termino || '%'
           OR e.bl_house  ILIKE '%' || termino || '%')
      AND e.deleted_at IS NULL
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    ORDER BY e.expediente, e.created_at ASC
    LIMIT limite)
   UNION ALL
   (SELECT cl.id, cl.nombre AS label, cl.rfc AS sublabel, 'cliente'::text AS tipo, '/clientes/' || cl.id AS url
    FROM clientes cl WHERE (cl.nombre ILIKE '%' || termino || '%' OR cl.rfc ILIKE '%' || termino || '%')
      AND cl.deleted_at IS NULL
      AND (cl.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT p.id, p.nombre AS label, p.rfc AS sublabel, 'proveedor'::text AS tipo, '/proveedores/' || p.id AS url
    FROM proveedores p WHERE (p.nombre ILIKE '%' || termino || '%' OR p.rfc ILIKE '%' || termino || '%')
      -- Ola 4 · N48: filtro que faltaba (las demás ramas ya lo tenían).
      AND p.deleted_at IS NULL
      AND (p.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT f.id, f.numero AS label, f.cliente_nombre AS sublabel, 'factura'::text AS tipo, '/facturacion/' || f.id AS url
    FROM facturas f WHERE (f.numero ILIKE '%' || termino || '%' OR f.cliente_nombre ILIKE '%' || termino || '%')
      AND f.deleted_at IS NULL
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT c.id, c.folio AS label, c.cliente_nombre AS sublabel, 'cotizacion'::text AS tipo, '/cotizaciones/' || c.id AS url
    FROM cotizaciones c WHERE (c.folio ILIKE '%' || termino || '%' OR c.cliente_nombre ILIKE '%' || termino || '%' OR c.prospecto_empresa ILIKE '%' || termino || '%')
      AND c.deleted_at IS NULL
      AND (c.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT pr.id, pr.numero AS label,
           (pr.cliente_nombre || ' · ' || pr.expediente) AS sublabel,
           'proforma'::text AS tipo,
           '/proformas/' || pr.id AS url
    FROM proformas pr
    WHERE (pr.numero ILIKE '%' || termino || '%'
           OR pr.cliente_nombre ILIKE '%' || termino || '%'
           OR pr.expediente ILIKE '%' || termino || '%')
      AND pr.deleted_at IS NULL
      AND (pr.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   -- B-062: matchear también por folio_interno (FI-…) — es el folio que la UI
   -- muestra en todas las listas CxP; buscar por él antes devolvía vacío.
   (SELECT pf.id,
           COALESCE(pf.folio_interno, pf.folio_proveedor) AS label,
           (pf.proveedor_nombre
              || COALESCE(' · ' || pv.rfc, '')
              || CASE
                   WHEN pf.folio_interno IS NOT NULL AND pf.folio_proveedor IS NOT NULL
                        AND pf.folio_interno IS DISTINCT FROM pf.folio_proveedor
                     THEN ' · Prov ' || pf.folio_proveedor
                   ELSE ''
                 END) AS sublabel,
           'factura_proveedor'::text AS tipo,
           '/cxp?factura=' || pf.id AS url
    FROM proveedor_facturas pf
    LEFT JOIN proveedores pv ON pv.id = pf.proveedor_id
    WHERE pf.estado <> 'Cancelada'
      AND pf.deleted_at IS NULL
      AND (pf.folio_proveedor ILIKE '%' || termino || '%'
           OR pf.folio_interno ILIKE '%' || termino || '%'
           OR pf.proveedor_nombre ILIKE '%' || termino || '%'
           OR pv.rfc ILIKE '%' || termino || '%')
      AND (pf.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite);
$function$;

REVOKE ALL ON FUNCTION public.busqueda_global(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.busqueda_global(text, integer) TO authenticated, service_role;
