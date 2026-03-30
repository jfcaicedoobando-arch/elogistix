CREATE OR REPLACE FUNCTION public.busqueda_global(termino text, limite integer DEFAULT 5)
RETURNS TABLE(id uuid, label text, sublabel text, tipo text, url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
   (SELECT e.id, e.expediente AS label, e.cliente_nombre AS sublabel, 'embarque'::text AS tipo, '/embarques/' || e.id AS url
    FROM embarques e WHERE e.expediente ILIKE '%' || termino || '%'
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT cl.id, cl.nombre AS label, cl.rfc AS sublabel, 'cliente'::text AS tipo, '/clientes/' || cl.id AS url
    FROM clientes cl WHERE (cl.nombre ILIKE '%' || termino || '%' OR cl.rfc ILIKE '%' || termino || '%')
      AND (cl.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT p.id, p.nombre AS label, p.rfc AS sublabel, 'proveedor'::text AS tipo, '/proveedores/' || p.id AS url
    FROM proveedores p WHERE (p.nombre ILIKE '%' || termino || '%' OR p.rfc ILIKE '%' || termino || '%')
      AND (p.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT f.id, f.numero AS label, f.cliente_nombre AS sublabel, 'factura'::text AS tipo, '/facturacion' AS url
    FROM facturas f WHERE (f.numero ILIKE '%' || termino || '%' OR f.cliente_nombre ILIKE '%' || termino || '%')
      AND (f.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite)
   UNION ALL
   (SELECT c.id, c.folio AS label, c.cliente_nombre AS sublabel, 'cotizacion'::text AS tipo, '/cotizaciones/' || c.id AS url
    FROM cotizaciones c WHERE (c.folio ILIKE '%' || termino || '%' OR c.cliente_nombre ILIKE '%' || termino || '%' OR c.prospecto_empresa ILIKE '%' || termino || '%')
      AND (c.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    LIMIT limite);
$$;