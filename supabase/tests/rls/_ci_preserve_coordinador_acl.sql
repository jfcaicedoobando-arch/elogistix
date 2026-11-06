-- Undo only artificial blanket EXECUTE grants from the CI harness.
REVOKE EXECUTE ON FUNCTION public._cliente_coordinador_guard(), public._cotizacion_crear_handover() FROM authenticated, service_role;
\ir _ci_check_coordinador_acl.sql
