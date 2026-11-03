-- All related invoice IDs, including historical headers, so existing live
-- payments/credits are counted even when their parent is cancelled/deleted.
CREATE OR REPLACE FUNCTION public._h14_facturas_baja_embarque(p_embarque_id uuid, p_org uuid, p_proformas uuid[])
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(f.id ORDER BY f.id), ARRAY[]::uuid[])
  FROM public.facturas f
  WHERE f.organization_id = p_org
    AND (f.embarque_id = p_embarque_id
      OR f.proforma_id = ANY(p_proformas)
      OR EXISTS (
        SELECT 1 FROM public.factura_embarques fe
        WHERE fe.factura_id = f.id AND fe.organization_id = p_org
          AND fe.embarque_id = p_embarque_id AND fe.activa IS TRUE)
      OR EXISTS (
        SELECT 1 FROM public.conceptos_factura cf
        WHERE cf.factura_id = f.id AND cf.organization_id = p_org
          AND cf.deleted_at IS NULL
          AND (cf.embarque_id = p_embarque_id OR cf.proforma_id_origen = ANY(p_proformas)))
      OR EXISTS (
        SELECT 1 FROM public.proformas p
        WHERE p.organization_id = p_org AND p.id = ANY(p_proformas)
          AND f.id IN (p.factura_id, p.factura_secundaria_id)));
$function$;
REVOKE ALL ON FUNCTION public._h14_facturas_baja_embarque(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated, service_role;
