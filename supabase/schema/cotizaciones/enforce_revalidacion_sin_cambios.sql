-- Fuente canónica de public.enforce_revalidacion_sin_cambios (R201-COT-02).
-- Siempre recalcula; una bandera reaprobada no sustituye la comparación del
-- snapshot económico autoritativo.

CREATE OR REPLACE FUNCTION public.enforce_revalidacion_sin_cambios(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_res jsonb;
BEGIN
  v_res := public.revalidar_tarifa_cotizacion(p_cotizacion_id);
  IF v_res->>'severidad' = 'bloqueante' THEN
    RAISE EXCEPTION 'LC_TARIFA_REQUIERE_REVALIDACION severidad=% max_delta_pct=% — resuelve la revalidación antes de convertir',
      v_res->>'severidad', COALESCE(v_res->>'max_delta_pct','0') USING ERRCODE='P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enforce_revalidacion_sin_cambios(uuid) TO authenticated, service_role;