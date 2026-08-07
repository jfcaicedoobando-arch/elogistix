REVOKE ALL ON FUNCTION public._log_role_change_om() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_om() TO service_role;

REVOKE ALL ON FUNCTION public._log_role_change_ur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_ur() TO service_role;

REVOKE ALL ON FUNCTION public._bitacora_facturas_estado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bitacora_facturas_estado() TO service_role;

REVOKE ALL ON FUNCTION public._bitacora_normalizar_modulo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bitacora_normalizar_modulo() TO service_role;