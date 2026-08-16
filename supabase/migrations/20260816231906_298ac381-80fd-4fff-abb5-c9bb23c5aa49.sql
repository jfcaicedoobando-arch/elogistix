-- FIX-45: las funciones de trigger del CRM quedaron con EXECUTE para PUBLIC
-- (por ende anon). Son SECURITY DEFINER: se revoca el acceso público/anon.
REVOKE ALL ON FUNCTION public._crm_registrar_cambio_etapa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crm_registrar_cambio_etapa() FROM anon;
GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO authenticated;
GRANT EXECUTE ON FUNCTION public._crm_registrar_cambio_etapa() TO service_role;

REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM anon;
GRANT EXECUTE ON FUNCTION public._crm_actividad_toca_oportunidad() TO authenticated;
GRANT EXECUTE ON FUNCTION public._crm_actividad_toca_oportunidad() TO service_role;