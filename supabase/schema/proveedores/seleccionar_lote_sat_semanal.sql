-- Espejo canónico · public.seleccionar_lote_sat_semanal(integer)
-- Fix B-3: rotación del lote semanal del barrido SAT.
CREATE OR REPLACE FUNCTION public.seleccionar_lote_sat_semanal(p_max_orgs integer DEFAULT 5)
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  WITH lote AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.rfc IS NOT NULL AND btrim(o.rfc) <> ''
    ORDER BY o.sat_barrido_fecha ASC NULLS FIRST, o.created_at ASC, o.id ASC
    LIMIT GREATEST(p_max_orgs, 1)
    FOR UPDATE OF o
  )
  UPDATE public.organizations o
  SET sat_barrido_fecha = pg_catalog.now()
  FROM lote
  WHERE o.id = lote.id
  RETURNING o.id;
END;
$function$;

REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM anon;
REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seleccionar_lote_sat_semanal(integer) TO service_role;
