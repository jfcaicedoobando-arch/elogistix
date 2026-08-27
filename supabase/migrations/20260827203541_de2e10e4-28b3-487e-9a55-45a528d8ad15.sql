-- Ola 3 · higiene de permisos
REVOKE EXECUTE ON FUNCTION public.cierre_periodo_fecha(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_periodo_abierto() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_concepto_no_proformado() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_uuid_fiscal_single_write() FROM authenticated;

-- Lectura de la fecha de cierre acotada a la organización del usuario.
CREATE OR REPLACE FUNCTION public.cierre_periodo_actual()
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.cierre_periodo_fecha(public.current_user_org_id());
$function$;

REVOKE ALL ON FUNCTION public.cierre_periodo_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cierre_periodo_actual() TO authenticated, service_role;