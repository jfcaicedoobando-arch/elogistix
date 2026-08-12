-- FIX-H6-15: re-aplicar bloque canónico de permisos para public.get_tracking_public(text)
-- La migración 20260812192954 recreó la función (SECURITY DEFINER) sin REVOKE/GRANT
-- en el mismo archivo. El enlace público de tracking requiere ejecución por anon.
REVOKE ALL ON FUNCTION public.get_tracking_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracking_public(text) TO anon, authenticated, service_role;