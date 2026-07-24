REVOKE ALL ON FUNCTION public._bloquear_rol_legacy_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._bloquear_rol_legacy_insert() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public._log_role_change_om() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_om() TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public._log_role_change_ur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._log_role_change_ur() TO authenticated, service_role, postgres;