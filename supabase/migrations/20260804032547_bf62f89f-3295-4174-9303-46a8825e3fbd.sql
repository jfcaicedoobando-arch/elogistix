REVOKE ALL ON FUNCTION public._cerrar_entrantes_por_uuid() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO service_role;
GRANT EXECUTE ON FUNCTION public._cerrar_entrantes_por_uuid() TO postgres;