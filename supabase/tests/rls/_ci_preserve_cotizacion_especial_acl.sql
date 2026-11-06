-- Undo only the two grants introduced by _ci_post_migrate.sql, not product ACL.
REVOKE EXECUTE ON FUNCTION public._cotizacion_autorizacion_guard() FROM authenticated, service_role;
\ir _ci_check_cotizacion_especial_acl.sql
