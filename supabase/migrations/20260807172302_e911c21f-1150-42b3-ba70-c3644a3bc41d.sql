-- FIX-H6-09: re-aplica el bloque REVOKE/GRANT de public.has_role, que quedó
-- fuera de la migración 20260807145542 (optimización RLS con has_any_role).
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.has_any_role(uuid, app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, app_role[]) TO authenticated, anon, service_role;