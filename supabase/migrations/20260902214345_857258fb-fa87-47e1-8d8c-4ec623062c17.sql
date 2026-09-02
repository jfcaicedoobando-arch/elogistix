-- v13.823.57b · ACL: los trigger functions no se llaman desde la API.
REVOKE ALL ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_cerrar_oportunidad_desde_cotizacion() TO service_role;
GRANT EXECUTE ON FUNCTION public._crm_sync_oportunidad_desde_cotizacion() TO service_role;