REVOKE ALL ON FUNCTION public._cotizaciones_sync_puertos_tarifa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._cotizaciones_sync_puertos_tarifa() TO authenticated, service_role;