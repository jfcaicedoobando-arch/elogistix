-- Helper: criterio único de REPs bloqueantes vs REPs en verificación ante el SAT.
CREATE OR REPLACE FUNCTION public._refact_reps_bloqueantes(p_factura_id uuid)
RETURNS TABLE(bloqueantes int, en_verificacion int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (
      WHERE COALESCE(pf.rep_cancellation_status, '') NOT IN ('pending', 'verifying')
    )::int AS bloqueantes,
    COUNT(*) FILTER (
      WHERE COALESCE(pf.rep_cancellation_status, '') IN ('pending', 'verifying')
    )::int AS en_verificacion
  FROM public.pagos_factura pf
  WHERE pf.factura_id = p_factura_id
    AND pf.deleted_at IS NULL
    AND pf.uuid_rep IS NOT NULL
    AND pf.rep_cancelado_en IS NULL;
$function$;

REVOKE ALL ON FUNCTION public._refact_reps_bloqueantes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._refact_reps_bloqueantes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._refact_reps_bloqueantes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._refact_reps_bloqueantes(uuid) TO service_role;
