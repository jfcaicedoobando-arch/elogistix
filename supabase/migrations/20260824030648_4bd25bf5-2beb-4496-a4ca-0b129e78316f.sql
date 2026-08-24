-- ============================================================================
-- Fix B-3 · verificar-sat-semanal barría siempre las mismas 5 orgs.
--  1) organizations.sat_barrido_fecha: cursor persistente por organización.
--  2) public.seleccionar_lote_sat_semanal(integer): selección atómica con
--     rotación real (antes ORDER BY created_at ASC LIMIT 5, sin rotación:
--     las orgs 6+ jamás se verificaban).
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS sat_barrido_fecha timestamptz;

COMMENT ON COLUMN public.organizations.sat_barrido_fecha IS
  'Última corrida del barrido SAT semanal (verificar-sat-semanal) que incluyó a la organización. NULL = nunca barrida (prioridad máxima). Lo estampa public.seleccionar_lote_sat_semanal().';

CREATE OR REPLACE FUNCTION public.seleccionar_lote_sat_semanal(p_max_orgs integer DEFAULT 5)
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- FOR UPDATE dentro del CTE + UPDATE en el mismo statement: dos corridas
  -- concurrentes no se llevan el mismo lote. Estampar al seleccionar (no al
  -- terminar) empuja la org al final de la fila aunque la edge muera a media
  -- corrida: se reintentará tras barrer el resto (cobertura garantizada).
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

COMMENT ON FUNCTION public.seleccionar_lote_sat_semanal(integer) IS
  'Fix B-3: lote semanal del barrido SAT con rotación (antes ORDER BY created_at LIMIT 5 fijo → las orgs nuevas nunca se verificaban). Ordena por sat_barrido_fecha ASC NULLS FIRST y estampa la fecha en la misma transacción. Sólo service_role (la invoca la edge verificar-sat-semanal).';

REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM anon;
REVOKE ALL ON FUNCTION public.seleccionar_lote_sat_semanal(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seleccionar_lote_sat_semanal(integer) TO service_role;