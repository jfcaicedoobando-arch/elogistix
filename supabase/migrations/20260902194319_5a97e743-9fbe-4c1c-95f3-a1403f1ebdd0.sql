-- v13.823.51 — los guards nuevos son service_role-only (sólo se disparan como
-- triggers). Espejo obligatorio en supabase/tests/rls/_ci_service_role_only.sql.
REVOKE ALL ON FUNCTION public._cotizacion_oportunidad_misma_org() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_actividad_entidad_misma_org() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_probabilidad_terminal() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._cotizacion_oportunidad_misma_org() TO service_role;
GRANT EXECUTE ON FUNCTION public._crm_actividad_entidad_misma_org() TO service_role;
GRANT EXECUTE ON FUNCTION public._crm_probabilidad_terminal() TO service_role;