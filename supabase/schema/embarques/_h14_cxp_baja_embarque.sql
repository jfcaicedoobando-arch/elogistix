-- Structural membership for deletion, independent of amounts. This does not
-- change effective allocations, debt, closing, P&L or financial attribution.
CREATE OR REPLACE FUNCTION public._h14_cxp_baja_embarque(p_embarque_id uuid, p_org uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(pf.id ORDER BY pf.id), ARRAY[]::uuid[])
  FROM public.proveedor_facturas pf
  WHERE pf.organization_id = p_org
    AND (pf.embarque_id = p_embarque_id
      OR EXISTS (
        SELECT 1 FROM public.proveedor_facturas_conceptos pc
        JOIN public.conceptos_costo cc ON cc.id = pc.concepto_costo_id
          AND cc.organization_id = p_org
        WHERE pc.proveedor_factura_id = pf.id AND pc.organization_id = p_org
          AND cc.embarque_id = p_embarque_id)
      OR EXISTS (
        SELECT 1 FROM public.seguros_embarque s
        WHERE s.proveedor_factura_id = pf.id AND s.organization_id = p_org
          AND s.embarque_id = p_embarque_id AND s.deleted_at IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.embarque_facturas_entrantes e
        WHERE e.proveedor_factura_id = pf.id AND e.organization_id = p_org
          AND e.embarque_id = p_embarque_id AND e.deleted_at IS NULL)
      OR EXISTS (
        SELECT 1 FROM public.embarque_garantias_contenedor g
        WHERE g.proveedor_factura_id = pf.id AND g.organization_id = p_org
          AND g.embarque_id = p_embarque_id AND g.deleted_at IS NULL));
$function$;
REVOKE ALL ON FUNCTION public._h14_cxp_baja_embarque(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
