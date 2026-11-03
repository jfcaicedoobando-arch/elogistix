-- Internal lineage resolver. A historical source can still support a live
-- invoice; document states are filtered by the collector, not erased here.
CREATE OR REPLACE FUNCTION public._h14_proformas_baja_embarque(p_embarque_id uuid, p_org uuid)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE relacionadas(id) AS (
    SELECT p.id
    FROM public.proformas p
    WHERE p.organization_id = p_org
      AND (p.embarque_id = p_embarque_id
        OR p_embarque_id = ANY(COALESCE(p.embarques_ids, ARRAY[]::uuid[]))
        OR EXISTS (
          SELECT 1 FROM public.proforma_conceptos_consolidados pc
          WHERE pc.proforma_id = p.id AND pc.organization_id = p_org
            AND pc.embarque_id = p_embarque_id AND pc.deleted_at IS NULL)
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.organization_id = p_org
            AND cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL))
    UNION
    SELECT padre.id
    FROM relacionadas r
    JOIN public.proformas fuente ON fuente.id = r.id AND fuente.organization_id = p_org
    JOIN public.proformas padre ON padre.organization_id = p_org
      AND (fuente.consolidada_en = padre.id
        OR fuente.id = ANY(COALESCE(padre.proformas_origen, ARRAY[]::uuid[])))
  )
  SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) FROM relacionadas;
$function$;
REVOKE ALL ON FUNCTION public._h14_proformas_baja_embarque(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
