-- OLA 1 · C9: guard de rol en los RPC del dashboard de dirección.
-- Se renombra el cálculo a función interna y se expone un wrapper con candado.
ALTER FUNCTION public.dashboard_summary() RENAME TO _dashboard_summary_calc;
ALTER FUNCTION public.dashboard_details() RENAME TO _dashboard_details_calc;

REVOKE ALL ON FUNCTION public._dashboard_summary_calc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._dashboard_summary_calc() FROM anon;
REVOKE ALL ON FUNCTION public._dashboard_summary_calc() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._dashboard_summary_calc() TO service_role;

REVOKE ALL ON FUNCTION public._dashboard_details_calc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._dashboard_details_calc() FROM anon;
REVOKE ALL ON FUNCTION public._dashboard_details_calc() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._dashboard_details_calc() TO service_role;

CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.puede_ver_dashboard_direccion(auth.uid()) THEN
    RAISE EXCEPTION 'LC_DASHBOARD_SIN_PERMISO: tu rol no tiene acceso a los indicadores de dirección (costos y utilidad)'
      USING ERRCODE = '42501';
  END IF;
  RETURN public._dashboard_summary_calc();
END;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_details()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.puede_ver_dashboard_direccion(auth.uid()) THEN
    RAISE EXCEPTION 'LC_DASHBOARD_SIN_PERMISO: tu rol no tiene acceso a los indicadores de dirección (costos y utilidad)'
      USING ERRCODE = '42501';
  END IF;
  RETURN public._dashboard_details_calc();
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary() TO service_role;

REVOKE ALL ON FUNCTION public.dashboard_details() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dashboard_details() FROM anon;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_details() TO service_role;